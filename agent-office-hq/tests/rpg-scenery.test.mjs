import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const [floorCode,lifeCode,appCode,css,serviceWorker]=await Promise.all([
  'project-floor.js','office-life.js','app.js','styles.css','sw.js'
].map(f=>readFile(join(root,f),'utf8')));

function office(){
 const cid='company',stores={writes:0};
 const state={companies:[{id:cid,name:'Office'}],employees:[{id:'a',companyId:cid,active:true,name:'Alex',roleKey:'worker',skin:'#be8c68',hair:'#513527',outfit:'#569b9c'}],tasks:[],approvals:[],enterprise:{}};
 const selections={companyPicker:{value:cid}};
 const B={getState:()=>state,uid:(p)=>p+'_1',save:()=>stores.writes++,roleFor:()=>({title:'Manager',dept:'Operations'}),E:String,toast:()=>{},setView:()=>{}};
 const dom={querySelector:q=>selections[q.slice(1)]||null,addEventListener:()=>{}};
 const context=vm.createContext({window:{OfficeHQBridge:B},document:dom,location:{hash:'#/command'},Date,Math,Array,Number,String,Boolean,Set,Map,JSON,console,
  requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{},performance:{now:()=>0},matchMedia:()=>({matches:true})});
 vm.runInContext(floorCode,context);
 context.window.OfficeHQFloor.setManageOffice(true);
 return {floor:context.window.OfficeHQFloor,state,stores,context};
}
test('RPG scene selector is independently saved for each company and both RPG views',()=>{
 const {floor,state,stores}=office();
 const html=floor.render();
 assert.match(html,/id="pfScene"/);
 assert.match(html,/Mountain sunrise/);
 assert.match(html,/Mountain sunset/);
 assert.match(html,/Western desert/);
 assert.match(floor.commandControls('company'),/id="pfCommandScene"/);
 assert.equal(floor.sceneFor('company'),'classic');
 const originalEmployeeCount=state.employees.length;
 const originalPlaced=floor.data().floors[0].placements.length;
 assert.equal(floor.setScene('company','western'),true);
 assert.equal(floor.sceneFor('company'),'western');
 assert.equal(floor.data().scenes.company,'western');
 assert.ok(stores.writes>=1,'selection persists via existing local workspace save');
 assert.match(floor.render(),/value="western" selected/);
 assert.match(floor.commandControls('company'),/value="western" selected/);
 assert.equal(state.employees.length,originalEmployeeCount);
 assert.equal(floor.data().floors[0].placements.length,originalPlaced);
 assert.equal(floor.setScene('company','unknown'),false);
 assert.equal(floor.sceneFor('company'),'western');
 for(const choice of ['mountain-sunrise','mountain-sunset','classic']){
  assert.equal(floor.setScene('company',choice),true);
  assert.equal(floor.sceneFor('company'),choice);
 }
 assert.equal(floor.data().scenes.company,'classic');
});
test('Canvas paints Western desert, sunrise and sunset without changing worker skin or tasks',()=>{
 const fills=[],texts=[],workerHats=[];
 let scene='western',timeOfDay='day';
 const window={OfficeHQFloor:{sceneFor:()=>scene},OfficeHQTheme:{get:()=>timeOfDay,sceneColor:v=>v}};
 const context=vm.createContext({window,Map,Set,Date,Math,Array,Number,String,console});
 vm.runInContext(lifeCode,context);
 const c={
  fillStyle:'',font:'',textAlign:'',
  fillRect(x,y,w,h){fills.push({x,y,w,h,color:this.fillStyle});if(x===-25&&y===-57&&w===50)workerHats.push(this.fillStyle);},
  fillText(s){texts.push(String(s));},save(){},restore(){},translate(){},
  beginPath(){},roundRect(){},fill(){},moveTo(){},lineTo(){},closePath(){},arc(){},
  createLinearGradient(){return {addColorStop(){}};}
 };
 const worker={id:'a',companyId:'company',name:'Alex',active:true,skin:'#be8c68',hair:'#513527',outfit:'#569b9c',customAppearance:true};
 const floor={id:'floor1',name:'Level 1',placements:[{seat:0,employeeId:'a'}],janitor:false};
 const payload={c,now:100,cid:'company',floor,project:null,handoff:null,staff:[worker],tasks:[],approvals:[],thoughts:{},B:{roleFor:()=>({title:'Manager'})}};
 for(const [choice,expected] of [['western','WESTERN DESERT'],['mountain-sunrise','MOUNTAIN SUNRISE'],['mountain-sunset','MOUNTAIN SUNSET']]){
  scene=choice;texts.length=0;workerHats.length=0;fills.length=0;
  assert.doesNotThrow(()=>window.OfficeHQOfficeLife.draw(payload));
  assert.ok(texts.some(s=>s.includes(expected)),choice+' scenery should paint');
  assert.ok(fills.length>30,'all workstations still draw');
  if(choice==='western')assert.ok(workerHats.length>0,'Western worker wears cowboy hat');
  else assert.equal(workerHats.length,0,'mountain scene keeps normal hairstyles');
  assert.equal(worker.skin,'#be8c68','scene does not modify employee appearance');
 }
 scene='classic';texts.length=0;fills.length=0;
 window.OfficeHQOfficeLife.draw(payload);
 assert.ok(!texts.some(s=>s.includes('SCENIC OFFICE')||s.includes('WESTERN DESERT')));
});
test('Local Mode and phone persistence guidance remain available with offline scenery',()=>{
 assert.match(appCode,/Local Mode/);
 assert.match(appCode,/localStorage.setItem\(KEY,JSON.stringify\(state\)\)/);
 assert.match(appCode,/data-action="exportData"/);
 assert.match(css,/pf-scene-control/);
 assert.match(serviceWorker,/agent-office-hq-v[0-9]+/);
});
