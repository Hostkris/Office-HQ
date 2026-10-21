import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPublicTools} from '../research/public-tools.mjs';

async function fixture(run){
 const root=await mkdtemp(join(tmpdir(),'hq-public-tools-'));
 const calls=[];
 const service=createPublicTools({root,request:async (url,options)=>{
  calls.push({url,options});
  let payload;
  if(url.startsWith('https://api.github.com/repos/'))payload={full_name:'public-apis/public-apis',private:false,description:'Open APIs',stargazers_count:900,default_branch:'master',updated_at:'2026-10-20T12:00:00Z'};
  else if(url.startsWith('https://api.frankfurter.dev/'))payload={date:'2026-10-19',rates:{EUR:0.86}};
  else if(url.startsWith('https://world.openfoodfacts.org/'))payload={status:1,product:{product_name:'Example food',brands:'Example brand',quantity:'200g'}};
  else throw Error('Unexpected host: '+url);
  return {ok:true,text:async()=>JSON.stringify(payload)};
 }});
 try{await run(service,calls);}finally{await rm(root,{recursive:true,force:true});}
}
const grant=(companyId='company1')=>({action:'grant-batch',companyId,ownerConfirmed:true,employees:[
 {employeeId:'marketing1',roleKey:'research'},
 {employeeId:'finance1',roleKey:'budget_officer'},
 {employeeId:'operations1',roleKey:'inventory_mgr'},
 {employeeId:'technology1',roleKey:'integrator'}
]});

test('blank public tools workspace is safe and requires CEO consent',async()=>{
 await fixture(async service=>{
  assert.equal((await service.status()).grants.length,0);
  await assert.rejects(service.action({...grant(),ownerConfirmed:false}),/CEO approval/);
  await assert.rejects(service.lookup({companyId:'company1',employeeId:'marketing1',roleKey:'research',provider:'github-public',input:'public-apis/public-apis'}),/not authorized/);
 });
});
test('one tap expands to separate department-specific employee/API grants',async()=>{
 await fixture(async service=>{
  const r=await service.action(grant());
  assert.ok(r.added>=4);assert.ok(r.added<=12);
  const status=await service.status();
  const grants=status.grants;
  assert.ok(grants.some(g=>g.employeeId==='marketing1'&&g.provider==='github-public'));
  assert.ok(grants.some(g=>g.employeeId==='finance1'&&g.provider==='frankfurter'));
  assert.ok(grants.some(g=>g.employeeId==='operations1'&&g.provider==='openfoodfacts'));
  assert.ok(!grants.some(g=>g.employeeId==='finance1'&&g.provider==='github-public'));
  assert.equal((await service.action(grant())).added,0,'repeat approval is idempotent');
  await assert.rejects(service.lookup({companyId:'company1',employeeId:'finance1',roleKey:'budget_officer',provider:'github-public',input:'foo/bar'}),/not eligible/);
 });
});
test('real GET-only public lookup returns limited sourced data, never credential headers',async()=>{
 await fixture(async(service,calls)=>{
  await service.action(grant());
  const g=await service.lookup({companyId:'company1',employeeId:'marketing1',roleKey:'research',provider:'github-public',input:'public-apis/public-apis'});
  assert.equal(g.data.name,'public-apis/public-apis');
  assert.equal(g.readOnly,true);
  const fx=await service.lookup({companyId:'company1',employeeId:'finance1',roleKey:'budget_officer',provider:'frankfurter',input:'USD-EUR'});
  assert.equal(fx.data.rate,0.86);
  const food=await service.lookup({companyId:'company1',employeeId:'operations1',roleKey:'inventory_mgr',provider:'openfoodfacts',input:'3017620422003'});
  assert.equal(food.data.name,'Example food');
  assert.ok(calls.every(x=>x.options.method==='GET'&&x.options.redirect==='error'));
  assert.ok(calls.every(x=>!('Authorization' in x.options.headers)&&!('Cookie' in x.options.headers)));
  await assert.rejects(service.lookup({companyId:'company1',employeeId:'marketing1',roleKey:'research',provider:'github-public',input:'https://evil.example/'}),/public owner\/repository/);
 });
});
test('agent only retrieves public facts when task explicitly names a supported source and has a grant',async()=>{
 await fixture(async(service,calls)=>{
  await service.action(grant());
  const generic=await service.contextFor({companyId:'company1',employeeId:'marketing1',roleKey:'research',title:'Find three scheduling apps',description:'General research'});
  assert.equal(generic,null);
  assert.equal(calls.length,0);
  const found=await service.contextFor({companyId:'company1',employeeId:'marketing1',roleKey:'research',title:'Research GitHub repository public-apis/public-apis',description:'Find public repo facts'});
  assert.equal(found.verifiedFromProvider,true);
  assert.equal(calls.length,1);
  const none=await service.contextFor({companyId:'another-company',employeeId:'marketing1',roleKey:'research',title:'Research GitHub repository public-apis/public-apis'});
  assert.equal(none,null);
  assert.equal(calls.length,1);
 });
});
test('CEO can revoke all company-specific grants without removing other companies',async()=>{
 await fixture(async service=>{
  await service.action(grant('company1'));
  await service.action(grant('company2'));
  const before=(await service.status()).grants.length;
  const out=await service.action({action:'revoke-company',companyId:'company1',ownerConfirmed:true});
  assert.ok(out.revoked>0);
  const after=(await service.status()).grants;
  assert.ok(after.length<before);
  assert.ok(after.every(g=>g.companyId==='company2'));
  await assert.rejects(service.lookup({companyId:'company1',employeeId:'marketing1',roleKey:'research',provider:'github-public',input:'public-apis/public-apis'}),/not authorized/);
 });
});
