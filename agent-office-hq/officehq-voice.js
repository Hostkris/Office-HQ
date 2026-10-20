/* Office HQ voice-first company inbox — responsive Safari/iOS/macOS PWA.
 * Browser speech recognition is optional; iPhone/iPad keyboard dictation is supported.
 * Saved tasks are local to this browser until a separately authorized sync is configured.
 */
(()=>{
'use strict';
const B=window.OfficeHQBridge;if(!B)return;
const $=s=>document.querySelector(s), esc=B.E;
const RULES=[
 ['exec_assistant',/\b(email|inbox|unread|calendar|meeting|appointment|schedule my|reminder|follow.up|executive assistant)\b/i,10],
 ['social',/\b(social media|tiktok|instagram|lemon8|facebook|youtube|twitter|social post|hashtag|post schedule|engagement)\b/i,9],
 ['content',/\b(caption|write (a |the )?(blog|article|script|post)|newsletter|content writing|video script|copywriting)\b/i,9],
 ['graphic_designer',/\b(logo|graphic|thumbnail|poster|flyer|cover art|banner|illustration|design an? image)\b/i,11],
 ['ads',/\b(paid ad|ad campaign|advertis|boost post|paid promotion)\b/i,12],
 ['research',/\b(market research|competitor|research products|customer trends|industry research)\b/i,10],
 ['budget_officer',/\b(budget|expense forecast|spending plan|profit margin)\b/i,10],
 ['cfo',/\b(financial strategy|cash reserve|fundraising|financing strategy)\b/i,10],
 ['bookkeeper',/\b(bookkeep|reconcil|transactions|ledger|income statement)\b/i,11],
 ['ap',/\b(accounts payable|supplier invoice|unpaid bill|payable)\b/i,11],
 ['ar',/\b(accounts receivable|customer invoice|overdue invoice|receivables)\b/i,11],
 ['inventory_mgr',/\b(inventory|stock level|reorder|stockroom|stock count|warehouse)\b/i,11],
 ['purchaser',/\b(purchase order|buy supplies|source supplier|vendor quote|procurement)\b/i,11],
 ['fulfillment',/\b(fulfillment|ship order|shipping label|order tracking)\b/i,10],
 ['qa_manager',/\b(quality assurance|quality control|product defect)\b/i,10],
 ['sales_rep',/\b(sales leads|sales outreach|prospect|find customers|cold email|sales pitch)\b/i,10],
 ['account_mgr',/\b(client accounts|customer renewal|account retention)\b/i,10],
 ['support',/\b(customer service|customer complaint|support ticket|respond to customer|customer question|customer reply)\b/i,10],
 ['hr_dir',/\b(human resources|hiring policy|employee policy|hr management)\b/i,10],
 ['people_ops',/\b(onboard employee|employee record|staff onboarding)\b/i,10],
 ['integrator',/\b(oauth|connect accounts|api connection|platform integration|connect gmail|connect shopify)\b/i,11],
 ['security',/\b(cybersecurity|phishing|security audit|suspicious login|security permissions)\b/i,11],
 ['backend_engineer',/\b(backend|server code|api server|database api)\b/i,11],
 ['frontend_engineer',/\b(frontend|webpage|website bug|user interface|mobile interface|html|css)\b/i,11],
 ['counsel',/\b(legal risk|lawsuit|legal strategy|legal review)\b/i,11],
 ['privacy',/\b(privacy policy|data protection|gdpr|privacy compliance)\b/i,11],
 ['contracts',/\b(contract|agreement|terms of service)\b/i,10],
 ['internal_auditor',/\b(audit|fraud investigation|financial controls|irregularit)\b/i,10],
 ['product_mgr',/\b(product roadmap|product launch plan|new product feature|product strategy)\b/i,10],
 ['catalog',/\b(product listing|product catalog|sku description|etsy listing|shopify product)\b/i,11],
 ['pricing_analyst',/\b(product pricing|selling price|pricing strategy|price comparison)\b/i,11],
 ['project_mgr',/\b(project deadline|project milestone|track project|project plan|project status|coordinate teams)\b/i,10],
 ['chief_staff',/\b(coordinate department|chief of staff|executive delegation)\b/i,10],
 ['coo',/\b(operations strategy|daily operations|operations plan)\b/i,10],
 ['cmo',/\b(marketing strategy|marketing department|brand strategy)\b/i,10],
 ['cro',/\b(revenue growth|revenue strategy|sales strategy)\b/i,10],
 ['cto',/\b(technology strategy|technology roadmap|it strategy)\b/i,10]
];
const local=()=>['localhost','127.0.0.1'].includes(location.hostname);
const companyId=()=>{let c=$('#companyPicker')?.value;return c&&c!=='all'?c:B.getState().companies[0]?.id;};
const normalize=x=>String(x||'').replace(/\s+/g,' ').trim().slice(0,2200);
const part=(box,s)=>box?.querySelector(s);
const status=(box,msg,bad=false)=>{let e=part(box,'[data-voice-status]');if(e){e.textContent=msg;e.dataset.warning=bad?'1':'0';}};
const composer=b=>b.closest('.hq-voice-composer');
const roleByKey=()=>new Map(B.getRoles().map(r=>[r.key,r]));
function route(text,cid){
 const dict=roleByKey(),workers=B.getState().employees.filter(e=>e.companyId===cid&&e.active&&e.roleKey!=='ceo'&&dict.has(e.roleKey));
 const matches=workers.map(e=>({worker:e,role:dict.get(e.roleKey),score:RULES.filter(r=>r[0]===e.roleKey&&r[1].test(text)).reduce((a,r)=>a+r[2],0)}))
 .sort((a,b)=>b.score-a.score||a.role.title.localeCompare(b.role.title));
 const a=matches[0],b=matches[1],gap=(a?.score||0)-(b?.score||0);
 return {matches,top:a?.score?a:null,confident:!!a&&a.score>=8&&gap>=4};
}
function suggest(box){
 const text=normalize(part(box,'[data-voice-text]')?.value),cid=companyId(),match=route(text,cid);
 const sel=part(box,'[data-voice-worker]');if(!sel)return match;
 const previous=sel.dataset.manual==='1'?sel.value:'';
 sel.innerHTML='<option value="">Choose a specialist</option>'+match.matches.map(x=>'<option value="'+esc(x.worker.id)+'">'+esc(x.worker.name+' · '+x.role.title)+'</option>').join('');
 if(previous&&match.matches.some(x=>x.worker.id===previous))sel.value=previous;
 else if(match.top)sel.value=match.top.worker.id;
 const worker=B.getEmployee(sel.value),r=B.roleFor(worker);
 status(box,worker?'Assigned specialist: '+worker.name+' ('+r.title+'). '+(match.confident?'Ready to assign.':'Please confirm this specialist.'):
 'No clear match. Select the employee who should handle this.',!match.confident);
 return match;
}
function post(author,body,cid,kind='update'){
 const s=B.getState();s.enterprise??={};s.enterprise.messages??=[];
 s.enterprise.messages.unshift({id:B.uid('sms'),author,body:normalize(body).slice(0,800),companyId:cid,kind,createdAt:new Date().toISOString(),read:false});
 s.enterprise.messages=s.enterprise.messages.slice(0,400);B.save();
}
let saving=false;
async function assign(box,automatic=false){
 if(saving)return;
 const text=normalize(part(box,'[data-voice-text]')?.value),cid=companyId();
 if(text.length<8){status(box,'Describe your assignment in at least eight characters.',true);return;}
 if(!cid){status(box,'Choose a company.',true);return;}
 const match=suggest(box),sel=part(box,'[data-voice-worker]'),worker=B.getEmployee(sel?.value),r=B.roleFor(worker);
 if(!worker||!r||worker.companyId!==cid||!worker.active||r.key==='ceo'){
  status(box,'Select an active specialist before assigning.',true);return;
 }
 if(automatic&&!match.confident&&sel?.dataset.manual!=='1'){
  status(box,'I heard you. Please confirm the suggested employee and tap Assign task.',true);return;
 }
 saving=true;
 try{
  const now=new Date().toISOString(),title=text.replace(/^(please|office hq|can you|i need someone to|i want you to)\s*[,:]?\s*/i,'').slice(0,115);
  const task={id:B.uid('task'),companyId:cid,title,description:text,scope:r.scope,ownerId:worker.id,
   delegatedBy:'owner',status:'queued',priority:'Medium',due:'',createdAt:now,updatedAt:now,
   output:'',requiresApproval:true,approvalId:null,voiceAssigned:true};
  B.getState().tasks.unshift(task);B.save();window.OfficeHQFloor?.onTaskAssigned(task);
  B.addActivity('You · CEO','Assigned '+title+' to '+worker.name+' in company inbox','task',cid);
  post('Office HQ Dispatcher','Assignment received and routed to '+worker.name+' ('+r.title+'): '+title,cid);
  const input=part(box,'[data-voice-text]');if(input)input.value='';
  if(sel)sel.dataset.manual='0';
  // Public iOS devices cannot call the Mac's loopback-only agent engine.
  // We explicitly do not claim a Mac bot received this browser-local task.
  if(local()&&part(box,'[data-voice-run]')?.checked){
    await tryLocalDraft(task,worker,cid);
  }else if(!local()){
    post('Office HQ Dispatcher','This assignment is saved on this device. Mac execution and cross-device inbox sync require a securely connected backend.',cid,'update');
  }
  B.toast('Assignment saved for '+worker.name+'.');
  window.OfficeHQCompanyInbox?.refresh?.();
 }finally{saving=false;}
}
async function tryLocalDraft(task,worker,cid){
 try{
  const r=await fetch('/api/openmaus/status',{cache:'no-store'});if(!r.ok)throw Error('Local AI engine offline');
  const state=await r.json();
  if(!state.connected||!state.dispatchEnabled||!state.bindings?.some(x=>x.companyId===cid&&x.employeeId===worker.id)){
   post('Office HQ Dispatcher','Task saved; '+worker.name+' is not yet authorized for local AI dispatch.',cid,'update');return;
  }
  const res=await fetch('/api/openmaus/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
   action:'send',companyId:cid,employeeId:worker.id,officeTaskId:task.id,title:task.title,description:task.description,ownerConfirmed:true
  })});
  const data=await res.json();if(!res.ok)throw Error(data.error||'Local dispatch failed');
  task.openMausRunId=data.runId;B.save();
  post(worker.name,'I started the authorized local draft. I will bring it to the CEO inbox when it is complete.',cid);
 }catch(e){post('Office HQ Dispatcher','Assignment saved, but the Mac AI did not start: '+String(e.message).slice(0,180),cid,'alert');}
}
let recognizer=null,recognizerButton=null;
function stopMic(){
 if(recognizer){try{recognizer.stop();}catch{}}
}
function mic(box){
 if(recognizer){stopMic();return;}
 const Ctor=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!Ctor){
  const field=part(box,'[data-voice-text]');field?.focus();
  status(box,'Use the microphone on your iPhone/iPad keyboard to dictate, then tap Assign task.',true);
  return;
 }
 let rec;
 try{rec=new Ctor();rec.lang=navigator.language||'en-US';rec.continuous=false;rec.interimResults=true;}
 catch(e){status(box,'Microphone unavailable. Use keyboard Dictation.',true);return;}
 recognizer=rec;recognizerButton=part(box,'[data-voice-action="listen"]');
 if(recognizerButton){recognizerButton.textContent='■ Stop recording';recognizerButton.setAttribute('aria-pressed','true');}
 status(box,'Listening for your assignment…');
 let final='',failed=false;
 rec.onresult=ev=>{
  let current='',complete='';
  for(let i=0;i<ev.results.length;i++){
   const spoken=ev.results[i][0]?.transcript||'';
   current+=spoken+' ';if(ev.results[i].isFinal)complete+=spoken+' ';
  }
  const field=part(box,'[data-voice-text]');if(field)field.value=normalize(current);
  final=normalize(complete);
 };
 rec.onerror=ev=>{failed=true;status(box,'Speech recognition: '+(ev.error||'unavailable')+'. Use keyboard Dictation if needed.',true);};
 rec.onend=()=>{
  if(recognizer===rec){recognizer=null;recognizerButton=null;}
  const button=part(box,'[data-voice-action="listen"]');
  if(button){button.textContent='🎙 Speak assignment';button.setAttribute('aria-pressed','false');}
  if(!failed&&final){suggest(box);void assign(box,true);}
  else if(!failed)status(box,'No clear speech heard. Try again or dictate with the keyboard.',true);
 };
 try{rec.start();}catch(e){recognizer=null;recognizerButton=null;status(box,'Microphone could not start. Try keyboard Dictation.',true);}
}
function poll(){
 if(!local()||(location.hash!=='#/thread'&&$('#officePhoneDrawer')?.hidden!==false))return;
 fetch('/api/openmaus/status',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(x=>{
  const s=B.getState();let touched=false;
  for(const j of x.runs||[]){
   const t=s.tasks.find(t=>t.id===j.officeTaskId&&t.ownerId===j.employeeId&&t.companyId===j.companyId);
   if(!t||['blocked','done','cancelled'].includes(t.status))continue;
   if(j.status==='review'&&t.voiceReviewInboxRunId!==j.id){
    t.voiceReviewInboxRunId=j.id;t.output=String(j.result||'').slice(0,16000);t.status='review';t.updatedAt=new Date().toISOString();
    if(!s.approvals.some(a=>a.taskId===t.id&&a.status==='pending')){
     const a={id:B.uid('approve'),companyId:t.companyId,kind:'task',taskId:t.id,title:'Review draft: '+t.title,
      note:'Please read the work before approving or denying.',requester:j.employeeName,status:'pending',createdAt:new Date().toISOString()};
     s.approvals.unshift(a);t.approvalId=a.id;
    }
    post(j.employeeName,'I completed the draft for CEO review: '+t.title,j.companyId,'request');touched=true;
   }
   if(['failed','stopped','needs-input','paused'].includes(j.status)&&t.voiceLastAlert!==j.status){
    t.voiceLastAlert=j.status;post(j.employeeName,'I need your help with '+t.title+': '+String(j.reason||j.status).slice(0,210),j.companyId,'alert');touched=true;
   }
  }
  if(touched){B.save();window.OfficeHQCompanyInbox?.refresh?.();}
 }).catch(()=>{});
}
document.addEventListener('input',ev=>{
 if(ev.target.matches?.('[data-voice-text]')){const box=composer(ev.target),sel=part(box,'[data-voice-worker]');if(sel)sel.dataset.manual='0';suggest(box);}
});
document.addEventListener('change',ev=>{
 if(ev.target.matches?.('[data-voice-worker]')){ev.target.dataset.manual='1';const e=B.getEmployee(ev.target.value);status(composer(ev.target),e?'Selected '+e.name+' ('+B.roleFor(e)?.title+').':'Select a specialist.',!e);}
});
document.addEventListener('click',ev=>{
 const b=ev.target.closest?.('[data-voice-action]');if(!b)return;
 ev.preventDefault();const box=composer(b);
 if(b.dataset.voiceAction==='listen')mic(box);
 if(b.dataset.voiceAction==='assign')void assign(box);
});
window.OfficeHQVoiceRouting={route};
setInterval(poll,12000);setTimeout(poll,2000);
})();