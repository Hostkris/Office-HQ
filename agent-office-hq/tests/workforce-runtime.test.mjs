import test from 'node:test';
import assert from 'node:assert/strict';
import {scriptPaths} from './html-assets.mjs';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {manifest,roles,botName} from '../openmaus/team.mjs';
import {createWorkforceEngine} from '../openmaus/workforce-engine.mjs';

const cid='company1';
const name=botName(cid,'bookkeeper');
const allBots=new Set(roles.map(r=>botName(cid,r.key)));
const commands=[];
const fake=async (args,input='',opts={})=>{
 commands.push({args,input,opts});
 if(args[0]==='doctor')return {ok:true};
 if(args[0]==='bots')return {bots:[...allBots].map(name=>({name}))};
 if(args[0]==='team')return {ok:true,plan:{create:40}};
 if(args[0]==='run')return {ok:true,threadId:'thread_1',since:12};
 if(args[0]==='wait')return {state:'completed',reply:{text:'Documented reconciliation draft, no payments.'}};
 if(args[0]==='interrupt')return {ok:true};
 throw Error('Unexpected OpenMausBot mock '+args);
};
const book={companyId:cid,employeeId:'employee_1',employeeName:'Jamie Finance',roleKey:'bookkeeper',department:'Finance',scope:'bookkeeping'};
const assignment={action:'send',...book,officeTaskId:'task1',title:'Monthly ledger reconciliation draft',
 description:'Check supplied ledger records for discrepancies; summarize each unresolved item.',
 ownerConfirmed:true};
