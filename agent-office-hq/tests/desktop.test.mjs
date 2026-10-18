import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import vm from 'node:vm';
import {SITES,decideClick,hostAllowed,validScope} from '../desktop/runner.mjs';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
test('browser worker website allowlist resists lookalike hostnames',()=>{
 assert.ok(hostAllowed('gmail','https://mail.google.com/mail/u/0'));
 assert.ok(hostAllowed('shopify','https://mystore.myshopify.com/admin'));
 assert.equal(hostAllowed('gmail','https://mail.google.com.attacker.example'),false);
 assert.equal(hostAllowed('gmail','http://mail.google.com'),false);
 assert.equal(hostAllowed('chime','https://evil.example'),false);
 assert.equal(hostAllowed('gibberish','https://google.com'),false);
 assert.equal(validScope('../evil'),false);
 assert.equal(validScope('normal_company-1'),true);
 assert.ok(Object.keys(SITES).length>=13);
});
test('CEO approval gates block payments and uncertain external writes',()=>{
 assert.equal(decideClick({label:'Pay now',tag:'BUTTON'},'shopify').type,'blocked');
 assert.equal(decideClick({label:'Wire money',tag:'BUTTON'},'chime').type,'blocked');
 assert.equal(decideClick({label:'Publish',tag:'BUTTON'},'tiktok').type,'approval');
 assert.equal(decideClick({label:'Next',tag:'BUTTON'},'gmail').type,'approval');
 assert.equal(decideClick({label:'Inbox',tag:'A',href:'https://mail.google.com/mail/u/0'},'gmail').type,'allow');
 assert.equal(decideClick({label:'Security code',tag:'INPUT',sensitive:true},'gmail').type,'blocked');
 assert.equal(decideClick({label:'External link',tag:'A',href:'https://www.example.com'},'gmail').type,'approval');
 assert.equal(decideClick({label:'Settings',tag:'BUTTON'},'chime').type,'blocked');
});
test('frontend browser workstation script is valid and includes explicit localhost gate',async()=>{
 const frontend=await readFile(join(root,'desktop-workstations.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(frontend));
 assert.match(frontend,/location\.hostname/);
 assert.match(frontend,/data-desk="authorize"/);
 assert.match(frontend,/data-desk="approve"/);
 assert.match(frontend,/data-desk="handoff"/);
 assert.match(frontend,/OfficeHQDesktopThoughts/);
});
async function freePort(){return await new Promise(resolve=>{
 const server=createServer();server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});
});}
test('desktop API rejects untrusted origins, unknown sites and unapproved employee grants',async()=>{
 const tmp=await mkdtemp(join(tmpdir(),'office-hq-desktop-test-')),port=await freePort();
 const child=spawn(process.execPath,['server.mjs'],{cwd:root,
  env:{...process.env,HOST:'127.0.0.1',PORT:String(port),OPENAI_API_KEY:'',OFFICE_HQ_AI_BACKEND:'',OFFICE_HQ_DATA_DIR:tmp},
  stdio:'ignore'});
 const base='http://127.0.0.1:'+port;
 try{
  let live=false;
  for(let n=0;n<45;n++){try{const r=await fetch(base+'/api/desktop/status');if(r.ok){live=true;break;}}catch{}await sleep(80);}
  assert.ok(live,'desktop API failed to start');
  const status=await(await fetch(base+'/api/desktop/status')).json();
  assert.equal(status.local,true);assert.equal(status.aiReady,false);
  assert.equal(status.mode,'desktop-only');
  const post=(data,origin)=>fetch(base+'/api/desktop/action',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(data)});
  assert.equal((await post({action:'status'},'https://evil.example')).status,403);
  assert.equal((await post({action:'open',companyId:'company1',site:'invalid-site'})).status,400);
  assert.equal((await post({action:'authorize',companyId:'company1',employeeId:'worker1',site:'gmail',department:'Finance',employeeName:'Test',ownerConfirmed:true})).status,403);
  assert.equal((await post({action:'authorize',companyId:'company1',employeeId:'worker1',site:'gmail',department:'Customer',employeeName:'Test',ownerConfirmed:true})).status,409);
  assert.equal((await post({action:'run',grantId:'missing',companyId:'company1',prompt:'Review my incoming messages.'})).status,503);
 }finally{
  child.kill('SIGTERM');await sleep(100);await rm(tmp,{recursive:true,force:true});
 }
});
