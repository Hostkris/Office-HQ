/* Live RPG Project Floor — additive, scoped to the Office and command-center canvas.
   Empty-by-default stations; at most 10 manually selected employees per project level.
   A janitor is an optional non-agent visual helper on each level.
   Walking / folder transfers visualize actual saved assignment dependency transitions,
   never pretend a third-party website task has executed. */
(()=>{
'use strict';
const B=window.OfficeHQBridge, E=B?.E, $=s=>document.querySelector(s);
if(!B||!window.OfficeHQExtraViews)return;
const LIMIT=10,VERSION=1;
let hits=[],handoffs=[],lastDraw=0,lastScan=0,notice='',busy=false;
const cid=()=>$('#companyPicker')?.value==='all'||!$('#companyPicker')?.value?B.getState().companies[0]?.id:$('#companyPicker').value;
const employee=id=>B.getEmployee(id);
const role=e=>B.roleFor(e)||{};
const active=companyId=>B.getState().employees.filter(e=>e.companyId===companyId&&e.active);
const label=e=>e.name+' — '+(role(e).title||role(e).dept||'Staff');
const date=()=>new Date().toISOString();
const statuses=['queued','in_progress','review','blocked','done','cancelled'];
const protectedScopes=new Set(['accounts_payable','purchasing','paid_advertising','contract_review','legal_strategy','tax_preparation','corporate_strategy','finance_strategy']);
const blankLevel=()=>({workers:Array(LIMIT).fill(null),janitor:false});
function snapshotTasks(companyId){
 const signatures={};
 for(const t of B.getState().tasks.filter(t=>t.companyId===companyId)){
  signatures[t.id]=(t.ownerId||'')+'|'+t.status;
 }
 return signatures;
}
function ensure(companyId){
 if(!companyId)return null;
 const state=B.getState();
 state.enterprise??={};
 state.enterprise.projectFloor??={version:VERSION,companies:{}};
 const all=state.enterprise.projectFloor;
 all.companies??={};
 if(!all.companies[companyId]){
  const first={id:B.uid('pfproject'),name:'General assignments',companyId,levels:[blankLevel()],currentLevel:0,createdAt:date()};
  all.companies[companyId]={projects:[first],activeProjectId:first.id,taskSnapshot:snapshotTasks(companyId)};
  B.save();
 }
 const data=all.companies[companyId];
 if(!Array.isArray(data.projects)||!data.projects.length){
  data.projects=[{id:B.uid('pfproject'),name:'General assignments',companyId,levels:[blankLevel()],currentLevel:0}];
  data.activeProjectId=data.projects[0].id;
 }
 if(!data.taskSnapshot||typeof data.taskSnapshot!=='object')data.taskSnapshot=snapshotTasks(companyId);
 for(const p of data.projects){
  if(!Array.isArray(p.levels)||!p.levels.length)p.levels=[blankLevel()];
  for(const floor of p.levels){
   if(!Array.isArray(floor.workers))floor.workers=Array(LIMIT).fill(null);
   floor.workers=floor.workers.slice(0,LIMIT);
   while(floor.workers.length<LIMIT)floor.workers.push(null);
   floor.janitor=Boolean(floor.janitor);
  }
  p.currentLevel=Math.max(0,Math.min(p.levels.length-1,Number(p.currentLevel)||0));
 }
 if(!data.projects.some(p=>p.id===data.activeProjectId))data.activeProjectId=data.projects[0].id;
 return data;
}
const project=(data)=>data?.projects.find(p=>p.id===data.activeProjectId)||data?.projects[0];
const level=p=>p?.levels[p.currentLevel];
const count=fl=>fl?.workers.filter(Boolean).length||0;
function placed(projectId,workerId,data){
 const p=data?.projects.find(x=>x.id===projectId);
 if(!p)return null;
 for(let i=0;i<p.levels.length;i++){const desk=p.levels[i].workers.indexOf(workerId);if(desk>=0)return {level:i,desk};}
 return null;
}
function persist(message){
 B.save();if(message)notice=message;
 if($('#officeCanvas'))B.setView('office');
}
function place(p,e,preferredDesk=null,preferredFloor=null,auto=false){
 if(!e?.active||e.companyId!==p.companyId)throw Error('Select an active employee who belongs to this company.');
 const old=placed(p.id,e.id,{projects:[p]});
 if(old){
  if(preferredDesk===null)return old;
  if(old.level===preferredFloor&&old.desk===preferredDesk)return old;
 }
 let destFloor=preferredFloor===null?p.currentLevel:preferredFloor;
 let destDesk=preferredDesk;
 if(preferredDesk===null){
  destDesk=p.levels[destFloor]?.workers.indexOf(null)??-1;
  if(destDesk<0){
   if(!auto)throw Error('This level already has 10 workers. Choose another level or add one.');
   destFloor=p.levels.findIndex(x=>x.workers.includes(null));
   if(destFloor<0){p.levels.push(blankLevel());destFloor=p.levels.length-1;}
   destDesk=p.levels[destFloor].workers.indexOf(null);
  }
 }
 if(destFloor<0||destFloor>=p.levels.length||!Number.isInteger(destDesk)||destDesk<0||destDesk>=LIMIT)
  throw Error('Choose a valid level and one of the 10 desks.');
 const occupant=p.levels[destFloor].workers[destDesk];
 if(occupant&&occupant!==e.id)throw Error('That desk is occupied. Remove that worker or pick an empty desk.');
 if(old)p.levels[old.level].workers[old.desk]=null;
 p.levels[destFloor].workers[destDesk]=e.id;
 return {level:destFloor,desk:destDesk};
}
function unplace(p,workerId){
 const old=placed(p.id,workerId,{projects:[p]});
 if(!old)return false;
 p.levels[old.level].workers[old.desk]=null;
 handoffs=handoffs.filter(h=>h.projectId!==p.id||h.from!==workerId&&h.to!==workerId);
 return true;
}
function addProject(data,name){
 const title=String(name||'').trim();
 if(title.length<2||title.length>90)throw Error('Enter a project name between 2 and 90 characters.');
 if(data.projects.some(p=>p.name.toLowerCase()===title.toLowerCase()))throw Error('That project name already exists.');
 const p={id:B.uid('pfproject'),name:title,companyId:cid(),levels:[blankLevel()],currentLevel:0,createdAt:date()};
 data.projects.push(p);data.activeProjectId=p.id;
 return p;
}
function taskFrom(e,title,description,projectId,dependsOn){
 const name=String(title||'').trim(),body=String(description||'').trim();
 if(name.length<4||name.length>120)throw Error('Enter a task name between 4 and 120 characters.');
 if(body.length>1500)throw Error('Task instructions must be 1,500 characters or fewer.');
 const r=role(e);
 if(!r.scope)throw Error('This worker does not have an exclusive task specialty.');
 const t={id:B.uid('task'),companyId:e.companyId,title:name,description:body,
  scope:r.scope,ownerId:e.id,projectId,delegatedBy:'owner',status:'queued',priority:'Medium',
  due:new Date().toLocaleDateString('en-CA'),createdAt:date(),updatedAt:date(),output:'',
  requiresApproval:protectedScopes.has(r.scope),approvalId:null};
 if(dependsOn)t.dependsOn=dependsOn;
 B.getState().tasks.unshift(t);
 return t;
}
function recordHandoff(parent,child){
 if(!parent||!child||parent.ownerId===child.ownerId)return;
 const data=ensure(parent.companyId);
 for(const p of data.projects){
  if(!p.levels.some(fl=>fl.workers.includes(parent.ownerId))||!p.levels.some(fl=>fl.workers.includes(child.ownerId)))continue;
  const source=placed(p.id,parent.ownerId,{projects:[p]});
  const target=placed(p.id,child.ownerId,{projects:[p]});
  if(source?.level!==target?.level)continue;
  handoffs.push({projectId:p.id,level:source.level,from:parent.ownerId,to:child.ownerId,started:performance.now(),duration:3600});
  handoffs=handoffs.slice(-8);
 }
}
function scanCompany(companyId){
 const data=ensure(companyId);
 if(!data)return false;
 let changed=false;
 for(const t of B.getState().tasks.filter(t=>t.companyId===companyId)){
  const signature=(t.ownerId||'')+'|'+t.status;
  const previous=data.taskSnapshot[t.id];
  if(previous===signature)continue;
  data.taskSnapshot[t.id]=signature;
  changed=true;
  if(previous===undefined||previous.split('|')[0]!==t.ownerId){
   const e=employee(t.ownerId);
   if(e?.active&&e.companyId===companyId&&t.status!=='done'){
    // Show the specifically assigned employee, not the entire roster.
    const p=data.projects.find(p=>p.id===t.projectId)||project(data);
    const old=placed(p.id,e.id,data);
    if(!old){try{const spot=place(p,e,null,null,true);p.currentLevel=spot.level;}catch{}}
   }
  }
  if(t.status==='done'&&previous&&previous.split('|')[1]!=='done'){
   for(const child of B.getState().tasks.filter(x=>x.companyId===companyId&&x.dependsOn===t.id)){
    recordHandoff(t,child);
   }
  }
 }
 if(changed){B.save();}
 return changed;
}
function scanAll(){
 let changed=false;
 for(const c of B.getState().companies)if(scanCompany(c.id))changed=true;
 return changed;
}
function rowWorkerOptions(companyId,selected=''){
 return active(companyId).map(e=>'<option value="'+E(e.id)+'"'+(selected===e.id?' selected':'')+'>'+E(label(e))+'</option>').join('');
}
function renderOffice(){
 const data=ensure(cid());if(!data)return '<section class="card">Create a company to open the project floor.</section>';
 const p=project(data),fl=level(p),n=count(fl);
 const assigned=p.levels.flatMap((x,li)=>x.workers.map((id,di)=>id?{id,li,di}:null).filter(Boolean));
 const available=active(cid()),free=Array.from({length:LIMIT},(_,i)=>i);
 const projectOptions=data.projects.map(x=>'<option value="'+E(x.id)+'"'+(x.id===p.id?' selected':'')+'>'+E(x.name)+'</option>').join('');
 const selectedTasks=B.getState().tasks.filter(t=>t.companyId===cid()&&(t.projectId===p.id||p.levels.some(l=>l.workers.includes(t.ownerId)))).slice(0,60);
 const doneTasks=selectedTasks.filter(t=>t.status==='done');
 const existingTitle=doneTasks.map(t=>'<option value="'+E(t.id)+'">'+E(t.title.slice(0,72))+'</option>').join('');
 const members=p.levels.flatMap(l=>l.workers).filter(Boolean);
 const memberOptions=members.map(id=>{const e=employee(id);return e?'<option value="'+E(id)+'">'+E(label(e))+'</option>':''}).join('');
 return '<div class="page-head"><div><div class="eyebrow">LIVE RPG OFFICE · SELECTED PROJECTS ONLY</div><h1>Live project office</h1>'+
 '<p class="subtitle">Your desks are empty until you place employees or assign them new work. Only selected workers appear. Each level has a maximum of 10 workers and its own optional janitor.</p></div>'+
 '<div class="head-actions"><button type="button" class="btn" data-action="newTask">＋ Standard assignment</button><button type="button" class="btn" data-action="runQueue">▶ Run queue</button></div></div>'+
 '<div class="pf-toolbar card"><label>Project<select id="pfProject">'+projectOptions+'</select></label>'+
 '<label>New project<input id="pfNewName" maxlength="90" placeholder="e.g. Fall product launch"></label>'+
 '<button type="button" class="btn btn-sm btn-primary" data-pf="new-project">＋ Create project</button>'+
 '<span class="pill-stat">'+E(data.projects.length)+' projects</span></div>'+
 '<div class="pf-layout"><section class="card pf-floor-panel"><div class="section-top"><div><h2>'+E(p.name)+'</h2>'+
 '<p class="muted small">Level '+(p.currentLevel+1)+' of '+p.levels.length+' · '+n+' / 10 assigned desks</p></div>'+
 '<div class="inline-actions"><button type="button" class="btn btn-sm" data-pf="prev" '+(p.currentLevel===0?'disabled':'')+'>← Level</button>'+
 '<button type="button" class="btn btn-sm" data-pf="next" '+(p.currentLevel===p.levels.length-1?'disabled':'')+'>Next →</button>'+
 '<button type="button" class="btn btn-sm" data-pf="add-level">＋ Level</button></div></div>'+
 '<div class="office-box pf-canvas-wrap"><canvas class="office-canvas" id="officeCanvas" width="960" height="436" role="img" aria-label="Live RPG office: up to ten worker desks per level. Select a worker below or tap an occupied desk."></canvas></div>'+
 '<div class="pf-floor-meta"><span>▣ '+n+' of 10 worker positions filled</span><label class="pf-janitor"><input type="checkbox" id="pfJanitor" '+(fl.janitor?'checked':'')+'> 🧹 Show janitor on this level</label></div>'+
 '<p class="tiny muted">The janitor is a separately optional visual facilities character, not an AI employee or one of the ten worker slots. No random wandering; paperwork animations follow real internal task handoffs.</p>'+
 '<div class="pf-worker-list">'+(fl.workers.some(Boolean)?fl.workers.map((id,i)=>{
  const e=employee(id);return e?'<div class="pf-worker-row"><button class="btn btn-sm" data-pf="inspect" data-worker="'+E(id)+'">Desk '+(i+1)+' · '+E(e.name)+' · '+E(role(e).title)+'</button><button type="button" class="btn btn-sm" data-pf="remove" data-worker="'+E(id)+'" aria-label="Remove '+E(e.name)+' from this project">Remove</button></div>':'';
 }).join(''):'<p class="muted small">All desks are empty. Assign a worker below to make them appear in the live RPG office.</p>')+'</div></section>'+
 '<section class="card pf-control-panel"><h2>Choose your project team</h2>'+
 '<p class="muted small">Pick who appears here. The full company roster remains available elsewhere but stays invisible on this floor.</p>'+
 '<label>Employee<select id="pfEmployee"><option value="">Choose employee</option>'+rowWorkerOptions(cid())+'</select></label>'+
 '<label>Desk on level '+(p.currentLevel+1)+'<select id="pfDesk">'+free.map(i=>'<option value="'+i+'"'+(fl.workers[i]?' disabled':'')+'>Desk '+(i+1)+(fl.workers[i]?' · Occupied':' · Available')+'</option>').join('')+'</select></label>'+
 '<button type="button" class="btn btn-primary" data-pf="place">＋ Place employee at desk</button>'+
 '<div class="pf-divider"></div><h3>Assign a task and show the employee</h3>'+
 '<p class="tiny muted">This creates a standard Office HQ task with the selected employee’s exclusive job scope. It does not start an external website automation.</p>'+
 '<label>Responsible employee<select id="pfTaskWorker"><option value="">Choose task owner</option>'+rowWorkerOptions(cid())+'</select></label>'+
 '<label>Task name<input id="pfTaskName" maxlength="120" placeholder="e.g. Prepare October campaign plan"></label>'+
 '<label>Instructions<textarea id="pfTaskDetails" maxlength="1500" placeholder="Describe what this worker should deliver."></textarea></label>'+
 '<button type="button" class="btn btn-primary" data-pf="assign">＋ Assign task and show worker</button>'+
 '<div class="pf-divider"></div><h3>Paperwork handoff</h3>'+
 '<p class="tiny muted">When one project task is marked done, the assigned follow-up worker receives the work. The animation is only a visual representation of that recorded handoff.</p>'+
 '<label>Completed task<select id="pfSourceTask"><option value="">Choose completed task</option>'+existingTitle+'</select></label>'+
 '<label>Next employee<select id="pfHandoffWorker"><option value="">Choose selected project member</option>'+memberOptions+'</select></label>'+
 '<label>Next assignment<input id="pfHandoffTitle" maxlength="120" placeholder="Next step for teammate"></label>'+
 '<button type="button" class="btn" data-pf="handoff">⇥ Hand off paperwork</button></section></div>'+
 '<p id="pfNotice" role="status" aria-live="polite" class="notice">'+E(notice)+'</p>';
}
function ctxUtil(ctx){
 const rect=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
 const round=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
 const text=(value,x,y,size,color,align='left',weight=650)=>{ctx.fillStyle=color;ctx.font=weight+' '+size+'px system-ui';ctx.textAlign=align;ctx.fillText(String(value),x,y);ctx.textAlign='left';};
 return {rect,round,text};
}
const point=desk=>({x:104+(desk%5)*187,y:166+Math.floor(desk/5)*155});
function ease(t){return t*t*(3-2*t);}
function drawTinyPerson(ctx,x,y,e,walking=false,folder=false){
 const {rect,round}=ctxUtil(ctx),scale=.69;
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
 round(-10,18,21,5,3,'#09202c77');
 rect(-7,0,14,17,e.outfit||'#4e9398');rect(-8,-2,16,4,'#263b4c');
 rect(-6,17,5,7,'#304250');rect(1,17,5,7,'#304250');
 rect(-9,1,3,11,e.skin||'#c98a6a');rect(6,1,3,11,e.skin||'#c98a6a');
 round(-8,-14,16,15,3,e.skin||'#c98a6a');rect(-9,-17,18,5,e.hair||'#21343f');
 rect(-4,-9,2,2,'#1e3038');rect(3,-9,2,2,'#1e3038');
 if(folder){round(8,7,12,9,1,'#f6dba1');rect(7,8,9,2,'#c48c4f');}
 if(walking){rect(-6,21,5,5,'#1b3446');}
 ctx.restore();
}
function drawFloor(canvas,{view,companyId}){
 const ctx=canvas.getContext('2d');if(!ctx)return false;
 const data=ensure(companyId);if(!data)return false;
 const p=project(data),fl=level(p),now=performance.now();
 const {rect,round,text}=ctxUtil(ctx);
 ctx.clearRect(0,0,960,436);
 rect(0,0,960,436,'#213b47');
 for(let y=0;y<436;y+=28)for(let x=0;x<960;x+=28)rect(x+1,y+1,26,26,(Math.floor(x/28)+Math.floor(y/28))%2?'#294653':'#2c4955');
 round(12,10,936,62,11,'#18313e');
 text('PROJECT FLOOR  /  '+p.name.toUpperCase().slice(0,42),29,35,14,'#e4f6f1','left',800);
 text('LEVEL '+(p.currentLevel+1)+' / '+p.levels.length+'   ·   '+count(fl)+' OF 10 SELECTED WORKERS',29,55,10,'#89d8cb','left',700);
 round(730,21,204,32,7,'#34515c');text('PRIVATE TEAM VIEW',832,42,11,'#eacd80','center',800);
 // Ten desks always visible and orderly, even when no employee was selected.
 for(let desk=0;desk<LIMIT;desk++){
  const at=point(desk),occupied=fl.workers[desk],x=at.x,y=at.y;
  round(x-74,y-40,146,100,9,'#294752');
  round(x-55,y-28,110,38,6,'#997b60');
  round(x-44,y-23,86,7,2,'#d7b38c');
  round(x-8,y-42,42,27,3,'#162f40');
  round(x-4,y-38,34,19,2,occupied?'#5abdb1':'#416d7a');
  rect(x+10,y-15,6,8,'#152733');round(x+2,y-8,24,3,2,'#182c36');
  round(x-26,y+19,52,20,7,'#41616c');round(x-20,y+15,40,8,3,'#607d86');
  text('DESK '+(desk+1),x,y+53,10,'#b5d5d2','center',650);
 }
 // Clear hallway and optional janitor at edge. The janitor is not an AI worker.
 round(18,238,924,16,5,'#45626c');
 round(760,403,175,23,7,'#18303a');
 text('NO RANDOM WANDERING',848,418,9,'#e9d092','center',700);
 hits=[];
 fl.workers.forEach((id,desk)=>{
  const e=employee(id);if(!e)return;
  const at=point(desk),x=at.x,y=at.y;
  const traveling=handoffs.some(h=>h.projectId===p.id&&h.level===p.currentLevel&&h.from===id&&now-h.started<h.duration);
  if(!traveling)drawTinyPerson(ctx,x-23,y+5,e,false,false);
  const state=B.getState(),work=state.tasks.filter(t=>t.ownerId===id&&t.status!=='done');
  const inProgress=work.find(t=>t.status==='in_progress')||work[0];
  const live=window.OfficeHQDesktopThoughts?.[id];
  const labelText=live?String(live):inProgress?inProgress.status==='in_progress'?'▶ '+inProgress.title:'• '+inProgress.title:'Ready for tasks';
  round(x-65,y-94,131,26,7,'#17313d');
  text(labelText.length>22?labelText.slice(0,20)+'…':labelText,x,y-77,9,inProgress?'#edd294':'#a1c9c6','center',700);
  round(x-64,y+59,130,18,4,'#142e39');
  text(e.name.length>20?e.name.slice(0,18)+'…':e.name,x,y+71,9,'#e5f2ef','center',700);
  hits.push({id,x:x-69,y:y-90,w:138,h:166});
 });
 if(fl.janitor){
  round(14,378,106,46,8,'#395863');
  text('JANITOR',68,414,9,'#e5dfaf','center',750);
  drawTinyPerson(ctx,40,389,{outfit:'#7ea487',skin:'#c79673',hair:'#45515d'});
  rect(51,390,3,29,'#cda663');round(50,416,19,5,1,'#e5d6a6');
 }
 // Animate only real task dependency handoffs on this specific project floor.
 handoffs=handoffs.filter(h=>now-h.started<h.duration);
 for(const h of handoffs){
  if(h.projectId!==p.id||h.level!==p.currentLevel)continue;
  const a=fl.workers.indexOf(h.from),b=fl.workers.indexOf(h.to);
  if(a<0||b<0)continue;
  const t=(now-h.started)/h.duration;
  const origin=point(a),dest=point(b);
  const a0={x:origin.x-23,y:origin.y+5},b0={x:dest.x-23,y:dest.y+5};
  const travel=t<.43?ease(t/.43):t<.60?1:t<1?1-ease((t-.60)/.40):0;
  const cx=a0.x+(b0.x-a0.x)*travel,cy=a0.y+(b0.y-a0.y)*travel-20*Math.sin(Math.PI*travel);
  const source=employee(h.from);
  if(source)drawTinyPerson(ctx,cx,cy,source,travel>0&&travel<1,t<.60);
  if(t>.41&&t<.68){round(b0.x-37,b0.y-37,75,18,6,'#d6aa64');text('FILE RECEIVED',b0.x,b0.y-25,8,'#203640','center',750);}
 }
 if(count(fl)===0){
  round(252,259,456,44,9,'#193541dd');
  text('EMPTY PROJECT FLOOR · ASSIGN WORKERS TO PLACE THEM',480,287,12,'#b5d9d4','center',750);
 }
 if(!handoffs.some(h=>h.projectId===p.id&&h.level===p.currentLevel))text('Tap an occupied workstation to inspect its employee',480,431,10,'#b9d2d1','center',600);
}
function startOffice(canvas,{companyId}={}){
 if(!canvas)return false;
 const company=companyId||cid();
 const ctx=canvas.getContext('2d');if(!ctx)return true;
 // Independent animation for only the current canvas; old requestAnimationFrame loop returns.
 let handle=0,previous=0;
 function animate(now){
  if(!canvas.isConnected){cancelAnimationFrame(handle);return;}
  if(now-previous>=100){drawFloor(canvas,{companyId:company});previous=now;}
  handle=requestAnimationFrame(animate);
 }
 handle=requestAnimationFrame(animate);
 canvas.onclick=event=>{
  const rect=canvas.getBoundingClientRect();
  const x=(event.clientX-rect.left)*960/rect.width,y=(event.clientY-rect.top)*436/rect.height;
  const found=[...hits].reverse().find(item=>x>=item.x&&x<=item.x+item.w&&y>=item.y&&y<=item.y+item.h);
  if(found){B.setView('office');const e=employee(found.id);if(e)B.openModal(e.name,'<p>'+E(role(e).title)+' · '+E(role(e).dept)+'</p><button class="btn btn-primary" data-action="inspectEmployee" data-id="'+E(e.id)+'">View full employee profile &amp; assignments</button>');}
 };
 return true;
}
async function action(cmd,node){
 if(busy)return;busy=true;
 try{
  const data=ensure(cid()),p=project(data),fl=level(p);
  if(cmd==='new-project'){
   const name=$('#pfNewName')?.value;addProject(data,name);
   B.addActivity('CEO','Created a new project floor: '+name,'change',cid());
   persist('Project created. All ten desks start empty.');return;
  }
  if(cmd==='prev'||cmd==='next'||cmd==='add-level'){
   if(cmd==='add-level'){p.levels.push(blankLevel());p.currentLevel=p.levels.length-1;}
   else p.currentLevel=Math.max(0,Math.min(p.levels.length-1,p.currentLevel+(cmd==='next'?1:-1)));
   persist('Viewing level '+(p.currentLevel+1)+'.');return;
  }
  if(cmd==='place'){
   const selected=$('#pfEmployee')?.value,desk=Number($('#pfDesk')?.value);
   const e=employee(selected);
   if(!e)throw Error('Choose which employee should appear at a desk.');
   place(p,e,desk,p.currentLevel);
   B.addActivity('CEO','Placed '+e.name+' at '+p.name+' Level '+(p.currentLevel+1)+' Desk '+(desk+1),'change',cid());
   persist(e.name+' was placed at Desk '+(desk+1)+'.');return;
  }
  if(cmd==='remove'){
   const e=employee(node.dataset.worker);
   if(!e||!unplace(p,e.id))throw Error('This employee is not placed on this project.');
   B.addActivity('CEO','Removed '+e.name+' from '+p.name+' RPG floor','change',cid());
   persist(e.name+' removed from the project floor. Their other assignments remain unchanged.');return;
  }
  if(cmd==='inspect'){const e=employee(node.dataset.worker);if(e)B.openModal(e.name,'<p>'+E(role(e).title)+'</p><button class="btn btn-primary" data-action="inspectEmployee" data-id="'+E(e.id)+'">Open full employee profile</button>');return;}
  if(cmd==='assign'){
   const e=employee($('#pfTaskWorker')?.value);
   if(!e)throw Error('Select the employee responsible for the assignment.');
   const t=taskFrom(e,$('#pfTaskName')?.value,$('#pfTaskDetails')?.value,p.id);
   const spot=place(p,e,null,null,true);
   data.taskSnapshot[t.id]=(t.ownerId||'')+'|'+t.status;
   B.addActivity('CEO','Assigned '+t.title+' to '+e.name+' in '+p.name,'task',cid());
   persist('Assigned '+t.title+' to '+e.name+'. Worker appears on Level '+(spot.level+1)+'.');return;
  }
  if(cmd==='handoff'){
   const parent=B.getState().tasks.find(t=>t.id===$('#pfSourceTask')?.value&&t.companyId===cid()&&t.status==='done');
   const e=employee($('#pfHandoffWorker')?.value);
   if(!parent)throw Error('Select a completed project assignment.');
   if(!e||!p.levels.some(fl=>fl.workers.includes(e.id)))throw Error('Choose a project member already placed at a desk.');
   if(parent.ownerId===e.id)throw Error('Choose a different employee to receive the handoff.');
   const t=taskFrom(e,$('#pfHandoffTitle')?.value,'Continue the deliverable from '+parent.title+'. Prior saved result: '+String(parent.output||'').slice(0,850),p.id,parent.id);
   data.taskSnapshot[t.id]=(t.ownerId||'')+'|'+t.status;
   recordHandoff(parent,t);
   B.addActivity('CEO','Created handoff from '+employee(parent.ownerId)?.name+' to '+e.name+' for '+t.title,'task',cid());
   persist('Handoff created. Animation plays when both employees are on the same level.');return;
  }
 }catch(e){notice=String(e.message||'Something went wrong.');const out=$('#pfNotice');if(out){out.textContent=notice;out.style.color='var(--red)';}else B.toast(notice,'error');}
 finally{busy=false;}
}
document.addEventListener('click',event=>{
 const target=event.target.closest('[data-pf]');if(!target)return;
 event.preventDefault();void action(target.dataset.pf,target);
});
document.addEventListener('change',event=>{
 if(event.target.id==='pfProject'){
  const d=ensure(cid());if(d.projects.some(p=>p.id===event.target.value)){d.activeProjectId=event.target.value;persist('Project view changed.');}
 }
 if(event.target.id==='pfJanitor'){
  const p=project(ensure(cid()));level(p).janitor=event.target.checked;
  persist(event.target.checked?'Janitor placed on this level.':'Janitor removed from this level.');
 }
});
window.OfficeHQProjectFloor={startOffice,renderOffice,ensure,scanAll,place,unplace,addProject,taskFrom,recordHandoff,limit:LIMIT};
window.OfficeHQExtraViews.office=renderOffice;
// Establish baseline for existing sample tasks, without populating the office.
for(const c of B.getState().companies)ensure(c.id);
setInterval(()=>{
 const changed=scanAll();
 if(changed&&location.hash==='#/office'&&!document.querySelector('.modal-backdrop'))B.setView('office');
},1100);
if(['office','command'].includes(location.hash.replace('#/','')))B.setView(location.hash.replace('#/',''));
})();