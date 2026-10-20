/* Office HQ Native AI engine information screen.
   Public iOS Safari has no access to the Mac-only private agent runtime. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews)return;
const E=B.E;
function render(){
 const selected=document.querySelector('#companyPicker')?.value;
 const cid=selected&&selected!=='all'?selected:B.getState().companies[0]?.id;
 const team=B.getState().employees.filter(e=>e.companyId===cid&&e.active&&e.roleKey!=='ceo');
 const roles=B.getRoles(),roleFor=e=>roles.find(r=>r.key===e.roleKey);
 return '<div class="page-head"><div class="eyebrow">OFFICE HQ · INDEPENDENT AGENT ENGINE</div><h1>Native AI Agent Engine</h1>'+
 '<p class="muted">Your own workforce, employees and jobs — without OpenMausBot. The AI execution service runs privately on your Mac.</p></div>'+
 '<section class="card"><h2>Your company specialists</h2><p>'+team.length+' active employees in this company. Assign a task from the Company Text Thread and Office HQ chooses a matching role.</p>'+
 '<button type="button" class="btn btn-primary" data-view="thread">🎙 Open microphone and company inbox</button>'+
 '<p class="notice" style="margin-top:16px">On iPhone or iPad, assignments and approvals are saved in this browser. Your Mac is not remotely connected to this site. Actual Mac bot execution and real-time cross-device messages require an authenticated sync/pairing service, which is not enabled.</p></section>'+
 '<section class="card" style="margin-top:16px"><h2>Authorized specialist roster</h2>'+
 '<div class="ops-job-grid">'+team.map(e=>{const r=roleFor(e);return '<article class="ops-job"><strong>'+E(e.name)+'</strong><p class="small muted">'+E(r?.title||'Employee')+' · '+E(r?.dept||'Department')+'</p></article>';}).join('')+'</div></section>';
}
window.OfficeHQExtraViews.openmaus=render;
})();