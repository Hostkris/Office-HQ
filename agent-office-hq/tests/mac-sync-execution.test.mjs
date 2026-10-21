import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMacSyncService} from '../device-sync/mac-worker.mjs';
function model(){
 const state={connected:true,dispatchEnabled:true,bindings:[],runs:[]},actions=[];
 return {state,actions,status:async()=>state,action:async p=>{
  actions.push(p);
  if(p.action==='bind-department'){
   const bindings=p.employees.map(e=>({...e,companyId:p.companyId,department:p.department}));state.bindings.push(...bindings);return {bound:bindings.length,bindings};
  }
  if(p.action==='send'){const r={...p,id:'run-'+p.officeTaskId,status:'running',result:'',canResume:false};state.runs.push(r);return {runId:r.id};}
  if(p.action==='resume'){const r=state.runs.find(r=>r.id===p.runId);r.status='running';r.canResume=false;return {resumed:true};}
  throw Error('Unexpected native operation '+p.action);
 }};
}
async function fixture(fn){
 const storage=await mkdtemp(join(tmpdir(),'office-sync-'));const rows=[],writes=[],bridge=model();
 const request=async(path,token,opts={})=>{
  const body=opts.body?JSON.parse(opts.body):null,url=new URL(path,'https://example.invalid');
  if(path.startsWith('/auth/v1/token'))return {access_token:'owner-session',refresh_token:'private-refresh',expires_in:3600};
  if(path==='/auth/v1/user')return {id:'owner1'};
  if(url.pathname.endsWith('hq_device_sync_presence'))return opts.method==='POST'?null:[];
  if(!url.pathname.endsWith('hq_device_synced_assignments'))throw Error('Unexpected cloud path '+path);
  if(opts.method==='PATCH'){
   writes.push(body);const row=rows.find(r=>r.id===url.searchParams.get('id')?.slice(3));if(row)Object.assign(row,body);return row?[row]:[];
  }
  return rows.filter(r=>url.searchParams.get('status')==='eq.queued'?r.status==='queued':['in_progress','blocked'].includes(r.status));
 };
 const service=createMacSyncService({bridge,cloudRequest:request,storage,startPolling:false});
 try{await fn({service,bridge,rows,writes,storage});}finally{await rm(storage,{recursive:true,force:true});}
}
const department={companyId:'co1',companyName:'First company',department:'Marketing',employees:[{employeeId:'e1',employeeName:'Researcher',roleKey:'research'}],ownerConfirmed:true};
const task=(id,extra={})=>({id,client_task_key:'task-'+id,source_device_id:'ios-source1',company_label:'First company',employee_role:'research',employee_label:'Researcher',owner_confirmed:true,title:'Research a campaign',description:'Prepare a source-labeled draft.',status:'queued',...extra});
async function prepare(service){await service.grantDepartment(department);await service.pair({email:'owner@example.invalid',password:'not-a-real-password',ownerConfirmed:true});}

test('department activation persists all phone mappings and requires explicit CEO consent',async()=>{
 await fixture(async({service,storage,bridge})=>{
  await assert.rejects(service.grantDepartment({...department,ownerConfirmed:false}),/Approve department/);
  assert.equal(bridge.state.bindings.length,0);await service.grantDepartment(department);
  const mappings=JSON.parse(await readFile(join(storage,'sync-employees.json'),'utf8'));
  assert.deepEqual(mappings,[{companyId:'co1',employeeId:'e1',companyName:'First company',roleKey:'research'}]);
 });
});
test('authorized iPhone assignment produces one Mac run and returns the actual draft for CEO review',async()=>{
 await fixture(async({service,bridge,rows})=>{
  await prepare(service);rows.push(task('one'));await service.tick();assert.equal(rows[0].status,'in_progress');
  assert.equal(rows[0].note,'Ollama drafting started');assert.equal(bridge.actions.filter(p=>p.action==='send').length,1);
  bridge.state.runs[0].status='review';bridge.state.runs[0].result='Real local model draft';
  await service.tick();assert.equal(rows[0].status,'review');assert.equal(rows[0].draft,'Real local model draft');
  await service.tick();assert.equal(bridge.actions.filter(p=>p.action==='send').length,1);
 });
});
test('unmatched company and role stay queued; a disconnected model never claims work',async()=>{
 await fixture(async({service,bridge,rows})=>{
  await prepare(service);rows.push(task('company',{company_label:'Other company'}),task('role',{employee_role:'social'}));
  await service.tick();assert.ok(rows.every(r=>r.status==='queued'));
  rows.push(task('model'));bridge.state.connected=false;await service.tick();assert.equal(rows[2].status,'queued');
  assert.equal(bridge.actions.filter(p=>p.action==='send').length,0);
 });
});
test('Mac-origin job adopts its existing receipt for phone results without a duplicate run',async()=>{
 await fixture(async({service,bridge,rows})=>{
  await prepare(service);rows.push(task('local',{source_device_id:'mac-browser1'}));
  bridge.state.runs.push({id:'local-run',companyId:'co1',employeeId:'e1',roleKey:'research',officeTaskId:'task-local',status:'review',result:'Local team result'});
  await service.tick();assert.equal(rows[0].status,'review');assert.equal(rows[0].draft,'Local team result');
  assert.equal(bridge.actions.filter(p=>p.action==='send').length,0);
 });
});
test('recoverable cloud job resumes under its retained approval and its later result replaces the blocked state',async()=>{
 await fixture(async({service,bridge,rows})=>{
  await prepare(service);rows.push(task('recovery'));await service.tick();
  const r=bridge.state.runs[0];r.status='failed';r.reason='Ollama connection reset';r.canResume=false;
  await service.tick();assert.equal(rows[0].status,'blocked');
  r.canResume=true;await service.tick();assert.equal(rows[0].status,'in_progress');assert.equal(rows[0].note,'Ollama drafting resumed after recovery');
  r.status='review';r.result='Recovered actual draft';await service.tick();assert.equal(rows[0].draft,'Recovered actual draft');
  assert.equal(bridge.actions.filter(p=>p.action==='resume').length,1);
 });
});
