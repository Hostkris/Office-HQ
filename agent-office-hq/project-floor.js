/* Live RPG Office: owner-controlled 30-desk levels, project groups, janitor and verified handoffs.
   Visual status does not imply real third-party account actions. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;if(!B)return;
const E=B.E,$=s=>document.querySelector(s),state=()=>B.getState();
const LIMIT=30;
const INITIAL_WORKERS=15;
const CANVAS_W=1240,CANVAS_H=1135;
let raf=0,scene=null,lastProject='',handoff=null,delay=0,ctx=null;
const clamp=(v,n=130)=>String(v??'').slice(0,n);
const sceneColor=color=>window.OfficeHQTheme?.sceneColor?.(color)??color;
const SCENE_OPTIONS=Object.freeze([['classic','🏢 Classic office'],['western','🤠 Western desert'],['mountain-sunrise','🌄 Mountain sunrise'],['mountain-sunset','🌇 Mountain sunset']]);
function sceneFor(cid=inCompany()){const choice=data().scenes?.[cid];return SCENE_OPTIONS.some(([id])=>id===choice)?choice:'classic';}
function setScene(cid,choice){if(!cid||!SCENE_OPTIONS.some(([id])=>id===choice))return false;const d=data();d.scenes??={};d.scenes[cid]=choice;save();return true;}
function sceneChoices(cid){return SCENE_OPTIONS.map(([id,label])=>'<option value="'+E(id)+'"'+(sceneFor(cid)===id?' selected':'')+'>'+E(label)+'</option>').join('');}
const role=e=>e?(B.roleFor(e)||{}):{};
const inCompany=()=>{const v=$('#companyPicker')?.value;return v&&v!=='all'?v:state().companies[0]?.id};
const companyStaff=cid=>state().employees.filter(e=>e.companyId===cid&&e.active);
const eligibleFor=(floor,worker)=>!!worker&&(!floor?.department||role(worker).dept===floor.department);
const departmentLabel=floor=>window.OfficeHQDepartments?.DEPTS?.find(d=>d.id===floor?.department)?.name||floor?.department||'this level';
const allTasks=cid=>state().tasks.filter(t=>t.companyId===cid);
const time=()=>new Date().toISOString();
function data(){
 const s=state();s.enterprise??={};let d=s.enterprise.projectFloor;
 if(!d||!Array.isArray(d.floors)||!Array.isArray(d.projects)||typeof d.selected!=='object'||!d.selected)
   s.enterprise.projectFloor=d={floors:[],projects:[],selected:{}};
 return d;
}
function setup(cid){
 const d=data();if(!cid)return {floor:null,project:null,d};
 let floors=d.floors.filter(f=>f.companyId===cid);
 if(!floors.length){
  const f={id:B.uid('floor'),companyId:cid,name:'Level 1',placements:[],janitor:false,createdAt:time()};
  d.floors.push(f);floors=[f];B.save();
 }
 window.OfficeHQDepartments?.ensure(cid,d);
 floors=d.floors.filter(f=>f.companyId===cid);
 const chosen=d.selected[cid]||{};
 const existingPlacements=floors.some(f=>(f.placements||[]).length>0);
 // New workspaces begin with an Operations team, where fifteen matching workers exist.
 const initial=floors.find(f=>f.department==='Operations')||floors[0];
 const floor=floors.find(f=>f.id===chosen.floorId)||(existingPlacements?floors[0]:initial);
 d.selected[cid]={floorId:floor.id,projectId:chosen.projectId||'all'};
 // One-time welcome population from real company employees; never refill after
 // the owner removes anyone. Existing placements and tasks are preserved.
 d.initialPopulation??={};
 if(!Object.prototype.hasOwnProperty.call(d.initialPopulation,cid)){
  const existing=new Set(floors.flatMap(f=>(f.placements||[]).map(p=>p.employeeId)));
  const pool=companyStaff(cid).filter(e=>e.roleKey!=='ceo'&&eligibleFor(floor,e)&&!existing.has(e.id));
  const needed=Math.max(0,Math.min(INITIAL_WORKERS-(floor.placements||[]).length,LIMIT-(floor.placements||[]).length));
  for(const worker of pool.slice(0,needed)){
   const seat=Array.from({length:LIMIT},(_,i)=>i).find(i=>!(floor.placements||[]).some(p=>p.seat===i));
   if(seat===undefined)break;
   floor.placements.push({seat,employeeId:worker.id,projectId:null,taskId:null,placedAt:time(),demoPresence:true});
  }
  d.initialPopulation[cid]=true;
  d.selected[cid]={floorId:floor.id,projectId:'all'};
  B.save();
 }
 floor.placements=Array.isArray(floor.placements)?floor.placements.filter(p=>p&&p.employeeId&&Number.isInteger(p.seat)&&p.seat>=0&&p.seat<LIMIT).slice(0,LIMIT):[];
 const ids=new Set(),seats=new Set();
 floor.placements=floor.placements.filter(p=>{if(ids.has(p.employeeId)||seats.has(p.seat))return false;ids.add(p.employeeId);seats.add(p.seat);return true;});
 return {floor,project:d.projects.find(p=>p.id===d.selected[cid].projectId&&p.companyId===cid)||null,d};
}
const floorsFor=cid=>data().floors.filter(f=>f.companyId===cid);
const projectsFor=cid=>data().projects.filter(p=>p.companyId===cid);
function selected(cid){const x=setup(cid);return x.d.selected[cid]||{};}
function seatList(floor){return Array.from({length:LIMIT},(_,i)=>({seat:i,placement:floor?.placements.find(p=>p.seat===i)}));}
function coords(seat){return {x:130+(seat%6)*200,y:289+Math.floor(seat/6)*182};}
function currentFor(cid){const {floor,project}=setup(cid);return {floor,project,select:selected(cid)};}
function display(placement,proj){return !proj||placement.projectId===proj.id;}
function count(cid){return floorsFor(cid).reduce((n,f)=>n+f.placements.length,0);}
function visible(){const cid=inCompany(),x=currentFor(cid);return {...x,cid};}
function save(){B.save();}
function popup(message,error=false){B.toast(message,error?'error':'ok');}
function optionsFor(cid,floor){const used=new Set(floorsFor(cid).flatMap(f=>f.placements.map(p=>p.employeeId)));
 return companyStaff(cid).filter(e=>!used.has(e.id)&&eligibleFor(floor,e));}
function place(cid,floor,employeeId,seat,projectId,taskId){
 const worker=companyStaff(cid).find(e=>e.id===employeeId);
 if(!worker)return {ok:false,message:'Choose an active employee in this company.'};
 if(!floor||floor.companyId!==cid)return {ok:false,message:'Choose a valid company level.'};
 if(!eligibleFor(floor,worker))return {ok:false,message:'This employee belongs to '+(role(worker).dept||'another department')+', not '+departmentLabel(floor)+'. Choose a worker from the selected department.'};
 if(!Number.isInteger(seat)||seat<0||seat>=LIMIT)return {ok:false,message:'Choose a desk from 1 to 30.'};
 if(floor.placements.length>=LIMIT)return {ok:false,message:'This floor is full: 30 assigned workers maximum. Add another level.'};
 if(floor.placements.some(p=>p.seat===seat))return {ok:false,message:'This desk is already occupied.'};
 if(floorsFor(cid).some(f=>f.placements.some(p=>p.employeeId===employeeId)))return {ok:false,message:'This employee already occupies a desk. Remove them before moving floors.'};
 const project=projectId&&projectId!=='all'?projectsFor(cid).find(p=>p.id===projectId):null;
 if(projectId&&projectId!=='all'&&!project)return {ok:false,message:'Choose a project from this company.'};
 floor.placements.push({seat,employeeId,projectId:project?.id||null,taskId:taskId||null,placedAt:time()});
 if(project){project.members??=[];if(!project.members.includes(employeeId))project.members.push(employeeId);}
 save();return {ok:true,message:worker.name+' placed at desk '+(seat+1)+'.'};
}
function removePlacement(cid,floor,seat){
 const p=floor?.placements?.find(p=>p.seat===seat);
 if(!p)return false;
 floor.placements=floor.placements.filter(q=>q.seat!==seat);
 for(const pr of projectsFor(cid))pr.members=(pr.members||[]).filter(id=>id!==p.employeeId);
 save();return true;
}
function commandControls(cid){
 const {floor}=setup(cid);
 if(!floor)return '';
 const floors=floorsFor(cid),available=optionsFor(cid,floor),placed=floor.placements||[];
 const firstFree=seatList(floor).find(v=>!v.placement);
 return '<div class="pf-command-controls" aria-label="Live RPG employee management">'+
  '<label>Office scenery<select id="pfCommandScene" aria-label="Change command center RPG scenery">'+sceneChoices(cid)+'</select></label>'+
   '<label>RPG department level<select id="pfCommandFloor">'+floors.map(f=>'<option value="'+E(f.id)+'"'+(f.id===floor.id?' selected':'')+'>'+E(f.name)+'</option>').join('')+'</select></label>'+
  '<label>Add existing employee<select id="pfCommandWorker"><option value="">Choose employee</option>'+available.map(e=>'<option value="'+E(e.id)+'">'+E(e.name)+' · '+E(role(e).title||'Staff')+'</option>').join('')+'</select></label>'+
  '<button class="btn btn-sm" data-pf="command-add"'+(!firstFree||!available.length?' disabled':'')+'>＋ Add to RPG</button>'+
  '<label>Remove visible employee<select id="pfCommandRemove"><option value="">Choose employee</option>'+placed.map(p=>{const e=state().employees.find(e=>e.id===p.employeeId);return '<option value="'+p.seat+'">'+E(e?.name||'Former employee')+' · Desk '+(p.seat+1)+'</option>';}).join('')+'</select></label>'+
  '<button class="btn btn-sm" data-pf="command-remove"'+(!placed.length?' disabled':'')+'>× Remove from RPG</button>'+
  '<p class="tiny muted">Showing '+placed.length+' of 30 desks · '+E(departmentLabel(floor))+' workers only. Changes also appear in Live RPG Office; employee records and tasks stay safe.</p></div>';
}
function onTaskAssigned(task){
 if(!task?.companyId||!task?.ownerId)return;
 const cid=task.companyId,loc=setup(cid),d=loc.d;
 if(floorsFor(cid).some(f=>f.placements.some(p=>p.employeeId===task.ownerId))){
  const p=floorsFor(cid).flatMap(f=>f.placements).find(p=>p.employeeId===task.ownerId);
  if(p&&!p.taskId)p.taskId=task.id;save();return;
 }
 const dept=role(state().employees.find(e=>e.id===task.ownerId)).dept;
 let floor=floorsFor(cid).find(f=>f.department===dept&&f.placements.length<LIMIT)||window.OfficeHQDepartments?.deptFloor(cid,dept)||loc.floor;
 if(!floor||floor.placements.length>=LIMIT){popup('Task saved, but the '+(dept||'selected')+' department office is full. Add an overflow level or free a desk.',true);return;}
 const chosen=d.selected[cid]?.projectId,project=projectsFor(cid).find(p=>p.id===chosen);
 let auto=project;
 if(!auto){
  auto=projectsFor(cid).find(p=>p.system===true);
  if(!auto){auto={id:B.uid('project'),companyId:cid,name:'Assigned work',members:[],taskIds:[],system:true,createdAt:time()};d.projects.push(auto);}
 }
 const slot=seatList(floor).find(s=>!s.placement);
 if(!slot)return;
 const r=place(cid,floor,task.ownerId,slot.seat,auto.id,task.id);
 if(r.ok){auto.taskIds??=[];if(!auto.taskIds.includes(task.id))auto.taskIds.push(task.id);d.selected[cid]={floorId:floor.id,projectId:auto.id};save();popup('Task assigned. '+r.message+' Open Live RPG Office to see them.');}
}
function onTaskStatus(task){
 if(task?.status!=='done')return;
 const next=state().tasks.find(t=>t.dependsOn===task.id&&t.companyId===task.companyId);
 if(!next||!next.ownerId||next.ownerId===task.ownerId)return;
 const floor=floorsFor(task.companyId).find(f=>f.placements.some(p=>p.employeeId===task.ownerId)&&f.placements.some(p=>p.employeeId===next.ownerId));
 if(!floor)return;
 const a=floor.placements.find(p=>p.employeeId===task.ownerId);
 const b=floor.placements.find(p=>p.employeeId===next.ownerId);
 const event={cid:task.companyId,floorId:floor.id,from:a.seat,to:b.seat,taskId:task.id,until:null};
 handoff=event;
 // Only visualizes a verified internal task transition; does not execute the next task.
}
let manageOffice=false;
function setManageOffice(value){manageOffice=!!value;}
function isImmersive(){return !manageOffice;}
function renderImmersive(){
 const cid=inCompany(),{floor,project}=setup(cid);
 if(!floor)return '<p class="muted">Choose a company to enter the live office.</p>';
 const floors=floorsFor(cid);
 return '<section class="hq-immersive-shell" aria-label="Dedicated live RPG office">'+
  '<div class="hq-immersive-toolbar"><button class="btn btn-sm" type="button" data-view="command">← Back to HQ</button>'+
  '<span class="hq-immersive-title">LIVE RPG OFFICE</span>'+
  '<button class="btn btn-sm btn-primary" type="button" data-pf="manage-office">⚙ Manage Office</button>'+
  '<details class="hq-immersive-options"><summary>View options</summary><div class="hq-immersive-selectors">'+
  '<label>Department floor<select id="pfFloor">'+floors.map(f=>'<option value="'+E(f.id)+'"'+(f.id===floor.id?' selected':'')+'>'+E(f.name)+'</option>').join('')+'</select></label>'+
  '<label>Scenery<select id="pfScene">'+sceneChoices(cid)+'</select></label>'+
  '<label>Project<select id="pfProject"><option value="all">All workers</option>'+projectsFor(cid).map(p=>'<option value="'+E(p.id)+'"'+(project?.id===p.id?' selected':'')+'>'+E(p.name)+'</option>').join('')+'</select></label>'+
  '</div></details></div>'+
  '<div class="office-box pf-stage hq-immersive-stage"><canvas class="office-canvas" id="officeCanvas" width="1240" height="1135" role="img" aria-label="Animated RPG office with 30 desks, department workers, names and thought bubbles. Tap a worker to open their profile."></canvas></div>'+
  '<p class="hq-immersive-hint">'+E(floor.name)+' · '+(floor.placements||[]).length+' of 30 desks in use · Tap an employee for their profile</p></section>';
}
function render(){
 if(!manageOffice)return renderImmersive();
 const cid=inCompany(),{floor,project}=setup(cid),floors=floorsFor(cid),projects=projectsFor(cid);
 const placement=seatList(floor);
 const available=optionsFor(cid,floor);
 const active=placement.filter(x=>x.placement&&display(x.placement,project));
 const options=available.map(e=>'<option value="'+E(e.id)+'">'+E(e.name)+' · '+E(role(e).title||'Worker')+'</option>').join('');
 const projOptions='<option value="all">All desks / placed workers</option>'+projects.map(p=>'<option value="'+E(p.id)+'"'+(project?.id===p.id?' selected':'')+'>'+E(p.name)+'</option>').join('');
 return '<div class="page-head"><div><div class="eyebrow">LIVE RPG OFFICE · ASSIGNED STAFF ONLY</div><h1>Project Floor</h1><p class="subtitle">A small, professional office with desks and computers. Fifteen employees start moving in the RPG office. Choose, add, or remove them at any time; their actual work stays unchanged.</p></div>'+
 '<div class="head-actions"><button class="btn" data-view="approvals">🏛 CEO approvals ('+(state().approvals||[]).filter(a=>a.companyId===cid&&a.status==='pending').length+')</button><button class="btn btn-primary" data-action="newTask">＋ Assign task</button></div></div>'+
 '<section class="card pf-toolbar"><div class="pf-tools">'+
 '<label>Level<select id="pfFloor">'+floors.map((f,i)=>'<option value="'+E(f.id)+'"'+(f.id===floor.id?' selected':'')+'>'+E(f.name)+(f.department?' · Department':' · Extra level')+'</option>').join('')+'</select></label>'+
 '<label>Project / group<select id="pfProject">'+projOptions+'</select></label>'+
  '<label class="pf-scene-control">🌄 Office scenery<select id="pfScene" aria-label="Change Live RPG Office scenery">'+sceneChoices(cid)+'</select></label>'+
 '<button class="btn btn-sm" data-pf="new-floor">＋ Add level</button>'+
 '<button class="btn btn-sm" data-pf="new-project">＋ New project</button></div>'+
 '<div class="pf-status"><strong>'+floor.placements.length+' / '+LIMIT+'</strong> worker desks occupied on this level · <strong>'+active.length+'</strong> shown for the selected project'+
 ' · Janitor <strong>'+(floor.janitor?'on duty':'off duty')+'</strong></div>'+
 '<div class="office-box pf-stage"><canvas class="office-canvas" id="officeCanvas" width="1240" height="1135" role="img" aria-label="Living RPG office with thirty desks, employee names and thought bubbles, CEO office and staggered break-room activity."></canvas></div>'+
 '<p class="pf-local-note">📱 Scenery choices, desk placements and assignments save on this device. Export a backup in Settings to protect your work.</p>'+
  '<div class="office-legend"><span>▣ Empty desk</span><span>● Assigned worker</span><span>📁 Handoff only after a linked task is completed</span></div>'+
 '<label class="pf-janitor"><input type="checkbox" id="pfJanitor"'+(floor.janitor?' checked':'')+'> Assign a janitor to this level <small>(separate from the 30 worker spaces)</small></label>'+
 '</section>'+
 '<div class="grid two-col pf-bottom"><section class="card"><div class="section-top"><h2>Place an employee</h2><span class="pill-stat">Manual placement</span></div>'+
 '<p class="muted small">Only '+E(departmentLabel(floor))+' employees can be placed here. Each floor has 30 desks; extra floors keep their department. Employee assignments stay attached to their profiles.</p>'+
 '<form id="pfPlaceForm" class="pf-place-form">'+
 '<label>Employee<select id="pfEmployee" required><option value="">Choose an available employee</option>'+options+'</select></label>'+
 '<label>Desk<select id="pfSeat" required>'+placement.filter(x=>!x.placement).map(x=>'<option value="'+x.seat+'">Desk '+(x.seat+1)+'</option>').join('')+'</select></label>'+
 '<label>Assign to group<select id="pfPlacementProject">'+
 '<option value="all">Unassigned / general floor</option>'+projects.map(p=>'<option value="'+E(p.id)+'"'+(project?.id===p.id?' selected':'')+'>'+E(p.name)+'</option>').join('')+'</select></label>'+
 '<button type="submit" class="btn btn-primary"'+(!available.length||floor.placements.length>=LIMIT?' disabled':'')+'>＋ Place at desk</button></form>'+
 '<div class="section-top" style="margin-top:18px"><h3>Workers on this floor</h3><span>'+floor.placements.length+' of 30</span></div>'+
 '<div class="pf-placed">'+(floor.placements.length?floor.placements.sort((a,b)=>a.seat-b.seat).map(p=>{
 const w=state().employees.find(e=>e.id===p.employeeId),grp=projects.find(x=>x.id===p.projectId);
 return '<div class="pf-person"><span><strong>Desk '+(p.seat+1)+': '+E(w?.name||'Former employee')+'</strong><small>'+E(role(w).title||'')+' · '+E(grp?.name||'General')+'</small></span><button class="btn btn-sm" data-pf="remove" data-seat="'+p.seat+'">Remove</button></div>';
 }).join(''):'<p class="muted">Empty office. Place your first employee above.</p>')+'</div></section>'+
 '<section class="card"><div class="section-top"><h2>Project teams & paperwork handoffs</h2><span class="pill-stat">'+projects.length+' groups</span></div>'+
 '<p class="muted small">A project is a selected team, not a duplicate workforce. Each task keeps its single authorized owner.</p>'+
 '<div class="pf-projects">'+(projects.length?projects.map(p=>'<div class="pf-person"><span><strong>'+E(p.name)+'</strong><small>'+p.members?.length+' selected employee(s)</small></span><button class="btn btn-sm" data-pf="view-project" data-project="'+E(p.id)+'">Show</button></div>').join(''):'<p class="muted">Create a project group to focus the live office on that team.</p>')+'</div>'+
 '<hr class="divider"><h3>Link an existing task handoff</h3><p class="muted small">Only after Task A is marked done with its normal approval checks will its worker walk to the next placed worker and hand over paperwork. This does not start external account automation.</p>'+
 '<form id="pfHandoffForm" class="pf-handoff-form"><label>First task<select id="pfFirstTask" required><option value="">Choose first task</option>'+
 allTasks(cid).filter(t=>t.ownerId).slice(0,100).map(t=>'<option value="'+E(t.id)+'">'+E(String(t.title||'Untitled task').slice(0,60))+'</option>').join('')+'</select></label>'+
 '<label>Next task<select id="pfNextTask" required><option value="">Choose next task</option>'+
 allTasks(cid).filter(t=>t.ownerId).slice(0,100).map(t=>'<option value="'+E(t.id)+'">'+E(String(t.title||'Untitled task').slice(0,60))+'</option>').join('')+'</select></label>'+
 '<button class="btn" type="submit">⇥ Link handoff</button></form>'+
 '<div class="pf-footnote">Janitors are optional visual support staff on each level. They do not consume a worker desk, own business tasks, or alter your existing roster.</div></section></div>'+
 (window.OfficeHQDepartments?.flowMarkup(cid)||'');
}
function toCtx(c){ctx=c;return c;}
function background(c){c.clearRect(0,0,960,436);c.fillStyle=sceneColor('#1b3544');c.fillRect(0,0,960,436);
 for(let y=0;y<436;y+=28){for(let x=0;x<960;x+=28){c.fillStyle=(Math.floor(x/28)+Math.floor(y/28))%2?'#244858':'#294d5b';c.fillRect(x+1,y+1,26,26);}}
 c.fillStyle=sceneColor('#102e3d');c.fillRect(0,0,960,65);
 c.fillStyle=sceneColor('#e0f4ef');c.font='bold 20px system-ui';c.fillText('OFFICE HQ  /  LIVE PROJECT FLOOR',28,33);
 c.fillStyle=sceneColor('#89c6c0');c.font='12px system-ui';c.fillText('30 DESKS MAX · SELECTED STAFF ONLY',30,53);
 c.fillStyle=sceneColor('#365867');c.fillRect(13,394,934,33);
 c.fillStyle=sceneColor('#e7cd80');c.font='12px system-ui';c.fillText('PAPERWORK HANDOFFS  ·  AUTHORIZED ASSIGNMENTS',28,415);
}
function workstation(c,seat,person,focused,now,x=coords(seat).x,y=coords(seat).y){
 c.save();c.translate(x,y);
 c.fillStyle=sceneColor(focused?'#345d60':'#2a505d');c.fillRect(-76,-48,148,91);
 c.fillStyle=sceneColor('#936f54');c.fillRect(-67,-29,123,36);c.fillStyle=sceneColor('#c39b6d');c.fillRect(-62,-25,113,7);
 c.fillStyle=sceneColor('#1a2939');c.fillRect(-33,-47,60,36);c.fillStyle=sceneColor('#69c4c4');c.fillRect(-29,-43,52,27);c.fillStyle=sceneColor('#315c64');c.fillRect(-24,-40,38,18);
 c.fillStyle=sceneColor('#243844');c.fillRect(-7,-11,9,9);c.fillStyle=sceneColor('#192833');c.fillRect(-16,-2,27,5);
 c.fillStyle=sceneColor('#466973');c.fillRect(-23,22,44,17);c.fillStyle=sceneColor('#9bb8b7');c.font='11px system-ui';c.fillText('DESK '+(seat+1),-68,36);
 if(!person){c.strokeStyle='#76a6a6';c.setLineDash([3,4]);c.strokeRect(-65,9,34,24);c.setLineDash([]);}
 c.restore();
}
function sprite(c,person,x,y,now,moving=false){
 const e=state().employees.find(a=>a.id===person.employeeId);if(!e)return;
 const idle=moving?0:(Math.sin(now/450+person.seat)*.7);
 c.save();c.translate(x,y+idle);
 c.fillStyle=sceneColor('#314b59');c.fillRect(-5,6,5,9);c.fillRect(2,6,5,9);
 c.fillStyle=e.outfit||'#69b9b3';c.fillRect(-8,-14,16,21);
 c.fillStyle=e.skin||'#b98764';c.fillRect(-7,-28,14,15);
 c.fillStyle=e.hair||'#1b2531';c.fillRect(-8,-31,16,6);
 c.fillStyle=sceneColor('#26333b');c.fillRect(-5,-19,2,2);c.fillRect(3,-19,2,2);
 c.fillStyle=e.skin||'#b98764';c.fillRect(-11,-10,3,12);c.fillRect(8,-10,3,12);
 c.restore();
}
function label(c,text,x,y,color='#f0e1aa'){
 c.fillStyle=sceneColor('#16323dea');c.fillRect(x-61,y-16,122,21);c.fillStyle=sceneColor(color);c.textAlign='center';c.font='11px system-ui';
 c.fillText(clamp(text,19),x,y-2);c.textAlign='left';
}
function renderFloor(c,now){
 if(!c)return;
 const cid=inCompany(),{floor,project}=setup(cid);if(!floor)return;
 if(window.OfficeHQOfficeLife?.draw){
  if(handoff&&handoff.cid===cid&&handoff.floorId===floor.id&&handoff.until===null)handoff.until=Date.now()+6500;
  window.OfficeHQOfficeLife.draw({c,now,cid,floor,project,handoff,staff:state().employees,tasks:state().tasks,approvals:state().approvals||[],thoughts:window.OfficeHQDesktopThoughts||{},B});
  if(handoff&&handoff.until!==null&&Date.now()>=handoff.until)handoff=null;
  return;
 }
 background(c);
 if(handoff&&handoff.cid===cid&&handoff.floorId===floor.id&&handoff.until===null)handoff.until=Date.now()+6500;
 const title=project?.name||floor.name;
 c.fillStyle=sceneColor('#eac887');c.font='bold 13px system-ui';c.textAlign='right';c.fillText(clamp(title,45),928,34);c.textAlign='left';
 for(const {seat,placement} of seatList(floor)){
  const show=placement&&display(placement,project);
  workstation(c,seat,placement,!!show,now);
  if(show){
   const e=state().employees.find(x=>x.id===placement.employeeId);
   const pt=coords(seat);
   const isCarrying=handoff&&handoff.cid===cid&&handoff.floorId===floor.id&&handoff.from===seat&&handoff.until!==null&&Date.now()<handoff.until;
   if(!isCarrying)sprite(c,placement,pt.x+27,pt.y+24,now);
   c.textAlign='center';c.fillStyle=sceneColor('#e2efec');c.font='11px system-ui';
   c.fillText(clamp(e?.name?.split(' ')[0]||'Worker',13),pt.x,pt.y+52);
   c.textAlign='left';
   const active=state().tasks.find(t=>t.ownerId===placement.employeeId&&t.status==='in_progress');
   const thought=window.OfficeHQDesktopThoughts?.[placement.employeeId]||active?.title;
   if(thought)label(c,thought,pt.x+8,pt.y-61);
  }
 }
 if(floor.janitor){
  // One separate support character per floor; does not consume any of the thirty desks.
  const sweep=Math.sin(now/1650)*19;
  c.fillStyle=sceneColor('#aa916f');c.fillRect(884+sweep,348,2,24);
  sprite(c,{employeeId:'__janitor__',seat:10},880+sweep,354,now);
  // Draw the janitor independently of the business workforce roster.
  c.fillStyle=sceneColor('#d0a666');c.fillRect(867+sweep,335,13,19);
  c.fillStyle=sceneColor('#b7815d');c.fillRect(868+sweep,326,10,10);
  c.fillStyle=sceneColor('#e4d18e');c.font='10px system-ui';c.fillText('JANITOR',846,384);
 }
 if(handoff&&handoff.cid===cid&&handoff.floorId===floor.id&&Date.now()<handoff.until){
  const from=floor.placements.find(p=>p.seat===handoff.from),to=floor.placements.find(p=>p.seat===handoff.to);
  if(from&&to&&display(from,project)&&display(to,project)){
   const progress=1-(handoff.until-Date.now())/6500;
   const a=coords(from.seat),b=coords(to.seat);
   const start={x:a.x+29,y:a.y+24},dest={x:b.x+18,y:b.y+26};
   let t,pt;
   if(progress<.43){t=progress/.43;pt={x:start.x+(dest.x-start.x)*t,y:start.y+(dest.y-start.y)*t};}
   else if(progress<.62){pt=dest;t=1;}
   else{t=(progress-.62)/.38;pt={x:dest.x+(start.x-dest.x)*t,y:dest.y+(start.y-dest.y)*t};}
   sprite(c,from,pt.x,pt.y,now,true);
   c.fillStyle=sceneColor('#f5e8c6');c.fillRect(pt.x+6,pt.y-12,10,12);
   if(progress>.43&&progress<.62)label(c,'File delivered ✓',dest.x,dest.y-39,'#b7ecc0');
  }
 }else if(handoff&&Date.now()>=handoff.until)handoff=null;
 if(!floor.placements.length){
  c.fillStyle=sceneColor('#e0e9e2');c.font='bold 17px system-ui';c.textAlign='center';
  c.fillText('Your office is empty — place a worker to begin.',480,388);c.textAlign='left';
 }
}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0;ctx=null;}
function start(){
 stop();const canvas=$('#officeCanvas');if(!canvas)return;
 const c=canvas.getContext('2d');if(!c)return;ctx=toCtx(c);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let frameAt=0;
 function frame(now){if(!canvas.isConnected){stop();return;}if(now-frameAt>70){renderFloor(c,now);frameAt=now;}if(!reduced)raf=requestAnimationFrame(frame);}
 frame(performance.now());
 canvas.onclick=event=>{
  const rect=canvas.getBoundingClientRect(),cx=(event.clientX-rect.left)*canvas.width/rect.width,cy=(event.clientY-rect.top)*canvas.height/rect.height;
  const hit=window.OfficeHQOfficeLife?.hitTest(cx,cy);
  if(hit?.kind==='worker'&&B.workerModal){B.workerModal(hit.id);return;}
  if(hit?.kind==='approvals'){B.setView('approvals');return;}
 if(hit?.kind==='department-head'){if(hit.id&&B.workerModal)B.workerModal(hit.id);else B.setView('workforce');return;}
  const {floor,project}=visible();if(!floor)return;
  const seat=seatList(floor).find(item=>{
   const {x,y}=coords(item.seat);return cx>=x-75&&cx<=x+75&&cy>=y-58&&cy<=y+76;
  });if(!seat)return;
  if(seat.placement&&display(seat.placement,project)&&B.workerModal){B.workerModal(seat.placement.employeeId);return;}
  const choice=$('#pfSeat');if(choice&&Array.from(choice.options).some(o=>o.value===String(seat.seat))){choice.value=String(seat.seat);choice.focus();}
 };
}
function redraw(){if($('#officeCanvas'))start();}
function syncFloor(){B.setView('office');}
document.addEventListener('change',event=>{
 const cid=inCompany(),d=data();
 if(event.target.id==='pfCommandScene'){if(setScene(cid,event.target.value))B.setView('command');return;}
  if(event.target.id==='pfScene'){if(setScene(cid,event.target.value))B.setView('office');return;}
  if(event.target.id==='pfCommandFloor'){
  const f=floorsFor(cid).find(f=>f.id===event.target.value);
  if(f){d.selected[cid]={floorId:f.id,projectId:'all'};save();B.setView('command');}return;
 }
 if(!$('#pfFloor'))return;
 if(event.target.id==='pfFloor'){
  const chosen=floorsFor(cid).find(f=>f.id===event.target.value);
  if(chosen){d.selected[cid]={floorId:chosen.id,projectId:'all'};save();syncFloor();}
 }
 if(event.target.id==='pfProject'){
  const x=setup(cid);d.selected[cid]={floorId:x.floor.id,projectId:event.target.value};save();syncFloor();
 }
 if(event.target.id==='pfJanitor'){
  const x=setup(cid);x.floor.janitor=event.target.checked;save();redraw();
 }
});
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-pf]');if(!btn)return;
 const cid=inCompany();if(!cid)return;
 const {floor,d}=setup(cid),op=btn.dataset.pf;
 if(op==='manage-office'){setManageOffice(true);B.setView('office');return;}
 if(op==='command-add'){
  const employeeId=$('#pfCommandWorker')?.value;
  const seat=seatList(floor).find(x=>!x.placement)?.seat;
  if(seat===undefined){popup('This RPG floor is full (30 workers).',true);return;}
  const result=place(cid,floor,employeeId,seat,'all');
  if(result.ok){d.selected[cid]={floorId:floor.id,projectId:'all'};save();B.setView('command');}
  popup(result.message,!result.ok);return;
 }
 if(op==='command-remove'){
  const value=$('#pfCommandRemove')?.value;
  if(value===''||value==null){popup('Choose someone to remove from the RPG view.',true);return;}
  const seat=Number(value);
  if(!Number.isInteger(seat)||!floor.placements.some(p=>p.seat===seat))return;
  if(!confirm('Remove this avatar from the RPG office and Command Center? The employee and their work are retained.'))return;
  removePlacement(cid,floor,seat);B.setView('command');popup('RPG avatar removed. Employee record and tasks remain.');return;
 }
 if(op==='new-floor'){
  const count=floorsFor(cid).length;
  if(count>=30){popup('Maximum 30 levels per company.',true);return;}
  const next={id:B.uid('floor'),companyId:cid,name:floor.department?departmentLabel(floor)+' · overflow '+floorsFor(cid).filter(f=>f.department===floor.department).length:'Level '+(count+1),department:floor.department||null,janitor:false,placements:[],createdAt:time()};
  d.floors.push(next);d.selected[cid]={floorId:next.id,projectId:'all'};save();syncFloor();
 }
 if(op==='new-project'){
  const name=prompt('Name this project or group (maximum 65 characters):','');
  if(name===null)return;
  const trimmed=name.trim().slice(0,65);
  if(!trimmed){popup('Enter a project name.',true);return;}
  if(projectsFor(cid).length>=100){popup('Maximum 100 projects per company.',true);return;}
  const p={id:B.uid('project'),companyId:cid,name:trimmed,members:[],taskIds:[],createdAt:time()};
  d.projects.push(p);d.selected[cid]={floorId:floor.id,projectId:p.id};save();syncFloor();
 }
 if(op==='view-project'){
  const p=projectsFor(cid).find(p=>p.id===btn.dataset.project);
  if(p){d.selected[cid]={floorId:floor.id,projectId:p.id};save();syncFloor();}
 }
 if(op==='remove'){
  const seat=Number(btn.dataset.seat);
  if(!Number.isInteger(seat))return;
  const p=floor.placements.find(p=>p.seat===seat);if(!p)return;
  if(!confirm('Remove this worker from the RPG floor? Their existing business tasks will NOT be deleted.'))return;
  removePlacement(cid,floor,seat);syncFloor();
 }
});
document.addEventListener('submit',event=>{
 if(event.target.id==='pfPlaceForm'){
  event.preventDefault();const cid=inCompany(),{floor}=setup(cid);
  const result=place(cid,floor,$('#pfEmployee')?.value,Number($('#pfSeat')?.value),$('#pfPlacementProject')?.value);
  popup(result.message,!result.ok);if(result.ok)syncFloor();
 }
 if(event.target.id==='pfHandoffForm'){
  event.preventDefault();const cid=inCompany(),a=state().tasks.find(t=>t.id===$('#pfFirstTask').value&&t.companyId===cid),b=state().tasks.find(t=>t.id===$('#pfNextTask').value&&t.companyId===cid);
  if(!a||!b||a.id===b.id||!a.ownerId||!b.ownerId||a.ownerId===b.ownerId){popup('Choose different, specialized workers on two tasks in this company.',true);return;}
  if(b.status==='done'){popup('The recipient task is already complete.',true);return;}
  if(b.dependsOn){popup('That task already has a prerequisite.',true);return;}
  let cursor=a,steps=0;
  while(cursor?.dependsOn&&steps++<150){
   if(cursor.dependsOn===b.id){popup('Circular task handoff not allowed.',true);return;}
   cursor=state().tasks.find(t=>t.id===cursor.dependsOn&&t.companyId===cid);
  }
  b.dependsOn=a.id;b.updatedAt=time();save();
  popup('Handoff linked. Animation starts only when the first task is actually completed.');
  syncFloor();
 }
});
// Canvas animation repaints on its own; reduced-motion and inactive frames need a direct repaint.
if(typeof window.addEventListener==='function')window.addEventListener('officehq:themechange',()=>{
 if(ctx&&$('#officeCanvas'))renderFloor(ctx,performance.now());
});
window.OfficeHQFloor={render,start,stop,setManageOffice,isImmersive,onTaskAssigned,onTaskStatus,data,commandControls,sceneFor,setScene,SCENE_OPTIONS,LIMIT,INITIAL_WORKERS};
if(['office','command'].includes(location.hash.replace('#/','')))B.setView(location.hash.replace('#/',''));
})();
