import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm,stat,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createCodingWorker,parseCodingChecks,safeCodingPath} from '../native-engine/coding-worker.mjs';
const ctx={companyId:'co',employeeId:'dev',roleKey:'backend_engineer'};
const call=(name,args={})=>({function:{name,arguments:args}});
const reply=calls=>({ok:true,json:async()=>({done:true,done_reason:'stop',message:{role:'assistant',content:'',tool_calls:calls},eval_count:30,prompt_eval_count:100,eval_duration:100000000,load_duration:2000000})});
async function fixture(fn,{model,maxRounds=10}={}){
 const root=await mkdtemp(join(tmpdir(),'hq-code-')),repo=join(root,'repo'),storage=join(root,'private');await mkdir(repo);await mkdir(storage);let allowed=true,turn=0;const requests=[];
 function git(...args){return execFileSync('git',args,{cwd:repo,encoding:'utf8',env:{...process.env,GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1'}}).trim();}
 git('init','-q');git('config','user.email','fixture@example.invalid');git('config','user.name','Coding fixture');
 await writeFile(join(repo,'add.mjs'),'export const add = (a, b) => a - b;\n');
 await writeFile(join(repo,'add.test.mjs'),"import {test} from 'node:test';\nimport assert from 'node:assert/strict';\nimport {add} from './add.mjs';\ntest('addition',()=>assert.equal(add(1,2),3));\n");
 await writeFile(join(repo,'README.md'),'Public fixture for a bounded coding task.\n');git('add','.');git('commit','-qm','Fixture starting point');
 const request=async(url,opts)=>{requests.push({url,opts});if(url.endsWith('/api/tags'))return {ok:true,json:async()=>({models:[{name:'fixture-coder:latest'}]})};if(url.endsWith('/api/show'))return {ok:true,json:async()=>({capabilities:['completion','tools'],thinking:{values:['low','high'],default:'low'},model_info:{'fixture.context_length':32768}})};if(url.endsWith('/api/chat'))return model?model(turn++,JSON.parse(opts.body),opts):reply([]);throw Error('Unexpected network request');};
 const worker=createCodingWorker({storage,request,authorize:async p=>allowed&&p.companyId==='co'&&p.employeeId==='dev'&&p.roleKey==='backend_engineer',maxRounds});
 async function grant(extra={}){const info=await worker.action({action:'inspect',repoPath:repo,ownerConfirmed:true});return (await worker.action({action:'grant',...ctx,repoPath:repo,expectedCommit:info.commit,readPaths:['README.md','add.mjs','add.test.mjs'],editPaths:['add.mjs'],checks:['node --test add.test.mjs'],allowChecks:true,ownerConfirmed:true,...extra})).grant;}
 async function run(g,extra={}){return worker.run({id:'run-one',...ctx,payload:{grantId:g.id,instruction:'Fix addition so positive inputs are added correctly.',criteria:['Adding one and two returns three.'],provider:'ollama',...extra},guard:async()=>{if(!allowed)throw Object.assign(Error('Worker revoked'),{status:403});}});}
 try{await worker.action({action:'configure',model:'fixture-coder',thinking:'fast',numCtx:8192,ownerConfirmed:true});await fn({worker,root,storage,repo,grant,run,git,requests,revokeWorker:()=>allowed=false});}
 finally{worker.shutdown();await rm(root,{recursive:true,force:true});}
}
test('bounded agent edits real files, observes a failing check, repairs it, and produces an actual passing diff',async()=>{
 await fixture(async({worker,repo,grant,run,requests})=>{
  const g=await grant(),r=await run(g),review=await worker.action({action:'review',companyId:'co',runId:'run-one'});
  assert.match(r.result,/PASS · node --test add.test.mjs · exit 0/);assert.match(review.patch,/a \+ b/);assert.equal(review.checkHistory.length,3);assert.equal(review.checkHistory[0].checks[0].passed,false);assert.equal(review.checkHistory[1].checks[0].passed,false);assert.equal(review.checkHistory[2].checks[0].passed,true);
  assert.equal(await readFile(join(repo,'add.mjs'),'utf8'),'export const add = (a, b) => a - b;\n','original working folder remains unchanged');
  assert.equal(review.metrics.rounds,4);assert.equal(review.published,false);assert.equal(review.reviewRequired,true);assert.deepEqual(review.paths,['add.mjs']);assert.match(review.workspace,/coding-runs\/run-one\/checkout$/);
  const inference=JSON.parse(requests.find(r=>r.url.endsWith('/api/chat')).opts.body);assert.equal(inference.keep_alive,'10m');assert.equal(inference.think,'low');assert.ok(inference.tools.some(t=>t.function.name==='search_files'));
  assert.equal((await stat(join(review.workspace,'..','..','..','coding.json'))).mode&0o777,0o600);
 },{model:async turn=>reply([
  [call('record_plan',{steps:['Inspect the function and failing check.','Correct the operation and verify the result.']}),call('read_file',{path:'add.mjs'}),call('edit_file',{path:'add.mjs',oldText:'a - b',newText:'a * b'})],
  [call('run_checks')],
  [call('read_file',{path:'add.mjs'}),call('edit_file',{path:'add.mjs',oldText:'a * b',newText:'a + b'})],
  [call('finish_task',{summary:'Addition now uses the plus operator and its existing test passes.',evidence:[{criterion:1,evidence:'The existing addition test asserted add(1,2) equals 3 and exited 0.'}]})]
 ][turn]||[])});
});
test('a claimed completion without file changes never becomes a verified result',async()=>{
 await fixture(async({grant,run,worker})=>{await assert.rejects(run(await grant()),/work limit/);assert.equal((await worker.status('co')).results.length,0);},{maxRounds:2,model:async()=>reply([call('finish_task',{summary:'Everything is fixed.',evidence:[{criterion:1,evidence:'I say it works now.'}]})])});
});
test('an incomplete or token-truncated response never executes its proposed edit',async()=>{
 for(const truncated of [false,true])await fixture(async({grant,run,repo,worker})=>{await assert.rejects(run(await grant()),truncated?/work limit/:/did not finish/);assert.equal((await worker.status('co')).results.length,0);assert.match(await readFile(join(repo,'add.mjs'),'utf8'),/a - b/);},{maxRounds:1,model:async()=>({ok:true,json:async()=>({done:truncated,done_reason:truncated?'length':'stop',message:{role:'assistant',tool_calls:[call('edit_file',{path:'add.mjs',oldText:'a - b',newText:'a + b'})]}})})});
});
test('repository approval pins a commit, rejects hidden files, symlinks, tests, shells and cross-company dispatch',async()=>{
 await fixture(async({worker,grant,run,repo,git})=>{
  for(const path of ['../file','/tmp/file','sub/../file','.env','node_modules/pkg.js','secrets.json','link\\file'])assert.throws(()=>safeCodingPath(path));
  for(const command of ['sh -c whoami','npm test; curl x','node -e test','node --test ../x.mjs','npm install','npm run deploy'])assert.throws(()=>parseCodingChecks(command));
  await assert.rejects(grant({ownerConfirmed:false}),/confirmation/);await assert.rejects(grant({editPaths:['add.test.mjs']}),/read-only/);await assert.rejects(grant({expectedCommit:'0'.repeat(40)}),/changed/);
  await symlink('add.mjs',join(repo,'link.mjs'));git('add','link.mjs');git('commit','-qm','Add a symlink');await assert.rejects(grant({readPaths:['link.mjs'],editPaths:['link.mjs']}),/Symlinks/);
  const g=await grant();await assert.rejects(worker.validate({grantId:g.id,instruction:'A valid coding assignment',criteria:['Result must be correct']},{...ctx,companyId:'other'}),/permission/);
  await worker.action({action:'revoke',companyId:'co',grantId:g.id,ownerConfirmed:true});await assert.rejects(run(g),/permission/);
 });
});
test('revocation during model inference stops a pending edit before it can run',async()=>{
 let enter,release;const started=new Promise(r=>enter=r),held=new Promise(r=>release=r);
 await fixture(async({worker,grant,run})=>{
  const g=await grant(),result=run(g);await started;await worker.action({action:'revoke',companyId:'co',grantId:g.id,ownerConfirmed:true});release();await assert.rejects(result,/revoked/);assert.equal((await worker.status('co')).results.length,0);
 },{model:async()=>{enter();await held;return reply([call('record_plan',{steps:['Read','Edit']}),call('read_file',{path:'add.mjs'}),call('edit_file',{path:'add.mjs',oldText:'a - b',newText:'a + b'})]);}});
});
test('removed cloud coding engine cannot be configured or dispatched',async()=>{
 await fixture(async({worker,grant})=>{
  const g=await grant();
  await assert.rejects(worker.action({action:'configure',provider:'openrouter',model:'fixture-coder',ownerConfirmed:true}),/Only local Ollama/);
  await assert.rejects(worker.validate({grantId:g.id,instruction:'Fix the existing arithmetic regression.',criteria:['Adding one and two returns three.'],provider:'openrouter'},ctx),/Only local Ollama/);
 });
});
test('Mac upgrade resets a legacy cloud selection and deletes its saved credential',async()=>{
 await fixture(async({grant,storage})=>{
  await grant();
  const statePath=join(storage,'coding.json'),state=JSON.parse(await readFile(statePath,'utf8'));
  state.config={provider:'openrouter',model:'thinkingmachines/inkling:free',numCtx:16384,thinking:'auto'};
  await writeFile(statePath,JSON.stringify(state));
  const legacy=join(storage,'openrouter-credential.json');
  await writeFile(legacy,JSON.stringify({apiKey:'a-fixture-key-never-sent'}),{mode:0o600});
  const upgraded=createCodingWorker({storage,authorize:async()=>true,request:async()=>{throw Error('No cloud request should occur.');}});
  const status=await upgraded.status('co');
  assert.equal(status.localOnly,true);
  assert.deepEqual(status.config,{provider:'ollama',model:'',numCtx:8192,thinking:'auto'});
  assert.equal(JSON.parse(await readFile(statePath,'utf8')).config.provider,'ollama');
  await assert.rejects(stat(legacy),{code:'ENOENT'});
  upgraded.shutdown();
 });
});
