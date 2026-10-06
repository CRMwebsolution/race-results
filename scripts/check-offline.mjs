import {chromium} from '@playwright/test';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const config=JSON.parse(fs.readFileSync(process.env.RACEHOLLER_FIXTURE_FILE,'utf8'));
if(process.env.RACEHOLLER_BASE_URL)throw new Error('This disconnect test starts and stops a local production server. Use test:e2e for a deployed site.');
if(!config.trackSlug.startsWith('raceholler-test-')||!config.users[0].email.endsWith('@test.invalid'))throw new Error('Use an isolated acceptance fixture');
const base='http://127.0.0.1:3000';
let server;
if(!process.env.RACEHOLLER_BASE_URL){
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{stdio:['ignore','inherit','inherit'],env:{...process.env,NODE_USE_ENV_PROXY:'1'}});
 for(let i=0;i<100;i++){try{const r=await fetch(`${base}/login`);if(r.ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
}
process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK='1';
const browser=await chromium.launch({headless:true,...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1;localhost'}}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow',ignoreHTTPSErrors:Boolean(process.env.HTTPS_PROXY)});
const page=await context.newPage();
process.on('SIGINT',()=>{server?.kill();process.exit(130);});
page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
page.on('response',r=>{if(r.status()>=400)console.log('HTTP ERROR',r.status(),new URL(r.url()).hostname,new URL(r.url()).pathname);});
page.on('requestfailed',r=>console.log('REQUEST FAILED',new URL(r.url()).hostname,new URL(r.url()).pathname,r.failure()?.errorText));
page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))console.log('CONSOLE',m.text().slice(0,250));});
try{
 await page.goto(`${base}/login`);
 await page.getByLabel('Official Email').fill(config.users[0].email);
 await page.getByLabel('Password',{exact:true}).fill(config.password);
 await page.getByRole('button',{name:'Sign In',exact:true}).click();
 await page.waitForURL('**/dashboard');
 console.log('Signed in');
 await page.goto(`${base}/dashboard/tracks/${config.fixture.trackId}/events/${config.fixture.eventId}/scoring`);
 console.log('Scoring loaded');
 await page.getByRole('button',{name:'Prepare for offline',exact:true}).click();
 console.log('Prepare clicked');
 await page.getByText('Synced · offline session open',{exact:true}).waitFor({timeout:120000});
 console.log('Prepared, overflow',await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth));
 await context.setOffline(true);
 const input=page.getByRole('textbox',{name:'Fixture One, pass 1',exact:true});
 await input.fill('7.321'); await input.press('Enter');
 await page.getByText(/Saved on device · 1 waiting/).waitFor();
 console.log('Queued offline');
 server?.kill();
 await new Promise(r=>server.once('exit',r));
 await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForURL('**/offline');
 await page.getByRole('textbox',{name:'Fixture One, pass 1',exact:true}).waitFor({timeout:20000});
 const restored=await page.getByRole('textbox',{name:'Fixture One, pass 1',exact:true}).inputValue();
 if(restored!=='7.321')throw new Error(`Offline value not restored: ${restored}`);
 console.log('Reload survives');
 const second=page.getByRole('textbox',{name:'Fixture One, pass 2',exact:true});
 await second.fill('7.500');await second.press('Enter');
 await page.getByText(/Saved on device · 2 waiting/).waitFor();
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{stdio:['ignore','ignore','inherit'],env:{...process.env,NODE_USE_ENV_PROXY:'1'}});
 for(let i=0;i<100;i++){try{const r=await fetch(`${base}/login`);if(r.ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 await context.setOffline(false);
 await page.getByRole('button',{name:'Retry uploads',exact:true}).click();
 await page.getByText('Synced · offline session open',{exact:true}).waitFor({timeout:120000});
 console.log('Reconnected synced');
 await page.getByRole('button',{name:'Finish offline session',exact:true}).click();
 await page.getByText('Device session closed · cached view only',{exact:true}).waitFor();
 fs.mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/offline-mobile.png',fullPage:true});
 console.log('Closed session PASS');
}catch(e){console.log('Failure page',page.url(),(await page.locator('body').innerText()).slice(0,2200));throw e;}finally{await browser.close();server?.kill();}
