import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../app-startup.js',import.meta.url),'utf8');
function scene({bridge=true,route='command',starting=false,host='127.0.0.1',registrations=[]}={}){
 const events={},calls={registrations:0,unregister:[],storage:0};
 const view={textContent:'Existing workspace screen',innerHTML:'original screen',querySelector:()=>starting?{}:null};
 const document={baseURI:'http://'+host+'/',readyState:'loading',
  getElementById:id=>id==='view'?view:null,addEventListener:(name,fn)=>{events[name]=fn;}};
 const window={addEventListener:(name,fn)=>{events[name]=fn;}};
 if(bridge){window.OfficeHQBridge={};window.OfficeHQExtraViews={thread(){},access(){},coding(){}};window.OfficeHQSecureChat={};}
 const navigator={serviceWorker:{getRegistrations:async()=>{calls.registrations++;return registrations.map(r=>({...r,unregister:async()=>{calls.unregister.push(r.scope);return true;}}));}}};
 const storage={clear(){calls.storage++;throw Error('Must not erase workspace');},removeItem(){calls.storage++;throw Error('Must not erase workspace');}};
 vm.runInNewContext(source,{window,document,location:{origin:'http://'+host,hostname:host,hash:'#/'+route},navigator,localStorage:storage,indexedDB:storage,URL,Date,Promise,Set},{filename:'app-startup.js'});
 return {window,view,calls,events,ready:async()=>{events.DOMContentLoaded();await new Promise(r=>setImmediate(r));}};
}
test('failed startup replaces the loading shell with a usable retry/update screen and preserves records',async()=>{
 const s=scene({bridge:false,route:'coding',starting:true});
 s.events.error({filename:'http://127.0.0.1/app.js?v=current'});
 await s.ready();
 assert.match(s.view.innerHTML,/could not finish loading/);
 assert.match(s.view.innerHTML,/app\.js/);
 assert.match(s.view.innerHTML,/coding-tasks\.js/);
 assert.match(s.view.innerHTML,/hq_retry=.*#\/coding/);
 assert.equal(s.calls.storage,0);
});
test('a partially initialized app cannot leave the initial loading placeholder forever',async()=>{
 const s=scene({starting:true});await s.ready();assert.match(s.view.innerHTML,/could not finish loading/);
});
test('healthy screens are retained; missing dedicated screens never become Command Center',async()=>{
 const good=scene({route:'thread'});await good.ready();assert.equal(good.view.innerHTML,'original screen');
 const bad=scene({route:'access'});delete bad.window.OfficeHQExtraViews.access;await bad.ready();
 assert.match(bad.view.innerHTML,/website-access\.js/);assert.doesNotMatch(bad.view.innerHTML,/Your workforce, one command/);
});
test('Mac cache retirement unregisters only Office HQ at its exact scope and never erases records',async()=>{
 const s=scene({registrations:[
  {scope:'http://127.0.0.1/',active:{scriptURL:'http://127.0.0.1/sw.js'}},
  {scope:'http://127.0.0.1/other/',active:{scriptURL:'http://127.0.0.1/other/sw.js'}},
  {scope:'http://127.0.0.1/',active:{scriptURL:'http://127.0.0.1/unrelated.js'}}
 ]});await s.ready();assert.deepEqual(s.calls.unregister,['http://127.0.0.1/']);assert.equal(s.calls.storage,0);
});
test('hosted iPhone startup leaves offline support registered',async()=>{
 const s=scene({host:'hostkris.github.io'});await s.ready();assert.equal(s.calls.registrations,0);assert.equal(s.view.innerHTML,'original screen');
});
