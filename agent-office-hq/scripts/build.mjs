/** Produce a safe, static-only site: never copy .env files or server-side sources. */
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = ['index.html', 'cloud.html', 'cloud.js', 'assignment-library.js', 'workforce-lean.js', 'app.js', 'office-features.js', 'project-floor.js', 'office-life.js', 'department-offices.js', 'integration-center.js', 'desktop-workstations.js', 'openmausbot.js', 'ios-workstations.js', 'refresh.js', 'theme.js', 'styles.css', 'sw.js', 'icon.svg', 'manifest.webmanifest'];
await rm(dist, {recursive:true, force:true});
await mkdir(dist, {recursive:true});
for(const file of assets) await cp(path.join(root, file), path.join(dist, file));
// GitHub Pages must serve files as-is (no Jekyll preprocessing).
await writeFile(path.join(dist, '.nojekyll'), '');
console.log(`Built ${assets.length} public files into dist/ (no backend or secrets)`);
