/* Office HQ: presentation-only living RPG scene.
   Runs only for manually placed workers (at most 10 per floor).
   Idle activities are simulated, never represented as real website or task execution. */
(()=>{
'use strict';
const W=960,H=584;
const DESKS=Array.from({length:10},(_,seat)=>({seat,x:112+(seat%5)*175,y:222+Math.floor(seat/5)*182}));
const ZONES={
 coffee:{x:467,y:130,label:'Getting coffee',bubble:'☕ Coffee break'},
 restroom:{x:700,y:133,label:'Restroom break',bubble:'🚻 Quick restroom break'},
 lunch:{x:242,y:130,label:'Taking lunch',bubble:'🍱 Lunch break'},
 ceo:{x:858,y:144,label:'At CEO office',bubble:'📋 Asking CEO for approval'}
};
const idleText=['Just checking in','Stretching a little','Ready for the next assignment','Reviewing my schedule','Standing by','Taking a short break'];
const stateByFloor=new Map();let lastHit=[];
const nowMs=()=>Date.now();
function rand(){return Math.random();}
function role(B,e){return e?(B.roleFor(e)?.title||'Office worker'):'Office worker';}
const show=(p,project)=>!project||p.projectId===project.id;
function rect(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x,y,w,h);}
function rounded(c,x,y,w,h,r,color){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
function text(c,v,x,y,size=11,color='#f0f4ea',align='center',weight=650){c.fillStyle=color;c.font=weight+' '+size+'px system-ui';c.textAlign=align;c.fillText(String(v),x,y);c.textAlign='left';}
function shorten(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}
function backdrop(c,name,projectName,department,head){
 rect(c,0,0,W,H,'#243c4a');
 for(let y=0;y<H;y+=27)for(let x=0;x<W;x+=27)rect(c,x+1,y+1,25,25,((x/27+y/27)|0)%2?'#2a4553':'#2d4b59');
 rounded(c,8,7,944,50,9,'#102c3b');
 text(c,'OFFICE HQ  /  LIVE RPG  /  '+shorten(name,28),24,28,15,'#e7f4ef','left',800);
 text(c,'10 DESKS MAX · SELECTED STAFF ONLY',24,46,10,'#91cfbe','left',700);
 text(c,shorten(projectName,22),930,34,12,'#e7c87d','right',750);
 // Four unmistakable shared office rooms with non-overlapping arrival points.
 rounded(c,20,70,313,96,9,'#193541');
 text(c,'BREAK ROOM  ·  LUNCH',175,89,12,'#f6dfab','center',750);
 rounded(c,99,108,43,22,4,'#957458');rounded(c,153,106,57,23,4,'#957458');
 rect(c,130,130,61,8,'#e2b97f');
 rounded(c,355,70,250,96,9,'#193541');
 text(c,'COFFEE STATION',481,89,12,'#f6dfab','center',750);
 rounded(c,427,102,67,39,4,'#446573');rect(c,438,110,22,18,'#171f28');rect(c,445,130,16,6,'#c3a97e');
 rounded(c,640,70,128,96,8,'#193541');
 text(c,'RESTROOM',704,90,11,'#f6dfab','center',740);
 rect(c,664,111,77,43,'#3c6070');text(c,'🚻',702,138,22,'#d2e8e6');
 rounded(c,786,70,166,111,9,'#244957');
 text(c,department==='Leadership'?'CEO OFFICE':'DEPARTMENT HEAD',869,91,department==='Leadership'?13:11,'#f4dc96','center',850);
 rect(c,808,119,108,28,'#936f52');rect(c,821,122,60,17,'#192e3c');
 text(c,department==='Leadership'?'CEO APPROVAL':'HEAD OFFICE',868,159,10,'#c3d9d3');
 text(c,shorten(head?.name||'Head office',24),869,174,10,'#f1dba3');
 // The CEO's own office is permanent, separate from the ten employee desk seats.
 sprite(c,{skin:'#b78360',hair:'#24313c',outfit:'#c8ae72'},855,119,0,'work');
 text(c,'CEO',885,113,10,'#f1dfb0','center',850);
 rounded(c,12,565,936,12,4,'#193440');
 // Ten reserved workstations remain present even when no agents are placed.
 for(const d of DESKS){
  rounded(c,d.x-75,d.y-44,145,109,8,'#294d5a');
  rect(c,d.x-57,d.y-35,114,38,'#987858');
  rect(c,d.x-53,d.y-33,106,5,'#c8a078');
  rounded(c,d.x-34,d.y-52,69,35,3,'#152938');
  rect(c,d.x-29,d.y-47,59,24,'#72c8c5');
  rect(c,d.x-13,d.y-19,24,4,'#182938');
  rounded(c,d.x-26,d.y+30,56,20,6,'#436572');
  text(c,'DESK '+(d.seat+1),d.x,d.y+61,11,'#c1d7d8');
 }
 lastHit.push({kind:department==='Leadership'?'approvals':'department-head',id:head?.id||null,x:786,y:70,w:166,h:111});
}
function sprite(c,e,x,y,t,mode){
 const actor=String(e.id||e.name||e.outfit||'worker');
 const phase=[...actor].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%17;
 const bob=mode==='work'?Math.sin(t/200+phase)*.8:Math.sin(t/185+phase)*2.3;
 c.save();c.translate(x,y+bob);
 // bigger than previous 16px torso, with an animated step/arm.
 const step=mode==='walk'?Math.sin(t/105+phase)*4:mode==='stretch'?4*Math.sin(t/260+phase):mode==='work'?Math.sin(t/310+phase)*1.2:0;
 rounded(c,-16,24,33,6,3,'#142d3970');
 rect(c,-11,5,9,17+step,'#263d49');rect(c,3,5,9,17-step,'#263d49');
 rect(c,-15,-25,30,34,e.outfit||'#78bdb2');
 rect(c,-17,-19,5,18+(mode==='stretch'?8:0),e.skin||'#bd8c69');
 rect(c,12,-19,5,18+(mode==='stretch'?8:0),e.skin||'#bd8c69');
 rounded(c,-14,-51,28,29,4,e.skin||'#bd8c69');
 rect(c,-15,-52,30,9,e.hair||'#28323b');
 rect(c,-10,-45,5,6,e.hair||'#28323b');
 rect(c,-8,-38,3,3,'#18313c');rect(c,5,-38,3,3,'#18313c');
 c.restore();
}
function wrapWords(value,max=25){
 // Keep full employee names and role titles readable, not abbreviated.
 const tokens=String(value||'').split(/\s+/).filter(Boolean),lines=[];let row='';
 for(let token of tokens){
  while(token.length>max){if(row){lines.push(row);row='';}lines.push(token.slice(0,max));token=token.slice(max);}
  if(!token)continue;
  if(row&&(row.length+1+token.length)>max){lines.push(row);row=token;}
  else row=row?row+' '+token:token;
 }
 if(row)lines.push(row);
 return lines.length?lines:[''];
}
function speech(c,p,one,two){
 const x=Math.max(87,Math.min(873,p.x));
 const y=Math.max(197,Math.min(500,p.y));
 const thoughtLines=wrapWords(one,26).slice(0,3);
 const thoughtHeight=13*thoughtLines.length+13;
 rounded(c,x-85,y-78-thoughtHeight,170,thoughtHeight,7,'#122d3dea');
 thoughtLines.forEach((line,i)=>text(c,line,x,y-76-thoughtHeight+15+i*13,10,'#f1dc9d'));
 const name=wrapWords(p.name,23),title=wrapWords(two,24);
 const rows=[...name.map(x=>({label:x,size:11,color:'#e8f5ec',weight:800})),...title.map(x=>({label:x,size:10,color:'#b3d8d2',weight:560}))];
 rounded(c,x-80,y+30,160,8+rows.length*13,5,'#122d3df0');
 rows.forEach((row,i)=>text(c,row.label,x,y+44+i*13,row.size,row.color,'center',row.weight));
}
function deskFor(seat){return DESKS[seat]||DESKS[0];}
function point(p){const d=deskFor(p.seat);return {x:d.x+24,y:d.y+23};}
function lerp(a,b,t){return a+(b-a)*Math.max(0,Math.min(1,t));}
function ease(v){return v*v*(3-2*v);}
function ensurePlan(key,placements){
 let state=stateByFloor.get(key);
 if(!state){state={next:0,activities:new Map(),cycle:0};stateByFloor.set(key,state);}
 const ids=new Set(placements.map(p=>p.employeeId));
 for(const id of state.activities.keys())if(!ids.has(id))state.activities.delete(id);
 for(const p of placements)if(!state.activities.has(p.employeeId))
  state.activities.set(p.employeeId,{kind:'desk',since:nowMs(),duration:2500+Math.floor(rand()*3700),target:null});
 // bound memory for workplaces viewed across the same session
 if(stateByFloor.size>70)stateByFloor.delete(stateByFloor.keys().next().value);
 return state;
}
function busyTask(tasks,p){return tasks.find(t=>t.ownerId===p.employeeId&&t.status==='in_progress');}
function needsCEO(approvals,p){return approvals.some(a=>a.status==='pending'&&a.companyId===p.companyId&&(a.employeeId===p.employeeId||a.requesterId===p.employeeId||a.taskId&&tasksByIdForApproval.get(a.taskId)===p.employeeId));}
// ephemeral mapping rebuilt each draw, no remote access.
let tasksByIdForApproval=new Map();
function planNext(group,placements,tasks,approvals,now){
 if(now<group.next)return;
 group.next=now+5800+rand()*2800;
 const eligible=placements.filter(p=>!busyTask(tasks,p));
 // Every visible worker has staggered individual idle actions.
 for(const p of eligible){const a=group.activities.get(p.employeeId);if(!a)continue;
  if(a.kind==='desk'||now<a.since+a.duration)continue;
  group.activities.set(p.employeeId,{kind:'desk',since:now,duration:5500+rand()*3500,target:null});
 }
 const moving=[...group.activities.values()].filter(a=>!['desk','stretch'].includes(a.kind)&&now<a.since+a.duration);
 // Never create crowds; a maximum of two people in transit/on breaks at once.
 const capacity=Math.max(0,2-moving.length);
 if(!capacity||!eligible.length)return;
 const available=eligible.filter(p=>{const a=group.activities.get(p.employeeId);return a.kind==='desk'&&now-a.since>1400;});
 if(!available.length)return;
 const picked=available[Math.floor(rand()*available.length)];
 const inUse=new Set([...group.activities.values()].filter(a=>a.kind!=='desk'&&a.kind!=='stretch'&&now<a.since+a.duration).map(a=>a.kind));
 let kind=needsCEO(approvals,picked)&&!inUse.has('ceo')?'ceo':null;
 const choices=['coffee','restroom','lunch','chat','stretch','stand'];
 if(!kind){
   for(let attempt=0;attempt<choices.length*2;attempt++){
    const tryKind=choices[Math.floor(rand()*choices.length)];
    if(tryKind==='chat'){
      const partner=available.find(p=>p.employeeId!==picked.employeeId&&p.seat!==picked.seat&&p.companyId===picked.companyId&&!inUse.has('chat'));
      if(!partner||capacity<2)continue;
      group.activities.set(partner.employeeId,{kind:'chat-host',since:now,duration:6900,partner:picked.employeeId,target:null});
      kind='chat';break;
    }
    if(!inUse.has(tryKind)){kind=tryKind;break;}
   }
 }
 if(!kind)kind='stretch';
 const partner=kind==='chat'?[...group.activities.entries()].find(([id,a])=>a.kind==='chat-host'&&a.partner===picked.employeeId)?.[0]:null;
 group.activities.set(picked.employeeId,{kind,since:now,duration:kind==='chat'?6900:kind==='stretch'?3800:kind==='stand'?3500:7000+rand()*3300,partner,target:null});
}
function activityPoint(p,a,group,placed,now){
 const from=point(p), elapsed=Math.max(0,now-a.since),duration=Math.max(1,a.duration);
 if(a.kind==='desk'||a.kind==='stand'||a.kind==='stretch'||a.kind==='chat-host'){
  return {x:from.x+(a.kind==='stand'?14:0),y:from.y-(a.kind==='stretch'?5:0),motion:a.kind==='stretch'?'stretch':'idle'};
 }
 let dest=ZONES[a.kind];
 if(a.kind==='chat'){
  const other=placed.find(p=>p.employeeId===a.partner);
  if(other){const to=point(other);dest={x:to.x-33,y:to.y-5};}
  else dest={...from};
 }
 const travel=Math.min(2300,duration*.28);
 const t=elapsed<travel?ease(elapsed/travel):elapsed>duration-travel?ease((duration-elapsed)/travel):1;
 return {x:lerp(from.x,dest.x,t),y:lerp(from.y,dest.y,t),motion:t>0&&t<1?'walk':'idle'};
}
function activityThought(a,p,placed,now){
 switch(a.kind){
  case 'coffee':return '☕ Grabbing coffee';
  case 'restroom':return '🚻 Restroom break';
  case 'lunch':return '🍱 Taking lunch';
  case 'chat':return '💬 Checking in with a coworker';
  case 'chat-host':return '💬 Chatting with a teammate';
  case 'ceo':return '📋 Asking CEO for approval';
  case 'stretch':return '🙆 Stretching by my desk';
  case 'stand':return '🚶 Standing at my desk';
  default:return idleText[(p.seat+Math.floor(now/12000))%idleText.length];
 }
}
function draw({c,now,cid,floor,project,handoff,staff,tasks,approvals,thoughts,B}){
 if(!floor)return;
 lastHit=[];
 const head=window.OfficeHQDepartments?.headFor(cid,floor.department);
 backdrop(c,floor.name,project?.name||'All placed workers',floor.department,head);
 const visible=(floor.placements||[]).filter(p=>show(p,project)&&staff.some(e=>e.id===p.employeeId));
 const mapped=visible.map(p=>({...p,companyId:cid}));
 const group=ensurePlan(cid+':'+floor.id+':'+(project?.id||'all'),mapped);
 tasksByIdForApproval=new Map(tasks.filter(t=>t.companyId===cid).map(t=>[t.id,t.ownerId]));
 planNext(group,mapped,tasks,approvals,nowMs());
 for(const p of mapped){
  const e=staff.find(x=>x.id===p.employeeId);if(!e)continue;
  const a=group.activities.get(p.employeeId)||{kind:'desk',since:nowMs(),duration:12000};
  const work=busyTask(tasks,p);
  const approval=approvals.some(q=>q.status==='pending'&&q.companyId===cid&&q.taskId&&tasksByIdForApproval.get(q.taskId)===p.employeeId);
  // A real task in progress overrides all leisure activity. CEO visit only represents a pending request.
  const status=work?{kind:'desk',since:nowMs(),duration:1}:a;
  const pos=activityPoint(p,status,group,mapped,nowMs());
  const thought=(work?thoughts?.[p.employeeId]:null)|| (work?'🖥 Working: '+(work.title||'assigned task'):approval&&a.kind==='ceo'?'📋 CEO approval requested':activityThought(status,p,mapped,now));
  const carrying=handoff?.cid===cid&&handoff.floorId===floor.id&&handoff.from===p.seat&&handoff.until&&nowMs()<handoff.until;
  if(!carrying)sprite(c,e,pos.x,pos.y,now,work?'work':pos.motion);
  speech(c,{...pos,name:e.name},carrying?'📁 Delivering paperwork':thought,role(B,e));
  lastHit.push({kind:'worker',id:p.employeeId,x:pos.x-40,y:pos.y-65,w:82,h:102});
 }
 if(floor.janitor){
  const x=877+Math.sin(now/950)*18,y=530;
  const jan={skin:'#bd8964',hair:'#2d3540',outfit:'#c9ac70'};
  sprite(c,jan,x,y,now,'walk');
  text(c,'JANITOR',x,y+37,10,'#eed08d');
  text(c,'🧹 Tidying this level',x,y-76,10,'#f6e3b4');
  rect(c,x+19,y-17,2,36,'#c8b992');
 }
 // Give a real linked-task handoff priority over idle motion (source/recipient only).
 if(handoff?.cid===cid&&handoff.floorId===floor.id&&handoff.until){
  const current=nowMs();
  if(current<handoff.until){
   const from=mapped.find(p=>p.seat===handoff.from),to=mapped.find(p=>p.seat===handoff.to);
   if(from&&to){
    const e=staff.find(x=>x.id===from.employeeId),a=point(from),b=point(to);
    const phase=1-(handoff.until-current)/6500;
    const t=phase<.44?ease(phase/.44):phase<.63?1:1-ease((phase-.63)/.37);
    const x=lerp(a.x,b.x,t),y=lerp(a.y,b.y,t);
    if(e){sprite(c,e,x,y,now,'walk');rect(c,x+16,y-17,15,17,'#f4e7cd');}
    if(phase>.44&&phase<.63)text(c,'📁 Handoff delivered',b.x,b.y-85,11,'#b4ebba');
   }
  }
 }
 const documentVisit=window.OfficeHQDepartments?.visitFor(floor.id);
 if(documentVisit){
  const elapsed=Date.now()-documentVisit.at;
  const source=mapped.find(p=>p.employeeId===documentVisit.employeeId),from=source?point(source):{x:800,y:535};
  const amt=Math.min(1,Math.max(0,elapsed/2800));
  const x=lerp(from.x,854,ease(amt)),y=lerp(from.y,145,ease(amt));
  rect(c,x-8,y-10,17,20,'#f0e1c2');text(c,'📁 Department handoff',x,y-22,10,'#f8e7b5');
 }
 if(!mapped.length){text(c,'Empty project floor — assign a worker to appear.',480,543,16,'#d9ece4','center',750);}
 lastHit.push({kind:floor.department==='Leadership'?'approvals':'department-head',id:head?.id||null,x:786,y:70,w:166,h:111});
}
function hitTest(x,y){return [...lastHit].reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h)||null;}
window.OfficeHQOfficeLife={draw,hitTest,DESKS,activityTypes:['desk','stretch','stand','coffee','restroom','lunch','chat','ceo'],activitySnapshot:key=>[...(stateByFloor.get(key)?.activities||new Map())].map(([id,a])=>({id,kind:a.kind,since:a.since}))};
})();
