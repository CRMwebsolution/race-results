import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const file=process.env.RACEHOLLER_UI_FIXTURE;
const fixture=file?JSON.parse(fs.readFileSync(file,'utf8')):null;
test.skip(!fixture,'Supply an isolated RACEHOLLER_UI_FIXTURE.');
test.setTimeout(180000);
test.beforeEach(({page})=>{page.setDefaultNavigationTimeout(60000);page.setDefaultTimeout(30000);});
test.afterEach(async({page},info)=>{
 if(info.status!==info.expectedStatus){
  await info.attach('failure-url',{body:page.url(),contentType:'text/plain'});
  try{await info.attach('failure-page',{body:await page.locator('body').innerText({timeout:3000}),contentType:'text/plain'});}catch{/* A closed browser may not expose its document. */}
 }
});
test.beforeAll(()=>{if(fixture&&(!/^raceholler-ui-[0-9a-f]+@test.invalid$/.test(fixture.email)||!/^[0-9a-f]{10}$/.test(fixture.tag)))throw new Error('Only isolated fixtures are allowed.');});
async function signIn(page:Page){
 await page.goto('/login');
 await page.getByLabel('Official Email').fill(fixture.email);
 await page.getByLabel('Password',{exact:true}).fill(fixture.password);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await page.waitForURL('**/dashboard',{timeout:60000});
}
async function client(){
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(15000)})}});
 const {data,error}=await db.auth.signInWithPassword({email:fixture.email,password:fixture.password});
 if(error||data.user?.id!==fixture.id)throw new Error('Fixture sign-in failed.');
 return db;
}
const race=(id=fixture.eventId)=>`/dashboard/tracks/${fixture.trackId}/events/${id}`;
const series=`/dashboard/series/${fixture?.seriesId}`;
async function noOverflow(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1);}
async function prepared(page:Page){await expect(page.locator('[data-offline-ready]')).toHaveAttribute('data-offline-ready','true',{timeout:20000});}

test('appearance: clear navigation and readable Day/Night at desktop, tablet and phone sizes',async({page})=>{
 await signIn(page);await page.goto(race()+'/scoring');
 await expect(page.getByRole('button',{name:'Complete race',exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Judge scores',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Prepare for offline',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Lock this device',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Enter results',exact:true})).toHaveAttribute('aria-current','page');
 for(const [width,height] of [[1440,900],[768,1024],[390,844]]){
  await page.setViewportSize({width,height});await noOverflow(page);
  if(await page.getByRole('button',{name:'Switch to Day mode'}).count())await page.getByRole('button',{name:'Switch to Day mode'}).click();
  const colors=await page.getByRole('textbox',{name:'Fixture One, pass 1',exact:true}).evaluate(el=>({fg:getComputedStyle(el).color,bg:getComputedStyle(el).backgroundColor}));
  expect(colors.fg).toBe('rgb(15, 23, 42)');expect(colors.bg).toBe('rgb(255, 255, 255)');
  await page.screenshot({path:test.info().outputPath(`day-${width}.png`),fullPage:true});
  await page.getByRole('button',{name:'Switch to Night mode'}).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme','night');await noOverflow(page);
 }
 await page.getByRole('button',{name:'Switch to Day mode'}).click();await page.reload();
 await expect(page.locator('html')).toHaveAttribute('data-theme','day');
 await page.goto(race()+'/settings');
 await expect(page.getByText('Open offline devices · finalization blocked')).toHaveCount(0);
 await expect(page.locator('main form button').last()).toHaveText('Delete / withdraw event');
});

