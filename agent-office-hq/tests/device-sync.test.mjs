import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const [client,worker,native,server,styles,html,features]=await Promise.all([
 '../officehq-device-sync.js','../device-sync/mac-worker.mjs','../native-engine/bridge.mjs',
 '../server.mjs','../officehq-sync.css','../index.html','../office-features.js'
].map(p=>readFile(new URL(p,import.meta.url),'utf8')));
function ui(){
 const storage=()=>({getItem:()=>null,setItem:()=>{},removeItem:()=>{}});
 const doc={readyState:'loading',addEventListener:()=>{},querySelectorAll:()=>[],querySelector:()=>null};
 const window={OfficeHQBridge:null,addEventListener:()=>{}};
 const navigator={onLine:true};
 vm.runInNewContext(client,{document:doc,window,navigator,location:{hostname:'hostkris.github.io'},
   localStorage:storage(),sessionStorage:storage(),crypto:{randomUUID:()=> '01234567-1234-4567-99aa-12345678abcd'},
   Date,URL,Promise,console,setTimeout,clearTimeout,FormData,CustomEvent:class {},
   setInterval:()=>{},queueMicrotask,fetch:()=>{throw Error('No public sync endpoint')}});
 return window.OfficeHQDeviceSync;
}
test('Mac/iOS signal bars are crossed out until recent verified two-way sync',()=>{
 const s=ui(),body=s.markup(false);
 assert.match(body,/hq-sync-bars/);
 assert.equal((body.match(/<i><\/i>/g)||[]).length,4);
 assert.match(body,/hq-sync-x">×/);
 assert.match(body,/Not synced/);
 const now=Date.now(),stamp=new Date(now-5000).toISOString();
 const good={connected:true,authenticated:true,paired:true,peerOnline:true,bidirectional:true,
   peerDevice:'mac',lastInboundAck:stamp,lastOutboundAck:stamp};
 assert.equal(s.verified(good,now),true);
 assert.equal(s.verified({...good,paired:false},now),false);
 assert.equal(s.verified({...good,authenticated:false},now),false);
 assert.equal(s.verified({...good,bidirectional:false},now),false);
 assert.equal(s.verified({...good,lastInboundAck:new Date(now-120000).toISOString()},now),false);
 assert.match(styles,/\.hq-device-sync\.is-connected \.hq-sync-bars>i\{background:#159167;opacity:1\}/);
 assert.match(styles,/\.hq-device-sync\.is-connected \.hq-sync-x\{display:none\}/);
});
test('GitHub Pages cannot impersonate Mac service; sync uses Supabase owner authentication',()=>{
 assert.match(client,/auth\/v1\/token\?grant_type=password/);
 assert.match(client,/hq_device_synced_assignments/);
 assert.match(client,/hq_device_sync_presence/);
 assert.match(client,/owner_confirmed:true/);
 assert.match(client,/OfficeHQDeviceSync=\{markup,draw,refresh/);
 assert.match(client,/sessionStorage\.setItem/);
 assert.doesNotMatch(client,/const\s+(?:SERVICE_ROLE|SERVICE_KEY|SECRET_KEY)\s*=/i);
});
test('Mac background worker is separate from Safari session and requires employee grants',()=>{
 assert.match(worker,/auth\/v1\/token\?grant_type=password/);
 assert.match(worker,/refresh_token/);
 assert.match(worker,/0o600/);
 assert.match(worker,/ownerConfirmed!==true/);
 assert.match(worker,/mappings\.find/);
 assert.match(worker,/bridge\.action\(\{action:'send'/);
 assert.match(worker,/status:'review'/);
 assert.match(worker,/await processQueue\(\);await reportJobs\(\)/);
 assert.doesNotMatch(worker,/service_role|execute\(.*shell/);
});
test('Independent Ollama bridge is local, draft-only and never uses OpenMausBot CLI',()=>{
 assert.match(native,/127\.0\.0\.1:11434\/api\/chat/);
 assert.match(native,/role:'system'/);
 assert.match(native,/externalActions:false/);
 assert.match(native,/allowSending:false/);
 assert.match(native,/ownerConfirmed!==true/);
 assert.doesNotMatch(native,/spawn\(|from\s+['\"]\.\.\/openmaus\/bridge/);
 assert.match(server,/from '\.\/native-engine\/bridge\.mjs'/);
 assert.match(server,/createMacSyncService/);
 assert.match(server,/\/api\/device-sync\/action/);
});
test('Signal is visible in both full company thread and mobile phone drawer',()=>{
 assert.match(features,/OfficeHQDeviceSync\?\.markup\(false\)/);
 assert.match(features,/function updateDrawer\(/);
 assert.match(html,/officehq-device-sync\.js/);
 assert.match(html,/officehq-sync\.css/);
});
