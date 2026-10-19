import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rolesText=await readFile(path.join(root,'assignment-library.js'),'utf8');
const app=await readFile(path.join(root,'app.js'),'utf8');
test('all 168 roles have three sub-jobs',()=>{
 const keys=[...rolesText.matchAll(/^([a-z_]+)\|[^\n]+/gm)].map(m=>m[1]);
 assert.equal(keys.length,168);
 assert.equal(new Set(keys).size,168);
 for(const line of rolesText.split('\n').filter(line=>/^[a-z_]+\|/.test(line))){assert.equal(line.split('|').length,4);}
});
test('assignment and employee editors include saved custom directions',()=>{
 for(const id of ['taskPresetTitle','taskPresetCriteria','taskExtraCommands','employeeJobDescription'])assert.ok(app.includes('id="'+id+'"'));
 assert.ok(app.includes('additionalCommands:String(p.additionalCommands'));
 assert.ok(app.includes('e.jobDescription=String(p.jobDescription'));
 assert.ok(app.includes('description:fullTaskDescription(t)'));
});
