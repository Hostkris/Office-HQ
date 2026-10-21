import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {createWebsitePermissions,publicWebsite} from '../desktop/permissions.mjs';
import {createDesktopService,hostAllowed} from '../desktop/runner.mjs';
import {roles} from '../openmaus/team.mjs';

const worker={employeeId:'worker-1',employeeName:'Test specialist',roleKey:'research'};
const request=(extra={})=>({companyId:'company-1',conversationId:'chat-1',url:'https://github.com/Hostkris/',accountLabel:'Work',prompt:'Review the project and draft a status report.',mode:'draft',workers:[worker],...extra});
test('arbitrary public HTTPS accounts have exact origins and separate named profiles',()=>{
 const p=createWebsitePermissions(),work=p.register(request()),personal=p.register(request({accountLabel:'Personal'}));
 assert.notEqual(work.id,personal.id);assert.equal(p.register(request()).id,work.id);
 assert.equal(hostAllowed(work,'https://github.com/Hostkris/Office-HQ'),true);
 assert.equal(hostAllowed(work,'https://github.com.evil.com/'),false);
 assert.equal(hostAllowed(work,'https://api.github.com/'),false);
 for(const url of ['http://github.com/','https://name:secret@github.com/','https://127.0.0.1/','https://[::1]/','https://localhost/','https://a.internal/','https://github.com:8443/','file:///etc/passwd'])assert.throws(()=>publicWebsite(url));
});
test('Deny grants no access; reviewed requests cannot be replayed or widened at decision time',()=>{
 const p=createWebsitePermissions(),r=p.request(request());
 assert.throws(()=>p.decide({requestId:r.id,companyId:r.companyId,decision:'relevant'}),/owner/);
 assert.throws(()=>p.decide({requestId:r.id,companyId:'other',decision:'relevant',ownerConfirmed:true}),/not found/);
 p.decide({requestId:r.id,companyId:r.companyId,decision:'deny',ownerConfirmed:true});
 assert.equal(p.view().grants.length,0);
 assert.throws(()=>p.decide({requestId:r.id,companyId:r.companyId,decision:'relevant',ownerConfirmed:true}),/already/);
});
test('all 39 agents can receive listed websites only; every grant retains its unique role mandate',()=>{
 const p=createWebsitePermissions(),people=roles.filter(r=>r.key!=='ceo').map((r,n)=>({employeeId:'worker-'+n,employeeName:r.title,roleKey:r.key}));
 const r=p.request(request({workers:people,relevantUrls:['https://docs.google.com/']}));
 p.decide({requestId:r.id,companyId:r.companyId,decision:'relevant',ownerConfirmed:true,url:'https://evil.com/'});
 const grants=p.view().grants;assert.equal(grants.length,78);
 assert.equal(new Set(grants.map(g=>g.roleKey)).size,39);
 assert.ok(grants.every(g=>['https://github.com','https://docs.google.com'].includes(g.origin)&&g.scope===roles.find(r=>r.key===g.roleKey).scope));
 assert.throws(()=>createWebsitePermissions().request(request({workers:[worker,{...worker,employeeId:'duplicate'}]})),/one active/);
 assert.throws(()=>p.request(request({workers:[{...worker,roleKey:'ceo'}]})),/one active/);
});
test('chat grants end at expiry, explicit chat end and runtime restart; persistent grants survive restart',()=>{
 let time=Date.now();const p=createWebsitePermissions({now:()=>time});
 const r=p.request(request({relevantUrls:['https://docs.google.com/']}));p.decide({requestId:r.id,companyId:r.companyId,decision:'chat',ownerConfirmed:true});
 assert.equal(p.view().grants.length,1);const id=p.view().grants[0].id;assert.ok(p.grant(id));
 time+=86400001;assert.equal(p.grant(id),undefined);
 const r2=p.request(request({conversationId:'chat-2'}));p.decide({requestId:r2.id,companyId:r2.companyId,decision:'chat',ownerConfirmed:true});
 p.endChat({companyId:r2.companyId,conversationId:'chat-2',ownerConfirmed:true});assert.ok(p.view().grants.every(g=>!g.active));
 assert.throws(()=>p.request(request({conversationId:'chat-2'})),/chat ended/);
 const r3=p.request(request({conversationId:'chat-3'}));p.decide({requestId:r3.id,companyId:r3.companyId,decision:'chat',ownerConfirmed:true});
 const r4=p.request(request({conversationId:'chat-4',accountLabel:'Personal'}));p.decide({requestId:r4.id,companyId:r4.companyId,decision:'relevant',ownerConfirmed:true});
 const restored=createWebsitePermissions({initial:structuredClone(p.serialize()),now:()=>time});
 assert.equal(restored.view().grants.filter(g=>g.active).length,1);assert.equal(restored.view().grants.find(g=>g.active).duration,'relevant');
});

