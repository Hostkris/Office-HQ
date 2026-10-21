import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const [share,html,landing,build,sw,macBuilder,macSetup]=await Promise.all([
 '../mac-share.js','../index.html','../mac.html','../scripts/build.mjs','../sw.js',
 '../../mac/build_download.py','../../mac/install.command'
].map(s=>readFile(new URL(s,import.meta.url),'utf8')));
const DOWNLOAD_URL='https://raw.githubusercontent.com/Hostkris/Office-HQ/main/downloads/Office_HQ_for_Mac.zip';
function scene({shareFn,clipboardFn}={}){
 let click,notification='',navigation;
 const status={set textContent(t){notification=t},get textContent(){return notification}};
 const document={getElementById:id=>id==='macShareStatus'?status:null,
   addEventListener:(name,fn)=>{if(name==='click')click=fn;}};
 const location={pathname:'/Office-HQ/agent-office-hq/mac.html',href:'',};
 const navigator={};if(shareFn)navigator.share=shareFn;
 if(clipboardFn)navigator.clipboard={writeText:clipboardFn};
 const window={OfficeHQBridge:{toast:x=>{notification=x;}}};
 vm.runInNewContext(share,{document,location,navigator,window,console},{filename:'mac-share.js'});
 return {fire:()=>click({target:{closest:sel=>sel==='[data-mac-share]'?{}:null},preventDefault(){}}),
   status:()=>notification};
}
test('Office HQ supports direct Mac ZIP access from iOS on GitHub',()=>{
 assert.match(html,/data-mac-share/);
 assert.match(html,/href="\.\/mac.html"/);
 assert.match(html,/src="mac-share\.js"/);
 assert.match(landing,/data-mac-share/);
 assert.ok(landing.includes(DOWNLOAD_URL));
 assert.match(build,/mac\.html.*mac-share\.js/);
 assert.match(sw,/'\.\/mac\.html','\.\/mac-share\.js'/);
});
test('iPhone share button offers AirDrop and Messages using real Mac download URL',async()=>{
 let shared;
 const session=scene({shareFn:async payload=>{shared=payload;}});
 session.fire();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(shared.url,DOWNLOAD_URL);
 assert.match(shared.text,/Mac/);
 assert.match(session.status(),/shared/);
});
test('No share sheet: copy download link instead of giving iOS device credentials to Mac',async()=>{
 let copied;
 const session=scene({clipboardFn:async value=>{copied=value;}});
 session.fire();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(copied,DOWNLOAD_URL);
 assert.match(session.status(),/copied/);
 assert.doesNotMatch(share,/localStorage|sessionStorage|cookie|password/);
});
test('Canceling iOS share does not claim the Mac got anything',async()=>{
 const session=scene({shareFn:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'});}});
 session.fire();await new Promise(resolve=>setImmediate(resolve));
 assert.match(session.status(),/canceled/i);
 assert.doesNotMatch(session.status(),/download link shared/);
});
test('Mac update refreshes new CEO chat and browser assets while retaining backups and consent',()=>{
 assert.match(macSetup,/ceo-secure-chat\.js ceo-secure-chat\.css/);
 assert.match(macSetup,/workforce-lean\.js/);
 assert.match(macSetup,/mac\.html mac-share\.js/);
 assert.match(macSetup,/native-engine\/bridge\.mjs.*device-sync\/mac-worker\.mjs/);
 assert.match(macSetup,/cp -p "\$WEB\/\$item" "\$BACKUP\/\$item"/);
 assert.match(macSetup,/Update Office HQ/);
 assert.match(macSetup,/UPDATED_CODE=1/);
 assert.match(macSetup,/Restarting the verified local Office HQ server/);
 assert.match(macSetup,/lsof -a -p/,'Only the verified Office HQ server may be restarted');
 assert.match(macSetup,/kill -TERM "\\$ACTIVE_PID"/,'Restart must not interrupt other services');
 assert.match(landing,/Install or update Office HQ on your Mac/);
 assert.match(landing,/Existing workspace data is preserved/);
});
test('Mac ZIP launcher preserves existing install and uses official SHA-verified Node',()=>{
 assert.match(macBuilder,/Office_HQ_for_Mac\.zip/);
 assert.match(macBuilder,/MacOS\/OfficeHQ/);
 assert.match(macSetup,/SHASUMS256\.txt/);
 assert.match(macSetup,/shasum -a 256/);
 assert.match(macSetup,/if \[ ! -d "\$TARGET" \]/);
 assert.match(macSetup,/127\.0\.0\.1:3000/);
 assert.doesNotMatch(macSetup,/sudo |rm -rf "\$TARGET"|curl .*\| bash/);
});

