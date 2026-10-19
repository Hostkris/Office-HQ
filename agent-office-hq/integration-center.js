/* Integration Center: setup information and DISABLED workflow plans.
   Never treat local account labels or approvals as real OAuth sessions. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews)return;
const esc=B.E;
const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const catalog=[
  {name:'Gmail',icon:'✉',method:'Google OAuth 2.0',desc:'Read messages, create drafts and send authorized replies.',docs:'https://developers.google.com/workspace/gmail/api/auth/scopes',warning:'Google verification and restricted-scope security requirements can apply.'},
  {name:'iCloud',icon:'☁',method:'Apple authorization / supported mail protocols',desc:'Supported iCloud Mail, Calendar and Contacts operations.',docs:'https://support.apple.com/en-us/121539',warning:'iCloud does not provide one general OAuth API for everything. Some apps require app-specific passwords; never enter them here.'},
  {name:'X (Twitter)',icon:'𝕏',method:'X API OAuth',desc:'Authorized social publishing and reporting.',docs:'https://developer.x.com/',warning:'API features, write access and pricing depend on your approved developer access.'},
  {name:'Instagram',icon:'◎',method:'Meta authorization',desc:'Professional-account publishing and insights where permitted.',docs:'https://developers.facebook.com/docs/instagram-platform/',warning:'Account eligibility, Meta review and permission scopes apply.'},
  {name:'Shopify',icon:'▣',method:'App installation and store authorization',desc:'Products, orders, inventory and authorized fulfillment tasks.',docs:'https://shopify.dev/docs/apps/build/authentication-authorization',warning:'App setup and merchant-approved access scopes are required.'},
  {name:'Etsy',icon:'✦',method:'Etsy OAuth 2.0 and API key',desc:'Listings, orders and stock changes.',docs:'https://developers.etsy.com/documentation/essentials/oauth2/',warning:'An approved Etsy app, callback and scopes are required.'},
  {name:'TikTok',icon:'♫',method:'TikTok authorization',desc:'Supported video operations and approved posting.',docs:'https://developers.tiktok.com/',warning:'Publishing access may require additional TikTok review or audit.'},
  {name:'Lemon8',icon:'◐',method:'Official automation not confirmed',desc:'Plan content and register an account label.',docs:'https://www.lemon8-app.com/',warning:'No verified general-purpose automation connection for this service is included.'},
  {name:'Lemonade',icon:'◉',method:'No approved OAuth connector',desc:'Insurance account management needs an approved official integration.',docs:'https://www.lemonade.com/',warning:'Do not enter insurance credentials into Office HQ. No automated claims or policy actions are authorized.'},
  {name:'Chime',icon:'＄',method:'Bank-data provider (to evaluate)',desc:'Potential read-only financial reporting, subject to coverage.',docs:'https://www.chime.com/',warning:'Never enter bank login details here. No payment, withdrawal or transfer permissions are supported.'},
  {name:'Facebook',icon:'f',method:'Meta authorization',desc:'Approved Page content and insights.',docs:'https://developers.facebook.com/',warning:'Page permissions, API review and authorized account type may be necessary.'},
  {name:'ChatGPT',icon:'✳',method:'OpenAI API (separate product)',desc:'Back approved AI drafting using an authorized model API.',docs:'https://platform.openai.com/docs/overview',warning:'A ChatGPT subscription is not the OpenAI API; there is no automatic access to private ChatGPT conversations.'},
  {name:'YouTube',icon:'▶',method:'Google OAuth 2.0',desc:'Authorized video operations and analytics.',docs:'https://developers.google.com/youtube/v3/guides/authentication',warning:'Google OAuth scopes and API quotas apply.'},
  {name:'Google Calendar',icon:'▦',method:'Google OAuth 2.0',desc:'Authorized calendar events and schedules.',docs:'https://developers.google.com/workspace/calendar/api/auth',warning:'Limited consent and server-side access control are required.'},
  {name:'Google Drive',icon:'△',method:'Google OAuth 2.0',desc:'Access only approved files and folders.',docs:'https://developers.google.com/workspace/drive/api/guides/about-auth',warning:'Keep Drive scopes as narrow as possible.'}
];
const templates=[
  {id:'inbox',label:'Gmail · Inbox assistant',provider:'Gmail',dept:['Customer','Leadership','Marketing','Sales','PMO'],trigger:'New authorized email',steps:'Read → Summarize → Draft reply → CEO review → Send when permitted'},
  {id:'shopify',label:'Shopify · Order operations',provider:'Shopify',dept:['Operations','Customer','Sales'],trigger:'New order webhook',steps:'Verify order → Check inventory → Prepare fulfillment → Escalate exceptions'},
  {id:'etsy',label:'Etsy · Inventory sync',provider:'Etsy',dept:['Operations','Product','Sales'],trigger:'Stock or order change',steps:'Verify quantity → Draft adjustments → Obtain authorization → Apply supported changes'},
  {id:'social',label:'Instagram · Social publishing',provider:'Instagram',dept:['Marketing'],trigger:'Approved scheduled content',steps:'Prepare post → Review → Publish if allowed → Report results'},
  {id:'tiktok',label:'TikTok · Content publishing',provider:'TikTok',dept:['Marketing'],trigger:'Approved scheduled video',steps:'Package media → Approve → Publish if allowed → Report performance'},
  {id:'financial',label:'Chime · Financial reporting',provider:'Chime',dept:['Finance','Audit'],trigger:'New authorized read-only statement',steps:'Review → Categorize → Flag anomalies → Brief CFO (no transfers)'}
];
const chooseCompany=()=>document.getElementById('companyPicker')?.value||'all';
const companyId=()=>chooseCompany()==='all'?B.getState().companies[0]?.id:chooseCompany();
const state=()=>B.getState();
const record=()=>{
  const s=state();
  if(!s.enterprise||typeof s.enterprise!=='object')s.enterprise={};
  if(!Array.isArray(s.enterprise.integrationPlans))s.enterprise.integrationPlans=[];
  return s.enterprise.integrationPlans;
};
const tmpl=id=>templates.find(t=>t.id===id);
function availableEmployees(template,cid){
  if(!template||!cid)return [];
  return state().employees.filter(e=>e.companyId===cid&&e.active&&template.dept.includes(B.roleFor(e)?.dept));
}
function html(){
  const cid=companyId();
  const plans=record().filter(p=>p.companyId===cid);
  return `<div class="office-integration-center">
    <section class="card">
      <div class="section-top"><h2>Account Connection Center</h2><span class="ops-tag">Secure OAuth gateway deployed</span></div>
      <p class="notice"><strong>Setup phase — no accounts connected.</strong> The primary option opens the iPhone/iPad Safari workstation on iOS or a visible local computer browser on desktop. You can sign in yourself without selecting an employee; choose a worker later in the separate assignment section. iOS offers guided tasks immediately; real third-party webpage controls require installing a separately packaged Safari extension. No developer account for each website is required for manual login. OAuth remains optional.</p>
      <div class="office-connector-grid">${catalog.map(p=>`<article class="office-connector">
        <div class="office-connector-heading"><span class="office-connector-icon" aria-hidden="true">${esc(p.icon)}</span><strong>${esc(p.name)}</strong></div>
        <p>${esc(p.desc)}</p><span class="ops-tag">Manual desktop login available · local runner required</span>
        <div class="office-connector-controls"><button class="btn btn-sm btn-primary" type="button" data-desktop-site="${esc(({Gmail:'gmail',iCloud:'icloud','X (Twitter)':'x',Instagram:'instagram',Shopify:'shopify',Etsy:'etsy',TikTok:'tiktok',Lemon8:'lemon8',Lemonade:'lemonade',Chime:'chime',Facebook:'facebook',ChatGPT:'chatgpt',YouTube:'youtube','Google Calendar':'calendar','Google Drive':'drive'})[p.name]||'gmail')}">${isIOS?'Use iOS Safari':'Use desktop browser'}</button><a class="btn btn-sm" href="./cloud.html#connections&provider=${encodeURIComponent(({Gmail:'gmail',iCloud:'icloud','X (Twitter)':'x',Instagram:'instagram',Shopify:'shopify',Etsy:'etsy',TikTok:'tiktok',Lemon8:'lemon8',Lemonade:'lemonade',Chime:'chime',Facebook:'facebook',ChatGPT:'chatgpt',YouTube:'youtube','Google Calendar':'calendar','Google Drive':'drive'})[p.name]||'')}">Optional OAuth ↗</a><button type="button" class="btn btn-sm" data-connect-guide="${esc(p.name)}">Setup details</button>
          <a class="btn btn-sm" href="${esc(p.docs)}" target="_blank" rel="noopener noreferrer" aria-label="Official ${esc(p.name)} integration documentation">Docs ↗</a></div>
      </article>`).join('')}</div>
      <div id="officeIntegrationGuide" class="office-guide" role="status" aria-live="polite">Choose a platform above for its connection checklist.</div>
    </section>
    <section class="card" style="margin:18px 0">
      <h2>Automated employee workflows</h2>
      <p class="muted">Design the task, choose an AI employee and save your CEO approval policy. Every plan remains <strong>disabled</strong> until a real OAuth integration, secure job runner and server-enforced permissions are installed.</p>
      <form id="officePlanForm" class="office-plan-form">
        <label>Workflow template<select name="template" id="officePlanTemplate">${templates.map(t=>`<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}</select></label>
        <label>AI employee<select name="employeeId" id="officePlanEmployee" required></select></label>
        <label>Job title<input name="label" maxlength="100" placeholder="Example: Process new orders" required></label>
        <label>External-action rule<select name="approval"><option value="always">CEO approval required for external actions</option><option value="policy">Only actions allowed by future server policy</option></select></label>
        <button class="btn btn-primary" type="submit">Save disabled workflow plan</button>
      </form>
      <div id="officePlanPreview" class="office-guide"></div>
      <div class="ops-account-list">${plans.map(p=>{const t=tmpl(p.template);const e=B.getEmployee(p.employeeId);return `<article class="ops-account">
        <strong>${esc(p.label)}</strong><small>${esc(t?.label||'Unknown workflow')} · Assigned to: ${esc(e?.name||'Unassigned')}<br>${esc(t?.trigger||'')} → ${esc(t?.steps||'')}</small>
        <span class="ops-tag">Disabled · Not running</span>
        <button type="button" class="btn btn-sm" data-delete-plan="${esc(p.id)}">Delete plan</button></article>`;}).join('')||'<p class="muted">No automation plans saved.</p>'}</div>
      <p class="tiny muted">After backend setup, the intended path is: platform event → authenticated queue → assigned specialist → permission check → CEO approval for gated actions → approved API action → manager report and audit log.</p>
    </section>
  </div>`;
}
const original=window.OfficeHQExtraViews.connections;
window.OfficeHQExtraViews.connections=function(){const base=original();const marker='<div class="ops-grid">';return base.includes(marker)?base.replace(marker,html()+marker):base+html();};
function employeeOptions(){
  const template=tmpl(document.getElementById('officePlanTemplate')?.value);
  const select=document.getElementById('officePlanEmployee');
  if(!select)return;
  const people=availableEmployees(template,companyId());
  select.innerHTML=people.length?'<option value="">Choose a matching employee</option>'+people.map(e=>`<option value="${esc(e.id)}">${esc(e.name)} · ${esc(B.roleFor(e)?.title||'Employee')}</option>`).join(''):'<option value="">No active employee in the appropriate department</option>';
  const preview=document.getElementById('officePlanPreview');
  if(preview&&template)preview.innerHTML=`<strong>Trigger:</strong> ${esc(template.trigger)}<br><strong>Steps:</strong> ${esc(template.steps)}<br><strong>Status:</strong> Disabled until verified server integration.`;
}
function showGuide(provider){
  const p=catalog.find(x=>x.name===provider), box=document.getElementById('officeIntegrationGuide');
  if(!p||!box)return;
  box.innerHTML=`<h3>${esc(p.name)} — ${esc(p.method)}</h3>
    <p>${esc(p.desc)}</p>
    <p><strong>Recommended: on-computer browser.</strong> Open Desktop AI Workstations from the card, launch the visible browser on your computer, sign in manually on the actual website, and authorize an eligible employee later when you create an assignment. No separate platform developer account is needed for this login. This process runs only while your desktop service is running.</p><p><strong>Optional: official API/OAuth.</strong> If you later prefer API integrations, developer app registration, authorized scopes and server-side credentials may be required.</p>
    <p class="notice">${esc(p.warning)}</p><a href="${esc(p.docs)}" class="btn btn-primary btn-sm" target="_blank" rel="noopener noreferrer">Open official setup ↗</a>
    <p class="tiny muted">Select Open secure connection to sign in to Cloud HQ and attempt the official provider OAuth flow. Some services have no supported OAuth API. Login credentials and tokens are never entered here.</p>`;
  box.scrollIntoView({block:'nearest',behavior:'smooth'});
}
document.addEventListener('click',event=>{
  const desktop=event.target.closest('[data-desktop-site]');
  if(desktop){sessionStorage.setItem('officehq_desktop_preferred_site',desktop.dataset.desktopSite||'gmail');B.setView('workstations');return;}
  const setup=event.target.closest('[data-connect-guide]');
  if(setup){showGuide(setup.dataset.connectGuide);return;}
  const del=event.target.closest('[data-delete-plan]');
  if(!del)return;
  const plans=record(),item=plans.find(p=>p.id===del.dataset.deletePlan&&p.companyId===companyId());
  if(!item)return;
  state().enterprise.integrationPlans=plans.filter(p=>p.id!==item.id);
  B.addActivity('You · CEO','Deleted disabled workflow plan: '+item.label,'settings',item.companyId);
  B.save();B.setView('connections');B.toast('Workflow plan deleted.');
});
document.addEventListener('change',event=>{
  if(event.target.id==='officePlanTemplate')employeeOptions();
  if(event.target.id==='companyPicker')queueMicrotask(()=>{if(document.getElementById('officePlanEmployee'))employeeOptions();});
});
document.addEventListener('submit',event=>{
  if(event.target.id!=='officePlanForm')return;
  event.preventDefault();
  const data=Object.fromEntries(new FormData(event.target));
  const template=tmpl(data.template),worker=availableEmployees(template,companyId()).find(e=>e.id===data.employeeId);
  if(!template||!worker||!data.label?.trim()){B.toast('Choose a template, active authorized department employee and job title.','error');return;}
  record().push({id:B.uid('intplan'),companyId:companyId(),template:template.id,employeeId:worker.id,label:data.label.trim().slice(0,100),approval:data.approval==='policy'?'policy':'always',enabled:false,createdAt:new Date().toISOString()});
  B.addActivity('You · CEO','Saved disabled integration workflow plan: '+data.label.trim(),'settings',companyId());
  B.save();B.setView('connections');B.toast('Workflow plan saved. Not running: OAuth, task execution and server security are still required.');
});
if(location.hash.replace('#/','')==='connections')B.setView('connections');
const observer=new MutationObserver(()=>{if(document.getElementById('officePlanTemplate')&&document.getElementById('officePlanEmployee')?.options.length===0)employeeOptions();});
observer.observe(document.getElementById('view'),{childList:true,subtree:false});
})();