async function runtime(fn,choice=()=>({action:'finish',note:'Verified fixture report'}),target={tag:'A',label:'Project',href:'https://github.com/Hostkris/'}){
 const root=await mkdtemp(join(tmpdir(),'hq-web-permissions-'));const clicks=[],page={url:()=> 'https://github.com/Hostkris/',isClosed:()=>false,
  frames:()=>[],evaluate:async()=>target,mouse:{click:async(...v)=>clicks.push(v),wheel:async()=>{}},keyboard:{type:async()=>{}}};
 const service=createDesktopService({root,browserFactory:async()=>({page,context:{close:async()=>{}}}),decisionProvider:choice});
 try{await service.init();await fn({service,clicks,page,root});}finally{await service.shutdown();await rm(root,{recursive:true,force:true,maxRetries:8,retryDelay:40});}
}
async function authorize(service,extra={}){const {request:r}=await service.action({action:'request-access',...request(extra)});const result=await service.action({action:'decide-access',companyId:r.companyId,requestId:r.id,decision:'chat',ownerConfirmed:true});return result.websiteAccess.grants.find(g=>g.requestId===r.id);}
async function until(check){for(let i=0;i<100;i++){if(await check())return;await sleep(10);}throw Error('Fixture did not reach expected state');}
test('real runner uses an approved grant, retains role scope, and reports only the actual model result',async()=>runtime(async({service,root})=>{
 const g=await authorize(service);const job=await service.action({action:'run',companyId:g.companyId,grantId:g.id,prompt:g.prompt,mode:'draft'});
 await until(async()=>(await service.status(g.companyId)).jobs[0]?.status==='completed');
 const j=(await service.status(g.companyId)).jobs[0];assert.equal(j.id,job.jobId);assert.equal(j.roleKey,'research');assert.equal(j.summary,'Verified fixture report');
 const saved=JSON.parse(await readFile(join(root,'.office-hq-private/workstation.json'),'utf8'));assert.equal(saved.websiteAccess.grants[0].id,g.id);
}));
test('revocation while the model is deciding prevents its returned click from executing',async()=>{
 let release,started;const waiting=new Promise(r=>started=r),choice=()=>{started();return new Promise(r=>release=r);};
 await runtime(async({service,clicks})=>{const g=await authorize(service);await service.action({action:'run',companyId:g.companyId,grantId:g.id,prompt:g.prompt,mode:'draft'});await waiting;
  await service.action({action:'revoke-access',companyId:g.companyId,grantId:g.id,ownerConfirmed:true});release({action:'click',x:10,y:10});
  await until(async()=>!(await service.status(g.companyId)).jobs[0].executing);assert.equal(clicks.length,0);assert.equal((await service.status(g.companyId)).jobs[0].status,'cancelled');
 },choice);
});
test('account writes need one-click approval and read-only grants cannot bypass that limit',async()=>{
 await runtime(async({service,clicks})=>{const g=await authorize(service);await service.action({action:'run',companyId:g.companyId,grantId:g.id,prompt:g.prompt,mode:'draft'});
  await until(async()=>(await service.status(g.companyId)).jobs[0]?.status==='awaiting_approval');
  const j=(await service.status(g.companyId)).jobs[0];assert.equal(clicks.length,0);
  await service.action({action:'approve',jobId:j.id,approvalId:j.approval.id});assert.equal(clicks.length,1);
  await assert.rejects(service.action({action:'approve',jobId:j.id,approvalId:j.approval.id}),/No pending/);
 },()=>({action:'click',x:10,y:10}),{tag:'BUTTON',label:'Save draft'});
 await runtime(async({service,clicks})=>{const g=await authorize(service,{mode:'observe'});await service.action({action:'run',companyId:g.companyId,grantId:g.id,prompt:g.prompt,mode:'draft'});
  await until(async()=>(await service.status(g.companyId)).jobs[0]?.status==='paused');assert.equal(clicks.length,0);assert.equal((await service.status(g.companyId)).jobs[0].approval,null);
 },()=>({action:'click',x:10,y:10}),{tag:'BUTTON',label:'Save draft'});
});
test('a link to another origin pauses before clicking and produces a fresh access request',async()=>runtime(async({service,clicks})=>{
 const g=await authorize(service);await service.action({action:'run',companyId:g.companyId,grantId:g.id,prompt:g.prompt,mode:'draft'});
 await until(async()=>(await service.status(g.companyId)).jobs[0]?.status==='paused');const s=await service.status(g.companyId);assert.equal(clicks.length,0);
 assert.equal(s.websiteAccess.requests.find(r=>r.status==='pending').accounts[0].origin,'https://docs.google.com');
},()=>({action:'click',x:10,y:10}),{tag:'A',label:'Project docs',href:'https://docs.google.com/document/'}));
