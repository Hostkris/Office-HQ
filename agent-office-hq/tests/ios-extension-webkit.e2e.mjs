// Tests Safari-extension content scripts in the real WebKit engine using controlled
// test pages. This does NOT install an iOS Safari extension or access real accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {webkit,devices} from 'playwright';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const agentSource=await readFile(join(root,'ios-safari-extension/website-agent.js'),'utf8');
const bridgeSource=await readFile(join(root,'ios-safari-extension/office-bridge.js'),'utf8');
let browser;
test.before(async()=>{browser=await webkit.launch({headless:true});});
test.after(async()=>{await browser?.close();});
async function agentPage(device='iPhone 13'){
 const ctx=await browser.newContext({...devices[device],serviceWorkers:'block'});
 const page=await ctx.newPage();
 const html='<!doctype html><html><body><h1>Support inbox</h1>'+
   '<p id="visible">Visible request: return receipt question</p>'+
   '<div style="display:none"><p id="hidden">SECRET_HIDDEN_TEXT</p></div>'+
   '<input id="secret" type="password" value="SECRET_INPUT_PASSWORD">'+
   '<textarea id="message" placeholder="Draft message"></textarea>'+
   '<input id="normal" type="text" name="note">'+
   '<div id="editable" contenteditable="true">Rich editor</div></body></html>';
 await page.goto('data:text/html,'+encodeURIComponent(html));
 await page.evaluate(()=>{
   window.browser={runtime:{onMessage:{addListener(fn){window.__officeAgentMessage=fn;}}}};
   window.__eventCount=0;
   document.querySelector('#message').addEventListener('input',()=>{window.__eventCount+=1});
 });
 await page.addScriptTag({content:agentSource});
 return {page,ctx};
}
test('iPhone WebKit: extension reads visible text without hidden content or entered password',async()=>{
 const {page,ctx}=await agentPage();
 try{
  const result=await page.evaluate(()=>window.__officeAgentMessage({channel:'officehq-ios-site',action:'inspect'}));
  assert.equal(result.ok,true);
  assert.match(result.excerpt,/Support inbox/);
  assert.match(result.excerpt,/Visible request/);
  assert.doesNotMatch(result.excerpt,/SECRET_HIDDEN_TEXT/);
  assert.doesNotMatch(result.excerpt,/SECRET_INPUT_PASSWORD/);
  assert.ok(result.excerpt.length<=1600);
 }finally{await ctx.close();}
});
test('iPhone WebKit: inserts a draft in a normal field but never password or rich editor',async()=>{
 const {page,ctx}=await agentPage();
 try{
  await page.locator('#message').focus();
  const inserted=await page.evaluate(()=>window.__officeAgentMessage({channel:'officehq-ios-site',action:'insert',text:'Please provide the order number.'}));
  assert.equal(inserted.ok,true);
  assert.equal(await page.locator('#message').inputValue(),'Please provide the order number.');
  assert.equal(await page.evaluate(()=>window.__eventCount),1);
  await page.locator('#secret').focus();
  const blocked=await page.evaluate(()=>window.__officeAgentMessage({channel:'officehq-ios-site',action:'insert',text:'Never type credentials'}));
  assert.equal(blocked.ok,false);
  assert.equal(await page.locator('#secret').inputValue(),'SECRET_INPUT_PASSWORD');
  await page.locator('#editable').focus();
  assert.equal((await page.evaluate(()=>window.__officeAgentMessage({channel:'officehq-ios-site',action:'insert',text:'Unsafe rich editor'}))).ok,false);
  assert.equal(await page.locator('#editable').innerText(),'Rich editor');
 }finally{await ctx.close();}
});
test('iPad WebKit: rejects unknown commands and limits drafts to 450 characters',async()=>{
 const {page,ctx}=await agentPage('iPad Pro 11');
 try{
  assert.equal(await page.evaluate(()=>window.__officeAgentMessage({channel:'not-officehq',action:'inspect'})),undefined);
  assert.equal((await page.evaluate(()=>window.__officeAgentMessage({channel:'officehq-ios-site',action:'launch-external-payment'}))).ok,false);
  await page.locator('#normal').focus();
  const response=await page.evaluate(()=>window.__officeAgentMessage({channel:'officehq-ios-site',action:'insert',text:'X'.repeat(900)}));
  assert.equal(response.ok,true);
  assert.equal((await page.locator('#normal').inputValue()).length,450);
 }finally{await ctx.close();}
});
test('WebKit: real Office HQ message bridge handles approved commands and refuses unauthorized commands',async()=>{
 const ctx=await browser.newContext({...devices['iPad Pro 11'],serviceWorkers:'block'});
 const page=await ctx.newPage();
 const url='https://hostkris.github.io/Office-HQ/extension-harness.html';
 await page.route(url,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><head><title>Office HQ extension harness</title></head><body>Office HQ</body></html>'}));
 try{
  await page.goto(url);
  await page.evaluate(()=>{
    window.__sent=[];
    window.browser={runtime:{sendMessage:async request=>{
      window.__sent.push(request);
      return {ok:true,mode:'simulated-extension-response'};
    }}};
  });
  await page.addScriptTag({content:bridgeSource});
  const response=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const id='live-bridge-message';
    const timer=setTimeout(()=>reject(Error('Bridge did not respond')),2500);
    function handler(event){
      if(event.data?.sender!=='officehq-extension'||event.data.id!==id)return;
      clearTimeout(timer);window.removeEventListener('message',handler);resolve(event.data.response);
    }
    window.addEventListener('message',handler);
    window.postMessage({channel:'officehq-ios-web-v1',sender:'officehq-page',id,command:'status',payload:{companyId:'company1'}},location.origin);
  }));
  assert.equal(response.ok,true);
  const sent=await page.evaluate(()=>window.__sent);
  assert.equal(sent.length,1);
  assert.equal(sent[0].type,'office-command');
  assert.equal(sent[0].command,'status');
  await page.evaluate(()=>window.postMessage({channel:'officehq-ios-web-v1',sender:'officehq-page',id:'bad',command:'make-payment'},location.origin));
  await page.waitForTimeout(80);
  assert.equal((await page.evaluate(()=>window.__sent)).length,1);
 }finally{await ctx.close();}
});
