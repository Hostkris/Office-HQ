import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>readFile(join(root,p),'utf8');
const [app,html,css,floor,review,server,sw,refresh]=await Promise.all([
 'app.js','index.html','styles.css','project-floor.js','deliverables.js','server.mjs','sw.js','refresh.js'
].map(read));
test('Navigation groups deep sections but retains every existing screen and accessible quick actions',()=>{
 for(const name of ['command','office','tasks','workforce','approvals','jobs','workflows','health','org','thread','meetings','finance','inventory','audit','reports','connections','workstations','settings','files']){
  assert.match(html,new RegExp('data-view="'+name+'"'));
 }
 assert.match(html,/hq-nav-group/);
 assert.match(html,/Completed Work &amp; Files/);
 assert.match(css,/hq-nav-children/);
});
test('Live RPG is an isolated viewer until user taps Manage Office',()=>{
 assert.match(floor,/function renderImmersive\(/);
 assert.match(floor,/setManageOffice\(true\)/);
 assert.match(floor,/function isImmersive\(\)/);
 assert.match(app,/hq-immersive-office/);
 assert.match(css,/body\.hq-immersive-office \.sidebar/);
 assert.match(floor,/data-view="command"/);
 assert.match(floor,/data-pf="manage-office"/);
 assert.match(floor,/id="pfFloor"/);
 assert.match(floor,/id="pfScene"/);
});
test('Deliverables are loaded online, offline, on localhost and by Refresh App',()=>{
 for(const asset of [html,sw,refresh])assert.match(asset,/deliverables\.js/);
 assert.match(server,/'\/deliverables\.js':'deliverables\.js'/);
 assert.match(sw,/agent-office-hq-v\d+/);
 assert.match(app,/reviewDeliverable/);
 assert.match(app,/Open work & decide/);
});
function sandbox(){
 const events={},calls={};
 const task={id:'task1',companyId:'company1',ownerId:'worker1',title:'Finished cover image',status:'review',
    output:'Original art draft — approval requested',requiresApproval:true,approvalId:null};
 const company={id:'company1',name:'Studio'};
 const state={companies:[company],tasks:[task],employees:[{id:'worker1',name:'Design worker'}],approvals:[],enterprise:{}};
 let counter=0;
 const B={getState:()=>state,uid:()=>String(++counter),E:v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;'),
  save:()=>{calls.saves=(calls.saves||0)+1;},toast:(message)=>{calls.toast=message;},
  setView:view=>{calls.view=view;},decideApproval:(id,decision)=>{calls.decision={id,decision};state.approvals.find(a=>a.id===id).status=decision;task.status=decision==='approved'?'done':'blocked';}};
 const window={OfficeHQBridge:B,OfficeHQExtraViews:{},addEventListener:()=>{}};
 const document={querySelector:q=>q==='#companyPicker'?{value:'company1'}:null,addEventListener:(event,fn)=>{events[event]=fn;}};
 const context={window,document,URL,Date,Map,Set,Array,String,JSON,console,FormData,FileReader:class {},confirm:()=>true,location:{hash:''}};
 vm.runInNewContext(review,context,{filename:'deliverables.js'});
 return {state,window,events,calls,task};
}
test('Only safe https source links can enter the local work library',()=>{
 const s=sandbox(),safe=s.window.OfficeHQDeliverables.safeUrl;
 assert.equal(safe('https://suno.com/song/123'),'https://suno.com/song/123');
 assert.equal(safe('javascript:alert(1)'),null);
 assert.equal(safe('http://example.com/image.png'),null);
 assert.equal(safe('https://a.com@evil.com'),null);
});
test('Only the owner can approve linked work and prior state persists',()=>{
 const s=sandbox();
 s.window.OfficeHQDeliverables.openTask(s.task.id);
 assert.equal(s.calls.view,'files');
 s.window.OfficeHQDeliverables.records().push({id:'img1',taskId:s.task.id,companyId:'company1',name:'cover.png',
   type:'image',mime:'image/png',data:'data:image/png;base64,AAAA',createdAt:'2026-10-19T12:00:00.000Z'});
 let visual=s.window.OfficeHQExtraViews.files();
 assert.match(visual,/Finished cover image/);
 assert.match(visual,/data-files-action="preview"/);
 assert.match(visual,/data-files-action="approve"/);
 s.events.click({target:{closest:()=>({dataset:{filesAction:'approve',task:s.task.id}})}});
 assert.equal(s.calls.decision?.decision,'approved');
 assert.equal(s.state.approvals.length,1);
 assert.equal(s.task.status,'done');
 assert.equal(s.state.enterprise.deliverables.length,1);
 visual=s.window.OfficeHQExtraViews.files();
 assert.match(visual,/Approved/);
 assert.doesNotMatch(visual,/data-files-action="approve"/);
});
test('Declined work is blocked and recorded separately from deletion',()=>{
 const s=sandbox();
 s.window.OfficeHQDeliverables.records().push({id:'link1',taskId:'task1',companyId:'company1',name:'Original draft',type:'link',
  url:'https://suno.com/song/example',createdAt:'2026-10-19T12:00:00.000Z'});
 s.window.OfficeHQDeliverables.openTask('task1');
 s.events.click({target:{closest:()=>({dataset:{filesAction:'decline',task:'task1'}})}});
 assert.equal(s.calls.decision?.decision,'rejected');
 assert.equal(s.task.status,'blocked');
 assert.equal(s.state.tasks.length,1);
 assert.equal(s.state.enterprise.deliverables.length,1);
});
