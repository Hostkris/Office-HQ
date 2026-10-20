/* CEO Secure Desk conversation prototype.
 * Local-first task intake; no carrier SMS, browser account access or unapproved publishing.
 */
(function startSecureDesk(){
  'use strict';
  const B=window.OfficeHQBridge;
  if(!B)return;
  const E=B.E;
  const RULES=[
    ['exec_assistant',/\b(assistant|secretary|inbox|email|calendar|remind|schedule|appointment|errand|dry clean(?:ing|ers)?|coffee)\b/i],
    ['project_mgr',/\b(project|coordinate|milestone|rollout|timeline|launch plan)\b/i],
    ['cfo',/\b(financial strategy|cash flow|investment|finance plan)\b/i],
    ['budget_officer',/\b(budget|cost forecast|spending plan)\b/i],
    ['bookkeeper',/\b(bookkeep|reconcil|transaction|ledger)\b/i],
    ['ap',/\b(invoice payment|payable|vendor bill)\b/i],
    ['ar',/\b(receivable|collect payment|customer invoice)\b/i],
    ['inventory_mgr',/\b(inventory|stock count|stock level)\b/i],
    ['purchaser',/\b(purchas|supplier|source product|wholesale)\b/i],
    ['fulfillment',/\b(fulfill|shipping|ship order|dispatch parcel)\b/i],
    ['qa_manager',/\b(quality|inspection|defect|test product)\b/i],
    ['content',/\b(content|caption|script|blog|newsletter|copywriting)\b/i],
    ['social',/\b(social media|instagram|tiktok|facebook|youtube|linkedin|tweet|post)\b/i],
    ['ads',/\b(advertis|paid ads|ad campaign|promotion budget)\b/i],
    ['research',/\b(research|competitor|market trend|survey|audience)\b/i],
    ['graphic_designer',/\b(design|graphic|logo|poster|banner|thumbnail|illustrat)\b/i],
    ['sales_rep',/\b(sales leads|prospect|outreach|sell to)\b/i],
    ['account_mgr',/\b(client account|customer relationship|renewal)\b/i],
    ['support',/\b(customer support|customer question|complaint|refund|ticket)\b/i],
    ['hr_dir',/\b(hiring plan|HR policy|personnel)\b/i],
    ['people_ops',/\b(onboard|employee training|staff schedule)\b/i],
    ['cto',/\b(technical strategy|technology roadmap)\b/i],
    ['integrator',/\b(integration|connect apps|API|OAuth|automate workflow|sync)\b/i],
    ['security',/\b(cybersecurity|security audit|credential|incident|vulnerability)\b/i],
    ['backend_engineer',/\b(backend|database|server|API endpoint)\b/i],
    ['frontend_engineer',/\b(frontend|website|web app|user interface|UI|CSS)\b/i],
    ['counsel',/\b(legal advice|lawsuit|legal risk)\b/i],
    ['privacy',/\b(privacy|consent|GDPR|data protection|compliance)\b/i],
    ['contracts',/\b(contract|agreement|terms of service)\b/i],
    ['internal_auditor',/\b(audit|internal control|fraud review)\b/i],
    ['product_mgr',/\b(product strategy|product roadmap|new product)\b/i],
    ['catalog',/\b(product listing|catalog|SKU|product description)\b/i],
    ['pricing_analyst',/\b(pricing|price analysis|profit margin|markup)\b/i]
  ];
  const now=()=>new Date().toISOString();
  function companyId(){const v=document.querySelector('#companyPicker')?.value;return v&&v!=='all'?v:B.getState().companies[0]?.id;}
  function db(){
    const state=B.getState();state.enterprise??={};
    const d=state.enterprise.ceoSecureChat??={entries:[],jobs:[]};
    if(!Array.isArray(d.entries))d.entries=[];
    if(!Array.isArray(d.jobs))d.jobs=[];
    return d;
  }
  function log(cid,author,body,kind,jobId){
    db().entries.push({id:B.uid('chat'),companyId:cid,author,body:String(body).slice(0,3500),kind:kind||'message',jobId:jobId||'',at:now()});
    db().entries=db().entries.slice(-500);B.save();
  }
  function active(cid){return db().jobs.filter(j=>j.companyId===cid).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
  function assigned(job){return job.employeeIds.map(id=>B.getEmployee(id)?.name||'Unavailable employee').join(', ');}
  function route(text,cid){
    const employees=B.getState().employees.filter(e=>e.active&&e.companyId===cid&&e.roleKey!=='ceo');
    const found=RULES.filter(r=>r[1].test(text)).map(r=>employees.find(e=>e.roleKey===r[0])).filter(Boolean);
    let unique=[...new Map(found.map(e=>[e.id,e])).values()];
    if(unique.length>3)unique=unique.slice(0,3);
    if(unique.length===0){
      const secretary=employees.find(e=>e.roleKey==='exec_assistant');
      return {employees:secretary?[secretary]:[],uncertain:true};
    }
    return {employees:unique,uncertain:false};
  }
  function question(text,uncertain){
    if(uncertain)return 'Which department or kind of specialist should handle this? For example: marketing, finance, technology, sales or operations.';
    if(/\b(publish|post|advertise)\b/i.test(text)&&!/\b(instagram|facebook|tiktok|youtube|linkedin|twitter| x |website|blog)\b/i.test(text))return 'Which platform is this for? I can prepare the draft before anything is published.';
    if(/\b(schedule|book an? appointment|pickup|pick up|dry clean(?:ing|ers)?)\b/i.test(text)&&!/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}[:/]\d{1,2}|next week)\b/i.test(text))return 'What day should I plan this for? Nothing will be booked or purchased without your approval.';
    return '';
  }
  function taskFor(job,person,instruction){
    const role=B.roleFor(person),date=now();
    return {id:B.uid('task'),companyId:job.companyId,conversationId:job.id,
      title:instruction.slice(0,110),description:instruction,scope:role.scope,ownerId:person.id,
      delegatedBy:'owner',status:'queued',priority:'Medium',due:'',createdAt:date,updatedAt:date,
      output:'',requiresApproval:true,approvalId:null,ceoSecureDesk:true,cloudSyncRequested:true};
  }
  async function attemptDispatch(job,tasks){
    if(!['localhost','127.0.0.1'].includes(location.hostname)){
      const synced=window.OfficeHQDeviceSync?.snapshot?.();
      log(job.companyId,'Office HQ Assistant',synced?.connected?'The assignment was submitted for secure Mac sync. It will run only if the Mac is online, local drafting is enabled, and this employee has been approved.':'The assignment is saved and eligible for secure Mac sync. Connect both devices in Company Messages and authorize this employee on your Mac to start a draft.', 'notice',job.id);
      refresh();return;
    }
    let status;
    try{
      const check=await fetch('/api/openmaus/status',{cache:'no-store'});
      if(!check.ok)throw Error('Local agent engine unavailable');
      status=await check.json();
    }catch{
      log(job.companyId,'Office HQ Assistant','Assignments are queued. The local agent engine is offline.', 'notice',job.id);
      refresh();return;
    }
    if(!status.connected||!status.dispatchEnabled){
      log(job.companyId,'Office HQ Assistant','Assignments are queued; live agent dispatch is not enabled on the Mac.', 'notice',job.id);
      refresh();return;
    }
    for(const task of tasks){
      const bound=(status.bindings||[]).some(x=>x.companyId===job.companyId&&x.employeeId===task.ownerId);
      if(!bound){log(job.companyId,'Office HQ Assistant',(B.getEmployee(task.ownerId)?.name||'This employee')+' is not authorized for live execution. The task stays queued.', 'notice',job.id);continue;}
      try{
        const response=await fetch('/api/openmaus/action',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'send',companyId:job.companyId,employeeId:task.ownerId,officeTaskId:task.id,title:task.title,description:task.description,ownerConfirmed:true})});
        const data=await response.json();
        if(!response.ok)throw Error(data.error||'Agent run could not start');
        task.openMausRunId=data.runId;task.status='in_progress';task.ceoLastNotifiedStatus='in_progress';
        log(job.companyId,B.getEmployee(task.ownerId)?.name||'Employee','The authorized local draft has started.', 'progress',job.id);
      }catch(e){
        log(job.companyId,'Office HQ Assistant','Could not start '+(B.getEmployee(task.ownerId)?.name||'the agent')+': '+String(e.message).slice(0,150), 'notice',job.id);
      }
    }
    B.save();refresh();
  }
  function queue(job,revision){
    const names=job.employeeIds.map(id=>B.getEmployee(id)).filter(Boolean);
    const tasks=names.map(employee=>taskFor(job,employee,job.instruction));
    for(const task of tasks){B.getState().tasks.unshift(task);window.OfficeHQFloor?.onTaskAssigned(task);}
    job.currentTaskIds=tasks.map(t=>t.id);job.taskIds.push(...job.currentTaskIds);job.status='queued';job.updatedAt=now();
    log(job.companyId,'Office HQ Assistant',(revision?'Revision':'Assignment')+' prepared for '+assigned(job)+'. '+(names.length>1?'Each specialist has a separate job. ':'')+'I will show actual results when the engine returns them.', 'progress',job.id);
    B.save();for(const task of tasks)window.OfficeHQDeviceSync?.pushTask?.(task);
    refresh();void attemptDispatch(job,tasks);
  }
  function intake(instruction,cid){
    const choice=route(instruction,cid);
    if(!choice.employees.length){log(cid,'Office HQ Assistant','No active AI employees are available in this company.', 'notice');refresh();return;}
    const job={id:B.uid('ceojob'),companyId:cid,instruction,employeeIds:choice.employees.map(e=>e.id),
      taskIds:[],currentTaskIds:[],status:'new',createdAt:now(),updatedAt:now()};
    db().jobs.push(job);
    log(cid,'You · CEO',instruction,'own',job.id);
    const ask=question(instruction,choice.uncertain);
    if(ask){job.status='needs-answer';job.question=ask;log(cid,'Office HQ Assistant',ask,'question',job.id);B.save();refresh();return;}
    log(cid,'Office HQ Assistant','Routing to '+assigned(job)+'. You can review and request changes in this same conversation.', 'progress',job.id);
    queue(job,false);
  }
  let replyTargetJobId='';
  function send(){
    const box=document.querySelector('[data-ceo-chat-input]:focus')||document.querySelector('#officePhoneDrawer:not([hidden]) [data-ceo-chat-input]')||document.querySelector('[data-ceo-chat-input]');
    const cid=companyId(),text=box?.value.trim();
    if(!cid||!text)return;
    if(text.length<3){B.toast('Please enter a little more detail.','error');return;}
    const jobId=box.dataset.replyJob||replyTargetJobId;
    box.value='';box.dataset.replyJob='';replyTargetJobId='';
    const job=jobId?db().jobs.find(j=>j.id===jobId&&j.companyId===cid):null;
    if(job){
      if(['approved','denied'].includes(job.status)){B.toast('That assignment is closed. Start a new message instead.','error');return;}
      log(cid,'You · CEO',text,'own',job.id);
      if(job.status==='needs-answer'){
        job.instruction+=' \nAdditional details: '+text;job.question='';
        const reroute=route(job.instruction,cid);
        if(reroute.employees.length)job.employeeIds=reroute.employees.map(e=>e.id);
        log(cid,'Office HQ Assistant','Thanks, I have the details. Routing to '+assigned(job)+'.', 'progress',job.id);
        queue(job,false);
      }else{
        const tasks=B.getState().tasks.filter(t=>job.currentTaskIds.includes(t.id));
        for(const task of tasks){
          const a=B.getState().approvals.find(a=>a.taskId===task.id&&a.status==='pending');
          if(a)a.status='superseded';
        }
        job.instruction+=' \nCEO revision request: '+text;
        log(cid,'Office HQ Assistant','Revision requested. I will keep the earlier draft for comparison and queue an updated draft.', 'progress',job.id);
        queue(job,true);
      }
    }else intake(text,cid);
    refresh();
  }
  function syncJobUpdates(){
    const all=B.getState().tasks;
    for(const job of db().jobs){
      if(['approved','denied'].includes(job.status))continue;
      for(const id of job.currentTaskIds||[]){
        const task=all.find(t=>t.id===id);
        if(!task||task.status===task.ceoLastNotifiedStatus)continue;
        if(task.status==='in_progress'){
          task.ceoLastNotifiedStatus='in_progress';
          log(job.companyId,B.getEmployee(task.ownerId)?.name||'Assigned employee','The authorized Mac engine has accepted my draft assignment.', 'progress',job.id);
        }else if(task.status==='review'&&task.output){
          task.ceoLastNotifiedStatus='review';
          log(job.companyId,B.getEmployee(task.ownerId)?.name||'Assigned employee','My draft is ready for your review: '+task.title, 'progress',job.id);
        }else if(task.status==='blocked'){
          task.ceoLastNotifiedStatus='blocked';
          log(job.companyId,'Office HQ Assistant',(B.getEmployee(task.ownerId)?.name||'Employee')+' could not complete the draft. '+String(task.runError||'Check Mac agent status and permissions.').slice(0,180),'notice',job.id);
        }
      }
    }
  }
  let localPollBusy=false;
  async function pollLocalRuns(){
    if(!['localhost','127.0.0.1'].includes(location.hostname)||document.hidden||localPollBusy)return;
    const tasks=B.getState().tasks.filter(t=>t.ceoSecureDesk&&t.openMausRunId&&['queued','in_progress'].includes(t.status));
    if(!tasks.length)return;
    localPollBusy=true;
    try{
      const res=await fetch('/api/openmaus/status',{cache:'no-store'});
      if(!res.ok)throw Error('Mac runtime status unavailable');
      const data=await res.json();let changed=false;
      for(const task of tasks){
        const run=(data.runs||[]).find(r=>r.id===task.openMausRunId&&r.companyId===task.companyId&&r.employeeId===task.ownerId&&r.officeTaskId===task.id);
        if(!run)continue;
        const old=task.status;
        if(run.status==='review'&&run.result){
          task.output=String(run.result).slice(0,16000);task.status='review';
          if(!B.getState().approvals.some(a=>a.taskId===task.id&&a.status==='pending')){
            const a={id:B.uid('approve'),companyId:task.companyId,kind:'task',taskId:task.id,title:'Review draft: '+task.title,
              note:'Review the actual Mac AI draft before accepting it.',status:'pending',createdAt:now()};
            B.getState().approvals.unshift(a);task.approvalId=a.id;
          }
        }else if(['failed','stopped','paused'].includes(run.status)){
          task.status='blocked';task.runError=String(run.reason||run.thought||run.status).slice(0,250);
        }else if(run.status==='running'||run.status==='submitted')task.status='in_progress';
        if(task.status!==old){task.updatedAt=now();window.OfficeHQFloor?.onTaskStatus?.(task);changed=true;}
      }
      if(changed){B.save();refresh();}
    }catch{/* Keep last verified state; never simulate a successful run when the engine is unreachable. */}
    finally{localPollBusy=false;}
  }
  setInterval(()=>{if(!document.hidden){void pollLocalRuns();}},4000);

  function card(job){
    const tasks=job.currentTaskIds.map(id=>B.getState().tasks.find(t=>t.id===id)).filter(Boolean);
    const previews=tasks.filter(t=>t.output&&t.status==='review');
    const approvals=previews.map(t=>B.getState().approvals.find(a=>a.taskId===t.id&&a.status==='pending')).filter(Boolean);
    const allReady=tasks.length>0&&previews.length===tasks.length;
    const mac=['localhost','127.0.0.1'].includes(location.hostname);
    const paired=window.OfficeHQDeviceSync?.snapshot?.()?.connected===true;
    const hasVerifiedWork=tasks.some(t=>t.status==='in_progress'&&(mac?!!t.openMausRunId:!!t.cloudSynced&&paired));
    const hasUnverifiedWork=tasks.some(t=>t.status==='in_progress')&&!hasVerifiedWork;
    const fmt=job.status==='needs-answer'?'Needs your answer':job.status==='held'?'On hold':job.status==='approved'?'Approved':job.status==='denied'?'Denied':allReady?'Draft ready for review':previews.length?'Some drafts ready; waiting for team':hasVerifiedWork?'Agent working':hasUnverifiedWork?'Mac connection lost — status unverified':tasks.some(t=>t.status==='blocked')?'Agent needs attention':'Queued — waiting for an authorized agent';
    let html='<section class="ceo-job" data-ceo-job="'+E(job.id)+'"><div class="ceo-job-head"><strong>Assignment</strong><span>'+E(fmt)+'</span></div>';
    html+='<p class="ceo-job-people">'+E(assigned(job))+'</p>';
    if(previews.length){
      for(const task of previews)html+='<details class="ceo-preview"><summary>Preview: '+E(B.getEmployee(task.ownerId)?.name||'Employee')+'</summary><pre>'+E(task.output.slice(0,14000))+'</pre></details>';
      html+='<div class="ceo-job-actions">';
      if(allReady&&approvals.length===tasks.length&&job.status!=='approved'&&job.status!=='denied')html+='<button type="button" data-ceo-chat-action="approve" data-job="'+E(job.id)+'">✓ Approve</button><button type="button" data-ceo-chat-action="deny" data-job="'+E(job.id)+'">Deny</button>';
      if(job.status!=='approved'&&job.status!=='denied')html+='<button type="button" data-ceo-chat-action="hold" data-job="'+E(job.id)+'">Wait</button><button type="button" data-ceo-chat-action="revise" data-job="'+E(job.id)+'">Request changes</button>';
      html+='</div>';
    }else if(job.status==='needs-answer')html+='<button type="button" class="ceo-reply" data-ceo-chat-action="reply" data-job="'+E(job.id)+'">Answer question</button>';
    else if(!['approved','denied'].includes(job.status)){
      html+='<button type="button" class="ceo-reply" data-ceo-chat-action="revise" data-job="'+E(job.id)+'">Add instructions</button>';
      if(['localhost','127.0.0.1'].includes(location.hostname)&&tasks.some(t=>t.status==='queued'))html+='<button type="button" class="ceo-reply" data-ceo-chat-action="retry" data-job="'+E(job.id)+'">Start authorized Mac draft</button>';
      if(!['localhost','127.0.0.1'].includes(location.hostname)&&tasks.some(t=>t.status==='queued'&&!t.cloudSyncRequested))html+='<button type="button" class="ceo-reply" data-ceo-chat-action="sync" data-job="'+E(job.id)+'">Send saved assignment to Mac</button>';
    }
    html+='</section>';return html;
  }
  function render(){
    syncJobUpdates();
    const cid=companyId();const data=db(),entries=data.entries.filter(m=>m.companyId===cid).slice(-65);
    const jobs=active(cid).slice(0,8);
    const stamp=x=>{try{return new Date(x).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}catch{return ''}};
    let html='<section class="ceo-chat"><div class="ceo-chat-title"><strong>Company Messages</strong><small>CEO Secure Desk · Internal conversation</small></div>';
    html+='<div class="ceo-chat-log" role="log" aria-live="polite">';
    if(!entries.length)html+='<p class="ceo-chat-empty">Message your Office HQ assistant. It will choose the best available specialist or team, ask for missing details, and show real drafts for review.</p>';
    for(const item of entries){
      html+='<div class="ceo-chat-bubble '+(item.kind==='own'?'sent':'received')+'"><div class="ceo-chat-name">'+E(item.author)+'</div><p>'+E(item.body)+'</p><time>'+E(stamp(item.at))+'</time></div>';
    }
    html+='</div><div class="ceo-chat-jobs">'+jobs.map(card).join('')+'</div>';
    html+='<div class="ceo-chat-compose"><textarea data-ceo-chat-input rows="2" maxlength="2200" placeholder="'+(replyTargetJobId?'Reply with the details or changes…':'Message Office HQ…')+'" data-reply-job="'+E(replyTargetJobId)+'"></textarea>';
    html+='<div class="ceo-chat-buttons"><button type="button" data-ceo-chat-action="mic" aria-label="Dictate a message">🎙</button><button type="button" class="ceo-chat-send" data-ceo-chat-action="send">Send ➤</button></div></div>';
    html+='<p class="ceo-chat-note">Internal messages are not SMS. Jobs require authorized agent engines; external posts, payments and account access remain separately controlled.</p></section>';
    return html;
  }
  function refresh(){window.OfficeHQCompanyInbox?.refresh?.();}
  function setReply(jobId){
    const root=document.querySelector('#officePhoneDrawer:not([hidden])')||document;
    replyTargetJobId=jobId;
    const input=root.querySelector('[data-ceo-chat-input]')||document.querySelector('[data-ceo-chat-input]');
    if(input){input.dataset.replyJob=jobId;input.placeholder='Reply with the details or changes…';input.focus();}
  }
  function decision(job,kind){
    if(kind==='sync'){
      // Older iPhone assignments were saved before cloudSyncRequested existed.
      // Only a fresh CEO button press opts these older tasks into the owner-authenticated Mac queue.
      if(['approved','denied'].includes(job.status))return;
      const pending=job.currentTaskIds.map(id=>B.getState().tasks.find(t=>t.id===id))
        .filter(t=>t?.ceoSecureDesk&&t.status==='queued'&&!t.cloudSyncRequested);
      if(!pending.length)return;
      for(const task of pending){task.cloudSyncRequested=true;window.OfficeHQDeviceSync?.pushTask?.(task);}
      B.save();
      log(job.companyId,'You · CEO','Send my previously saved assignment to the authorized Mac draft queue.','own',job.id);
      log(job.companyId,'Office HQ Assistant','Queued for secure Mac sync. Execution still requires a connected Mac and separately authorized employee.', 'notice',job.id);
      refresh();return;
    }
    if(kind==='retry'){
      const tasks=job.currentTaskIds.map(id=>B.getState().tasks.find(t=>t.id===id)).filter(t=>t?.status==='queued');
      if(tasks.length)void attemptDispatch(job,tasks);
      return;
    }
    if(kind==='reply'||kind==='revise'){
      if(['approved','denied'].includes(job.status)){B.toast('That assignment is closed. Send a new request to make further changes.','error');return;}
      setReply(job.id);return;
    }
    if(['approved','denied'].includes(job.status))return;
    const tasks=job.currentTaskIds.map(id=>B.getState().tasks.find(t=>t.id===id)).filter(Boolean);
    if(kind==='hold'){
      if(!tasks.some(t=>t.status==='review')){B.toast('This assignment is queued or working. Wait applies to draft review only.','error');return;}
      job.status='held';log(job.companyId,'You · CEO','Hold this draft. I will review it later.','own',job.id);B.save();refresh();return;
    }
    const reviews=tasks.filter(t=>t.status==='review'&&t.output);
    if(!reviews.length||reviews.length!==tasks.length){B.toast('All drafts must be ready before a final decision.','error');return;}
    const approvals=reviews.map(t=>B.getState().approvals.find(a=>a.taskId===t.id&&a.status==='pending'));
    if(approvals.some(a=>!a)){B.toast('The approval record is not ready yet.','error');return;}
    for(const a of approvals)B.decideApproval(a.id,kind==='approve'?'approved':'rejected');
    job.status=kind==='approve'?'approved':'denied';
    log(job.companyId,'You · CEO',kind==='approve'?'I approve the reviewed drafts.':'I deny these drafts.','own',job.id);
    B.save();refresh();
  }
  let listening=false;
  function mic(button){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    const area=button.closest('.ceo-chat')?.querySelector('[data-ceo-chat-input]');
    if(!area)return;
    if(!Recognition){area.focus();B.toast('Use your iPhone keyboard microphone for dictation.');return;}
    if(listening)return;
    try{
      const rec=new Recognition();rec.lang=navigator.language||'en-US';rec.interimResults=false;rec.continuous=false;
      listening=true;button.textContent='■';rec.onresult=ev=>{area.value+=(area.value?' ':'')+(ev.results?.[0]?.[0]?.transcript||'');};
      rec.onerror=()=>B.toast('Microphone was unavailable. Try keyboard dictation.','error');
      rec.onend=()=>{listening=false;button.textContent='🎙';};rec.start();
    }catch{listening=false;B.toast('Try keyboard dictation.','error');}
  }
  document.addEventListener('click',ev=>{
    const button=ev.target.closest('[data-ceo-chat-action]');if(!button)return;
    ev.preventDefault();const op=button.dataset.ceoChatAction;
    if(op==='send'){send();return;}
    if(op==='mic'){mic(button);return;}
    const job=db().jobs.find(j=>j.id===button.dataset.job&&j.companyId===companyId());
    if(job)decision(job,op);
  });
  document.addEventListener('keydown',ev=>{
    if(ev.target.matches?.('[data-ceo-chat-input]')&&ev.key==='Enter'&&!ev.shiftKey){
      ev.preventDefault();send();
    }
  });
  window.OfficeHQSecureChat={render,route,pollLocalRuns,syncJobUpdates};
  queueMicrotask(()=>{if(location.hash==='#/thread')refresh();});
})();
