// Simulates extension message delivery and storage. It does not run on physical iOS Safari.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createContext,Script} from 'node:vm';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=await readFile(join(root,'ios-safari-extension/background.js'),'utf8');

function sandbox(){
 let cb,grants=[];
 let tabs=[
  {id:100,url:'https://mail.google.com/mail/u/0/#inbox'},
  {id:101,url:'https://www.chime.com/'},
  {id:102,url:'https://www.instagram.com/'}
 ];
 const deliveries=[];
 const browser={
  runtime:{onMessage:{addListener(fn){cb=fn;}}},
  storage:{local:{
   async get(key){return {[key]:grants};},
   async set(obj){grants=Object.values(obj)[0];}
  }},
  tabs:{
   async query(){return tabs;},
   async sendMessage(tabId,payload){
    deliveries.push({tabId,payload});
    return {ok:true,excerpt:'A test page with one real visible heading',title:'Inbox',note:'Webpage inspection completed'};
   }
  }
 };
 const context=createContext({browser,URL,Date,console});
 new Script(source,{filename:'background.js'}).runInContext(context);
 const pageSender={tab:{id:200,url:'https://hostkris.github.io/Office-HQ/index.html'}};
 const call=(command,payload={},sender=pageSender)=>cb({type:'office-command',command,payload},sender);
 return {call,deliveries,get grants(){return grants;},setTabs(next){tabs=next;},pageSender};
}
test('real Safari extension coordinator rejects outsiders and requires consent and an open matching tab',async()=>{
 const ext=sandbox();
 assert.equal((await ext.call('ping',{}, {tab:{url:'https://evil.com/Office-HQ/'}})).ok,false);
 assert.equal((await ext.call('authorize',{companyId:'company1',employeeId:'e1',site:'gmail',department:'Marketing'})).ok,false);
 assert.equal((await ext.call('authorize',{companyId:'company1',employeeId:'e1',site:'gmail',department:'Finance',confirmed:true})).ok,false);
 const ok=await ext.call('authorize',{companyId:'company1',employeeId:'e1',employeeName:'Customer Service',site:'gmail',department:'Customer',confirmed:true});
 assert.equal(ok.ok,true);
 assert.equal(ext.grants.length,1);
 assert.equal(ext.grants[0].employeeId,'e1');
 const status=await ext.call('status',{companyId:'company1'});
 assert.equal(status.grants.length,1);
 const result=await ext.call('inspect',{companyId:'company1',employeeId:'e1',site:'gmail'});
 assert.equal(result.ok,true);
 assert.equal(result.excerpt,'A test page with one real visible heading');
 assert.equal(ext.deliveries.at(-1).tabId,100);
 assert.equal(ext.deliveries.at(-1).payload.action,'inspect');
 const prohibited=await ext.call('inspect',{companyId:'company1',employeeId:'e2',site:'gmail'});
 assert.equal(prohibited.ok,false);
 const revoked=await ext.call('revoke',{companyId:'company1',employeeId:'e1',site:'gmail'});
 assert.equal(revoked.ok,true);
 assert.equal((await ext.call('inspect',{companyId:'company1',employeeId:'e1',site:'gmail'})).ok,false);
});
test('iPhone Safari helper refuses writes to financial websites even after employee authorization',async()=>{
 const ext=sandbox();
 const perm=await ext.call('authorize',{companyId:'company1',employeeId:'fin1',employeeName:'Treasury',site:'chime',department:'Finance',confirmed:true});
 assert.equal(perm.ok,true);
 assert.equal((await ext.call('insert',{companyId:'company1',employeeId:'fin1',site:'chime',draft:'Pay someone'})).ok,false);
 assert.equal(ext.deliveries.length,0,'never send an insertion message to a financial tab');
 assert.equal((await ext.call('inspect',{companyId:'company1',employeeId:'fin1',site:'chime'})).ok,true);
 const forgotten=await ext.call('forget',{companyId:'company1',site:'chime',confirm:'FORGET'});
 assert.equal(forgotten.ok,true);
 assert.equal(ext.grants.length,0);
});
test('extension never finds a misleading lookalike hostname or invents a connected account',async()=>{
 const ext=sandbox();
 ext.setTabs([{id:33,url:'https://mail.google.com.evil.example/'}]);
 const r=await ext.call('authorize',{companyId:'company1',employeeId:'e1',employeeName:'Support',site:'gmail',department:'Customer',confirmed:true});
 assert.equal(r.ok,false);
 assert.equal(ext.grants.length,0);
});
