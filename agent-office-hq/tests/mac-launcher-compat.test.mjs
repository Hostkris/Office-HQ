import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('legacy OpenMausBot worker no longer prevents independent Ollama server startup',async()=>{
 const worker=await readFile(new URL('../openmaus/workforce-engine.mjs',import.meta.url),'utf8');
 const native=await readFile(new URL('../native-engine/bridge.mjs',import.meta.url),'utf8');
 const server=await readFile(new URL('../server.mjs',import.meta.url),'utf8');
 const installer=await readFile(new URL('../../mac/install.command',import.meta.url),'utf8');
 // Original Mac 1.2 overlay intentionally does NOT export localCli.
 // Static named imports in the worker used to crash Node.js before listen().
 assert.doesNotMatch(worker,/import\s*\{\s*localCli\s*\}\s*from\s*['"]\.\/bridge\.mjs['"]/);
 assert.match(worker,/await\s+import\(['"]\.\/bridge\.mjs['"]\)/);
 assert.match(worker,/typeof bridge\.localCli !==?['"]function['"]|typeof bridge\.localCli!==['"]function['"]/);
 assert.match(native,/export function createOpenMausBridge/);
 assert.doesNotMatch(native,/export\s+(?:async\s+)?(?:function|const)\s+localCli/);
 assert.match(server,/from ['"]\.\/native-engine\/bridge\.mjs['"]/);
 assert.match(installer,/openmaus\/workforce-engine\.mjs/);
 assert.match(installer,/BACKUP.*dirname.*item/);
});
