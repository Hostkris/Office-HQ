/* Public-APIs catalog + narrowly approved Agent Reach research.
   Static GitHub Pages: searchable setup directory only. Real tools: private localhost. */
(()=>{
'use strict';
const B=window.OfficeHQBridge;
if(!B||!window.OfficeHQExtraViews)return;
const E=B.E,$=s=>document.querySelector(s);
const isLocal=['127.0.0.1','localhost'].includes(location.hostname);
const CATALOG=[
 {id:'github-mcp',name:'GitHub MCP',type:'Development',auth:'OAuth',url:'https://github.com/github/github-mcp-server',dept:['Technology','PMO'],about:'Repository, issue and pull-request tools. Requires separate provider authorization and narrow scopes.'},
 {id:'marketstack',name:'Marketstack',type:'Finance',auth:'API key',url:'https://marketstack.com/',dept:['Finance','Audit'],about:'Market price data for analysis. Verify access plan, coverage, licensing and rates.'},
 {id:'frankfurter',name:'Frankfurter',type:'Finance',auth:'None listed',url:'https://www.frankfurter.app/docs',dept:['Finance'],about:'Foreign-exchange rate data; not a connection to a bank account.'},
 {id:'openfoodfacts',name:'Open Food Facts',type:'Operations',auth:'None listed',url:'https://world.openfoodfacts.org/data',dept:['Operations','Product'],about:'Public food-product information. Entries are not verified inventory counts.'},
 {id:'recalls',name:'US Recalls MCP',type:'Operations',auth:'API key',url:'https://recallsapi.com/docs/mcp',dept:['Operations','Product','Audit'],about:'Read-only product recall lookup through a separate API service.'},
 {id:'mailboxlayer',name:'Mailboxlayer',type:'Customer',auth:'API key',url:'https://mailboxlayer.com/',dept:['Customer','Marketing','Sales'],about:'Email address validation, not inbox access or permission to send messages.'},
 {id:'weatherstack',name:'Weatherstack',type:'Operations',auth:'API key',url:'https://weatherstack.com/',dept:['Operations','PMO'],about:'Weather information for logistics or operating plans.'},
 {id:'virustotal',name:'VirusTotal',type:'Security',auth:'API key',url:'https://docs.virustotal.com/reference/overview',dept:['Technology'],about:'Security reputation lookups. Avoid sending confidential files to an external provider.'},
 {id:'ipstack',name:'IPstack',type:'Security',auth:'API key',url:'https://ipstack.com/',dept:['Technology','Marketing'],about:'IP intelligence and approximate geolocation; requires privacy review.'},
 {id:'filestack',name:'Filestack',type:'Productivity',auth:'API key',url:'https://www.filestack.com/docs/',dept:['Technology','Product'],about:'File upload/transformation platform; requires explicit access controls.'},
 {id:'shapelessai',name:'ShapelessAI MCP',type:'Marketing',auth:'OAuth',url:'https://shapelessai.com/docs/mcp',dept:['Marketing'],about:'Offers social publishing tools. Publishing is NOT activated in Office HQ.'},
 {id:'googlebooks',name:'Google Books',type:'Product',auth:'OAuth listed',url:'https://developers.google.com/books/',dept:['Product','Marketing'],about:'Discover books and bibliographic information; developer terms apply.'}
];
const RESEARCH_ROLES=new Set(['research','social','content','cmo','product_mgr','catalog','pricing_analyst','integrator','security','backend_engineer','frontend_engineer','cto']);
let status={agentReachReady:false,enabled:false,requests:[],channels:{}},query='',filter='All',pick=CATALOG[0].id,who='',channel='github',busy=false;
let publicStatus={providers:[],grants:[]},publicBusy=false;
const ZERO_KEY=[
 {id:'github-public',name:'GitHub public repositories',departments:['Technology','PMO','Marketing','Product']},
 {id:'frankfurter',name:'Frankfurter currency rates',departments:['Finance','Audit','Operations']},
 {id:'openfoodfacts',name:'Open Food Facts product barcodes',departments:['Operations','Product']}
];
function publicPanel(){
 const company=getCompany(),grants=publicStatus.grants.filter(g=>g.companyId===company);
 const eligible=members().filter(e=>ZERO_KEY.some(p=>p.departments.includes(B.roleFor(e)?.dept)));
 return '<section class="card" style="margin-bottom:15px"><div class="section-top"><h2>One-click · Free public API tools</h2><span class="ops-tag">'+(isLocal?grants.length+' employee/API permissions':'Mac setup required')+'</span></div>'+
 '<p class="notice">Three read-only services need no OAuth or API key. Activate them together for eligible employees on your Mac. Each permission is saved separately for that employee and provider. There is no access to private GitHub repositories, email, social accounts, payments or publishing.</p>'+
 '<div class="key-list">'+ZERO_KEY.map(p=>'<span class="pill-stat">'+E(p.name)+' · '+grants.filter(g=>g.provider===p.id).length+' grants</span>').join('')+'</div>'+
 (isLocal?'<p class="small muted">'+eligible.length+' active eligible specialists · '+grants.length+' recorded grants for this company. Access is off until you authorize it.</p>'+
 '<div class="inline-actions"><button type="button" class="btn btn-primary" data-public-action="enable"'+(eligible.length===0?' disabled':'')+'>✓ Enable free read-only APIs</button>'+
 '<button type="button" class="btn btn-sm" data-public-action="revoke"'+(grants.length===0?' disabled':'')+'>Revoke all free API permissions</button>'+
 '<button type="button" class="btn btn-sm" data-public-action="check">Check Mac connection</button></div>'+
 '<p class="tiny muted">After enabling, you can simply tell Company Messages: “Research GitHub repository public-apis/public-apis” or “Find the USD to EUR exchange rate” or “Look up food barcode 3017620422003.” A verified lookup is only used when an eligible authorized Mac agent drafts that assignment. Other requests still need the correct tools.</p>':
 '<p class="notice"><strong>Open this same Research section inside Office HQ on your Mac</strong> and select “Enable free read-only APIs.” Your iPhone cannot enable a local-only service while the Mac is offline. You can continue assigning tasks from Company Messages once your devices are paired.</p>')+
 '<p id="publicToolsNotice" class="tiny muted" aria-live="polite"></p></section>';
}
// Background connection checks must preserve an owner's unfinished review request.
function redrawResearch(){
 const fields=[...document.querySelectorAll('#researchApiForm [name],#reachResearchForm [name]')].map(el=>({form:el.form.id,name:el.name,value:el.value,focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd}));
 B.setView('research');
 for(const saved of fields){
  const form=document.getElementById(saved.form),field=form?.elements.namedItem(saved.name);if(!field)continue;
  if(field.tagName!=='SELECT'||[...field.options].some(o=>o.value===saved.value))field.value=saved.value;
  if(saved.focused){field.focus({preventScroll:true});if(Number.isInteger(saved.start)&&typeof field.setSelectionRange==='function')field.setSelectionRange(saved.start,saved.end);}
 }
}
async function refreshPublic(){
 if(!isLocal||publicBusy)return;
 publicBusy=true;
 try{const r=await fetch('/api/public-tools/status',{cache:'no-store'});if(!r.ok)throw Error('Mac public tools backend unavailable.');
 publicStatus=await r.json();
 if(location.hash.replace('#/','')==='research')redrawResearch();
 }catch(e){const n=$('#publicToolsNotice');if(n)n.textContent=String(e.message);}
 finally{publicBusy=false;}
}
async function publicAction(kind){
 if(!isLocal)throw Error('Open this page on the local Mac Office HQ server.');
 if(kind==='check'){await refreshPublic();return;}
 const company=getCompany(),existing=publicStatus.grants.filter(g=>g.companyId===company);
 const staff=members().filter(e=>ZERO_KEY.some(p=>p.departments.includes(B.roleFor(e)?.dept)));
 if(kind==='enable'){
  const expected=staff.reduce((sum,e)=>sum+ZERO_KEY.filter(p=>p.departments.includes(B.roleFor(e)?.dept)).length,0);
  if(!expected)throw Error('No eligible active employees found in this company.');
  if(!confirm('CEO authorization: enable ONLY public, read-only lookups across GitHub public repositories, Frankfurter exchange rates and Open Food Facts barcodes for '+staff.length+' eligible employees ('+expected+' employee/API permissions). Each worker receives only the matching department tools. No OAuth, passwords, private accounts, messages, purchases or publishing. Proceed?'))return;
 }else if(kind==='revoke'){
  if(!confirm('Revoke all '+existing.length+' free public API permissions for this company? Previously returned draft text will remain in your saved records.'))return;
 }else return;
 const body={action:kind==='enable'?'grant-batch':'revoke-company',companyId:company,ownerConfirmed:true};
 if(kind==='enable')body.employees=staff.map(e=>({employeeId:e.id,roleKey:e.roleKey}));
 const r=await fetch('/api/public-tools/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Could not update public API permissions.');
 await refreshPublic();
 const n=$('#publicToolsNotice');if(n)n.textContent=kind==='enable'?'Granted '+data.added+' new read-only employee/API permissions. Authorized agents can use the appropriate public APIs in drafts.':'Revoked '+data.revoked+' public API permissions.';
}
document.addEventListener('click',e=>{
 const a=e.target.closest?.('[data-public-action]');if(!a)return;
 e.preventDefault();void publicAction(a.dataset.publicAction).catch(err=>{const n=$('#publicToolsNotice');if(n)n.textContent=String(err.message).slice(0,220);});
});

const getCompany=()=>$('#companyPicker')?.value==='all'||!$('#companyPicker')?.value?B.getState().companies[0]?.id:$('#companyPicker').value;
const members=()=>B.getState().employees.filter(x=>x.active&&x.companyId===getCompany());
const compatible=entry=>members().filter(x=>entry.dept.includes(B.roleFor(x)?.dept));
const researcher=()=>members().filter(x=>RESEARCH_ROLES.has(x.roleKey));
function render(){
 const providers=CATALOG.filter(p=>(filter==='All'||p.type===filter)&&
  [p.name,p.type,p.about,p.auth].join(' ').toLowerCase().includes(query.toLowerCase()));
 const source=CATALOG.find(p=>p.id===pick)||CATALOG[0],agents=compatible(source);
 const experts=researcher();if(who&&!experts.some(x=>x.id===who))who='';
 if(!who)who=experts[0]?.id||'';
 const requests=(status.requests||[]).filter(x=>x.companyId===getCompany());
 return '<div class="page-head"><div class="eyebrow">OFFICE HQ · CURATED CAPABILITY DIRECTORY</div><h1>Agent Reach + Public APIs</h1>'+
 '<p class="muted">Discover external APIs, select an authorized specialist, and request CEO review. Public APIs is a directory, not a universal API key. Agent Reach is a local diagnostic/routing toolkit, not a blanket account authorization.</p></div>'+
 '<section class="card"><div class="section-top"><h2>Browse APIs and MCP connectors</h2><span class="ops-tag">'+CATALOG.length+' curated entries</span></div>'+
 '<p class="small muted">These entries were selected from the supplied Public APIs repository. Listings are informational; uptime, pricing, and current provider access must be verified individually.</p>'+
 '<div class="field-row"><div class="field"><label>Search API directory</label><input id="researchSearch" placeholder="Search APIs, tasks or departments" value="'+E(query)+'"></div>'+
 '<div class="field"><label>Category</label><select id="researchFilter">'+['All',...new Set(CATALOG.map(x=>x.type))].map(x=>'<option'+(x===filter?' selected':'')+'>'+E(x)+'</option>').join('')+'</select></div></div>'+
 '<div class="grid two-col">'+providers.map(p=>'<article class="card"><div class="section-top"><h3>'+E(p.name)+'</h3><span class="ops-tag">'+E(p.auth)+'</span></div>'+
 '<p>'+E(p.about)+'</p><p class="tiny muted">Relevant: '+E(p.dept.join(', '))+'</p>'+
 '<a class="btn btn-sm" href="'+E(p.url)+'" target="_blank" rel="noopener noreferrer">Read provider documentation ↗</a></article>').join('')+
 (providers.length?'':'<p class="muted">No matching entries. Change your search.</p>')+'</div></section>'+
 '<section class="card" style="margin-top:16px"><h2>Request a provider review for one employee</h2>'+
 '<p class="notice">This creates an internal CEO review card only. Approving it does not install anything, request OAuth scopes, share passwords, or activate an external action.</p>'+
 '<form id="researchApiForm"><div class="field"><label>API / MCP provider</label><select id="researchPick" name="provider">'+CATALOG.map(p=>'<option value="'+E(p.id)+'"'+(p.id===source.id?' selected':'')+'>'+E(p.name)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Specialist assigned to assess provider</label><select id="researchAssignee" name="employeeId" required>'+agents.map(e=>'<option value="'+E(e.id)+'">'+E(e.name)+' · '+E(B.roleFor(e)?.title)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Business purpose</label><textarea name="reason" rows="2" required maxlength="400" placeholder="Example: Evaluate read-only inventory information for a product launch"></textarea></div>'+
 '<button type="submit" class="btn btn-primary"'+(!agents.length?' disabled':'')+'>Send API evaluation to CEO</button></form></section>'+
 '<section class="card" style="margin-top:16px"><div class="section-top"><h2>Agent Reach — real local research</h2><button class="btn btn-sm" type="button" data-reach="refresh">↻ Check tools</button></div>'+
 (isLocal?'<p class="notice">Local diagnostic: <strong>'+(status.agentReachReady?'Agent Reach CLI responded':'Not detected / unavailable')+
 '</strong> · Research execution: <strong>'+(status.enabled?'Explicitly enabled':'Disabled')+'</strong>.</p>'+
 '<p class="tiny muted">The initial verified commands are public GitHub repository facts (gh CLI) and YouTube metadata (yt-dlp). No authentication sessions, login cookies, messages, uploads or browser control are included.</p>'+
 '<form id="reachResearchForm"><div class="field"><label>Employee requesting the research</label><select name="employeeId" id="reachEmployee">'+
 experts.map(e=>'<option value="'+E(e.id)+'"'+(e.id===who?' selected':'')+'>'+E(e.name)+' · '+E(B.roleFor(e)?.title)+'</option>').join('')+'</select></div>'+
 '<div class="field"><label>Allowed read-only channel</label><select name="channel" id="reachChannel"><option value="github"'+(channel==='github'?' selected':'')+'>GitHub · public repository</option><option value="youtube"'+(channel==='youtube'?' selected':'')+'>YouTube · public video</option></select></div>'+
 '<div class="field"><label>Public target</label><input name="target" id="reachTarget" maxlength="160" required placeholder="'+(channel==='github'?'owner/repository':'11-character YouTube video ID')+'"></div>'+
 '<div class="field"><label>Exact employee assignment / purpose</label><textarea name="purpose" required rows="2" maxlength="400" placeholder="Describe which business decision this research will inform."></textarea></div>'+
 '<button class="btn btn-primary" type="submit"'+(!experts.length?' disabled':'')+'>Request one-time CEO permission</button></form>'+
 '<h3 style="margin-top:20px">Pending, approved and completed requests</h3>'+
 (requests.length?requests.map(r=>'<article class="card" style="margin-top:10px"><div class="section-top"><strong>'+E(r.employeeName)+' · '+E(r.channel)+' · '+E(r.target)+'</strong><span class="ops-tag">'+E(r.status)+'</span></div>'+
 '<p>'+E(r.purpose)+'</p>'+
 (r.result?'<pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+E(JSON.stringify(r.result,null,2))+'</pre>':'')+
 (r.notice?'<p class="small muted">'+E(r.notice)+'</p>':'')+
 (r.status==='pending'?'<div class="inline-actions"><button class="btn btn-sm btn-primary" data-reach="approve" data-id="'+E(r.id)+'">CEO approve research</button><button class="btn btn-sm" data-reach="deny" data-id="'+E(r.id)+'">Deny</button></div>':'')+
 (r.status==='approved'?'<div class="inline-actions"><button class="btn btn-sm btn-primary" data-reach="run" data-id="'+E(r.id)+'"'+(!status.enabled?' disabled':'')+'>Run approved read-only lookup</button><button class="btn btn-sm" data-reach="revoke" data-id="'+E(r.id)+'">Revoke</button></div>':'')+
 '</article>').join(''):'<p class="muted">No local research requests yet.</p>')+
 '<p class="tiny muted">Tools run only on this computer, and only after CEO approval plus an explicit per-request Run. The approved request is consumed after one attempt.</p>'
 :'<p class="notice">GitHub Pages is a static Safari interface. Real Agent Reach diagnostic and research execution requires the optional Office HQ Node server on your computer, with Agent Reach and upstream CLI tools installed. There is no active account connection on this page.</p>'+
 '<p>See <a href="https://github.com/Hostkris/Office-HQ/blob/main/agent-office-hq/docs/AGENT_REACH_PUBLIC_APIS.md" target="_blank" rel="noopener">Local installation and safety guide ↗</a>.</p>')+
 '</section><p id="researchNotice" class="notice" role="status" aria-live="polite"></p>';
}
window.OfficeHQExtraViews.research=render;
function alertUser(msg,bad=false){const n=$('#researchNotice');if(n){n.textContent=msg;n.style.color=bad?'var(--red)':'var(--turq)';}else B.toast(msg,bad?'error':'ok');}
async function api(data){
 const res=await fetch('/api/research/action',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify(data)});
 const x=await res.json();if(!res.ok)throw Error(x.error||'Local research request failed.');return x;
}
async function refresh(){
 if(!isLocal||busy)return;
 busy=true;
 try{const r=await fetch('/api/research/status',{cache:'no-store'});if(!r.ok)throw Error('Research backend unavailable.');
 status=await r.json();await refreshPublic();if(location.hash.replace('#/','')==='research')redrawResearch();}
 catch(e){alertUser(e.message,true)}finally{busy=false}
}
async function action(type,id){
 if(type==='refresh')return refresh();
 const selected=(status.requests||[]).find(r=>r.id===id&&r.companyId===getCompany());
 if(!selected)throw Error('Select a request in the active company.');
 if(type==='approve'&&!confirm('Approve ONE public '+selected.channel+' research lookup by '+selected.employeeName+'? This does not permit account login, publishing or private data access.'))return;
 if(type==='run'&&!confirm('Run the approved public '+selected.channel+' lookup on your own computer now?'))return;
 if(type==='deny'||type==='revoke')if(!confirm('Confirm '+type+' for this research request?'))return;
 await api({action:type,companyId:getCompany(),requestId:selected.id,ownerConfirmed:true});
 await refresh();alertUser(type==='run'?'Real read-only research attempt finished. Review the reported result.':'CEO decision saved. No account access was granted.');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-reach]');if(!b)return;e.preventDefault();void action(b.dataset.reach,b.dataset.id).catch(x=>alertUser(x.message,true));});
document.addEventListener('input',e=>{
 if(e.target.id==='researchSearch'){query=e.target.value;B.setView('research');$('#researchSearch')?.focus();}
});
document.addEventListener('change',e=>{
 if(e.target.id==='researchFilter'){filter=e.target.value;B.setView('research');}
 if(e.target.id==='researchPick'){pick=e.target.value;B.setView('research');}
 if(e.target.id==='reachEmployee')who=e.target.value;
 if(e.target.id==='reachChannel'){channel=e.target.value;B.setView('research');}
});
document.addEventListener('submit',e=>{
 if(e.target.id==='researchApiForm'){
  e.preventDefault();const f=new FormData(e.target),p=CATALOG.find(item=>item.id===String(f.get('provider')||pick));
  const employee=members().find(w=>w.id===f.get('employeeId')&&p?.dept.includes(B.roleFor(w)?.dept));
  const reason=String(f.get('reason')||'').trim();
  if(!employee||reason.length<12){alertUser('Select a valid specialist and explain the evaluation.',true);return;}
  const approval={id:B.uid('approve'),companyId:getCompany(),kind:'api_discovery',employeeId:employee.id,
   title:'Evaluate '+p.name+' for Office HQ',note:'CEO approval for DOCUMENTATION REVIEW ONLY. Employee: '+employee.name+
     '. Purpose: '+reason+'. Provider: '+p.url+'. No authentication, OAuth, API key, installation, execution or account authorization is included.',
   status:'pending',createdAt:new Date().toISOString()};
  B.getState().approvals.unshift(approval);B.addActivity(employee.name,'Requested CEO review of '+p.name+' documentation. No connection made.','approval',getCompany());
  B.save();B.setView('research');alertUser('API evaluation sent to CEO Approvals. Nothing has been connected.');return;
 }
 if(e.target.id==='reachResearchForm'){
  e.preventDefault();const f=new FormData(e.target),w=members().find(w=>w.id===f.get('employeeId'));
  if(!w||!RESEARCH_ROLES.has(w.roleKey)){alertUser('Select an eligible specialist.',true);return;}
  const data={action:'request',companyId:getCompany(),employeeId:w.id,employeeName:w.name,
   roleKey:w.roleKey,department:B.roleFor(w)?.dept,channel:String(f.get('channel')),target:String(f.get('target')),
   purpose:String(f.get('purpose'))};
  void api(data).then(refresh).then(()=>alertUser('Research permission requested. A separate CEO approval is needed before running.'))
    .catch(err=>alertUser(err.message,true));return;
 }
});
setTimeout(()=>{if(isLocal)void refresh();},500);
if(location.hash.replace('#/','')==='research')B.setView('research');
})();

