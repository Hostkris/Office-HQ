import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,copyFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
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
 assert.doesNotMatch(installer,/coding-worker\.mjs native-engine\/openrouter-provider\.mjs/);
 assert.match(installer,/mv "\$WEB\/native-engine\/openrouter-provider\.mjs" "\$BACKUP\/native-engine\/openrouter-provider\.mjs"/);
});

test('runtime import succeeds when the old 1.2 Mac bridge does not export localCli',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'officehq-mac-compat-'));
 try{
  await copyFile(new URL('../openmaus/workforce-engine.mjs',import.meta.url),join(folder,'workforce-engine.mjs'));
  await copyFile(new URL('../openmaus/team.mjs',import.meta.url),join(folder,'team.mjs'));
  await copyFile(new URL('../openmaus/essential-workforce.json',import.meta.url),join(folder,'essential-workforce.json'));
  await writeFile(join(folder,'bridge.mjs'),
    'export function createOpenMausBridge() { return {status(){ return {}; }}; }\n');
  const loaded=await import(pathToFileURL(join(folder,'workforce-engine.mjs')).href);
  assert.equal(typeof loaded.createWorkforceEngine,'function',
    'legacy worker must import without its original CLI export');
 }finally{await rm(folder,{recursive:true,force:true});}
});
