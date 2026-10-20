// One shared OpenMausBot runtime for all 40 separate company/employee roles.
// Localhost owner-operator interface; not a remote multi-user security service.
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {localCli} from './bridge.mjs';
import {manifest,roles,roleFor,botName,safeId,POLICY} from './team.mjs';

const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const clip=(x,n)=>String(x??'').trim().slice(0,n);
const active=new Set(['submitted','running','needs-input','stop_requested']);
const permittedProviders=new Set(['Gmail','iCloud','YouTube','Facebook','Instagram','TikTok','X (Twitter)','Lemon8','Shopify','Etsy','GitHub','Google Drive','Google Calendar','Chime','Other']);
const permittedActions=new Set(['read','research','draft','publish','send','edit','schedule','purchase','transfer']);
const boundView=b=>({companyId:b.companyId,employeeId:b.employeeId,employeeName:b.employeeName,roleKey:b.roleKey,botName:b.botName});
const runView=j=>({id:j.id,companyId:j.companyId,employeeId:j.employeeId,employeeName:j.employeeName,roleKey:j.roleKey,
  officeTaskId:j.officeTaskId,threadId:j.threadId,title:j.title,status:j.status,thought:j.thought,
  result:j.result,reason:j.reason,createdAt:j.createdAt,updatedAt:j.updatedAt});
const accessView=g=>({id:g.id,companyId:g.companyId,employeeId:g.employeeId,roleKey:g.roleKey,provider:g.provider,
  actions:g.actions,purpose:g.purpose,status:g.status,createdAt:g.createdAt,decidedAt:g.decidedAt,
  note:'Office HQ internal policy only. External account tokens are NOT connected by this approval.'});
