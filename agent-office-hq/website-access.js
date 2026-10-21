/* Owner decisions control a real Mac browser. Website credentials never enter this UI. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;if(!B||!window.OfficeHQExtraViews)return;
const E=B.E,local=['localhost','127.0.0.1'].includes(location.hostname),PREFIX='OFFICE_HQ_WEBSITE_ACCESS_V1:';
const $=s=>document.querySelector(s),now=()=>new Date().toISOString();
const company=()=>{const id=$('#companyPicker')?.value;return id&&id!=='all'?id:B.getState().companies[0]?.id;};
const staff=()=>B.getState().employees.filter(e=>e.companyId===company()&&e.active&&e.roleKey!=='ceo'&&B.roleFor(e));
const workers=employees=>employees.map(e=>({employeeId:e.id,employeeName:e.name,roleKey:e.roleKey,department:B.roleFor(e).dept,scope:B.roleFor(e).scope}));
function state(){const s=B.getState();s.enterprise??={};return s.enterprise.websiteAccess??={requests:[],grants:[],jobs:[],conversationId:B.uid('webchat')};}
let lastLocal=null,busy=false,feedback='',focusBefore=null,modalRequest=null,receiptSeen=new Map();
const globe='<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="16" stroke="currentColor" stroke-width="3.5"/><ellipse cx="20" cy="20" rx="7" ry="16" stroke="currentColor" stroke-width="3.5"/><path d="M4 20h32" stroke="currentColor" stroke-width="3.5"/></svg>';
const button=(label,kind,id='',extra='')=>'<button type="button" class="btn btn-sm" data-web-action="'+kind+'" data-web-id="'+E(id)+'" '+extra+'>'+E(label)+'</button>';
function message(text){feedback=text;const el=$('#webAccessFeedback');if(el)el.textContent=text;else B.toast(text);}
async function api(body){const r=await fetch('/api/desktop/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});const data=await r.json();if(!r.ok)throw Error(data.error||'Mac browser operation failed.');return data;}
function remember(r){const a=state().requests,old=a.find(x=>x.id===r.id||x.clientRequestId&&x.clientRequestId===r.clientRequestId);if(old)Object.assign(old,r);else a.push(r);B.save();return old||r;}
function domain(value){let u;try{u=new URL(value);}catch{throw Error('Enter the full website address, starting with https://.');}if(u.protocol!=='https:'||u.username||u.password)throw Error('Use an HTTPS website address without login details.');return {url:u.href,origin:u.origin,host:u.hostname};}
function form(){
 const people=staff(),groups=[...new Set(people.map(e=>B.roleFor(e).dept))];
 return '<div class="page-head"><div><div class="eyebrow">YOUR ACCOUNTS · YOUR PERMISSION</div><h1>Agent website access</h1><p class="muted">Choose a website, your account, and the agents who may use it. Review every access request before work begins.</p></div></div>'+
 '<section class="card web-access-intro"><div class="section-top"><h2>Your browser connection</h2><span id="webMacState" class="ops-tag">'+(local?'Checking this Mac…':'Mac connection required')+'</span></div><p>'+(local?'Websites open in visible browser windows on this Mac. Sign in directly on the website with the account you want the agents to use.':'Approve requests here and send them to your paired Mac. Sign in to websites on that Mac; your iPhone’s account sessions stay on your iPhone.')+'</p><p class="tiny muted">Access grants never sign you in or guarantee that a website supports automation. Sending, publishing, and other account changes require their own approval.</p>'+
 (!local?button('Connect my Mac','connect'):'')+'</section>'+
 '<div class="web-access-layout"><section class="card"><form id="websiteAccessForm"><h2>Request account access</h2><label class="desktop-label">Website address<input name="url" type="url" placeholder="https://github.com/" required maxlength="500"></label>'+
 '<label class="desktop-label">Account name<input name="accountLabel" placeholder="My work account" required maxlength="80"><small>A label for this account, such as Work or Personal.</small></label>'+
 '<label class="desktop-label">What should the agents do?<textarea name="prompt" rows="3" required minlength="10" maxlength="1600" placeholder="Review my project and prepare the fixes for my approval."></textarea></label>'+
 '<label class="desktop-label">Access level<select name="mode"><option value="observe">Read and summarize</option><option value="draft">Prepare work · ask before account changes</option></select></label>'+
 '<details class="web-relevant-sites"><summary>Add other relevant websites</summary><label class="desktop-label">One HTTPS address per line<textarea name="relevantUrls" rows="3" placeholder="https://docs.google.com/" maxlength="1500"></textarea></label><p class="tiny muted">“Allow all relevant sites” covers only the websites listed in this request, until you revoke it.</p></details>'+
 '<fieldset class="web-agent-picker"><legend>Which agents may use this account?</legend><label class="web-select-all"><input type="checkbox" id="webSelectAll"> Select all '+people.length+' agents</label>'+
 '<div class="web-agent-list">'+groups.map(dept=>'<details><summary>'+E(dept)+' <span>'+people.filter(e=>B.roleFor(e).dept===dept).length+' '+(people.filter(e=>B.roleFor(e).dept===dept).length===1?'agent':'agents')+'</span></summary>'+people.filter(e=>B.roleFor(e).dept===dept).map(e=>'<label><input type="checkbox" name="worker" value="'+E(e.id)+'"><span><strong>'+E(e.name)+'</strong><small>'+E(B.roleFor(e).title)+'</small></span></label>').join('')+'</details>').join('')+'</div><p id="webSelectionCount" class="tiny muted" aria-live="polite">0 agents selected</p></fieldset>'+
 '<button class="btn btn-primary" type="submit">Review permission request →</button><p class="tiny muted">You make the access decision on the next card.</p></form></section>'+
 '<div><section class="card"><div class="section-top"><h2>Requests & permissions</h2>'+button('Refresh','refresh')+'</div><div id="webAccessRequests"></div></section>'+
 '<section class="card web-browser-activity"><h2>Browser work</h2><div id="webAccessJobs"></div></section></div></div><p class="notice" role="status" id="webAccessFeedback">'+E(feedback)+'</p>';
}
function requestCard(r){
 const grants=state().grants.filter(g=>g.requestId===(r.macRequestId||r.id)&&g.active&&(!g.expiresAt||Date.parse(g.expiresAt)>Date.now())),pending=r.status==='pending',queued=r.status==='queued';
 const label=pending?'Waiting for your decision':queued?'Waiting for Mac confirmation':grants.length?'Access granted':r.status==='denied'?'Denied':r.status==='allowed'?'Access ended':r.status;
 return '<article class="web-request"><div class="web-request-domain">'+globe+'<strong>'+E(r.accounts?.[0]?.host||new URL(r.url).hostname)+'</strong></div><p>'+E(r.accountLabel||r.accounts?.[0]?.accountLabel||'My account')+' · '+r.workers.length+' '+(r.workers.length===1?'agent':'agents')+'</p><p class="web-request-state">'+E(label)+'</p>'+(r.error?'<p role="alert">'+E(r.error)+'</p>':'')+
 '<details><summary>Review request details</summary><p>'+E(r.prompt)+'</p><p>'+E(r.mode==='draft'?'Prepare work; separate approval for account changes.':'Read and summarize.')+'</p><ul>'+r.accounts.map(a=>'<li>'+E(a.origin)+'</li>').join('')+'</ul><p>'+E(r.workers.map(w=>w.employeeName).join(', '))+'</p></details>'+
 (pending?button('Review access request','review',r.id):'')+(r.status==='blocked'&&!local?button('Retry Mac confirmation','retry',r.id):'')+
 (queued?'<p class="tiny muted">This decision is queued. Access changes take effect after your Mac confirms them.</p>':'')+
 (grants.length?'<p class="tiny muted">'+E(r.decision==='chat'?'This chat only · ends within 24 hours, when you end the chat, or when the Mac runtime restarts.':'Listed websites only · until you revoke access.')+'</p><div class="web-request-actions">'+button('Open account & sign in','open',r.id)+button('Revoke this request','revoke',r.id)+(r.decision==='chat'?button('End this chat','end-chat',r.id):'')+'</div><label class="desktop-label">Choose an authorized agent<select data-web-grant-select="'+E(r.id)+'">'+grants.map(g=>'<option value="'+E(g.id)+'">'+E(g.employeeName)+' · '+E(new URL(g.origin).hostname)+'</option>').join('')+'</select></label><div class="web-request-actions">'+button('Start approved task','run',r.id)+button('Revoke selected agent','revoke-agent',r.id)+'</div>':'')+
 (!pending&&!queued&&r.macRequestId&&!local?button('Check this request on Mac','check',r.id):'')+'</article>';
}
function panels(){
 const requests=$('#webAccessRequests'),jobs=$('#webAccessJobs');
 if(requests){const list=state().requests.filter(r=>r.companyId===company()).slice(-20).reverse();requests.innerHTML=list.length?list.map(requestCard).join(''):'<div class="web-access-empty">'+globe+'<p>No website access has been granted.</p><small>Your permission requests will appear here.</small></div>';}
 if(jobs){const list=state().jobs.filter(j=>!j.companyId||j.companyId===company());jobs.innerHTML=list.length?list.slice(0,8).map(j=>'<article class="web-request"><strong>'+E(j.employeeName)+'</strong><p class="web-request-state">'+E(j.status.replaceAll('_',' '))+'</p><p>'+E(j.thought||'')+'</p>'+(j.summary?'<pre class="web-job-result">'+E(j.summary)+'</pre>':'')+(j.approval?'<p><strong>Account action requires your approval:</strong> '+E(j.approval.description)+'</p><p class="tiny muted">Review the exact target in your Mac browser before approving one click.</p>'+button('Approve one click','approve',j.id)+button('Reject action','reject',j.id):'')+(['running','queued'].includes(j.status)?button('Pause','pause',j.id):j.status==='paused'?button('Resume','resume',j.id):'')+'</article>').join(''):'<p class="muted">Approved work appears here after the Mac browser starts it.</p>';}
 const feedbackNode=$('#webAccessFeedback');if(feedbackNode)feedbackNode.textContent=feedback;
 const connection=$('#webMacState');if(connection)connection.textContent=local?(lastLocal?(lastLocal.aiReady?'Mac browser service connected':'Mac connected · browser AI setup needed'):'Mac service unavailable'):(window.OfficeHQDeviceSync?.snapshot()?.connected?'Paired Mac connected':'Pair Mac in Company Messages');
}
function close(){const modal=$('#websitePermissionOverlay');if(!modal)return;modal.remove();document.body.classList.remove('web-permission-open');modalRequest=null;if(focusBefore?.isConnected)focusBefore.focus();}
function show(r){
 close();focusBefore=document.activeElement;modalRequest=r;
 const agent=r.workers.length===1?r.workers[0].employeeName:r.workers.length+' selected Office HQ agents';
 const host=r.accounts[0].host,overlay=document.createElement('div');overlay.id='websitePermissionOverlay';overlay.className='web-permission-overlay';
 overlay.innerHTML='<section class="web-permission-card" role="dialog" aria-modal="true" aria-labelledby="webPermissionTitle" aria-describedby="webPermissionDescription"><div class="web-permission-domain">'+globe+'<strong>Office HQ</strong></div>'+
 '<h2 id="webPermissionTitle">Allow '+E(agent)+' to access '+E(host)+' with the Office HQ browser?</h2>'+
 '<p id="webPermissionDescription">Your agents will be able to access and interact with '+E(host)+'. You can also let your agents access all websites listed as relevant to this request.</p>'+
 '<details class="web-permission-details"><summary>'+E(r.accountLabel||r.accounts[0].accountLabel)+' · Review agents and access</summary><p><strong>Task:</strong> '+E(r.prompt)+'</p><p><strong>Agents:</strong> '+E(r.workers.map(w=>w.employeeName+' ('+w.roleKey+')').join(', '))+'</p><p><strong>Websites:</strong> '+E(r.accounts.map(a=>a.origin).join(', '))+'</p><p>'+E(r.mode==='draft'?'Prepare work; account changes need separate approval.':'Read and summarize only.')+'</p><p>This chat: this website, up to 24 hours, until you end the chat or the Mac runtime stops. All relevant sites: every listed website, until revoked. You sign in yourself on your Mac.</p></details>'+
 '<div class="web-permission-buttons"><button type="button" data-web-decision="deny">Deny</button><button type="button" data-web-decision="relevant">Allow all relevant sites</button><button type="button" class="web-permission-primary" data-web-decision="chat">Allow for this chat</button></div><p class="web-permission-error" role="alert"></p></section><button type="button" class="web-permission-dismiss" data-web-action="dismiss" aria-label="Close permission request without deciding">×</button>';
 document.body.appendChild(overlay);document.body.classList.add('web-permission-open');overlay.querySelector('[data-web-decision="deny"]').focus();
}
async function request(input){
 if(!input.workers?.length)throw Error('Select at least one agent.');
 const first=domain(input.url),other=(input.relevantUrls||[]).map(domain),unique=[...new Map([first,...other].map(a=>[a.origin,a])).values()];
 if(unique.length>8)throw Error('Review at most eight websites in one request.');
 const data={...input,companyId:company(),clientRequestId:B.uid('web'),conversationId:state().conversationId};
 if(data.prompt?.trim().length<10)throw Error('Describe the task in at least 10 characters.');
 const r=local?(await api({action:'request-access',...data})).request:{...data,id:data.clientRequestId,status:'pending',createdAt:now(),accounts:unique.map(a=>({...a,accountLabel:data.accountLabel}))};
 remember(r);panels();show(r);return r;
}
function queue(command,r){
 if(!window.OfficeHQDeviceSync?.signedIn())throw Error('Sign in to secure device sync in Company Messages, then send this decision to your Mac.');
 const selected=r?.workers?.[0]||workers(staff().slice(0,1))[0];if(!selected)throw Error('Choose an active specialist.');
 const description=PREFIX+JSON.stringify({...command,ownerConfirmed:true});if(description.length>4000)throw Error('This request is too long to send. Shorten the task or request fewer websites.');
 const t={id:B.uid('webcmd'),companyId:company(),ownerId:selected.employeeId,title:'Website access · '+command.kind,description,
  scope:selected.scope,delegatedBy:'owner',cloudSyncRequested:true,websiteAccessCommand:true,status:'queued',priority:'Medium',due:'',createdAt:now(),updatedAt:now(),output:'',requiresApproval:false};
 B.getState().tasks.unshift(t);B.save();window.OfficeHQDeviceSync.pushTask(t);return t;
}
async function decide(choice){
 const r=modalRequest;if(!r||busy)return;busy=true;const buttons=[...$('#websitePermissionOverlay').querySelectorAll('[data-web-decision]')];buttons.forEach(b=>b.disabled=true);
 try{
  if(local){const result=await api({action:'decide-access',companyId:r.companyId,requestId:r.id,decision:choice,ownerConfirmed:true});remember(result.request);await refresh();}
  else if(choice==='deny'){r.status='denied';r.decision=choice;r.decidedAt=now();B.save();}
  else{const task=queue({kind:'decide',requestKey:r.clientRequestId,conversationId:r.conversationId,url:r.url,relevantUrls:r.relevantUrls,accountLabel:r.accountLabel,prompt:r.prompt,mode:r.mode,roles:r.workers.map(w=>w.roleKey),decision:choice},r);r.commandTaskId=task.id;r.decision=choice;r.status='queued';B.save();}
  close();panels();message(choice==='deny'?'Access denied.':local?'Your access decision is saved. Open the account, sign in, and start the approved task.':'Decision sent to your Mac. Access is pending until the Mac confirms it.');
 }catch(e){const error=$('.web-permission-error');if(error)error.textContent=e.message;buttons.forEach(b=>b.disabled=false);}
 finally{busy=false;}
}
function receipts(){
 let changed=false;
 for(const t of B.getState().tasks.filter(t=>t.websiteAccessCommand)){
  const version=t.output||t.runError;if(!version||receiptSeen.get(t.id)===version)continue;receiptSeen.set(t.id,version);
  let command;try{command=JSON.parse(t.description.slice(PREFIX.length));}catch{continue;}
  const r=state().requests.find(r=>r.clientRequestId===command.requestKey||r.macRequestId===command.requestId||r.id===command.requestId);
  if(t.status==='blocked'){if(r){r.status=r.status==='queued'?'blocked':r.status;r.error=t.runError;}feedback=t.runError||'The Mac could not apply this request.';changed=true;continue;}
  let result;try{result=JSON.parse(t.output);}catch{continue;}
  if(r&&result.request){r.macRequestId=result.request.id;r.status=result.request.status;r.decision=result.request.decision;r.error='';
   state().grants=state().grants.filter(g=>g.requestId!==r.macRequestId);
   for(let a=0;a<result.accounts.length;a++)for(let w=0;w<result.roles.length;w++){
    let grantId=result.matrix[a]?.[w];if(!grantId)continue;if(result.compactIds&&/^[a-f0-9]{32}$/i.test(grantId))grantId=grantId.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
    const person=r.workers.find(p=>p.roleKey===result.roles[w]);if(!person)continue;
    state().grants.push({...person,id:grantId,companyId:r.companyId,requestId:r.macRequestId,site:result.accounts[a].id,origin:result.accounts[a].origin,accountLabel:r.accountLabel,mode:r.mode,duration:r.decision,conversationId:r.conversationId,expiresAt:r.decision==='chat'?result.request.expiresAt:null,active:true});
   }
  }
  if(result.jobs)state().jobs=result.jobs.map(j=>({...j,companyId:t.companyId}));changed=true;
 }
 if(changed)B.save();return changed;
}
async function refresh(){
 if(local){try{lastLocal=await api({action:'status',companyId:company()});const a=lastLocal.websiteAccess;for(const r of a.requests)remember(r);state().grants=state().grants.filter(g=>g.companyId!==company()).concat(a.grants);state().jobs=state().jobs.filter(j=>j.companyId!==company()).concat(lastLocal.jobs);B.save();}catch(e){lastLocal=null;feedback=e.message;}}
 else receipts();panels();
}
async function action(kind,id){
 if(kind==='dismiss'){close();return;}if(kind==='connect'){B.setView('thread');return;}
 if(kind==='refresh'){if(!local)await window.OfficeHQDeviceSync?.refresh();await refresh();return;}
 const r=state().requests.find(r=>r.id===id),grantId=r?$('[data-web-grant-select="'+CSS.escape(r.id)+'"]')?.value:null;
 if(kind==='review'){show(r);return;}
 if(kind==='retry'){queue({kind:'decide',requestKey:r.clientRequestId,conversationId:r.conversationId,url:r.url,relevantUrls:r.relevantUrls,accountLabel:r.accountLabel,prompt:r.prompt,mode:r.mode,roles:r.workers.map(w=>w.roleKey),decision:r.decision},r);r.status='queued';B.save();panels();message('Checking the same decision with your Mac.');return;}
 if(r){
  const base={requestId:r.macRequestId||r.id,requestKey:r.clientRequestId,conversationId:r.conversationId};
  const grant=state().grants.find(g=>g.id===grantId),site=grant?.site;
  if(['run','open','revoke-agent'].includes(kind)&&!grant)throw Error('Choose an active agent permission.');
  const map={open:{action:'open',site},run:{action:'run',grantId,prompt:r.prompt,mode:r.mode},revoke:{action:'revoke-access',requestId:base.requestId},'revoke-agent':{action:'revoke-access',grantId},'end-chat':{action:'end-chat',conversationId:r.conversationId}};
  if(kind==='check'){queue({kind:'status',...base},r);message('Checking this permission and recent browser work on your Mac.');return;}
  if(kind==='end-chat'&&state().conversationId===r.conversationId){state().conversationId=B.uid('webchat');B.save();}
  if(local){await api({...map[kind],companyId:r.companyId,ownerConfirmed:true});await refresh();message(kind==='run'?'Task accepted by the Mac browser. Check its progress below.':kind==='open'?'Account opened on this Mac. Sign in directly on the website.':'Access updated.');}
  else{queue({kind:kind==='revoke-agent'?'revoke':kind,...base,grantId:kind==='revoke-agent'||kind==='run'?grantId:undefined,site,prompt:kind==='run'?r.prompt:undefined,mode:r.mode},r);message('Request queued. Your Mac will confirm when it takes effect.');}
  return;
 }
 if(['pause','resume','approve','reject'].includes(kind)){
  const job=state().jobs.find(j=>j.id===id);if(!job)throw Error('Browser job no longer available.');
  if(local){await api({action:kind,jobId:id,approvalId:job.approval?.id});await refresh();}
  else{const person=state().grants.find(g=>g.id===job.grantId)||workers(staff()).find(w=>w.roleKey===job.roleKey);if(!person)throw Error('This browser worker has no matching specialist on this device.');queue({kind,jobId:id,approvalId:job.approval?.id},{workers:[person]});}message('Browser command '+(local?'applied.':'queued for Mac confirmation.'));
 }
}
document.addEventListener('submit',ev=>{if(ev.target.id!=='websiteAccessForm')return;ev.preventDefault();const f=new FormData(ev.target),ids=new Set(f.getAll('worker'));void request({url:f.get('url'),accountLabel:f.get('accountLabel'),prompt:f.get('prompt'),mode:f.get('mode'),relevantUrls:String(f.get('relevantUrls')||'').split(/\n/).map(x=>x.trim()).filter(Boolean),workers:workers(staff().filter(e=>ids.has(e.id)))}).catch(e=>message(e.message));});
document.addEventListener('click',ev=>{const decision=ev.target.closest('[data-web-decision]');if(decision){ev.preventDefault();void decide(decision.dataset.webDecision);return;}const el=ev.target.closest('[data-web-action]');if(el){ev.preventDefault();void action(el.dataset.webAction,el.dataset.webId).catch(e=>message(e.message));}});
document.addEventListener('change',ev=>{
 if(ev.target.id==='webSelectAll')document.querySelectorAll('#websiteAccessForm [name="worker"]').forEach(c=>c.checked=ev.target.checked);
 if(ev.target.id==='webSelectAll'||ev.target.name==='worker'){const all=[...document.querySelectorAll('#websiteAccessForm [name="worker"]')],selected=all.filter(c=>c.checked).length,label=$('#webSelectionCount'),checkbox=$('#webSelectAll');if(label)label.textContent=selected+' '+(selected===1?'agent':'agents')+' selected';if(checkbox){checkbox.checked=selected===all.length;checkbox.indeterminate=selected>0&&selected<all.length;}}
 if(ev.target.id==='companyPicker'){close();void refresh();}
});
document.addEventListener('keydown',ev=>{
 const modal=$('#websitePermissionOverlay');if(!modal)return;
 if(ev.key==='Escape'&&!busy){ev.preventDefault();close();}
 if(ev.key==='Tab'){const elements=[...modal.querySelectorAll('button:not(:disabled),summary')],first=elements[0],last=elements.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}
});
const connections=window.OfficeHQExtraViews.connections;window.OfficeHQExtraViews.connections=function(){return '<section class="card web-access-entry"><div><h2>Give agents access to your accounts</h2><p class="muted">Choose a website, select agents, and review the permission card.</p></div><button class="btn btn-primary" data-view="access">Manage website access →</button></section>'+connections();};
window.OfficeHQExtraViews.access=function(){setTimeout(()=>{panels();void refresh();},0);return form();};
window.OfficeHQWebsiteAccess={request,show,refresh};
setInterval(()=>{if(location.hash==='#/access'){if(local)void refresh();else if(receipts())panels();}},5000);
if(location.hash==='#/access')B.setView('access');
})();
