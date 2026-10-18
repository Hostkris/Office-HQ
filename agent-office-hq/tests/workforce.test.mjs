import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'app.js'),'utf8');
const rolesLiteral=source.match(/const ROLES=\[([\s\S]*?)\]\.map\(/)?.[1];
assert.ok(rolesLiteral,'Roles should remain a declarative job matrix');
const extendedLiteral=source.match(/const EXTENDED_ROLES=(\[[^\n]*\]);/)?.[1];
assert.ok(extendedLiteral,'Expanded roles should have a declarative job matrix');
const extendedRoles=JSON.parse(extendedLiteral);
const roles=vm.runInNewContext(`[${rolesLiteral}]`,{EXTENDED_ROLES:extendedRoles});
const columns={key:0,title:1,department:2,level:3,reportsTo:4,scope:5,description:6};
const col=(r,k)=>r[columns[k]];
test('company has an extensive workforce with a project manager',()=>{
  assert.ok(roles.length>=150);
  assert.ok(roles.some(r=>col(r,'key')==='project_mgr'));
  assert.ok(roles.some(r=>col(r,'key')==='internal_auditor'));
  assert.ok(roles.some(r=>col(r,'key')==='budget_officer'));
});
test('each job has exactly one distinct execution scope',()=>{
  for(const k of ['key','scope']) {
    const list=roles.map(r=>col(r,k));
    assert.equal(new Set(list).size,list.length,`duplicate ${k}`);
    assert.ok(list.every(Boolean),`missing ${k}`);
  }
});
test('every reporting line names a real role and has no cycles',()=>{
  const keys=new Set(roles.map(r=>col(r,'key')));
  const byKey=new Map(roles.map(r=>[col(r,'key'),r]));
  for(const role of roles){
    const seen=new Set([col(role,'key')]);
    let manager=col(role,'reportsTo');
    while(manager){
      assert.ok(keys.has(manager),`missing manager ${manager}`);
      assert.ok(!seen.has(manager),`management reporting loop involving ${manager}`);
      seen.add(manager);
      manager=col(byKey.get(manager),'reportsTo');
    }
  }
});
test('PM has briefing scope, not inventory, finance or purchase execution scope',()=>{
  const pm=roles.find(r=>col(r,'key')==='project_mgr');
  assert.equal(col(pm,'scope'),'briefing');
  for(const other of ['budget_tracking','stock_counts','purchasing','independent_audit'])assert.notEqual(col(pm,'scope'),other);
});
