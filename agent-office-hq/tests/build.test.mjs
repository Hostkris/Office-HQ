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
  assert.deepEqual(files.sort(),['.nojekyll','agent-office-hq','assignment-library.js','workforce-lean.js','app.js','cloud.html','cloud.js','office-features.js','mac.html','mac-share.js','officehq-voice.js','officehq-voice.css','ceo-secure-chat.js','ceo-secure-chat.css','officehq-device-sync.js','officehq-sync.css','deliverables.js','project-floor.js','office-life.js','department-offices.js','integration-center.js','desktop-workstations.js','openmausbot.js','workforce-runtime.js','research-center.js','ios-workstations.js','refresh.js','theme.js','icon.svg','index.html','manifest.webmanifest','styles.css','sw.js'].sort());
  const nested=await readdir(path.join(root,'dist','agent-office-hq'));
  assert.deepEqual(nested.sort(),files.filter(f=>f!=='.nojekyll'&&f!=='agent-office-hq').sort(),
    'Historical /agent-office-hq/ URL must publish all front-end files, never backend code');
  const html=await readFile(path.join(root,'dist','index.html'),'utf8');
  for(const name of ['cloud.html','assignment-library.js','workforce-lean.js','app.js','office-features.js','mac.html','mac-share.js','officehq-voice.js','officehq-voice.css','ceo-secure-chat.js','ceo-secure-chat.css','officehq-device-sync.js','officehq-sync.css','deliverables.js','project-floor.js','office-life.js','department-offices.js','integration-center.js','desktop-workstations.js','ios-workstations.js','refresh.js','theme.js','styles.css','manifest.webmanifest','icon.svg'])assert.match(html,new RegExp(name.replace('.','\\.')));
  assert.doesNotMatch(html,/src="\//);
});
