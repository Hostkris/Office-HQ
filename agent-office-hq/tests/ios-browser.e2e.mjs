// Mobile browser integration tests: Playwright WebKit emulates iPhone/iPad.
// This does NOT prove operation on a physical iOS device or install a Safari extension.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createServer} from 'node:net';
import {webkit,devices} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let server,browser,base;
const waitForServer=async url=>{
 for(let n=0;n<100;n++){try{const r=await fetch(url);if(r.ok)return;}catch{}await sleep(80);}
 throw Error('Local Office HQ web server did not start');
};
const port=()=>new Promise(resolve=>{
 const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});
});
test.before(async()=>{
 const p=await port();
 base='http://127.0.0.1:'+p;
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(p),OPENAI_API_KEY:''},stdio:'pipe'});
 await waitForServer(base+'/');
 browser=await webkit.launch({headless:true});
});
test.after(async()=>{
 await browser?.close();
 if(server){server.kill('SIGTERM');await sleep(300);}
});
async function mobilePage(deviceName,view='workstations'){
 const context=await browser.newContext({...devices[deviceName]});
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#/'+view,{waitUntil:'domcontentloaded'});
 if(view==='workstations')await page.locator('h1').filter({hasText:'iOS browser workstations'}).waitFor({timeout:15000});
 return {page,context,errors};
}
test('iPhone Safari emulation: page loads, website deep links use Safari and staff can queue guided jobs',async()=>{
 const {page,context,errors}=await mobilePage('iPhone 13');
 try{
  assert.equal(await page.locator('#iosSite').count(),1);
  assert.equal(await page.locator('#deskSite').count(),0,'must use iOS UI rather than desktop runner on iPhone');
  await page.locator('#iosSite').selectOption('instagram');
  await page.waitForTimeout(150);
  const open=page.locator('#iosOpenSite');
  assert.equal(await open.getAttribute('href'),'https://www.instagram.com/');
  assert.equal(await open.getAttribute('target'),'_blank');
  await page.locator('#iosWorker option').first().waitFor({state:'attached'});
  const available=await page.locator('#iosWorker option').evaluateAll(nodes=>
    nodes.map(n=>({value:n.value,label:n.textContent})).filter(n=>n.value));
  assert.ok(available.length>0,'Instagram must have at least one marketing department employee');
  await page.locator('#iosWorker').selectOption(available[0].value);
  await page.locator('#iosInstructions').fill('Review the Instagram profile and summarize proposed changes. Do not publish.');
  await page.locator('[data-ios="assign"]').click();
  await page.locator('#iosJobs').getByText('Review the Instagram profile and summarize proposed changes. Do not publish.').waitFor();
  assert.ok(await page.locator('#iosJobs').getByText('queued').count()>0);
  await page.reload();
  await page.locator('h1').filter({hasText:'iOS browser workstations'}).waitFor();
  await page.locator('#iosJobs').getByText('Review the Instagram profile and summarize proposed changes. Do not publish.').waitFor();
  page.on('dialog',d=>d.accept());
  await page.locator('[data-ios="delete"]').first().click();
  assert.equal(await page.locator('#iosJobs article').count(),0,'deleted iOS guided job should leave the active list');
  assert.equal(errors.length,0,'page errors: '+errors.join('; '));
 }finally{await context.close();}
});
test('iPad Safari emulation: unauthorized page cannot grant account access without installed extension',async()=>{
 const {page,context,errors}=await mobilePage('iPad Pro 11');
 try{
  await page.locator('#iosSite').selectOption('gmail');
  const employees=await page.locator('#iosWorker option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value));
  assert.ok(employees.length>0);
  await page.locator('#iosWorker').selectOption(employees[0]);
  await page.locator('#iosConsent').check();
  await page.locator('[data-ios="authorize"]').click();
  await page.locator('#iosNotice').getByText(/Safari extension is not installed/i).waitFor({timeout:10000});
  assert.equal(await page.locator('#iosGrants .desktop-grant').count(),0,'must not fabricate access grants');
  const nav=await page.locator('#iosOpenSite').getAttribute('href');
  assert.equal(nav,'https://mail.google.com/');
  assert.equal(errors.length,0,'page errors: '+errors.join('; '));
 }finally{await context.close();}
});
test('iPhone Safari emulation: manually completed job can be passed to a chosen different employee',async()=>{
 const {page,context,errors}=await mobilePage('iPhone 13');
 page.on('dialog',d=>d.accept());
 try{
  await page.locator('#iosSite').selectOption('gmail');
  const people=await page.locator('#iosWorker option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value));
  assert.ok(people.length>1,'multiple eligible Gmail employees needed for handoff');
  await page.locator('#iosWorker').selectOption(people[0]);
  await page.locator('#iosInstructions').fill('Collect the next support question and prepare a follow-up plan.');
  await page.locator('[data-ios="assign"]').click();
  await page.locator('[data-ios="manual"]').first().click();
  await page.locator('#iosJobs').getByText('completed',{exact:true}).first().waitFor();
  const selector=page.locator('[data-ios-recipient]').first();
  const recipientOptions=await selector.locator('option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value));
  assert.ok(recipientOptions.includes(people[1]));
  await selector.selectOption(people[1]);
  await page.locator('[data-ios="handoff"]').first().click();
  assert.ok(await page.locator('#iosJobs article').count()>=2);
  assert.equal(errors.length,0,'page errors: '+errors.join('; '));
 }finally{await context.close();}
});


test('iPhone department setup, company-wide form and Agent Health remain usable without submitting real assignments',async()=>{
 const {page,context,errors}=await mobilePage('iPhone 13','connections');
 try{
  await page.getByRole('heading',{name:'Department activation',exact:true}).waitFor();
  assert.equal(await page.locator('[data-department-pick]').count(),12);
  await page.locator('[data-department-pick="Marketing"]').click();
  await page.getByRole('heading',{name:'Connect Marketing',exact:true}).waitFor();
  assert.equal(await page.locator('.department-connect').count(),4);
  await page.locator('[data-department-action="next"]').click();
  await page.getByRole('heading',{name:'Activate Marketing workers',exact:true}).waitFor();
  assert.match(await page.locator('.department-progress').innerText(),/0 of 6 workers/);
  await page.locator('#menuToggle').click();
  await page.locator('#nav details').filter({has:page.locator('[data-view="workflows"]')}).locator('summary').click();
  await page.locator('[data-view="workflows"]').click();
  await page.locator('[data-team-select="All departments"]').click();
  await page.locator('#departmentTeamInstruction').fill('Prepare a complete product launch plan with a separate draft from every authorized specialist.');
  assert.match(await page.locator('#departmentTeamForm').innerText(),/39 All departments workers/);
  assert.equal(await page.locator('[data-department-project]').count(),0,'form entry must not dispatch work');
  assert.equal(await page.locator('[data-team-decision="approve"]').count(),0,'queueing work must not create an approval or fake report');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'department controls must fit the phone');
  await page.locator('#menuToggle').click();
  await page.locator('[data-view="health"]').click();
  await page.getByRole('heading',{name:'Agent Health',exact:true}).waitFor();
  assert.equal(await page.locator('[data-agent-health="check"]').count(),1);
  assert.equal(errors.length,0,'page errors: '+errors.join('; '));
 }finally{await context.close();}
});
test('iPad Company Messages separates conversations from assignments without submitting a live message',async()=>{
 const {page,context,errors}=await mobilePage('iPad Pro 11','thread');
 try{
  await page.locator('#view [data-ceo-chat-mode]').selectOption('conversation');
  await page.locator('#view [data-ceo-chat-department]').waitFor();
  await page.locator('#view [data-ceo-chat-input]').fill('What does the research team need from me to prepare a draft?');
  assert.equal(await page.locator('#view [data-ceo-chat-action="send"]').isEnabled(),true);
  assert.equal(await page.locator('[data-ceo-job]').count(),0,'composing a question must not create an assignment');
  assert.equal(await page.locator('[data-ceo-chat-action="approve"]').count(),0);
  assert.equal(errors.length,0,'page errors: '+errors.join('; '));
 }finally{await context.close();}
});
