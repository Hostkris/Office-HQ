/* iPhone/iPad Safari companion. Ordinary websites CANNOT control third-party tabs.
   Guided tasks work directly in iOS browsers; owner-triggered website assistance
   is available only after installing the separately packaged Safari extension. */
(()=>{
'use strict';
const B=window.OfficeHQBridge,$=s=>document.querySelector(s),E=B?.E;
if(!B||!window.OfficeHQExtraViews)return;
const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(!ios)return;
const extAllowed=/Safari/i.test(navigator.userAgent)&&!/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
const SITES=[
 ['gmail','Gmail','https://mail.google.com/',['Customer','Leadership','Marketing','Sales','PMO']],
 ['google','Google Search','https://www.google.com/',['Technology','Marketing','Leadership','PMO','Sales','Customer']],
 ['instagram','Instagram','https://www.instagram.com/',['Marketing']],
 ['facebook','Facebook','https://www.facebook.com/',['Marketing']],
 ['tiktok','TikTok','https://www.tiktok.com/',['Marketing']],
 ['x','X (Twitter)','https://x.com/',['Marketing']],
 ['shopify','Shopify','https://admin.shopify.com/',['Sales','Product','Marketing','Customer','Operations','Finance']],
 ['etsy','Etsy','https://www.etsy.com/',['Sales','Product','Marketing','Customer','Operations']],
 ['calendar','Google Calendar','https://calendar.google.com/',['Leadership','PMO','People']],
 ['drive','Google Drive','https://drive.google.com/',['Leadership','PMO','Technology']],
 ['youtube','YouTube','https://www.youtube.com/',['Marketing']],
 ['chatgpt','ChatGPT website','https://chatgpt.com/',['Technology','Leadership','Marketing']],
 ['lemon8','Lemon8','https://www.lemon8-app.com/',['Marketing']],
 ['icloud','iCloud (review only)','https://www.icloud.com/',['Leadership','PMO','Customer']],
 ['chime','Chime (review only)','https://www.chime.com/',['Finance','Audit','Leadership']],
 ['lemonade','Lemonade (review only)','https://www.lemonade.com/',['Finance','Audit','Leadership']]
];
const site=id=>SITES.find(row=>row[0]===id);
const company=()=>$('#companyPicker')?.value==='all'||!$('#companyPicker')?.value?B.getState().companies[0]?.id:$('#companyPicker').value;
const workers=id=>B.getState().employees.filter(x=>x.active&&x.companyId===company()&&site(id)?.[3].includes(B.roleFor(x)?.dept));
function records(){const state=B.getState();state.enterprise??={};state.enterprise.iosJobs??=[];return state.enterprise.iosJobs;}
const state={extension:false,checked:false,grants:[],busy:false,notice:''};
const channel='officehq-ios-web-v1',pending=new Map();
window.addEventListener('message',event=>{
 if(event.source!==window||event.origin!==location.origin)return;
 const data=event.data;
 if(data?.channel!==channel||data.sender!=='officehq-extension')return;
 const request=pending.get(data.id);if(!request)return;
 clearTimeout(request.timeout);pending.delete(data.id);request.resolve(data.response);
});
function ext(command,payload={},timeout=1900){
 return new Promise((resolve,reject)=>{
  const id=crypto.randomUUID?.()||String(Date.now())+Math.random().toString(16).slice(2);
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('Safari extension is not installed, is disabled, or has no permission for Office HQ.'));},timeout);
  pending.set(id,{resolve,timeout:timer});
  window.postMessage({channel,sender:'officehq-page',id,command,payload},location.origin);
 });
}
async function status(){
 if(!extAllowed){state.checked=true;state.extension=false;return;}
 try{const r=await ext('status',{companyId:company()},1800);state.extension=!!r?.ok;state.grants=r?.grants||[];}
 catch{state.extension=false;state.grants=[];}
 state.checked=true;
 updateDynamic();
}
const base=window.OfficeHQExtraViews.workstations;
window.OfficeHQExtraViews.workstations=()=>{
 const preferred=sessionStorage.getItem('officehq_desktop_preferred_site')||'gmail';
 if(!site(preferred))sessionStorage.setItem('officehq_desktop_preferred_site','gmail');
 const current=site(preferred)?preferred:'gmail';
 const all=records().filter(t=>t.companyId===company()).slice(-24).reverse();
 const statusText=!extAllowed?'Guided mode (Safari extension requires Safari)':state.checked?(state.extension?'Safari extension detected':'Guided mode · Safari extension not installed'):'Checking Safari extension…';
 setTimeout(()=>void status(),150);
 return '<div class="page-head"><div class="eyebrow">IPHONE + IPAD · SAFARI</div><h1>iOS browser workstations</h1>'+
 '<p class="muted">Manage your employees and open your own logged-in websites directly from your iPhone or iPad. No desktop computer or cloud browser is required for guided tasks.</p></div>'+
 '<section class="card ios-guide"><div class="section-top"><h2>iOS browser status</h2><span class="ops-tag" id="iosStatus">'+E(statusText)+'</span></div>'+
 '<p><strong>Available now:</strong> choose a website, sign in yourself, assign work, track handoffs, and save task notes in the iOS browser.</p>'+
 '<p><strong>Optional extension:</strong> a Safari web extension can, once packaged and installed, read the currently open webpage or insert a draft with your specific permission. That extension is <em>not installed by opening this site</em>, and autonomous multi-site AI operation is not available in ordinary iOS web tabs.</p>'+
 '<p class="tiny muted">Apple requires a separately distributed Safari extension for code to interact with other websites. No browser can safely inherit your website passwords just from tapping Authorize in Office HQ.</p>'+'<p class="small"><a href="https://github.com/Hostkris/Office-HQ/blob/main/agent-office-hq/docs/IOS_SAFARI_SETUP.md" target="_blank" rel="noopener noreferrer">iPhone/iPad Safari setup and extension limitations ↗</a></p></section>'+
 '<div class="desktop-grid ios-grid"><section class="card"><h2>① Choose website and sign in</h2>'+
 '<label class="desktop-label">Website<select id="iosSite">'+SITES.map(s=>'<option value="'+E(s[0])+'"'+(current===s[0]?' selected':'')+'>'+E(s[1])+'</option>').join('')+'</select></label>'+
 '<p id="iosSiteHint" class="muted small">Sign in yourself. Office HQ never asks for your website password.</p>'+
 '<a class="btn btn-primary ios-go" id="iosOpenSite" href="'+E(site(current)[2])+'" target="_blank" rel="noopener noreferrer">🌐 Open '+E(site(current)[1])+' in Safari ↗</a>'+
 '<label class="desktop-label">AI employee<select id="iosWorker"></select></label>'+
 '<label class="desktop-check"><input type="checkbox" id="iosConsent"> I have signed into this website myself and permit this employee to assist with assigned work.</label>'+
 '<button class="btn" type="button" data-ios="authorize">✓ Authorize Safari extension worker</button>'+
 '<p class="tiny muted">This button requires the Safari extension to be installed and permitted by iOS. Guided task planning works without it.</p></section>'+
 '<section class="card"><h2>② Assign an iOS task</h2>'+
 '<label class="desktop-label">Instructions<textarea id="iosInstructions" maxlength="1600" placeholder="Example: Review my visible Etsy orders and list anything needing my attention."></textarea></label>'+
 '<button class="btn btn-primary" type="button" data-ios="assign">＋ Save worker assignment</button>'+
 '<p class="tiny muted">This creates a real saved Office HQ assignment, <strong>not an autonomous browser job</strong>. With the Safari extension installed, you can ask a worker to inspect the open site for information. Without it, follow the assignment manually.</p></section></div>'+
 '<section class="card ios-results" style="margin-top:18px"><div class="section-top"><h2>③ Work assignments and handoffs</h2><button class="btn btn-sm" data-ios="check">↻ Check extension</button></div>'+
 '<div id="iosJobs">'+(all.length?all.map(jobRow).join(''):'<p class="muted">No iOS Safari jobs assigned yet.</p>')+'</div></section>'+
 '<section class="card" style="margin-top:18px"><h2>④ Employee access</h2><div id="iosGrants">'+grantMarkup()+'</div>'+
 '<p class="tiny muted">For extension access, revoke each employee below. Browser login and cookies remain under Safari settings; revoke access here does not sign you out of Gmail, Instagram or other websites.</p></section>'+
 '<p class="notice" id="iosNotice" role="status" aria-live="polite">'+E(state.notice)+'</p>';
};
function jobRow(t){
 const id=E(t.id),worker=B.getEmployee(t.employeeId);
 const active=t.status==='queued'||t.status==='review'||t.status==='running';
 return '<article class="desktop-job"><div class="desktop-job-heading"><strong>'+E(worker?.name||'Former employee')+' · '+E(site(t.site)?.[1]||t.site)+'</strong><span class="ops-tag">'+E(t.status||'queued')+'</span></div>'+
 '<p>'+E(t.instructions||'')+'</p><p class="desktop-thought">💭 '+E(t.thought||'Assignment saved; waiting for owner.')+'</p>'+
 (t.observation?'<p class="desktop-summary"><strong>Visible-page excerpt (not AI analysis):</strong> '+E(t.observation).replace(/\n/g,'<br>')+'</p>':'')+
 '<div class="desktop-actions">'+
 (active?'<button class="btn btn-sm" data-ios="inspect" data-job="'+id+'">⌕ Inspect open site (extension)</button>':'')+
 (active?'<button class="btn btn-sm" data-ios="manual" data-job="'+id+'">✓ Mark manually completed</button>':'')+
 (active?'<button class="btn btn-sm" data-ios="pause" data-job="'+id+'">⏸ Pause</button>':'')+
 (t.status==='paused'?'<button class="btn btn-sm" data-ios="resume" data-job="'+id+'">▶ Resume</button>':'')+
 (t.status==='completed'?'<div class="ios-handoff"><label class="desktop-label">Next employee<select data-ios-recipient="'+id+'">'+'<option value="">Choose employee</option>'+workers(t.site).filter(w=>w.id!==t.employeeId).map(w=>'<option value="'+E(w.id)+'">'+E(w.name)+'</option>').join('')+'</select></label>'+'<button class="btn btn-sm" data-ios="handoff" data-job="'+id+'">⇥ Hand off</button></div>':'')+
 '</div>'+
 (active?'<div class="ios-insert"><label class="desktop-label">Optional draft to insert in a selected text field <textarea data-ios-draft="'+id+'" maxlength="450" rows="2" placeholder="Write text to be inserted; not sent or published."></textarea></label>'+
 '<button class="btn btn-sm" data-ios="insert" data-job="'+id+'">Insert draft (extension)</button></div>':'')+
 '<small class="muted">Job saved locally on this iOS browser. Not a background autonomous AI process.</small></article>';
}
function grantMarkup(){
 return state.grants.length?state.grants.map(g=>'<div class="desktop-grant"><div><strong>'+E(g.employeeName)+'</strong> · '+E(site(g.site)?.[1]||g.site)+'</div>'+
 '<button class="btn btn-sm" data-ios="revoke" data-worker="'+E(g.employeeId)+'" data-site="'+E(g.site)+'">Revoke access</button></div>').join(''):
 '<p class="muted">No Safari extension grants visible. You can still plan guided tasks.</p>';
}
function currentStaff(){return workers($('#iosSite')?.value||'gmail');}
function updateDynamic(){
 const h=$('#iosStatus');if(h)h.textContent=!extAllowed?'Guided only (Safari extension requires Safari)':state.extension?'Safari extension connected':'Guided mode · extension not installed';
 const grants=$('#iosGrants');if(grants)grants.innerHTML=grantMarkup();
 const employee=$('#iosWorker');if(employee){
  const old=employee.value,staff=currentStaff();
  employee.innerHTML='<option value="">Choose eligible employee</option>'+staff.map(w=>'<option value="'+E(w.id)+'">'+E(w.name)+' · '+E(B.roleFor(w)?.dept||'')+'</option>').join('');
  if(staff.some(w=>w.id===old))employee.value=old;
 }
}
function syncThoughts(){
 const map={};
 for(const t of records().filter(x=>x.companyId===company()).slice().reverse()){
  if(!map[t.employeeId]&&['queued','review','running','paused'].includes(t.status))map[t.employeeId]=t.thought;
 }
 window.OfficeHQDesktopThoughts={...(window.OfficeHQDesktopThoughts||{}),...map};
}
function renderAgain(){B.save();syncThoughts();B.setView('workstations');}
function feedback(msg,bad=false){state.notice=String(msg).slice(0,450);const el=$('#iosNotice');if(el){el.textContent=state.notice;el.style.color=bad?'var(--red)':'var(--turq)';}if(bad)B.toast(state.notice,'error');}
async function doAction(op,node){
 const siteId=$('#iosSite')?.value||'gmail',employee=currentStaff().find(e=>e.id===$('#iosWorker')?.value);
 if(op==='check'){await status();feedback(state.extension?'Safari extension detected.':'No Safari extension is installed or authorized yet. Guided mode remains available.');return;}
 if(op==='authorize'){
  if(!employee)throw Error('Choose an employee eligible for this website.');
  if(!$('#iosConsent').checked)throw Error('Confirm that you logged in yourself and authorize this specific employee.');
  const r=await ext('authorize',{companyId:company(),employeeId:employee.id,employeeName:employee.name,department:B.roleFor(employee)?.dept,site:siteId,confirmed:true});
  if(!r.ok)throw Error(r.error||'Safari authorization failed.');
  await status();feedback(r.note||'Safari employee authorized.');return;
 }
 if(op==='assign'){
  if(!employee)throw Error('Choose an active employee for this website.');
  const instructions=$('#iosInstructions')?.value.trim()||'';
  if(instructions.length<10)throw Error('Enter at least ten characters explaining the assignment.');
  records().push({id:B.uid('iosjob'),companyId:company(),employeeId:employee.id,site:siteId,instructions:instructions.slice(0,1600),
    thought:'Task queued in iOS. Open the site and perform it manually, or inspect via Safari extension.',
    status:'queued',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  if(records().length>150)records().splice(0,records().length-150);
  B.addActivity(employee.name,'Assigned iOS Safari guided task: '+instructions.slice(0,110),'task',company());
  renderAgain();return;
 }
 if(op==='revoke'){
  const r=await ext('revoke',{companyId:company(),employeeId:node.dataset.worker,site:node.dataset.site});
  if(!r.ok)throw Error(r.error);
  await status();feedback(r.note||'Access revoked.');return;
 }
 const job=records().find(t=>t.id===node.dataset.job&&t.companyId===company());
 if(!job)throw Error('Choose an existing assignment.');
 if(op==='pause'){job.status='paused';job.thought='Paused by owner.';renderAgain();return;}
 if(op==='resume'){job.status='queued';job.thought='Owner resumed iOS task.';renderAgain();return;}
 if(op==='manual'){
  if(!confirm('Confirm that you personally completed this assignment. No AI action will be claimed.'))return;
  job.status='completed';job.thought='Owner confirmed the manual work was completed.';
  B.addActivity(B.getEmployee(job.employeeId)?.name||'Employee','iOS task manually marked complete: '+job.instructions.slice(0,100),'task',job.companyId);
  renderAgain();return;
 }
 if(op==='handoff'){
  sessionStorage.setItem('officehq_ios_handoff',job.id);
  const other=workers(job.site).filter(e=>e.id!==job.employeeId);
  if(!other.length){feedback('Hire or select a different active employee in the right department before handing off.',true);return;}
  const chosen=$('[data-ios-recipient="'+CSS.escape(job.id)+'"]')?.value;
  const recipient=other.find(e=>e.id===chosen);
  if(!recipient)throw Error('Choose which authorized department employee should receive this handoff.');
  records().push({id:B.uid('iosjob'),companyId:job.companyId,employeeId:recipient.id,site:job.site,
   instructions:('Follow up on prior assignment: '+job.instructions+' · '+(job.observation||job.thought)).slice(0,1600),
   thought:'Handoff saved from completed task. Awaiting browser review.',status:'queued',parentJobId:job.id,
   createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  renderAgain();return;
 }
 if(op==='inspect'){
  job.status='review';job.thought='Reading the visible website with owner-requested Safari extension action.';
  const r=await ext('inspect',{companyId:job.companyId,employeeId:job.employeeId,site:job.site},7000);
  if(!r.ok){job.status='paused';job.thought='Safari extension needs attention: '+(r.error||'Unknown problem');renderAgain();return;}
  job.observation=String(r.excerpt||'').slice(0,1600);job.status='review';
  job.thought='Website inspection returned visible text. Review findings and decide next action.';
  renderAgain();return;
 }
 if(op==='insert'){
  const draft=$('[data-ios-draft="'+CSS.escape(job.id)+'"]')?.value||'';
  if(!draft.trim())throw Error('Enter a draft before inserting it into the selected field.');
  if(['chime','lemonade','icloud'].includes(job.site))throw Error('Sensitive sites cannot be modified by a Safari worker.');
  if(!confirm('This may trigger auto-save on some websites. Have you selected the intended text field on the website, and do you approve inserting this exact draft?'))return;
  const r=await ext('insert',{companyId:job.companyId,employeeId:job.employeeId,site:job.site,draft},7000);
  if(!r.ok)throw Error(r.error);
  job.thought=String(r.note||'Draft inserted, not published').slice(0,160);
  job.status='review';renderAgain();return;
 }
}
syncThoughts();
document.addEventListener('change',event=>{
 if(event.target.id==='iosSite'){
  sessionStorage.setItem('officehq_desktop_preferred_site',event.target.value);
  const link=$('#iosOpenSite'),s=site(event.target.value);
  if(link&&s){link.href=s[2];link.textContent='🌐 Open '+s[1]+' in Safari ↗';}
  updateDynamic();
 }
 if(event.target.id==='companyPicker')setTimeout(()=>{void status();},120);
});
document.addEventListener('click',event=>{
 const node=event.target.closest('[data-ios]');if(!node)return;
 event.preventDefault();if(state.busy)return;state.busy=true;
 void doAction(node.dataset.ios,node).catch(e=>feedback(e.message||'This action could not be completed.',true)).finally(()=>{state.busy=false;});
});
})();
