/* Office HQ guided departmental setup. Authorizing bot bindings is not OAuth. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews?.connections)return;
const E=B.E,local=['localhost','127.0.0.1'].includes(location.hostname);
const services={
  Leadership:['gmail','calendar','drive'],PMO:['calendar','drive'],
  Finance:[],Operations:['shopify','etsy'],Marketing:['youtube','instagram','facebook','tiktok'],
  Sales:['shopify','etsy'],Customer:['gmail','shopify'],People:['calendar'],
  Technology:[],Legal:[],Audit:[],Product:['shopify','etsy']
};
const provider={
 gmail:['Gmail','✉'],calendar:['Google Calendar','▦'],drive:['Google Drive','△'],
 youtube:['YouTube','▶'],instagram:['Instagram','◎'],facebook:['Facebook','f'],
 tiktok:['TikTok','♫'],shopify:['Shopify','▣'],etsy:['Etsy','✦']
};
let chosen='',step=0,engine=null,pending=false,notice='',noticeError=false,lastCompany='';
const company=()=>{const x=document.getElementById('companyPicker')?.value;return x&&x!=='all'?x:B.getState().companies[0]?.id};
const team=dept=>B.getState().employees.filter(e=>e.companyId===company()&&e.active&&B.roleFor(e)?.dept===dept);
const departments=()=>[...new Set(B.getRoles().map(r=>r.dept))];
const btn=(label,action,disabled=false)=>'<button class="btn '+(action==='next'||action==='activate'?'btn-primary':'')+'" type="button" data-department-action="'+action+'"'+(disabled?' disabled':'')+'>'+E(label)+'</button>';
const alert=()=>notice?'<p class="notice" role="status" aria-live="polite">'+E(notice)+'</p>':'';
function wizard(){
 const cid=company();
 if(lastCompany!==cid){chosen='';step=0;engine=null;lastCompany=cid;}
 const count=chosen?team(chosen).length:0;
 let body='';
 if(!chosen){
  body='<p class="muted">Tap a department to begin. No employee-by-employee setup.</p><div class="department-tiles">'+
   departments().map(d=>'<button class="department-tile" data-department-pick="'+E(d)+'" type="button"><strong>'+E(d)+'</strong><small>'+team(d).length+' employees <span aria-hidden="true">→</span></small></button>').join('')+'</div>';
 }else if(step===1){
  const apps=services[chosen]||[];
  body='<div class="department-step-top">'+btn('← Departments','back')+'<span>Step 1 of 3</span></div>'+
   '<h3>Connect '+E(chosen)+'</h3><p class="muted">Connect each account once. Each service opens the secure sign-in flow or its setup instructions.</p>'+
   (apps.length?'<div class="department-connection-list">'+apps.map(id=>'<a class="department-connect" href="./cloud.html#connections&provider='+encodeURIComponent(id)+'" target="_blank" rel="noopener"><span>'+E(provider[id][1])+' &nbsp;'+E(provider[id][0])+'</span><strong>Connect ↗</strong></a>').join('')+'</div>':
    '<p class="notice">No direct account connector is ready for this department. Continue to set up its local AI workers; external access stays off.</p>')+
   '<p class="tiny muted">Connections are verified inside Secure Cloud HQ. Opening a link does not grant employee access.</p><div class="department-actions">'+btn('Next: AI workers →','next')+'</div>';
 }else if(step===2){
  const ready=engine?.connected===true;
  const bound=engine?.bindings?.filter(b=>b.companyId===cid&&team(chosen).some(e=>e.id===b.employeeId&&(!b.roleKey||e.roleKey===b.roleKey))).length||0;
  body='<div class="department-step-top">'+btn('← Back','back')+'<span>Step 2 of 3</span></div>'+
   '<h3>Activate '+E(chosen)+' workers</h3><p class="muted">'+count+' active employees · '+(local?(engine===null?'Mac status not checked':ready?'Mac AI engine ready':'Mac AI engine unavailable'):'Open this step on your Mac')+'</p>'+
   '<p class="department-progress">'+bound+' of '+count+' workers authorized for local AI drafts</p>'+
   '<div class="department-actions">'+btn('Check Mac engine','check',!local||pending)+
   (ready&&count>0?btn('Authorize whole department','activate',pending):'')+
   (ready&&bound===count&&!engine?.dispatchEnabled?btn('Enable approved AI drafts','enable-drafts',pending):'')+
   '</div>'+
   (!local?'<p class="notice">Finish this step in Office HQ on your Mac. Your iPhone remains your command center.</p>':
    ready?'<p class="tiny muted">AI drafts are '+(engine.dispatchEnabled?'enabled':'off')+'. This does not give workers Gmail, TikTok, or other external account access.</p>':
    '<p class="notice">Start the Office HQ Mac app and Ollama AI model before authorizing workers.</p>')+
   '<div class="department-actions">'+btn('Next: Assign team work →','next')+'</div>';
 }else{
  body='<div class="department-step-top">'+btn('← Back','back')+'<span>Step 3 of 3</span></div>'+
  '<h3>Give your team a task</h3><p class="muted">One instruction splits into specialist drafts. Verified results are combined and returned to Company Messages for your approval.</p>'+
  '<div class="department-actions">'+btn('Start a team job →','team-job')+' '+btn('Open Company Messages','messages')+'</div>'+
  '<p class="tiny muted">Tasks actually execute only when your Mac is running, the workers are authorized, and secure device sync is connected.</p>';
 }
 return '<section class="card department-setup" aria-label="Guided department setup">'+
 '<div class="section-top"><div><div class="eyebrow">SIMPLE SETUP</div><h2>Department activation</h2></div><span class="ops-tag">12 departments</span></div>'+body+alert()+'</section>';
}
function render(){if(location.hash==='#/connections')B.setView('connections');}
async function check(){
 if(!local){notice='Open Office HQ on your Mac to activate local AI workers.';render();return;}
 pending=true;notice='';render();
 try{
  const res=await fetch('/api/openmaus/status?companyId='+encodeURIComponent(company()),{cache:'no-store'});
  if(!res.ok)throw Error('The local workforce server did not respond.');
  engine=await res.json();notice=engine.connected?'Mac AI engine responded. You can continue setup.':'Mac is reachable, but the AI model is not ready.';
 }catch(err){engine=null;notice=err.message;}
 finally{pending=false;render();}
}
async function action(kind){
 if(kind==='back'){if(step===1){chosen='';step=0;}else step--;notice='';render();return;}
 if(kind==='next'){step=Math.min(3,step+1);notice='';render();if(step===2&&engine===null&&local)await check();return;}
 if(kind==='messages'){document.querySelector('[data-ops="phone-open"]')?.click();return;}
 if(kind==='team-job'){B.setView('workflows');return;}
 if(kind==='check'){await check();return;}
 if(!local){notice='Activation runs on your Mac, not the public iPhone website.';render();return;}
 if(kind==='enable-drafts'){
  if(!engine?.connected)return;
  if(!confirm('Enable AI drafting for authorized employees? This does NOT enable external posting, browsing or email sending.'))return;
  pending=true;render();
  try{
   const res=await fetch('/api/openmaus/action',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'set-dispatch',enabled:true,ownerConfirmed:true})});
   const result=await res.json();if(!res.ok)throw Error(result.error||'Could not enable local AI drafts.');
   await check();notice='Local AI drafting is enabled for authorized workers only.';
  }catch(err){notice=err.message;}finally{pending=false;render();}
  return;
 }
 if(kind==='activate'){
  const workers=team(chosen);
  if(!engine?.connected||!workers.length){notice='First start and check the Mac AI engine.';render();return;}
  if(!confirm('Authorize '+workers.length+' '+chosen+' employees for local AI drafting? External accounts remain separate.'))return;
  pending=true;render();
  try{
   const people=workers.map(w=>({employeeId:w.id,employeeName:w.name,roleKey:w.roleKey}));
   const res=await fetch('/api/openmaus/action',{method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({action:'bind-department',companyId:company(),department:chosen,employees:people,ownerConfirmed:true})});
   const result=await res.json();if(!res.ok)throw Error(result.error||'Could not authorize department.');
   await check();notice=result.note||'Department workers authorized.';
  }catch(err){notice=err.message;}finally{pending=false;render();}
  return;
 }
}
const older=window.OfficeHQExtraViews.connections;
window.OfficeHQExtraViews.connections=function(){
 return wizard()+'<details class="department-advanced"><summary>Advanced settings and individual accounts</summary>'+older()+'</details>';
};
document.addEventListener('click',event=>{
 const pick=event.target.closest('[data-department-pick]');
 if(pick){chosen=pick.dataset.departmentPick;step=1;notice='';render();return;}
 const b=event.target.closest('[data-department-action]');
 if(b){event.preventDefault();if(pending)return;void action(b.dataset.departmentAction);}
});
})();
