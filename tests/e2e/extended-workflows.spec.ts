import {test,expect,Page} from '@playwright/test';
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
const file=process.env.RACEHOLLER_FIXTURE_FILE, f=file?JSON.parse(fs.readFileSync(file,'utf8')):null;
test.skip(!f,'Use an isolated acceptance fixture');
test.beforeAll(()=>{if(f&&(!f.trackSlug.startsWith('raceholler-test-')||!f.users.every((u:any)=>u.email.endsWith('@test.invalid'))))throw new Error('Refusing to run against nonfixture accounts');});
// Stateful scenarios create their own event; the larger cross-browser suite remains independent.
test.skip(({browserName})=>browserName!=='chromium','The stateful journey runs once in Chromium; common flows run in all three engines.');
async function db(index=0,password=f.password){const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});const {error}=await client.auth.signInWithPassword({email:f.users[index].email,password});if(error)throw error;return client;}
async function login(page:Page,index=0){await page.goto('/login');await page.getByLabel('Official Email').fill(f.users[index].email);await page.getByLabel('Password',{exact:true}).fill(f.password);await page.getByRole('button',{name:'Sign In',exact:true}).click();await page.waitForURL('**/dashboard');}

test('a real password change rejects current/old credentials and accepts the new password',async({page})=>{
 await login(page,6);await page.goto('/dashboard/settings');await page.getByLabel('Current password',{exact:true}).fill('intentionally-wrong');await page.getByLabel('New password',{exact:true}).fill(f.newPassword);await page.getByLabel('Confirm new password').fill(f.newPassword);await page.getByRole('button',{name:'Change password',exact:true}).click();await expect(page.getByText('Current password is incorrect',{exact:true})).toBeVisible();
 let changed=false;
 try{await page.getByLabel('Current password',{exact:true}).fill(f.password);await page.getByLabel('New password',{exact:true}).fill(f.newPassword);await page.getByLabel('Confirm new password').fill(f.newPassword);await page.getByRole('button',{name:'Change password',exact:true}).click();await expect(page.getByText('Password changed successfully',{exact:true})).toBeVisible();changed=true;
  const old=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});const result=await old.auth.signInWithPassword({email:f.users[6].email,password:f.password});expect(result.error).not.toBeNull();const fresh=await db(6,f.newPassword);expect((await fresh.auth.getUser()).data.user?.id).toBe(f.users[6].id);
 }finally{if(changed){const fresh=await db(6,f.newPassword);const {error}=await fresh.auth.updateUser({password:f.password,current_password:f.newPassword} as any);if(error)throw error;}}
});

test('two browser operators submit the same version and receive one conflict',async({page,browser})=>{
 const owner=await db();const entry='97f5d627-b253-498d-9316-ca82ca06745c';
 const other=await browser.newContext({viewport:page.viewportSize()!,baseURL:process.env.RACEHOLLER_BASE_URL||'http://127.0.0.1:3000',ignoreHTTPSErrors:process.env.RACEHOLLER_TEST_IGNORE_HTTPS_ERRORS==='1'});
 try{
  const scorer=await other.newPage();await login(page);await login(scorer,5);
  const route=`/dashboard/tracks/${f.fixture.trackId}/events/${f.fixture.eventId}/scoring`;
  await Promise.all([page.goto(route),scorer.goto(route)]);
  const inputs=[page,scorer].map(p=>p.getByRole('textbox',{name:'Fixture Two, pass 2',exact:true}));
  await Promise.all(inputs.map(input=>expect(input).toBeVisible()));
  const {data:before,error}=await owner.from('attempts').select('save_version').eq('entry_id',entry).eq('ordinal',2).maybeSingle();if(error)throw error;
  const baseline=Number(await inputs[0].inputValue())||8;const values=[(baseline+1).toFixed(3),(baseline+2).toFixed(3)];
  await inputs[0].fill(values[0]);await inputs[1].fill(values[1]);
  await Promise.all(inputs.map(input=>input.press('Enter')));
  await expect.poll(async()=>Promise.all(inputs.map(input=>input.getAttribute('aria-invalid')))).toContain('true');
  await expect.poll(async()=>[await page.getByText('Saving...',{exact:true}).count(),await scorer.getByText('Saving...',{exact:true}).count()]).toEqual([0,0]);
  const invalid=await Promise.all(inputs.map(input=>input.getAttribute('aria-invalid')));expect(invalid.filter(v=>v==='true')).toHaveLength(1);
  const loser=invalid[0]==='true'?page:scorer;await expect(loser.getByRole('alert')).toContainText(/changed|conflict/i);
  const {data:after,error:readError}=await owner.from('attempts').select('save_version,raw_input').eq('entry_id',entry).eq('ordinal',2).single();if(readError)throw readError;
  expect(after!.save_version).toBe((before?.save_version||0)+1);expect(values).toContain(after!.raw_input);
  await Promise.all([page.reload(),scorer.reload()]);
  const winnerIndex=invalid[0]==='true'?1:0;await expect(inputs[winnerIndex]).toHaveValue(after!.raw_input!);
  // The losing browser retains its unsaved draft for review, even after a reload.
  await expect(inputs[1-winnerIndex]).toHaveValue(values[1-winnerIndex]);
 }finally{await other.close();}
});

