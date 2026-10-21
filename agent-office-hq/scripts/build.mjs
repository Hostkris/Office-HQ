/** Produce a safe, static-only site: never copy .env files or server-side sources. */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = ['index.html', 'cloud.html', 'cloud.js', 'assignment-library.js', 'workforce-lean.js', 'app.js', 'office-features.js', 'mac.html', 'mac-share.js', 'officehq-voice.js', 'officehq-voice.css', 'ceo-secure-chat.js', 'ceo-secure-chat.css', 'officehq-device-sync.js', 'officehq-sync.css', 'project-floor.js', 'office-life.js', 'department-offices.js', 'deliverables.js', 'integration-center.js', 'department-access.js', 'department-projects.js', 'department-ui.css', 'agent-health.js', 'website-access.js', 'website-access.css', 'coding-tasks.js', 'coding-tasks.css', 'desktop-workstations.js', 'openmausbot.js', 'workforce-runtime.js', 'research-center.js', 'ios-workstations.js', 'refresh.js', 'theme.js', 'styles.css', 'sw.js', 'icon.svg', 'manifest.webmanifest'];
await rm(dist, {recursive:true, force:true});
await mkdir(dist, {recursive:true});
// Publish both the project-root URL and the long-standing /agent-office-hq/
// URL. Safari Home Screen links and AirDrop guides already use the latter.
// Each directory contains the same safe static assets; no Node backend leaks.
const legacyPath=path.join(dist,'agent-office-hq');
await mkdir(legacyPath,{recursive:true});
for(const file of assets){
  await cp(path.join(root,file),path.join(dist,file));
  await cp(path.join(root,file),path.join(legacyPath,file));
}
// GitHub Pages must serve files as-is (no Jekyll preprocessing).
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Built ${assets.length} public files into dist/ (no backend or secrets)`);

