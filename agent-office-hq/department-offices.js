/* Twelve real departments, heads and CEO-final internal routing.
 * Never marks external work as done and never approves without owner input. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;if(!B)return;
const E=B.E,S=()=>B.getState(),$=q=>document.querySelector(q);
const DEPTS=[
 {id:'Leadership',name:'Executive Leadership',head:'chief_staff'},
 {id:'Operations',name:'Operations',head:'coo'},
 {id:'Finance',name:'Finance & Treasury',head:'cfo'},
 {id:'Marketing',name:'Marketing',head:'cmo'},
 {id:'Technology',name:'Technology & IT',head:'cto'},
 {id:'People',name:'People & HR',head:'chro'},
 {id:'Sales',name:'Sales & Revenue',head:'cro'},
 {id:'Legal',name:'Legal & Compliance',head:'counsel'},
 {id:'Audit',name:'Audit & Analytics',head:'chief_audit'},
 {id:'PMO',name:'Project Management',head:'pmo_dir'},
 {id:'Customer',name:'Customer Experience',head:'customer_mgr'},
 {id:'Product',name:'Product & Catalog',head:'product_mgr'}
];
const byId=Object.fromEntries(DEPTS.map(d=>[d.id,d]));
const deptIds=new Set(DEPTS.map(d=>d.id));
const stamp=()=>new Date().toISOString();
const label=id=>byId[id]?.name||id;
const deliveries=new Map();
function headFor(cid,dept){
 const d=byId[dept];return d?S().employees.find(e=>e.companyId===cid&&e.roleKey===d.head&&e.active):null;
}
function ensure(cid,d){
 if(!cid||!d)return [];
 if(!Array.isArray(d.departmentRoutes))d.departmentRoutes=[];
 const floors=d.floors.filter(f=>f.companyId===cid);
 const legacy=floors.filter(f=>!deptIds.has(f.department));
 let cursor=0,changed=false;
 for(const dept of DEPTS){
  if(floors.some(f=>f.department===dept.id))continue;
  let floor=legacy[cursor++];
  if(floor){floor.department=dept.id;changed=true;}
  else{
   floor={id:B.uid('floor'),companyId:cid,name:dept.name,department:dept.id,placements:[],janitor:false,createdAt:stamp()};
   d.floors.push(floor);changed=true;
  }
  if(/^Level \d+$/.test(floor.name||'')){floor.name=dept.name;changed=true;}
 }
 if(changed)B.save();
 return DEPTS.map(dept=>d.floors.find(f=>f.companyId===cid&&f.department===dept.id));
}
function deptFloor(cid,dept){
 return S().enterprise?.projectFloor?.floors?.find(f=>f.companyId===cid&&f.department===dept);
}
function routes(cid){
 return (S().enterprise?.projectFloor?.departmentRoutes||[]).filter(r=>r.companyId===cid);
}
function taskReady(r){
 if(!r.taskId)return true;
 const t=S().tasks.find(t=>t.id===r.taskId&&t.companyId===r.companyId);
 return !!t&&t.status==='done';
}
function create(cid,title,departments,taskId){
 const requested=[...new Set(departments)].filter(x=>deptIds.has(x)&&x!=='Leadership');
 if(!requested.length)return {ok:false,error:'Choose at least one department before the CEO.'};
 if(!S().companies.some(c=>c.id===cid))return {ok:false,error:'Unknown company.'};
 const t=taskId?S().tasks.find(t=>t.id===taskId&&t.companyId===cid):null;
 if(taskId&&!t)return {ok:false,error:'The linked task does not belong to this company.'};
 const sequence=[...requested,'Leadership'],ts=stamp();
 const route={id:B.uid('deptRoute'),companyId:cid,title:String(title||'').slice(0,110),taskId:t?.id||null,
  departments:sequence,cursor:0,status:'at_department',createdAt:ts,updatedAt:ts,
  steps:sequence.map((department,i)=>({department,status:i===0?'at_department':'waiting',reviewedAt:null})),
  log:[{at:ts,department:sequence[0],event:'Created internal department review route'}],approvalId:null};
 S().enterprise.projectFloor.departmentRoutes.unshift(route);
 S().enterprise.projectFloor.departmentRoutes=S().enterprise.projectFloor.departmentRoutes.slice(0,150);
 B.addActivity('CEO · Office HQ','Opened department review route: '+route.title+'. CEO is final reviewer.','task',cid);
 B.save();return {ok:true,route};
}
function notify(route,department){
 const f=deptFloor(route.companyId,department);if(!f)return;
 deliveries.set(f.id,{companyId:route.companyId,floorId:f.id,department,at:Date.now(),
  employeeId:f.placements?.[0]?.employeeId||null,label:'📁 Packet arrived for department head'});
}
function forward(cid,id){
 const r=routes(cid).find(r=>r.id===id&&r.status==='at_department');
 if(!r)return {ok:false,error:'Routing stage is no longer active.'};
 const dept=r.departments[r.cursor];
 if(dept==='Leadership')return {ok:false,error:'Use the CEO approval inbox for final sign-off.'};
 if(r.cursor===0&&!taskReady(r))return {ok:false,error:'Finish the linked task and its required approvals before forwarding.'};
 const head=headFor(cid,dept);
 if(!head)return {ok:false,error:'The '+label(dept)+' department head must be active.'};
 const step=r.steps[r.cursor];step.status='reviewed';step.reviewedAt=stamp();step.headId=head.id;
 r.log.push({at:stamp(),department:dept,event:head.name+' reviewed and forwarded the internal packet'});
 r.cursor++;const next=r.departments[r.cursor];
 r.steps[r.cursor].status='at_department';r.updatedAt=stamp();
 notify(r,dept);notify(r,next);
 if(next==='Leadership'){
  r.status='awaiting_ceo';r.steps[r.cursor].status='awaiting_ceo';
  const approval={id:B.uid('approve'),companyId:cid,kind:'department_route',routeId:r.id,taskId:r.taskId,
   requester:head.name,title:'CEO final review: '+r.title,
   note:'Department heads completed their internal routing reviews. Final CEO approval is required. No external action occurs.',
   status:'pending',createdAt:stamp()};
  r.approvalId=approval.id;S().approvals.unshift(approval);
  B.addActivity(head.name,'Submitted '+r.title+' to the CEO for final internal approval.','approval',cid);
 }else B.addActivity(head.name,'Forwarded '+r.title+' from '+label(dept)+' to '+label(next)+'.','task',cid);
 B.save();return {ok:true,route:r,next};
}
function returnPacket(cid,id){
 const r=routes(cid).find(r=>r.id===id&&r.status==='at_department');
 if(!r)return {ok:false,error:'This packet is not currently at an active department.'};
 const dept=r.departments[r.cursor];r.status='returned';r.updatedAt=stamp();r.steps[r.cursor].status='returned';
 r.log.push({at:stamp(),department:dept,event:'Packet returned for changes'});
 B.addActivity('CEO · Office HQ','Returned routing packet for changes: '+r.title,'task',cid);
 B.save();return {ok:true};
}
function onApproval(a,decision){
 if(a?.kind!=='department_route')return;
 const r=routes(a.companyId).find(r=>r.id===a.routeId&&r.approvalId===a.id);
 if(!r||r.status!=='awaiting_ceo')return;
 r.status=decision==='approved'?'completed':'rejected';r.updatedAt=stamp();
 const step=r.steps.at(-1);step.status=r.status;step.reviewedAt=stamp();
 r.log.push({at:stamp(),department:'Leadership',event:'CEO '+(decision==='approved'?'approved':'rejected')+' final routing packet'});
 notify(r,'Leadership');
 B.save();
}
function flowMarkup(cid){
 if(!cid)return '';
 const tasks=S().tasks.filter(t=>t.companyId===cid&&t.ownerId).slice(0,100);
 const list=routes(cid).slice(0,18);
 return '<section class="card pf-dept-routing"><div class="section-top"><h2>12 department offices · handoff chain</h2><span class="pill-stat">CEO decides last</span></div>'+
 '<p class="muted small">Each department has its own floor, a department head, and up to 30 placed workers. Packets move only when the owner confirms a department head reviewed them.</p>'+
 '<div class="pf-dept-list">'+DEPTS.map(d=>{
  const f=deptFloor(cid,d.id),head=headFor(cid,d.id);
  return '<button type="button" class="pf-dept-tile" data-dept-action="visit" data-floor="'+E(f?.id||'')+'"><strong>'+E(d.name)+'</strong>'+
   '<small>'+E(head?.name||'Head position inactive')+' · '+(f?.placements?.length||0)+'/10 workers</small></button>';
 }).join('')+'</div>'+
 '<details class="pf-route-builder"><summary>＋ Create department-to-CEO routing</summary>'+
 '<form id="pfDepartmentRouteForm"><label>Packet or project name<input id="pfRouteTitle" required minlength="5" maxlength="110" placeholder="e.g. Holiday sales promotion"></label>'+
 '<label>Optional linked task<select id="pfRouteTask"><option value="">No prerequisite task</option>'+
 tasks.map(t=>'<option value="'+E(t.id)+'">'+E(String(t.title||'Untitled task').slice(0,70))+'</option>').join('')+'</select></label>'+
 '<p class="muted small">Select the departments that must review this packet, in the displayed order. Leadership/CEO is automatically the final stage.</p>'+
 '<div class="pf-route-dept-picks">'+DEPTS.filter(d=>d.id!=='Leadership').map(d=>
  '<label><input type="checkbox" name="department" value="'+E(d.id)+'" checked> '+E(d.name)+'</label>').join('')+'</div>'+
 '<button class="btn btn-primary" type="submit">Create review route → CEO</button></form></details>'+
 '<div class="pf-route-items"><h3>Department routing packets</h3>'+
 (list.length?list.map(r=>{
  const dept=r.departments[r.cursor],head=headFor(cid,dept);
  const active=r.status==='at_department',enabled=active&&taskReady(r)&&!!head;
  return '<article class="pf-route-item"><div class="pf-route-title"><strong>'+E(r.title)+'</strong><span class="ops-tag">'+E(r.status.replaceAll('_',' '))+'</span></div>'+
   '<small>Stage '+(r.cursor+1)+' of '+r.departments.length+' · '+E(label(dept))+' · '+E(head?.name||'Head not active')+'</small>'+
   '<div class="pf-route-chain">'+r.departments.map((d,i)=>
    '<span class="'+(i<r.cursor?'done':i===r.cursor?'now':'')+'">'+E(label(d))+'</span>').join('<span class="pf-arrow">→</span>')+'</div>'+
   (active?'<div class="desktop-actions"><button class="btn btn-sm" type="button" data-dept-action="forward" data-route="'+E(r.id)+'"'+(enabled?'':' disabled')+'>✓ Head reviewed · forward</button>'+
    '<button class="btn btn-sm" type="button" data-dept-action="return" data-route="'+E(r.id)+'">Return for changes</button></div>':
    r.status==='awaiting_ceo'?'<p class="notice">Awaiting the CEO in the approval inbox or company text thread.</p>':
    '<small>Final routing status: '+E(r.status)+'</small>')+
   '<details><summary>Review history</summary><div class="pf-route-history">'+r.log.map(l=>'<p>'+E(l.at?.slice(0,10)||'')+' · '+E(l.event)+'</p>').join('')+'</div></details>'+
   '</article>';
 }).join(''):'<p class="muted">No routing packets yet.</p>')+'</div></section>';
}
function visitFor(floorId){
 const event=deliveries.get(floorId);
 if(!event)return null;
 if(Date.now()-event.at>7200){deliveries.delete(floorId);return null;}
 return event;
}
document.addEventListener('submit',ev=>{
 if(ev.target.id!=='pfDepartmentRouteForm')return;
 ev.preventDefault();
 const cid=$('#companyPicker')?.value==='all'?S().companies[0]?.id:$('#companyPicker')?.value;
 const name=$('#pfRouteTitle')?.value?.trim()||'';
 const choices=[...ev.target.querySelectorAll('input[name="department"]:checked')].map(x=>x.value);
 if(name.length<5){B.toast('Give the routing packet a name of at least 5 characters.','error');return;}
 const result=create(cid,name,choices,$('#pfRouteTask')?.value||null);
 if(!result.ok){B.toast(result.error,'error');return;}
 B.setView('office');B.toast('New routing packet created. Department heads review it in order.');
});
document.addEventListener('click',ev=>{
 const btn=ev.target.closest('[data-dept-action]');if(!btn)return;
 const cid=$('#companyPicker')?.value==='all'?S().companies[0]?.id:$('#companyPicker')?.value;
 const d=S().enterprise?.projectFloor;if(!d||!cid)return;
 if(btn.dataset.deptAction==='visit'){
  const f=d.floors.find(f=>f.companyId===cid&&f.id===btn.dataset.floor);
  if(f){d.selected[cid]={floorId:f.id,projectId:'all'};B.save();B.setView('office');}
  return;
 }
 const action=btn.dataset.deptAction;
 if(action==='return'&&!confirm('Return this packet for changes? Tasks and existing approvals remain intact.'))return;
 const result=action==='forward'?forward(cid,btn.dataset.route):action==='return'?returnPacket(cid,btn.dataset.route):null;
 if(!result)return;
 if(!result.ok){B.toast(result.error,'error');return;}
 if(action==='forward'&&result.next){
  const f=deptFloor(cid,result.next);
  if(f)d.selected[cid]={floorId:f.id,projectId:'all'};
 }
 B.setView('office');B.toast(action==='forward'?'Internal packet delivered to '+label(result.next)+'.':'Packet returned for changes.');
});
window.OfficeHQDepartments={DEPTS,ensure,headFor,deptFloor,routes,create,forward,onApproval,flowMarkup,visitFor};
})();
