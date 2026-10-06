import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const file=process.env.RACEHOLLER_FIXTURE_FILE;
const fixture=file?JSON.parse(fs.readFileSync(file,'utf8')):null;
test.skip(!fixture,'Supply an isolated RACEHOLLER_FIXTURE_FILE; these tests mutate only that workspace.');
const route=(path:string)=>`/dashboard/tracks/${fixture.fixture.trackId}/events/${fixture.fixture.eventId}${path}`;
async function signIn(page:Page,index=0,password=fixture.password){
 await page.goto('/login');await page.getByLabel('Official Email').fill(fixture.users[index].email);
 await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await page.waitForURL('**/dashboard');await expect(page.getByRole('heading',{name:'Race Official Dashboard'})).toBeVisible();
}
async function client(index=0){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error}=await db.auth.signInWithPassword({email:fixture.users[index].email,password:fixture.password});
 if(error)throw error;return db;
}
async function pass(db:Awaited<ReturnType<typeof client>>,entry:any,ordinal:number,value:string){
 const {data:current,error:readError}=await db.from('attempts').select('save_version').eq('entry_id',entry.id).eq('ordinal',ordinal).maybeSingle();if(readError)throw readError;
 const result=await db.rpc('save_race_attempt',{p_track_id:fixture.fixture.trackId,p_event_id:fixture.fixture.eventId,p_class_id:entry.event_class_id,p_entry_id:entry.id,p_ordinal:ordinal,p_status:'valid',p_elapsed_ms:Math.round(Number(value)*1000),p_distance_mm:null,p_penalty_ms:0,p_raw_input:value,p_expected_version:current?.save_version||0});if(result.error)throw result.error;return result;
}
test.beforeAll(()=>{if(fixture&&(!fixture.trackSlug.startsWith('raceholler-test-')||!fixture.users.every((u:any)=>u.email.endsWith('@test.invalid'))))throw new Error('Refusing to run against nonfixture accounts');});

test('five account modes stay discoverable on mobile and can be changed',async({page})=>{
 for(let i=0;i<5;i++){
  await signIn(page,i);const mode=fixture.users[i].mode;
  await expect(page.getByRole('heading',{name:'Your Tracks & Venues'})).toHaveCount(mode==='series'?0:1);
  await expect(page.getByRole('heading',{name:'Championship Series',exact:true})).toHaveCount(mode.includes('series')?1:0);
  await page.getByRole('link',{name:'Account settings',exact:true}).click();
  await expect(page.getByLabel('Account mode')).toHaveValue(mode);
  if(i===0){await page.getByLabel('Account mode').selectOption('single_track_series');await page.getByRole('button',{name:'Save preferences'}).click();await expect(page.getByText('Preferences saved',{exact:true})).toBeVisible();await page.getByLabel('Account mode').selectOption(mode);await page.getByRole('button',{name:'Save preferences'}).click();}
  await page.goto('/dashboard');await page.getByRole('button',{name:'Sign Out',exact:true}).click();await page.waitForURL('**/login');
 }
});

test('series bonus and roster changes appear immediately and after reload',async({page})=>{
 await signIn(page);await page.goto(`/dashboard/series/${fixture.fixture.seriesId}/points`);
 const add=page.getByRole('form',{name:'Add bonus',exact:true});await add.getByLabel('Bonus condition').selectOption('custom');await add.getByLabel('Points',{exact:true}).fill('17');await add.getByRole('button',{name:'Add bonus',exact:true}).click();
 await expect(page.getByText(/^custom · 17 points$/i)).toBeVisible();await page.reload();await expect(page.getByText(/^custom · 17 points$/i)).toBeVisible();
 const card=page.locator('article').filter({has:page.getByText(/^custom · 17 points$/i)});await card.getByText('Edit bonus',{exact:true}).click();await card.getByLabel('Points',{exact:true}).fill('19');await card.getByRole('button',{name:'Save bonus'}).click();await expect(page.getByText(/^custom · 19 points$/i)).toBeVisible();
 await page.getByRole('button',{name:'Remove custom bonus'}).click();await expect(page.getByText(/^custom · 19 points$/i)).toHaveCount(0);
 await page.goto(`/dashboard/series/${fixture.fixture.seriesId}/roster`);
 const racer=`Browser racer ${test.info().project.name}`;await page.locator('input[name="display_name"]').fill(racer);await page.getByRole('button',{name:'Add to Roster',exact:true}).click();await expect(page.locator('p').filter({hasText:new RegExp(`^${racer}$`)})).toBeVisible();await page.reload();await expect(page.locator('p').filter({hasText:new RegExp(`^${racer}$`)})).toBeVisible();
 const row=page.locator('div').filter({has:page.locator('p').filter({hasText:new RegExp(`^${racer}$`)})}).filter({has:page.getByTitle('Edit Racer')}).last();await row.getByTitle('Edit Racer').click();await page.locator('input[name="display_name"]').fill(`${racer} edited`);await page.getByRole('button',{name:'Save Changes',exact:true}).click();await expect(page.locator('p').filter({hasText:new RegExp(`^${racer} edited$`)})).toBeVisible();
 const edited=page.locator('div').filter({has:page.locator('p').filter({hasText:new RegExp(`^${racer} edited$`)})}).filter({has:page.getByTitle('Remove Racer')}).last();await edited.getByTitle('Remove Racer').click();await expect(page.locator('p').filter({hasText:new RegExp(`^${racer} edited$`)})).toHaveCount(0);
});