async function workspace(cb){const root=await mkdtemp(join(tmpdir(),'hq-forty-'));try{return await cb(root)}finally{await rm(root,{recursive:true,force:true})}}
test('one OpenMausBot manifest contains 40 unique restricted bots and all 12 original departments',()=>{
 const m=manifest(cid);
 assert.equal(m.bots.length,40);assert.equal(m.teams.length,12);
 assert.equal(new Set(m.bots.map(b=>b.name)).size,40);
 assert.equal(new Set(m.teams.map(t=>t.name)).size,12);
 assert.ok(m.teams.every(t=>t.prune===false));
 assert.ok(m.bots.every(b=>b.approval==='ask'&&b.computer==='off'&&b.browser===false&&
   Array.isArray(b.tools.allow)&&b.tools.allow.length===0));
 assert.equal(m.bots.find(x=>x.name===name).description,'Prepares ledger entries and transaction reconciliation drafts.');
 assert.notEqual(botName('company2','bookkeeper'),name);
 assert.throws(()=>manifest('../etc'),/Invalid company/);
});
test('all essential roles have independent unique scopes, bot identity and manager role',()=>{
 assert.equal(roles.length,40);
 assert.equal(new Set(roles.map(x=>x.scope)).size,40);
 assert.ok(roles.find(x=>x.key==='exec_assistant').description.includes('Gmail'));
 assert.ok(roles.find(x=>x.key==='ap').description.includes('never issues payments'));
 assert.ok(roles.find(x=>x.key==='support').department==='Customer');
 assert.ok(roles.find(x=>x.key==='chief_audit').reportsTo==='ceo');
});
test('provisioning is off by default and only applies explicit non-pruning owner-approved manifests',()=>workspace(async root=>{
 commands.length=0;
 const no=createWorkforceEngine({root,invoke:fake,allowProvision:false});
 await assert.rejects(no.action({action:'provision',companyId:cid,ownerConfirmed:true}),/Provisioning is OFF/);
 await no.action({action:'plan',companyId:cid});
 assert.ok(commands.find(x=>x.args[0]==='team'&&x.args.includes('--dry-run')));
 const yes=createWorkforceEngine({root,invoke:fake,allowProvision:true});
 await assert.rejects(yes.action({action:'provision',companyId:cid,ownerConfirmed:false}),/CEO confirmation/);
 const provision=await yes.action({action:'provision',companyId:cid,ownerConfirmed:true});
 assert.equal(provision.installed,40);
 const apply=commands.find(x=>x.args[0]==='team'&&!x.args.includes('--dry-run'));
 assert.ok(apply);assert.equal(apply.args.includes('--prune'),false);
 const saved=JSON.parse(await readFile(apply.args[2],'utf8'));
 assert.equal(saved.bots.length,40);
}));
test('every employee must be bound exclusively to the correct department and role',()=>workspace(async root=>{
 const e=createWorkforceEngine({root,invoke:fake,allowSend:false});
 const s=await e.status(cid);assert.equal(s.connected,true);assert.equal(s.installed,40);
 await assert.rejects(e.action({action:'bind',...book,department:'Marketing',ownerConfirmed:true}),/scope do not match/);
 await assert.rejects(e.action({action:'bind',...book,ownerConfirmed:false}),/owner approval/);
 assert.equal((await e.action({action:'bind',...book,ownerConfirmed:true})).roleKey,'bookkeeper');
 await assert.rejects(e.action({action:'bind',...book,employeeId:'employee_2',ownerConfirmed:true}),/exclusively/);
 await assert.rejects(e.action(assignment),/execution is OFF/);
 const x=await e.status(cid);assert.equal(x.bindings.length,1);
}));
test('CEO-approved one-shot per-job dispatch respects role scope, reports real status and retains history',()=>workspace(async root=>{
 commands.length=0;
 const b=createWorkforceEngine({root,invoke:fake,allowSend:true});
 await b.action({action:'bind',...book,ownerConfirmed:true});
 await assert.rejects(b.action({...assignment,scope:'accounts_payable'}),/scope do not match/);
 await assert.rejects(b.action({...assignment,ownerConfirmed:false}),/Approve this individual/);
 const receipt=await b.action(assignment);
 assert.equal(receipt.submitted,true);
 assert.equal(receipt.job.roleKey,'bookkeeper');
 const command=commands.find(x=>x.args[0]==='run');
 assert.equal(command.args[1],name);
 assert.ok(command.input.includes('bookkeeping'));
 assert.ok(command.input.includes('Do not use tools or external accounts'));
 await assert.rejects(b.action(assignment),/already running/);
 const checked=await b.action({action:'check',companyId:cid,jobId:receipt.job.id});
 assert.equal(checked.job.status,'review');
 assert.match(checked.job.result,/reconciliation draft/);
 const restarted=createWorkforceEngine({root,invoke:fake});
 assert.equal((await restarted.status(cid)).jobs[0].status,'review');
}));
test('CEO permission requests are formal records only, unrelated account scopes never turn into real tool grants',()=>workspace(async root=>{
 const e=createWorkforceEngine({root,invoke:fake});
 await e.action({action:'bind',...book,ownerConfirmed:true});
 const req=(await e.action({action:'permission-request',...book,provider:'Gmail',actions:['read'],
    purpose:'Request a review of financial attachments only if explicitly permitted.'})).request;
 assert.equal(req.status,'pending');
 assert.match(req.note,/NOT connected/);
 await assert.rejects(e.action({action:'permission-approve',companyId:cid,requestId:req.id,ownerConfirmed:false}),/CEO decision/);
 const approved=await e.action({action:'permission-approve',companyId:cid,requestId:req.id,ownerConfirmed:true});
 assert.equal(approved.request.status,'approved-policy');
 assert.match(approved.note,/NOT established/);
 const revoked=await e.action({action:'permission-revoke',companyId:cid,requestId:req.id,ownerConfirmed:true});
 assert.equal(revoked.request.status,'revoked');
 await assert.rejects(e.action({action:'permission-request',...book,provider:'Chime',actions:['send-secret'],purpose:'A bad request for a banking action.'}),/permissible/);
}));
test('stopping active jobs is mandatory before unbinding an employee',()=>workspace(async root=>{
 const e=createWorkforceEngine({root,invoke:fake,allowSend:true});
 await e.action({action:'bind',...book,ownerConfirmed:true});
 const x=await e.action(assignment);
 await assert.rejects(e.action({action:'unbind',...book,ownerConfirmed:true}),/Stop this employee/);
 const stopped=await e.action({action:'interrupt',companyId:cid,jobId:x.job.id,ownerConfirmed:true});
 assert.equal(stopped.job.status,'stopped');
 assert.equal((await e.action({action:'unbind',...book,ownerConfirmed:true})).unbound,true);
 assert.equal((await e.status(cid)).bindings.length,0);
}));
test('browser build includes runtime controller but not private engine, prompts or tokens',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const bundle=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const ui=await readFile(new URL('../workforce-runtime.js',import.meta.url),'utf8');
 assert.ok(!scriptPaths(html).includes('workforce-runtime.js'));
 assert.ok(scriptPaths(html).includes('officehq-voice.js'));
 assert.match(bundle,/workforce-runtime.js/);
 assert.doesNotMatch(bundle,/workforce-engine.mjs|essential-workforce.json/);
 assert.match(ui,/data-workforce/);
 assert.doesNotMatch(ui,/process\.env|OPENAI_API_KEY/);
});
