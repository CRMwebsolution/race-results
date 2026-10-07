import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const file=process.env.RACEHOLLER_FIXTURE_FILE,f=file?JSON.parse(fs.readFileSync(file,'utf8')):null;
test.skip(!f,'Use an isolated acceptance fixture');
test.beforeAll(()=>{if(f&&(!f.trackSlug.startsWith('raceholler-test-')||!f.users.every((u:any)=>u.email.endsWith('@test.invalid'))))throw new Error('Fixture accounts required');});
async function login(page:Page,index=0){await page.goto('/login');await page.getByLabel('Official Email').fill(f.users[index].email);await page.getByLabel('Password',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');}
async function client(index=0){const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await db.auth.signInWithPassword({email:f.users[index].email,password:f.password});if(error)throw error;return db;}
async function submit(page:Page,name:string){const url=new URL(page.url()).pathname;const response=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===url);await page.getByRole('button',{name,exact:true}).click();expect((await response).status()).toBeLessThan(400);}

test('six racers keep overall prizes and compressed member points in touring and in-house seasons',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Publish each fixture once');test.setTimeout(240000);
 const db=await client();await login(page);
 for(const x of [
  {base:`/dashboard/series/${f.sixSeriesId}`,event:f.sixEventId,season:f.sixSeasonId,public:`/s/${f.sixSeriesId}/races/six-racer-example`},
  {base:`/dashboard/tracks/${f.fixture.trackId}`,event:f.trackSeasonEventId,season:f.trackSeasonId,public:`/r/${f.trackSlug}/in-house-example`},
 ]){
  await page.goto(`${x.base}/events/${x.event}/settings`);await page.locator('select[name="status"]').selectOption('completed');await submit(page,'Update Status');await expect(page.locator('select[name="status"]')).toHaveValue('completed');
  await page.goto(`${x.base}/seasons/${x.season}`);await submit(page,'Publish championship standings');await expect(page.getByRole('status')).toContainText('Standings published');
  const {data:v,error}=await db.from('competition_result_versions').select('payload').eq('season_id',x.season).eq('is_current',true).single();if(error)throw error;
  expect((v!.payload as any).standings.map((r:any)=>[r.name,r.total])).toEqual([['Jay',100],['Michael',90],['Grumpy',80]]);
  await page.goto(x.public);await expect(page.getByTestId('result-row')).toHaveCount(6);expect(await page.getByTestId('result-row').locator('p.font-bold').allTextContents()).toEqual(['Jeremy','Jay','Michael','Scotty','Ronnie','Grumpy']);
  expect(await page.locator('table tbody tr').evaluateAll(rows=>rows.map(row=>Array.from(row.querySelectorAll('td')).map(c=>c.textContent)))).toEqual([['1','Jay','2','100'],['2','Michael','3','90'],['3','Grumpy','6','80']]);
 }
 const host=await client(6);expect((await host.rpc('can_edit_race',{p_event_id:f.sixEventId})).data).toBe(false);expect((await host.rpc('can_publish_race',{p_event_id:f.sixEventId})).data).toBe(false);
 const {data:event,error}=await host.rpc('create_track_event',{p_track_id:f.hostTrackId,p_name:'LDMB own race',p_local_date:'2026-10-08',p_slug:'host-normal',p_template_ids:[]});if(error)throw error;
 const {error:status}=await host.rpc('set_race_event_status',{p_event_id:event,p_status:'scheduled',p_expected_revision:1});if(status)throw status;
 await page.goto(`/r/${f.hostSlug}`);await expect(page.getByText('LDMB own race',{exact:true})).toBeVisible();await expect(page.getByText('SEDOT at LDMB',{exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:/Championship points positions/})).toHaveCount(0);
});

