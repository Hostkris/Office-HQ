// Isolated WebKit fixture: no user sessions, website logins, or external account actions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,basename} from 'node:path';
import {webkit,devices} from 'playwright';

const root=fileURLToPath(new URL('..',import.meta.url));let browser;
test.before(async()=>{browser=await webkit.launch({headless:true});});
test.after(async()=>{await browser?.close();});
async function fixture(device='iPhone 13'){
 const context=await browser.newContext({...devices[device],serviceWorkers:'block'}),page=await context.newPage(),errors=[],outbound=[];
 page.on('pageerror',e=>errors.push(e.message));
 // Only app assets are served. All other network requests are blocked in the fixture.
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.origin!=='https://office-hq.test'){outbound.push(u.origin);return route.abort();}
  const file=u.pathname==='/'?'index.html':basename(u.pathname);
  if(!/^[\w.-]+\.(html|js|css|svg|webmanifest)$/.test(file))return route.fulfill({status:404,body:'Not found'});
  const type={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',webmanifest:'application/manifest+json'}[file.split('.').pop()];
  try{return route.fulfill({status:200,contentType:type,body:await readFile(join(root,file))});}catch{return route.fulfill({status:404,body:'Not found'});}
 });
 await page.goto('https://office-hq.test/#/access',{waitUntil:'load'});
 await page.getByRole('heading',{name:'Agent website access',exact:true}).waitFor();
 return {context,page,errors,outbound};
}
async function fill(page,all=false){
 await page.locator('[name="url"]').fill('https://github.com/');
 await page.locator('[name="accountLabel"]').fill('Fixture work account');
 await page.locator('[name="prompt"]').fill('Review this fixture project and prepare a status report.');
 if(all)await page.locator('#webSelectAll').check();else{
  await page.locator('.web-agent-list details').first().locator('summary').click();
  await page.locator('[name="worker"]').first().check();
 }
 await page.getByRole('button',{name:'Review permission request →',exact:true}).click();
 await page.getByRole('dialog').waitFor();
}
test('iPhone permission card matches the reference choices, fits the viewport and Deny grants nothing',async()=>{
 const {context,page,errors}=await fixture();try{
  assert.equal(await page.locator('[name="worker"]').count(),39);await fill(page);
  const dialog=page.getByRole('dialog');assert.equal(await dialog.locator('.web-permission-domain').innerText(),'Office HQ');assert.deepEqual(await dialog.locator('.web-permission-buttons button').allTextContents(),['Deny','Allow all relevant sites','Allow for this chat']);
  const box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);assert.ok(box.width>330);
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await dialog.locator('[data-web-decision="chat"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(12, 12, 12)');
  await dialog.getByRole('button',{name:'Deny',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),0);
  await page.locator('#webAccessRequests').getByText('Denied',{exact:true}).waitFor();
  const grants=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.websiteAccess.grants);assert.equal(grants.length,0);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPad: selecting all agents queues the exact reviewed websites and waits for a real Mac receipt',async()=>{
 const {context,page,errors,outbound}=await fixture('iPad Pro 11');try{
  await page.evaluate(()=>{window.fixtureCommands=[];window.OfficeHQDeviceSync={signedIn:()=>true,snapshot:()=>({connected:false}),pushTask:t=>window.fixtureCommands.push(t)};});
  await page.locator('.web-relevant-sites summary').click();await page.locator('[name="relevantUrls"]').fill('https://docs.google.com/');await fill(page,true);
  await page.getByRole('dialog').getByText(/39 selected Office HQ agents/).waitFor();
  await page.getByRole('button',{name:'Allow all relevant sites',exact:true}).click();
  await page.locator('#webAccessRequests').getByText('Waiting for Mac confirmation',{exact:true}).waitFor();
  const data=await page.evaluate(()=>({tasks:window.fixtureCommands.map(t=>t.description),grants:window.OfficeHQBridge.getState().enterprise.websiteAccess.grants}));
  assert.equal(data.tasks.length,1);const command=JSON.parse(data.tasks[0].slice('OFFICE_HQ_WEBSITE_ACCESS_V1:'.length));
  assert.equal(command.roles.length,39);assert.equal(command.decision,'relevant');assert.deepEqual(command.relevantUrls,['https://docs.google.com/']);assert.equal(command.ownerConfirmed,true);
  assert.equal(data.grants.length,0,'a queued owner decision is not yet an active Mac permission');
  await page.evaluate(async()=>{
   const s=window.OfficeHQBridge.getState(),r=s.enterprise.websiteAccess.requests.at(-1),t=window.fixtureCommands[0],roles=r.workers.map(w=>w.roleKey),ids=roles.map((_,n)=>(n+1).toString(16).padStart(32,'0'));
   t.output=JSON.stringify({compactIds:true,kind:'decide',requestKey:r.clientRequestId,request:{id:'mac-request',status:'allowed',decision:'relevant',conversationId:r.conversationId},accounts:[{id:'mac-account1',origin:'https://github.com'},{id:'mac-account2',origin:'https://docs.google.com'}],roles,matrix:[ids,ids.map(x=>'f'+x.slice(1))],jobs:[{id:'fixture-browser-job',roleKey:'research',grantId:ids[roles.indexOf('research')].replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5'),employeeName:'Fixture researcher',status:'paused',thought:'Waiting for owner',site:'mac-account1'}]});
   t.status='done';await window.OfficeHQWebsiteAccess.refresh();
  });
  await page.locator('#webAccessRequests').getByText('Access granted',{exact:true}).waitFor();
  const active=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.websiteAccess.grants);assert.equal(active.length,78);assert.match(active[0].id,/^[a-f0-9]{8}-/);
  await page.locator('#webAccessJobs').getByRole('button',{name:'Resume',exact:true}).click();
  const resumed=await page.evaluate(()=>{const t=window.fixtureCommands.at(-1),s=window.OfficeHQBridge.getState();return {command:JSON.parse(t.description.slice('OFFICE_HQ_WEBSITE_ACCESS_V1:'.length)),role:s.employees.find(e=>e.id===t.ownerId).roleKey};});
  assert.equal(resumed.command.kind,'resume');assert.equal(resumed.role,'research','browser commands must use the matching specialist mapping');
  await page.locator('#webAccessRequests').getByRole('button',{name:'Revoke this request',exact:true}).click();
  await page.evaluate(async()=>{const old=JSON.parse(window.fixtureCommands[0].output),t=window.fixtureCommands.at(-1);t.output=JSON.stringify({...old,kind:'revoke',appliedAt:new Date(Date.now()+10).toISOString(),matrix:old.matrix.map(row=>row.map(()=>null)),jobs:[]});t.status='done';await window.OfficeHQWebsiteAccess.refresh();});
  assert.equal(await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.websiteAccess.grants.length),0);
  await page.reload();await page.getByRole('heading',{name:'Agent website access',exact:true}).waitFor();await page.evaluate(()=>window.OfficeHQWebsiteAccess.refresh());
  assert.equal(await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.websiteAccess.grants.length),0,'older grant receipts must not restore revoked permissions after reload');assert.deepEqual(outbound,[]);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('closing an undecided request preserves it and never silently grants account access',async()=>{
 const {context,page,errors}=await fixture();try{
  await fill(page);await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  await page.locator('#webAccessRequests').getByText('Waiting for your decision',{exact:true}).waitFor();
  await page.locator('#webAccessRequests').getByRole('button',{name:'Review access request',exact:true}).click();await page.getByRole('dialog').waitFor();
  assert.equal(await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.websiteAccess.grants.length),0);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
