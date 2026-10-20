/* Real local OpenMausBot bridge view, intentionally setup-only on public GitHub Pages. */
(function(){
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews)return;
const E=B.E, $=q=>document.querySelector(q);
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
let latest={connected:false,dispatchEnabled:false,bots:[],bindings:[]},selected='',busy=false;
const companyId=()=>$('#companyPicker')?.value==='all'||!$('#companyPicker')?.value?B.getState().companies[0]?.id:$('#companyPicker').value;
const marketers=()=>B.getState().employees.filter(e=>e.companyId===companyId()&&e.active&&B.roleFor(e)?.dept==='Marketing');
const employee=()=>marketers().find(e=>e.id===selected);
const tasks=()=>B.getState().tasks.filter(t=>t.companyId===companyId()&&t.ownerId===selected&&t.status!=='done'&&t.status!=='cancelled');
const bound=()=>latest.bindings?.find(b=>b.companyId===companyId()&&b.employeeId===selected);
function heading(){return '<div class="page-head"><div class="eyebrow">REAL AGENT ENGINE · LOCAL BRIDGE</div><h1>OpenMausBot · AI Agent Engine</h1><p class="muted">Connect one approved Marketing specialist to a real OpenMausBot conversation. Your existing staff, desks, roles, and assignments stay in Office HQ.</p></div>';}
function render(){
 const setup='<section class="card"><h2>Start the agent engine on your computer</h2>'+
 '<p>OpenMausBot needs a computer running its engine. GitHub Pages and Safari on an iPhone cannot launch private computer processes.</p>'+
 '<p>On your computer, install OpenMausBot and its CLI. From the Office HQ folder use the commands below:</p>'+
 '<pre>npm install -g openmausbot\nopenmausbot doctor --json\ncd agent-office-hq\nopenmausbot team apply openmaus/office-hq-starter-team.json --dry-run\nopenmausbot team apply openmaus/office-hq-starter-team.json\nnpm install\nnpm run dev</pre>'+
 '<p>Then open <strong>http://127.0.0.1:3000/#/openmaus</strong> on that same computer. Inspect bot approval settings before allowing any jobs.</p>'+
 '<p><a href="https://github.com/Hostkris/Office-HQ/blob/main/agent-office-hq/docs/OPENMAUSBOT_SETUP.md" target="_blank" rel="noopener">Full setup and safety details ↗</a></p></section>';
 if(!isLocal)return heading()+setup+'<p class="notice">No external account, AI bot or computer is connected from this public page.</p>';
 const people=marketers();
 if(selected&&!people.some(e=>e.id===selected))selected='';
 if(!selected)selected=people[0]?.id||'';
 const mapped=bound(),ready=latest.connected&&latest.bots?.includes('Office HQ Marketing Research');
 const eligible=tasks();
 return heading()+
 '<section class="card"><div class="section-top"><h2>1 · Agent engine connection</h2><button type="button" class="btn btn-sm" data-maus="refresh">↻ Check connection</button></div>'+
 '<p>OpenMausBot: <strong>'+(latest.connected?'Connected to local CLI':'Not connected')+'</strong> · Safe Marketing starter bot: <strong>'+(ready?'Found':'Unavailable')+'</strong> · Sending: <strong>'+(latest.dispatchEnabled?'Opted in':'Off by default')+'</strong></p>'+
 '<p class="small muted">This connection runs only on this computer. The OpenMausBot app and its actual approval settings remain authoritative.</p></section>'+
 '<section class="card" style="margin-top:16px"><h2>2 · Bind one Marketing employee</h2>'+
 '<label class="desktop-label">Marketing employee<select id="mausEmployee">'+people.map(e=>'<option value="'+E(e.id)+'"'+(selected===e.id?' selected':'')+'>'+E(e.name)+' · '+E(B.roleFor(e)?.title||'Marketing')+'</option>').join('')+'</select></label>'+
 '<p class="small">Bot: <strong>Office HQ Marketing Research</strong> · Exclusive employee mapping</p>'+
 (mapped?'<p>Assigned to <strong>'+E(mapped.employeeName)+'</strong>.</p><button type="button" class="btn btn-sm" data-maus="revoke">Revoke Office HQ mapping</button>':
 '<label class="desktop-check"><input id="mausBindConfirm" type="checkbox"> I authorize this Marketing employee only and have inspected the bot permissions.</label>'+
 '<button type="button" class="btn btn-primary" data-maus="bind"'+(!ready?' disabled':'')+'>✓ Authorize exclusive binding</button>')+'</section>'+
 '<section class="card" style="margin-top:16px"><h2>3 · Send an existing assignment for draft work</h2>'+
 '<p>Only assignments already owned by the selected employee are eligible. Every submission needs your personal confirmation.</p>'+
 '<label class="desktop-label">Existing employee assignment<select id="mausTask"><option value="">Choose an assignment</option>'+
 eligible.map(t=>'<option value="'+E(t.id)+'">'+E(t.title)+'</option>').join('')+'</select></label>'+
 '<label class="desktop-check"><input id="mausSendConfirm" type="checkbox"> I have inspected OpenMausBot: Ask for approval, computer Off, no connected app access. I approve sending this draft-only job now.</label>'+
 '<button type="button" class="btn btn-primary" data-maus="send"'+(!mapped||!latest.dispatchEnabled?' disabled':'')+'>▶ Send to OpenMausBot</button>'+
 '<p class="small muted">When sending is off, restart the local Office HQ server with OFFICE_HQ_OPENMAUS_SEND=1 after checking restrictions. Sending a message does not prove task completion.</p></section>'+
 '<p class="notice">Do not give this starter bot Gmail, Meta, Shopify, bank, password, or payment access. Revoking a mapping does not stop a running bot or revoke an OAuth token.</p>'+
 '<p id="mausNotice" class="notice" role="status" aria-live="polite"></p>';
}
window.OfficeHQExtraViews.openmaus=render;
function notice(message,bad=false){const el=$('#mausNotice');if(el){el.textContent=message;el.style.color=bad?'var(--red)':'var(--turq)';}else B.toast(message,bad?'error':'success');}
async function api(data){
 const res=await fetch('/api/openmaus/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),cache:'no-store'});
 const result=await res.json();if(!res.ok)throw Error(result.error||'Local OpenMausBot command failed.');return result;
}
async function refresh(){
 if(!isLocal||busy)return;
 busy=true;
 try{
  const r=await fetch('/api/openmaus/status',{cache:'no-store'});if(!r.ok)throw Error('Local Office HQ server is unavailable.');
  latest=await r.json();if($('#mausEmployee'))selected=$('#mausEmployee').value||selected;
  if(location.hash.replace('#/','')==='openmaus')B.setView('openmaus');
 }catch(e){notice(e.message,true);}
 finally{busy=false;}
}
async function clicked(action){
 if(action==='refresh')return refresh();
 if(!isLocal)throw Error('OpenMausBot bridge is available on the computer only.');
 if($('#mausEmployee'))selected=$('#mausEmployee').value;
 const e=employee();if(!e)throw Error('Select an active Marketing employee.');
 if(action==='bind'){
  const answer=await api({action:'bind',companyId:companyId(),employeeId:e.id,employeeName:e.name,
   department:B.roleFor(e)?.dept,botName:'Office HQ Marketing Research',ownerConfirmed:$('#mausBindConfirm')?.checked===true});
  B.addActivity('You · CEO','Authorized local OpenMausBot for '+answer.employeeName,'settings',companyId());
  await refresh();notice('Exclusive Marketing bot assigned. No external account authorized.');return;
 }
 if(action==='revoke'){
  if(!confirm('Revoke this Office HQ employee mapping? This does not stop jobs in OpenMausBot.'))return;
  await api({action:'revoke',companyId:companyId(),employeeId:e.id,ownerConfirmed:true});
  B.addActivity('You · CEO','Revoked local OpenMausBot employee mapping','settings',companyId());
  await refresh();notice('Office HQ mapping revoked; stop active jobs in OpenMausBot if needed.');return;
 }
 if(action==='send'){
  const task=tasks().find(t=>t.id===$('#mausTask')?.value);
  if(!task)throw Error('Choose a pending assignment owned by this employee.');
  const result=await api({action:'send',companyId:companyId(),employeeId:e.id,title:task.title,
   description:task.description||task.title,ownerConfirmed:$('#mausSendConfirm')?.checked===true});
  task.openMausSendId=result.sendId;task.openMausBot=result.botName;task.updatedAt=new Date().toISOString();
  B.addActivity(e.name,'Submitted existing assignment to OpenMausBot for draft work; outcome pending','task',companyId());
  B.save();await refresh();notice('Submitted to OpenMausBot. Open its conversation to review actual progress and approvals.');return;
 }
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-maus]');if(!b)return;
 ev.preventDefault();void clicked(b.dataset.maus).catch(e=>notice(e.message||'OpenMausBot operation unsuccessful.',true));
});
document.addEventListener('change',ev=>{
 if(ev.target.id==='mausEmployee'){selected=ev.target.value;B.setView('openmaus');}
 if(ev.target.id==='companyPicker'&&location.hash.replace('#/','')==='openmaus'){selected='';queueMicrotask(()=>B.setView('openmaus'));}
});
setTimeout(()=>{if(isLocal)void refresh();},350);
if(location.hash.replace('#/','')==='openmaus')B.setView('openmaus');
})();
