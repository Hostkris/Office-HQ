import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function freePort(){return await new Promise((resolve,reject)=>{
  const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))});
});}
test('local server serves dashboard, reports draft-only status, and refuses AI calls without a key',async()=>{
  const port=await freePort();
  const child=spawn(process.execPath,['server.mjs'],{
    cwd:root,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),OPENAI_API_KEY:''},stdio:'ignore'
  });
  try{
    const base=`http://127.0.0.1:${port}`;
    let ready=false;
    for(let i=0;i<40;i++){
      try{const res=await fetch(`${base}/api/status`);if(res.ok){ready=true;break}}catch{}
      await sleep(80);
    }
    assert.ok(ready,'local server did not start');
    const res=await fetch(base+'/');
    assert.equal(res.status,200);
    assert.match(await res.text(),/Agent Office HQ/);
    assert.equal((await fetch(base+'/ios-workstations.js')).status,200);
    assert.equal((await fetch(base+'/desktop-workstations.js')).status,200);
    const status=await (await fetch(base+'/api/status')).json();
    assert.equal(status.aiReady,false);
    assert.equal(status.externalActions,false);
    const unavailable=await fetch(base+'/api/run-agent',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({task:{title:'x'}})});
    assert.equal(unavailable.status,503);
    assert.equal((await fetch(base+'/.env')).status,404);
    assert.equal((await fetch(base+'/server.mjs')).status,404);
  }finally{child.kill('SIGTERM')}
});