test('signup awards, late membership, withdrawal, vehicles, and explained overrides preserve history',async({page,browserName})=>{
 test.skip(browserName!=='chromium','Stateful amendment journey runs once');const db=await client();await login(page);
 const season=f.sixSeasonId,path=`/dashboard/series/${f.sixSeriesId}/seasons/${season}`;
 const {data:regs}=await db.from('competition_registrations').select('*').eq('season_id',season);const jay=regs!.find(r=>r.display_name==='Jay')!;
 // Membership changes keep the eligibility captured in completed race results.
 const {error:leave}=await db.from('competition_registrations').update({left_on:'2026-10-08'}).eq('id',jay.id);if(leave)throw leave;
 const {data:cc}=await db.from('competition_classes').select('id').eq('season_id',season).single();
 const {data:late,error}=await db.from('competition_registrations').insert({season_id:season,class_id:cc!.id,display_name:'Jay',vehicle_name:'Second vehicle',joined_on:'2026-10-08'}).select().single();if(error)throw error;
 await page.goto(path);const form=page.locator('form').filter({has:page.getByRole('button',{name:'Record explained change'})});
 await form.getByLabel('Registered entry').selectOption(late!.id);await form.getByLabel('Points',{exact:true}).fill('5');await form.getByLabel('Explanation').fill('Early signup for second vehicle');await submit(page,'Record explained change');
 await submit(page,'Publish championship standings');
 const {data:first}=await db.from('competition_result_versions').select('*').eq('season_id',season).eq('is_current',true).single();const firstPayload=first!.payload as any;
 expect(firstPayload.standings.find((r:any)=>r.racerId===jay.id).total).toBe(100);expect(firstPayload.standings.find((r:any)=>r.racerId===late!.id).total).toBe(5);expect(firstPayload.standings.find((r:any)=>r.racerId===late!.id).breakdown).toHaveLength(1);
 const before=await db.from('competition_seasons').select('rules_revision').eq('id',season).single();const empty=await db.rpc('record_competition_points',{p_season_id:season,p_registration_id:late!.id,p_event_id:f.sixEventId,p_mode:'override',p_points:7,p_reason:' ',p_expected_revision:before.data!.rules_revision});expect(empty.error).not.toBeNull();
 await form.getByLabel('Registered entry').selectOption(late!.id);await form.getByLabel('Competition',{exact:true}).selectOption(f.sixEventId);await form.getByLabel('Change type').selectOption('override');await form.getByLabel('Points',{exact:true}).fill('7');await form.getByLabel('Explanation').fill('Approved retrospective exception');await submit(page,'Record explained change');await submit(page,'Publish championship standings');
 const {data:current}=await db.from('competition_result_versions').select('payload').eq('season_id',season).eq('is_current',true).single();expect((current!.payload as any).standings.find((r:any)=>r.racerId===late!.id).total).toBe(12);
 const {data:history}=await db.from('competition_result_versions').select('payload').eq('id',first!.id).single();expect(history!.payload).toEqual(first!.payload);
 const {data:changes}=await db.from('competition_points_changes').select('*').eq('registration_id',late!.id).order('created_at');expect(changes).toHaveLength(2);expect(changes!.every(c=>c.previous_points===0&&c.reason.trim()&&c.actor_id===f.users[0].id)).toBe(true);
 const {data:next,error:nextError}=await db.rpc('create_competition_season',{p_track_id:null,p_series_id:f.sixSeriesId,p_name:'Fresh next season',p_starts_on:'2027-01-01',p_ends_on:'2027-12-31'});if(nextError)throw nextError;expect((await db.from('competition_registrations').select('id').eq('season_id',next)).data).toHaveLength(0);expect((await db.from('competition_points_changes').select('id').eq('season_id',next)).data).toHaveLength(0);
});

test('spectator filters separate touring series and keep in-house races under Tracks',async({page})=>{
 await page.goto('/?type=track');await expect(page.locator(`a[data-event-id="${f.trackSeasonEventId}"]`)).toHaveAttribute('href',`/r/${f.trackSlug}/in-house-example`);await expect(page.locator(`a[data-event-id="${f.sixEventId}"]`)).toHaveCount(0);
 await page.goto('/?type=series');await expect(page.locator(`a[data-event-id="${f.sixEventId}"]`)).toHaveAttribute('href',`/s/${f.sixSeriesId}/races/six-racer-example`);await expect(page.locator(`a[data-event-id="${f.trackSeasonEventId}"]`)).toHaveCount(0);await expect(page.getByLabel('Track state')).toHaveCount(0);
 await page.goto('/');await expect(page.locator(`a[data-event-id="${f.sixEventId}"]`)).toBeVisible();await expect(page.locator(`a[data-event-id="${f.trackSeasonEventId}"]`)).toBeVisible();
});
