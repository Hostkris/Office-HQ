const CACHE='agent-office-hq-v19';const FILES=['./','./index.html','./cloud.html','./cloud.js','./assignment-library.js','./app.js','./office-features.js','./project-floor.js','./office-life.js','./department-offices.js','./deliverables.js','./integration-center.js','./desktop-workstations.js','./ios-workstations.js','./refresh.js','./theme.js','./styles.css','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);const allowed=new Set(FILES.map(p=>new URL(p,self.registration.scope).pathname));if(event.request.method!=='GET'||u.origin!==self.location.origin||!allowed.has(u.pathname))return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy))}return response}).catch(()=>caches.match(event.request)))});

// Allow the user-initiated Refresh App action to activate a waiting update.
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_NOW')self.skipWaiting()});