test('event CRUD, independent judging, official history and championship publication work end to end',async({page,browser})=>{
 test.setTimeout(360000);
 const owner=await db();const name=`Browser workflow ${Date.now()}`;await login(page);
 await page.goto(`/dashboard/tracks/${f.fixture.trackId}/settings`);await page.getByLabel('Short name').fill('ACPT');await page.getByRole('button',{name:'Save track details'}).click();await expect(page.getByLabel('Short name')).toHaveValue('ACPT');
 const {data:track}=await owner.from('tracks').select('default_classes').eq('id',f.fixture.trackId).single();
 if(!track?.default_classes?.length){await page.getByPlaceholder('e.g. Pro Mod').fill('Track fastest default');await page.getByRole('button',{name:'Add to Defaults'}).click();await page.getByPlaceholder('e.g. Pro Mod').fill('Track consistency default');await page.getByRole('combobox').selectOption('consistency');await page.getByRole('button',{name:'Add to Defaults'}).click();await page.getByRole('button',{name:'Save Track Settings'}).click();await expect(page.getByText('Settings saved successfully!',{exact:true})).toBeVisible();}
await page.goto(`/dashboard/tracks/${f.fixture.trackId}/events/new`);await page.getByLabel('Event Name').fill(name);await page.getByLabel('Local Date').fill('2026-10-07');await page.getByRole('button',{name:'Create Event',exact:true}).click();await page.waitForURL(/\/events\/[a-f0-9-]+$/);const eventId=page.url().split('/').at(-1)!;
 const base=`/dashboard/tracks/${f.fixture.trackId}/events/${eventId}`;
 // Track defaults were downloaded as event snapshots and can be removed independently.
 const defaults=await page.getByTestId('event-class').count();expect(defaults).toBeGreaterThan(0);
 page.on('dialog',dialog=>dialog.accept());await page.getByTestId('event-class').first().getByRole('button',{name:'Remove class'}).click();await expect(page.getByTestId('event-class')).toHaveCount(defaults-1);
 await page.goto(`${base}/settings`);await page.getByLabel('Name',{exact:true}).fill(`${name} edited`);await page.getByRole('button',{name:'Save details'}).click();await expect(page.getByLabel('Name',{exact:true})).toHaveValue(`${name} edited`);
 // Use a fresh series event for a complete three-format workflow and stable racer links.
 const {data:event,error:createError}=await owner.from('events').insert({track_id:f.fixture.trackId,series_id:f.fixture.seriesId,name:`Judged ${name}`,slug:`judged-${crypto.randomUUID()}`,local_date:'2026-10-08',status:'scheduled'}).select().single();if(createError)throw createError;
 const judgedBase=`/dashboard/tracks/${f.fixture.trackId}/events/${event.id}`;
 const {data:classes,error:classError}=await owner.from('event_classes').select('*').eq('event_id',event.id);if(classError)throw classError;expect(classes).toHaveLength(3);const judged=classes!.find(c=>c.scoring_type==='judged_points')!;
 const {data:person,error:personError}=await owner.from('series_rosters').select('series_racer_id').eq('series_id',f.fixture.seriesId).eq('series_class_id',classes!.find(c=>c.scoring_type==='fastest_pass')!.series_class_id).eq('display_name','Fixture Two').single();if(personError)throw personError;
 const {data:existingRoster}=await owner.from('series_rosters').select('id').eq('series_id',f.fixture.seriesId).eq('series_class_id',judged.series_class_id).eq('display_name','Judged racer').limit(1);
 if(!existingRoster?.length){const {error}=await owner.from('series_rosters').insert({series_id:f.fixture.seriesId,series_class_id:judged.series_class_id,display_name:'Judged racer',series_racer_id:person!.series_racer_id});if(error)throw error;}
 await page.goto(`${judgedBase}/entries`);await page.getByRole('button',{name:'Import series roster (keeps existing entries)',exact:true}).click();
 const {data:raceEntries,error:rosterError}=await owner.from('entries').select('*').in('event_class_id',classes!.map(c=>c.id));if(rosterError)throw rosterError;const entryId=raceEntries!.find(e=>e.event_class_id===judged.id)!.id;
 const saves=[];for(const entry of raceEntries!.filter(e=>e.event_class_id!==judged.id)){const cls=classes!.find(c=>c.id===entry.event_class_id)!;const passes=cls.scoring_type==='consistency'?['7.100','7.300']:[entry.display_name==='Fixture One'?'7.000':'8.000'];for(const [i,value] of passes.entries())saves.push(owner.rpc('save_race_attempt',{p_track_id:f.fixture.trackId,p_event_id:event.id,p_class_id:cls.id,p_entry_id:entry.id,p_ordinal:i+1,p_status:'valid',p_elapsed_ms:Math.round(Number(value)*1000),p_distance_mm:null,p_penalty_ms:0,p_raw_input:value,p_expected_version:0}));}
 for(const result of await Promise.all(saves))if(result.error)throw result.error;
 const {error:rulesError}=await owner.from('series_points_rules').delete().eq('series_id',f.fixture.seriesId);if(rulesError)throw rulesError;const {error:rulesInsertError}=await owner.from('series_points_rules').insert([{series_id:f.fixture.seriesId,rank_start:1,rank_end:1,points:10},{series_id:f.fixture.seriesId,rank_start:2,rank_end:2,points:6}]);if(rulesInsertError)throw rulesInsertError;

 await page.goto(`${judgedBase}/judging`);const assignment=page.locator('form').filter({has:page.getByRole('button',{name:'Assign judge',exact:true})});await assignment.getByLabel('Assign track staff').selectOption(f.users[0].id);await assignment.getByLabel('Public judge label').fill('Judge A');await assignment.getByRole('button',{name:'Assign judge',exact:true}).click();await expect(page.getByText(/1\/2 assigned judges/)).toBeVisible();await assignment.getByLabel('Assign track staff').selectOption(f.users[5].id);await assignment.getByLabel('Public judge label').fill('Judge B');await assignment.getByRole('button',{name:'Assign judge',exact:true}).click();await expect(page.getByText(/2\/2 assigned judges/)).toBeVisible();
 const mine=page.locator('form').filter({has:page.getByRole('button',{name:'Save judge score',exact:true})});await mine.getByLabel('Style (0–10)').fill('0');await mine.getByLabel('Difficulty (0–20)').fill('20');await mine.getByRole('button',{name:'Save judge score',exact:true}).click();await expect(page.getByText('Round 1: 1/2 judges',{exact:true})).toBeVisible();
 await page.goto(`${judgedBase}/settings`);await page.locator('select[name="status"]').selectOption('completed');await page.getByRole('button',{name:'Update Status'}).click();await expect(page.getByRole('alert')).toContainText('All required judge submissions');
 const scorerContext=await browser.newContext({viewport:page.viewportSize()!,baseURL:process.env.RACEHOLLER_BASE_URL||"http://127.0.0.1:3000",ignoreHTTPSErrors:process.env.RACEHOLLER_TEST_IGNORE_HTTPS_ERRORS==="1"});const scorerPage=await scorerContext.newPage();try{await login(scorerPage,5);await scorerPage.goto(`${judgedBase}/judging`);const score=scorerPage.locator('form').filter({has:scorerPage.getByRole('button',{name:'Save judge score',exact:true})});await score.getByLabel('Style (0–10)').fill('10');await score.getByLabel('Difficulty (0–20)').fill('20');await score.getByRole('button',{name:'Save judge score',exact:true}).click();await expect(scorerPage.getByText('25 pts',{exact:true})).toBeVisible();}finally{await scorerContext.close();}
 await page.goto(`${judgedBase}/settings`);await page.locator('select[name="status"]').selectOption('completed');await page.getByRole('button',{name:'Update Status'}).click();await expect(page.locator('select[name="status"]')).toHaveValue('completed');
 const {data:v1,error:snapshotError}=await owner.from('event_result_versions').select('*').eq('event_id',event.id).eq('version',1).single();if(snapshotError)throw snapshotError;expect((v1.payload as any).entries).toHaveLength(4);expect((v1.payload as any).results.find((r:any)=>r.id===entryId).score.label).toBe('25 pts');
 await page.goto(`/r/${f.trackSlug}/${event.slug}`);await page.getByRole('button',{name:'Judged fixture',exact:true}).click();await expect(page.getByTestId('result-row').filter({hasText:'Judged racer'})).toContainText('25 pts');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download results CSV'}).click();const csv=fs.readFileSync((await (await download).path())!,'utf8');expect(csv).toContain('25 pts');expect(csv).toContain('Official version 1');
 await page.goto(`${judgedBase}/settings`);await page.locator('select[name="status"]').selectOption('live');await page.getByRole('button',{name:'Update Status'}).click();const {data:assignments}=await owner.from('judge_assignments').select('*').eq('event_class_id',judged.id).eq('user_id',f.users[0].id);const {error:correctionError}=await owner.rpc('save_judge_score',{p_assignment_id:assignments![0].id,p_entry_id:entryId,p_ordinal:1,p_values:{style:10,difficulty:20},p_expected_version:1});if(correctionError)throw correctionError;
 await page.reload();await page.locator('select[name="status"]').selectOption('completed');await page.getByRole('button',{name:'Update Status'}).click();const {data:history}=await owner.from('event_result_versions').select('*').eq('event_id',event.id).order('version');expect(history).toHaveLength(2);expect(history![0].payload).toEqual(v1.payload);expect((history![1].payload as any).results.find((r:any)=>r.id===entryId).score.label).toBe('30 pts');
 await page.goto(`/dashboard/series/${f.fixture.seriesId}/standings`);
 const award=page.locator('form').filter({has:page.getByRole('button',{name:'Record audited award'})});await award.getByLabel('Race',{exact:true}).selectOption(event.id);await award.getByLabel('Class',{exact:true}).selectOption(classes!.find(c=>c.scoring_type==='fastest_pass')!.series_class_id);await award.getByLabel('Racer',{exact:true}).selectOption(person!.series_racer_id);await award.getByLabel('Points (negative for correction)').fill('3');await award.getByLabel('Reason',{exact:true}).fill('Acceptance showmanship award');await award.getByRole('button',{name:'Record audited award'}).click();await expect(page.getByRole('status')).toContainText('Award recorded');
 await page.getByRole('button',{name:'Rebuild & publish standings'}).click();await expect(page.getByText('Championship standings published',{exact:true})).toBeVisible();const {data:versions}=await owner.from('series_result_versions').select('*').eq('series_id',f.fixture.seriesId).eq('is_current',true);expect(versions).toHaveLength(1);expect(versions![0].source_version_ids).toContain(history![1].id);
 const totals=(versions![0].payload as any).standings;const fastestOrigin=classes!.find(c=>c.scoring_type==='fastest_pass')!.series_class_id;expect(totals.find((r:any)=>r.racerId===person!.series_racer_id&&r.classId===fastestOrigin)?.total).toBe(9);expect(totals.filter((r:any)=>r.name==='Fixture One').reduce((sum:number,r:any)=>sum+r.total,0)).toBe(25);expect(totals.find((r:any)=>r.racerId===person!.series_racer_id&&r.classId===judged.series_class_id)?.total).toBe(10);
 await page.getByRole('button',{name:'Rebuild & publish standings'}).click();const {data:again}=await owner.from('series_result_versions').select('payload').eq('series_id',f.fixture.seriesId).eq('is_current',true).single();expect((again!.payload as any).standings).toEqual(totals);await page.goto(`/s/${f.fixture.seriesId}`);await expect(page.getByText('Fixture One',{exact:true}).first()).toBeVisible();
 // An empty event is deleted; the completed event is withdrawn and history retained.
 await page.goto(`${base}/settings`);await page.getByLabel('I confirm this event should be removed').check();await page.getByRole('button',{name:'Delete / withdraw event'}).click();await page.waitForURL(`**/dashboard/tracks/${f.fixture.trackId}`);expect((await owner.from('events').select('id').eq('id',eventId)).data).toHaveLength(0);
 await page.goto(`${judgedBase}/settings`);await page.getByLabel('I confirm this event should be removed').check();await page.getByRole('button',{name:'Delete / withdraw event'}).click();expect((await owner.from('events').select('status').eq('id',event.id).single()).data?.status).toBe('cancelled');expect((await owner.from('event_result_versions').select('id').eq('event_id',event.id)).data).toHaveLength(2);
});
