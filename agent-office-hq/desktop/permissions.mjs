import {createHash,randomUUID} from 'node:crypto';
import {roles} from '../openmaus/team.mjs';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const scope=value=>typeof value==='string'&&/^[\w.-]{1,90}$/.test(value);
const text=(value,max)=>String(value||'').trim().replace(/[\u0000-\u001f]/g,' ').slice(0,max);
const DAY=86400000;
export const ACCESS_PREFIX='OFFICE_HQ_WEBSITE_ACCESS_V1:';

// Account names select separate on-computer browser profiles. They never contain credentials.
export function publicWebsite(value){
 let url;try{url=new URL(value);}catch{fail('Enter a complete HTTPS website address.');}
 const host=url.hostname.toLowerCase();
 if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||
   !host.includes('.')||/^[\d.]+$/.test(host)||host.includes(':')||
   /(^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host))
  fail('Use a public HTTPS website without a password, private address, or custom port.');
 url.hash='';
 return {origin:url.origin,url:url.href,host};
}

export function createWebsitePermissions({initial={},now=Date.now,id=randomUUID}={}){
 const data={accounts:initial.accounts||[],requests:initial.requests||[],grants:initial.grants||[],audit:initial.audit||[],closedChats:initial.closedChats||[]};
 const stamp=()=>new Date(now()).toISOString();
 // A chat never survives a stopped browser runtime. Persistent site grants do.
 for(const g of data.grants)if(g.active&&g.duration==='chat'){g.active=false;g.endedAt=stamp();g.reason='Browser runtime restarted; chat ended.';}
 const audit=(event,details)=>{data.audit.push({at:stamp(),event,...details});data.audit=data.audit.slice(-600);};
 function register(body){
  if(!scope(body.companyId))fail('Choose a company.');
  const web=publicWebsite(body.url),label=text(body.accountLabel,80)||'My account';
  const key='account-'+createHash('sha256').update(body.companyId+'\0'+web.origin+'\0'+label).digest('hex').slice(0,24);
  let account=data.accounts.find(a=>a.id===key);
  if(!account){account={id:key,companyId:body.companyId,accountLabel:label,...web,createdAt:stamp()};data.accounts.push(account);}
  return account;
 }
 function request(body){
  if(!scope(body.companyId)||!scope(body.conversationId))fail('Company and conversation are required.');
  if(data.closedChats.some(c=>c.companyId===body.companyId&&c.conversationId===body.conversationId))fail('This chat ended. Start a new access conversation.',409);
  const prompt=text(body.prompt,1600);if(prompt.length<10)fail('Describe the task in at least 10 characters.');
  if(!Array.isArray(body.workers)||!body.workers.length||body.workers.length>39)fail('Select between one and 39 agents.');
  const ids=new Set(),keys=new Set();
  const workers=body.workers.map(w=>{
   const role=roles.find(r=>r.key===w.roleKey&&r.key!=='ceo');
   if(!role||!scope(w.employeeId)||ids.has(w.employeeId)||keys.has(w.roleKey))fail('Select one active agent per specialist role.');
   if(data.grants.some(g=>active(g)&&g.companyId===body.companyId&&g.roleKey===w.roleKey&&g.employeeId!==w.employeeId))fail('A different agent already holds this company role. Revoke it first.',409);
   ids.add(w.employeeId);keys.add(w.roleKey);
   return {employeeId:w.employeeId,employeeName:text(w.employeeName,80)||role.title,roleKey:role.key,department:role.department,scope:role.scope};
  });
  const urls=[body.url,...(Array.isArray(body.relevantUrls)?body.relevantUrls:[])];
  if(urls.length>8)fail('Review at most eight websites per request.');
  const accounts=[...new Map(urls.map(url=>{const a=register({...body,url});return [a.id,a];})).values()];
  const existing=body.clientRequestId&&data.requests.find(r=>r.clientRequestId===body.clientRequestId&&r.companyId===body.companyId);
  if(existing)return existing;
  const r={id:id(),clientRequestId:scope(body.clientRequestId)?body.clientRequestId:null,companyId:body.companyId,conversationId:body.conversationId,prompt,mode:body.mode==='draft'?'draft':'observe',
   workers,accounts:accounts.map(a=>({...a})),status:'pending',createdAt:stamp(),expiresAt:new Date(now()+DAY).toISOString()};
  data.requests.push(r);data.requests=data.requests.slice(-150);audit('requested',{requestId:r.id,companyId:r.companyId});return r;
 }
 function active(g){return g.active===true&&(!g.expiresAt||Date.parse(g.expiresAt)>now());}
 function decide(body){
  if(body.ownerConfirmed!==true)fail('Only the owner can decide website access.',403);
  const r=data.requests.find(r=>r.id===body.requestId&&r.companyId===body.companyId);
  if(!r)fail('Access request not found.',404);
  if(r.status!=='pending')fail('This request has already been decided.',409);
  if(Date.parse(r.expiresAt)<=now())fail('This request expired. Create a new request.',409);
  if(!['deny','chat','relevant'].includes(body.decision))fail('Choose Deny, Allow all relevant sites, or Allow for this chat.');
  if(body.decision!=='deny'&&r.workers.some(w=>data.grants.some(g=>active(g)&&g.companyId===r.companyId&&g.roleKey===w.roleKey&&g.employeeId!==w.employeeId)))fail('Another agent now holds this company role. Create a new request after revoking it.',409);
  r.status=body.decision==='deny'?'denied':'allowed';r.decision=body.decision;r.decidedAt=stamp();
  if(body.decision!=='deny')for(const account of body.decision==='chat'?r.accounts.slice(0,1):r.accounts)for(const worker of r.workers){
   const g={id:id(),requestId:r.id,companyId:r.companyId,...worker,site:account.id,origin:account.origin,
    accountLabel:account.accountLabel,mode:r.mode,prompt:r.prompt,duration:body.decision,conversationId:r.conversationId,
    expiresAt:body.decision==='chat'?r.expiresAt:null,active:true,createdAt:stamp()};
   data.grants.push(g);
  }
  audit(r.status,{requestId:r.id,companyId:r.companyId,decision:body.decision});return r;
 }
 function revoke(body){
  if(body.ownerConfirmed!==true)fail('Confirm revoking agent access.',403);
  const list=data.grants.filter(g=>g.companyId===body.companyId&&g.active&&
   (body.grantId?g.id===body.grantId:body.requestId&&g.requestId===body.requestId));
  if(!list.length)fail('No active permission found.',404);
  for(const g of list){g.active=false;g.endedAt=stamp();g.reason='Revoked by owner';}
  audit('revoked',{companyId:body.companyId,grantIds:list.map(g=>g.id)});return {revoked:list.length};
 }
 function endChat(body){
  if(body.ownerConfirmed!==true||!scope(body.companyId)||!scope(body.conversationId))fail('Choose the conversation to end.',403);
  if(!data.closedChats.some(c=>c.companyId===body.companyId&&c.conversationId===body.conversationId))data.closedChats.push({companyId:body.companyId,conversationId:body.conversationId,at:stamp()});
  const list=data.grants.filter(g=>g.active&&g.companyId===body.companyId&&g.duration==='chat'&&g.conversationId===body.conversationId);
  for(const g of list){g.active=false;g.endedAt=stamp();g.reason='Chat ended';}
  for(const r of data.requests)if(r.status==='pending'&&r.companyId===body.companyId&&r.conversationId===body.conversationId)r.status='expired';
  audit('chat-ended',{companyId:body.companyId,conversationId:body.conversationId});return {ended:true,revoked:list.length};
 }
 const grant=key=>data.grants.find(g=>g.id===key&&active(g));
 const view=companyId=>({accounts:data.accounts.filter(a=>!companyId||a.companyId===companyId),
  requests:data.requests.filter(r=>!companyId||r.companyId===companyId).map(r=>({...r,status:r.status==='pending'&&Date.parse(r.expiresAt)<=now()?'expired':r.status})),
  grants:data.grants.filter(g=>!companyId||g.companyId===companyId).map(g=>({...g,active:active(g)})),
  audit:data.audit.filter(a=>!companyId||a.companyId===companyId).slice(-50)});
 return {register,request,decide,revoke,endChat,grant,view,serialize:()=>data};
}
