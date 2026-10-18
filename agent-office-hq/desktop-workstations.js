/* Office HQ desktop workstations. Browser control is available only on the owner's computer.
   The GitHub Pages version presents setup; it never attempts to control localhost remotely. */
(function(){
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews)return;
const E=B.E, $=s=>document.querySelector(s);
const isDesktop=['localhost','127.0.0.1'].includes(location.hostname);
const fallback=[
  ['google','Google Search'],['gmail','Gmail'],['instagram','Instagram'],['facebook','Facebook'],
  ['tiktok','TikTok'],['lemon8','Lemon8'],['chatgpt','ChatGPT website'],['x','X (Twitter)'],['shopify','Shopify'],['etsy','Etsy'],
  ['youtube','YouTube'],['calendar','Google Calendar'],['drive','Google Drive'],
  ['icloud','iCloud'],['chime','Chime (view only)'],['lemonade','Lemonade (view only)']
];
let latest={sites:[],grants:[],jobs:[],aiReady:false};
let lastJobState={},fetching=false;
window.OfficeHQDesktopThoughts={};
const cid=()=>$('#companyPicker')?.value==='all'||!$('#companyPicker')?.value?B.getState().companies[0]?.id:$('#companyPicker').value;
const staff=()=>B.getState().employees.filter(e=>e.companyId===cid()&&e.active);
const selectedSite=()=>$('#deskSite')?.value||'gmail';
const grantFor=id=>latest.grants.find(g=>g.id===id&&g.active);
const role=e=>B.roleFor(e)||{};
const siteData=id=>latest.sites.find(p=>p.id===id);
const employeesFor=id=>staff().filter(e=>(siteData(id)?.departments||[]).includes(role(e).dept));
const controlLabel=(v,label)=>'<label class="desktop-label">'+label+'<span>'+v+'</span></label>';
function render(){
  const header='<div class="page-head"><div><div class="eyebrow">PRIVATE COMPUTER · REAL BROWSER CONTROL</div><h1>Employee browser workstations</h1><p class="muted">Your AI employees work in visible browsers on your computer. You personally log in, grant specific employee access, and review sensitive actions.</p></div></div>';
  if(!isDesktop)return header+'<section class="card desktop-start"><h2>Start on your computer — no cloud browser</h2>'+
    '<p>Office HQ can run real browser workers on a Windows, Mac, or Linux computer. The public GitHub Pages version cannot access your local computer or saved browser sessions.</p>'+
    '<p>Install Node.js 22+, download or clone your Office HQ GitHub repository, then open a terminal in its <code>agent-office-hq</code> folder. Run:</p>'+
    '<pre>npm install\nnpx playwright install chromium\nnpm run dev</pre>'+
    '<p>Next, on that same computer, open <strong>http://127.0.0.1:3000/#/workstations</strong>. Sign into a website manually in the desktop browser window, then authorize a worker.</p>'+
    '<p>For optional AI-operated tasks, configure a local Ollama vision model (no API key), or put an OpenAI API key in a private <code>.env</code> file, then use <code>npm run dev:env</code>. Model screenshots are sent to the AI provider only while the job is running. Your browser and login session stay on your computer.</p>'+
    '<p class="notice">The website cannot run computer automation from an iPad alone. When the computer is closed, tasks pause; saved plans can be resumed after restarting.</p></section>';
  const sites=(latest.sites.length?latest.sites.map(s=>[s.id,s.name]):fallback);
  const preferred=sessionStorage.getItem('officehq_desktop_preferred_site')||'gmail';
  return header+'<section class="card desktop-intro"><h2>Local workstation connection</h2>'+
    '<p><span class="desktop-dot"></span> Browser runner: <strong id="deskConnection">Checking this computer…</strong> · AI decisions: <strong id="deskAi">Checking…</strong></p>'+
    '<p class="tiny muted">Your passwords are typed directly into the website, never Office HQ. Browser sessions remain on this computer. Chrome/Chromium may still require occasional login verification.</p></section>'+
    '<div class="desktop-grid"><section class="card"><h2>① Open a website and sign in</h2>'+
    controlLabel('<select id="deskSite">'+sites.map(p=>'<option value="'+E(p[0])+'"'+(preferred===p[0]?' selected':'')+'>'+E(p[1])+'</option>').join('')+'</select>','Website')+
    '<button class="btn btn-primary" type="button" data-desk="open">🌐 Open website in desktop browser</button>'+
    '<p class="small muted">Sign in normally in the browser window. If asked for a password or verification code, enter it yourself. The bot never needs it.</p>'+
    controlLabel('<select id="deskWorker"></select>','Which employee may use this website?')+
    '<label class="desktop-check"><input id="deskOwnerConfirm" type="checkbox"> I personally signed in and authorize the selected employee to use this browser for assigned work.</label>'+
    '<button class="btn" type="button" data-desk="authorize">✓ Authorize this employee</button>'+
    '<p class="tiny muted">Only employees from permitted departments are shown. This is a single-owner local desktop permission, not a multi-user enterprise authentication system.</p></section>'+
    '<section class="card"><h2>② Assign work to an authorized employee</h2>'+
    controlLabel('<select id="deskGrant"></select>','Authorized employee and website')+
    controlLabel('<select id="deskMode"><option value="observe">Review / gather information</option><option value="draft">Prepare draft text (no automatic submission)</option></select>','Type of assignment')+
    controlLabel('<textarea id="deskPrompt" maxlength="1600" placeholder="Example: Open my Etsy shop dashboard, check the visible order list, and summarize which orders need my attention. Do not purchase, refund or change account settings."></textarea>','Job instructions')+
    '<button class="btn btn-primary" type="button" data-desk="run">▶ Start employee task</button>'+
    '<p class="small muted">AI jobs require a private AI model key or an on-computer Ollama vision model. Each job has a step limit. Sending, posting and other risky clicks stop for CEO approval. Banking and insurance remain read-only.</p></section></div>'+
    '<section class="card" style="margin-top:18px"><div class="section-top"><h2>③ Live employee activity and approvals</h2><button class="btn btn-sm" data-desk="refresh">↻ Refresh</button></div>'+
    '<div id="deskJobs" class="desktop-jobs"><p class="muted">No active browser tasks.</p></div></section>'+
    '<section class="card" style="margin-top:18px"><h2>④ Session access and privacy</h2>'+
    '<p class="muted">Revoke access to stop one employee from using a website. Forget session deletes this computer’s browser profile for the selected website and revokes all employees assigned to it. Close your browser after finishing sign-in; the runner will reopen it as needed.</p>'+
    '<div id="deskGrants" class="desktop-permissions"></div></section>'+
    '<p id="deskNotice" class="notice" role="status" aria-live="polite"></p>';
}
window.OfficeHQExtraViews.workstations=render;
function notice(message,bad=false){
  const p=$('#deskNotice');if(p){p.textContent=message;p.style.color=bad?'var(--red)':'var(--turq)';}
  else if(bad)B.toast(message,'error');
}
async function api(body){
  const r=await fetch('/api/desktop/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||'Desktop operation unsuccessful');
  return data;
}
async function refresh(){
  if(!isDesktop||fetching)return;
  fetching=true;
  try{
    const r=await fetch('/api/desktop/status?companyId='+encodeURIComponent(cid()||''),{cache:'no-store'});
    if(!r.ok)throw Error('Local desktop service is not available.');
    latest=await r.json();
    renderStatus();thoughtsAndTasks();
  }catch(e){const x=$('#deskConnection');if(x)x.textContent='Local service offline';}
  finally{fetching=false;}
}
function renderStatus(){
  const con=$('#deskConnection'),ai=$('#deskAi');
  if(con)con.textContent='Connected on this computer';
  if(ai)ai.textContent=latest.aiReady?'Model key configured':'Manual login only · AI model key needed';
  if(!$('#deskSite'))return;
  const site=selectedSite(),workers=employeesFor(site);
  const selected=$('#deskWorker').value;
  $('#deskWorker').innerHTML=workers.length?
    '<option value="">Select a worker</option>'+workers.map(e=>'<option value="'+E(e.id)+'">'+E(e.name)+' · '+E(role(e).title||role(e).dept)+'</option>').join(''):
    '<option value="">No matching active employees</option>';
  if(workers.some(e=>e.id===selected))$('#deskWorker').value=selected;
  const grantSel=$('#deskGrant'),existing=grantSel.value,active=latest.grants.filter(g=>g.active);
  grantSel.innerHTML=active.length?'<option value="">Choose an authorized employee</option>'+
    active.map(g=>'<option value="'+E(g.id)+'">'+E(g.employeeName)+' · '+E(siteData(g.site)?.name||g.site)+'</option>').join(''):
    '<option value="">Authorize an employee first</option>';
  if(active.some(g=>g.id===existing))grantSel.value=existing;
  const selectedGrant=grantFor(grantSel.value);
  if(selectedGrant&&['chime','icloud','lemonade'].includes(selectedGrant.site))$('#deskMode').value='observe';
  const grants=$('#deskGrants');
  if(grants)grants.innerHTML=active.length?active.map(g=>'<div class="desktop-grant"><div><strong>'+E(g.employeeName)+'</strong> · '+E(siteData(g.site)?.name||g.site)+
    '<small>'+E(g.sessionOpen?'Browser open':'Browser session saved locally')+'</small></div><div class="desktop-actions">'+
    '<button class="btn btn-sm" data-desk="revoke" data-grant="'+E(g.id)+'">Revoke worker</button>'+
    '<button class="btn btn-sm btn-danger" data-desk="forget" data-company="'+E(g.companyId)+'" data-site="'+E(g.site)+'">Forget session</button></div></div>').join(''):
    '<p class="muted">No employees have access to a desktop browser yet.</p>';
  renderJobs();
}
function jobCard(job){
  const status=job.status.replaceAll('_',' ');
  const logs=(job.log||[]).slice(-4).map(l=>'<small>'+E(new Date(l.at).toLocaleTimeString())+' · '+E(l.note)+'</small>').join('');
  const possible=latest.grants.filter(g=>g.active&&g.companyId===job.companyId);
  return '<article class="desktop-job"><div class="desktop-job-heading"><strong>'+E(job.employeeName)+' · '+E(siteData(job.site)?.name||job.site)+
   '</strong><span class="ops-tag">'+E(status)+'</span></div><p><strong>Task:</strong> '+E(job.prompt.slice(0,350))+'</p>'+
   '<p class="desktop-thought">💭 '+E(job.thought||'Waiting')+'</p>'+
   (job.summary?'<p class="desktop-summary"><strong>Verified work summary:</strong> '+E(job.summary)+'</p>':'')+
   (job.approval?'<div class="desktop-approval"><strong>CEO decision required:</strong> '+E(job.approval.description)+
      '<p class="tiny">Review the exact control in the open browser. Approval permits one click, not unlimited publishing or spending.</p>'+
      '<button class="btn btn-primary btn-sm" data-desk="approve" data-job="'+E(job.id)+'">✓ Approve one click</button> '+
      '<button class="btn btn-danger btn-sm" data-desk="reject" data-job="'+E(job.id)+'">✕ Reject</button></div>':'')+
   '<div class="desktop-actions">'+
   (job.status==='running'?'<button class="btn btn-sm" data-desk="pause" data-job="'+E(job.id)+'">⏸ Pause</button>':'')+
   (job.status==='paused'?'<button class="btn btn-sm" data-desk="resume" data-job="'+E(job.id)+'">▶ Resume</button>':'')+
   '</div>'+logs+
   (job.status==='completed'&&possible.length?'<div class="desktop-handoff"><h4>Pass the result to another employee</h4>'+
     '<select data-handoff-grant="'+E(job.id)+'"><option value="">Choose the next employee</option>'+
     possible.filter(g=>g.employeeId!==job.employeeId).map(g=>'<option value="'+E(g.id)+'">'+E(g.employeeName)+' · '+E(siteData(g.site)?.name||g.site)+'</option>').join('')+'</select>'+
     '<input data-handoff-prompt="'+E(job.id)+'" placeholder="Instructions for the next employee" maxlength="900">'+
     '<button class="btn btn-sm" data-desk="handoff" data-job="'+E(job.id)+'">⇥ Start handoff</button></div>':'')+
   '</article>';
}
function renderJobs(){
  const host=$('#deskJobs');if(!host)return;
  const draftValues=new Map();
  host.querySelectorAll('[data-handoff-prompt]').forEach(input=>{const id=input.dataset.handoffPrompt;draftValues.set(id,{prompt:input.value,grant:host.querySelector('[data-handoff-grant="'+CSS.escape(id)+'"]')?.value});});
  host.innerHTML=latest.jobs.length?latest.jobs.slice(0,15).map(jobCard).join(''):'<p class="muted">No browser tasks yet.</p>';
  for(const [id,data] of draftValues){const p=host.querySelector('[data-handoff-prompt="'+CSS.escape(id)+'"]'),g=host.querySelector('[data-handoff-grant="'+CSS.escape(id)+'"]');if(p)p.value=data.prompt;if(g)g.value=data.grant||'';}
}
function thoughtsAndTasks(){
  const thoughts={};for(const j of latest.jobs){
    if(!thoughts[j.employeeId]&&['running','paused','awaiting_approval'].includes(j.status))thoughts[j.employeeId]=j.thought;
    const old=lastJobState[j.id];lastJobState[j.id]=j.status;
    const t=B.getState().tasks.find(t=>t.desktopJobId===j.id);
    if(t){
      const status=j.status==='completed'?'done':j.status==='running'?'in_progress':j.status==='awaiting_approval'?'review':j.status==='cancelled'?'blocked':'blocked';
      if(t.status!==status||j.status==='completed'&&t.output!==j.summary){
        t.status=status;t.updatedAt=new Date().toISOString();if(j.status==='completed')t.output=j.summary;
        B.save();
      }
    }
    if(old&&old!=='completed'&&j.status==='completed')B.addActivity(j.employeeName,'Completed desktop website job: '+j.prompt.slice(0,100),'task',j.companyId);
  }
  window.OfficeHQDesktopThoughts=thoughts;
}
function syncWorkers(){
  const elem=$('#deskWorker');if(!elem)return;
  const eligible=employeesFor(selectedSite()),old=elem.value;
  elem.innerHTML=eligible.length?'<option value="">Select a worker</option>'+eligible.map(e=>
    '<option value="'+E(e.id)+'">'+E(e.name)+' · '+E(role(e).title||'Employee')+'</option>').join(''):
    '<option value="">No matching active employees</option>';
  if(eligible.some(e=>e.id===old))elem.value=old;
}
function createOfficeTask(jobId,prompt,employee){
  const dept=role(employee),s=B.getState();
  s.tasks.unshift({id:B.uid('task'),companyId:cid(),title:'Desktop: '+prompt.slice(0,75),description:prompt,
    scope:dept.scope,ownerId:employee.id,status:'in_progress',priority:'Normal',due:new Date().toLocaleDateString('en-CA'),
    createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),output:'',desktopJobId:jobId});
  B.save();
}
async function click(action,el){
  if(action==='refresh')return refresh();
  if(action==='open'){
    const result=await api({action:'open',companyId:cid(),site:selectedSite()});
    notice(result.note);return refresh();
  }
  if(action==='authorize'){
    const employee=staff().find(e=>e.id===$('#deskWorker')?.value);
    if(!employee)throw Error('Choose an active employee from the appropriate department.');
    const result=await api({action:'authorize',companyId:cid(),employeeId:employee.id,employeeName:employee.name,
      department:role(employee).dept,site:selectedSite(),ownerConfirmed:$('#deskOwnerConfirm')?.checked===true});
    notice(result.notice);$('#deskOwnerConfirm').checked=false;return refresh();
  }
  if(action==='run'){
    const grant=grantFor($('#deskGrant')?.value),prompt=$('#deskPrompt')?.value?.trim();
    if(!grant)throw Error('Authorize and select an employee first.');
    if(!prompt||prompt.length<10)throw Error('Give your employee a specific assignment.');
    const result=await api({action:'run',grantId:grant.id,companyId:grant.companyId,prompt,mode:$('#deskMode').value});
    const employee=B.getEmployee(grant.employeeId);
    if(employee)createOfficeTask(result.jobId,prompt,employee);
    notice('AI browser job started. Watch the browser window and live progress below.');await refresh();return;
  }
  if(action==='revoke'){
    if(!confirm('Revoke this AI employee’s authorization for the website?'))return;
    await api({action:'revoke',grantId:el.dataset.grant});notice('Employee access revoked.');return refresh();
  }
  if(action==='forget'){
    if(!confirm('Delete this website browser session on this computer? You may need to log in again, and ALL employee permissions for this site will be revoked.'))return;
    await api({action:'forget',companyId:el.dataset.company,site:el.dataset.site,confirm:'FORGET'});
    notice('Local browser profile erased and employee permissions revoked.');return refresh();
  }
  if(['pause','resume','approve','reject'].includes(action)){
    await api({action,jobId:el.dataset.job});notice('Job instruction received: '+action+'.');return refresh();
  }
  if(action==='handoff'){
    const id=el.dataset.job,grant=$('[data-handoff-grant="'+CSS.escape(id)+'"]')?.value,prompt=$('[data-handoff-prompt="'+CSS.escape(id)+'"]')?.value?.trim();
    const g=grantFor(grant);if(!g||!prompt||prompt.length<10)throw Error('Choose a different authorized employee and give instructions.');
    const out=await api({action:'handoff',companyId:g.companyId,grantId:g.id,parentJobId:id,prompt,mode:'observe'});
    const employee=B.getEmployee(g.employeeId);if(employee)createOfficeTask(out.jobId,prompt,employee);
    notice('Handoff started for '+g.employeeName+'.');return refresh();
  }
}
document.addEventListener('click',ev=>{
  const b=ev.target.closest('[data-desk]');if(!b)return;
  ev.preventDefault();void click(b.dataset.desk,b).catch(e=>notice(e.message||'Action could not be completed.',true));
});
document.addEventListener('change',ev=>{
  if(ev.target.id==='deskSite'){sessionStorage.setItem('officehq_desktop_preferred_site',ev.target.value);syncWorkers();}
  if(ev.target.id==='deskGrant'&&['chime','icloud','lemonade'].includes(grantFor(ev.target.value)?.site||'')){$('#deskMode').value='observe';}
  if(ev.target.id==='companyPicker')setTimeout(()=>{syncWorkers();void refresh();},30);
});
setInterval(()=>{if(isDesktop)void refresh();},2300);
setTimeout(()=>{if(isDesktop)void refresh();},300);
})();
