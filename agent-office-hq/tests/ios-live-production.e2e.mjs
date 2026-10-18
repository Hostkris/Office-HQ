// Tests the REAL GitHub Pages Office HQ URL through WebKit iPhone/iPad emulation.
// NOT a test of Apple's signed Safari extension on an actual iPhone, and no
// external websites or personal user accounts are accessed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {webkit, devices} from 'playwright';

const site=process.env.OFFICE_HQ_SITE||'https://hostkris.github.io/Office-HQ/agent-office-hq/';
let browser;
test.before(async()=>{browser=await webkit.launch({headless:true});});
test.after(async()=>{await browser?.close();});
async function openOn(deviceName){
 const context=await browser.newContext({...devices[deviceName],serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[],failedResources=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',resp=>{
  if(resp.status()>=400&&new URL(resp.url()).origin===new URL(site).origin)
   failedResources.push(resp.status()+' '+resp.url());
 });
 const target=new URL('./#/workstations',site);
 const response=await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:40000});
 assert.equal(response.status(),200,'Public Office HQ must serve HTTP 200');
 await page.locator('h1').filter({hasText:'iOS browser workstations'}).waitFor({timeout:18000});
 return {context,page,errors,failedResources};
}
test('Production iPhone WebKit: no missing scripts, assign a task, reload and persist it',async()=>{
 const {context,page,errors,failedResources}=await openOn('iPhone 13');
 try{
  assert.equal(await page.locator('#iosSite').count(),1);
  assert.equal(await page.locator('#deskSite').count(),0);
  const sites=await page.locator('#iosSite option').allTextContents();
  assert.ok(sites.some(s=>s.includes('TikTok')));
  assert.ok(sites.some(s=>s.includes('Instagram')));
  assert.ok(sites.some(s=>s.includes('Gmail')));
  await page.locator('#iosSite').selectOption('tiktok');
  assert.equal(await page.locator('#iosOpenSite').getAttribute('href'),'https://www.tiktok.com/');
  const staff=await page.locator('#iosWorker option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value));
  assert.ok(staff.length>0);
  await page.locator('#iosWorker').selectOption(staff[0]);
  const unique='Production iOS test assignment only - do not post or send';
  await page.locator('#iosInstructions').fill(unique);
  await page.locator('[data-ios="assign"]').click();
  await page.locator('#iosJobs').getByText(unique).waitFor({timeout:7000});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#iosJobs').getByText(unique).waitFor({timeout:12000});
  assert.deepEqual(errors,[]);
  assert.deepEqual(failedResources,[]);
 }finally{await context.close();}
});
test('Production iPad WebKit: simulated account authorization correctly fails without extension',async()=>{
 const {context,page,errors,failedResources}=await openOn('iPad Pro 11');
 try{
  await page.locator('#iosSite').selectOption('gmail');
  assert.equal(await page.locator('#iosOpenSite').getAttribute('href'),'https://mail.google.com/');
  const staff=await page.locator('#iosWorker option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value));
  assert.ok(staff.length>0);
  await page.locator('#iosWorker').selectOption(staff[0]);
  await page.locator('#iosConsent').check();
  await page.locator('[data-ios="authorize"]').click();
  await page.locator('#iosNotice').getByText(/Safari extension is not installed/i).waitFor({timeout:10000});
  assert.equal(await page.locator('#iosGrants .desktop-grant').count(),0);
  assert.deepEqual(errors,[]);
  assert.deepEqual(failedResources,[]);
 }finally{await context.close();}
});
