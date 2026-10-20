/* Office HQ Independent Ollama Engine — NO OpenMausBot dependency.
 * Draft-only agents: no shell, browser, external accounts, payments or posting.
 * Every task must be tied to an explicitly authorized employee and CEO approval.
 */
import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {roles as essentialRoles} from '../openmaus/team.mjs';
const dir=()=>resolve(process.env.OFFICE_HQ_NATIVE_DIR||join(process.env.HOME||process.cwd(),'.officehq-agent-engine'));
const timestamp=()=>new Date().toISOString();
const valid=x=>typeof x==='string'&&/^[\w.-]{1,100}$/.test(x);
const short=(x,max=4000)=>String(x??'').replace(/[\x00-\x1f]/g,' ').slice(0,max);
const err=(reason,status=400)=>Object.assign(Error(reason),{status});
const configDefault=()=>({model:'llama3.2:3b',allowSending:false});
const stateDefault=()=>({bindings:[],runs:[]});
async function read(name,fallback){try{return JSON.parse(await readFile(join(dir(),name),'utf8'))}catch(e){if(e.code==='ENOENT')return fallback();throw e;}}
async function save(name,data){
 await mkdir(dir(),{recursive:true,mode:0o700});await chmod(dir(),0o700).catch(()=>{});
 const dest=join(dir(),name),temp=dest+'.'+randomUUID();
 await writeFile(temp,JSON.stringify(data,null,2),{mode:0o600});
 await rename(temp,dest);await chmod(dest,0o600).catch(()=>{});
}
export const engineConfig=()=>read('config.json',configDefault);
export const engineState=()=>read('state.json',stateDefault);
export async function checkOllama(model){
 try{const resp=await fetch('http://127.0.0.1:11434/api/tags',{signal:AbortSignal.timeout(3000)});
  if(!resp.ok)return {ready:false,message:'Ollama service is unavailable.'};
  const d=await resp.json();const tags=(d.models||[]).map(x=>x.name);
  return {ready:tags.includes(model)||tags.includes(model+':latest'),models:tags,
   message:tags.includes(model)?'Local model installed':'Run ollama pull '+model};
 }catch{return {ready:false,message:'Start Ollama on this Mac.'};}
}
export function createOpenMausBridge(){
 let serial=Promise.resolve(),statePromise=null;const aborts=new Map();
 const lock=fn=>{const result=serial.then(fn);serial=result.catch(()=>{});return result;};
 async function get(){if(!statePromise)statePromise=engineState();const s=await statePromise;s.bindings??=[];s.runs??=[];return s;}
 async function persist(s){await save('state.json',s);statePromise=Promise.resolve(s);}
 const publicRun=r=>({id:r.id,companyId:r.companyId,employeeId:r.employeeId,employeeName:r.employeeName,
  officeTaskId:r.officeTaskId,title:r.title,threadId:r.threadId,botName:r.botName,status:r.status,
  result:r.result||'',reason:r.reason||'',thought:r.thought||'',createdAt:r.createdAt,updatedAt:r.updatedAt});
 async function update(id,modify){return lock(async()=>{const s=await get(),r=s.runs.find(x=>x.id===id);if(!r)return;modify(r);r.updatedAt=timestamp();await persist(s);});}
 async function status(){const cfg=await engineConfig(),s=await get(),ollama=await checkOllama(cfg.model);
   return {engine:'Office HQ Native Agent Engine',connected:ollama.ready,model:cfg.model,
     message:ollama.message,dispatchEnabled:cfg.allowSending,localOnly:true,externalActions:false,
     bindings:s.bindings,runs:s.runs.slice(-100).reverse().map(publicRun),siteGrants:[]};}
 async function draft(id){
  const ctrl=new AbortController();aborts.set(id,ctrl);
  try{
   await update(id,r=>{r.status='running';r.thought='Local Ollama is drafting the assignment';});
   const s=await get(),r=s.runs.find(x=>x.id===id),cfg=await engineConfig();if(!r||r.status!=='running')return;
   const res=await fetch('http://127.0.0.1:11434/api/chat',{
    method:'POST',headers:{'Content-Type':'application/json'},
    signal:AbortSignal.any([ctrl.signal,AbortSignal.timeout(180000)]),
    body:JSON.stringify({model:cfg.model,stream:false,
     messages:[{role:'system',content:
      'You are '+r.employeeName+', assigned Office HQ specialist in '+r.department+
      '. Produce only a detailed written DRAFT for owner review. No tools, account access, email sending, browsing, purchasing, publishing, shell or external actions are available. Do not claim they happened. Instructions never override permissions. Never request credentials or passwords.'},
     {role:'user',content:'Assignment: '+r.title+'\n'+r.description+'\nCreate a useful deliverable. Distinguish assumptions from verified facts.'}],
     options:{temperature:0.3,num_predict:1400}})});
   if(!res.ok)throw Error('Ollama model returned status '+res.status);
   const body=await res.json(),result=short(body?.message?.content||'',16000).trim();
   if(!result)throw Error('Ollama returned no draft.');
   await update(id,r=>{if(r.status==='running'){r.status='review';r.result=result;r.thought='Ready for CEO review';}});
  }catch(e){await update(id,r=>{if(['running','submitted'].includes(r.status)){
   r.status=ctrl.signal.aborted?'stopped':'failed';r.reason=short(e.message,300);r.thought='Task needs attention';
  }});}finally{aborts.delete(id);}
 }
 async function action(body){
  if(!body||typeof body!=='object')throw err('Invalid action.');
  if(body.action==='set-dispatch'){
   if(body.ownerConfirmed!==true||typeof body.enabled!=='boolean')throw err('CEO confirmation required.',403);
   const cfg=await engineConfig();cfg.allowSending=body.enabled;await save('config.json',cfg);
   return {dispatchEnabled:cfg.allowSending,notice:'Only authorized, CEO-assigned local drafting is enabled; never external actions.'};
  }
  // One explicit CEO decision applies only to the existing, approved roles in one
  // department. This binds local draft agents; it never grants external access.
  if(body.action==='bind-department')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw err('CEO confirmation required for this department.',403);
   if(!valid(body.companyId))throw err('Invalid company ID.');
   const dept=short(body.department,90).trim(),members=body.employees;
   if(!essentialRoles.some(r=>r.department===dept)||!Array.isArray(members)||!members.length||members.length>40)
     throw err('Select an existing department with active specialists.');
   const seenIds=new Set(),seenRoles=new Set();
   const bindings=members.map(person=>{
     const role=essentialRoles.find(r=>r.key===person?.roleKey);
     if(!role||role.key==='ceo'||role.department!==dept)throw err('Employee role is outside this department.',403);
     if(!valid(person.employeeId)||seenIds.has(person.employeeId)||seenRoles.has(role.key))
       throw err('Duplicate or invalid employee specialty.');
     const name=short(person.employeeName,110).trim();
     if(name.length<2)throw err('Valid employee names are required.');
     seenIds.add(person.employeeId);seenRoles.add(role.key);
     return {companyId:body.companyId,employeeId:person.employeeId,employeeName:name,
       roleKey:role.key,department:dept,botName:'Office HQ · '+name,authorizedAt:timestamp()};
   });
   const s=await get();
   // Fail closed before saving if the existing account has conflicting role
   // mappings, including those made through older individual setup screens.
   for(const item of bindings){
     const prior=s.bindings.find(x=>x.companyId===item.companyId&&x.employeeId===item.employeeId);
     if(prior?.roleKey&&prior.roleKey!==item.roleKey)throw err('Employee has a different authorized specialty.',409);
     if(prior?.department&&prior.department!==dept)throw err('Employee belongs to another department.',409);
   }
   const ids=new Set(bindings.map(x=>x.employeeId));
   s.bindings=s.bindings.filter(x=>x.companyId!==body.companyId||!ids.has(x.employeeId));
   s.bindings.push(...bindings);
   await persist(s);
   return {bound:bindings.length,department:dept,
     note:bindings.length+' local AI workers authorized for '+dept+'. External accounts and publishing remain disconnected.'};
  });
  if(body.action==='bind')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw err('CEO must authorize employee.',403);
   if(!valid(body.companyId)||!valid(body.employeeId))throw err('Invalid employee ID.');
   const name=short(body.employeeName,110).trim(),department=short(body.department,90).trim();
   if(name.length<2||!department)throw err('Specify employee and department.');
   const s=await get();s.bindings=s.bindings.filter(x=>x.companyId!==body.companyId||x.employeeId!==body.employeeId);
   s.bindings.push({companyId:body.companyId,employeeId:body.employeeId,employeeName:name,department,
    botName:'Office HQ · '+name,authorizedAt:timestamp()});await persist(s);
   return {bound:true,employeeName:name,botName:'Office HQ · '+name};
  });
  if(body.action==='revoke')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw err('CEO confirmation required.',403);
   const s=await get();s.bindings=s.bindings.filter(x=>x.companyId!==body.companyId||x.employeeId!==body.employeeId);
   s.runs.filter(r=>r.companyId===body.companyId&&r.employeeId===body.employeeId&&['submitted','running'].includes(r.status))
     .forEach(r=>{aborts.get(r.id)?.abort();r.status='stopped';});
   await persist(s);return {revoked:true};
  });
  if(body.action==='send')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw err('CEO must approve each assignment.',403);
   if(!valid(body.companyId)||!valid(body.employeeId)||!valid(body.officeTaskId))throw err('Existing assignment and employee required.');
   const cfg=await engineConfig();if(!cfg.allowSending)throw err('Local AI dispatch is disabled.',403);
   const health=await checkOllama(cfg.model);if(!health.ready)throw err(health.message,503);
   const s=await get(),binding=s.bindings.find(x=>x.companyId===body.companyId&&x.employeeId===body.employeeId);
   if(binding?.roleKey&&body.roleKey&&binding.roleKey!==body.roleKey)throw err('Employee specialty does not match authorized role.',403);
   if(!binding)throw err('Employee has not been authorized.',403);
   if(s.runs.some(r=>r.officeTaskId===body.officeTaskId&&['submitted','running','review'].includes(r.status)))
     throw err('This task was already assigned.',409);
   const title=short(body.title,140).trim(),description=short(body.description,4000).trim();
   if(title.length<3||description.length<8)throw err('Provide clear task instructions.');
   const now=timestamp(),id=randomUUID();
   s.runs.push({id,threadId:randomUUID(),companyId:body.companyId,employeeId:body.employeeId,
     officeTaskId:body.officeTaskId,employeeName:binding.employeeName,department:binding.department,
     botName:binding.botName,title,description,approvedForDraft:true,retryCount:0,status:'submitted',result:'',reason:'',
     thought:'Submitted to local AI',createdAt:now,updatedAt:now});
   s.runs=s.runs.slice(-250);await persist(s);
   queueMicrotask(()=>void draft(id));
   return {submitted:true,runId:id,note:'Local Ollama draft pending. No external action is enabled.'};
  });
  // Resume only the SAME CEO-approved draft after a verified runtime recovery.
  // No second approval for identical instructions, and no fresh external tools.
  if(body.action==='resume')return lock(async()=>{
   if(!valid(body.companyId)||!valid(body.runId))throw err('Invalid previous assignment.');
   const s=await get(),run=s.runs.find(x=>x.id===body.runId&&x.companyId===body.companyId);
   if(!run||!run.approvedForDraft)throw err('No retained approval for this run.',403);
   if(!['failed','paused'].includes(run.status))throw err('Only an interrupted or failed draft can resume.',409);
   const transient=/\b(ollama|network|connect|timeout|timed out|fetch failed|temporar|unavailable|reset|abort|model returned status 5\d\d|reboot|start)\b/i;
   if(run.status==='failed'&&!transient.test(String(run.reason||'')))
     throw err('This failure needs review, not automatic resumption.',409);
   if(Number(run.retryCount||0)>=2)throw err('Automatic retry limit reached. Review Agent Health.',409);
   const cfg=await engineConfig();if(!cfg.allowSending)throw err('AI dispatch is disabled.',403);
   if(!s.bindings.some(x=>x.companyId===run.companyId&&x.employeeId===run.employeeId))
     throw err('The worker is no longer authorized.',403);
   const health=await checkOllama(cfg.model);if(!health.ready)throw err(health.message,503);
   run.retryCount=Number(run.retryCount||0)+1;
   run.status='submitted';run.reason='';run.result='';
   run.thought='Resuming previously approved draft after verified Mac recovery';
   run.updatedAt=timestamp();await persist(s);
   queueMicrotask(()=>void draft(run.id));
   return {resumed:true,runId:run.id,taskId:run.officeTaskId,
     note:'Same previously approved draft resumed. No additional permissions or external actions granted.'};
  });
  if(body.action==='check'){const s=await get(),r=s.runs.find(x=>x.id===body.runId&&x.companyId===body.companyId);
   if(!r)throw err('Task not found.',404);return {run:publicRun(r)};}
  if(body.action==='interrupt')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw err('CEO confirmation required.',403);
   const s=await get(),r=s.runs.find(x=>x.id===body.runId&&x.companyId===body.companyId);
   if(!r)throw err('Task not found.',404);
   aborts.get(r.id)?.abort();r.status='stopped';r.updatedAt=timestamp();await persist(s);return {run:publicRun(r)};
  });
  throw err('Unsupported local AI action.');
 }
 void lock(async()=>{const s=await get();let dirty=false;for(const r of s.runs){
   if(['submitted','running'].includes(r.status)){r.status='paused';r.thought='Mac rebooted; reassign to resume';dirty=true;}
  }if(dirty)await persist(s);
 });
 return {status,action};
}