/* Office HQ secure owner-to-owner device relay.
 * Uses Supabase RLS owner rows; never exposes service_role credentials.
 * Safari must be open to push local tasks; the paired Mac server continues
 * polling while running, using its own private auth refresh token.
 */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
const ROOT='https://wvadoqncgrmfsftefuoy.supabase.co';
const KEY='sb_publishable_c3owfootc_qRwCN7v3Q24Q_GKB8PIjK';
const SKEY='office_hq_device_sync_session_v1';
const DKEY='office_hq_device_sync_id_v1';
const STALE=90000;
const TEAM_PREFIX='OFFICE_HQ_TEAM_V1:';
function teamEnvelope(raw){
 if(typeof raw!=='string'||!raw.startsWith(TEAM_PREFIX))return null;
 try{const end=raw.indexOf('\n'),m=JSON.parse(raw.slice(TEAM_PREFIX.length,end));
  if(!/^[-\w.]{1,100}$/.test(m.id)||typeof m.department!=='string'||typeof m.title!=='string'||!Number.isInteger(m.expectedTaskCount)||m.expectedTaskCount<1||m.expectedTaskCount>39)return null;
  return {meta:m,description:raw.slice(end+1)};
 }catch{return null;}
}
const local=()=>['127.0.0.1','localhost'].includes(location.hostname);
const TYPE=local()?'mac':'ios';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const getBody=()=>B?.getState();
let id=localStorage.getItem(DKEY);
if(!id){id=TYPE+'-'+crypto.randomUUID();localStorage.setItem(DKEY,id);}
let auth=null,inFlight=false,lastError='',status={connected:false,reason:'Sign in to pair your devices.',checkedAt:null,peer:''};
try{auth=JSON.parse(sessionStorage.getItem(SKEY)||'null');}catch{}
const fresh=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))&&Date.now()-Date.parse(x)>=0&&Date.now()-Date.parse(x)<STALE;
const notice=x=>{lastError=x;document.querySelectorAll('[data-hq-sync-feedback]').forEach(el=>el.textContent=x);};
async function fetchJson(path,options={},token){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),10000);
 try{
  const r=await fetch(ROOT+path,{...options,headers:{
   apikey:KEY,...(token?{Authorization:'Bearer '+token}:{}),
   ...(options.body?{'Content-Type':'application/json'}:{}),
   ...(options.headers||{})
  },cache:'no-store',signal:ctrl.signal});
  const data=await r.json().catch(()=>null);
  if(!r.ok)throw Error('Cloud request '+r.status+(data?.msg?' · '+data.msg:''));
  return data;
 }finally{clearTimeout(timer);}
}
async function token(){
 if(!auth?.access_token)throw Error('Sign in to Office HQ sync.');
 if(Date.now()<Number(auth.expires_at)-65000)return auth.access_token;
 const s=await fetchJson('/auth/v1/token?grant_type=refresh_token',{
  method:'POST',body:JSON.stringify({refresh_token:auth.refresh_token})});
 auth={...auth,access_token:s.access_token,refresh_token:s.refresh_token,
  expires_at:Date.now()+Number(s.expires_in||3600)*1000};
 sessionStorage.setItem(SKEY,JSON.stringify(auth));return auth.access_token;
}
async function rest(table,method='GET',body=null,query='',prefer='return=representation'){
 const jwt=await token();const opts={method,headers:{Prefer:prefer}};
 if(body!==null)opts.body=JSON.stringify(body);
 return fetchJson('/rest/v1/'+table+query,opts,jwt);
}
function verified(data,now=Date.now()){
 const ok=s=>{const x=Date.parse(s);return Number.isFinite(x)&&x<=now+10000&&now-x>=0&&now-x<STALE;};
 return !!(data&&data.connected===true&&data.authenticated===true&&data.paired===true&&
  data.peerOnline===true&&data.bidirectional===true&&
  /^(mac|iphone|ipad|ios)$/i.test(data.peerDevice||'')&&ok(data.lastInboundAck)&&ok(data.lastOutboundAck));
}
function set(next){status={...status,...next};draw();}
function draw(){
 for(const button of document.querySelectorAll('[data-hq-sync-indicator]')){
  button.dataset.connected=String(status.connected);
  button.classList.toggle('is-connected',status.connected);
  button.classList.toggle('is-disconnected',!status.connected);
  button.setAttribute('aria-label',status.connected?'Device sync connected: Mac and iPhone/iPad are exchanging assignments.':'Device sync disconnected: '+status.reason);
  button.title=status.connected?'Mac ↔ iPhone/iPad: connected and syncing':status.reason;
  const label=button.querySelector('[data-hq-sync-label]');
  if(label)label.textContent=status.connected?'Synced':'Not synced';
 }
 for(const el of document.querySelectorAll('[data-hq-sync-explanation]')){
  el.textContent=status.connected?'Mac and iPhone/iPad are exchanging assignments.':status.reason;
 }
 for(const el of document.querySelectorAll('[data-hq-sync-auth]')){
  el.hidden=!!auth?.access_token;
 }
 for(const el of document.querySelectorAll('[data-hq-sync-paired]'))el.hidden=!auth?.access_token;
 for(const el of document.querySelectorAll('[data-hq-sync-mac-control]'))el.hidden=!local()||!auth?.access_token;
 employeeOptions();
}
function markup(compact=false){
 return '<section class="hq-device-sync-wrap'+(compact?' is-compact':'')+'" aria-label="Mac and iOS synchronization status">'+
 '<div class="hq-device-sync-summary"><button type="button" class="hq-device-sync is-disconnected" data-hq-sync-indicator data-connected="false" '+
 'aria-label="Device sync disconnected" title="Mac and iPhone/iPad are not connected">'+
 '<span class="hq-sync-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><b class="hq-sync-x">×</b></span>'+
 '<span data-hq-sync-label>Not synced</span></button>'+
 '<span class="hq-sync-caption">Mac ↔ iPhone / iPad</span></div>'+
 '<p class="hq-sync-detail" data-hq-sync-explanation>Sign in with the same Office HQ Cloud account on both devices.</p>'+
 '<details class="hq-sync-settings"><summary>Connect devices / manage sync</summary>'+
 '<form data-hq-sync-form="login" data-hq-sync-auth><label>Office HQ Cloud email<input type="email" name="email" required autocomplete="username" placeholder="Email address"></label>'+
 '<label>Password<input type="password" name="password" required autocomplete="current-password"></label>'+
 '<button type="submit" class="btn btn-primary">Sign in & enable secure assignment sync</button>'+
 '<p class="tiny muted">Use your existing Secure Cloud HQ login on both devices. Credentials are sent only to Supabase Auth, never to your employees. If you have not registered, <a href="./cloud.html">create your Cloud HQ account</a> first.</p></form>'+
 '<div data-hq-sync-paired hidden><p class="tiny">Signed in to your private Office HQ sync account.</p>'+
 '<button type="button" class="btn btn-sm" data-hq-sync-action="check">↻ Check sync</button> '+
 '<button type="button" class="btn btn-sm btn-danger" data-hq-sync-action="disconnect">Disconnect this device</button></div>'+
 (local()?'<div data-hq-sync-mac-control hidden><hr>'+
 '<p class="tiny"><strong>Mac AI permissions:</strong> Authorize each specialist separately. No external account actions are allowed.</p>'+
 '<label>Authorized Mac specialist<select data-hq-sync-employee></select></label>'+
 '<button type="button" class="btn btn-sm" data-hq-sync-action="grant">Authorize selected employee for synced drafts</button> '+
 '<button type="button" class="btn btn-sm" data-hq-sync-action="dispatch">Enable local Ollama drafts</button></div>':'')+
 '<p class="tiny muted">Both devices must have matching company names and an active specialist in the same role. The Mac bot executes only if explicitly authorized.</p>'+ 
 '<p role="status" aria-live="polite" class="tiny muted" data-hq-sync-feedback></p></details></section>';
}
function employeeOptions(){
 if(!B||!local())return;
 const picker=document.querySelector('#companyPicker')?.value;
 const s=getBody(),company=s.companies.find(x=>x.id===picker)||s.companies[0];
 if(!company)return;
 const staff=s.employees.filter(e=>e.companyId===company.id&&e.active&&e.roleKey!=='ceo');
 document.querySelectorAll('[data-hq-sync-employee]').forEach(select=>{
  const old=select.value;
  select.innerHTML=staff.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.name+' · '+B.roleFor(e)?.title)+'</option>').join('');
  if(staff.some(e=>e.id===old))select.value=old;
 });
}
async function login(form){
 const d=new FormData(form),email=String(d.get('email')||'').trim(),password=String(d.get('password')||'');
 if(!email||!password)throw Error('Enter your Office HQ Cloud account details.');
 const value=await fetchJson('/auth/v1/token?grant_type=password',{
  method:'POST',body:JSON.stringify({email,password})});
 const owner=await fetchJson('/auth/v1/user',{},value.access_token);
 if(!owner?.id)throw Error('Account verification failed.');
 auth={access_token:value.access_token,refresh_token:value.refresh_token,
  owner_id:owner.id,expires_at:Date.now()+Number(value.expires_in||3600)*1000};
 // Share the active Mac browser's authenticated session with ONLY its localhost
 // server; the server checks with Supabase and stores credentials mode 0600.
 if(local()){
  const r=await fetch('/api/device-sync/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'pair',email,password,ownerConfirmed:true})});
  if(!r.ok)throw Error('The Mac sync engine did not accept pairing.');
 }
 sessionStorage.setItem(SKEY,JSON.stringify(auth));
 form.reset();draw();employeeOptions();
 notice('Signed in. Syncing with the cloud; both devices must use this same account.');
 await refresh();
}
async function keepAlive(){
 const now=new Date().toISOString();
 if(TYPE==='ios'){
  // Only acknowledge a healthy read of the owner's assignments.
  await rest('hq_device_synced_assignments','GET',null,'?select=id&limit=1');
  await rest('hq_device_sync_presence','POST',[{
   owner_id:auth.owner_id,device_id:id,device_type:TYPE,
   last_pull_at:now,last_push_at:now,updated_at:now
  }],'?on_conflict=owner_id,device_id','resolution=merge-duplicates,return=minimal');
 }
}
async function uploadTask(t){
 if(!auth||!t?.id||!t.title||!t.description||!t.ownerId||!B)return;
 const s=getBody(),employee=s.employees.find(x=>x.id===t.ownerId),
   company=s.companies.find(x=>x.id===t.companyId);
 if(!employee||!company||!B.roleFor(employee))return;
 const project=t.departmentProjectId&&s.enterprise?.departmentProjects?.find(p=>p.id===t.departmentProjectId&&p.companyId===t.companyId);
 let description=t.description.slice(0,4000);
 if(project){const envelope=TEAM_PREFIX+JSON.stringify({id:project.id,department:project.department,title:project.title.slice(0,100),instruction:project.instruction.slice(0,1000),expectedTaskCount:project.expectedTaskCount||project.taskIds.length})+'\n';description=envelope+description.slice(0,4000-envelope.length);}
 const payload={
  owner_id:auth.owner_id,client_task_key:String(t.id).slice(0,100),source_device_id:id,
  company_label:company.name.slice(0,150),employee_role:employee.roleKey.slice(0,100),
  employee_label:employee.name.slice(0,160),title:t.title.slice(0,140),
  description,owner_confirmed:true,status:'queued'
 };
 // Do not overwrite a draft or human decision from the other device.
 const rows=await rest('hq_device_synced_assignments','POST',[payload],
  '?on_conflict=owner_id,client_task_key','resolution=ignore-duplicates,return=representation');
 t.cloudSynced=true;t.cloudSyncId=rows?.[0]?.id||t.cloudSyncId;
 B.save();
}
async function uploadPending(){
 if(!B||!auth)return;
 const s=getBody();
 const now=Date.now();
 const pending=s.tasks.filter(t=>(t.voiceAssigned===true||t.cloudSyncRequested===true)&&t.delegatedBy==='owner'&&!t.cloudSynced&&
  Number.isFinite(Date.parse(t.createdAt))&&now-Date.parse(t.createdAt)<14*86400000);
 for(const task of pending.slice(0,15))await uploadTask(task);
}
async function downloadTasks(){
 if(!B||!auth)return;
 const rows=await rest('hq_device_synced_assignments','GET',null,
  '?select=*&order=updated_at.desc&limit=100');
 const s=getBody();let touched=false;
 for(const r of rows){
  const envelope=teamEnvelope(r.description);
  let t=s.tasks.find(x=>x.id===r.client_task_key);
  if(!t){
   if(r.source_device_id===id)continue;
   const company=s.companies.find(x=>x.name.toLowerCase()===r.company_label.toLowerCase());
   const employee=company&&s.employees.find(e=>e.companyId===company.id&&e.roleKey===r.employee_role);
   if(!company||!employee)continue; // Never invent employee or company mappings.
   t={id:r.client_task_key,companyId:company.id,ownerId:employee.id,
    scope:B.roleFor(employee)?.scope||'',title:r.title,description:envelope?.description||r.description,
    departmentProjectId:envelope?.meta.id||null,ceoConversation:r.description?.startsWith('OFFICE_HQ_CONVERSATION_V1:')===true,
    delegatedBy:'owner',createdAt:r.created_at,updatedAt:r.updated_at,status:r.status,
    priority:'Medium',due:'',output:r.draft||'',requiresApproval:true,approvalId:null,
    cloudSynced:true,cloudSyncId:r.id};
   s.tasks.unshift(t);window.OfficeHQFloor?.onTaskAssigned(t);touched=true;
  }
  if(envelope){
   s.enterprise??={};s.enterprise.departmentProjects??=[];const m=envelope.meta;
   let p=s.enterprise.departmentProjects.find(p=>p.id===m.id&&p.companyId===t.companyId);
   if(!p){p={...m,companyId:t.companyId,taskIds:[],status:'queued',packet:'',approvalId:null,createdAt:r.created_at,updatedAt:r.updated_at};s.enterprise.departmentProjects.push(p);touched=true;}
   if(!p.taskIds.includes(t.id)){p.taskIds.push(t.id);touched=true;}
   t.departmentProjectId=p.id;
  }
  const humanRejected=t.status==='blocked'&&(t.runError==='CEO requested changes on team report'||s.approvals.some(a=>a.taskId===t.id&&a.companyId===t.companyId&&a.status==='rejected'));
  if((t.status==='done'||humanRejected)&&r.status==='review'){
   await rest('hq_device_synced_assignments','PATCH',{
     status:t.status,note:t.departmentProjectId?(t.status==='done'?'CEO approved team report':'CEO requested changes on team report'):'CEO reviewed this draft',updated_at:new Date().toISOString()
   },'?id=eq.'+encodeURIComponent(r.id)+'&status=eq.review','return=minimal');
  }else if(r.status==='done'&&r.note==='CEO approved team report'&&t.departmentProjectId&&t.output){
   t.status='done';t.cloudDecisionAt=r.updated_at;t.updatedAt=r.updated_at;touched=true;
  }else if(r.status==='blocked'&&r.note==='CEO requested changes on team report'&&t.departmentProjectId){
   t.status='blocked';t.runError=r.note;t.updatedAt=r.updated_at;touched=true;
  }else if(r.status==='review'&&r.draft&&t.cloudLastReview!==r.updated_at){
   t.cloudLastReview=r.updated_at;t.output=r.draft;t.status='review';t.runError='';t.updatedAt=r.updated_at;
   window.OfficeHQFloor?.onTaskStatus?.(t);
   s.enterprise??={};s.enterprise.messages??=[];
   s.enterprise.messages.unshift({id:B.uid('sms'),author:'Mac Ollama · '+r.employee_label,
    body:'Synced draft is ready for CEO review: '+r.title,companyId:t.companyId,
    kind:'request',createdAt:new Date().toISOString(),read:false});
   if(!t.departmentProjectId&&!t.ceoConversation&&!s.approvals.some(a=>a.taskId===t.id&&a.status==='pending')){
    const a={id:B.uid('approve'),companyId:t.companyId,kind:'task',taskId:t.id,
     title:'Review synced draft: '+t.title,note:'Check this AI draft before approval.',
     requester:r.employee_label,status:'pending',createdAt:new Date().toISOString()};
    s.approvals.unshift(a);t.approvalId=a.id;
   }
   if(t.ceoConversation){
    s.enterprise.ceoSecureChat??={entries:[],jobs:[]};const chat=s.enterprise.ceoSecureChat;
    if(!chat.jobs.some(j=>j.currentTaskIds?.includes(t.id))&&!chat.entries.some(m=>m.syncedConversationTaskId===t.id)){
     chat.entries.push({id:B.uid('chat'),companyId:t.companyId,author:r.employee_label,body:r.draft,kind:'conversation',syncedConversationTaskId:t.id,at:new Date().toISOString()});t.status='done';
    }
   }
   touched=true;
  }else if(!humanRejected&&r.status==='in_progress'&&['Ollama drafting started','Ollama drafting resumed after recovery'].includes(r.note)&&['queued','blocked'].includes(t.status)){
   // Queue claim alone is not proof of execution; wait for the Mac to confirm AI acceptance.
   t.status='in_progress';t.runError='';t.updatedAt=r.updated_at;window.OfficeHQFloor?.onTaskStatus?.(t);touched=true;
  }else if(r.status==='blocked'&&['queued','in_progress'].includes(t.status)){
   t.status='blocked';t.runError=String(r.note||'Mac agent could not finish').slice(0,250);
   t.updatedAt=r.updated_at;window.OfficeHQFloor?.onTaskStatus?.(t);touched=true;
  }
  if(!t.cloudSynced){t.cloudSynced=true;touched=true;}
 }
 if(touched){B.save();window.OfficeHQCompanyInbox?.refresh?.();}
}
async function refresh(){
 if(inFlight)return;
 inFlight=true;
 try{
  if(!auth){
   if(local()){
    try{
     const r=await fetch('/api/device-sync/status',{cache:'no-store'});
     if(r.ok){const d=await r.json();set({connected:verified(d),
      reason:d.reason||'This Mac is waiting for its paired iPhone or iPad.',checkedAt:Date.now()});return;}
    }catch{}
   }
   set({connected:false,reason:'Sign in with your Office HQ Cloud account on both devices.'});return;
  }
  if(navigator.onLine===false){set({connected:false,reason:'This device is offline.'});return;}
  await token();
  if(local()){
   await uploadPending();
   await downloadTasks();
   const r=await fetch('/api/device-sync/status',{cache:'no-store'});
   if(!r.ok)throw Error('Mac sync engine unavailable.');
   const d=await r.json();
   set({connected:verified(d),reason:d.reason||'Mac is waiting for your iPhone/iPad.',
     checkedAt:Date.now()});
  }else{
   await uploadPending();
   await keepAlive();
   await downloadTasks();
   const rows=await rest('hq_device_sync_presence','GET',null,
    '?select=device_type,last_pull_at,last_push_at&limit=80');
   const mac=rows.find(x=>x.device_type==='mac'&&fresh(x.last_pull_at)&&fresh(x.last_push_at));
   const mobile=rows.find(x=>x.device_type==='ios'&&fresh(x.last_pull_at)&&fresh(x.last_push_at));
   const verifiedRemote=!!mac&&!!mobile;
   const proof={connected:verifiedRemote,authenticated:true,paired:verifiedRemote,peerOnline:!!mac,
    bidirectional:verifiedRemote,peerDevice:'mac',lastInboundAck:mac?.last_pull_at,
    lastOutboundAck:mobile?.last_pull_at};
   set({connected:verified(proof),reason:verifiedRemote?'':'Waiting for the paired Mac to exchange assignments.',
    checkedAt:Date.now()});
  }
  notice(status.connected?'Mac and iPhone/iPad are exchanging assignments.':'Sync is waiting for the other device.');
 }catch(e){
  set({connected:false,reason:'Secure sync failed or session expired. Check your connection and sign-in.',
   checkedAt:Date.now()});
  notice(String(e.message||'Cannot contact cloud sync.').slice(0,170));
 }finally{inFlight=false;}
}
async function macAction(action,payload={}){
 const response=await fetch('/api/device-sync/action',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action,ownerConfirmed:true,...payload})});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Mac engine action failed.');
 return data;
}
async function buttonAction(a){
 if(a==='check')return refresh();
 if(a==='disconnect'){
  if(!confirm('Disconnect this device from Office HQ cloud synchronization?'))return;
  if(local())await macAction('unpair');
  auth=null;sessionStorage.removeItem(SKEY);set({connected:false,reason:'This device is disconnected.'});
  notice('Disconnected from Office HQ sync. Your local records remain.');
  return;
 }
 if(!local())return;
 if(a==='grant'){
  const selection=document.querySelector('[data-hq-sync-employee]')?.value;
  const s=getBody(),employee=s.employees.find(x=>x.id===selection),
    company=s.companies.find(x=>x.id===employee?.companyId);
  if(!employee||!company)throw Error('Choose an active Mac specialist.');
  if(!confirm('Authorize '+employee.name+' to draft synced assignments for '+company.name+' using local Ollama? No email, purchases, posting or external account access.'))return;
  await macAction('grant',{companyId:company.id,employeeId:employee.id,roleKey:employee.roleKey,
   companyName:company.name,employeeName:employee.name,department:B.roleFor(employee)?.dept});
  notice(employee.name+' authorized for local synced drafts.');
 }
 if(a==='dispatch'){
  if(!confirm('Enable local Ollama drafting for individually authorized and CEO-assigned tasks only?'))return;
  const res=await fetch('/api/openmaus/action',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify({
    action:'set-dispatch',enabled:true,ownerConfirmed:true
   })});
  if(!res.ok)throw Error('Mac engine did not enable drafts.');
  notice('Local Ollama drafts enabled. Only authorized employees can run assigned drafts.');
 }
}
document.addEventListener('submit',ev=>{
 const form=ev.target.closest?.('[data-hq-sync-form="login"]');if(!form)return;
 ev.preventDefault();void login(form).catch(e=>notice(String(e.message).slice(0,140)));
});
document.addEventListener('click',ev=>{
 const action=ev.target.closest?.('[data-hq-sync-action]');
 if(action){ev.preventDefault();void buttonAction(action.dataset.hqSyncAction)
   .catch(e=>notice(String(e.message).slice(0,140)));return;}
 const badge=ev.target.closest?.('[data-hq-sync-indicator]');
 if(badge){const area=badge.closest('.hq-device-sync-wrap');area?.querySelector('details')?.setAttribute('open','');void refresh();}
});
document.addEventListener('change',ev=>{
 if(ev.target.id==='companyPicker')queueMicrotask(employeeOptions);
});
window.addEventListener('pageshow',()=>{void refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
window.OfficeHQDeviceSync={markup,draw,refresh,snapshot:()=>({...status}),verified,
 pushTask:task=>{if(auth&&task?.delegatedBy==='owner')void uploadTask(task).catch(e=>notice(String(e.message).slice(0,140)));}};
const boot=()=>{employeeOptions();draw();void refresh();setInterval(()=>{if(!document.hidden)void refresh();},12000);};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
else boot();
})();
