import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOpenMausBridge, STARTER_BOT} from '../openmaus/bridge.mjs';

async function workspace(fn){
 const root=await mkdtemp(join(tmpdir(),'office-maus-'));
 try {return await fn(root);}finally{await rm(root,{recursive:true,force:true});}
}
const good={action:'bind',companyId:'companyA',employeeId:'emp_1',employeeName:'Mira Researcher',
 department:'Marketing',botName:STARTER_BOT,ownerConfirmed:true};
const exec=(args,input)=>{
 if(args[0]==='doctor')return Promise.resolve({ok:true});
 if(args[0]==='bots')return Promise.resolve({bots:[{name:STARTER_BOT}]});
 if(args[0]==='send')return Promise.resolve({messageId:'msg_1'});
 throw Error('Unknown mock command');
};
test('OpenMausBot manifest is ask-only, with no computer, browser or MCP connected-app tools',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../openmaus/office-hq-starter-team.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,1);assert.equal(manifest.bots.length,1);
 assert.equal(manifest.bots[0].approval,'ask');
 assert.equal(manifest.bots[0].computer,'off');
 assert.equal(manifest.bots[0].browser,false);
 assert.deepEqual(manifest.bots[0].tools.allow,['native:*']);
});
test('connected status and exclusive binding survive bridge recreation',()=>workspace(async root=>{
 const bridge=createOpenMausBridge({root,invoke:exec,allowSend:false});
 assert.equal((await bridge.status()).connected,true);
 await assert.rejects(bridge.action({...good,ownerConfirmed:false}),/Owner confirmation/);
 assert.equal((await bridge.action(good)).bound,true);
 await assert.rejects(bridge.action({...good,employeeId:'emp_2'}),/already bound/);
 await assert.rejects(bridge.action({...good,department:'Finance'}),/Marketing/);
 const another=createOpenMausBridge({root,invoke:exec,allowSend:false});
 assert.equal((await another.status()).bindings[0].employeeId,'emp_1');
 await assert.rejects(another.action({action:'send',companyId:'companyA',employeeId:'emp_1',title:'Draft marketing plan',description:'Prepare a research outline for our store.',ownerConfirmed:true}),/OFF/);
 await another.action({action:'revoke',companyId:'companyA',employeeId:'emp_1',ownerConfirmed:true});
 assert.equal((await another.status()).bindings.length,0);
}));
test('opted-in send calls official CLI with an owner-approved draft-only message',()=>workspace(async root=>{
 let called;const invoke=async(args,input)=>{if(args[0]==='send')called={args,input};return exec(args,input);};
 const bridge=createOpenMausBridge({root,invoke,allowSend:true});
 await bridge.action(good);
 const msg={action:'send',companyId:'companyA',employeeId:'emp_1',title:'Outline new product campaign',
 description:'Draft content ideas for an original launch campaign.',ownerConfirmed:true};
 await assert.rejects(bridge.action({...msg,ownerConfirmed:false}),/approve each assignment/);
 const response=await bridge.action(msg);
 assert.equal(response.submitted,true);
 assert.equal(response.messageId,'msg_1');
 assert.deepEqual(called.args.slice(0,3),['send',STARTER_BOT,'-']);
 assert.match(called.input,/Do not access authenticated websites/);
 assert.doesNotMatch(called.input,/OPENMAUSBOT_TOKEN/);
}));
test('public app and static builder include UI but no local bridge code',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(html,/data-view="openmaus"/);
 assert.match(html,/src="openmausbot.js"/);
 assert.match(build,/openmausbot.js/);
 assert.doesNotMatch(build,/bridge.mjs/);
});
