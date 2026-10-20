import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOpenMausBridge,STARTER_BOT} from '../openmaus/bridge.mjs';
async function workspace(fn){const root=await mkdtemp(join(tmpdir(),'office-maus-'));try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
const good={action:'bind',companyId:'companyA',employeeId:'emp_1',employeeName:'Mira Researcher',
  department:'Marketing',botName:STARTER_BOT,ownerConfirmed:true};
const assignment={action:'send',companyId:'companyA',employeeId:'emp_1',officeTaskId:'task_1',
  title:'Outline new product campaign',description:'Draft content ideas for an original launch campaign.',ownerConfirmed:true};
const exec=(args,input)=>{
 if(args[0]==='doctor')return Promise.resolve({ok:true});
 if(args[0]==='bots')return Promise.resolve({bots:[{name:STARTER_BOT}]});
 if(args[0]==='run')return Promise.resolve({ok:true,threadId:'thread-001',since:123,messageId:'msg_1'});
 if(args[0]==='wait')return Promise.resolve({state:'timed-out',status:'timed-out'});
 if(args[0]==='interrupt')return Promise.resolve({ok:true});
 throw Error('Unexpected test command: '+args.join(' '));
};
test('Starter agent cannot access browser, computer or third-party MCP tools',async()=>{
 const m=JSON.parse(await readFile(new URL('../openmaus/office-hq-starter-team.json',import.meta.url),'utf8'));
 assert.equal(m.version,1);assert.equal(m.bots.length,1);assert.equal(m.bots[0].approval,'ask');
 assert.equal(m.bots[0].computer,'off');assert.equal(m.bots[0].browser,false);
 assert.deepEqual(m.bots[0].tools.allow,['native:*']);
});
test('Owner authorization required; exclusive binding survives process restart',()=>workspace(async root=>{
 const b=createOpenMausBridge({root,invoke:exec,allowSend:false});
 assert.equal((await b.status()).connected,true);
 await assert.rejects(b.action({...good,ownerConfirmed:false}),/Owner confirmation/);
 await b.action(good);
 await assert.rejects(b.action({...good,employeeId:'emp_2'}),/bound exclusively/);
 await assert.rejects(b.action({...good,department:'Finance'}),/Marketing/);
 const other=createOpenMausBridge({root,invoke:exec,allowSend:false});
 assert.equal((await other.status()).bindings[0].employeeId,'emp_1');
 await assert.rejects(other.action(assignment),/OFF/);
 await other.action({action:'revoke',companyId:'companyA',employeeId:'emp_1',ownerConfirmed:true});
 assert.equal((await other.status()).bindings.length,0);
}));
test('Send creates dedicated OpenMausBot thread, stores receipt, blocks duplicate execution',()=>workspace(async root=>{
 let called;const invoke=async(args,input,options)=>{if(args[0]==='run')called={args,input};return exec(args,input);};
 const b=createOpenMausBridge({root,invoke,allowSend:true});
 await b.action(good);
 await assert.rejects(b.action({...assignment,ownerConfirmed:false}),/approve each assignment/);
 await assert.rejects(b.action({...assignment,officeTaskId:null}),/valid existing/);
 const sent=await b.action(assignment);
 assert.equal(sent.submitted,true);assert.equal(sent.threadId,'thread-001');
 assert.deepEqual(called.args.slice(0,3),['run',STARTER_BOT,'-']);
 assert.ok(called.args.includes('none'));assert.ok(called.args.includes('send-id'));
 assert.match(called.input,/No authenticated websites/);
 await assert.rejects(b.action(assignment),/already has an active/);
 const b2=createOpenMausBridge({root,invoke,allowSend:true});
 assert.equal((await b2.status()).runs[0].threadId,'thread-001');
}));
test('Real engine wait results are not invented: polling running, approval then completed drafts',()=>workspace(async root=>{
 const states=[
  {state:'timed-out',status:'timed-out'},
  {state:'needs-input',job:{reason:'CEO approval required'}},
  {state:'completed',reply:{text:'Draft an original campaign with 3 concepts.'}}
 ];let i=0,lastArgs,lastOptions;
 const invoke=async(args,input,options)=>{
   if(args[0]==='wait'){lastArgs=args;lastOptions=options;return states[i++];}
   return exec(args,input);
 };
 const b=createOpenMausBridge({root,invoke,allowSend:true});
 await b.action(good);
 const sent=await b.action(assignment),get=()=>b.action({action:'check',companyId:'companyA',runId:sent.runId});
 assert.equal((await get()).run.status,'running');
 assert.deepEqual(lastOptions.acceptExitCodes,[1,3,4]);
 assert.ok(lastArgs.includes('--since'));
 assert.equal((await get()).run.status,'needs-input');
 const completed=await get();
 assert.equal(completed.run.status,'review');
 assert.match(completed.run.result,/original campaign/);
 assert.equal((await get()).run.status,'review'); // no invented extra call
}));
test('CEO can stop an active task, but not another company task',()=>workspace(async root=>{
 let stopArgs;const invoke=async(args,input)=>{
  if(args[0]==='interrupt')stopArgs=args;
  return exec(args,input);
 };
 const b=createOpenMausBridge({root,invoke,allowSend:true});
 await b.action(good);const sent=await b.action(assignment);
 const command={action:'interrupt',companyId:'companyA',runId:sent.runId,ownerConfirmed:true};
 await assert.rejects(b.action({...command,ownerConfirmed:false}),/CEO confirmation/);
 await assert.rejects(b.action({...command,companyId:'companyB'}),/not found/);
 assert.equal((await b.action(command)).run.status,'stopped');
 assert.deepEqual(stopArgs.slice(0,3),['interrupt','--thread','thread-001']);
 assert.ok(stopArgs.includes('--tree'));
}));
test('Static website includes UI and RPG status, but never bundles private engine',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const floor=await readFile(new URL('../project-floor.js',import.meta.url),'utf8');
 const ui=await readFile(new URL('../openmausbot.js',import.meta.url),'utf8');
 assert.match(html,/data-view="openmaus"/);assert.match(html,/src="openmausbot.js"/);
 assert.match(build,/openmausbot.js/);assert.doesNotMatch(build,/bridge.mjs/);
 assert.match(floor,/OfficeHQMausThoughts/);assert.match(ui,/CEO review/);
});
