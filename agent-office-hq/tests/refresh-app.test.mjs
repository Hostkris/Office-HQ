import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const source=await readFile(new URL('../refresh.js',import.meta.url),'utf8');
const swSource=await readFile(new URL('../sw.js',import.meta.url),'utf8');
const ROOT='https://hostkris.github.io/Office-HQ/agent-office-hq/';
const liveHTML='<html><button id="appRefreshBtn"></button><script src="refresh.js"></script></html>';
function makeRefresh({online=true,networkOk=true,serviceWorker}={}){
 let click,requested=[],navigation=[],dataCleared=false;
 const button={
  disabled:false,innerHTML:'↻ <span>Refresh App</span>',textContent:'',
  addEventListener:(type,fn)=>{if(type==='click')click=fn;},
  setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];}
 };
 const status={textContent:''};
 const document={
  baseURI:ROOT,
  getElementById:id=>id==='appRefreshBtn'?button:id==='appRefreshStatus'?status:null
 };
 const location={
  href:ROOT+'#/thread',
  replace:url=>navigation.push(String(url))
 };
 const navigator={onLine:online};
 if(serviceWorker)navigator.serviceWorker=serviceWorker;
 const localStorage={clear(){dataCleared=true;},removeItem(){dataCleared=true;}};
 const fetch=async(url,opts)=>{
  requested.push({url:String(url),cache:opts.cache});
  const isSW=new URL(String(url)).pathname.endsWith('/sw.js');
  return {ok:networkOk,status:networkOk?200:503,
   text:async()=>!networkOk?'':isSW?"const CACHE='agent-office-hq-v31-reliable-refresh';self.addEventListener('fetch',()=>{});":liveHTML};
 };
 vm.runInNewContext(source,{window:{location},document,navigator,localStorage,fetch,
  URL,Date,AbortController,setTimeout,clearTimeout,console},{filename:'refresh.js'});
 return {click:()=>click(),button,status,requested,navigation,readDataClear:()=>dataCleared};
}
test('Refresh App bypasses old HTML cache and preserves the current phone thread route and local data',async()=>{
 const app=makeRefresh();
 await app.click();
 assert.equal(app.navigation.length,1);
 const url=new URL(app.navigation[0]);
 assert.equal(url.pathname,'/Office-HQ/agent-office-hq/');
 assert.equal(url.hash,'#/thread');
 assert.ok(url.searchParams.has('hq_refresh'));
 assert.equal(app.requested.length,2,'check only live service-worker script and shell, not a fragile asset batch');
 assert.ok(new URL(app.requested[0].url).searchParams.has('hq_probe'));
 assert.ok(new URL(app.requested[1].url).searchParams.has('hq_check'));
 assert.ok(app.requested.every(x=>x.cache==='no-store'));
 assert.equal(app.readDataClear(),false,'must never wipe records to refresh the app');
});
test('Refresh App updates and activates a waiting service worker before opening new page',async()=>{
 const handlerMap=new Map(),messages=[];
 const serviceWorker={
  getRegistration:async()=>({
   waiting:{postMessage:message=>messages.push(message)},
   update:async()=>{handlerMap.get('controllerchange')?.();}
  }),
  addEventListener:(event,handler)=>handlerMap.set(event,handler),
  removeEventListener:(event,handler)=>{
   if(handlerMap.get(event)===handler)handlerMap.delete(event);
  }
 };
 const app=makeRefresh({serviceWorker});
 await app.click();
 assert.equal(messages.length,1);
 assert.equal(messages[0].type,'ACTIVATE_NOW');
 assert.equal(app.navigation.length,1);
});
test('Refresh App handles unreachable network without reloading or clearing records',async()=>{
 const app=makeRefresh({networkOk:false});
 await app.click();
 assert.equal(app.navigation.length,0);
 assert.equal(app.button.disabled,false,'retry should become available');
 assert.match(app.status.textContent,/retry/i);
 assert.equal(app.readDataClear(),false);
});
test('Refresh App says offline when device has no connection',async()=>{
 const app=makeRefresh({online:false});
 await app.click();
 assert.equal(app.navigation.length,0);
 assert.match(app.status.textContent,/Offline/);
 assert.equal(app.button.disabled,false);
});
function makeSW({offline=false}={}){
 const handlers=new Map(),stored=new Map(),requests=[];
 const scope=ROOT;
 const cache={
  addAll:async()=>{},
  put:async(req,resp)=>{stored.set(req.url||String(req),resp);},
  match:async req=>stored.get(req.url||String(req))
 };
 const caches={
  open:async()=>cache,
  keys:async()=>['unrelated-app-cache','agent-office-hq-v30-reliable-refresh','agent-office-hq-v31-reliable-refresh'],
  delete:async key=>{requests.push('delete:'+key);return true;},
  match:async req=>stored.get(req.url||String(req))
 };
 const fetch=async(req,opts)=>{
  requests.push({url:req.url,cache:opts.cache});
  if(offline)throw Error('Device offline');
  return {ok:true,clone:()=>({body:'cached-new'}),body:'live-new'};
 };
 const self={
  location:{origin:'https://hostkris.github.io'},
  registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},
  addEventListener:(name,handler)=>handlers.set(name,handler)
 };
 vm.runInNewContext(swSource,{self,caches,fetch,URL,Request,Response,Set,Promise,console});
 return {handlers,stored,requests};
}
test('Service worker uses fresh network assets and normalized cache key on cache-busted iOS route',async()=>{
 const sw=makeSW(),pending=[];
 let response;
 const event={
  request:new Request(ROOT+'index.html?hq_refresh=1234'),
  respondWith:p=>{response=p;},
  waitUntil:p=>pending.push(p)
 };
 sw.handlers.get('fetch')(event);
 const result=await response;
 await Promise.all(pending);
 assert.equal(result.body,'live-new');
 assert.equal(sw.requests[0].cache,'no-store');
 assert.equal(sw.stored.has(ROOT+'index.html'),true);
 assert.equal(sw.stored.has(ROOT+'index.html?hq_refresh=1234'),false);
});
test('Service worker can show cached site when connection drops after launch',async()=>{
 const sw=makeSW({offline:true}),pending=[];
 sw.stored.set(ROOT+'index.html',{body:'offline-shell'});
 let response;
 sw.handlers.get('fetch')({
  request:new Request(ROOT+'index.html?hq_refresh=1234'),
  respondWith:p=>response=p,
  waitUntil:p=>pending.push(p)
 });
 assert.equal((await response).body,'offline-shell');
});
test('Service worker leaves unrelated site caches untouched on upgrade',async()=>{
 const sw=makeSW();let work;
 sw.handlers.get('activate')({waitUntil:p=>work=p});
 await work;
 assert.ok(sw.requests.includes('delete:agent-office-hq-v30-reliable-refresh'))
 assert.ok(!sw.requests.includes('delete:unrelated-app-cache'));
});