test('series defaults can be reordered without altering another race',async({page})=>{
 await signIn(page);await page.goto(`/dashboard/tracks/${fixture.fixture.trackId}/events/${fixture.fixture.roundTwoId}`);
 const rows=page.getByTestId('event-class');await expect(rows).toHaveCount(2);const names=await rows.locator('p').allTextContents();
 await rows.first().getByRole('button',{name:'Move down',exact:true}).click();await expect(rows.first()).toContainText('Consistency fixture');await page.reload();await expect(rows.first()).toContainText('Consistency fixture');
 await rows.first().getByRole('button',{name:'Move down',exact:true}).click();await expect(rows.first()).toContainText('Fastest fixture');
 await page.goto(route(''));await expect(page.getByTestId('event-class').first()).toContainText('Fastest fixture');expect(names.length).toBe(2);
});

test('1205 racers render in the scorer, public results, and selected-order export',async({page})=>{
 await signIn(page);await page.goto(`/dashboard/tracks/${fixture.fixture.trackId}/events/${fixture.fixture.largeEventId}`);await expect(page.getByText('1205 registered entries',{exact:true})).toBeVisible();await page.goto(`/dashboard/tracks/${fixture.fixture.trackId}/events/${fixture.fixture.largeEventId}/scoring`);await expect(page.getByTestId('scoring-row')).toHaveCount(1205);
 await page.goto(`/r/${fixture.trackSlug}/${fixture.largeSlug}`);await expect(page.getByTestId('result-row')).toHaveCount(1205);
 await page.getByLabel('Sort results').selectOption('run');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download results CSV'}).click();const data=await download;const text=fs.readFileSync((await data.path())!,'utf8');expect(text.split('\r\n').filter(Boolean)).toHaveLength(1206);expect(text).toContain('Large racer 1205');
});

test('live updates arrive by websocket, recover by polling, and expose pass three',async({page,context})=>{
 const db=await client();const {data:entries,error}=await db.from('entries').select('*').eq('event_class_id',fixture.fastestClassId).order('order_num');if(error)throw error;const entry=entries!.find(e=>e.display_name==='Fixture Two')!;
 const frames:string[]=[];page.on('websocket',ws=>ws.on('framereceived',f=>{if(typeof f.payload==='string')frames.push(f.payload);}));
 await page.goto(`/r/${fixture.trackSlug}/${fixture.eventSlug}`);await expect(page.getByText('Live updates connected',{exact:true})).toBeVisible();
 await pass(db,entry,3,'5.871');await expect(page.getByTestId('result-row').filter({hasText:'Fixture Two'})).toContainText('5.871');expect(frames.some(f=>f.includes('postgres_changes'))).toBe(true);await expect(page.getByLabel('Sort results').locator('option[value="pass:3"]')).toHaveCount(1);
 await context.routeWebSocket('**/realtime/v1/websocket**',ws=>ws.close());await page.reload();await expect(page.getByText('Checking for updates',{exact:true})).toBeVisible();
 await pass(db,entry,3,'5.872');await expect(page.getByTestId('result-row').filter({hasText:'Fixture Two'})).toContainText('5.872',{timeout:45000});
 await context.setOffline(true);await pass(db,entry,3,'5.873');await context.setOffline(false);await expect(page.getByTestId('result-row').filter({hasText:'Fixture Two'})).toContainText('5.873',{timeout:45000});
});

test('owners, scorers, and outsiders see only their allowed management actions',async({page})=>{
 await signIn(page,5);await page.goto(route('/scoring'));await expect(page.getByRole('textbox',{name:'Fixture One, pass 1',exact:true})).toBeVisible();await page.goto(route('/settings'));await expect(page.getByText(/Only the track or organization owner/)).toBeVisible();
 await page.goto('/dashboard');await page.getByRole('button',{name:'Sign Out',exact:true}).click();await page.waitForURL('**/login');await signIn(page,6);await page.goto(route('/scoring'));await page.waitForURL('**/dashboard');await page.goto(`/dashboard/series/${fixture.fixture.seriesId}/points`);await page.waitForURL('**/dashboard');
});

 test('spectator home gives live races priority and orders the rest by race date',async({page})=>{
  await page.goto(`/?track=${fixture.fixture.trackId}`);
  const rows=await page.locator('a[data-event-id]').evaluateAll(elements=>elements.map(e=>({id:e.getAttribute('data-event-id'),text:e.textContent||''})));
  expect(rows.length).toBeGreaterThanOrEqual(3);
  const live=rows.filter(e=>e.text.toLowerCase().includes('live'));
  expect(rows.slice(0,live.length).map(e=>e.id)).toEqual(live.map(e=>e.id));
  const dates=rows.slice(live.length).map(e=>e.text.match(/\d{4}-\d{2}-\d{2}/)?.[0]);
  expect(dates).toEqual([...dates].sort());
 });
