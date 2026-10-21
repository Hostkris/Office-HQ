/* Native Mac diagnostics. Fix It rechecks and resumes existing approvals only. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;if(!B||!window.OfficeHQExtraViews)return;
const E=B.E,local=['localhost','127.0.0.1'].includes(location.hostname);
let engine=null,busy=false,feedback='',checkedAt=null;
const company=()=>{const c=document.querySelector('#companyPicker')?.value;return c&&c!=='all'?c:B.getState().companies[0]?.id;};
const tasks=()=>B.getState().tasks.filter(t=>t.companyId===company());
const runs=()=>engine?.runs?.filter(r=>r.companyId===company())||[];
function render(){
 const sync=window.OfficeHQDeviceSync?.snapshot?.(),exceptions=tasks().filter(t=>t.status==='blocked');
 const stat=(label,value)=>'<div class="agent-health-stat"><small>'+E(label)+'</small><strong>'+E(value)+'</strong></div>';
 return '<div class="page-head department-page-head"><div class="eyebrow">MAC AGENT DIAGNOSTICS</div><h1>Agent Health</h1><p class="muted">Check the real engine, worker permissions and task errors. Fix It continues eligible drafts under their original approval.</p></div>'+
 '<section class="card"><div class="section-top"><h2>Runtime status</h2><button type="button" class="btn btn-sm" data-agent-health="check"'+(busy?' disabled':'')+'>Check now</button></div>'+
 '<div class="agent-health-grid">'+stat('Mac AI model',!local?'Check on your Mac':engine===null?'Not checked':engine.connected?'Responding':'Unavailable')+
 stat('Draft dispatch',!local?'Managed on Mac':engine?.dispatchEnabled?'Enabled':'Off or unchecked')+
 stat('Phone ↔ Mac sync',sync?.connected?'Exchanging updates':'Waiting for connection')+stat('Blocked workspace tasks',exceptions.length)+'</div>'+
 (engine?'<p class="agent-health-status '+(engine.connected?'ready':'')+'">'+E(engine.message||'Mac checked')+'</p>':'')+
 '<p class="tiny muted">'+E(checkedAt?'Last Mac check: '+new Date(checkedAt).toLocaleTimeString():'No live Mac check completed in this view.')+'</p>'+
 '<div class="department-actions"><button type="button" class="btn btn-primary" data-agent-health="fix"'+(!local||busy?' disabled':'')+'>Fix It · recheck and resume</button><button type="button" class="btn" data-view="connections">Review worker authorization</button></div>'+
 (local?'<p class="tiny muted">Recovery checks Ollama and resumes only the same interrupted draft, up to two retries. Stopped jobs, changed permissions and completed work are never restarted.</p>':'<p class="notice">Your phone shows synchronized task errors. Open Agent Health on your Mac to check its model or run Fix It. The running Mac also checks eligible interrupted drafts in the background.</p>')+
 (feedback?'<p class="notice agent-health-message" role="status">'+E(feedback)+'</p>':'')+'</section>'+
 '<section class="card" style="margin-top:18px"><h2>Assignments needing attention</h2>'+
 (exceptions.length?exceptions.slice(0,30).map(t=>'<article class="agent-health-run"><strong>'+E(t.title)+'</strong><p>'+E(B.getEmployee(t.ownerId)?.name||'Worker unavailable')+' · '+E(t.runError||'Check the worker permission and Mac runtime.')+'</p></article>').join(''):'<p class="muted">No blocked assignments in this workspace.</p>')+'</section>'+
 (local?'<section class="card" style="margin-top:18px"><h2>Verified Mac run history</h2>'+ (runs().length?runs().slice(0,20).map(r=>'<article class="agent-health-run"><strong>'+E(r.title)+'</strong><p>'+E(r.employeeName)+' · '+E(r.status)+' · '+Number(r.retryCount||0)+' retries</p><p>'+E(r.reason||r.thought)+'</p>'+ (r.canResume?'<button type="button" class="btn btn-sm" data-agent-health="resume" data-run="'+E(r.id)+'"'+(busy?' disabled':'')+'>Resume original draft</button>':'')+'</article>').join(''):'<p class="muted">Check the Mac to load its actual run history.</p>')+'</section>':'');
}
function redraw(){if(location.hash==='#/health')B.setView('health');}
async function check(){
 if(!local){await window.OfficeHQDeviceSync?.refresh?.();redraw();return;}
 const r=await fetch('/api/openmaus/status',{cache:'no-store'});if(!r.ok)throw Error('Office HQ Mac server is unavailable. Open Office HQ.app on your Mac.');
 engine=await r.json();checkedAt=Date.now();await window.OfficeHQSecureChat?.pollLocalRuns?.();
}
async function action(op,runId){
 if(busy)return;busy=true;feedback='';redraw();
 try{
  if(op==='check')await check();
  else if(local){
   await check();
   if(!engine?.connected)throw Error(engine?.message||'Open Ollama on your Mac, then try Fix It again.');
   const url=op==='resume'?'/api/openmaus/action':'/api/device-sync/action';
   const payload=op==='resume'?{action:'resume',runId,companyId:company()}:{action:'recover'};
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),data=await r.json();
   if(!r.ok)throw Error(data.error||'Recovery could not continue this draft.');
   feedback=data.note||data.message||'Mac checked. Waiting for an actual AI result.';await check();
  }
 }catch(e){feedback=String(e.message).slice(0,300);}
 finally{busy=false;redraw();}
}
window.OfficeHQExtraViews.health=render;
window.OfficeHQAgentHealth={check,render};
document.addEventListener('click',e=>{const b=e.target.closest('[data-agent-health]');if(b){e.preventDefault();void action(b.dataset.agentHealth,b.dataset.run);}});
if(location.hash==='#/health'){B.setView('health');void action('check');}
})();
