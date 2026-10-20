import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../ceo-secure-chat.js',import.meta.url),'utf8');

function setup({host='hostkris.github.io',runtimeRuns=[]}={}){
  let sequence=0;
  const callbacks={};
  const roles=['ceo','exec_assistant','project_mgr','content','social','graphic_designer','ads','research','integrator','backend_engineer','product_mgr','pricing_analyst'];
  const workers=roles.map((roleKey,i)=>({id:'emp'+i,roleKey,name:roleKey.replaceAll('_',' '),active:true,companyId:'company1'}));
  const state={enterprise:{},employees:workers,tasks:[],approvals:[],companies:[{id:'company1'}]};
  const input={value:'',dataset:{},focus(){this.focused=true;}};
  const calls={fetch:0,approved:[],refresh:0,toasts:[],pushed:[],floorChanges:[]};
  const B={
    E:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    uid:prefix=>prefix+'_'+ ++sequence,
    getState:()=>state,getEmployee:id=>workers.find(e=>e.id===id),roleFor:e=>e?{scope:e.roleKey}:null,
    save:()=>{},toast:(...a)=>calls.toasts.push(a),
    decideApproval:(id,status)=>{const a=state.approvals.find(x=>x.id===id);if(a)a.status=status;calls.approved.push([id,status]);}
  };
  const document={
    addEventListener:(type,callback)=>{callbacks[type]=callback;},
    querySelector:query=>query==='#companyPicker'?{value:'company1'}:
      query.includes('data-ceo-chat-input')?input:null
  };
  const window={OfficeHQBridge:B,OfficeHQCompanyInbox:{refresh:()=>calls.refresh++},OfficeHQFloor:{onTaskAssigned:()=>{},onTaskStatus:t=>calls.floorChanges.push([t.id,t.status])},OfficeHQDeviceSync:{snapshot:()=>({connected:false}),pushTask:t=>calls.pushed.push(t.id)}};
  const location={hostname:host,hash:''};
  const fetch=async url=>{calls.fetch++;if(host==='127.0.0.1'&&url==='/api/openmaus/status')return {ok:true,json:async()=>({connected:true,dispatchEnabled:true,bindings:[],runs:runtimeRuns})};throw Error('external requests must not occur from public Safari');};
  vm.runInNewContext(source,{window,document,location,fetch,navigator:{language:'en-US'},queueMicrotask:fn=>fn(),setInterval:()=>{}},{filename:'ceo-secure-chat.js'});
  function click(op,jobId){
    const button={dataset:{ceoChatAction:op,job:jobId}};
    callbacks.click({target:{closest:selector=>selector==='[data-ceo-chat-action]'?button:null},preventDefault(){}});
  }
  function send(value){input.value=value;click('send');}
  const chat=()=>state.enterprise.ceoSecureChat;
  return {state,workers,calls,input,window,send,click,chat,runtimeRuns};
}
function ready(f,job,index=0){
  const task=f.state.tasks.find(t=>t.id===job.currentTaskIds[index]);
  assert.ok(task);
  task.status='review';task.output='Verified draft '+index;
  f.state.approvals.push({id:'approval_'+index,taskId:task.id,status:'pending'});
  return task;
}

test('selects multiple specialists without asking the CEO to manually choose people',()=>{
  const f=setup();
  f.send('Design an Instagram graphic and create social media content');
  const job=f.chat().jobs[0];
  assert.deepEqual(Array.from(job.employeeIds,x=>f.workers.find(w=>w.id===x).roleKey),['content','social','graphic_designer']);
  assert.equal(job.currentTaskIds.length,3);
  assert.equal(f.state.tasks.length,3);
  assert.ok(f.state.tasks.every(t=>t.cloudSyncRequested===true&&t.ceoSecureDesk===true));
  assert.equal(f.calls.pushed.length,3,'each authorized specialist must have a separate sync assignment');
  assert.equal(f.calls.fetch,0,'public Safari must not dispatch to untrusted backend');
  assert.match(f.window.OfficeHQSecureChat.render(),/Queued — waiting for an authorized agent/);
});

