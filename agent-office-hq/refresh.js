/* Refresh the installed website without removing the iPhone Home Screen shortcut.
   Workspace information is stored separately in localStorage and is not cleared. */
(()=>{
  'use strict';
  const button=document.getElementById('appRefreshBtn');
  const status=document.getElementById('appRefreshStatus');
  if(!button||!status)return;
  let working=false;
  const say=(s)=>{status.textContent=s;};
  async function fetchLatest(path){
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),9000);
    try{
      const url=new URL(path,document.baseURI);
      const response=await fetch(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Error('HTTP '+response.status);
      await response.arrayBuffer();
    }finally{clearTimeout(timeout);}
  }
  button.addEventListener('click',async()=>{
    if(working)return;
    working=true;
    button.disabled=true;
    button.setAttribute('aria-busy','true');
    say('Checking for updates…');
    try{
      if(navigator.onLine===false)throw Error('No network connection');
      // Fetch actual production assets. This triggers our network-first
      // service worker to update cached copies when internet is available.
      await Promise.all(['./index.html','./cloud.html','./cloud.js','./app.js','./office-features.js','./integration-center.js','./desktop-workstations.js','./ios-workstations.js','./styles.css'].map(fetchLatest));
      if('serviceWorker' in navigator){
        try{
          const registration=await navigator.serviceWorker.getRegistration();
          if(registration){
            await Promise.race([registration.update(),new Promise(resolve=>setTimeout(resolve,5000))]);
            if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_NOW'});
          }
        }catch(error){console.info('Service worker refresh check:',error);}
      }
      say('Reloading latest available version…');
      // Reload rather than clear storage, so company records and approvals persist.
      window.location.reload();
    }catch(error){
      say('Could not check updates. Check your connection and try again.');
      working=false;
      button.disabled=false;
      button.removeAttribute('aria-busy');
    }
  });
})();
