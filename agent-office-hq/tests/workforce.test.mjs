import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const [app,policy]=await Promise.all(['app.js','workforce-lean.js'].map(f=>readFile(path.join(root,f),'utf8')));
const main=app.match(/const ALL_ROLES=\[([\s\S]*?)\]\.map\(/)?.[1];
assert.ok(main,'Legacy role catalog should remain available to recover archived assignments');
const extendedLiteral=app.match(/const EXTENDED_ROLES=(\[[^\n]*\]);/)?.[1];
assert.ok(extendedLiteral,'Legacy specialties should remain available for role-name restoration');
const extendedRoles=JSON.parse(extendedLiteral);
const raw=vm.runInNewContext('['+main+']',{EXTENDED_ROLES:extendedRoles});
const all=raw.map(([key,title,dept,level,reportsTo,scope,description])=>({key,title,dept,level,reportsTo,scope,description}));
const sandbox={window:{}};
vm.runInNewContext(policy,sandbox);
const lean=sandbox.window.OfficeHQLeanWorkforce;
const roles=lean.selectRoles(all);
test('exactly 40 essentials cover all 12 departments with no duplicate specialty',()=>{
 assert.equal(roles.length,40);
 assert.equal(new Set(roles.map(r=>r.dept)).size,12);
 assert.equal(new Set(roles.map(r=>r.key)).size,40);
 assert.equal(new Set(roles.map(r=>r.scope)).size,40);
 for(const key of ['ceo','chief_staff','exec_assistant','project_mgr','budget_officer','bookkeeper','ap','ar','purchaser','inventory_mgr','social','content','research','support','integrator','security','counsel','internal_auditor','product_mgr'])assert.ok(roles.some(r=>r.key===key),key+' absent');
 for(const key of ['janitor','thumbnail_designer','facilities_director','meeting_coordinator'])assert.ok(!roles.some(r=>r.key===key),key+' should not be a required AI employee');
});
test('every retained role has a real manager path to CEO and no cycles',()=>{
 const byKey=new Map(roles.map(r=>[r.key,r]));
 for(const role of roles){
  let target=role.reportsTo;const visited=new Set([role.key]);
  while(target){
   assert.ok(byKey.has(target),role.key+' manager '+target+' is missing');
   assert.ok(!visited.has(target),'Cycle: '+role.key);
   visited.add(target);target=byKey.get(target).reportsTo;
  }
 }
 assert.equal(byKey.get('project_mgr').scope,'briefing');
 assert.equal(byKey.get('hr_dir').reportsTo,'ceo');
 assert.equal(byKey.get('support_lead').reportsTo,'cro');
 assert.equal(byKey.get('chief_audit').reportsTo,'ceo');
});
test('migration keeps essential edited profiles, archives retired profiles, and holds legacy work without destroying it',()=>{
 const staff=all.map((role,i)=>({id:'worker'+i,companyId:'co1',roleKey:role.key,name:role.key==='social'?'My Customized Social Agent':role.title,active:true}));
 const special=staff.find(e=>e.roleKey==='video_producer');
 const support=staff.find(e=>e.roleKey==='support');
 const grants=[{id:'oldgrant',employeeId:special.id,provider:'Gmail'},{id:'newgrant',employeeId:support.id,provider:'Gmail'}];
 const state={version:1,companies:[{id:'co1'}],employees:staff,tasks:[
  {id:'taskOld',companyId:'co1',ownerId:special.id,scope:'video_production',description:'Original custom instructions',status:'in_progress'},
  {id:'taskDone',companyId:'co1',ownerId:special.id,scope:'video_production',description:'Original completed task',status:'done',output:'Prior finished output'},
  {id:'taskCurrent',companyId:'co1',ownerId:support.id,scope:'customer_service',status:'queued'}
 ],approvals:[{id:'approve1',status:'pending'}],enterprise:{grants,projectFloor:{floors:[{placements:[{employeeId:special.id},{employeeId:support.id}]}],projects:[{members:[special.id,support.id]}]}}};
 const seed=cid=>roles.map((role,i)=>({id:'fresh'+i,companyId:cid,roleKey:role.key,name:'New '+role.title,active:true}));
 const out=lean.consolidate(state,roles,all,seed);
 assert.equal(out.changed,true);assert.equal(state.workforceRevision,2);
 assert.equal(state.employees.length,40);assert.equal(out.removed,all.length-40);
 assert.equal(state.workforceArchive.length,all.length-40);
 assert.equal(state.employees.find(x=>x.roleKey==='social').name,'My Customized Social Agent');
 const held=state.tasks.find(x=>x.id==='taskOld');
 assert.equal(held.description,'Original custom instructions');
 assert.equal(held.status,'blocked');assert.equal(held.needsReassignment,true);
 assert.equal(held.ownerId,null);assert.equal(held.originalOwnerId,special.id);
 const done=state.tasks.find(x=>x.id==='taskDone');
 assert.equal(done.status,'done');assert.equal(done.output,'Prior finished output');
 assert.equal(state.tasks.find(x=>x.id==='taskCurrent').ownerId,support.id);
 assert.equal(state.approvals[0].status,'pending');
 assert.equal(state.enterprise.grants.length,1);
 assert.equal(state.workforceArchivedGrants.length,1);
 assert.equal(state.enterprise.projectFloor.floors[0].placements.length,1);
 assert.equal(state.enterprise.projectFloor.projects[0].members.length,1);
 assert.equal(lean.consolidate(state,roles,all,seed).changed,false);
 assert.equal(state.workforceArchive.length,all.length-40);
});
test('CEO can explicitly reassign held work, but no app code auto-runs retired agents',()=>{
 assert.match(app,/function reassignTaskForm/);
 assert.match(app,/case 'reassignTaskForm'/);
 assert.match(app,/t\.originalScope\?\?=t\.scope/);
 assert.match(app,/t\.status='queued'/);
 assert.match(app,/confirm\('Reassign this original task/);
 assert.doesNotMatch(policy,/run-agent|fetch\(/);
});
test('new company and restored backups run the 40-person migration, not the old creative auto-hire',()=>{
 assert.match(app,/const ROLES=window\.OfficeHQLeanWorkforce\.selectRoles\(ALL_ROLES\)/);
 assert.match(app,/window\.OfficeHQLeanWorkforce\.consolidate\(state,ROLES,ALL_ROLES,seedEmployeeSet\)/);
 assert.doesNotMatch(app,/ensureCreativeProductionWorkers\(\);/);
 assert.match(app,/focused\?\[fixedRole\]:ROLES/);
});
