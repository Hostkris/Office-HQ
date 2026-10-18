import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=async name=>readFile(join(root,name),'utf8');
const [web,bridge,background,agent,popup,manifestFile]=await Promise.all([
 source('ios-workstations.js'),
 source('ios-safari-extension/office-bridge.js'),
 source('ios-safari-extension/background.js'),
 source('ios-safari-extension/website-agent.js'),
 source('ios-safari-extension/popup.html'),
 source('ios-safari-extension/manifest.json')
]);
const manifest=JSON.parse(manifestFile);
test('iOS workstation serves native browser links and presents honest extension-only limitations',()=>{
 assert.doesNotThrow(()=>new vm.Script(web));
 assert.match(web,/iPhone\|iPad\|iPod/);
 assert.match(web,/Safari extension is not installed/);
 assert.match(web,/not an autonomous browser job/);
 assert.match(web,/iosJobs/);
 assert.match(web,/target="_blank" rel="noopener noreferrer"/);
 assert.match(web,/extension/i);
});
test('WebExtension is limited to approved domains and deliberately excludes cookie/tab surveillance',()=>{
 assert.equal(manifest.manifest_version,3);
 assert.ok(manifest.content_scripts.some(e=>e.js.includes('office-bridge.js')));
 assert.ok(manifest.content_scripts.some(e=>e.js.includes('website-agent.js')));
 assert.ok(manifest.permissions.includes('storage'));
 assert.ok(!manifest.permissions.includes('cookies'));
 assert.ok(!manifest.host_permissions.includes('<all_urls>'));
 assert.ok(manifest.host_permissions.includes('https://hostkris.github.io/Office-HQ/*'));
 assert.doesNotThrow(()=>new vm.Script(bridge));
 assert.doesNotThrow(()=>new vm.Script(background));
 assert.doesNotThrow(()=>new vm.Script(agent));
 assert.match(popup,/Office HQ Safari helper/);
});
test('Safari extension rejects non-HQ commands, unauthorized employees and write actions on sensitive sites',()=>{
 assert.match(bridge,/event\.origin!==location\.origin/);
 assert.match(background,/Only the Office HQ page can request work/);
 assert.match(background,/This account is restricted to read-only assistance/);
 assert.match(background,/Employee is not authorized for this website/);
 assert.match(background,/browser\.storage\.local/);
 assert.match(agent,/selected field/);
 assert.match(agent,/No submit, send or publish button was pressed/);
 assert.doesNotMatch(agent,/\.submit\(/);
 assert.doesNotMatch(background,/password|cookies/gi);
});
