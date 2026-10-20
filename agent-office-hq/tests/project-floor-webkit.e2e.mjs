// Real mobile WebKit UI integration test for the updated Live RPG office.
// Workers are visual representatives, not real third-party website automation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {webkit,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let browser,server,base;
async function port(){return await new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});}
test.before(async()=>{
 base='http://127.0.0.1:'+await port();
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:base.split(':').at(-1),HOST:'127.0.0.1',OPENAI_API_KEY:''},stdio:'pipe'});
 let live=false;for(let n=0;n<65;n++){try{if((await fetch(base)).ok){live=true;break;}}catch{}await sleep(100);}
 assert.ok(live);
 browser=await webkit.launch({headless:true});
});
test.after(async()=>{await browser?.close();server?.kill('SIGTERM');await sleep(100);});
async function pageFor(device='iPhone 13'){
 const context=await browser.newContext({...devices[device]});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#/office',{waitUntil:'domcontentloaded'});
 await page.locator('[data-pf="manage-office"]').waitFor({timeout:15000});
 await page.locator('[data-pf="manage-office"]').click();
 await page.locator('h1').filter({hasText:'Project Floor'}).waitFor({timeout:15000});
 return {page,context,errors};
}
test('iPhone: fifteen live RPG employees begin visible; add another and toggle janitor',async()=>{
 const {page,context,errors}=await pageFor();
 try{
  assert.match(await page.locator('.pf-status').innerText(),/15 \/ 30/);
  assert.equal(await page.locator('.pf-person').count(),15);
  const initialized=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.projectFloor);
  assert.equal(initialized.floors.find(f=>f.id===initialized.selected[Object.keys(initialized.selected)[0]].floorId).placements.length,15);
  assert.equal(initialized.floors.find(f=>f.id===initialized.selected[Object.keys(initialized.selected)[0]].floorId).janitor,false);
  await page.locator('#pfJanitor').check();
  assert.equal(await page.locator('#pfJanitor').isChecked(),true);
  await page.locator('#pfEmployee').selectOption({index:1});
  await page.locator('#pfSeat').selectOption('15');
  await page.locator('#pfPlaceForm [type=submit]').click();
  await page.locator('.pf-status').getByText('16 / 30').waitFor({timeout:7000});
  assert.equal(await page.locator('.pf-person').count()>0,true);
  const live=await page.evaluate(()=>{const d=window.OfficeHQBridge.getState().enterprise.projectFloor;return d.floors.find(f=>f.id===d.selected[Object.keys(d.selected)[0]].floorId);});
  assert.equal(live.placements.length,16);
  assert.equal(live.janitor,true);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPad: project groups and 30 worker cap, with independent empty second floor',async()=>{
 const {page,context,errors}=await pageFor('iPad Pro 11');
 page.on('dialog',async dialog=>{if(dialog.type()==='prompt')await dialog.accept('TikTok campaign');else await dialog.accept();});
 try{
  await page.locator('[data-pf="new-project"]').click();
  await page.locator('#pfProject option').filter({hasText:'TikTok campaign'}).waitFor({state:'attached'});
  assert.equal(await page.locator('#pfProject').inputValue(),await page.locator('#pfPlacementProject').inputValue());
  // Make the first floor maximally populated through explicit desk assignments.
  for(let i=15;i<30;i++){
   const worker=await page.locator('#pfEmployee option').evaluateAll(nodes=>nodes.find(x=>x.value)?.value);
   assert.ok(worker,'expected an available worker');
   await page.locator('#pfEmployee').selectOption(worker);
   await page.locator('#pfSeat').selectOption(String(i));
   await page.locator('#pfPlaceForm [type=submit]').click();
   await page.locator('.pf-status').getByText(String(i+1)+' / 30').waitFor({timeout:6000});
  }
  assert.equal(await page.locator('#pfPlaceForm [type=submit]').isDisabled(),true);
  const floor1=await page.evaluate(()=>{const d=window.OfficeHQBridge.getState().enterprise.projectFloor;return d.floors.find(f=>f.id===d.selected[Object.keys(d.selected)[0]].floorId);});
  assert.equal(floor1.placements.length,30);
  assert.equal(new Set(floor1.placements.map(p=>p.employeeId)).size,30);
  await page.locator('[data-pf="new-floor"]').click();
  await page.locator('.pf-status').getByText('0 / 30').waitFor({timeout:7000});
  assert.equal(await page.locator('#pfProject').inputValue(),'all');
  const floors=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.projectFloor.floors);
  assert.equal(floors.length,14);assert.equal(floors.find(f=>f.id===floor1.id).placements.length,30);assert.equal(floors.at(-1).placements.length,0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('iPhone: tap an X to delete an assignment without orphaning workflow or approvals',async()=>{
 const {page,context,errors}=await pageFor();
 page.on('dialog',d=>d.accept());
 try{
  const ids=await page.evaluate(()=>{
   const B=window.OfficeHQBridge,s=B.getState(),cid=s.companies[0].id;
   const task={id:'remove-me',companyId:cid,title:'Old assignment for cleanup',description:'Old work',ownerId:s.employees[0].id,scope:B.roleFor(s.employees[0]).scope,status:'queued',priority:'Low',createdAt:new Date().toISOString()};
   s.tasks.unshift(task);
   s.tasks.push({id:'dependent',companyId:cid,title:'Next workflow task',description:'Follow-up',dependsOn:'remove-me',ownerId:s.employees[1].id,status:'queued',priority:'Low'});
   s.approvals.push({id:'delete-approval',companyId:cid,title:'Approval for old assignment',taskId:'remove-me',status:'pending',kind:'task'});
   B.save();B.setView('tasks');
   return {cid};
  });
  await page.locator('[data-action="deleteTask"][data-id="remove-me"]').click();
  const result=await page.evaluate(()=>{
   const s=window.OfficeHQBridge.getState();
   return {exists:s.tasks.some(t=>t.id==='remove-me'),dependent:s.tasks.find(t=>t.id==='dependent'),approval:s.approvals.find(a=>a.id==='delete-approval')};
  });
  assert.equal(result.exists,false);
  assert.equal(result.dependent.status,'blocked');
  assert.equal(result.dependent.dependsOn,null);
  assert.equal(result.approval.status,'rejected');
  assert.equal(await page.locator('[data-action="deleteTask"][data-id="remove-me"]').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPad: remove single phone and full-thread messages, approve and reject in CEO thread',async()=>{
 const {page,context,errors}=await pageFor('iPad Pro 11');
 page.on('dialog',d=>d.accept());
 try{
  await page.evaluate(()=>{
   const B=window.OfficeHQBridge,s=B.getState(),cid=s.companies[0].id;
   s.enterprise??={};s.enterprise.messages??=[];
   s.enterprise.messages.push(
    {id:'clear-phone',companyId:cid,author:'Employee A',body:'Old text to remove from phone',kind:'update',createdAt:new Date().toISOString()},
    {id:'clear-thread',companyId:cid,author:'Employee B',body:'Old text to remove from full thread',kind:'update',createdAt:new Date().toISOString()}
   );
   s.approvals.push(
    {id:'approve-inbox',companyId:cid,kind:'campaign',title:'Approval for team request',note:'Internal budget draft',status:'pending',amount:10,employeeId:s.employees[0].id,createdAt:new Date().toISOString()},
    {id:'deny-inbox',companyId:cid,kind:'campaign',title:'Request to reject',note:'Not needed',status:'pending',amount:8,employeeId:s.employees[1].id,createdAt:new Date().toISOString()}
   );
   B.save();B.setView('thread');
  });
  await page.locator('#officePhoneBtn').click();
  await page.locator('#opsDrawerContent [data-ops="delete-message"][data-id="clear-phone"]').click();
  assert.equal(await page.locator('#opsDrawerContent [data-message-id="clear-phone"]').count(),0);
  await page.locator('#opsDrawerContent [data-ops="approve-request"][data-id="approve-inbox"]').click();
  await page.locator('#opsDrawerContent [data-approval="approve-inbox"]').count().then(n=>assert.equal(n,0));
  await page.locator('#opsDrawerContent [data-ops="dismiss-request"][data-id="deny-inbox"]').click();
  const decisions=await page.evaluate(()=>{
   const s=window.OfficeHQBridge.getState();
   return [s.approvals.find(a=>a.id==='approve-inbox')?.status,s.approvals.find(a=>a.id==='deny-inbox')?.status];
  });
  assert.deepEqual(decisions,['approved','rejected']);
  await page.locator('#officePhoneClose').click();
  await page.locator('#view [data-ops="delete-message"][data-id="clear-thread"]').click();
  assert.equal(await page.locator('[data-message-id="clear-thread"]').count(),0);
  // Individual cleanup does not delete unrelated company data or approval outcomes.
  const still=await page.evaluate(()=>{
   const s=window.OfficeHQBridge.getState();return {tasks:s.tasks.length,approvals:s.approvals.length};
  });
  assert.ok(still.tasks>0);assert.ok(still.approvals>=2);
  await page.locator('#view [data-ops="clear-messages"]').click();
  assert.equal((await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.messages.length)),0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('iPad: all 12 department offices exist, a head forwards a packet and CEO approves it in company text',async()=>{
 const {page,context,errors}=await pageFor('iPad Pro 11');
 try{
  assert.equal(await page.locator('.pf-dept-tile').count(),12);
  const departments=await page.evaluate(()=>{
   const s=window.OfficeHQBridge.getState(),cid=s.companies[0].id;
   return s.enterprise.projectFloor.floors.filter(f=>f.companyId===cid&&f.department).map(f=>f.department);
  });
  assert.equal(new Set(departments).size,12);
  await page.locator('.pf-route-builder summary').click();
  await page.locator('#pfRouteTitle').fill('Marketing campaign clearance');
  await page.locator('input[name="department"]').evaluateAll(nodes=>{
   nodes.forEach(n=>{n.checked=n.value==='Marketing';});
  });
  await page.locator('#pfDepartmentRouteForm button[type="submit"]').click();
  await page.locator('[data-dept-action="forward"]').first().waitFor();
  const before=await page.evaluate(()=>{
   const routes=window.OfficeHQBridge.getState().enterprise.projectFloor.departmentRoutes;return routes[0];
  });
  assert.equal(before.cursor,0);
  assert.equal(before.departments.join(','),'Marketing,Leadership');
  await page.locator('[data-dept-action="forward"]').first().click();
  const approval=await page.evaluate(()=>{
   const s=window.OfficeHQBridge.getState(),route=s.enterprise.projectFloor.departmentRoutes[0];
   return {routeStatus:route.status,id:route.approvalId,approval:s.approvals.find(a=>a.id===route.approvalId)};
  });
  assert.equal(approval.routeStatus,'awaiting_ceo');
  assert.equal(approval.approval.kind,'department_route');
  assert.equal(approval.approval.status,'pending');
  await page.evaluate(()=>window.OfficeHQBridge.setView('thread'));
  await page.locator('[data-ops="approve-request"][data-id="'+approval.id+'"]').click();
  const final=await page.evaluate(()=>{
   const s=window.OfficeHQBridge.getState(),route=s.enterprise.projectFloor.departmentRoutes[0];
   return {status:route.status,approval:s.approvals.find(a=>a.id===route.approvalId)?.status};
  });
  assert.equal(final.status,'completed');
  assert.equal(final.approval,'approved');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('iPhone Command Center shares same 15 employees and supports safe remove, add and reload',async()=>{
 const {page,context,errors}=await pageFor();
 page.on('dialog',dialog=>dialog.accept());
 try{
  const first=await page.evaluate(()=>{
   const B=window.OfficeHQBridge,s=B.getState(),cid=s.companies[0].id;
   B.setView('command');
   const d=s.enterprise.projectFloor,f=d.floors.find(f=>f.id===d.selected[cid].floorId);
    return {cid,ids:f.placements.map(p=>p.employeeId),floorId:f.id};
  });
  assert.equal(first.ids.length,15);
  assert.equal(await page.locator('#officeCanvas').getAttribute('width'),'1240');
  assert.equal(await page.locator('#officeCanvas').getAttribute('height'),'1135');
  const before=await page.locator('#pfCommandRemove option').count();
  assert.equal(before,16);
  await page.locator('#pfCommandRemove').selectOption({index:1});
  await page.locator('[data-pf="command-remove"]').click();
  const removed=await page.evaluate(()=>{const s=window.OfficeHQBridge.getState(),d=s.enterprise.projectFloor,cid=s.companies[0].id;return d.floors.find(f=>f.id===d.selected[cid].floorId).placements.length;});
  assert.equal(removed,14);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('#pfCommandWorker').waitFor();
  assert.equal(await page.locator('#pfCommandRemove option').count(),15,'worker must not auto-respawn after reload');
  await page.locator('#pfCommandWorker').selectOption({index:1});
  await page.locator('[data-pf="command-add"]').click();
  assert.equal(await page.locator('#pfCommandRemove option').count(),16);
  await page.evaluate(()=>window.OfficeHQBridge.setView('office'));
  await page.locator('[data-pf="manage-office"]').click();
  assert.match(await page.locator('.pf-status').innerText(),/15 \/ 30/);
  assert.equal(await page.locator('#officeCanvas').getAttribute('width'),'1240');
  const state=await page.evaluate(()=>{
   const s=window.OfficeHQBridge.getState(),cid=s.companies[0].id;
   const d=s.enterprise.projectFloor,placements=d.floors.find(f=>f.id===d.selected[cid].floorId).placements;
    return {count:placements.length,unique:new Set(placements.map(p=>p.employeeId)).size,roster:s.employees.filter(e=>e.companyId===cid).length};
  });
  assert.equal(state.count,15);assert.equal(state.unique,15);assert.ok(state.roster>=15);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});


test('iPhone: tap empty Assignments on a specific employee, save a job, and reopen the same profile after reload',async()=>{
 const {page,context,errors}=await pageFor('iPhone 13');
 try{
  const subject=await page.evaluate(()=>{
   const B=window.OfficeHQBridge,s=B.getState(),cid=s.companies[0].id;
   const e=s.employees.find(e=>e.active&&e.companyId===cid&&!s.tasks.some(t=>t.ownerId===e.id));
   if(!e)throw Error('Need an unassigned active specialist to test the empty profile');
   B.workerModal(e.id);
   return {id:e.id,name:e.name,companyId:e.companyId,scope:B.roleFor(e).scope,roles:B.getRoles().length};
  });
  assert.equal(subject.roles,40,'Every essential specialist must support direct profile assignments');
  await page.locator('#modalRoot .pf-assignment-empty').waitFor();
  assert.match(await page.locator('#modalRoot .pf-assignment-empty').innerText(),/No tasks assigned yet/i);
  await page.locator('#modalRoot .pf-assignment-empty').click();
  await page.locator('#taskForm').waitFor();
  assert.equal(await page.locator('input[name="employeeId"]').inputValue(),subject.id);
  assert.equal(await page.locator('#taskCompany').inputValue(),subject.companyId);
  assert.equal(await page.locator('#taskScope').inputValue(),subject.scope);
  assert.equal(await page.locator('#taskScope option').count(),1);
  const title='Profile-only mobile task '+Date.now();
  await page.locator('#taskTitle').fill(title);
  await page.locator('#taskForm textarea[name="description"]').fill('Prepare the requested internal report for CEO review, without external actions.');
  await page.locator('#taskForm select[name="priority"]').selectOption('High');
  await page.locator('#taskForm button[type="submit"]').click();
  await page.locator('#modalRoot [data-action="inspectTask"]').filter({hasText:title}).waitFor({timeout:10000});
  const result=await page.evaluate((name)=>{
   const s=window.OfficeHQBridge.getState(),matches=s.tasks.filter(t=>t.title===name);
   return {matches:matches.map(t=>({ownerId:t.ownerId,companyId:t.companyId,scope:t.scope,status:t.status})),count:s.tasks.length};
  },title);
  assert.equal(result.matches.length,1);
  assert.equal(result.matches[0].ownerId,subject.id);
  assert.equal(result.matches[0].companyId,subject.companyId);
  assert.equal(result.matches[0].scope,subject.scope);
  assert.equal(result.matches[0].status,'queued');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.evaluate(id=>window.OfficeHQBridge.workerModal(id),subject.id);
  await page.locator('#modalRoot [data-action="inspectTask"]').filter({hasText:title}).waitFor();
  assert.equal(await page.locator('#modalRoot [data-action="assignEmployee"]').first().getAttribute('data-id'),subject.id);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('iPad: Add assignment always stays assigned to the chosen bot even if form ID is altered',async()=>{
 const {page,context,errors}=await pageFor('iPad Pro 11');
 try{
  const people=await page.evaluate(()=>{
   const B=window.OfficeHQBridge,s=B.getState(),cid=s.companies[0].id;
   const available=s.employees.filter(e=>e.active&&e.companyId===cid);
   B.workerModal(available[7].id);
   return {chosen:available[7].id,other:available[8].id};
  });
  await page.locator('#modalRoot [data-action="assignEmployee"]').first().click();
  await page.locator('#taskForm').waitFor();
  assert.equal(await page.locator('input[name="employeeId"]').inputValue(),people.chosen);
  await page.locator('#taskTitle').fill('Scope guard test');
  await page.locator('#taskForm textarea[name="description"]').fill('Test authorized role ownership checks.');
  await page.locator('input[name="employeeId"]').evaluate((input,id)=>input.value=id,people.other);
  const before=await page.evaluate(()=>window.OfficeHQBridge.getState().tasks.length);
  await page.locator('#taskForm button[type="submit"]').click();
  assert.equal(await page.evaluate(()=>window.OfficeHQBridge.getState().tasks.length),before);
  assert.match(await page.locator('#toastArea').innerText(),/does not match the authorized company role/i);
  await page.locator('input[name="employeeId"]').evaluate((input,id)=>input.value=id,people.chosen);
  await page.locator('#taskForm button[type="submit"]').click();
  assert.equal(await page.evaluate(()=>window.OfficeHQBridge.getState().tasks.length),before+1);
  await page.locator('#modalRoot [data-action="inspectTask"]').filter({hasText:'Scope guard test'}).waitFor();
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

test('iPhone: Public APIs catalog is searchable and an eligible employee can request CEO documentation review',async()=>{
 const {page,context,errors}=await pageFor('iPhone 13');
 try{
   await page.evaluate(()=>window.OfficeHQBridge.setView('research'));
   await page.locator('h1').filter({hasText:'Agent Reach + Public APIs'}).waitFor();
   assert.equal(await page.locator('#researchPick option').count(),12);
   await page.locator('#researchSearch').fill('Marketstack');
   await page.locator('h3').filter({hasText:'Marketstack'}).waitFor();
   await page.locator('#researchSearch').fill('');
   await page.locator('#researchPick').selectOption('recalls');
   const assignee=page.locator('#researchAssignee');
   assert.ok((await assignee.locator('option').count())>0);
   await assignee.selectOption({index:0});
   await page.locator('#researchApiForm [name=reason]').fill('Evaluate read-only recall evidence for a product risk review.');
   await page.locator('#researchApiForm button[type=submit]').click();
   const proposals=await page.evaluate(()=>window.OfficeHQBridge.getState().approvals.filter(a=>a.kind==='api_discovery'));
   assert.equal(proposals.length,1);
   assert.equal(proposals[0].status,'pending');
   assert.match(proposals[0].note,/No authentication, OAuth, API key/);
   assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
