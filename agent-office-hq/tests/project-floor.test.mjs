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
 const cid='company1';
 const workers=Array.from({length:42},(_,i)=>({id:'worker'+i,companyId:cid,name:'Worker '+i,active:true,roleKey:'role'+i,skin:'#a77b59',hair:'#2d2523',outfit:'#77bbaa'}));
 const state={companies:[{id:cid,name:'Test Company'}],employees:workers,tasks:[],approvals:[],enterprise:{}};
 const controls={companyPicker:{value:cid},pfFloor:{},pfEmployee:{value:'worker35'},pfSeat:{value:'20'},
  pfPlacementProject:{value:'all'},pfFirstTask:{value:''},pfNextTask:{value:''},pfJanitor:{checked:true},
  pfCommandWorker:{value:'worker36'},pfCommandRemove:{value:'0'}};
 const handlers={},errors=[];
 const B={getState:()=>state,uid:k=>k+'_'+(++next),save:()=>saves++,roleFor:e=>({title:'Staff '+(e?.roleKey||''),dept:'Operations',scope:e?.roleKey||''}),
  E:v=>String(v??'').replace(/[&<>"']/g,''),toast:(msg,type)=>errors.push({msg,type}),setView:()=>{},workerModal:()=>{}};
 const doc={querySelector:q=>controls[q.slice(1)]||null,addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn);}};
 const context=vm.createContext({window:{OfficeHQBridge:B},document:doc,location:{hash:'#/tasks'},Date,Math,Set,Map,Array,Number,String,JSON,Boolean,console,
  prompt:()=>null,confirm:()=>true,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},matchMedia:()=>({matches:true})});
 new vm.Script(js,{filename:'project-floor.js'}).runInContext(context);
 const emit=(type,event)=>{for(const fn of handlers[type]||[])fn(event);};
 const click=(action)=>emit('click',{target:{closest(){return {dataset:{pf:action,seat:'0'}};}}});
 context.window.OfficeHQFloor.setManageOffice(true);
 return {engine:context.window.OfficeHQFloor,state,workers,controls,errors,emit,click,get saves(){return saves}};
}
test('Live RPG and Command Center share 15 initial existing workers, thirty desks and preserved tasks',()=>{
 const s=sandbox();
 s.state.tasks.push({id:'historic',companyId:'company1',ownerId:'worker33',status:'queued'});
 assert.equal(s.engine.data().floors.length,0);
 const html=s.engine.render();
 assert.equal(s.engine.LIMIT,30);
 assert.equal(s.engine.INITIAL_WORKERS,15);
 assert.match(html,/15 \/ 30/);
 assert.equal(s.engine.data().floors[0].placements.length,15);
 assert.equal(new Set(s.engine.data().floors[0].placements.map(p=>p.employeeId)).size,15);
 assert.equal(s.state.tasks.length,1);
 const cmd=s.engine.commandControls('company1');
 assert.match(cmd,/pfCommandWorker/);assert.match(cmd,/pfCommandRemove/);
 assert.equal(s.engine.data().floors[0].placements.length,15,'command view must not double-seed');
});
test('Manually removing a worker from either screen never repopulates them, destroys a task or deletes the roster',()=>{
 const s=sandbox();s.engine.render();
 const victim=s.engine.data().floors[0].placements[0].employeeId;
 s.click('command-remove');
 assert.equal(s.engine.data().floors[0].placements.length,14);
 s.engine.render();s.engine.commandControls('company1');
 assert.equal(s.engine.data().floors[0].placements.length,14);
 assert.equal(s.state.employees.length,42);
 assert.ok(s.state.employees.some(e=>e.id===victim));
 assert.equal(s.engine.data().initialPopulation.company1,true);
});
test('Command Center manual add appears in Live RPG without duplicate staff',()=>{
 const s=sandbox();s.engine.render();
 s.click('command-add');
 assert.equal(s.engine.data().floors[0].placements.length,16);
 assert.equal(s.engine.data().floors[0].placements.at(-1).employeeId,'worker36');
 assert.match(s.engine.render(),/16 \/ 30/);
 s.click('command-add');
 assert.equal(s.engine.data().floors[0].placements.length,16);
 assert.equal(new Set(s.engine.data().floors[0].placements.map(p=>p.employeeId)).size,16);
});
test('Auto-assignment adds the new specialist once, but never creates an eleventh copy',()=>{
 const s=sandbox();s.engine.render();
 const t={id:'newTask',companyId:'company1',ownerId:'worker38',status:'queued'};
 s.engine.onTaskAssigned(t);
 assert.equal(s.engine.data().floors[0].placements.length,16);
 assert.equal(s.engine.data().floors[0].placements.find(p=>p.employeeId==='worker38').taskId,'newTask');
 s.engine.onTaskAssigned({...t,id:'another'});
 assert.equal(s.engine.data().floors[0].placements.length,16);
 assert.equal(s.engine.data().projects[0].name,'Assigned work');
});
test('Each level caps at exactly 30 RPG workers; extra assignments stay intact',()=>{
 const s=sandbox();s.engine.render();
 for(let i=15;i<31;i++)s.engine.onTaskAssigned({id:'t'+i,companyId:'company1',ownerId:'worker'+i,status:'queued'});
 assert.equal(s.engine.data().floors[0].placements.length,30);
 assert.equal(new Set(s.engine.data().floors[0].placements.map(p=>p.seat)).size,30);
 assert.ok(s.errors.some(x=>/department office is full/.test(x.msg)));
 assert.equal(s.state.tasks.length,0,'visual placement never modifies task records');
});
test('Optional janitor does not count toward the thirty employee desk spaces',()=>{
 const s=sandbox();s.engine.render();
 s.emit('change',{target:{id:'pfJanitor',checked:true}});
 assert.equal(s.engine.data().floors[0].janitor,true);
 for(let i=15;i<30;i++)s.engine.onTaskAssigned({id:'t'+i,companyId:'company1',ownerId:'worker'+i,status:'queued'});
 assert.equal(s.engine.data().floors[0].placements.length,30);
 assert.equal(s.engine.data().floors[0].janitor,true);
});
test('Manually place specialists by project and keep independently selected extra levels',()=>{
 const s=sandbox();s.engine.render();
 const d=s.engine.data(),first=d.floors[0];
 d.projects.push({id:'projectA',companyId:'company1',name:'Campaign',members:[],taskIds:[]});
 s.controls.pfPlacementProject.value='projectA';
 s.emit('submit',{target:{id:'pfPlaceForm'},preventDefault(){}});
 assert.equal(first.placements.length,16);
 assert.equal(first.placements.find(p=>p.seat===20).projectId,'projectA');
 assert.equal(d.projects[0].members[0],'worker35');
 s.click('new-floor');
 assert.equal(d.floors.length,3);
 assert.equal(d.floors[2].placements.length,0);
 assert.equal(d.floors[0].placements.length,16);
});
test('Task handoff preserves actual task status instead of claiming work was done',()=>{
 const s=sandbox();s.engine.render();
 s.state.tasks.push({id:'first',companyId:'company1',ownerId:'worker0',status:'done'});
 s.state.tasks.push({id:'second',companyId:'company1',ownerId:'worker1',status:'queued',dependsOn:'first'});
 assert.doesNotThrow(()=>s.engine.onTaskStatus(s.state.tasks[0]));
 assert.equal(s.state.tasks[1].status,'queued');
});
test('Expanded RPG remains isolated from external website or payment execution',()=>{
 assert.doesNotMatch(js,/sendMessage\s*\(|fetch\s*\(|window\.open\s*\(/);
 assert.match(js,/Only visualizes a verified internal task transition/);
 assert.match(js,/const LIMIT=30/);
});
