/* Startup recovery. Never reset a workspace to repair a missing app file. */
(()=>{
 'use strict';
 const failures=new Set();
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 window.OfficeHQBuild='20261021-mac-repair-41';
 window.addEventListener('error',event=>{
  const file=event.target?.src||event.target?.href||event.filename;
  if(!file)return;
  try{const url=new URL(file,document.baseURI);if(url.origin===location.origin)failures.add(url.pathname.split('/').pop());}catch{}
 },true);
 function recover(){
  const view=document.getElementById('view');if(!view)return;
  const bridge=window.OfficeHQBridge;
  const route=location.hash.replace('#/','')||'command';
  const expected={access:'website-access.js',coding:'coding-tasks.js',thread:'ceo-secure-chat.js'};
  const missing=!bridge||!view.textContent.trim()||view.querySelector('[data-hq-starting]')||
   (expected[route]&&typeof window.OfficeHQExtraViews?.[route]!=='function')||
   (route==='thread'&&!window.OfficeHQSecureChat);
  if(!missing)return;
  if(!bridge)failures.add('app.js or one of its required files');
  if(expected[route])failures.add(expected[route]);
  const retry=new URL('./index.html',document.baseURI);retry.searchParams.set('hq_retry',String(Date.now()));retry.hash='#/'+route;
  view.innerHTML='<section class="card hq-unavailable-view" role="alert"><div class="eyebrow">OFFICE HQ · STARTUP CHECK</div><h1>Office HQ could not finish loading</h1><p>Your saved workspace has not been reset. Some app files are missing or could not start.</p>'+
   (failures.size?'<p>Files to check: '+[...failures].map(escape).join(', ')+'.</p>':'')+
   '<p>On your Mac, open the latest Office HQ installer and choose Update Office HQ. A browser refresh alone cannot replace old files on the Mac.</p><div class="inline-actions"><a class="btn btn-primary" href="'+escape(retry.href)+'">Retry loading</a><a class="btn" href="./mac.html">Mac update instructions</a></div></section>';
 }
 async function retireLocalCache(){
  if(!['127.0.0.1','localhost'].includes(location.hostname)||!navigator.serviceWorker?.getRegistrations)return;
  try{
   const scope=new URL('./',document.baseURI).href;
   const registrations=await navigator.serviceWorker.getRegistrations();
   // Only this app's exact local scope. IndexedDB and localStorage are untouched.
   await Promise.allSettled(registrations.filter(r=>r.scope===scope&&
    [r.active,r.waiting,r.installing].some(w=>w&&new URL(w.scriptURL).pathname===new URL('./sw.js',scope).pathname))
    .map(r=>r.unregister()));
  }catch{} // A restricted browser can still load the app directly from the Mac.
 }
 function ready(){recover();void retireLocalCache();}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
