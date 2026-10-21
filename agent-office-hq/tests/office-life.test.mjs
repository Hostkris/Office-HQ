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
 const staff=Array.from({length:15},(_,i)=>({id:'agent'+i,name:'Employee '+i,skin:'#b87957',hair:'#32303a',outfit:'#52baba'}));
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
 const o=run();assert.equal(o.life.DESKS.length,30);
 o.draw();
 assert.ok(o.labels.includes('CEO OFFICE'));assert.ok(o.labels.includes('APPROVAL DESK'));
 assert.ok(o.labels.includes('Employee 0'));
 assert.ok(o.labels.some(x=>x.includes('Customer Relations')));
 assert.ok(o.labels.some(l=>/Just checking|Stretching|Ready for|schedule|Standing|break/i.test(l)));
 assert.equal(o.life.activitySnapshot('company1:level1:all').length,15);
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
  assert.equal(snap.length,15);
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
 assert.ok(o.labels.some(x=>x.includes('Working: Write')));
 assert.equal(o.life.activitySnapshot('company1:level1:all').some(x=>x.id==='agent0'),true);
});
test('workers stay invisible until placed and room hit-testing can open CEO approvals',()=>{
 const o=run();o.floor.placements=[];o.draw();
 assert.ok(!o.labels.includes('Employee 0'));
 const hit=o.life.hitTest(1090,105);
 assert.equal(hit.kind,'approvals');
});

test('RPG characters use stable varied skin, hair and outfit colors, without changing while they animate',()=>{
 const o=run(),snap=o.staff.map(e=>o.life.appearance(e));
 assert.ok(new Set(snap.map(x=>x.skin)).size>=5,'visible staff should have varied skin tones');
 assert.ok(new Set(snap.map(x=>x.hair)).size>=4,'visible staff should have varied hair colors');
 assert.ok(new Set(snap.map(x=>x.outfit)).size>=5,'visible staff should wear different colors');
 const again=o.staff.map(e=>o.life.appearance(e));
 assert.deepEqual(snap.map(x=>x.skin),again.map(x=>x.skin));
 assert.deepEqual(snap.map(x=>x.hair),again.map(x=>x.hair));
 const custom=o.life.appearance({id:'custom',name:'Edited worker',skin:'#abc123',hair:'#000000',outfit:'#ffffff',appearanceLocked:true});
 assert.equal(custom.skin,'#abc123','explicit owner appearance settings remain untouched');
});

test('mini pixel renderer paints unique recognizable people, preserves owner colors and animates a real pose',()=>{
 const o=run(),a=o.life.appearance({id:'agent8',name:'Alex'}),b=o.life.appearance({id:'agent9',name:'Bea'});
 assert.equal(o.life.style,'original-mini-pixel');
 const colors=[],shapes=[];
 const c={save(){},restore(){},translate(){},fillRect(x,y,w,h){colors.push(this.fillStyle);shapes.push([x,y,w,h]);},set fillStyle(v){this._fill=v;},get fillStyle(){return this._fill;}};
 const unique=()=>{colors.length=0;shapes.length=0;};
 o.life.sprite(c,a,100,100,1000,'idle');assert.ok(shapes.length>28,'mini pixel details, not a five-rectangle block');
 assert.ok(colors.includes(a.skin)&&colors.includes(a.hair)&&colors.includes(a.outfit));
 assert.ok(shapes.every(([x,y,w,h])=>[x,y,w,h].every(Number.isInteger)),'2px pixel-grid aligned');
 const idle=shapes.map(v=>v.join(',')).join('|');unique();
 o.life.sprite(c,a,100,100,1300,'walk');const walking=shapes.map(v=>v.join(',')).join('|');
 assert.notEqual(idle,walking,'walking changes individual boot/arm animation');
 unique();o.life.sprite(c,b,100,100,1000,'idle');
 assert.ok(colors.includes(b.skin)&&colors.includes(b.hair)&&colors.includes(b.outfit));
 unique();
 const custom={id:'locked',skin:'#aabbcc',hair:'#223344',outfit:'#445566',appearanceLocked:true,hairStyle:'long'};
 o.life.sprite(c,custom,50,50,2000,'work');
 assert.ok(colors.includes(custom.skin)&&colors.includes(custom.hair)&&colors.includes(custom.outfit),'existing custom colors survive');
 assert.equal(custom.hairStyle,'long');
});
