/* Office HQ manual refresh for Safari, iPhone/iPad Home Screen apps and Mac.
   A refresh checks the live shell, updates the service worker when possible and
   reloads the current page with a unique URL. Never remove local workspace data. */
(()=>{
 'use strict';
 const button=document.getElementById('appRefreshBtn');
 const status=document.getElementById('appRefreshStatus');
 if(!button||!status)return;

 let running=false;
 const say=message=>{status.textContent=message;};
 const timeLimit=(promise,ms)=>{
   let timer;
   return Promise.race([
     Promise.resolve(promise),
     new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Update timed out')),ms);})
   ]).finally(()=>clearTimeout(timer));
 };
 async function checkPublishedApp(){
   // sw.js is intentionally excluded from the SW cache allowlist, so this is
   // an actual network check even when Safari incorrectly reports online.
   const probe=new URL('./sw.js',document.baseURI);
   probe.searchParams.set('hq_probe',String(Date.now()));
   const probeController=new AbortController();
   const probeTimer=setTimeout(()=>probeController.abort(),8000);
   try{
     const probeResult=await fetch(probe.href,{cache:'no-store',signal:probeController.signal});
     if(!probeResult.ok)throw Error('Cannot reach the published version');
     const source=await probeResult.text();
     if(!source.includes("agent-office-hq-v")||!source.includes("addEventListener('fetch'")){
       throw Error('The published update manifest was not recognized.');
     }
   }finally{clearTimeout(probeTimer);}
   const url=new URL('./index.html',document.baseURI);
   url.searchParams.set('hq_check',String(Date.now()));
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),10000);
   try{
     // Query string defeats cached/old Home Screen app HTML; local data is untouched.
     const result=await fetch(url.href,{cache:'no-store',signal:controller.signal});
     if(!result.ok)throw Error('Published app unavailable (HTTP '+result.status+')');
     const html=await result.text();
     if(!html.includes('id="appRefreshBtn"')||!html.includes('src="refresh.js')){
       throw Error('The online app did not return the expected Office HQ page.');
     }
   }finally{clearTimeout(timer);}
 }
 async function refreshWorker(){
   if(!('serviceWorker' in navigator))return;
   const sw=navigator.serviceWorker;
   let registration;
   try{registration=await timeLimit(sw.getRegistration(),3500);}
   catch{return;} // Browsers may restrict service-worker access in private mode.
   if(!registration)return; // Network refresh still works without a registered worker.
   // Waiting SWs must activate before navigation when possible. New versions
   // call skipWaiting themselves; older versions respond to ACTIVATE_NOW.
   let changed=false;
   const onChange=()=>{changed=true;};
   sw.addEventListener?.('controllerchange',onChange);
   try{
     try{await timeLimit(registration.update(),6000);}
     catch(error){console.info('Office HQ: service-worker update unavailable:',error);}
     if(registration.waiting){
       registration.waiting.postMessage({type:'ACTIVATE_NOW'});
     }
     if(!changed){
       // Give an activated worker a moment to claim this PWA's page before reload.
       await timeLimit(new Promise(resolve=>{
         if(changed){resolve();return;}
         const handler=()=>{sw.removeEventListener?.('controllerchange',handler);resolve();};
         sw.addEventListener?.('controllerchange',handler,{once:true});
         setTimeout(()=>{sw.removeEventListener?.('controllerchange',handler);resolve();},1400);
       }),1700).catch(()=>{});
     }
   }finally{sw.removeEventListener?.('controllerchange',onChange);}
 }
 async function refresh(){
   if(running)return;
   running=true;
   button.disabled=true;
   button.setAttribute('aria-busy','true');
   const priorLabel=button.innerHTML;
   button.textContent='↻ Refreshing…';
   say('Checking the published app…');
   try{
     if(navigator.onLine===false)throw Error('Offline — connect to the internet and try again.');
     await checkPublishedApp();
     say('Updating app files…');
     await refreshWorker();
     say('Opening the updated app…');
     // A plain reload can reuse an old iOS Safari page; a query-stamped
     // navigation requests fresh HTML and scripts, preserving #/thread etc.
     const next=new URL(window.location.href);
     next.searchParams.set('hq_refresh',String(Date.now()));
     // Keep hash routes, paths, and all unrelated query parameters untouched.
     window.location.replace(next.href);
   }catch(error){
     say(error.message?.startsWith('Offline')?error.message:
       'Update could not be verified. Your data is safe. Check your connection and retry.');
     button.disabled=false;
     button.removeAttribute('aria-busy');
     button.innerHTML=priorLabel;
     running=false;
   }
 }
 button.addEventListener('click',refresh);
})();