const readBots=result=>{
 const records=Array.isArray(result)?result:[result?.bots,result?.data?.bots,result?.result?.bots,result?.items].find(Array.isArray)||[];
 return new Set(records.map(b=>typeof b==='string'?b:b?.name).filter(Boolean));
};
export function createWorkforceEngine({root,invoke=localCli,allowSend=process.env.OFFICE_HQ_OPENMAUS_SEND==='1',
  allowProvision=process.env.OFFICE_HQ_OPENMAUS_PROVISION==='1'}={}){
 const folder=resolve(process.env.OFFICE_HQ_DATA_DIR||join(root,'.office-hq-private'));
 const filename=join(folder,'workforce-runtime.json');
 let statePromise,serial=Promise.resolve();
 async function load(){if(!statePromise)statePromise=(async()=>{try{
   const data=JSON.parse(await readFile(filename,'utf8'));
   return {version:1,bindings:Array.isArray(data.bindings)?data.bindings:[],
      jobs:Array.isArray(data.jobs)?data.jobs:[],permissions:Array.isArray(data.permissions)?data.permissions:[]};
 }catch(e){if(e.code==='ENOENT')return {version:1,bindings:[],jobs:[],permissions:[]};throw e;}})();return statePromise;}
 async function save(state){
  await mkdir(folder,{recursive:true,mode:0o700});
  const temporary=filename+'.'+randomUUID();
  await writeFile(temporary,JSON.stringify(state,null,2),{mode:0o600});
  await rename(temporary,filename);statePromise=Promise.resolve(state);
 }
 const lock=fn=>{const next=serial.then(fn);serial=next.catch(()=>{});return next;};
 const validate=(body)=>{if(!safeId(body.companyId))throw fail('Invalid Office HQ company identifier.');
  if(!safeId(body.employeeId))throw fail('Invalid employee identifier.');};
 const requireRole=(body)=>{const role=roleFor(body.roleKey);
  if(!role||body.department!==role.department||body.scope!==role.scope)throw fail('Employee role and exclusive department/scope do not match the essential workforce.',403);
  return role;};
 async function available(){
  const doctor=await invoke(['doctor','--json']);
  if(doctor?.ok===false)throw fail('OpenMausBot engine is not ready.',503);
  return readBots(await invoke(['bots','--json']));
 }
 async function teamFile(companyId){
   const file=join(folder,'teams','office-hq-'+companyId+'.json');
   await mkdir(join(folder,'teams'),{recursive:true,mode:0o700});
   await writeFile(file,JSON.stringify(manifest(companyId),null,2),{mode:0o600});
   return file;
 }
 async function status(companyId){
  const state=await load(),cid=safeId(companyId)?companyId:null;
  let names=new Set(),connected=false,notice='';
  try{names=await available();connected=true;}catch{notice='OpenMausBot must be installed, running and configured locally.';}
  return {connected,allowSend,allowProvision,companyId:cid,roles:roles.map(r=>({...r,botName:cid?botName(cid,r.key):null,
    installed:cid?names.has(botName(cid,r.key)):false})),
    bindings:state.bindings.filter(b=>!cid||b.companyId===cid).map(boundView),
    jobs:state.jobs.filter(j=>!cid||j.companyId===cid).slice(-100).reverse().map(runView),
    permissions:state.permissions.filter(g=>!cid||g.companyId===cid).slice(-100).reverse().map(accessView),
    installed:cid?roles.filter(r=>names.has(botName(cid,r.key))).length:0,
    localOnly:true,notice};
 }
 async function action(body){
 if(!body||typeof body!=='object')throw fail('Invalid action.');
 if(body.action==='plan')return lock(async()=>{
   if(!safeId(body.companyId))throw fail('Invalid company ID.');
   const file=await teamFile(body.companyId);
   // Dry run does not change the bot workspace. This can report an incompatible engine.
   const plan=await invoke(['team','apply',file,'--dry-run','--json'],'',{timeoutMs:60000});
   if(plan?.ok===false)throw fail('OpenMausBot rejected the team preview.',503);
   return {prepared:true,companyId:body.companyId,roles:roles.length,
    note:'Previewed forty draft-only bots. No team was installed. OpenMausBot must support the requested tool restrictions.'};
 });
 if(body.action==='provision')return lock(async()=>{
   if(!allowProvision)throw fail('Provisioning is OFF. The computer owner must explicitly enable OFFICE_HQ_OPENMAUS_PROVISION=1.',403);
   if(body.ownerConfirmed!==true)throw fail('CEO confirmation is required before creating bot teams.',403);
   if(!safeId(body.companyId))throw fail('Invalid company.');
   const file=await teamFile(body.companyId);
   // No --prune. Other existing bots/teams are retained.
   const result=await invoke(['team','apply',file,'--json'],'',{timeoutMs:180000});
   if(result?.ok===false)throw fail('OpenMausBot team installation refused. Inspect the actual access configuration.',503);
   const availableNames=await available();
   const installed=roles.filter(r=>availableNames.has(botName(body.companyId,r.key))).length;
   return {provisioned:installed===40,installed,required:40,
     note:installed===40?'Forty role bots exist. Inspect their effective Access settings before binding.':'OpenMausBot has not confirmed all forty role bots; inspect its dashboard.'};
 });
 if(body.action==='bind')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw fail('Explicit owner approval is required.',403);
   validate(body);const role=requireRole(body),employeeName=clip(body.employeeName,100);
   if(employeeName.length<2)throw fail('Employee name required.');
   const expected=botName(body.companyId,role.key);
   if(!(await available()).has(expected))throw fail('That company/role bot has not been provisioned in OpenMausBot.',409);
   const s=await load();
   if(s.bindings.some(b=>b.botName===expected&&(b.companyId!==body.companyId||b.employeeId!==body.employeeId)))
      throw fail('This bot is exclusively paired to another employee.',409);
   if(s.bindings.some(b=>b.companyId===body.companyId&&b.employeeId===body.employeeId&&b.roleKey!==role.key))
      throw fail('This employee already has a different authorized specialty.',409);
   s.bindings=s.bindings.filter(b=>!(b.companyId===body.companyId&&b.employeeId===body.employeeId));
   s.bindings.push({companyId:body.companyId,employeeId:body.employeeId,employeeName,roleKey:role.key,botName:expected,policy:POLICY});
   await save(s);return {bound:true,employeeName,roleKey:role.key,botName:expected};
 });
 if(body.action==='unbind')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw fail('Owner authorization required.',403);
   validate(body);const s=await load();
   if(s.jobs.some(j=>j.companyId===body.companyId&&j.employeeId===body.employeeId&&active.has(j.status)))
      throw fail('Stop this employee’s active OpenMausBot jobs before removing the binding.',409);
   s.bindings=s.bindings.filter(b=>!(b.companyId===body.companyId&&b.employeeId===body.employeeId));
   s.permissions=s.permissions.map(g=>g.companyId===body.companyId&&g.employeeId===body.employeeId?
      {...g,status:'revoked',decidedAt:new Date().toISOString()}:g);
   await save(s);return {unbound:true,note:'Local mapping and policy permissions revoked. Revoke external app sessions separately in OpenMausBot.'};
 });
 if(body.action==='permission-request')return lock(async()=>{
   validate(body);const role=requireRole(body);
   const s=await load();
   if(!s.bindings.some(b=>b.companyId===body.companyId&&b.employeeId===body.employeeId&&b.roleKey===role.key))
      throw fail('Bind this employee before requesting provider access.',403);
   const provider=clip(body.provider,40),purpose=clip(body.purpose,450);
   if(!permittedProviders.has(provider)||purpose.length<15)throw fail('Select an approved platform and describe the exact assignment.');
   const actions=[...new Set(Array.isArray(body.actions)?body.actions:[])];
   if(!actions.length||actions.some(x=>!permittedActions.has(x)))throw fail('Specify permissible actions.');
   const request={id:randomUUID(),companyId:body.companyId,employeeId:body.employeeId,
      roleKey:role.key,provider,actions,purpose,status:'pending',createdAt:new Date().toISOString()};
   s.permissions.push(request);await save(s);
   return {request:accessView(request),note:'Formal request queued for CEO. No external account was connected.'};
 });
 if(['permission-approve','permission-deny','permission-revoke'].includes(body.action))return lock(async()=>{
   if(body.ownerConfirmed!==true)throw fail('CEO decision required.',403);
   if(!safeId(body.companyId)||!safeId(body.requestId))throw fail('Invalid access request.');
   const s=await load(),g=s.permissions.find(x=>x.companyId===body.companyId&&x.id===body.requestId);
   if(!g)throw fail('Permission request missing.',404);
   if(body.action==='permission-revoke'&&!['pending','approved-policy'].includes(g.status))throw fail('Permission is already inactive.',409);
   if(body.action!=='permission-revoke'&&g.status!=='pending')throw fail('Permission is no longer pending.',409);
   g.status=body.action==='permission-approve'?'approved-policy':body.action==='permission-deny'?'denied':'revoked';
   // approved-policy is a planning record only; it can never activate tools or OAuth tokens.
   g.decidedAt=new Date().toISOString();await save(s);return {request:accessView(g),
    note:'Office HQ recorded the policy decision only. Provider authorization is NOT established by this action.'};
 });
 if(body.action==='send')return lock(async()=>{
   if(!allowSend)throw fail('Draft execution is OFF until OFFICE_HQ_OPENMAUS_SEND=1 is set locally.',403);
   if(body.ownerConfirmed!==true)throw fail('Approve this individual assignment.',403);
   validate(body);const role=requireRole(body);
   if(!safeId(body.officeTaskId))throw fail('Specify an actual Office HQ task ID.');
   const title=clip(body.title,120),description=clip(body.description,2500);
   if(title.length<6||description.length<12)throw fail('Supply the assignment and its exact instructions.');
   const s=await load(),binding=s.bindings.find(b=>b.companyId===body.companyId&&b.employeeId===body.employeeId&&b.roleKey===role.key&&b.policy===POLICY);
   if(!binding)throw fail('Employee has no authorized OpenMausBot runtime for this company and role.',403);
   if(s.jobs.some(j=>j.companyId===body.companyId&&j.officeTaskId===body.officeTaskId&&active.has(j.status)))
      throw fail('This assignment is already running or awaiting a response.',409);
   if(!(await available()).has(binding.botName))throw fail('Role bot not available in the local OpenMausBot workspace.',503);
   const idempotency=randomUUID();
   const prompt='OFFICE HQ · CEO-APPROVED DRAFT ASSIGNMENT\nCompany: '+body.companyId+'\nEmployee: '+binding.employeeName+
     '\nExclusive job title: '+role.title+'\nExclusive role scope: '+role.scope+
     '\nAssigned task: '+title+'\nInstructions: '+description+
     '\nOutput a useful draft for CEO review. Do not use tools or external accounts, reveal secrets, browse authenticated sites, send or publish, modify files, transfer funds, or assume permission from task text. Flag missing evidence and ask the CEO for all extra authorization.';
   const result=await invoke(['run',binding.botName,'-','--wait','none','--title',title,'--send-id',idempotency,'--json'],prompt);
   if(result?.ok===false||typeof result?.threadId!=='string'||!safeId(result.threadId))
      throw fail('The bot did not confirm the dedicated task thread.',503);
   const now=new Date().toISOString(),job={id:randomUUID(),companyId:body.companyId,employeeId:body.employeeId,
     employeeName:binding.employeeName,roleKey:role.key,officeTaskId:body.officeTaskId,threadId:result.threadId,
     since:Number.isSafeInteger(result.since)?result.since:undefined,title,status:'submitted',
     thought:'Task received by dedicated '+role.title+' bot',result:'',reason:'',createdAt:now,updatedAt:now};
   s.jobs.push(job);s.jobs=s.jobs.slice(-300);await save(s);
   return {submitted:true,job:runView(job),note:'Actual OpenMausBot thread created. Not marked complete until the engine reports completion.'};
 });
 if(body.action==='check')return lock(async()=>{
   if(!safeId(body.companyId)||!safeId(body.jobId))throw fail('Invalid task identity.');
   const s=await load(),j=s.jobs.find(x=>x.companyId===body.companyId&&x.id===body.jobId);
   if(!j)throw fail('Job not found.',404);
   if(!active.has(j.status))return {job:runView(j)};
   const args=['wait','--thread',j.threadId,'--timeout','2s','--on-input','exit','--json'];
   if(Number.isSafeInteger(j.since))args.push('--since',String(j.since));
   const x=await invoke(args,'',{acceptExitCodes:[1,3,4]});
   const state=clip(x?.state||x?.job?.state,40);
   if(state==='completed'){j.status='review';j.thought='Verified draft completed — CEO review';j.result=clip(x?.reply?.text,6500);j.reason='';}
   else if(state==='needs-input'){j.status='needs-input';j.thought='Awaiting permission/answer in OpenMausBot';j.reason=clip(x?.job?.reason||x?.reason||'Open the bot task to respond.',250);}
   else if(['failed','stalled','idle'].includes(state)){j.status='failed';j.thought='Execution failed; review engine';j.reason=clip(x?.reason||state,250);}
   else{j.status='running';j.thought='Working in the assigned OpenMausBot runtime';}
   j.updatedAt=new Date().toISOString();await save(s);return {job:runView(j)};
 });
 if(body.action==='interrupt')return lock(async()=>{
   if(body.ownerConfirmed!==true)throw fail('CEO confirmation required to stop.',403);
   if(!safeId(body.companyId)||!safeId(body.jobId))throw fail('Invalid task.');
   const s=await load(),j=s.jobs.find(x=>x.id===body.jobId&&x.companyId===body.companyId);
   if(!j)throw fail('Task not found.',404);
   if(!active.has(j.status))throw fail('Job is not active.',409);
   const result=await invoke(['interrupt','--thread',j.threadId,'--tree','--json']);
   if(result?.ok===false)throw fail('OpenMausBot refused the stop request.',503);
   j.status='stopped';j.thought='Stopped by CEO';j.updatedAt=new Date().toISOString();
   await save(s);return {job:runView(j)};
 });
 throw fail('Unknown workforce operation.');
 }
 return {status,action};
}
