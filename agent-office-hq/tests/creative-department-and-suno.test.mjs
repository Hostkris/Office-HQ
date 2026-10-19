import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SITES,hostAllowed} from '../desktop/runner.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>readFile(join(root,p),'utf8');
const [app,library,floorCode,departments,ios,extension,manifestText,connections]=await Promise.all([
  'app.js','assignment-library.js','project-floor.js','department-offices.js',
  'ios-workstations.js','ios-safari-extension/background.js','ios-safari-extension/manifest.json','integration-center.js'
].map(read));

test('Six new creative-production employees have exclusive Marketing scopes and assignment presets',()=>{
 const matrix=JSON.parse(app.match(/const EXTENDED_ROLES=(\[[^\n]*\]);/)[1]);
 const roles=matrix.filter(r=>['creative_production_dir','music_producer','songwriter','beat_producer','audio_engineer','album_art_designer'].includes(r[0]));
 assert.equal(roles.length,6);
 for(const role of roles){
  assert.equal(role[2],'Marketing');
  assert.ok(role[5].length>3);
  assert.match(library,new RegExp('^'+role[0]+'\\|', 'm'));
 }
 assert.match(app,/ensureCreativeProductionWorkers\(\)/);
 const rows=library.split('const rows=`')[1].split('`.trim().split(')[0].trim().split('\n');
 assert.equal(rows.length,174);
});

test('Suno is a Marketing-only domain with distinct browser grants, not an implied OAuth connection',()=>{
 assert.equal(SITES.suno.url,'https://suno.com/');
 assert.deepEqual(SITES.suno.departments,['Marketing']);
 assert.equal(hostAllowed('suno','https://suno.com/create'),true);
 assert.equal(hostAllowed('suno','https://studio.suno.com/'),true);
 assert.equal(hostAllowed('suno','https://suno.com.attacker.example/'),false);
 assert.equal(hostAllowed('suno','http://suno.com/'),false);
 assert.match(ios,/\['suno','Suno music production'/);
 assert.match(extension,/suno:\{hosts:\['suno.com'\]/);
 const manifest=JSON.parse(manifestText);
 assert.ok(manifest.host_permissions.includes('https://suno.com/*'));
 assert.ok(manifest.content_scripts.some(entry=>entry.matches.includes('https://suno.com/*')));
 assert.match(connections,/provider:'Suno'/);
 assert.match(connections,/API setup/);
});

function sandbox(){
 const cid='company1',events={};
 const employees=[
  {id:'ops',companyId:cid,name:'Ops',roleKey:'ops',active:true},
  {id:'marketing',companyId:cid,name:'Marketing',roleKey:'marketing',active:true},
  {id:'finance',companyId:cid,name:'Finance',roleKey:'finance',active:true}
 ];
 const dept={ops:'Operations',marketing:'Marketing',finance:'Finance'};
 const state={companies:[{id:cid,name:'Test company'}],employees,
  tasks:[{id:'keep-task',companyId:cid,ownerId:'marketing',status:'queued'}],approvals:[],
  enterprise:{projectFloor:{floors:[
   {id:'operations',name:'Operations',companyId:cid,department:'Operations',placements:[],janitor:false},
   {id:'marketing-floor',name:'Marketing',companyId:cid,department:'Marketing',placements:[],janitor:false}
  ],projects:[],selected:{[cid]:{floorId:'marketing-floor',projectId:'all'}},initialPopulation:{[cid]:true}}}};
 let saves=0;
 const elements={companyPicker:{value:cid},pfEmployee:{value:'finance'},pfSeat:{value:'0'},pfPlacementProject:{value:'all'}};
 const B={getState:()=>state,save:()=>saves++,uid:k=>k+'_'+saves,roleFor:e=>({dept:dept[e?.roleKey],title:dept[e?.roleKey]+' worker',scope:e?.roleKey}),E:x=>String(x),toast:()=>{},setView:()=>{},addActivity:()=>{}};
 const document={querySelector:q=>elements[q.slice(1)]||null,addEventListener:(type,fn)=>(events[type]??=[]).push(fn)};
 const window={OfficeHQBridge:B};
 const ctx=vm.createContext({window,document,location:{hash:'#/tasks'},Date,Math,Set,Map,Array,Number,String,JSON,Boolean,console,
   performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},matchMedia:()=>({matches:true}),prompt:()=>null,confirm:()=>true});
 vm.runInContext(floorCode,ctx);
 return {engine:window.OfficeHQFloor,state,elements,events,get saves(){return saves}};
}
test('Department pickers exclude all unrelated roles in both RPG Office and Command Center',()=>{
 const s=sandbox();
 s.engine.setManageOffice(true);
 const html=s.engine.render();
 const options=html.match(/<select id="pfEmployee"[^>]*>([\s\S]*?)<\/select>/)[1];
 assert.match(options,/Marketing worker/);
 assert.doesNotMatch(options,/Finance worker|Operations worker/);
 const command=s.engine.commandControls('company1');
 const eligible=command.match(/<select id="pfCommandWorker">([\s\S]*?)<\/select>/)[1];
 assert.match(eligible,/Marketing worker/);
 assert.doesNotMatch(eligible,/Finance worker|Operations worker/);
 s.events.submit[0]({target:{id:'pfPlaceForm'},preventDefault(){}});
 assert.equal(s.engine.data().floors[1].placements.length,0,'manual forged finance placement must be rejected');
 s.elements.pfEmployee.value='marketing';
 s.events.submit[0]({target:{id:'pfPlaceForm'},preventDefault(){}});
 assert.equal(s.engine.data().floors[1].placements.length,1);
 assert.equal(s.state.tasks.length,1,'role restrictions never delete business assignments');
});

test('Cross-department legacy floor placements move safely to the correct floor',()=>{
 const s=sandbox();
 const d=s.engine.data();
 d.floors[0].placements.push({seat:0,employeeId:'marketing',projectId:null,taskId:'keep-task'});
 let seq=10;
 const B={getState:()=>s.state,roleFor:e=>({dept:e.roleKey==='marketing'?'Marketing':'Operations'}),uid:k=>k+'_'+(++seq),save:()=>{},E:String,addActivity:()=>{},toast:()=>{},setView:()=>{}};
 const win={OfficeHQBridge:B};
 const doc={addEventListener:()=>{},querySelector:()=>null};
 vm.runInNewContext(departments,{window:win,document:doc,Date,JSON,Math,Set,Map,Number,String,Array,Boolean,console,confirm:()=>true});
 win.OfficeHQDepartments.ensure('company1',d);
 assert.equal(d.floors[0].placements.length,0);
 assert.equal(d.floors[1].placements.length,1);
 assert.equal(d.floors[1].placements[0].employeeId,'marketing');
 assert.equal(d.floors[1].placements[0].taskId,'keep-task');
 assert.equal(s.state.tasks.length,1);
});
