/* Office HQ PWA offline cache — versioned for iPhone/iPad and desktop.
 * Online requests always prefer published files rather than older cached HTML.
 * A URL's refresh query is ignored in the offline cache key, never in its network request.
 */
const CACHE='agent-office-hq-v38-mini-pixel-workforce';
const PREFIX='agent-office-hq-v';
const FILES=['./','./index.html','./cloud.html','./cloud.js','./assignment-library.js','./workforce-lean.js','./app.js','./office-features.js','./mac.html','./mac-share.js','./officehq-voice.js','./officehq-voice.css','./ceo-secure-chat.js','./ceo-secure-chat.css','./officehq-device-sync.js','./officehq-sync.css','./project-floor.js','./office-life.js','./department-offices.js','./deliverables.js','./integration-center.js','./department-access.js','./department-projects.js','./department-ui.css','./agent-health.js','./website-access.js','./website-access.css','./coding-tasks.js','./coding-tasks.css','./desktop-workstations.js','./openmausbot.js','./workforce-runtime.js','./research-center.js','./ios-workstations.js','./refresh.js','./theme.js','./styles.css','./icon.svg','./manifest.webmanifest'];
const allowed=new Set(FILES.map(p=>new URL(p,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil(
 caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
 caches.keys().then(keys=>Promise.all(
  keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k))
 )).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
 const request=event.request,uri=new URL(request.url);
 if(request.method!=='GET'||uri.origin!==self.location.origin||!allowed.has(uri.pathname))return;
 // Canonical cache key: a fresh hq_refresh query should not break offline fallback.
 const key=new Request(uri.origin+uri.pathname);
 event.respondWith(
  fetch(request,{cache:'no-store'}).then(response=>{
   if(response.ok){
    const copy=response.clone();
    event.waitUntil(caches.open(CACHE).then(cache=>cache.put(key,copy)).catch(()=>{}));
   }
   return response;
  }).catch(async()=>{
   const stored=await caches.match(key);
   return stored||Response.error();
  })
 );
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_NOW')event.waitUntil(self.skipWaiting());
});

