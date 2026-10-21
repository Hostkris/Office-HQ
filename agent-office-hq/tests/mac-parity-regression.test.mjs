import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const appDir=join(root,'agent-office-hq');
const read=(p)=>readFile(join(appDir,p),'utf8');

test('Mac and iPhone load the exact same workspace scripts and dedicated routes',async()=>{
 const [html,app,website,coding]=await Promise.all([
  read('index.html'),read('app.js'),read('website-access.js'),read('coding-tasks.js')
 ]);
 for(const screen of ['access','coding','thread']){
  assert.match(html,new RegExp('data-view="'+screen+'"'));
  assert.match(app,new RegExp(screen+":"));
 }
 for(const asset of ['office-features.js','ceo-secure-chat.js','website-access.js','coding-tasks.js','officehq-device-sync.js'])
  assert.ok(html.includes('src="'+asset+'"'),'Missing '+asset);
 assert.match(website,/OfficeHQExtraViews\.access\s*=\s*function/);
 assert.match(coding,/OfficeHQExtraViews\.coding\s*=\s*render/);
 assert.match(app,/hq-unavailable-view/,'Missing modules must not be redirected to Command Center');
 assert.doesNotMatch(app,/\|\|renderCommand\)\)\(\)/,'Never fall back to Command Center for a missing screen');
});

test('Company Messages keeps its conversation layout on Mac, not retired assignment form',async()=>{
 const [office,chat]=await Promise.all([read('office-features.js'),read('ceo-secure-chat.js')]);
 assert.match(office,/window\.OfficeHQSecureChat\.render\(\)/);
 assert.match(office,/Company text thread/);
 assert.doesNotMatch(office,/Give your employees an assignment/);
 assert.match(chat,/Company Messages/);
 assert.match(chat,/ceo-chat-log/);
 assert.match(chat,/data-ceo-chat-input/);
});

test('Mac updater checks all requested modules, preserves backups, and restarts only its own server',async()=>{
 const installer=await readFile(join(root,'mac/install.command'),'utf8');
 execFileSync('bash',['-n',join(root,'mac/install.command')]);
 assert.match(installer,/FILES=\(/);
 assert.match(installer,/for item in "\$\{FILES\[@\]\}"/);
 assert.match(installer,/lsof -a -p/);
 assert.match(installer,/kill -TERM "\$ACTIVE_PID"/);
 assert.match(installer,/cmp -s "\$TEMP\/\$module" "\$WEB\/\$module"/);
 for(const f of ['website-access.js','coding-tasks.js','ceo-secure-chat.js'])
  assert.ok(installer.includes(f),'Mac update must validate '+f);
 assert.match(installer,/hq_update/);
});

test('Queued cloud tasks report the specific Mac authorization problem',async()=>{
 const [mac,sync]=await Promise.all([read('device-sync/mac-worker.mjs'),read('officehq-device-sync.js')]);
 assert.match(mac,/Waiting for Mac setup:/);
 assert.match(mac,/Waiting for CEO to authorize this specialist/);
 assert.match(sync,/cloudQueueNote/);
 assert.match(sync,/unmatchedAssignments/);
 assert.match(sync,/Devices paired/);
});
