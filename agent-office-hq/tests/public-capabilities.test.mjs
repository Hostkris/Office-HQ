import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createPublicCapabilities,parseJob} from '../research/public-capabilities.mjs';

const worker={employeeId:'agent-research',roleKey:'research'};
async function fixture(fn){
 const root=await mkdtemp(join(tmpdir(),'hq-public-sources-'));
 const calls=[];
 const transport=async (url,opts)=>{
  calls.push({url,options:opts});
  const data=url.includes('frankfurter')?{date:'2026-10-20',base:'USD',rates:{EUR:0.9}}:
   url.includes('openfoodfacts')?{status:1,product:{product_name:'Test food',brands:'Example',quantity:'1 kg'}}:
   {name:'public-apis',description:'Community API directory',stargazers_count:18200,open_issues_count:23,archived:false,private:false};
  return {ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify(data)};
 };
 try{await fn({engine:createPublicCapabilities({root,transport}),calls,root});}finally{await rm(root,{recursive:true,force:true});}
}
test('targets are strict recognized public-source types, never arbitrary URLs or account endpoints',()=>{
 assert.deepEqual(parseJob('Research GitHub public-apis/public-apis',''),{capability:'github',target:'public-apis/public-apis'});
 assert.deepEqual(parseJob('Check currency exchange rate USD to EUR',''),{capability:'forex',target:'USD/EUR'});
 assert.deepEqual(parseJob('Look up food barcode 3017620422003',''),{capability:'food',target:'3017620422003'});
 assert.equal(parseJob('read private Gmail mailbox',''),null);
 assert.equal(parseJob('fetch http://127.0.0.1:1234/secrets',''),null);
 assert.equal(parseJob('GitHub ../../secret',''),null);
});
test('nothing is called or enabled before a real owner-approved company grant',async()=>{
 await fixture(async({engine,calls})=>{
  const draft=await engine.evidence({companyId:'c1',employeeId:worker.employeeId,title:'GitHub public-apis/public-apis'});
  assert.equal(draft.authorized,false);
  assert.equal(calls.length,0);
  await assert.rejects(engine.action({action:'enable',companyId:'c1',employees:[worker]}),/CEO confirmation/);
  // Unrecognized provider IDs cannot be granted through this endpoint at all.
  assert.equal(calls.length,0);
 });
});
test('one-click grant is restricted to eligible employee IDs and service-specific specialties',async()=>{
 await fixture(async({engine,calls,root})=>{
  await engine.action({action:'enable',companyId:'c1',ownerConfirmed:true,employees:[
   worker,{employeeId:'agent-finance',roleKey:'budget_officer'},{employeeId:'agent-customer',roleKey:'support'}]});
  const status=await engine.status('c1');
  assert.deepEqual(status.grants.map(g=>g.capability+'@'+g.employeeId).sort(),
   ['food@agent-research','forex@agent-finance','github@agent-research']);
  assert.equal((await stat(join(root,'public-source-grants.json'))).mode&0o777,0o600);
  const raw=await readFile(join(root,'public-source-grants.json'),'utf8');
  assert.doesNotMatch(raw,/password|access_token|api_key/);
  const unauthorized=await engine.evidence({companyId:'c2',employeeId:worker.employeeId,title:'GitHub public-apis/public-apis'});
  assert.equal(unauthorized.authorized,false);
  const wrongRole=await engine.evidence({companyId:'c1',employeeId:'agent-finance',title:'GitHub public-apis/public-apis'});
  assert.equal(wrongRole.authorized,false);
  assert.equal(calls.length,0);
 });
});
test('approved specialist can retrieve real-shaped GitHub, FX and food evidence with provenance',async()=>{
 await fixture(async({engine,calls})=>{
  await engine.action({action:'enable',companyId:'c1',ownerConfirmed:true,employees:[
   worker,{employeeId:'agent-finance',roleKey:'budget_officer'}]});
  const github=await engine.evidence({companyId:'c1',employeeId:worker.employeeId,title:'Research GitHub public-apis/public-apis'});
  assert.equal(github.authorized,true);assert.equal(github.data.stars,18200);
  assert.equal(github.source,'https://api.github.com/repos/public-apis/public-apis');
  const fx=await engine.evidence({companyId:'c1',employeeId:'agent-finance',title:'Check currency exchange rate USD to EUR'});
  assert.equal(fx.data.rate,0.9);assert.match(fx.source,/api.frankfurter.dev\/v1\/latest/);
  const food=await engine.evidence({companyId:'c1',employeeId:worker.employeeId,title:'Check food barcode 3017620422003'});
  assert.equal(food.data.found,true);assert.equal(food.data.name,'Test food');
  assert.equal(calls.length,3);
  for(const call of calls){assert.ok(call.url.startsWith('https://'));assert.equal(call.options.headers.Accept,'application/json');}
 });
});
test('revoking grants immediately prevents further network requests for that company',async()=>{
 await fixture(async({engine,calls})=>{
  await engine.action({action:'enable',companyId:'c1',ownerConfirmed:true,employees:[worker]});
  const revoke=await engine.action({action:'revoke',companyId:'c1',ownerConfirmed:true});
  assert.equal(revoke.revoked,2);
  const blocked=await engine.evidence({companyId:'c1',employeeId:worker.employeeId,title:'GitHub public-apis/public-apis'});
  assert.equal(blocked.authorized,false);assert.equal(calls.length,0);
 });
});
test('server rejects duplicate employees, malformed company ids, and unsupported status mutations',async()=>{
 await fixture(async({engine})=>{
  await assert.rejects(engine.action({action:'enable',ownerConfirmed:true,companyId:'../secret',employees:[worker]}),/valid company/);
  await assert.rejects(engine.action({action:'enable',ownerConfirmed:true,companyId:'c1',employees:[worker,worker]}),/Duplicate/);
  await assert.rejects(engine.action({action:'publish',ownerConfirmed:true,companyId:'c1'}),/Unsupported/);
  const status=await engine.status('c1');assert.equal(status.grants.length,0);
 });
});
