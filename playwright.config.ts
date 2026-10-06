import {defineConfig,devices} from '@playwright/test';
try{process.loadEnvFile('.env.local');}catch{/* CI may supply environment variables instead. */}
process.env.PLAYWRIGHT_DISABLE_FORCED_CHROMIUM_PROXIED_LOOPBACK='1';
export default defineConfig({
 outputDir:process.env.RACEHOLLER_TEST_OUTPUT_DIR||'test-results',
 testDir:'tests/e2e',workers:1,retries:0,timeout:180000,
 expect:{timeout:30000},reporter:[['list'],['json',{outputFile:`${process.env.RACEHOLLER_TEST_OUTPUT_DIR||'test-results'}/acceptance.json`}]],
 use:{baseURL:process.env.RACEHOLLER_BASE_URL||'http://127.0.0.1:3000',
  ignoreHTTPSErrors:process.env.RACEHOLLER_TEST_IGNORE_HTTPS_ERRORS==='1',
  launchOptions:process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}}:{},
  trace:'off',screenshot:'only-on-failure',
 },
 projects:[
  {name:'chromium-mobile',use:{...devices['Pixel 7'],browserName:'chromium'}},
  {name:'firefox-desktop',use:{browserName:'firefox',viewport:{width:1440,height:900}}},
  {name:'webkit-mobile',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true}},
 ],
 webServer:process.env.RACEHOLLER_BASE_URL?undefined:{command:'npm start -- --hostname 127.0.0.1 --port 3000',url:'http://127.0.0.1:3000/login',timeout:30000,reuseExistingServer:false},
});
