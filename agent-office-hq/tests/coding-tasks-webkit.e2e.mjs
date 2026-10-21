// Isolated UI fixtures only. No owner accounts, repository writes or real models.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join,basename} from 'node:path';
import {webkit,devices} from 'playwright';
const root=fileURLToPath(new URL('..',import.meta.url));let browser;
test.before(async()=>{browser=await webkit.launch({headless:true});});test.after(async()=>{await browser?.close();});
async function fixture({mobile=false}={}){
 const origin=mobile?'https://office-hq.test':'http://127.0.0.1:3000',context=await browser.newContext({...mobile?devices['iPhone 13']:{viewport:{width:1280,height:900}},serviceWorkers:'block'}),page=await context.newPage(),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));
 const config={provider:'ollama',model:'fixture-coder',numCtx:8192};
 const grant=companyId=>({id:'grant-one',companyId,employeeId:'mac-fixture-worker',roleKey:'backend_engineer',repository:'example/public',baseCommit:'a'.repeat(40),readPaths:['app.mjs','app.test.mjs'],editPaths:['app.mjs'],checks:[{command:'node --test app.test.mjs'}],active:true});
 await page.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());if(u.origin!==origin)return route.abort();
  if(u.pathname==='/api/coding/status')return route.fulfill({json:{ready:true,message:'Fixture model metadata checked.',config,grants:[grant(u.searchParams.get('companyId'))]}});
  if(u.pathname==='/api/openmaus/status')return route.fulfill({json:{connected:true,dispatchEnabled:true,bindings:[],runs:[]}});
  if(u.pathname.startsWith('/api/')){if(req.method()==='POST'){posts.push(JSON.parse(req.postData()));return route.fulfill({json:{submitted:true,runId:'fixture-run'}});}return route.fulfill({json:{connected:false,aiReady:false}});}
  const name=u.pathname==='/'?'index.html':basename(u.pathname);if(!/^[\w.-]+\.(html|js|css|svg|webmanifest)$/.test(name))return route.fulfill({status:404,body:'Not found'});
  const type={html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',webmanifest:'application/manifest+json'}[name.split('.').pop()];
  try{return route.fulfill({contentType:type,body:await readFile(join(root,name))});}catch{return route.fulfill({status:404,body:'Not found'});}
 });
 await page.goto(origin+'/#/coding',{waitUntil:'load'});await page.getByRole('heading',{name:'Coding tasks',exact:true}).waitFor();
 if(!mobile)await page.getByText('Coding model ready',{exact:true}).waitFor();
 else await page.evaluate(({config,grant})=>{const B=window.OfficeHQBridge,c=B.getState().companies[0].id;window.fixtureCommands=[];window.OfficeHQDeviceSync={signedIn:()=>true,refresh:async()=>{},pushTask:t=>window.fixtureCommands.push(t)};B.getState().enterprise.codingTasks={catalogs:{[c]:{at:new Date().toISOString(),ready:true,config,grants:[{...grant,companyId:c}]}},seen:{}};window.OfficeHQCodingTasks.refresh();},{config,grant:grant('fixture-company')});
 return {page,context,errors,posts};
}
async function fill(page){await page.locator('#codingGrant').selectOption('grant-one');await page.locator('#codingTaskForm [name="title"]').fill('Fix addition');await page.locator('[name="instruction"]').fill('Correct the addition function and retain the existing check.');await page.locator('[name="criteria"]').fill('Adding one and two returns three.');await page.getByRole('button',{name:'Review task permission →',exact:true}).click();await page.getByRole('dialog').waitFor();}
test('Mac task consent shows Office HQ and exact checks; Deny starts no task and preserves the draft',async()=>{
 const {page,context,errors,posts}=await fixture();try{
  await fill(page);const dialog=page.getByRole('dialog');assert.equal(await dialog.locator('.web-permission-domain').innerText(),'Office HQ');await dialog.getByText('Checks: node --test app.test.mjs',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Deny',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(posts.length,0);assert.equal(await page.locator('[name="instruction"]').inputValue(),'Correct the addition function and retain the existing check.');await page.evaluate(()=>window.OfficeHQCodingTasks.refresh());assert.equal(await page.locator('[name="title"]').inputValue(),'Fix addition');assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('Mac Allow submits exactly one scoped coding envelope and requires a real result before review',async()=>{
 const {page,context,errors,posts}=await fixture();try{
  await fill(page);await page.getByRole('button',{name:'Allow for this task',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(posts.length,1);assert.equal(posts[0].action,'send');assert.equal(posts[0].ownerConfirmed,true);const payload=JSON.parse(posts[0].description.slice('OFFICE_HQ_CODING_V1:'.length));assert.equal(payload.grantId,'grant-one');assert.equal(payload.provider,'ollama');assert.equal(Object.hasOwn(payload,'publicDataConfirmed'),false);await page.locator('#codingRuns').getByText('queued',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Inspect full diff',exact:true}).count(),0);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPhone dispatch uses local Ollama only, without a cloud key or consent prompt',async()=>{
 const {page,context,errors}=await fixture({mobile:true});try{
  assert.equal(await page.locator('[name="apiKey"],#codingOpenRouterForm,#codingCloudConsent').count(),0);
  await fill(page);const dialog=page.getByRole('dialog'),box=await dialog.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
  await dialog.getByRole('button',{name:'Allow for this task',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  const sent=await page.evaluate(()=>window.fixtureCommands.map(t=>t.description));assert.equal(sent.length,1);
  const data=JSON.parse(sent[0].slice('OFFICE_HQ_CODING_V1:'.length));assert.equal(data.provider,'ollama');
  assert.equal(Object.hasOwn(data,'publicDataConfirmed'),false);assert.doesNotMatch(sent[0],/apiKey|sk-or-/);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPhone catalog refresh is a typed owner control, and old receipts cannot restore a revoked grant',async()=>{
 const {page,context,errors}=await fixture({mobile:true});try{
  await page.getByRole('button',{name:'Refresh Mac status',exact:true}).click();
  const control=await page.evaluate(()=>window.fixtureCommands[0].description);assert.ok(control.startsWith('OFFICE_HQ_CODING_CONTROL_V1:'));assert.equal(JSON.parse(control.slice('OFFICE_HQ_CODING_CONTROL_V1:'.length)).kind,'status');
  await page.evaluate(async()=>{const B=window.OfficeHQBridge,s=B.getState(),c=s.companies[0].id,old={...s.enterprise.codingTasks.catalogs[c],codingCatalog:true,at:new Date(Date.now()-1000).toISOString()},current={...old,at:new Date(Date.now()+1000).toISOString(),grants:[]};for(const [id,data]of [['new',current],['old',old]])s.tasks.push({id,companyId:c,codingControlCommand:true,output:JSON.stringify(data)});await window.OfficeHQCodingTasks.refresh();});
  assert.equal(await page.locator('#codingGrant option').count(),1);assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
