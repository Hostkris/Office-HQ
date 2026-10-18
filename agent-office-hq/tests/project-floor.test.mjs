import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=await readFile(join(root,'project-floor.js'),'utf8');
function harness(){
 let serial=0,changes=0;
 const companyId='co1';
 const employees=Array.from({length:15},(_,i)=>({
  id:'emp'+i,companyId,active:true,name:'Employee '+i,outfit:'#426672',skin:'#bb8866',hair:'#223344'
 }));
 const roles=new Map(employees.map((e,i)=>[e.id,{title:'Role '+i,dept:'Operations',scope:'scope_'+i}]));
 const original={id:'original',companyId,ownerId:'emp0',status:'in_progress',title:'Previously assigned'};
 const state={version:1,companies:[{id:companyId,name:'Sample company'}],employees,tasks:[original],enterprise:{}};
 const B={
  E:v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  getState:()=>state,
  getEmployee:id=>employees.find(e=>e.id===id),
  roleFor:e=>roles.get(e?.id),
  uid:p=>p+'_'+(++serial),
  save(){changes++;},
  addActivity(){changes++;},
  setView(){},
  openModal(){}
 };
 const w={OfficeHQBridge:B,OfficeHQExtraViews:{},OfficeHQDesktopThoughts:{}};
 const ctx={window:w,document:{querySelector(){return null;},addEventListener(){}},location:{hash:''},
  setInterval(){},cancelAnimationFrame(){},performance:{now:()=>1000},console,Date,Math,Set,Array};
 vm.runInNewContext(source,ctx,{filename:'project-floor.js'});
 return {companyId,employees,state,B,api:w.OfficeHQProjectFloor,changes:()=>changes};
}
test('RPG floor starts empty despite saved preexisting tasks',()=>{
 const x=harness(),data=x.api.ensure(x.companyId),p=data.projects[0];
 assert.equal(x.api.limit,10);
 assert.equal(p.levels.length,1);
 assert.equal(p.levels[0].workers.length,10);
 assert.equal(p.levels[0].workers.filter(Boolean).length,0);
 assert.equal(p.levels[0].janitor,false);
 x.api.scanAll();
 assert.equal(p.levels[0].workers.filter(Boolean).length,0,'old seeded work cannot crowd the floor');
 assert.match(x.api.renderOffice(),/All desks are empty/);
 assert.match(x.api.renderOffice(),/Show janitor on this level/);
});
test('new task placed via existing task board auto-places only its assigned employee',()=>{
 const x=harness(),p=x.api.ensure(x.companyId).projects[0];
 x.state.tasks.push({id:'fresh',ownerId:'emp1',companyId:x.companyId,status:'queued',title:'New assignment'});
 assert.equal(x.api.scanAll(),true);
 assert.equal(p.levels[0].workers.filter(Boolean).length,1);
 assert.equal(p.levels[0].workers[0],'emp1');
 assert.equal(x.api.scanAll(),false);
});
test('10 employees maximum per floor and eleventh goes to the next floor',()=>{
 const x=harness(),p=x.api.ensure(x.companyId).projects[0];
 for(let i=0;i<11;i++)x.state.tasks.push({id:'new_'+i,companyId:x.companyId,ownerId:'emp'+i,status:'queued'});
 x.api.scanAll();
 assert.equal(p.levels[0].workers.filter(Boolean).length,10);
 assert.equal(p.levels[1].workers.filter(Boolean).length,1);
 assert.equal(p.levels[1].workers[0],'emp10');
 assert.equal(p.currentLevel,1);
 assert.equal(x.api.limit,10);
});
test('janitor choice belongs to one floor and is not one of the ten worker desks',()=>{
 const x=harness(),p=x.api.ensure(x.companyId).projects[0];
 p.levels[0].janitor=true;
 const next={workers:Array(10).fill(null),janitor:false};
 p.levels.push(next);
 assert.equal(p.levels[0].janitor,true);
 assert.equal(p.levels[1].janitor,false);
 assert.equal(p.levels[0].workers.filter(Boolean).length,0);
});
test('project teams are selective and separate with explicit positions',()=>{
 const x=harness(),d=x.api.ensure(x.companyId),p1=d.projects[0];
 const p2=x.api.addProject(d,'Special media launch');
 x.api.place(p2,x.employees[5],3,0);
 assert.equal(p2.levels[0].workers[3],'emp5');
 assert.ok(!p1.levels.some(f=>f.workers.includes('emp5')));
 assert.throws(()=>x.api.place(p2,x.employees[6],3,0),/occupied/);
 assert.equal(x.api.unplace(p2,'emp5'),true);
 assert.equal(p2.levels[0].workers[3],null);
 assert.match(x.api.renderOffice(),/Special media launch/);
});
test('task handoff preserves specialist role, owner and dependency; no website action is claimed',()=>{
 const x=harness(),data=x.api.ensure(x.companyId),p=data.projects[0];
 x.api.place(p,x.employees[0],0,0);
 x.api.place(p,x.employees[1],1,0);
 const source=x.api.taskFrom(x.employees[0],'Prepare research brief','Compare options.',p.id);
 source.status='done';
 const dest=x.api.taskFrom(x.employees[1],'Review specialist brief','Review what the first worker completed.',p.id,source.id);
 assert.equal(dest.ownerId,'emp1');
 assert.equal(dest.scope,'scope_1');
 assert.equal(dest.dependsOn,source.id);
 assert.equal(dest.status,'queued');
 assert.equal(dest.projectId,p.id);
 x.api.recordHandoff(source,dest);
 assert.equal(dest.status,'queued','Animation does not complete the task for the user');
});