test('dry cleaning routes to assistant and asks for date, then keeps the reply in the same job',()=>{
  const f=setup();
  f.send('Pick up my dry cleaning');
  const job=f.chat().jobs[0];
  assert.equal(job.status,'needs-answer');
  assert.match(job.question,/What day/);
  assert.equal(f.state.tasks.length,0);
  f.click('reply',job.id);
  // The reply target must survive a new screen render while the CEO is dictating.
  assert.match(f.window.OfficeHQSecureChat.render(),/data-reply-job="ceojob_/);
  f.input.dataset={};
  f.send('Friday');
  assert.equal(f.chat().jobs.length,1);
  assert.equal(job.currentTaskIds.length,1);
  assert.equal(f.workers.find(x=>x.id===job.employeeIds[0]).roleKey,'exec_assistant');
  assert.match(f.state.tasks[0].description,/Friday/);
  assert.equal(f.calls.fetch,0);
});

test('all specialists receive revision assignments; old approvals are superseded',()=>{
  const f=setup();
  f.send('Design Instagram graphic and social media content');
  const job=f.chat().jobs[0];
  const original=job.currentTaskIds.slice();
  ready(f,job,0);ready(f,job,1);ready(f,job,2);
  f.click('revise',job.id);
  f.send('Please make the images warmer and revise all three deliverables.');
  assert.equal(job.currentTaskIds.length,3,'revisions must not silently drop teammates');
  assert.equal(f.state.tasks.length,6);
  assert.ok(original.every(id=>!job.currentTaskIds.includes(id)));
  assert.ok(f.state.approvals.every(a=>a.status==='superseded'));
  assert.match(job.instruction,/warmer/);
});

test('a team with only one complete draft cannot be approved',()=>{
  const f=setup();
  f.send('Create Instagram graphic and social media content');
  const job=f.chat().jobs[0];
  ready(f,job,0);
  const preview=f.window.OfficeHQSecureChat.render();
  assert.match(preview,/Some drafts ready; waiting for team/);
  assert.doesNotMatch(preview,/data-ceo-chat-action="approve"/);
  f.click('approve',job.id);
  assert.equal(f.calls.approved.length,0);
});

test('Wait keeps approvals pending; Approve requires and records every team draft',()=>{
  const f=setup();
  f.send('Design Instagram graphic and social media content');
  const job=f.chat().jobs[0];
  for(let i=0;i<3;i++)ready(f,job,i);
  const markup=f.window.OfficeHQSecureChat.render();
  assert.match(markup,/data-ceo-chat-action="approve"/);
  f.click('hold',job.id);
  assert.equal(job.status,'held');
  assert.ok(f.state.approvals.every(a=>a.status==='pending'));
  f.click('approve',job.id);
  assert.equal(job.status,'approved');
  assert.equal(f.calls.approved.length,3);
  assert.ok(f.state.approvals.every(a=>a.status==='approved'));
  assert.doesNotMatch(f.window.OfficeHQSecureChat.render(),/data-ceo-chat-action="revise"/);
});

test('unknown request asks a specialist clarification instead of inventing an action',()=>{
  const f=setup();
  f.send('Can you deal with this for me?');
  assert.equal(f.chat().jobs[0].status,'needs-answer');
  assert.equal(f.state.tasks.length,0);
});

test('verified cloud review appears once in the CEO text thread and is never fabricated',()=>{
  const f=setup();f.send('Research 3 scheduling apps for our office');
  const job=f.chat().jobs[0],task=f.state.tasks[0];
  assert.match(f.window.OfficeHQSecureChat.render(),/Queued — waiting for an authorized agent/);
  assert.equal(f.chat().entries.filter(e=>e.body.includes('draft is ready')).length,0);
  task.status='review';task.output='Verified Ollama draft returned from paired Mac';
  const first=f.window.OfficeHQSecureChat.render();
  assert.match(first,/Verified Ollama draft returned from paired Mac/);
  assert.match(first,/My draft is ready for your review/);
  const count=f.chat().entries.length;
  f.window.OfficeHQSecureChat.render();
  assert.equal(f.chat().entries.length,count,'do not spam duplicate agent notifications');
});
test('Mac runtime review creates CEO approval and updates the moving agent only after a verified result',async()=>{
  const f=setup({host:'127.0.0.1'});
  f.send('Research scheduling apps for the office');
  const t=f.state.tasks[0];
  // The local Mac does not have a bound employee in this scenario; no run is fabricated.
  assert.equal(t.status,'queued');
  assert.equal(f.calls.floorChanges.length,0);
  t.openMausRunId='real-mac-run';
  f.runtimeRuns.push({id:'real-mac-run',companyId:t.companyId,employeeId:t.ownerId,
    officeTaskId:t.id,status:'running'});
  await f.window.OfficeHQSecureChat.pollLocalRuns();
  assert.equal(t.status,'in_progress');
  assert.deepEqual(f.calls.floorChanges.at(-1),[t.id,'in_progress']);
  f.runtimeRuns[0].status='review';f.runtimeRuns[0].result='Actual draft from Mac';
  await f.window.OfficeHQSecureChat.pollLocalRuns();
  assert.equal(t.status,'review');
  assert.equal(t.output,'Actual draft from Mac');
  assert.ok(f.state.approvals.some(a=>a.taskId===t.id&&a.status==='pending'));
  assert.match(f.window.OfficeHQSecureChat.render(),/Actual draft from Mac/);
});
test('Mac runtime failures block tasks and never claim completed agent work',async()=>{
  const f=setup({host:'127.0.0.1'});
  f.send('Research our competitors');
  const t=f.state.tasks[0];t.openMausRunId='failed-mac-run';
  f.runtimeRuns.push({id:'failed-mac-run',companyId:t.companyId,employeeId:t.ownerId,
    officeTaskId:t.id,status:'failed',reason:'Ollama model unavailable'});
  await f.window.OfficeHQSecureChat.pollLocalRuns();
  assert.equal(t.status,'blocked');
  assert.match(t.runError,/Ollama model unavailable/);
  assert.equal(t.output,'');
  assert.match(f.window.OfficeHQSecureChat.render(),/could not complete the draft/);
  assert.equal(f.state.approvals.length,0);
});


test('older iPhone jobs need a new CEO tap before entering the Mac queue',()=>{
  const f=setup();f.send('Research free office scheduling apps');
  const job=f.chat().jobs[0],task=f.state.tasks[0];
  task.cloudSyncRequested=false;task.cloudSynced=false;
  f.calls.pushed.length=0;
  assert.match(f.window.OfficeHQSecureChat.render(),/Send saved assignment to Mac/);
  assert.equal(f.calls.pushed.length,0,'older jobs are not silently dispatched');
  f.click('sync',job.id);
  assert.equal(task.cloudSyncRequested,true);
  assert.deepEqual(f.calls.pushed,[task.id]);
  assert.doesNotMatch(f.window.OfficeHQSecureChat.render(),/Send saved assignment to Mac/);
  assert.match(f.window.OfficeHQSecureChat.render(),/Queued for secure Mac sync/);
  assert.equal(f.calls.fetch,0,'public Safari still cannot directly access a local Mac service');
});
