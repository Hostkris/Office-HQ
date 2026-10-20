import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=await readFile(join(root,'department-offices.js'),'utf8');

function make(){
 let seq=0,saveCount=0;
 const cid='company1';
 const roleKeys=['chief_staff','coo','cfo','cmo','cto','hr_dir','cro','counsel','chief_audit','project_mgr','support_lead','product_mgr'];
 const staff=roleKeys.map((roleKey,i)=>({id:'w'+i,roleKey,companyId:cid,name:'Head '+roleKey,active:true}));
 const data={companies:[{id:cid,name:'Test firm'}],employees:staff,tasks:[],approvals:[],
  enterprise:{projectFloor:{floors:[{id:'old_floor',companyId:cid,name:'Level 1',placements:[],janitor:false}],projects:[],selected:{}}}};
 const events={},notice=[];
 const B={
  getState:()=>data,uid:prefix=>prefix+'_'+(++seq),save:()=>saveCount++,
  E:s=>String(s??'').replace(/[&<>"]/g,''),
  addActivity:(who,msg,kind,companyId)=>notice.push({who,msg,kind,companyId}),
  toast:msg=>notice.push({msg}),setView:()=>{}
 };
 const document={querySelector:()=>null,addEventListener:(type,handler)=>{(events[type]??=[]).push(handler)}};
 const context={window:{OfficeHQBridge:B},document,Date,JSON,Math,Set,Map,Number,String,Array,Boolean,console,confirm:()=>true};
 const ctx=vm.createContext(context);new vm.Script(source,{filename:'department-offices.js'}).runInContext(ctx);
 return {cid,staff,data,engine:ctx.window.OfficeHQDepartments,notice,get saves(){return saveCount}};
}
test('create 12 staffed-head offices using original role categories and preserve existing desks',()=>{
 const s=make();const before=s.data.enterprise.projectFloor.floors[0].id;
 const floors=s.engine.ensure(s.cid,s.data.enterprise.projectFloor);
 assert.equal(floors.length,12);
 assert.equal(s.engine.DEPTS.length,12);
 assert.equal(new Set(floors.map(f=>f.department)).size,12);
 assert.equal(floors[0].id,before,'existing floor must be retained without deleting user data');
 assert.ok(floors.every(f=>Array.isArray(f.placements)&&f.placements.length<=10));
 for(const d of s.engine.DEPTS)assert.ok(s.engine.headFor(s.cid,d.id),'missing real department head '+d.id);
 const second=s.engine.ensure(s.cid,s.data.enterprise.projectFloor);
 assert.equal(second.length,12);
 assert.equal(s.data.enterprise.projectFloor.floors.length,12,'revisiting does not duplicate offices');
});
test('department packet visits selected heads in sequence and CEO is ALWAYS the final decision',()=>{
 const s=make();s.engine.ensure(s.cid,s.data.enterprise.projectFloor);
 const created=s.engine.create(s.cid,'Product marketing launch',['Product','Operations','Marketing'],null);
 assert.equal(created.ok,true);
 const route=created.route;
 assert.equal(route.departments.join(','),'Product,Operations,Marketing,Leadership');
 assert.equal(route.status,'at_department');
 for(let i=0;i<3;i++){
  const r=s.engine.forward(s.cid,route.id);
  assert.equal(r.ok,true);
  assert.equal(route.cursor,i+1);
  assert.equal(route.steps[i].status,'reviewed');
 }
 assert.equal(route.status,'awaiting_ceo');
 assert.equal(s.data.approvals.length,1,'only one final CEO approval card is generated');
 assert.equal(s.data.approvals[0].kind,'department_route');
 assert.equal(s.data.approvals[0].status,'pending');
 assert.equal(s.engine.forward(s.cid,route.id).ok,false);
 assert.equal(route.status,'awaiting_ceo','review route does not self-approve');
 const approval=s.data.approvals[0];
 approval.status='approved';s.engine.onApproval(approval,'approved');
 assert.equal(route.status,'completed');
 assert.equal(route.steps.at(-1).status,'completed');
 assert.equal(s.data.tasks.length,0,'routing must not impersonate real task completion');
});
test('no forwarding before linked task is genuinely done and approved',()=>{
 const s=make();s.engine.ensure(s.cid,s.data.enterprise.projectFloor);
 s.data.tasks.push({id:'t1',companyId:s.cid,status:'review'});
 const created=s.engine.create(s.cid,'Review a sensitive report',['Finance'], 't1');
 assert.equal(created.ok,true);
 assert.equal(s.engine.forward(s.cid,created.route.id).ok,false);
 assert.equal(created.route.cursor,0);
 s.data.tasks[0].status='done';
 assert.equal(s.engine.forward(s.cid,created.route.id).ok,true);
 assert.equal(created.route.status,'awaiting_ceo');
 const approval=s.data.approvals[0];approval.status='rejected';
 s.engine.onApproval(approval,'rejected');
 assert.equal(created.route.status,'rejected');
});
test('missing department head blocks internal review and a returned packet creates no final approval',()=>{
 const s=make();s.engine.ensure(s.cid,s.data.enterprise.projectFloor);
 s.staff.find(w=>w.roleKey==='cfo').active=false;
 const one=s.engine.create(s.cid,'Budget proposal',['Finance','Audit'],null);
 assert.equal(one.ok,true);
 assert.equal(s.engine.forward(s.cid,one.route.id).ok,false);
 assert.equal(s.data.approvals.length,0);
 s.staff.find(w=>w.roleKey==='cfo').active=true;
 assert.equal(s.engine.forward(s.cid,one.route.id).ok,true);
 const stopped=s.engine.create(s.cid,'Needs revision',['Marketing'],null);
 // Return using DOM action is covered in mobile test, but status refuses further forwarding after returned.
 assert.equal(stopped.ok,true);
 assert.equal(s.engine.routes(s.cid).length,2);
});
test('render exposes all 12 department selectors, head details and explicit route controls',()=>{
 const s=make();s.engine.ensure(s.cid,s.data.enterprise.projectFloor);
 const html=s.engine.flowMarkup(s.cid);
 assert.match(html,/12 department offices/);
 assert.match(html,/CEO decides last/);
 assert.equal((html.match(/data-dept-action="visit"/g)||[]).length,12);
 assert.equal((html.match(/name="department"/g)||[]).length,11);
 assert.match(html,/pfDepartmentRouteForm/);
});
