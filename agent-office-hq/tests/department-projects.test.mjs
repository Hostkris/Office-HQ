import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {roles} from '../openmaus/team.mjs';
const source=await readFile(new URL('../department-projects.js',import.meta.url),'utf8');
function setup(){
 let sequence=0,companyId='co1';const handlers={},pushed=[];
 const employees=roles.map((r,i)=>({id:'e'+i,companyId:'co1',name:r.title+' worker',roleKey:r.key,active:true}));
 const state={companies:[{id:'co1',name:'First company'},{id:'co2',name:'Second company'}],employees,tasks:[],approvals:[],enterprise:{}};
 const B={getState:()=>state,getRoles:()=>roles.map(r=>({...r,dept:r.department})),roleFor:e=>{const r=roles.find(r=>r.key===e?.roleKey);return r&&{...r,dept:r.department};},getEmployee:id=>employees.find(e=>e.id===id),E:s=>String(s??'').replaceAll('<','&lt;').replaceAll('"','&quot;'),uid:p=>p+ ++sequence,save(){},addActivity(){},setView(){},toast(){}};
 const document={getElementById:id=>id==='companyPicker'?{value:companyId}:null,hidden:false,addEventListener:(t,f)=>(handlers[t]??=[]).push(f)};
 const window={OfficeHQBridge:B,OfficeHQExtraViews:{workflows:()=>''},OfficeHQCompanyInbox:{refresh(){}},OfficeHQSecureChat:{render:()=>''},OfficeHQDeviceSync:{pushTask:t=>pushed.push(t.id)}};
 vm.runInNewContext(source,{document,window,location:{hash:'',hostname:'hostkris.github.io'},setInterval(){},confirm:()=>true});
 const api=window.OfficeHQDepartmentProjects;
 const click=(selector,dataset)=>handlers.click.forEach(f=>f({target:{closest:s=>s===selector?{dataset}:null}}));
 function start(dept='Marketing'){
  click('[data-team-select]',{teamSelect:dept});api.start('Prepare a complete launch plan using only approved source information.');return state.enterprise.departmentProjects.at(-1);
 }
 function ready(t){t.status='review';t.output='Verified specialist work';t.cloudLastReview=new Date().toISOString();}
 return {state,employees,api,click,start,ready,pushed,company:id=>companyId=id};
}
test('one company-wide assignment produces exclusive specialist jobs in all twelve departments',()=>{
 const f=setup(),p=f.start('All departments');assert.equal(p.taskIds.length,39);
 assert.equal(f.pushed.length,39);assert.equal(new Set(f.state.tasks.map(t=>t.scope)).size,39);
 assert.ok(f.state.tasks.every(t=>t.cloudSyncRequested&&t.delegatedBy==='owner'&&t.requiresApproval));
 assert.ok(!f.state.tasks.some(t=>f.employees.find(e=>e.id===t.ownerId).roleKey==='ceo'));
});
test('team report waits for every real result, then opens a single CEO approval',()=>{
 const f=setup(),p=f.start();const tasks=f.state.tasks;
 for(const t of tasks){t.status='review';t.output='Manual text without a run receipt';}
 f.api.reconcile();assert.equal(p.status,'queued');assert.equal(f.state.approvals.length,0);
 tasks.slice(1).forEach(f.ready);f.api.reconcile();assert.equal(p.status,'queued');
 f.ready(tasks[0]);f.api.reconcile();assert.equal(p.status,'review');assert.equal(f.state.approvals.length,1);
 assert.match(p.packet,/VERIFIED AI DRAFT CONTRIBUTIONS/);assert.match(p.packet,/Market Research Analyst/);
 f.api.reconcile();assert.equal(f.state.approvals.length,1,'repeated status refresh must not duplicate approval');
 f.click('[data-team-decision]',{teamDecision:'approve',teamId:p.id});
 assert.equal(p.status,'approved');assert.ok(tasks.every(t=>t.status==='done'));
});
test('blocked project returns to the queue after recovery and cannot approve stale or missing work',()=>{
 const f=setup(),p=f.start();f.state.tasks[0].status='blocked';f.api.reconcile();assert.equal(p.status,'attention');
 f.state.tasks[0].status='in_progress';f.api.reconcile();assert.equal(p.status,'queued');
 f.state.tasks.forEach(f.ready);f.api.reconcile();assert.equal(p.status,'review');
 f.state.tasks[0].status='blocked';f.click('[data-team-decision]',{teamDecision:'approve',teamId:p.id});
 assert.equal(p.status,'review');assert.equal(f.state.approvals[0].status,'pending');
});
test('team decisions cannot cross the selected company and requesting changes preserves original evidence',()=>{
 const f=setup(),p=f.start();f.state.tasks.forEach(f.ready);f.api.reconcile();
 f.company('co2');f.click('[data-team-decision]',{teamDecision:'approve',teamId:p.id});assert.equal(p.status,'review');
 f.company('co1');f.click('[data-team-decision]',{teamDecision:'reject',teamId:p.id});
 assert.equal(p.status,'changes-requested');assert.ok(f.state.tasks.every(t=>t.output==='Verified specialist work'));
});
