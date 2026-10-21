import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../officehq-device-sync.js',import.meta.url),'utf8');
function setup({tasks=[],projects=[],rows=[]}={}){
 const state={tasks,employees:[{id:'e1',companyId:'co1',roleKey:'research',name:'Researcher',active:true}],companies:[{id:'co1',name:'Example company'}],approvals:[],enterprise:{departmentProjects:projects}};
 let uid=0;const requests=[];
 const storage=()=>({getItem:()=>null,setItem(){},removeItem(){}});
 const session={...storage(),getItem:()=>JSON.stringify({access_token:'test-session',refresh_token:'test-refresh',owner_id:'test-owner',expires_at:Date.now()+3600000})};
 const document={readyState:'loading',hidden:false,addEventListener(){},querySelectorAll:()=>[],querySelector:()=>null};
 const window={addEventListener(){},OfficeHQBridge:{getState:()=>state,roleFor:()=>({title:'Researcher',scope:'market_research'}),save(){},uid:p=>p+ ++uid},OfficeHQCompanyInbox:{refresh(){}}};
 const fetch=async(url,opts)=>{
  const u=new URL(url),body=opts.body&&JSON.parse(opts.body);requests.push({url,body,opts});
  const result=u.pathname.endsWith('hq_device_sync_presence')?[]:opts.method==='POST'?[{id:'synced1'}]:opts.method==='PATCH'?[]:rows;
  return {ok:true,json:async()=>result};
 };
 vm.runInNewContext(source,{window,document,fetch,location:{hostname:'hostkris.github.io'},navigator:{onLine:true},localStorage:storage(),sessionStorage:session,crypto:{randomUUID:()=> 'ios-test-device'},setTimeout,clearTimeout,setInterval(){},AbortController,URL,Date,FormData,queueMicrotask});
 return {state,requests,api:window.OfficeHQDeviceSync};
}
const meta={id:'team1',department:'Marketing',title:'A team launch plan',instruction:'Prepare a launch plan',expectedTaskCount:6};
const row={id:'row1',client_task_key:'task1',source_device_id:'mac-test-device',company_label:'Example company',employee_role:'research',employee_label:'Researcher',title:'Research a launch',description:'OFFICE_HQ_TEAM_V1:'+JSON.stringify(meta)+'\nOnly the research specialty draft.',status:'review',draft:'Actual research output',created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
test('team metadata travels inside the existing owner-only task queue and stays within its payload limit',async()=>{
 const task={id:'task1',companyId:'co1',ownerId:'e1',departmentProjectId:'team1',title:'Research a launch',description:'x'.repeat(3000),delegatedBy:'owner',cloudSyncRequested:true,status:'queued',createdAt:new Date().toISOString()};
 const f=setup({tasks:[task],projects:[{...meta,companyId:'co1',taskIds:['task1']} ]});await f.api.refresh();
 const upload=f.requests.find(r=>r.url.includes('hq_device_synced_assignments')&&r.opts.method==='POST');
 assert.match(upload.body[0].description,/^OFFICE_HQ_TEAM_V1:/);assert.ok(upload.body[0].description.length<=4000);
 assert.equal(upload.body[0].owner_confirmed,true);assert.equal(task.cloudSynced,true);
});
test('receiving a team draft reconstructs the same report group without creating separate specialist approvals',async()=>{
 const f=setup({rows:[row]});await f.api.refresh();
 const t=f.state.tasks[0],p=f.state.enterprise.departmentProjects[0];
 assert.equal(t.departmentProjectId,'team1');assert.equal(t.output,'Actual research output');assert.equal(t.description,'Only the research specialty draft.');
 assert.equal(p.expectedTaskCount,6);assert.equal(p.taskIds.length,1);assert.equal(f.state.approvals.length,0);
});
test('a CEO report decision made on the other device updates the corresponding team member only',async()=>{
 const t={id:'task1',companyId:'co1',ownerId:'e1',departmentProjectId:'team1',status:'review',output:'Actual research output',cloudLastReview:'old'};
 const f=setup({tasks:[t],rows:[{...row,status:'done',note:'CEO approved team report'}]});await f.api.refresh();
 assert.equal(t.status,'done');assert.ok(t.cloudDecisionAt);assert.equal(f.state.approvals.length,0);
});
test('a recovered model result replaces a runtime error instead of being mistaken for a CEO rejection',async()=>{
 const t={id:'task1',companyId:'co1',ownerId:'e1',departmentProjectId:'team1',status:'blocked',runError:'Ollama connection reset'};
 const f=setup({tasks:[t],rows:[row]});await f.api.refresh();
 assert.equal(t.status,'review');assert.equal(t.output,'Actual research output');assert.equal(t.runError,'');
 assert.ok(!f.requests.some(r=>r.opts.method==='PATCH'&&r.body?.status==='blocked'));
});
