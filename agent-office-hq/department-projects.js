/* Department teamwork: scope-limited draft assignments, evidence-based collection, single CEO review.
   Tasks are queued for existing paired Mac sync. No provider OAuth or external actions are granted here. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews?.workflows)return;
const E=B.E;
const now=()=>new Date().toISOString();
const company=()=>{const pick=document.getElementById('companyPicker')?.value;return pick&&pick!=='all'?pick:B.getState().companies[0]?.id;};
const all=()=>{const s=B.getState();s.enterprise??={};s.enterprise.departmentProjects??=[];return s.enterprise.departmentProjects;};
const roles=()=>B.getRoles().filter(r=>r.key!=='ceo');
const depts=()=>[...new Set(B.getRoles().map(r=>r.dept))];
const staff=(dept,cid=company())=>B.getState().employees.filter(e=>e.active&&e.companyId===cid&&e.roleKey!=='ceo'&&B.roleFor(e)?.dept===dept);
const tasks=p=>p.taskIds.map(id=>B.getState().tasks.find(t=>t.id===id)).filter(Boolean);
const verified=t=>t?.status==='review'&&!!String(t.output||'').trim()&&!!(t.cloudLastReview||t.openMausRunId||t.openMausReviewedJobId);
const active=p=>!['approved','changes-requested'].includes(p.status);
let selection='',feedback='';
function assemble(p,rows){
 return [p.title,'DEPARTMENT: '+p.department,'ORIGINAL INSTRUCTION: '+p.instruction,
  '--- VERIFIED AI DRAFT CONTRIBUTIONS ---',...rows.map(t=>{
    const worker=B.getEmployee(t.ownerId),role=B.roleFor(worker);
    return (role?.title||'Specialist')+' · '+(worker?.name||'Worker')+'\n'+String(t.output||'').trim().slice(0,12000);
  })].join('\n\n');
}
function reconcile(){
 const s=B.getState();let changed=false;
 for(const p of all()){
  if(!active(p))continue;
  const batch=tasks(p);
  if(!batch.length||batch.length!==p.taskIds.length)continue;
  const approval=s.approvals.find(a=>a.id===p.approvalId&&a.kind==='department-project'&&a.companyId===p.companyId);
  if(p.status==='review'&&approval?.status==='approved'){
    p.status='approved';p.reviewedAt=now();
    for(const t of batch)if(verified(t)){t.status='done';t.updatedAt=now();}
    changed=true;continue;
  }
  if(p.status==='review'&&approval?.status==='rejected'){
    p.status='changes-requested';p.reviewedAt=now();changed=true;continue;
  }
  if(p.status!=='queued')continue;
  if(batch.some(t=>t.status==='blocked')){p.status='attention';changed=true;continue;}
  if(batch.every(verified)){
    p.packet=assemble(p,batch);p.status='review';p.updatedAt=now();
    const request={id:B.uid('approve'),companyId:p.companyId,kind:'department-project',
      projectId:p.id,requester:p.department+' Department',title:'Approve department team report: '+p.title,
      note:'All '+batch.length+' specialists returned verified AI drafts. Read the combined report in Company Messages before approving. No external actions have been performed.',
      status:'pending',createdAt:now()};
    s.approvals.unshift(request);p.approvalId=request.id;
    s.enterprise.messages??=[];
    s.enterprise.messages.unshift({id:B.uid('sms'),author:p.department+' Team',
      companyId:p.companyId,kind:'request',body:'Our team completed '+p.title+'. The combined report is ready for your approval in Company Messages.',
      createdAt:now(),read:false});
    changed=true;
  }
 }
 if(changed){B.save();window.OfficeHQCompanyInbox?.refresh?.();}
 return changed;
}
function stateLabel(p){
 const a=tasks(p),ready=a.filter(verified).length;
 return p.status==='review'?'Ready for your approval':p.status==='approved'?'Approved':
 p.status==='changes-requested'?'Changes requested':p.status==='attention'?'A worker needs attention':
 ready+'/'+a.length+' verified drafts returned';
}
function teamCard(p,forPhone=false){
 const batch=tasks(p),ready=batch.filter(verified).length;
 return '<article class="department-team-card" data-department-project="'+E(p.id)+'">'+
 '<div class="department-team-head"><strong>'+E(p.title)+'</strong><span class="ops-tag">'+E(p.department)+'</span></div>'+
 '<p class="muted">'+E(stateLabel(p))+'</p>'+
 '<div class="department-team-progress"><span style="width:'+Math.round(100*ready/Math.max(1,batch.length))+'%"></span></div>'+
 (forPhone?'':batch.map(t=>{
  const person=B.getEmployee(t.ownerId);
  return '<div class="department-team-worker"><span>'+E(person?.name||'Worker')+' · '+E(B.roleFor(person)?.title||'Specialist')+'</span><small>'+E(verified(t)?'Draft returned':t.status==='blocked'?'Blocked':t.status==='in_progress'?'Working (confirm Mac status)':'Queued')+'</small></div>';
 }).join(''))+
 (p.packet?'<details><summary>Read combined team report</summary><pre class="department-team-packet">'+E(p.packet)+'</pre></details>':'')+
 (p.status==='review'?'<div class="department-actions"><button class="btn btn-primary btn-sm" type="button" data-team-decision="approve" data-team-id="'+E(p.id)+'">✓ Approve report</button><button class="btn btn-sm" type="button" data-team-decision="reject" data-team-id="'+E(p.id)+'">Request changes</button></div>':'')+
 (p.status==='changes-requested'&&!forPhone?'<button class="btn btn-sm" type="button" data-team-revise="'+E(p.id)+'">Create revised assignment →</button>':'')+
 (p.status==='attention'&&!forPhone?'<p class="notice">Review blocked specialists and their Mac runtime permissions before retrying. Nothing was auto-approved.</p>':'')+
 '</article>';
}
function form(){
 const cid=company(),list=all().filter(p=>p.companyId===cid).slice().reverse().slice(0,12);
 return '<div class="page-head"><div class="eyebrow">ONE ASSIGNMENT · ONE TEAM · ONE APPROVAL</div><h1>Department team projects</h1>'+
 '<p class="muted">Tap a department, describe the job, and send it. Specialists get separate parts automatically.</p></div>'+
 '<section class="card department-setup"><h2>Start a team job</h2><div class="department-tiles">'+
 depts().map(d=>'<button type="button" class="department-tile'+(selection===d?' selected':'')+'" data-team-select="'+E(d)+'" aria-pressed="'+(selection===d)+'"><strong>'+E(d)+'</strong><small>'+staff(d).length+' active employees</small></button>').join('')+'</div>'+
 (selection?'<form id="departmentTeamForm" class="department-team-form"><p><strong>'+E(staff(selection).length)+' '+E(selection)+' workers</strong> will each handle a separate role-specific part.</p>'+
 '<label for="departmentTeamInstruction">What should the whole team accomplish?</label>'+
 '<textarea id="departmentTeamInstruction" name="instruction" rows="3" maxlength="1800" placeholder="Example: Research competitors and prepare a complete launch strategy." required minlength="12"></textarea>'+
 '<button type="submit" class="btn btn-primary" '+(!staff(selection).length?'disabled':'')+'>Assign to '+E(selection)+' team →</button>'+
 '<p class="tiny muted">Real drafts require a connected, authorized Mac agent. External posting, spending, and account actions stay off.</p></form>':'')+
 (feedback?'<p class="notice" role="status">'+E(feedback)+'</p>':'')+'</section>'+
 '<section class="card department-team-list"><div class="section-top"><h2>Team progress</h2><button type="button" class="btn btn-sm" data-team-check>Refresh</button></div>'+
 (list.length?list.map(p=>teamCard(p)).join(''):'<p class="muted">No department team projects yet.</p>')+'</section>';
}
function phone(){
 const cid=company(),p=all().filter(x=>x.companyId===cid&&x.status==='review').slice(-5).reverse();
 return '<section class="department-team-inbox"><div class="section-top"><h3>Team reports for your approval</h3><button type="button" class="btn btn-sm" data-team-open>Assign team job →</button></div>'+
 (p.length?p.map(x=>teamCard(x,true)).join(''):'<p class="tiny muted">Completed department reports appear here after the Mac confirms every specialist’s draft.</p>')+'</section>';
}
const originalView=window.OfficeHQExtraViews.workflows;
window.OfficeHQExtraViews.workflows=function(){reconcile();return form()+'<details class="department-advanced"><summary>Advanced handoff workflow tools</summary>'+originalView()+'</details>';};
if(window.OfficeHQSecureChat?.render){
 const prev=window.OfficeHQSecureChat.render;
 window.OfficeHQSecureChat.render=function(...args){reconcile();return phone()+prev.apply(this,args);};
}
function redraw(){
 if(location.hash==='#/workflows')B.setView('workflows');
 else window.OfficeHQCompanyInbox?.refresh?.();
}
function start(description){
 const cid=company(),members=staff(selection,cid),text=String(description||'').trim();
 if(!cid||!selection||text.length<12||members.length===0){feedback='Choose an active department and enter the assignment.';redraw();return;}
 if(members.length>40){feedback='Too many workers are selected for a single team task.';redraw();return;}
 const s=B.getState(),p={id:B.uid('team'),companyId:cid,department:selection,
  title:text.slice(0,100),instruction:text,taskIds:[],status:'queued',packet:'',
  approvalId:null,createdAt:now(),updatedAt:now()};
 for(const worker of members){
  const r=B.roleFor(worker);
  // The Mac runner must verify the actual role, company, access and task identity.
  const t={id:B.uid('task'),companyId:cid,departmentProjectId:p.id,
   title:(selection+' · '+r.title+' · '+text.slice(0,65)).slice(0,130),
   description:('TEAM ASSIGNMENT: '+text+'\nYour specialty: '+r.title+'. '+r.description+
    '\nContribute only within your role scope: '+r.scope+'. Produce a useful standalone draft with findings, assumptions and any sources or blockers. Another system will combine drafts for CEO review. Do not send, publish, spend, change accounts or claim work completed without evidence.').slice(0,3000),
   scope:r.scope,ownerId:worker.id,delegatedBy:'owner',cloudSyncRequested:true,
   status:'queued',priority:'Medium',due:'',createdAt:now(),updatedAt:now(),output:'',
   requiresApproval:false,approvalId:null};
  s.tasks.unshift(t);p.taskIds.push(t.id);
  window.OfficeHQFloor?.onTaskAssigned?.(t);
 }
 all().push(p);
 s.enterprise.messages??=[];
 s.enterprise.messages.unshift({id:B.uid('sms'),author:'Office HQ Team Coordinator',companyId:cid,
   kind:'update',body:selection+' team assignment queued for '+members.length+' specialists: '+p.title+
   '. You will receive one approval request after verified drafts are returned.',
   createdAt:now(),read:false});
 B.save();
 for(const t of tasks(p))window.OfficeHQDeviceSync?.pushTask?.(t);
 feedback='Team assignment queued for '+members.length+' specialists. The Mac must be connected and each worker authorized to execute.';
 B.addActivity('Office HQ Team Coordinator','Assigned '+members.length+' role-specific '+selection+' team drafts: '+p.title,'task',cid);
 redraw();
}
document.addEventListener('click',event=>{
 const pick=event.target.closest('[data-team-select]');
 if(pick){selection=pick.dataset.teamSelect;feedback='';redraw();return;}
 if(event.target.closest('[data-team-check]')){reconcile();redraw();return;}
 if(event.target.closest('[data-team-open]')){B.setView('workflows');return;}
 const revise=event.target.closest('[data-team-revise]');
 if(revise){const p=all().find(x=>x.id===revise.dataset.teamRevise&&x.companyId===company());if(p){
  selection=p.department;B.setView('workflows');const el=document.getElementById('departmentTeamInstruction');
  if(el){el.value=p.instruction+'\nPlease revise the previous draft based on CEO feedback.';el.focus();}
 }return;}
 const button=event.target.closest('[data-team-decision]');
 if(!button)return;
 const p=all().find(x=>x.id===button.dataset.teamId&&x.companyId===company());
 if(!p||p.status!=='review'||!p.approvalId)return;
 const approved=button.dataset.teamDecision==='approve';
 if(!confirm(approved?'Approve the combined department team report? This records sign-off but does not publish or send externally.':'Request changes on the combined team report?'))return;
 const a=B.getState().approvals.find(a=>a.id===p.approvalId&&a.status==='pending'&&a.projectId===p.id);
 if(!a){feedback='The approval record is unavailable. Refresh to review.';redraw();return;}
 a.status=approved?'approved':'rejected';a.reviewedAt=now();
 p.status=approved?'approved':'changes-requested';p.reviewedAt=now();
 if(approved)for(const t of tasks(p))if(verified(t)){t.status='done';t.updatedAt=now();window.OfficeHQFloor?.onTaskStatus?.(t);}
 B.getState().enterprise.messages.unshift({id:B.uid('sms'),author:'You · CEO',companyId:p.companyId,
  kind:'update',body:(approved?'Approved':'Requested changes on')+' department report: '+p.title,
  createdAt:now(),read:false});
 B.addActivity('You · CEO',(approved?'Approved':'Requested changes on')+' '+p.department+' team report: '+p.title,'approval',p.companyId);
 B.save();redraw();
});
document.addEventListener('submit',event=>{
 if(event.target.id!=='departmentTeamForm')return;
 event.preventDefault();start(new FormData(event.target).get('instruction'));
});
setInterval(()=>{if(!document.hidden)reconcile();},6500);
})();
