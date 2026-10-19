import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rolesText=await readFile(path.join(root,'assignment-library.js'),'utf8');
const app=await readFile(path.join(root,'app.js'),'utf8');
test('all 174 roles have three sub-jobs',()=>{
 const roleData=rolesText.split('const rows=`')[1]?.split('`.trim().split(')[0];
 assert.ok(roleData,'assignment rows must be present');
 const rows=roleData.trim().split('\n').map(line=>line.split('|'));
 assert.equal(rows.length,174);
 assert.equal(new Set(rows.map(row=>row[0])).size,174);
 for(const row of rows){assert.equal(row.length,4,'expected a role key and three choices for '+row[0]);assert.ok(row.slice(1).every(Boolean));}
});
test('assignment and employee editors include saved custom directions',()=>{
 for(const id of ['taskPresetTitle','taskPresetCriteria','taskExtraCommands','employeeJobDescription'])assert.ok(app.includes('id="'+id+'"'));
 assert.ok(app.includes('additionalCommands:String(p.additionalCommands'));
 assert.ok(app.includes('e.jobDescription=String(p.jobDescription'));
 assert.ok(app.includes('description:fullTaskDescription(t)'));
});
