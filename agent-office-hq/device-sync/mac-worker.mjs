/* Office HQ owner-authenticated Mac sync worker.
 * Polls owner-scoped Supabase rows using ONLY publishable key + owner's token.
 * Never publishes outside actions; only bound Ollama specialists draft work.
 */
import {mkdir,readFile,writeFile,rename,chmod,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
const PROJECT='https://wvadoqncgrmfsftefuoy.supabase.co';
const KEY='sb_publishable_c3owfootc_qRwCN7v3Q24Q_GKB8PIjK';
const DATA=join(process.env.HOME||process.cwd(),'.officehq-agent-engine');
const PATH=join(DATA,'mac-sync-auth.json');
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
async function lockedSave(data){
 await mkdir(DATA,{recursive:true,mode:0o700});await chmod(DATA,0o700).catch(()=>{});
 const temp=PATH+'.'+randomUUID();
 await writeFile(temp,JSON.stringify(data),{mode:0o600});
 await rename(temp,PATH);await chmod(PATH,0o600).catch(()=>{});
}
export function createMacSyncService({bridge}={}){
 let creds=null,loading=false,busy=false,lastError='',pollTimer=null;
 async function load(){
  if(loading)return;loading=true;
  try{
   const c=JSON.parse(await readFile(PATH,'utf8'));
   if(c?.access_token&&c?.refresh_token&&c?.owner_id&&c?.device_id)creds=c;
  }catch(e){if(e.code!=='ENOENT')lastError='Saved Mac session could not be loaded.';}
 }
 async function token(){
  if(!creds)throw error('Mac is not paired.',401);
  if(Date.now()<Number(creds.expires_at||0)-70000)return creds.access_token;
  const result=await request('/auth/v1/token?grant_type=refresh_token',null,{
   method:'POST',body:JSON.stringify({refresh_token:creds.refresh_token})
  });
  creds={...creds,access_token:result.access_token,
   refresh_token:result.refresh_token,expires_at:Date.now()+Number(result.expires_in||3600)*1000};
  await lockedSave(creds);return creds.access_token;
 }
 async function rest(table,method='GET',payload=null,filter='',prefs='return=representation'){
  const opts={method,headers:{Prefer:prefs}};
  if(payload!==null)opts.body=JSON.stringify(payload);
  return request('/rest/v1/'+table+filter,await token(),opts);
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
  const login=await request('/auth/v1/token?grant_type=password',null,{
   method:'POST',body:JSON.stringify({email:body.email,password:body.password})
  });
  const user=await request('/auth/v1/user',login.access_token);
  if(!user?.id)throw error('Cloud account could not be authenticated.',401);
  creds={access_token:login.access_token,refresh_token:login.refresh_token,
   owner_id:user.id,expires_at:Date.now()+Math.max(120,Number(login.expires_in||3600))*1000,
   device_id:creds?.device_id||'mac-'+randomUUID()};
  await lockedSave(creds);
  await presence();
  return {paired:true,deviceId:creds.device_id,reason:'This Mac is authorized for secure sync. AI drafts require separate specialist grants.'};
 }
 async function unpair(){
  const old=creds;
  if(old){try{await rest('hq_device_sync_presence','DELETE',null,
    '?owner_id=eq.'+encodeURIComponent(old.owner_id)+'&device_id=eq.'+encodeURIComponent(old.device_id),'return=minimal');}catch{}}
  creds=null;await unlink(PATH).catch(()=>{});return {paired:false};
 }
 async function grant(body){
  if(body?.ownerConfirmed!==true)throw error('Approve employee in the Mac UI first.',403);
  for(const k of ['companyId','employeeId','roleKey']){
   if(typeof body[k]!=='string'||!/^[-\w.]{1,100}$/.test(body[k]))throw error('Invalid worker identity.');
  }
  const response=await bridge.action({...body,action:'bind',ownerConfirmed:true});
  const file=join(DATA,'sync-employees.json');
  let list=[];try{list=JSON.parse(await readFile(file,'utf8'));}catch{}
  list=list.filter(x=>!(x.companyId===body.companyId&&x.roleKey===body.roleKey));
  list.push({companyId:body.companyId,employeeId:body.employeeId,
   companyName:clip(body.companyName,150),roleKey:body.roleKey});
  const temp=file+'.'+randomUUID();
  await writeFile(temp,JSON.stringify(list),{mode:0o600});await rename(temp,file);
  return response;
 }
 async function lookup(){
  try{return JSON.parse(await readFile(join(DATA,'sync-employees.json'),'utf8'));}catch{return [];}
 }
 async function processQueue(){
  if(!creds)return;
  const pending=await rest('hq_device_synced_assignments','GET',null,
   '?select=*&status=eq.queued&owner_confirmed=eq.true&order=created_at.asc&limit=12');
  const mappings=await lookup();
  const ai=await bridge.status();
  if(!ai.connected||!ai.dispatchEnabled)return;
  for(const task of pending){
   if(task.source_device_id===creds.device_id||task.source_device_id.startsWith('mac-'))continue;
   const matched=mappings.find(x=>x.roleKey===task.employee_role&&
     x.companyName.toLowerCase()===task.company_label.toLowerCase()&&
     ai.bindings.some(b=>b.companyId===x.companyId&&b.employeeId===x.employeeId));
   // An unmatched company or unapproved specialist must not run.
   if(!matched)continue;
   const claimed=await rest('hq_device_synced_assignments','PATCH',{
    status:'in_progress',worker_device_id:creds.device_id,updated_at:done()
   },'?id=eq.'+encodeURIComponent(task.id)+'&status=eq.queued','return=representation');
   if(!claimed?.length)continue;
   try{
    const run=await bridge.action({action:'send',companyId:matched.companyId,employeeId:matched.employeeId,
      officeTaskId:task.client_task_key,title:task.title,description:task.description,ownerConfirmed:true});
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
   '?select=id,client_task_key,owner_confirmed,status,worker_device_id&status=eq.in_progress&worker_device_id=eq.'+
    encodeURIComponent(creds.device_id)+'&limit=40');
  const snapshot=await bridge.status();
  for(const task of rows){
   const job=snapshot.runs.find(r=>r.officeTaskId===task.client_task_key);
   if(!job)continue;
   if(job.status==='review'){
     await rest('hq_device_synced_assignments','PATCH',{
      status:'review',draft:clip(job.result,16000),note:'Mac Ollama draft ready for CEO approval',updated_at:done()
     },'?id=eq.'+encodeURIComponent(task.id)+'&status=eq.in_progress');
   }else if(['failed','stopped','paused'].includes(job.status)){
     await rest('hq_device_synced_assignments','PATCH',{
      status:'blocked',note:clip(job.reason||job.thought,250),updated_at:done()
     },'?id=eq.'+encodeURIComponent(task.id)+'&status=eq.in_progress');
   }
  }
 }
 async function tick(){
  if(busy||!creds)return;busy=true;
  try{
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
 void start();
 return {pair,unpair,status:summary,grant,tick,identity:()=>({paired:!!creds,deviceId:creds?.device_id||'',lastError})};
}