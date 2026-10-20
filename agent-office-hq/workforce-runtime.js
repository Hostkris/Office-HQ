/* Full forty-role runtime control screen. Shared OpenMausBot engine, separate company-role bots. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews)return;
const E=B.E,el=id=>document.getElementById(id);
const local=['localhost','127.0.0.1'].includes(location.hostname);
let data={connected:false,allowProvision:false,allowSend:false,installed:0,roles:[],bindings:[],jobs:[],permissions:[]};
let dept='All',chosen='',running=false;
const cid=()=>el('companyPicker')?.value&&el('companyPicker').value!=='all'?el('companyPicker').value:B.getState().companies[0]?.id;
const employees=()=>B.getState().employees.filter(w=>w.companyId===cid()&&w.active&&data.roles.some(r=>r.key===w.roleKey));
const selected=()=>employees().find(w=>w.id===chosen);
const role=w=>B.roleFor(w);
const binding=w=>data.bindings.find(x=>x.companyId===cid()&&x.employeeId===w?.id&&x.roleKey===w.roleKey);
const tasks=w=>B.getState().tasks.filter(t=>t.companyId===cid()&&t.ownerId===w?.id&&t.scope===role(w)?.scope&&!['done','cancelled','blocked'].includes(t.status)&&!t.needsReassignment);
const working=j=>['submitted','running','needs-input','stop_requested'].includes(j.status);
const btn=(action,label,extras='')=>'<button type="button" class="btn btn-sm" data-workforce="'+action+'" '+extras+'>'+label+'</button>';
function refreshThoughts(){
 const map={},s=B.getState();let changed=false;
 for(const j of data.jobs||[]){
  if(j.companyId!==cid())continue;
  if(working(j.status))map[j.employeeId]=j.thought||'Working in OpenMausBot';
  if(j.status==='review')map[j.employeeId]='Real draft ready for CEO review';
  const t=s.tasks.find(t=>t.id===j.officeTaskId&&t.companyId===j.companyId&&t.ownerId===j.employeeId);
  if(j.status==='review'&&t&&!t.needsReassignment&&t.scope===role(s.employees.find(e=>e.id===j.employeeId))?.scope&&t.openMausReviewedJobId!==j.id&&t.status!=='done'){
   t.openMausReviewedJobId=j.id;t.openMausJobId=j.id;t.openMausResult=j.result||'OpenMausBot reports completed. Verify the output inside its conversation.';
   t.output=t.openMausResult;t.status='review';t.updatedAt=new Date().toISOString();changed=true;
   B.addActivity(j.employeeName,'Real OpenMausBot draft finished. Forwarded to CEO review.','task',j.companyId);
  }
 }
 window.OfficeHQMausThoughts=map;if(changed)B.save();
}
function display(){
 // Static GitHub Pages has no local CLI: render the same essential 40-role catalogue
 // from the existing Office HQ roster, but never mark a bot as installed or connected.
 if(!data.roles?.length)data.roles=B.getRoles().map(r=>({key:r.key,title:r.title,department:r.dept,
   scope:r.scope,description:r.description,installed:false,botName:null}));
 let staff=employees();if(chosen&&!staff.some(w=>w.id===chosen))chosen='';
 if(!chosen)chosen=staff[0]?.id||'';
 const w=selected(),r=w&&role(w),b=binding(w),availableRoles=data.roles.filter(x=>dept==='All'||x.department===dept);
 const myJobs=data.jobs.filter(j=>j.employeeId===chosen).slice(0,15),current=tasks(w);
 const permissions=data.permissions.filter(g=>g.employeeId===chosen);
 const installed=data.roles.filter(x=>x.installed).length;
 return '<div class="page-head"><div class="eyebrow">40 SEPARATE AGENT IDENTITIES · ONE SHARED EXECUTION ENGINE</div><h1>Office HQ · AI Workforce Runtime</h1>'+
 '<p class="muted">All twelve departments have dedicated, scope-limited bot templates. You control provisioning, employees, draft assignments and exact approval decisions. GitHub Pages cannot start bots on your Mac.</p></div>'+
 '<section class="card"><div class="section-top"><h2>Engine and company setup</h2>'+btn('refresh','↻ Refresh')+'</div>'+
 '<div class="ops-grid"><div><strong>Company</strong><p>'+E(B.getState().companies.find(x=>x.id===cid())?.name||'Current company')+'</p></div>'+
 '<div><strong>OpenMausBot</strong><p>'+E(data.connected?'Local engine responding':'Not connected on this device')+'</p></div>'+
 '<div><strong>Role bots installed</strong><p>'+installed+' / 40</p></div>'+
 '<div><strong>Draft sending</strong><p>'+E(data.allowSend?'Enabled locally':'Disabled by default')+'</p></div></div>'+
 '<p class="small muted">Every company receives distinct bot names. A team preview changes nothing; installing requires your confirmation and a separate local administrator opt-in. Tool selection requests no tools and approval mode Ask, but you must inspect the real engine before running tasks.</p>'+
 (local?'<div class="inline-actions">'+btn('plan','Preview all 40 bots')+' '+btn('provision','Install / update 40 role bots',!data.allowProvision?'disabled':'')+'</div>'+
 '<p class="tiny muted">Enable provisioning by setting OFFICE_HQ_OPENMAUS_PROVISION=1 on your own local computer. Enable draft work separately with OFFICE_HQ_OPENMAUS_SEND=1. Neither switch connects Gmail, social accounts, banking, or APIs.</p>':
 '<p class="notice">You are viewing the public Safari site. To actually provision and execute agents, install and run OpenMausBot alongside Office HQ on your computer. Use the <a target="_blank" rel="noopener" href="https://github.com/Hostkris/Office-HQ/blob/main/agent-office-hq/docs/WORKFORCE_RUNTIME.md">local activation guide ↗</a>.</p>')+
 '</section>'+
 '<section class="card" style="margin-top:16px"><h2>Department and employee</h2><div class="field-row"><div class="field"><label>Department</label><select id="runtimeDept"><option>All</option>'+
 [...new Set(data.roles.map(x=>x.department))].map(s=>'<option'+(dept===s?' selected':'')+'>'+E(s)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Employee · exclusive role</label><select id="runtimeWorker">'+staff.filter(x=>dept==='All'||role(x)?.dept===dept).map(x=>'<option value="'+E(x.id)+'"'+(chosen===x.id?' selected':'')+'>'+E(x.name)+' · '+E(role(x)?.title)+'</option>').join('')+'</select></div></div>'+
 '<div class="grid two-col">'+availableRoles.map(x=>'<button type="button" class="card" style="text-align:left" data-workforce="select-role" data-role="'+E(x.key)+'"><strong>'+E(x.title)+'</strong><p class="small muted">'+E(x.department)+' · '+E(x.scope)+'</p>'+
 '<span class="ops-tag">'+E(x.installed?'Engine bot found':'Needs local provisioning')+'</span></button>').join('')+'</div></section>'+
 (w&&r?'<section class="card" style="margin-top:16px"><h2>Employee: '+E(w.name)+'</h2><p><strong>'+E(r.title)+'</strong> · '+E(r.dept)+'</p>'+
 '<p class="muted">'+E(r.description)+'</p><p class="tiny muted">Bot: '+E(data.roles.find(x=>x.key===w.roleKey)?.botName||'Not selected')+'</p>'+
 (b?'<p class="notice">Bound exclusively to this employee. '+E(b.botName)+'</p>'+btn('unbind','Revoke this runtime mapping'):
 '<label class="desktop-check"><input type="checkbox" id="runtimeBindConsent"> As CEO, I checked the actual OpenMausBot settings and approve binding this bot only to '+E(w.name)+'.</label>'+
 btn('bind','Authorize runtime binding',(!local||!data.roles.find(x=>x.key===w.roleKey)?.installed)?'disabled':''))+
 '<h3 style="margin-top:15px">Run an existing assigned job</h3><div class="field"><label>Assigned task (exact specialty only)</label><select id="runtimeTask">'+
 '<option value="">Choose an eligible existing assignment</option>'+current.map(t=>'<option value="'+E(t.id)+'">'+E(t.title)+'</option>').join('')+'</select></div>'+
 '<label class="desktop-check"><input type="checkbox" id="runtimeSendConsent"> I personally approve this draft assignment and have verified Ask approval, computer Off, browser Off, and no third-party account tools.</label>'+
 btn('send','Submit to this employee’s real bot',!b||!data.allowSend||!local?'disabled':'')+
 '<h3 style="margin-top:20px">Employee permission requests</h3><p class="small muted">These are internal policies only. An approved policy does not install OAuth, unlock connected apps, or authorize external actions.</p>'+
 '<form id="runtimeAccessForm"><div class="field"><label>Requested provider</label><select name="provider">'+['Gmail','iCloud','YouTube','Facebook','Instagram','TikTok','X (Twitter)','Lemon8','Shopify','Etsy','GitHub','Google Drive','Google Calendar','Chime','Other'].map(x=>'<option>'+E(x)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Requested operation</label><select name="operation">'+['read','research','draft','publish','send','edit','schedule','purchase','transfer'].map(x=>'<option>'+E(x)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Assignment and justification</label><textarea name="purpose" rows="2" required minlength="15" maxlength="450" placeholder="What would this employee need access for?"></textarea></div>'+
 '<button class="btn btn-primary btn-sm" type="submit"'+(!b||!local?' disabled':'')+'>Submit formal CEO permission request</button></form>'+
 (permissions.length?permissions.slice(0,15).map(g=>'<article class="card" style="margin-top:10px"><strong>'+E(g.provider)+' · '+E(g.actions.join(', '))+'</strong><p>'+E(g.purpose)+'</p>'+
 '<span class="ops-tag">'+E(g.status)+'</span> '+
 (g.status==='pending'?btn('permission-approve','Approve policy only','data-id="'+E(g.id)+'"')+' '+btn('permission-deny','Deny','data-id="'+E(g.id)+'"'):'')+
 (g.status==='approved-policy'?btn('permission-revoke','Revoke policy','data-id="'+E(g.id)+'"'):'')+
 '</article>').join(''):'<p class="muted">No additional access requested.</p>')+
 '<h3 style="margin-top:20px">Actual OpenMausBot job history</h3>'+
 (myJobs.length?myJobs.map(j=>'<article class="card" style="margin-top:10px"><strong>'+E(j.title)+'</strong> · <span class="ops-tag">'+E(j.status)+'</span>'+
 '<p>💭 '+E(j.thought||'No engine status')+'</p>'+
 (j.result?'<pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+E(j.result)+'</pre>':'')+
 (j.reason?'<p class="small muted">'+E(j.reason)+'</p>':'')+
 '<p class="tiny muted">Thread '+E(j.threadId)+'</p>'+
 (working(j)?btn('check','Check live status','data-id="'+E(j.id)+'"')+' '+btn('interrupt','Stop this job','data-id="'+E(j.id)+'"'):'')+'</article>').join(''):'<p class="muted">No active or completed runtime jobs for this employee.</p>')+
 '</section>':'')+
 '<p id="runtimeNotice" class="notice" role="status" aria-live="polite"></p>';
}
window.OfficeHQExtraViews.openmaus=display;
function say(x,bad=false){const n=el('runtimeNotice');if(n){n.textContent=x;n.style.color=bad?'var(--red)':'var(--turq)';}else B.toast(x,bad?'error':'success')}
async function api(body){const r=await fetch('/api/agent-workforce/action',{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const x=await r.json();if(!r.ok)throw Error(x.error||'Workforce operation declined');return x}
async function refresh(){if(!local||running)return;running=true;
 try{const r=await fetch('/api/agent-workforce/status?companyId='+encodeURIComponent(cid()),{cache:'no-store'});if(!r.ok)throw Error('Local agent engine not available.');
  data=await r.json();refreshThoughts();if(location.hash==='#/openmaus')B.setView('openmaus');
 }catch(e){say(e.message,true)}finally{running=false}}
async function action(op,button){
 if(op==='refresh')return refresh();
 if(op==='select-role'){const w=employees().find(w=>w.roleKey===button.dataset.role);if(!w)throw Error('Role not active');chosen=w.id;dept=role(w).dept;B.setView('openmaus');return;}
 if(!local)throw Error('Only the local, private Office HQ server can operate real bots.');
 const w=selected(),r=w&&role(w);
 if(op==='plan'){const x=await api({action:'plan',companyId:cid()});say(x.note);return;}
 if(op==='provision'){if(!confirm('Create or update forty restricted OpenMausBot employees for this company? This changes the local engine; no existing bots will be pruned.'))return;
  const x=await api({action:'provision',companyId:cid(),ownerConfirmed:true});await refresh();say(x.note);return;}
 if(!w||!r)throw Error('Select an active company employee.');
 const base={companyId:cid(),employeeId:w.id,employeeName:w.name,roleKey:w.roleKey,department:r.dept,scope:r.scope};
 if(op==='bind'){const x=await api({action:'bind',...base,ownerConfirmed:el('runtimeBindConsent')?.checked===true});await refresh();say('Dedicated bot bound to '+w.name+'.');return;}
 if(op==='unbind'){if(!confirm('Revoke the '+w.name+' mapping? Active jobs must first be stopped.'))return;const x=await api({action:'unbind',...base,ownerConfirmed:true});await refresh();say(x.note);return;}
 if(op==='send'){const t=tasks(w).find(t=>t.id===el('runtimeTask')?.value);if(!t)throw Error('Choose a valid assigned task for this role.');
  const x=await api({action:'send',...base,officeTaskId:t.id,title:t.title,description:t.description||t.title,
   ownerConfirmed:el('runtimeSendConsent')?.checked===true});
  t.openMausJobId=x.job.id;t.openMausThreadId=x.job.threadId;t.updatedAt=new Date().toISOString();B.save();
  B.addActivity(w.name,'Assigned task accepted by real '+r.title+' runtime; output still pending','task',cid());
  await refresh();say('OpenMausBot accepted this exact role assignment. Check its real status below.');return;
 }
 if(['permission-approve','permission-deny','permission-revoke'].includes(op)){const x=data.permissions.find(x=>x.id===button.dataset.id&&x.employeeId===w.id);if(!x)throw Error('Permission request not found');
  if(!confirm('Record '+op+' for '+x.provider+' ('+x.actions.join(', ')+')? This is ONLY an internal policy: no OAuth or external access is activated.'))return;
  const y=await api({action:op,companyId:cid(),requestId:x.id,ownerConfirmed:true});await refresh();say(y.note);return;}
 if(['check','interrupt'].includes(op)){const j=data.jobs.find(j=>j.id===button.dataset.id&&j.employeeId===w.id);if(!j)throw Error('Job missing');
  if(op==='interrupt'&&!confirm('Interrupt this specific active OpenMausBot task?'))return;
  const x=await api({action:op,companyId:cid(),jobId:j.id,ownerConfirmed:op==='interrupt'});
  await refresh();say(x.job.status==='review'?'Completed draft transferred to CEO review.':'Verified engine status: '+x.job.status);return;}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-workforce]');if(!b)return;e.preventDefault();void action(b.dataset.workforce,b).catch(err=>say(err.message,true));});
document.addEventListener('change',e=>{
 if(e.target.id==='runtimeDept'){dept=e.target.value;chosen=employees().find(w=>dept==='All'||role(w)?.dept===dept)?.id||'';B.setView('openmaus');}
 if(e.target.id==='runtimeWorker'){chosen=e.target.value;B.setView('openmaus');}
 if(e.target.id==='companyPicker'&&location.hash==='#/openmaus'){chosen='';void refresh();}
});
document.addEventListener('submit',e=>{
 if(e.target.id!=='runtimeAccessForm')return;e.preventDefault();
 const f=new FormData(e.target),w=selected(),r=w&&role(w);if(!w||!r)return;
 void api({action:'permission-request',companyId:cid(),employeeId:w.id,roleKey:w.roleKey,
  department:r.dept,scope:r.scope,provider:String(f.get('provider')),actions:[String(f.get('operation'))],purpose:String(f.get('purpose'))})
   .then(refresh).then(()=>say('Permission request recorded for CEO. No account access granted.')).catch(x=>say(x.message,true));
});
setTimeout(()=>{if(local)void refresh();},650);
if(location.hash==='#/openmaus')B.setView('openmaus');
})();
