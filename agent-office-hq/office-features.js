(function enterpriseFeatures(){
  'use strict';
  const B=window.OfficeHQBridge;
  if(!B)return;
  const $=q=>document.querySelector(q);
  const E=B.E;
  const S=()=>B.getState();
  const today=()=>new Date().toISOString();
  const currentCompany=()=>$('#companyPicker')?.value||S().companies[0]?.id||'all';
  const companies=()=>S().companies;
  const companyName=id=>companies().find(c=>c.id===id)?.name||'Company';
  const inScope=x=>currentCompany()==='all'||x.companyId===currentCompany();
  const ensure=()=>{const s=S(); if(!s.enterprise||typeof s.enterprise!=='object')s.enterprise={};for(const k of ['accounts','grants','messages','meetings','workflows'])if(!Array.isArray(s.enterprise[k]))s.enterprise[k]=[];return s.enterprise;};
  const ent=()=>ensure();
  const fmt=date=>{try{return new Date(date).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch{return 'Recently'}};
  const providers=['Gmail','iCloud','X (Twitter)','Instagram','Shopify','Etsy','TikTok','Lemon8','Lemonade','Chime','Facebook','ChatGPT','YouTube','Google Calendar','Google Drive','Gmail / Email','Other'];
  const roles=()=>B.getRoles();
  const staff=cid=>S().employees.filter(e=>e.companyId===cid&&e.active);
  const prettyScope=r=>r?.scope?.replaceAll('_',' ')||'';
  const serviceAllowed=(employee,provider)=>{
    if(!employee)return false;
    const dept=B.roleFor(employee)?.dept;
    const a={'Shopify':['Sales','Product','Marketing','Customer','Operations','Finance'],'Etsy':['Sales','Product','Marketing','Customer','Operations','Finance'],'YouTube':['Marketing'],'Instagram':['Marketing'],'TikTok':['Marketing'],'Lemon8':['Marketing'],'Facebook':['Marketing'],'X (Twitter)':['Marketing'],'Gmail':['Customer','Leadership','Marketing','Sales','PMO'],'Gmail / Email':['Customer','Leadership','Marketing','Sales','PMO'],'iCloud':['Customer','Leadership','PMO'],'Google Calendar':['Leadership','PMO','People'],'Google Drive':['Leadership','PMO','Technology'],'Chime':['Finance','Audit'],'Lemonade':['Finance','Audit'],'ChatGPT':['Technology'],'Other':['Technology']};
    return (a[provider]||[]).includes(dept);
  };
  const message=(author,body,companyId,kind='update')=>{
    ent().messages.unshift({id:B.uid('sms'),author:String(author).slice(0,80),body:String(body).slice(0,800),companyId,kind,createdAt:today(),read:false});
    ent().messages=ent().messages.slice(0,400);
    B.save();
    badge();
  };
  const makeApproval=a=>{
    S().approvals.unshift({...a,id:B.uid('approve'),status:'pending',createdAt:today()});
    const entry=S().approvals[0];
    B.addActivity(a.requester||'Employee',`Request to CEO: ${entry.title}`,'approval',entry.companyId);
    B.save();badge();return entry;
  };
  const page=(heading,description,body)=>`<div class="page-head"><div class="eyebrow">CEO OPERATIONS</div><h1>${E(heading)}</h1><p class="muted">${E(description)}</p></div>${body}`;
  const panel=(title,body)=>`<section class="card"><h2>${E(title)}</h2>${body}</section>`;
  const note=`<p class="notice">This is an in-app message and authorization workspace, not carrier SMS. Connected services, sending texts, publishing posts and charging cards require a separately deployed, authenticated backend and official provider connections.</p>`;
  const button=(act,text,id='',kind='')=>`<button class="btn btn-sm ${kind}" type="button" data-ops="${act}" data-id="${E(id)}">${E(text)}</button>`;
  const options=(xs,selector,placeholder)=>`<option value="">${E(placeholder)}</option>${xs.map(x=>`<option value="${E(selector(x))}">${E(x.label||x.name||x.title)}</option>`).join('')}`;
  function approvalItems(){
    return S().approvals.filter(x=>inScope(x)&&x.status==='pending').sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  }
  function approvalCard(a){
    const amount=Number(a.amount||0);
    const canEdit=a.kind==='campaign'||a.kind==='expense';
    return `<article class="ops-message ops-request" data-approval="${E(a.id)}">
     <div class="ops-msg-top"><strong>${E(a.requester||'Employee request')}</strong><span>${fmt(a.createdAt)} <button type="button" class="ops-dismiss" data-ops="dismiss-request" data-id="${E(a.id)}" aria-label="Reject and remove request: ${E(a.title)}" title="Reject and remove this request">×</button></span></div>
     <h3>${E(a.title)}</h3><p>${E(a.note||'Awaiting your decision.')}</p>
     ${a.provider?`<p class="tiny">Service: <strong>${E(a.provider)}</strong></p>`:''}
     ${canEdit?`<label class="ops-amount-label" for="amount_${E(a.id)}">Approved spending cap ($)</label><div class="ops-amount-row"><input id="amount_${E(a.id)}" type="number" step="0.01" min="0" max="100000" value="${amount.toFixed(2)}" aria-label="Proposed amount in dollars">${button('save-amount','Save amount',a.id)}</div>`:''}
     <div class="ops-actions">${a.kind==='task'&&a.taskId?button('review-work','Open finished work & decide',a.taskId,'btn-primary'):button('approve-request','✓ Approve',a.id,'btn-primary')+button('deny-request','✕ Deny',a.id,'btn-danger')}${button('view-request','More details',a.id)}</div>
     <div class="tiny muted">Approval does not connect an account, send a text, publish media, or charge a card.</div></article>`;
  }
  function recentMessages(){
    const msgs=ent().messages.filter(inScope);
    return msgs.slice(0,80).map(m=>`<article class="ops-message ${m.author==='You · CEO'?'ops-own':''}" data-message-id="${E(m.id)}">
     <div class="ops-msg-top"><strong>${E(m.author)}</strong><span class="ops-msg-controls"><time>${fmt(m.createdAt)}</time><button type="button" class="ops-dismiss" data-ops="delete-message" data-id="${E(m.id)}" aria-label="Delete message by ${E(m.author)}" title="Remove this message">×</button></span></div>
     <p>${E(m.body)}</p><small>${m.kind==='alert'?'⚠ Alert':m.kind==='meeting'?'Meeting':'Internal company message'}</small></article>`).join('')||'<p class="muted">No company messages yet. Activity, approvals, and your CEO announcements will appear here.</p>';
  }
  function threadInner(){
    return `<div class="ops-thread-list" aria-live="polite"><h3>Needs your authorization (${approvalItems().length})</h3>
     ${approvalItems().map(approvalCard).join('')||'<div class="notice">No pending requests.</div>'}
     <div class="ops-thread-heading"><h3 class="ops-section-head">Company text thread</h3><button class="btn btn-sm" type="button" data-ops="clear-messages">Clear messages</button></div>${recentMessages()}</div>`;
  }
  function updateDrawer(){const c=$('#opsDrawerContent');if(c)c.innerHTML=threadInner();badge();}
  function badge(){
    const n=approvalItems().length;
    for(const selector of ['#officePhoneCount','#officePhoneDrawerCount']){
      const b=$(selector);if(b){b.textContent=n>99?'99+':String(n);b.hidden=!n;}
    }
    const nav=$('#opsNavThreadCount');if(nav){nav.textContent=String(n);nav.hidden=!n;}
    const btn=$('#officePhoneBtn');
    if(btn)btn.setAttribute('aria-label',`Open company messages, ${n} requests need CEO approval`);
  }
  function openPhone(){
    const d=$('#officePhoneDrawer'),shade=$('#officePhoneShade');if(!d||!shade)return;
    d.hidden=false;shade.hidden=false;d.setAttribute('aria-hidden','false');
    ent().messages.filter(inScope).forEach(m=>m.read=true);B.save();updateDrawer();
    $('#officePhoneClose')?.focus();
  }
  function closePhone(){
    const d=$('#officePhoneDrawer'),shade=$('#officePhoneShade');if(!d||!shade)return;
    d.hidden=true;shade.hidden=true;d.setAttribute('aria-hidden','true');
    $('#officePhoneBtn')?.focus();
  }
  function renderThread(){
    const cid=currentCompany();
    return page('Company text thread','Your internal CEO inbox, employee escalations, approval requests and decision log.',
    `<div class="ops-grid"><div>${panel('Messages & requests',threadInner())}</div><div>${panel('Send a CEO instruction',
       `<form id="opsMessageForm"><label for="opsText">Write to your company thread</label>
       <textarea id="opsText" name="body" maxlength="800" required placeholder="Example: Marketing, prepare a $5 TikTok promotion proposal. Do not publish or spend until I approve."></textarea>
       <label>Company</label><select name="companyId">${companies().map(c=>`<option value="${E(c.id)}" ${c.id===cid?'selected':''}>${E(c.name)}</option>`).join('')}</select>
       <button class="btn btn-primary" type="submit">Post internal message</button></form>
       <p class="tiny muted">Messages are stored in this browser only; agents do not receive real SMS.</p>`)}
       ${panel('Request a campaign approval',campaignForm())}</div></div>${note}`);
  }
  function campaignForm(){
    const cid=currentCompany()==='all'?companies()[0]?.id:currentCompany();
    const ads=staff(cid).filter(e=>B.roleFor(e)?.scope==='paid_advertising'||B.roleFor(e)?.scope==='promotion_budgeting');
    return `<form id="opsCampaignForm"><label>Platform</label><select name="provider"><option>TikTok</option><option>Instagram</option><option>YouTube</option><option>Facebook</option><option>Other</option></select>
      <label>Requesting advertising worker</label><select name="employeeId" required>${options(ads,e=>e.id,'Select ad specialist')}</select>
      <label>Proposed spending cap ($)</label><input name="amount" type="number" min="0.01" max="100000" step="0.01" required value="40">
      <label>Campaign purpose</label><textarea name="note" required maxlength="450" placeholder="Describe the promotion and intended outcome"></textarea>
      <button class="btn btn-primary" type="submit">Send spending request to CEO</button></form><p class="tiny muted">You can change $40 to $5 in the phone inbox before approval. No transaction executes in this demo.</p>`;
  }
  function renderConnections(){
    const cid=currentCompany()==='all'?companies()[0]?.id:currentCompany();
    const accounts=ent().accounts.filter(x=>x.companyId===cid);
    const grants=ent().grants.filter(x=>x.companyId===cid&&x.status==='approved');
    const legal=`<p class="notice">Registering an account below saves only its provider and public label, not passwords or tokens. The account is NOT connected. Approving worker access sets an internal policy only; secure OAuth and server-enforced permissions must be installed before workers can actually read, post, or publish.</p>`;
    return page('Social & business connections','Add account labels, then require CEO permission for each worker and service.',
      legal+`<div class="ops-grid">
        ${panel('Your account directory',`<form id="opsAccountForm">
         <label>Company</label><select name="companyId">${companies().map(c=>`<option value="${E(c.id)}" ${c.id===cid?'selected':''}>${E(c.name)}</option>`).join('')}</select>
         <label>Service</label><select name="provider">${providers.map(p=>`<option>${E(p)}</option>`).join('')}</select>
         <label>Public account name or label (never passwords)</label><input name="label" required maxlength="90" placeholder="Example: @myshop / Store 1">
         <button class="btn btn-primary" type="submit">Add account label</button></form>
         <div class="ops-account-list">${accounts.map(a=>`<div class="ops-account"><strong>${E(a.provider)} · ${E(a.label)}</strong><span class="ops-tag">Not connected</span><small>Actual sign-in requires secure OAuth; do not enter your password here.</small>
         ${button('remove-account','Remove label',a.id)}</div>`).join('')||'<p class="muted">No account labels registered for this company.</p>'}</div>`)}
        <div>${panel('Ask CEO to grant worker access',`<form id="opsAccessForm">
          <label>Service/account</label><select name="accountId" required>${options(accounts,a=>a.id,'Choose a saved account')}</select>
          <label>Worker</label><select name="employeeId" required>${options(staff(cid),e=>e.id,'Choose a worker')}</select>
          <label>Requested permission</label><select name="permission"><option value="read">Read and analyze</option><option value="draft">Prepare drafts</option><option value="publish">Publish or change content (requires separate final confirmation)</option></select>
          <label>Business reason</label><textarea name="purpose" required maxlength="450" placeholder="What should this one worker do with this account?"></textarea>
          <button class="btn btn-primary" type="submit" ${accounts.length?'':'disabled'}>Text authorization request to CEO</button></form>`)}
         ${panel('Internally approved access',grants.map(g=>{const a=ent().accounts.find(x=>x.id===g.accountId);const e=B.getEmployee(g.employeeId);return `<div class="ops-account"><strong>${E(e?.name||'Unknown worker')}</strong><small>${E(a?.provider||'Account removed')} · ${E(a?.label||'Unknown')} · ${E(g.permission)}</small><span class="ops-tag">Policy approved · OAuth not connected</span>${button('revoke-access','Revoke policy',g.id)}</div>`}).join('')||'<p class="muted">No worker access policies approved.</p>')}</div>
       </div>`);
  }
  function renderJobs(){
    const cid=currentCompany()==='all'?companies()[0]?.id:currentCompany();
    const list=roles();
    const rows=list.map(r=>{
      const owner=staff(cid).find(e=>e.roleKey===r.key);
      return `<article class="ops-job"><div class="ops-job-title"><strong>${E(r.title)}</strong><span class="ops-tag">${E(r.dept)}</span></div>
        <p>${E(r.description)}</p><small>Exclusive scope: ${E(prettyScope(r))} · Reports to: ${E(roles().find(x=>x.key===r.reportsTo)?.title||'Company owner')}</small>
        <div class="ops-job-footer"><span>${owner?E(owner.name):'Vacant / inactive'}</span>${owner?button('assign-specialty','Assign task',r.scope):button('hire-specialty','Activate position',r.scope)}</div></article>`;
    }).join('');
    return page('All company jobs',`${list.length} distinct, narrowly scoped positions from CEO to facilities and agent reliability. Each company has one seat per specialty.`,
      `<div class="ops-toolbar"><label for="opsJobSearch">Search all job descriptions</label><input id="opsJobSearch" type="search" placeholder="Search: paperwork, image, janitor, AI health, payroll..."><span id="opsJobCount">${list.length} positions</span></div>
       <div class="ops-job-grid" id="opsJobResults">${rows}</div><p class="notice">This directory describes job responsibilities. Autonomous completion requires real tools and verified permissions. Physical jobs require people or robotic equipment.</p>`);
  }
  function healthIssues(){
    const now=Date.now(),issues=[];
    for(const t of S().tasks.filter(inScope)){
      const e=B.getEmployee(t.ownerId);
      if(!e||!e.active||B.roleFor(e)?.scope!==t.scope)issues.push({companyId:t.companyId,text:`${t.title}: missing or unauthorized worker`,taskId:t.id});
      if(t.status==='blocked')issues.push({companyId:t.companyId,text:`${t.title}: task is blocked`,taskId:t.id});
      if(t.status==='in_progress'&&now-new Date(t.updatedAt||t.createdAt).getTime()>72*3600000)issues.push({companyId:t.companyId,text:`${t.title}: has had no recorded update for over 72 hours`,taskId:t.id});
    }
    for(const a of approvalItems())if(now-new Date(a.createdAt).getTime()>24*3600000)issues.push({companyId:a.companyId,text:`${a.title}: CEO approval pending over 24 hours`});
    return issues;
  }
  function renderHealth(){
    const issues=healthIssues();
    return page('Agent health & incident desk','Check actual task status, bottlenecks, blocked work and aging approvals—not imaginary worker activity.',
      `<div class="ops-grid">${panel('Current health findings',`<strong class="ops-health-number">${issues.length}</strong> exception(s) identified.${issues.map(x=>`<div class="ops-account">⚠ ${E(x.text)}</div>`).join('')||'<p class="notice">No blocked, stale, or unassigned tasks detected in this browser workspace.</p>'}
      ${button('health-check','Run check and text any findings to CEO','','btn-primary')}`)}
      ${panel('What monitoring can and cannot do',`<p>Checks use local records, job ownership and timestamps. A health check reports issues to your company message thread.</p><p>Real uptime checks, model error logs, proactive texting while the website is closed and automated remediation require a running backend and alerting service.</p>`)}</div>`);
  }
  function renderWorkflows(){
    const cid=currentCompany()==='all'?companies()[0]?.id:currentCompany();
    const s=roles().filter(r=>r.key!=='ceo');
    const steps=(name,allowBlank=false)=>`<label>${name}</label><select name="${name.toLowerCase().replaceAll(' ','')}" ${allowBlank?'':'required'}><option value="">${allowBlank?'No additional step':'Choose exclusive specialist'}</option>${s.map(r=>`<option value="${E(r.scope)}">${E(r.title)}</option>`).join('')}</select>`;
    return page('Handoff workflows','Create sequential jobs. Worker two cannot run until worker one finishes, and each task stays in its own specialty.',
      `<div class="ops-grid">${panel('Create a multi-agent workflow',`<form id="opsWorkflowForm">
       <label>Workflow name</label><input name="title" required maxlength="120" placeholder="Example: Launch a product video">
       ${steps('First step')}${steps('Second step')}${steps('Third step',true)}
       <label>Acceptance criteria</label><textarea name="details" required maxlength="700" placeholder="Define what each worker must produce."></textarea>
       <button class="btn btn-primary" type="submit">Create ordered assignments</button></form>`)}
       ${panel('Workflows',ent().workflows.filter(inScope).map(w=>`<div class="ops-account"><strong>${E(w.title)}</strong><p>${w.taskIds.map(id=>{const t=S().tasks.find(x=>x.id===id);return t?`${E(t.title)} — ${E(t.status)}`:''}).join('<br>→ ')}</p><small>${fmt(w.createdAt)}</small>${button('inspect-workflow','View task board',w.id)}</div>`).join('')||'<p class="muted">No handoff workflows created yet.</p>')}</div>`);
  }
  function renderMeetings(){
    const cid=currentCompany()==='all'?companies()[0]?.id:currentCompany();
    return page('Executive meeting room','Set meeting agendas and record invitations inside the company thread.',
      `<div class="ops-grid">${panel('Schedule internal meeting',`<form id="opsMeetingForm">
        <label>Meeting topic</label><input name="title" required maxlength="120">
        <label>Company</label><select name="companyId">${companies().map(c=>`<option value="${E(c.id)}" ${cid===c.id?'selected':''}>${E(c.name)}</option>`).join('')}</select>
        <label>Date & time</label><input name="when" type="datetime-local" required>
        <label>Attendees</label><textarea name="attendees" maxlength="400" placeholder="List departments or agents to invite"></textarea>
        <label>Agenda</label><textarea name="agenda" maxlength="800" required></textarea>
        <button class="btn btn-primary" type="submit">Schedule & notify internal thread</button></form>`)}
       ${panel('Scheduled company meetings',ent().meetings.filter(inScope).map(m=>`<div class="ops-account"><strong>${E(m.title)}</strong><p>${fmt(m.when)}<br>Attendees: ${E(m.attendees||'CEO')}</p><small>Agenda: ${E(m.agenda)}</small>${button('cancel-meeting','Cancel meeting',m.id)}</div>`).join('')||'<p class="muted">No meetings scheduled.</p>')}</div>${note}`);
  }
  function refreshCurrent(){
    const view=location.hash.replace('#/','');
    if(window.OfficeHQExtraViews?.[view])B.setView(view);
    updateDrawer();badge();
  }
  function approve(id,decision){
    const a=S().approvals.find(x=>x.id===id&&x.status==='pending');
    if(!a)return;
    const initialView=location.hash.replace('#/','');
    if(a.kind==='task'&&a.taskId){closePhone();window.OfficeHQDeliverables?.openTask(a.taskId);return;}
    B.decideApproval(id,decision);
    // CEO decisions made inside the phone or company thread should remain there.
    if(initialView&&initialView!=='approvals')B.setView(initialView);
    updateDrawer();badge();
  }
  window.OfficeHQOnApprovalDecision=(a,decision)=>{
    window.OfficeHQDepartments?.onApproval(a,decision);
    if(a.kind==='access'&&decision==='approved'){
      const e=B.getEmployee(a.employeeId),account=ent().accounts.find(x=>x.id===a.accountId);
      if(e?.active&&account&&serviceAllowed(e,account.provider)){
        const existing=ent().grants.find(g=>g.accountId===a.accountId&&g.employeeId===a.employeeId&&g.permission===a.permission);
        if(existing){existing.status='approved';existing.approvedAt=today();}
        else ent().grants.push({id:B.uid('grant'),companyId:a.companyId,accountId:a.accountId,employeeId:a.employeeId,permission:a.permission,status:'approved',approvedAt:today()});
      }
    }
    if(a.kind==='campaign'&&decision==='approved')message('System',`CEO approved proposed ${a.provider} campaign cap of ${B.money(a.amount)}. No ad placed; secure platform integration and final execution confirmation are still required.`,a.companyId,'update');
  };
  window.OfficeHQActivitySink=(actor,body,type,companyId)=>{
    if(type==='approval'||type==='task'&&(/blocked|failed|error|approved|rejected|Moved/i.test(body))){
      message(actor,body,companyId,type==='approval'?'request':'alert');
    }
  };
  window.OfficeHQExtraViews={thread:renderThread,connections:renderConnections,jobs:renderJobs,health:renderHealth,workflows:renderWorkflows,meetings:renderMeetings};
  document.addEventListener('click',ev=>{
    const action=ev.target.closest('[data-ops]');
    if(action){
      const op=action.dataset.ops,id=action.dataset.id;
      if(op==='delete-message'){
        const msg=ent().messages.find(m=>m.id===id&&inScope(m));
        if(msg&&confirm('Remove this message from your company text thread?')){
          ent().messages=ent().messages.filter(m=>m.id!==id);
          B.save();refreshCurrent();B.toast('Message removed.');
        }
      }
      else if(op==='clear-messages'){
        const kept=ent().messages.filter(m=>!inScope(m)),removed=ent().messages.length-kept.length;
        if(removed&&confirm('Clear '+removed+' messages from this company thread? Pending CEO approval requests stay available.')){
          ent().messages=kept;B.save();refreshCurrent();B.toast('Company thread cleared. Pending approvals preserved.');
        }
      }
      else if(op==='dismiss-request'){
        const pending=S().approvals.find(a=>a.id===id&&a.status==='pending'&&inScope(a));
        if(pending&&confirm('Reject this pending request and remove it from your inbox? No approval will be granted.'))approve(id,'rejected');
      }
      else if(op==='review-work'){closePhone();window.OfficeHQDeliverables?.openTask(id);}
      else if(op==='phone-open')openPhone();
      else if(op==='phone-close')closePhone();
      else if(op==='approve-request'||op==='deny-request')approve(id,op==='approve-request'?'approved':'rejected');
      else if(op==='view-request'){closePhone();B.setView('approvals');}
      else if(op==='save-amount'){
        const a=S().approvals.find(x=>x.id===id&&x.status==='pending');
        const input=document.getElementById('amount_'+id);
        const amount=Number(input?.value);
        if(!a||!input||!Number.isFinite(amount)||amount<0||amount>100000){B.toast('Enter a valid cap between $0 and $100,000.','error');return;}
        if(a.kind==='expense'&&amount<0.01){B.toast('Expense requests require at least one cent.','error');return;}
        a.amount=Math.round(amount*100)/100;
        B.addActivity('You · CEO',`Changed ${a.title} spending cap to ${B.money(a.amount)} before approval`,'approval',a.companyId);
        refreshCurrent();B.toast('Proposed cap updated; nothing was charged.');
      }else if(op==='revoke-access'){
        const g=ent().grants.find(x=>x.id===id);
        if(g){g.status='revoked';g.revokedAt=today();B.addActivity('You · CEO','Revoked worker account-access policy','approval',g.companyId);refreshCurrent();}
      }else if(op==='remove-account'){
        const a=ent().accounts.find(x=>x.id===id);
        if(a){ent().accounts=ent().accounts.filter(x=>x.id!==id);ent().grants=ent().grants.filter(x=>x.accountId!==id);S().approvals.filter(x=>x.accountId===id&&x.status==='pending').forEach(x=>x.status='rejected');B.addActivity('You · CEO',`Removed account label ${a.provider} / ${a.label}`,'approval',a.companyId);refreshCurrent();}
      }else if(op==='assign-specialty'){B.taskForm();const sel=$('#taskScope');if(sel){sel.value=id;sel.dispatchEvent(new Event('change',{bubbles:true}));}}
      else if(op==='hire-specialty'){B.hireForm();const role=roles().find(x=>x.scope===id);const sel=$('#hireRole');if(role&&sel)sel.value=role.key;}
      else if(op==='health-check'){
        const issues=healthIssues();
        if(issues.length)for(const issue of issues.slice(0,15))message('Agent Health Monitor',issue.text,issue.companyId,'alert');
        else message('Agent Health Monitor','Health check completed: no local exception signals found.',currentCompany()==='all'?companies()[0]?.id:currentCompany(),'update');
        B.toast(`Health check: ${issues.length} findings; local thread updated.`);refreshCurrent();
      }else if(op==='inspect-workflow')B.setView('tasks');
      else if(op==='cancel-meeting'){const m=ent().meetings.find(x=>x.id===id);if(m){ent().meetings=ent().meetings.filter(x=>x.id!==id);message('Meeting Secretary',`Cancelled meeting: ${m.title}`,m.companyId,'meeting');refreshCurrent();}}
      else if(op==='phone-thread'){closePhone();B.setView('thread');}
      return;
    }
    if(ev.target.id==='officePhoneShade')closePhone();
  });
  document.addEventListener('submit',ev=>{
    const form=ev.target,fd=new FormData(form),p=Object.fromEntries(fd.entries());
    if(!['opsMessageForm','opsAccountForm','opsAccessForm','opsCampaignForm','opsWorkflowForm','opsMeetingForm'].includes(form.id))return;
    ev.preventDefault();
    const cid=currentCompany()==='all'?companies()[0]?.id:currentCompany();
    if(form.id==='opsMessageForm'){
      if(!p.body?.trim())return;
      message('You · CEO',p.body.trim(),p.companyId,'update');B.addActivity('You · CEO','Posted instruction to internal company thread','message',p.companyId);refreshCurrent();B.toast('Internal message posted; not an SMS.');
    }else if(form.id==='opsAccountForm'){
      if(!p.label?.trim())return;
      ent().accounts.push({id:B.uid('acct'),companyId:p.companyId,provider:p.provider,label:p.label.trim().slice(0,90),createdAt:today(),connected:false});
      B.addActivity('You · CEO',`Registered ${p.provider} account label; OAuth not connected`,'settings',p.companyId);
      refreshCurrent();B.toast('Account label saved. Actual account is not connected.');
    }else if(form.id==='opsAccessForm'){
      const account=ent().accounts.find(x=>x.id===p.accountId&&x.companyId===cid);
      const emp=B.getEmployee(p.employeeId);
      if(!account||!emp||emp.companyId!==cid||!emp.active){B.toast('Choose a valid account and active worker.','error');return;}
      if(!serviceAllowed(emp,account.provider)){B.toast('That worker’s department cannot access this provider. Choose a role with the right specialty.','error');return;}
      if(!p.purpose?.trim()){B.toast('Explain the business purpose.','error');return;}
      if(['Chime','Lemonade','iCloud'].includes(account.provider)&&p.permission==='publish'){B.toast('Sensitive account changes are unavailable: read-only planning only.','error');return;}
      makeApproval({companyId:cid,kind:'access',title:`Access: ${emp.name} → ${account.provider}`,requester:emp.name,employeeId:emp.id,provider:account.provider,accountId:account.id,permission:p.permission,note:`${account.label} · Permission: ${p.permission} · Purpose: ${p.purpose.trim().slice(0,450)}. Internal authorization only; service not connected.`});
      refreshCurrent();B.toast('Worker access request sent to your phone inbox.');
    }else if(form.id==='opsCampaignForm'){
      const e=B.getEmployee(p.employeeId),amount=Number(p.amount);
      if(!e||!['paid_advertising','promotion_budgeting'].includes(B.roleFor(e)?.scope)||!(amount>0&&amount<=100000)){B.toast('Select an advertising specialist and valid cap.','error');return;}
      makeApproval({companyId:cid,kind:'campaign',title:`Proposed ${p.provider} promotion`,requester:e.name,employeeId:e.id,provider:p.provider,note:p.note.trim().slice(0,450),amount:Math.round(amount*100)/100});
      refreshCurrent();B.toast('Campaign proposal sent to your phone inbox. No ad was placed.');
    }else if(form.id==='opsWorkflowForm'){
      const wanted=[p.firststep,p.secondstep,p.thirdstep].filter(Boolean);
      if(wanted.length<2||new Set(wanted).size!==wanted.length){B.toast('Choose two or three different specialist positions.','error');return;}
      const assignments=wanted.map(x=>({scope:x,owner:B.roleWorker(cid,x),role:roles().find(r=>r.scope===x)}));
      if(assignments.some(x=>!x.owner)){B.toast('All selected specialists must be active.','error');return;}
      const workflowId=B.uid('workflow'),taskIds=[];
      for(const [i,x] of assignments.entries()){
        const task={id:B.uid('task'),companyId:cid,workflowId,dependsOn:i?taskIds[i-1]:null,title:`${p.title.slice(0,110)} · Step ${i+1}: ${x.role.title}`,description:p.details.trim().slice(0,700),scope:x.scope,ownerId:x.owner.id,delegatedBy:'owner',status:'queued',priority:'High',due:new Date(Date.now()+7*86400000).toLocaleDateString('en-CA'),createdAt:today(),updatedAt:today(),output:'',requiresApproval:['paid_advertising','purchasing','accounts_payable','tax_preparation','finance_strategy','legal_strategy'].includes(x.scope),approvalId:null};
        S().tasks.unshift(task);window.OfficeHQFloor?.onTaskAssigned(task);taskIds.push(task.id);
      }
      ent().workflows.unshift({id:workflowId,companyId:cid,title:p.title.trim(),taskIds,createdAt:today()});
      B.addActivity('You · CEO',`Created ${assignments.length}-stage task handoff workflow: ${p.title}`,'task',cid);refreshCurrent();B.toast('Ordered tasks created; each agent is restricted to its specialty.');
    }else if(form.id==='opsMeetingForm'){
      if(!p.title?.trim()||!p.agenda?.trim()||!p.when){B.toast('Enter a meeting topic, date and agenda.','error');return;}
      const m={id:B.uid('meeting'),companyId:p.companyId,title:p.title.trim().slice(0,120),when:p.when,attendees:p.attendees||'CEO',agenda:p.agenda.trim().slice(0,800),createdAt:today()};
      ent().meetings.unshift(m);
      message('Meeting Secretary',`Internal meeting scheduled: ${m.title} (${fmt(m.when)}). Agenda: ${m.agenda}`,m.companyId,'meeting');
      B.addActivity('Meeting Secretary',`Scheduled ${m.title}`,'meeting',m.companyId);refreshCurrent();B.toast('Meeting added to internal thread; no external SMS was sent.');
    }
  });
  document.addEventListener('input',ev=>{
    if(ev.target.id!=='opsJobSearch')return;
    const q=ev.target.value.trim().toLowerCase();
    let visible=0;
    document.querySelectorAll('#opsJobResults .ops-job').forEach(node=>{
      node.hidden=!node.textContent.toLowerCase().includes(q);
      if(!node.hidden)visible++;
    });
    const count=$('#opsJobCount');if(count)count.textContent=`${visible} matching positions`;
  });
  document.addEventListener('change',ev=>{if(ev.target.id==='companyPicker')queueMicrotask(()=>{badge();updateDrawer();});});
  document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&!$('#officePhoneDrawer')?.hidden)closePhone();});
  ensure();badge();
  const h=location.hash.replace('#/','');if(Object.hasOwn(window.OfficeHQExtraViews,h))B.setView(h);
})();
