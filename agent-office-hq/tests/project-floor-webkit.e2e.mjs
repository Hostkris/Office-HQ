// Interactive test of iPhone/iPad Live RPG project floor with WebKit.
// No external account or cloud browser is involved.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createServer} from 'node:net';
import {webkit,devices} from 'playwright';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let server,browser,url;
async function port(){
 return new Promise(resolve=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
}
test.before(async()=>{
 url='http://127.0.0.1:'+(await port());
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:new URL(url).port,OPENAI_API_KEY:''},stdio:'ignore'});
 let ready=false;
 for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await sleep(80);}
 assert.equal(ready,true,'Office HQ local test server did not start');
 browser=await webkit.launch({headless:true});
});
test.after(async()=>{await browser?.close();if(server){server.kill('SIGTERM');await sleep(300);}});
async function open(device){
 const context=await browser.newContext({...devices[device]});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url+'/#/office',{waitUntil:'domcontentloaded'});
 await page.locator('h1').filter({hasText:'Live project office'}).waitFor({timeout:14000});
 return {context,page,errors};
}
test('iPhone: Live RPG floor starts with 10 unoccupied workstations, no visible employees or janitor',async()=>{
 const {context,page,errors}=await open('iPhone 13');
 try{
  assert.equal(await page.locator('#officeCanvas').count(),1);
  assert.match(await page.locator('.pf-worker-list').innerText(),/All desks are empty/);
  assert.equal(await page.locator('#pfJanitor').isChecked(),false);
  const stats=await page.evaluate(()=>{
   const p=window.OfficeHQProjectFloor, d=p.ensure(window.OfficeHQBridge.getState().companies[0].id);
   const floor=d.projects[0].levels[0];
   return {workerSlots:floor.workers.length,occupied:floor.workers.filter(Boolean).length,janitor:floor.janitor};
  });
  assert.deepEqual(stats,{workerSlots:10,occupied:0,janitor:false});
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPad: team choice, exact desk placement, project isolation and per-floor janitor',async()=>{
 const {context,page,errors}=await open('iPad Pro 11');
 try{
  await page.locator('#pfNewName').fill('My focused client launch');
  await page.locator('[data-pf="new-project"]').click();
  assert.equal(await page.locator('#pfProject').inputValue(),await page.evaluate(()=>{
   const cid=window.OfficeHQBridge.getState().companies[0].id;
   return window.OfficeHQProjectFloor.ensure(cid).activeProjectId;
  }));
  const people=await page.locator('#pfEmployee option').evaluateAll(nodes=>nodes.filter(o=>o.value).slice(0,2).map(o=>o.value));
  assert.equal(people.length,2);
  await page.locator('#pfEmployee').selectOption(people[0]);
  await page.locator('#pfDesk').selectOption('4');
  await page.locator('[data-pf="place"]').click();
  const data=await page.evaluate(()=>{
   const cid=window.OfficeHQBridge.getState().companies[0].id;
   const x=window.OfficeHQProjectFloor.ensure(cid);
   return {active:x.projects.find(p=>p.id===x.activeProjectId).levels[0].workers,
    general:x.projects[0].levels[0].workers};
  });
  assert.equal(data.active[4],people[0]);
  assert.equal(data.active.filter(Boolean).length,1);
  assert.equal(data.general.filter(Boolean).length,0);
  await page.locator('#pfJanitor').check();
  await page.locator('[data-pf="add-level"]').click();
  assert.equal(await page.locator('#pfJanitor').isChecked(),false);
  assert.match(await page.locator('.pf-floor-panel').innerText(),/Level 2 of 2/);
  await page.locator('#pfEmployee').selectOption(people[1]);
  await page.locator('#pfDesk').selectOption('0');
  await page.locator('[data-pf="place"]').click();
  await page.locator('[data-pf="prev"]').click();
  assert.equal(await page.locator('#pfJanitor').isChecked(),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPhone: existing company task assignment auto-places only its owner and never crowds the rest of the workforce',async()=>{
 const {context,page,errors}=await open('iPhone 13');
 try{
  await page.evaluate(()=>{
   const B=window.OfficeHQBridge,s=B.getState(),person=s.employees.find(e=>e.active);
   s.tasks.push({id:'new-browser-assignment',companyId:person.companyId,ownerId:person.id,title:'Task assigned outside office',
    scope:B.roleFor(person).scope,status:'queued',createdAt:new Date().toISOString()});B.save();
  });
  await page.waitForFunction(()=>{
   const B=window.OfficeHQBridge,p=window.OfficeHQProjectFloor,d=p.ensure(B.getState().companies[0].id);
   return d.projects[0].levels[0].workers.filter(Boolean).length===1;
  },{timeout:7000});
  const occupied=await page.evaluate(()=>{
   const B=window.OfficeHQBridge,d=window.OfficeHQProjectFloor.ensure(B.getState().companies[0].id);
   return d.projects[0].levels[0].workers.filter(Boolean).length;
  });
  assert.equal(occupied,1);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPad: a completed task handoff creates a specialty-scoped dependent task and not an external action',async()=>{
 const {context,page,errors}=await open('iPad Pro 11');
 try{
  const workers=await page.locator('#pfEmployee option').evaluateAll(options=>options.filter(o=>o.value).slice(0,2).map(o=>o.value));
  for(let desk=0;desk<2;desk++){
   await page.locator('#pfEmployee').selectOption(workers[desk]);
   await page.locator('#pfDesk').selectOption(String(desk));
   await page.locator('[data-pf="place"]').click();
  }
  await page.evaluate(()=>{
   const B=window.OfficeHQBridge,d=B.getState(),p=window.OfficeHQProjectFloor.ensure(d.companies[0].id).projects[0];
   const t=window.OfficeHQProjectFloor.taskFrom(d.employees.find(e=>e.id===p.levels[0].workers[0]),
     'Finish analysis','Source report',p.id);
   t.status='done';B.save();B.setView('office');
  });
  const done=await page.locator('#pfSourceTask option').evaluateAll(nodes=>nodes.filter(o=>o.value).map(o=>o.value));
  assert.ok(done.length>=1);
  await page.locator('#pfSourceTask').selectOption(done[0]);
  await page.locator('#pfHandoffWorker').selectOption(workers[1]);
  await page.locator('#pfHandoffTitle').fill('Review finished analysis');
  await page.locator('[data-pf="handoff"]').click();
  const created=await page.evaluate(()=>{
   const B=window.OfficeHQBridge,s=B.getState(),t=s.tasks.find(x=>x.title==='Review finished analysis');
   return t&&{ownerId:t.ownerId,dependsOn:t.dependsOn,status:t.status,scope:t.scope,
     expected:B.roleFor(s.employees.find(e=>e.id===t.ownerId)).scope};
  });
  assert.equal(created.ownerId,workers[1]);
  assert.ok(created.dependsOn);
  assert.equal(created.status,'queued');
  assert.equal(created.scope,created.expected);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
