/* Office HQ independent AI agent roster. Browser-only view does not provision bots. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews)return;
const E=B.E;
let department='All';
function render(){
 const selected=document.querySelector('#companyPicker')?.value;
 const cid=selected&&selected!=='all'?selected:B.getState().companies[0]?.id;
 const roles=B.getRoles();
 const team=B.getState().employees.filter(e=>e.companyId===cid&&e.active&&e.roleKey!=='ceo');
 const byRole=new Map(team.map(e=>[e.roleKey,e]));
 const departments=['All',...new Set(roles.map(r=>r.dept))];
 const visible=roles.filter(r=>department==='All'||r.dept===department);
 const roster=visible.map(r=>{
   const e=byRole.get(r.key);
   return '<article class="ops-job" data-workforce="select-role" data-role="'+E(r.key)+'"><strong>'+E(e?.name||r.title)+'</strong><p class="small muted">'+E(r.title)+' · '+E(r.dept)+'</p><small>'+E(e?'Registered in company':'Not registered')+' · Mac execution not verified</small></article>';
 }).join('');
 return '<div class="page-head"><div class="eyebrow">OFFICE HQ · INDEPENDENT AGENT ENGINE</div><h1>AI Workforce Runtime</h1>'+
 '<p class="muted">40 SEPARATE AGENT IDENTITIES across 12 departments. Each requires a real, authorized local runtime before work can execute.</p></div>'+
 '<section class="card"><h2>Mac agent execution: 0 / 40 verified in this browser</h2>'+
 '<p>Office HQ has '+team.length+' registered company employees. This iPhone/iPad view cannot verify, provision or authorize Mac workers. Tasks sent here are browser-local until secure sync and the Mac engine are connected.</p>'+
 '<button type="button" class="btn btn-sm" data-workforce="provision" disabled>Provision on Mac (requires local authorization)</button> '+
 '<button type="button" class="btn btn-sm" data-workforce="bind" disabled>Bind employee (Mac only)</button> '+
 '<button type="button" class="btn btn-sm" data-workforce="send" disabled>Run agent (Mac only)</button> '+
 '<button type="button" class="btn btn-primary" data-view="thread">🎙 Open company messages</button>'+
 '<p class="notice">No Mac processes, OAuth scopes or external actions are enabled from this public page. Displayed employee identities are not evidence that an agent executed work.</p></section>'+
 '<section class="card" style="margin-top:16px"><h2>Essential workforce specialties</h2>'+
 '<label for="runtimeDept">Department</label><select id="runtimeDept">'+departments.map(d=>'<option value="'+E(d)+'"'+(department===d?' selected':'')+'>'+E(d)+'</option>').join('')+'</select>'+
 '<div class="ops-job-grid">'+roster+'</div></section>';
}
document.addEventListener('change',event=>{
 if(event.target?.id==='runtimeDept'){
   department=event.target.value;
   B.setView('openmaus');
 }
});
window.OfficeHQExtraViews.openmaus=render;
})();