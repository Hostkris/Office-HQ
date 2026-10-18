import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
test('GitHub Pages root redirect preserves iPhone workstation hash and search string',async()=>{
 const html=await readFile(join(root,'index.html'),'utf8');
 const match=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(match,'root redirect needs executable script');
 let captured;
 const location={
  href:'https://hostkris.github.io/Office-HQ/?ref=mobile#/workstations',
  search:'?ref=mobile',hash:'#/workstations',
  replace(dest){captured=new URL(String(dest));}
 };
 vm.runInNewContext(match[1],{URL,location});
 assert.equal(captured.origin,'https://hostkris.github.io');
 assert.equal(captured.pathname,'/Office-HQ/agent-office-hq/');
 assert.equal(captured.search,'?ref=mobile');
 assert.equal(captured.hash,'#/workstations');
});
test('installed iPhone app caches essential account and workstation controls',async()=>{
 const sw=await readFile(join(root,'agent-office-hq/sw.js'),'utf8');
 const refresh=await readFile(join(root,'agent-office-hq/refresh.js'),'utf8');
 for(const name of ['app.js','integration-center.js','desktop-workstations.js','ios-workstations.js','project-floor.js','office-life.js']){
  assert.ok(sw.includes("'./"+name+"'"),'offline cache missing '+name);
  assert.ok(refresh.includes("'./"+name+"'"),'Refresh App missing '+name);
 }
 assert.match(sw,/agent-office-hq-v8/);
});
test('published site skips nonexistent localhost AI endpoint unless served locally',async()=>{
 const app=await readFile(join(root,'agent-office-hq/app.js'),'utf8');
 assert.match(app,/endpoint\.startsWith\('\/'\).*location\.hostname/);
});
