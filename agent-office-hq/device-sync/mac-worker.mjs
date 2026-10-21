import {ACCESS_PREFIX} from '../desktop/permissions.mjs';
/* Office HQ owner-authenticated Mac sync worker.
 * Polls owner-scoped Supabase rows using ONLY publishable key + owner's token.
 * Never publishes outside actions; only bound Ollama specialists draft work.
 */
import {mkdir,readFile,writeFile,rename,chmod,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const PROJECT='https://wvadoqncgrmfsftefuoy.supabase.co';
const KEY='sb_publishable_c3owfootc_qRwCN7v3Q24Q_GKB8PIjK';
const DATA=process.env.OFFICE_HQ_NATIVE_DIR||join(process.env.HOME||process.cwd(),'.officehq-agent-engine');
const EVERY=12000,STALE=90000;
const clip=(x,n=150)=>String(x??'').slice(0,n);
const done=()=>new Date().toISOString();
const error=(message,status=400)=>Object.assign(Error(message),{status});
async function request(path,token,opts={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(PROJECT+path,{...opts,headers:{
   apikey:KEY,...(token?{Authorization:'Bearer '+token}:{}),
   ...(opts.body?{'Content-Type':'application/json'}:{}),
   ...(opts.headers||{})
  },signal:controller.signal,cache:'no-store'});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw error('Cloud sync request failed with HTTP '+response.status,response.status);
  return data;
 }finally{clearTimeout(timer);}
}
export function createMacSyncService({bridge,desktop=null,cloudRequest=request,storage=DATA,startPolling=true}={}){
 const authPath=join(storage,'mac-sync-auth.json');
 async function saveSession(data){await mkdir(storage,{recursive:true,mode:0o700});const temp=authPath+'.'+randomUUID();await writeFile(temp,JSON.stringify(data),{mode:0o600});await rename(temp,authPath);await chmod(authPath,0o600).catch(()=>{});}
 let creds=null,loading=false,busy=false,lastError='',pollTimer=null,grantSerial=Promise.resolve();
 const serialGrant=fn=>{const result=grantSerial.then(fn);grantSerial=result.catch(()=>{});return result;};
 async function load(){
  if(loading)return;loading=true;
  try{
   const c=JSON.parse(await readFile(authPath,'utf8'));
   if(c?.access_token&&c?.refresh_token&&c?.owner_id&&c?.device_id)creds=c;
  }catch(e){if(e.code!=='ENOENT')lastError='Saved Mac session could not be loaded.';}
 }
 async function token(){
  if(!creds)throw error('Mac is not paired.',401);
  if(Date.now()<Number(creds.expires_at||0)-70000)return creds.access_token;
  const result=await cloudRequest('/auth/v1/token?grant_type=refresh_token',null,{
   method:'POST',body:JSON.stringify({refresh_token:creds.refresh_token})
  });
  creds={...creds,access_token:result.access_token,
   refresh_token:result.refresh_token,expires_at:Date.now()+Number(result.expires_in||3600)*1000};
  await saveSession(creds);return creds.access_token;
 }
 async function rest(table,method='GET',payload=null,filter='',prefs='return=representation'){
  const opts={method,headers:{Prefer:prefs}};
  if(payload!==null)opts.body=JSON.stringify(payload);
  return cloudRequest('/rest/v1/'+table+filter,await token(),opts);
 }
 async function presence(){
  const now=done(),row={owner_id:creds.owner_id,device_id:creds.device_id,
    device_type:'mac',last_pull_at:now,last_push_at:now,updated_at:now};
  await rest('hq_device_sync_presence','POST',[row],'?on_conflict=owner_id,device_id',
   'resolution=merge-duplicates,return=minimal');
 }
 function recent(date){let ts=Date.parse(date);return Number.isFinite(ts)&&Date.now()-ts<STALE&&Date.now()-ts>=0;}
 async function summary(){
  if(!creds)return {connected:false,authenticated:false,paired:false,
    peerOnline:false,bidirectional:false,reason:'Mac not signed in to secure device sync.'};
  try{
   const rows=await rest('hq_device_sync_presence','GET',null,
    '?select=device_id,device_type,last_pull_at,last_push_at&limit=50');
   const mac=rows.find(x=>x.device_id===creds.device_id&&x.device_type==='mac');
   const ios=rows.find(x=>x.device_type==='ios'&&recent(x.last_pull_at)&&recent(x.last_push_at));
   const connected=!!mac&&!!ios&&recent(mac.last_pull_at)&&recent(mac.last_push_at);
   return {connected,authenticated:true,paired:true,peerOnline:!!ios,
     bidirectional:connected,peerDevice:ios?'ios':'',
     lastInboundAck:ios?.last_pull_at||null,lastOutboundAck:mac?.last_pull_at||null,
     reason:connected?'':'Waiting for signed-in iPhone/iPad to exchange updates.'};
  }catch(e){return {connected:false,authenticated:!!creds,paired:!!creds,peerOnline:false,
    bidirectional:false,reason:'Mac cloud sync check failed.'};}
 }
 async function pair(body){
  if(body?.ownerConfirmed!==true)throw error('Authorize this Mac explicitly before syncing.',403);
  if(typeof body.email!=='string'||typeof body.password!=='string')throw error('Sign in on this Mac first.');
  if(body.email.length>254||body.password.length>1024)throw error('Sign-in details are too long.');
  // Independent background session: never rotate the browser's refresh token.
  const login=await cloudRequest('/auth/v1/token?grant_type=password',null,{
   method:'POST',body:JSON.stringify({email:body.email,password:body.password})
  });
  const user=await cloudRequest('/auth/v1/user',login.access_token);
  if(!user?.id)throw error('Cloud account could not be authenticated.',401);
  creds={access_token:login.access_token,refresh_token:login.refresh_token,
   owner_id:user.id,expires_at:Date.now()+Math.max(120,Number(login.expires_in||3600))*1000,
   device_id:creds?.device_id||'mac-'+randomUUID()};
  await saveSession(creds);
  await presence();
  return {paired:true,deviceId:creds.device_id,reason:'This Mac is authorized for secure sync. AI drafts require separate specialist grants.'};
 }
 async function unpair(){
  const old=creds;
  if(old){try{await rest('hq_device_sync_presence','DELETE',null,
    '?owner_id=eq.'+encodeURIComponent(old.owner_id)+'&device_id=eq.'+encodeURIComponent(old.device_id),'return=minimal');}catch{}}
  creds=null;await unlink(authPath).catch(()=>{});return {paired:false};
 }
 async function saveMappings(body,bindings){
  if(typeof body.companyName!=='string'||!body.companyName.trim()||body.companyName.length>150)throw error('A company name is required for device sync.');
  const companyName=body.companyName.trim();
  const file=join(storage,'sync-employees.json');
  let list=await lookup();
  if(list.some(x=>x.companyId!==body.companyId&&x.companyName.toLowerCase()===companyName.toLowerCase()))
   throw error('Two companies share this sync name. Give each company a unique name.',409);
  // Save all validated mappings together, with one mapping for each company specialty.
  for(const b of bindings){
   list=list.filter(x=>!(x.companyId===b.companyId&&(x.roleKey===b.roleKey||x.employeeId===b.employeeId)));
   list.push({companyId:b.companyId,employeeId:b.employeeId,companyName,roleKey:b.roleKey});
  }
  await mkdir(storage,{recursive:true,mode:0o700});
  const temp=file+'.'+randomUUID();
  await writeFile(temp,JSON.stringify(list),{mode:0o600});await rename(temp,file);
 }
 async function grant(body){return serialGrant(async()=>{
  if(body?.ownerConfirmed!==true)throw error('Approve employee in the Mac UI first.',403);
  if(typeof body.companyName!=='string'||!body.companyName.trim())throw error('Company name required for sync.');
  const response=await bridge.action({...body,action:'bind',ownerConfirmed:true});
  await saveMappings(body,response.bindings);
  return response;
 });}
 async function grantDepartment(body){return serialGrant(async()=>{
  if(body?.ownerConfirmed!==true)throw error('Approve department in the Mac UI first.',403);
  if(typeof body.companyName!=='string'||!body.companyName.trim())throw error('Company name required for sync.');
  const response=await bridge.action({...body,action:'bind-department',ownerConfirmed:true});
  await saveMappings(body,response.bindings);
  return {...response,note:response.bound+' workers authorized for both local and paired phone drafts. External account access requires its own permission.'};
 });}
 async function lookup(){
  try{return JSON.parse(await readFile(join(storage,'sync-employees.json'),'utf8'));}catch{return [];}
 }
 async function websiteCommand(task,matched,mappings,ai,recovering=false){
  const claimed=recovering?[task]:await rest('hq_device_synced_assignments','PATCH',{status:'in_progress',worker_device_id:creds.device_id,updated_at:done()},'?id=eq.'+encodeURIComponent(task.id)+'&status=eq.queued','return=representation');
  if(!claimed?.length)return;
  try{
   if(!desktop)throw error('Update the Mac app to enable website permissions.');
   const command=JSON.parse(task.description.slice(ACCESS_PREFIX.length));
   if(!command||command.ownerConfirmed!==true)throw error('Owner approval is required.',403);
   if(!Number.isFinite(Date.parse(task.created_at))||Date.now()-Date.parse(task.created_at)>86400000)throw error('This website request expired. Create it again.');
   const companyId=matched.companyId;
   let result={};
   if(command.kind==='decide'){
    if(!Array.isArray(command.roles)||command.roles.length<1||command.roles.length>39)throw error('Choose the agents for this request.');
    const workers=command.roles.map(roleKey=>{
     const m=mappings.find(m=>m.companyId===companyId&&m.roleKey===roleKey);
     const b=m&&ai.bindings.find(b=>b.companyId===companyId&&b.employeeId===m.employeeId&&b.roleKey===roleKey);
     if(!b)throw error('Authorize every selected specialist on the Mac before granting website access.');
     return {employeeId:b.employeeId,employeeName:b.employeeName,roleKey};
    });
    const response=await desktop.action({action:'request-access',companyId,workers,clientRequestId:command.requestKey,
     conversationId:command.conversationId,url:command.url,relevantUrls:command.relevantUrls,accountLabel:command.accountLabel,prompt:command.prompt,mode:command.mode});
    let r=response.request;
    if(r.status==='pending')r=(await desktop.action({action:'decide-access',companyId,requestId:r.id,decision:command.decision,ownerConfirmed:true})).request;
    result={requestId:r.id,requestKey:command.requestKey,status:r.status,decision:r.decision};
   }else if(command.kind==='revoke'){
    const current=await desktop.status(companyId),matches=current.websiteAccess.grants.filter(g=>command.grantId?g.id===command.grantId:g.requestId===command.requestId);
    if(!matches.length)throw error('Permission not found for this company.',404);
    result=matches.some(g=>g.active)?await desktop.action({action:'revoke-access',companyId,requestId:command.requestId,grantId:command.grantId,ownerConfirmed:true}):{revoked:0};
   }
   else if(command.kind==='end-chat')result=await desktop.action({action:'end-chat',companyId,conversationId:command.conversationId,ownerConfirmed:true});
   else if(command.kind==='open'){
    const state=await desktop.status(companyId);
    if(!state.websiteAccess.accounts.some(a=>a.id===command.site))throw error('Account does not belong to this company.',403);
    result=await desktop.action({action:'open',companyId,site:command.site});
   }else if(command.kind==='run'){
    const current=await desktop.status(companyId),g=current.websiteAccess.grants.find(g=>g.id===command.grantId&&g.active);
    if(!g||!ai.bindings.some(b=>b.companyId===companyId&&b.employeeId===g.employeeId&&b.roleKey===g.roleKey))throw error('Authorize this specialist on the Mac before starting browser work.',403);
    result=await desktop.action({action:'run',companyId,grantId:command.grantId,prompt:command.prompt,mode:command.mode,commandId:task.client_task_key});
   }
   else if(['pause','resume','approve','reject'].includes(command.kind)){
    const state=await desktop.status(companyId);
    const job=state.jobs.find(j=>j.id===command.jobId);
    if(!job)throw error('Browser job not found for this company.',403);
    if(['resume','approve'].includes(command.kind)&&!ai.bindings.some(b=>b.companyId===companyId&&b.employeeId===job.employeeId&&b.roleKey===job.roleKey))throw error('This specialist is no longer authorized on the Mac.',403);
    if(command.kind==='approve'&&(!command.approvalId||!state.jobs.some(j=>j.id===command.jobId&&j.approval?.id===command.approvalId)))throw error('This action approval changed. Check the current Mac request.',409);
    result=await desktop.action({action:command.kind,jobId:command.jobId,approvalId:command.approvalId});
   }else if(command.kind!=='status')throw error('Unsupported website permission command.');
   const state=await desktop.status(companyId),access=state.websiteAccess;
   const requestId=result.requestId||command.requestId;
   const request=access.requests.find(r=>r.id===requestId);
   // Compact matrix fits the owner-only relay's 16 KB receipt for all 39 agents.
   const workers=request?.workers||[],accounts=request?.accounts||[];
   const matrix=accounts.map(a=>workers.map(w=>access.grants.find(g=>g.requestId===requestId&&g.site===a.id&&g.roleKey===w.roleKey&&g.active)?.id?.replace(/-/g,'')||null));
   const receipt={compactIds:true,kind:command.kind,requestKey:command.requestKey||request?.clientRequestId,...result,websiteAccess:undefined,
     request:request?{id:request.id,status:request.status,decision:request.decision,mode:request.mode,conversationId:request.conversationId,expiresAt:request.expiresAt}:null,
     accounts:accounts.map(a=>({id:a.id,origin:a.origin})),roles:workers.map(w=>w.roleKey),matrix,
     jobs:state.jobs.filter(j=>!command.jobId||j.id===command.jobId).slice(0,5).map(j=>({id:j.id,grantId:j.grantId,roleKey:j.roleKey,employeeName:j.employeeName,site:j.site,status:j.status,thought:j.thought,summary:j.summary,approval:j.approval}))};
   while(JSON.stringify(receipt).length>16000&&receipt.jobs.length)receipt.jobs.pop();
   const draft=JSON.stringify(receipt);
   if(draft.length>16000)throw error('Receipt too large. Refresh one request at a time.');
   await rest('hq_device_synced_assignments','PATCH',{status:'review',draft,note:'Website access receipt from Mac',updated_at:done()},'?id=eq.'+encodeURIComponent(task.id));
  }catch(e){await rest('hq_device_synced_assignments','PATCH',{status:'blocked',note:clip(e.message,250),updated_at:done()},'?id=eq.'+encodeURIComponent(task.id));}
 }
 async function processQueue(){
  if(!creds)return;
  const pending=await rest('hq_device_synced_assignments','GET',null,
   '?select=*&status=eq.queued&owner_confirmed=eq.true&order=created_at.asc&limit=12');
  const mappings=await lookup();
  const ai=await bridge.status();
  for(const task of pending){
   const matched=mappings.find(x=>x.roleKey===task.employee_role&&
     x.companyName.toLowerCase()===task.company_label.toLowerCase()&&
     (task.description?.startsWith(ACCESS_PREFIX)||ai.bindings.some(b=>b.companyId===x.companyId&&b.employeeId===x.employeeId&&b.roleKey===x.roleKey)));
   // An unmatched company or unapproved specialist must not run.
   if(!matched)continue;
   if(task.description?.startsWith(ACCESS_PREFIX)){await websiteCommand(task,matched,mappings,ai);continue;}
   if(!ai.connected||!ai.dispatchEnabled)continue;
   const existing=ai.runs.find(r=>r.officeTaskId===task.client_task_key&&r.companyId===matched.companyId&&r.employeeId===matched.employeeId);
   // A local browser starts its own assignment. Adopt its receipt for phone sync; never dispatch it twice.
   if(task.source_device_id.startsWith('mac-')&&!existing)continue;
   const claimed=await rest('hq_device_synced_assignments','PATCH',{
    status:'in_progress',worker_device_id:creds.device_id,updated_at:done()
   },'?id=eq.'+encodeURIComponent(task.id)+'&status=eq.queued','return=representation');
   if(!claimed?.length)continue;
   try{
    if(!existing)await bridge.action({action:'send',companyId:matched.companyId,employeeId:matched.employeeId,
      officeTaskId:task.client_task_key,roleKey:matched.roleKey,title:task.title,description:task.description,ownerConfirmed:true});
    const updates={note:'Ollama drafting started',updated_at:done()};
    await rest('hq_device_synced_assignments','PATCH',updates,'?id=eq.'+encodeURIComponent(task.id));
   }catch(e){
    await rest('hq_device_synced_assignments','PATCH',{status:'blocked',note:clip(e.message,250),updated_at:done()},
     '?id=eq.'+encodeURIComponent(task.id));
   }
  }
 }
 async function reportJobs(){
  const rows=await rest('hq_device_synced_assignments','GET',null,
   '?select=*&status=in.(in_progress,blocked)&worker_device_id=eq.'+
    encodeURIComponent(creds.device_id)+'&limit=40');
  const snapshot=await bridge.status(),mappings=await lookup();
  for(const task of rows){
   if(task.description?.startsWith(ACCESS_PREFIX)){
    if(task.status==='in_progress'){
     const matched=mappings.find(m=>m.roleKey===task.employee_role&&m.companyName.toLowerCase()===task.company_label.toLowerCase());
     let command;try{command=JSON.parse(task.description.slice(ACCESS_PREFIX.length));}catch{}
     if(command?.kind==='approve')await rest('hq_device_synced_assignments','PATCH',{status:'blocked',note:'Previous action outcome is uncertain. Review the Mac browser before any new approval.',updated_at:done()},'?id=eq.'+encodeURIComponent(task.id));
     else if(matched)await websiteCommand(task,matched,mappings,snapshot,true);
    }
    continue;
   }
   const job=snapshot.runs.find(r=>r.officeTaskId===task.client_task_key&&mappings.some(m=>m.companyId===r.companyId&&m.employeeId===r.employeeId));
   if(!job)continue;
   if(job.status==='review'){
     await rest('hq_device_synced_assignments','PATCH',{
      status:'review',draft:clip(job.result,16000),note:'Mac Ollama draft ready for CEO approval',updated_at:done()
     },'?id=eq.'+encodeURIComponent(task.id)+'&status=in.(in_progress,blocked)');
   }else if(['submitted','running'].includes(job.status)&&task.status==='blocked'){
     await rest('hq_device_synced_assignments','PATCH',{status:'in_progress',note:'Ollama drafting resumed after recovery',updated_at:done()},'?id=eq.'+encodeURIComponent(task.id)+'&status=eq.blocked');
   }else if(['failed','stopped','paused'].includes(job.status)&&task.status!=='blocked'){
     await rest('hq_device_synced_assignments','PATCH',{
      status:'blocked',note:clip(job.reason||job.thought,250),updated_at:done()
     },'?id=eq.'+encodeURIComponent(task.id)+'&status=eq.in_progress');
   }
  }
 }
 async function recoverJobs(){
  const snapshot=await bridge.status();
  if(!snapshot.connected||!snapshot.dispatchEnabled)return {resumed:0,ready:false,message:snapshot.message};
  let resumed=0;
  for(const run of snapshot.runs.filter(r=>r.canResume))try{await bridge.action({action:'resume',companyId:run.companyId,runId:run.id});resumed++;}catch{}
  return {resumed,ready:true,message:resumed?'Previously approved drafts resumed; results pending.':'Mac model responded. No eligible interrupted drafts.'};
 }
 async function tick(){
  if(busy)return;busy=true;
  try{
   await recoverJobs();
   if(!creds)return;
   await token();await processQueue();await reportJobs();
   // Signal a successful synchronization only AFTER cloud queue exchange succeeds.
   await presence();lastError='';
  }catch(e){lastError=clip(e.message,150);}
  finally{busy=false;}
 }
 async function start(){
  await load();
  if(!pollTimer){pollTimer=setInterval(()=>void tick(),EVERY);pollTimer.unref?.();}
  void tick();
 }
 if(startPolling)void start();
 return {pair,unpair,status:summary,grant,grantDepartment,recover:recoverJobs,tick,identity:()=>({paired:!!creds,deviceId:creds?.device_id||'',lastError})};
}
