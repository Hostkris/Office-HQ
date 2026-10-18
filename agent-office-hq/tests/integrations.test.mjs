import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(path.join(root,file),'utf8');
const [catalog,roles,html,build]=await Promise.all([
 read('integration-center.js'),read('office-features.js'),read('index.html'),read('scripts/build.mjs')
]);
test('integration center is valid JavaScript and loaded after workforce authorization UI',()=>{
 assert.doesNotThrow(()=>new vm.Script(catalog));
 assert.ok(html.indexOf('office-features.js')<html.indexOf('integration-center.js'));
 assert.match(build,/integration-center\.js/);
});
test('all requested business platforms appear in the setup catalog',()=>{
 for(const provider of ['Gmail','iCloud','X (Twitter)','Instagram','Shopify','Etsy','TikTok','Lemon8','Lemonade','Chime','Facebook','ChatGPT']){
  assert.ok(catalog.includes("name:'"+provider+"'"),provider+' missing from integration catalog');
  assert.ok(roles.includes("'"+provider+"'"),provider+' missing from account-label dropdown');
 }
});
test('no misleading connected badge or live transfers in static integration planner',()=>{
 assert.match(catalog,/Secure OAuth gateway deployed/);
 assert.match(catalog,/Not running/);
 assert.match(catalog,/enabled:false/);
 assert.doesNotMatch(catalog,/fetch\s*\(|XMLHttpRequest|localStorage\.setItem\(['"]access_token/);
});
test('preconfigured templates still require real backend and CEO-approved actions',()=>{
 assert.ok(catalog.includes('server-enforced permissions'));
 assert.ok(catalog.includes('CEO approval required'));
 assert.ok(catalog.includes('Disabled until verified server integration'));
});
