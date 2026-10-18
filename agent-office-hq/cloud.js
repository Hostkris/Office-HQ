/* Office-HQ secure cloud client: publishable key only; no service-role or private credentials.
   This cloud workspace is intentionally separate from the browser-only animated office. */
(()=>{
'use strict';
const PROJECT_URL='https://wvadoqncgrmfsftefuoy.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_c3owfootc_qRwCN7v3Q24Q_GKB8PIjK';
const STORE='office_hq_cloud_session_v1';
const root=document.getElementById('cloudRoot'),notice=document.getElementById('notice');
const state={session:null,user:null,companies:[],tasks:[],approvals:[],messages:[],company:null,tab:'companies',busy:false};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=s=>new Date(s).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const msg=(text,bad=false)=>{notice.textContent=text;notice.className=bad?'notice error':'notice';};
function storeSession(s){
  state.session=s?.access_token?{access_token:s.access_token,refresh_token:s.refresh_token,expires_at:Date.now()+Math.max(30,Number(s.expires_in||3600))*1000}:null;
  if(state.session)sessionStorage.setItem(STORE,JSON.stringify(state.session));
  else sessionStorage.removeItem(STORE);
}
async function jsonFetch(url,options={}){
  const response=await fetch(url,{...options,headers:{apikey:PUBLISHABLE_KEY,...(options.headers||{})},cache:'no-store'});
  let payload;try{payload=await response.json()}catch{payload={}};
  if(!response.ok)throw Error(payload.msg||payload.message||payload.error_description||payload.error||('Service error '+response.status));
  return payload;
}
async function refresh(){
  if(!state.session?.refresh_token)throw Error('Sign in again.');
  const data=await jsonFetch(PROJECT_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:state.session.refresh_token})});
  storeSession(data);
}
async function access(){
  if(!state.session)throw Error('Sign in to use Cloud HQ.');
  if(Date.now()>=state.session.expires_at-45000)await refresh();
  return state.session.access_token;
}
async function authUser(){
  const token=await access();
  return jsonFetch(PROJECT_URL+'/auth/v1/user',{headers:{Authorization:'Bearer '+token}});
}
async function authRequest(path,body){
  return jsonFetch(PROJECT_URL+'/auth/v1/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
}
async function rest(table,method='GET',body=null,query=''){
  const token=await access();
  const headers={Authorization:'Bearer '+token};
  if(body!==null){headers['Content-Type']='application/json';headers.Prefer='return=representation';}
  return jsonFetch(PROJECT_URL+'/rest/v1/'+table+query,{method,headers,body:body===null?undefined:JSON.stringify(body)});
}
const companyOptions=()=>state.companies.map(c=>'<option value="'+escape(c.id)+'" '+(state.company===c.id?'selected':'')+'>'+escape(c.name)+'</option>').join('');
const activeCompany=()=>state.companies.find(c=>c.id===state.company);
function authView(){
  root.innerHTML='<div class="cards auth"><section class="card"><h2>Sign in</h2><p class="muted small">Use your Office-HQ cloud email and password. Supabase securely authenticates you.</p><form id="cloudLogin" class="stack"><div><label>Email</label><input name="email" type="email" required autocomplete="email"></div><div><label>Password</label><input name="password" type="password" required autocomplete="current-password" minlength="6"></div><button type="submit">Sign in</button></form></section><section class="card"><h2>Create an account</h2><p class="muted small">This creates a Supabase Auth account. You may need to confirm your email before signing in.</p><form id="cloudSignUp" class="stack"><div><label>Email</label><input name="email" type="email" required autocomplete="email"></div><div><label>Password (8+ characters)</label><input name="password" type="password" required autocomplete="new-password" minlength="8"></div><button type="submit" class="secondary">Create account</button></form><hr><p class="small muted">Site owner: before email sign-up, allow this Cloud HQ URL in Supabase <a target="_blank" rel="noopener noreferrer" href="https://supabase.com/dashboard/project/wvadoqncgrmfsftefuoy/auth/url-configuration">Auth → URL Configuration</a>, including its redirect URL. Otherwise confirmation may lead to the default localhost address.</p></section></div>';
}
function homeView(){
 const c=activeCompany(),tab=state.tab;
 root.innerHTML='<div class="row"><p class="muted">Signed in: <strong>'+escape(state.user.email||'Account')+'</strong></p><button class="secondary" type="button" data-cloud="logout">Sign out</button></div>'+
 '<div class="tabs" role="tablist" aria-label="Cloud HQ sections">'+['companies','tasks','approvals','messages','services'].map(x=>'<button type="button" role="tab" aria-selected="'+(tab===x)+'" data-tab="'+x+'">'+({companies:'Companies',tasks:'Tasks',approvals:'CEO approvals',messages:'Messages',services:'Service signup links'}[x])+'</button>').join('')+'</div>'+
 (tab==='companies'?companyPanel():tab==='tasks'?tasksPanel(c):tab==='approvals'?approvalsPanel(c):tab==='messages'?messagesPanel(c):servicesPanel())+
 '<p class="small muted" style="margin-top:22px">Data in this area is stored in Supabase with owner-level security. The original Office-HQ dashboard still runs locally. Cloud approvals are records only; they do not authorize purchases or access third-party accounts.</p>';
}
function companyPanel(){
 return '<div class="cards"><section class="card"><h2>Create company</h2><form class="stack" id="cloudCompanyForm"><div><label>Company name</label><input name="name" required maxlength="100" placeholder="Your business name"></div><div><label>Industry</label><input name="industry" maxlength="100" placeholder="General business"></div><button>Create company</button></form></section><section class="card"><h2>Your private companies</h2>'+(state.companies.length?state.companies.map(c=>'<div class="item row"><div><strong>'+escape(c.name)+'</strong><div class="muted small">'+escape(c.industry)+'</div></div><button class="secondary" data-company="'+escape(c.id)+'">Open</button></div>').join(''):'<p class="muted">No companies yet. Create one to begin.</p>')+'</section></div>';
}
function chooseCompany(){return state.companies.length?'<div class="row card" style="margin-bottom:16px"><label for="cloudCompanyPicker">Company</label><select id="cloudCompanyPicker" style="max-width:350px">'+companyOptions()+'</select></div>':'';}
function tasksPanel(c){
 if(!c)return '<p class="banner">Create a company first to assign cloud tasks.</p>';
 return chooseCompany()+'<div class="cards"><section class="card"><h2>New task</h2><form class="stack" id="cloudTaskForm"><div><label>Task title</label><input name="title" required maxlength="140"></div><div><label>Specialty / job</label><input name="role_scope" maxlength="100" value="operations" required></div><div><label>Instructions</label><textarea name="description" maxlength="2000"></textarea></div><button>Add task</button></form><p class="muted small">A stored task is not an autonomous agent run. AI execution is not connected yet.</p></section><section class="card"><h2>Task board</h2>'+(state.tasks.length?state.tasks.map(t=>'<div class="item"><strong>'+escape(t.title)+'</strong> <span class="pill">'+escape(t.status)+'</span><p class="muted small">'+escape(t.role_scope)+' · '+escape(t.description)+'</p><div class="row"><small>'+date(t.created_at)+'</small><select aria-label="Task status" data-task="'+escape(t.id)+'" style="max-width:180px">'+['queued','in_progress','review','blocked','done'].map(s=>'<option value="'+s+'" '+(t.status===s?'selected':'')+'>'+s.replaceAll('_',' ')+'</option>').join('')+'</select></div></div>').join(''):'<p class="muted">No cloud tasks yet.</p>')+'</section></div>';
}
function approvalsPanel(c){
 if(!c)return '<p class="banner">Create a company first.</p>';
 return chooseCompany()+'<div class="cards"><section class="card"><h2>New approval request</h2><form id="cloudApprovalForm" class="stack"><div><label>Request title</label><input name="title" maxlength="140" required></div><div><label>Reason</label><textarea name="detail" maxlength="2000"></textarea></div><div><label>Proposed budget ($, optional)</label><input name="amount" type="number" min="0" max="9999999999" step="0.01"></div><button>Submit for CEO review</button></form></section><section class="card"><h2>CEO decisions</h2>'+(state.approvals.length?state.approvals.map(a=>'<div class="item"><strong>'+escape(a.title)+'</strong> <span class="pill">'+escape(a.status)+'</span><p class="muted">'+escape(a.detail)+(a.requested_amount!==null?' · Proposed $'+escape(a.requested_amount):'')+'</p>'+(a.status==='pending'?'<div class="links"><button data-decision="approved" data-id="'+escape(a.id)+'">Approve record</button><button class="danger" data-decision="rejected" data-id="'+escape(a.id)+'">Reject record</button></div>':'')+'</div>').join(''):'<p class="muted">No requests.</p>')+'</section></div>';
}
function messagesPanel(c){
 if(!c)return '<p class="banner">Create a company first.</p>';
 return chooseCompany()+'<div class="cards"><section class="card"><h2>CEO company thread</h2><form class="stack" id="cloudMessageForm"><div><label>Message</label><textarea name="body" maxlength="1600" required placeholder="Give instructions or record a decision"></textarea></div><button>Post internal message</button></form><p class="small muted">This is an in-app message record, not an SMS to your mobile number.</p></section><section class="card"><h2>Cloud messages</h2>'+(state.messages.length?state.messages.map(m=>'<div class="item"><strong>'+escape(m.sender)+'</strong> <small class="muted">'+date(m.created_at)+'</small><p>'+escape(m.body)+'</p></div>').join(''):'<p class="muted">No messages yet.</p>')+'</section></div>';
}
function servicesPanel(){
 const links=[['Supabase backend','https://supabase.com/dashboard/project/wvadoqncgrmfsftefuoy'],['Google Cloud / Gmail','https://console.cloud.google.com/'],['Meta for Developers','https://developers.facebook.com/'],['Shopify Partners','https://partners.shopify.com/'],['YouTube / Google API','https://console.cloud.google.com/apis/library/youtube.googleapis.com'],['TikTok Developers','https://developers.tiktok.com/'],['OpenAI API','https://platform.openai.com/'],['Twilio messaging','https://console.twilio.com/']];
 return '<section class="card"><h2>Service setup and sign-in websites</h2><p class="muted">These open the real provider portals for registering or authorizing an app. They do <strong>not</strong> connect an account just by opening a link. Once credentials and official OAuth workflows are configured securely server-side, specific agents can request access.</p><div class="links">'+links.map(x=>'<a href="'+x[1]+'" target="_blank" rel="noopener noreferrer">'+escape(x[0])+' ↗</a>').join('')+'</div><hr><p class="small muted">Never paste OAuth client secrets, service-role keys, card details, or passwords into Office-HQ, GitHub, or task messages.</p></section>';
}
async function reload(){
 if(!state.user)return;
 state.companies=await rest('hq_companies','GET',null,'?select=id,name,industry,created_at&order=created_at.desc&limit=100');
 if(!state.companies.some(c=>c.id===state.company))state.company=state.companies[0]?.id||null;
 const where=state.company?'&company_id=eq.'+encodeURIComponent(state.company):'';
 if(state.company){
  const [tasks,approvals,messages]=await Promise.all([
   rest('hq_tasks','GET',null,'?select=id,title,description,role_scope,status,created_at&order=created_at.desc&limit=100'+where),
   rest('hq_approvals','GET',null,'?select=id,title,detail,requested_amount,status,created_at&order=created_at.desc&limit=100'+where),
   rest('hq_messages','GET',null,'?select=id,sender,body,created_at&order=created_at.desc&limit=100'+where)]);
  Object.assign(state,{tasks,approvals,messages});
 }else Object.assign(state,{tasks:[],approvals:[],messages:[]});
 homeView();
}
async function signOut(){
 try{if(state.session)await jsonFetch(PROJECT_URL+'/auth/v1/logout',{method:'POST',headers:{Authorization:'Bearer '+await access()}})}catch{}
 storeSession(null);state.user=null;state.company=null;authView();msg('Signed out of Cloud HQ.');
}
async function guard(fn){
 if(state.busy)return;
 state.busy=true;
 try{await fn()}catch(e){msg(e.message||'Request could not be completed.',true)}
 finally{state.busy=false}
}
document.addEventListener('submit',e=>{
 const f=e.target;if(!/^cloud(Login|SignUp|CompanyForm|TaskForm|ApprovalForm|MessageForm)$/.test(f.id))return;
 e.preventDefault();const p=Object.fromEntries(new FormData(f));
 guard(async()=>{
  if(f.id==='cloudLogin'){
   const s=await authRequest('token?grant_type=password',{email:p.email,password:p.password});
   storeSession(s);state.user=await authUser();state.tab='companies';msg('Secure sign-in successful.');await reload();return;
  }
  if(f.id==='cloudSignUp'){
   const redirect=window.location.origin+window.location.pathname;
   const data=await authRequest('signup?redirect_to='+encodeURIComponent(redirect),{email:p.email,password:p.password});
   if(data.access_token){storeSession(data);state.user=await authUser();msg('Account created and signed in.');await reload();}
   else msg('Account submitted. Check your email to confirm, then come back and sign in. Check Supabase Auth URL Configuration if the confirmation link opens localhost.');
   return;
  }
  if(!state.user)throw Error('Please sign in.');
  if(f.id==='cloudCompanyForm'){await rest('hq_companies','POST',{name:p.name.trim(),industry:p.industry.trim()||'General business'});state.tab='companies';msg('Company saved securely.');}
  if(f.id==='cloudTaskForm'){await rest('hq_tasks','POST',{company_id:state.company,title:p.title.trim(),description:p.description.trim(),role_scope:p.role_scope.trim()||'operations'});msg('Task saved in Supabase. No agent action has been performed.');}
  if(f.id==='cloudApprovalForm'){await rest('hq_approvals','POST',{company_id:state.company,title:p.title.trim(),detail:p.detail.trim(),requested_amount:p.amount===''?null:Number(p.amount)});msg('Approval request saved for CEO review.');}
  if(f.id==='cloudMessageForm'){await rest('hq_messages','POST',{company_id:state.company,body:p.body.trim(),sender:'CEO'});msg('Internal company message saved (not SMS).');}
  await reload();
 });
});
document.addEventListener('click',e=>{
 const tab=e.target.closest('[data-tab]'),c=e.target.closest('[data-company]'),op=e.target.closest('[data-cloud]'),decision=e.target.closest('[data-decision]');
 if(tab){state.tab=tab.dataset.tab;homeView();}
 if(c){state.company=c.dataset.company;state.tab='tasks';guard(reload);}
 if(op?.dataset.cloud==='logout')guard(signOut);
 if(decision)guard(async()=>{
  const id=decision.dataset.id,requested=decision.dataset.decision;
  const item=state.approvals.find(x=>x.id===id);
  if(!item||item.status!=='pending')throw Error('Request is no longer pending.');
  await rest('hq_approvals','PATCH',{status:requested,decided_at:new Date().toISOString()},'?id=eq.'+encodeURIComponent(id)+'&status=eq.pending');
  msg('Decision recorded only. No purchase or external access was executed.');await reload();
 });
});
document.addEventListener('change',e=>{
 if(e.target.id==='cloudCompanyPicker'){state.company=e.target.value;guard(reload);}
 if(e.target.dataset.task)guard(async()=>{
  await rest('hq_tasks','PATCH',{status:e.target.value,updated_at:new Date().toISOString()},'?id=eq.'+encodeURIComponent(e.target.dataset.task));
  msg('Task status saved in Supabase.');await reload();
 });
});
(async()=>{
 try{
  const fragment=new URLSearchParams(location.hash.startsWith('#')?location.hash.slice(1):'');
  if(fragment.has('access_token')&&fragment.has('refresh_token')){
   storeSession({access_token:fragment.get('access_token'),refresh_token:fragment.get('refresh_token'),expires_in:Number(fragment.get('expires_in')||3600)});
   history.replaceState(null,'',location.pathname+location.search);msg('Email confirmation received.');
  }
  if(fragment.has('error_description')){msg(fragment.get('error_description'),true);history.replaceState(null,'',location.pathname+location.search)}
  const saved=sessionStorage.getItem(STORE);
  if(!state.session&&saved){try{state.session=JSON.parse(saved)}catch{storeSession(null)}}
  if(!state.session){authView();return}
  try{state.user=await authUser();await reload();msg('Cloud HQ connected securely.');}
  catch{storeSession(null);authView();msg('Your session expired. Please sign in again.',true);}
 }catch(e){authView();msg(e.message,true);}
})();
})();