test('registration: season prerequisite, top form, current date, accordions and sortable membership',async({page})=>{
 await signIn(page);await page.goto(`/dashboard/series/${fixture.emptySeriesId}`);
 await page.getByRole('link',{name:'Create series season',exact:true}).click();
 await expect(page.getByText(/Create a series season before registering contestants/)).toBeVisible();
 await page.goto(series+`/seasons/${fixture.seasonId}`);
 const sections=page.locator('main > details');
 await expect(sections.first().locator('summary')).toHaveText('Add contestant');
 await expect(sections.first()).toHaveAttribute('open','');
 const form=page.locator('form').filter({has:page.getByRole('button',{name:'Register entry',exact:true})});
 const today=await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
 await expect(form.getByLabel('Membership starts')).toHaveValue(today);
 const name=`UI added ${test.info().project.name}`;
 await form.getByLabel('Racer name').fill(name);await form.getByLabel('Vehicle / number').fill('Vehicle Two');
 await form.getByRole('button',{name:'Register entry',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Added: '+name);
 const roster=page.locator('details').filter({has:page.locator('summary').filter({hasText:/^Registered contestants/})}).first();
 if(!await roster.evaluate(el=>(el as HTMLDetailsElement).open))await roster.locator('summary').click();
 await expect(roster.locator('tr[data-registration-id]').filter({hasText:name})).toBeVisible();
 await roster.getByRole('button',{name:/^Racer/}).click();
 await expect(roster.getByRole('columnheader',{name:/Racer/})).toHaveAttribute('aria-sort','descending');await noOverflow(page);
});

test('scoring: no-pass and distances save, column sorting works, status changes have feedback',async({page})=>{
 await signIn(page);await page.goto(race()+'/scoring');await prepared(page);
 const pass=page.getByRole('textbox',{name:'Fixture One, pass 1',exact:true});
 await pass.fill('-');await pass.press('Enter');await expect(pass).toHaveValue('-');
 await expect(page.getByTestId('scoring-row').filter({hasText:'Fixture One'})).toContainText('No qualifying pass');
 const second=page.getByRole('textbox',{name:'Fixture Two, pass 1',exact:true});
 await second.fill('108 ft 6 in');await second.press('Enter');await expect(second).toHaveValue('108 ft 6 in');
 await expect(page.getByRole('status')).toHaveText('Saved');
 await page.getByRole('columnheader',{name:/^Racer/}).getByRole('button').click();
 await page.getByRole('columnheader',{name:/^Racer/}).getByRole('button').click();
 await expect(page.getByTestId('scoring-row').first()).toContainText('Fixture Two');
 await page.goto(race()+'/settings');
 await page.getByLabel('Race status').selectOption('scheduled');
 await page.getByRole('button',{name:'Update status',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Race status updated: scheduled');
 await page.getByLabel('Race status').selectOption('live');
 await page.getByRole('button',{name:'Update status',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Race status updated: live');
 const db=await client();
 const {data:attempts,error}=await db.from('attempts').select('raw_input,status,elapsed_ms,distance_mm').eq('event_class_id',fixture.classId);
 if(error)throw error;
 expect(attempts!.find(a=>a.raw_input==='-')).toMatchObject({status:'no_time',elapsed_ms:null,distance_mm:null});
 expect(attempts!.find(a=>a.raw_input==='108 ft 6 in')?.distance_mm).toBe(33071);
});

test('completion: focused unsaved result becomes official without device-session controls',async({page})=>{
 const db=await client();const name=`Complete ${test.info().project.name} ${Date.now()}`;
 const {data:id,error}=await db.rpc('create_track_event',{p_track_id:fixture.trackId,p_name:name,p_local_date:'2026-10-07',p_slug:`complete-${Date.now()}`,p_template_ids:[]});if(error)throw error;
 const {data:classes,error:classError}=await db.from('event_classes').select('id').eq('event_id',id!).eq('name','Fastest fixture').single();if(classError)throw classError;
 const {error:entryError}=await db.rpc('create_race_entry',{p_track_id:fixture.trackId,p_event_id:id!,p_class_id:classes!.id,p_display_name:'Last racer',p_order_num:1});if(entryError)throw entryError;
 await signIn(page);await page.goto(race(id!)+'/scoring');await prepared(page);
 await page.getByRole('textbox',{name:'Last racer, pass 1',exact:true}).fill('9.019');
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Complete race',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Race completed — results saved.',{timeout:30000});
 await expect(page.getByTestId('result-row')).toContainText('9.019');
 const {data:version,error:vError}=await db.from('event_result_versions').select('payload').eq('event_id',id!).eq('version',1).single();if(vError)throw vError;
 expect((version!.payload as any).attempts[0].raw_input).toBe('9.019');expect((version!.payload as any).results[0].final_rank).toBe(1);
});

test('reconnect: automatic preparation survives lost signal and remains editable after reconnect',async({page,context})=>{
 await signIn(page);await page.goto(race()+'/scoring');await prepared(page);await context.setOffline(true);
 const pass=page.getByRole('textbox',{name:'Fixture One, pass 2',exact:true});await pass.fill('8.123');await pass.press('Enter');
 await expect(page.getByRole('status')).toContainText('Saved on this device');await expect(pass).toBeEnabled();
 await context.setOffline(false);await expect(page.getByRole('status')).toHaveText('Saved',{timeout:30000});
 await pass.fill('8.124');await pass.press('Enter');await expect(pass).toBeEnabled();
 await expect(page.getByRole('status')).toHaveText('Saved',{timeout:30000});
 const db=await client();const {data:a,error}=await db.from('attempts').select('raw_input').eq('event_class_id',fixture.classId).eq('ordinal',2);if(error)throw error;
 expect(a!.some(x=>x.raw_input==='8.124')).toBe(true);
});

test('series: six-racer overall and points positions remain separate when completing',async({page})=>{
 const db=await client();const {data:e,error}=await db.from('events').select('status,working_revision').eq('id',fixture.sixEventId).single();if(error)throw error;
 if(e!.status==='completed'){const {error}=await db.rpc('set_race_event_status',{p_event_id:fixture.sixEventId,p_status:'live',p_expected_revision:e!.working_revision});if(error)throw error;}
 await signIn(page);await page.goto(series+`/events/${fixture.sixEventId}/scoring`);await prepared(page);
 for(const [i,name] of ['Jeremy','Jay','Michael','Scotty','Ronnie','Grumpy'].entries()){
  const input=page.getByRole('textbox',{name:`${name}, pass 1`,exact:true});await input.fill(String(i+1));await input.press('Enter');
 }
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Complete race',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Race completed — results saved.');
 await page.goto(`/s/${fixture.seriesId}/races/ui-six-racers`);
 const table=page.getByRole('table').filter({has:page.getByRole('columnheader',{name:'Points position',exact:true})});
 await expect(table.locator('tbody tr')).toHaveCount(3);
 await expect(table.locator('tbody tr').nth(0)).toContainText('Jay');await expect(table.locator('tbody tr').nth(0)).toContainText('100');
 await expect(table.locator('tbody tr').nth(1)).toContainText('Michael');await expect(table.locator('tbody tr').nth(2)).toContainText('Grumpy');
 await expect(page.getByTestId('result-row').first()).toContainText('Jeremy');
 await page.goto(`/r/raceholler-ui-${fixture.tag}`);
 await expect(page.getByRole('link',{name:'Season Standings',exact:true})).toHaveCount(0);
});
