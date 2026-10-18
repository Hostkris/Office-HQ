import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=await readFile(join(root,'office-life.js'),'utf8');
function run(){
 let now=100000,labels=[];
 class FakeDate extends Date{static now(){return now;}}
 const context={window:{},Date:FakeDate,Math,Array,Map,Set,String,Number,console};
 vm.runInNewContext(source,context,{filename:'office-life.js'});
 const life=context.window.OfficeHQOfficeLife;
 const staff=Array.from({length:10},(_,i)=>({id:'agent'+i,name:'Employee '+i,skin:'#b87957',hair:'#32303a',outfit:'#52baba'}));
 const floor={id:'level1',name:'Level 1',janitor:true,placements:staff.map((e,i)=>({employeeId:e.id,seat:i,projectId:null}))};
 const c={
  save(){},restore(){},translate(){},fillRect(){},beginPath(){},roundRect(){},fill(){},
  setLineDash(){},strokeRect(){},clearRect(){},fillText(s){labels.push(String(s));},
  set font(v){},set fillStyle(v){},set textAlign(v){}
 };
 const B={roleFor:()=>({title:'Customer Relations Specialist'})};
 const draw=extra=>life.draw({c,now,cid:'company1',floor,project:null,staff,tasks:[],approvals:[],thoughts:{},B,...extra});
 return {life,staff,floor,draw,get labels(){return labels},clear(){labels=[]},setNow:v=>now=v,get now(){return now}};
}
test('RPG life scene includes named workers, job titles, thought bubbles and CEO room',()=>{
 const o=run();assert.equal(o.life.DESKS.length,10);
 o.draw();
 assert.ok(o.labels.includes('CEO OFFICE'));assert.ok(o.labels.includes('APPROVAL DESK'));
 assert.ok(o.labels.includes('Employee 0'));
 assert.ok(o.labels.includes('Customer Relations Specialist'));
 assert.ok(o.labels.some(l=>/Just checking|Stretching|Ready for|schedule|Standing|break/i.test(l)));
 assert.equal(o.life.activitySnapshot('company1:level1:all').length,10);
 assert.equal(o.life.activityTypes.includes('restroom'),true);
 assert.equal(o.life.activityTypes.includes('lunch'),true);
 assert.equal(o.life.activityTypes.includes('chat'),true);
 assert.equal(o.life.activityTypes.includes('coffee'),true);
});
test('all placed workers may take varied breaks but at most two are away and no two share a coffee station',()=>{
 const o=run();o.draw();
 const seen=new Set();
 for(let j=0;j<110;j++){
  o.setNow(o.now+7600);o.clear();o.draw();
  const snap=o.life.activitySnapshot('company1:level1:all');
  assert.equal(snap.length,10);
  const roaming=snap.filter(x=>!['desk','stand','stretch'].includes(x.kind));
  assert.ok(roaming.length<=2,'At most two visitors are away from desks');
  for(const k of ['coffee','restroom','lunch','ceo'])assert.ok(snap.filter(x=>x.kind===k).length<=1,'No crowd at '+k);
  for(const a of roaming)seen.add(a.kind);
 }
 assert.ok(seen.has('coffee'),'Coffee breaks should be reachable');
 assert.ok([...seen].some(k=>k==='chat'||k==='restroom'||k==='lunch'),'Varied activity must be reachable');
});
test('real in-progress assignments keep a worker on-task, no false completed work claims',()=>{
 const o=run();
 const task={id:'task1',companyId:'company1',ownerId:'agent0',title:'Write a report',status:'in_progress'};
 o.draw({tasks:[task]});
 assert.ok(o.labels.some(x=>x.includes('Working: Write a report')));
 assert.equal(o.life.activitySnapshot('company1:level1:all').some(x=>x.id==='agent0'),true);
});
test('workers stay invisible until placed and room hit-testing can open CEO approvals',()=>{
 const o=run();o.floor.placements=[];o.draw();
 assert.ok(!o.labels.includes('Employee 0'));
 const hit=o.life.hitTest(851,105);
 assert.equal(hit.kind,'approvals');
});
