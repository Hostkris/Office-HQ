import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const js=await readFile(join(root,'project-floor.js'),'utf8');
function sandbox(){
 let next=0,saves=0;
 const companyId='company1';
 const workers=Array.from({length:13},(_,i)=>({id:'worker'+i,companyId,name:'Worker '+i,active:true,roleKey:'role'+i,skin:'#a77b59',hair:'#2d2523',outfit:'#77bbaa'}));
 const state={companies:[{id:companyId,name:'First Company'}],employees:workers,tasks:[],enterprise:{}};
 const controls={companyPicker:{value:companyId},pfFloor:{},pfEmployee:{value:'worker0'},pfSeat:{value:'0'},pfPlacementProject:{value:'all'},pfFirstTask:{value:''},pfNextTask:{value:''},pfJanitor:{checked:true}};
 const handlers={};
 const errors=[];
 const bridge={
  getState:()=>state,uid:type=>type+'_'+(++next),save:()=>saves++,
  getEmployee:id=>workers.find(w=>w.id===id),
  roleFor:e=>({title:'Staff member '+(e?.roleKey||''),dept:'Operations',scope:e?.roleKey||''}),
  E:v=>String(v??'').replace(/[&<>"']/g,''),
  toast:(msg,type)=>errors.push({msg,type}),setView:()=>{},workerModal:()=>{}
 };
 const document={
  querySelector:q=>controls[q.slice(1)]||null,
  addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn);}
 };
 const context=vm.createContext({window:{OfficeHQBridge:bridge},document,location:{hash:'#/tasks'},Date,Math,Set,Map,Array,Number,String,JSON,Boolean,console,
   prompt:()=>null,confirm:()=>true,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},matchMedia:()=>({matches:true})});
 new vm.Script(js,{filename:'project-floor.js'}).runInContext(context);
 function emit(type,event){for(const fn of handlers[type]||[])fn(event);}
 return {engine:context.window.OfficeHQFloor,state,workers,bridge,controls,errors,emit,get saves(){return saves}};
}
test('RPG office starts with exactly 10 empty desks, no employees visible despite roster and sample tasks',()=>{
 const s=sandbox();
 s.state.tasks.push({id:'oldTask',ownerId:'worker0',companyId:'company1',status:'in_progress'});
 const initial=s.engine.data();
 assert.equal(initial.floors.length,0,'do not pre-populate visible office from old employee records');
 const html=s.engine.render();
 assert.equal(s.engine.LIMIT,10);
 assert.match(html,/0 \/ 10/);
 assert.match(html,/Empty office\. Place your first employee/);
 assert.equal(s.engine.data().floors[0].placements.length,0);
 assert.equal(s.state.employees.length,13);
});
test('explicit new task automatically places employee and no duplicate employee is ever placed',()=>{
 const s=sandbox();s.engine.render();
 const task={id:'fresh',companyId:'company1',ownerId:'worker2',status:'queued'};
 s.engine.onTaskAssigned(task);
 assert.equal(s.engine.data().floors[0].placements.length,1);
 assert.equal(s.engine.data().floors[0].placements[0].employeeId,'worker2');
 assert.equal(s.engine.data().floors[0].placements[0].taskId,'fresh');
 s.engine.onTaskAssigned({...task,id:'second'});
 assert.equal(s.engine.data().floors[0].placements.length,1,'duplicate staff must not be drawn');
 assert.equal(s.engine.data().projects[0].name,'Assigned work');
});
test('each RPG level cannot exceed 10 employees even when assigning eleven real tasks',()=>{
 const s=sandbox();s.engine.render();
 for(let i=0;i<11;i++)s.engine.onTaskAssigned({id:'task'+i,companyId:'company1',ownerId:'worker'+i,status:'queued'});
 assert.equal(s.engine.data().floors[0].placements.length,10);
 assert.equal(new Set(s.engine.data().floors[0].placements.map(p=>p.seat)).size,10);
 assert.equal(s.state.tasks.length,0,'the visualization must not manipulate the actual task records');
 assert.ok(s.errors.some(x=>/All floors have 10 workers/.test(x.msg)));
});
test('one optional janitor per level does not consume any employee desk',()=>{
 const s=sandbox();s.engine.render();
 s.emit('change',{target:{id:'pfJanitor',checked:true}});
 assert.equal(s.engine.data().floors[0].janitor,true);
 assert.equal(s.engine.data().floors[0].placements.length,0);
 for(let i=0;i<10;i++)s.engine.onTaskAssigned({id:'t'+i,companyId:'company1',ownerId:'worker'+i,status:'queued'});
 assert.equal(s.engine.data().floors[0].placements.length,10);
 assert.equal(s.engine.data().floors[0].janitor,true);
});
test('manual desk placement, selected project groups and second level stay isolated',()=>{
 const s=sandbox();s.engine.render();
 const d=s.engine.data(),floor=d.floors[0];
 d.projects.push({id:'project_a',companyId:'company1',name:'Marketing Campaign',members:[],taskIds:[]});
 s.controls.pfEmployee.value='worker0';s.controls.pfSeat.value='4';s.controls.pfPlacementProject.value='project_a';
 s.emit('submit',{target:{id:'pfPlaceForm'},preventDefault(){}});
 assert.equal(floor.placements.length,1);
 assert.equal(floor.placements[0].projectId,'project_a');
 assert.equal(floor.placements[0].seat,4);
 assert.equal(d.projects[0].members[0],'worker0');
 // A second level starts empty and does not move staff automatically.
 s.emit('click',{target:{closest(){return {dataset:{pf:'new-floor'}};}}});
 assert.equal(d.floors.length,2);
 assert.equal(d.floors[1].placements.length,0);
 assert.equal(d.floors[0].placements.length,1);
 assert.equal(d.selected.company1.floorId,d.floors[1].id);
});
test('a task completion handoff requires real owner IDs on the same floor',()=>{
 const s=sandbox();s.engine.render();
 s.engine.onTaskAssigned({id:'first',companyId:'company1',ownerId:'worker0'});
 s.engine.onTaskAssigned({id:'second',companyId:'company1',ownerId:'worker1'});
 s.state.tasks.push({id:'first',companyId:'company1',ownerId:'worker0',status:'done'});
 s.state.tasks.push({id:'second',companyId:'company1',ownerId:'worker1',status:'queued',dependsOn:'first'});
 assert.doesNotThrow(()=>s.engine.onTaskStatus(s.state.tasks[0]));
 assert.equal(s.state.tasks[1].status,'queued','animation cannot forge assignment completion');
 assert.equal(s.state.tasks[1].dependsOn,'first');
});
test('office features are separate from external account access',()=>{
 assert.doesNotMatch(js,/sendMessage\s*\(|fetch\s*\(|window\.open\s*\(/);
 assert.match(js,/Only visualizes a verified internal task transition/);
 assert.match(js,/const LIMIT=10/);
});
