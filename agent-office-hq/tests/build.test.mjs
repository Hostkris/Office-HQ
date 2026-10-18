import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('static publish artifact contains required files but no backend or secrets',async()=>{
  const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8'});
  assert.equal(build.status,0,build.stderr);
  const files=await readdir(path.join(root,'dist'));
  assert.deepEqual(files.sort(),['.nojekyll','app.js','cloud.html','cloud.js','office-features.js','integration-center.js','desktop-workstations.js','ios-workstations.js','refresh.js','icon.svg','index.html','manifest.webmanifest','styles.css','sw.js'].sort());
  const html=await readFile(path.join(root,'dist','index.html'),'utf8');
  for(const name of ['cloud.html','app.js','office-features.js','integration-center.js','desktop-workstations.js','ios-workstations.js','refresh.js','styles.css','manifest.webmanifest','icon.svg'])assert.match(html,new RegExp(name.replace('.','\\.')));
  assert.doesNotMatch(html,/src="\//);
});
