import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=await readFile(path.join(root,'office-features.js'),'utf8');
const guide=await readFile(path.join(root,'docs/AUTOMATED_WORKFORCE_CONNECTIONS.md'),'utf8');
const schema=await readFile(path.join(root,'supabase/office_hq_agent_pipeline.sql'),'utf8');

test('connector directory includes requested providers and proper setup state',()=>{
  for(const name of ['Gmail / Email','iCloud','X (Twitter)','Instagram','Shopify','Etsy','TikTok','Lemonade','Chime']){
    assert.ok(source.includes('"name":"'+name+'"'),'provider catalog should include '+name);
  }
  assert.match(source,/Not connected/);
  assert.match(source,/not sign in or grant live account access|do not sign in or grant live account access|do not sign in or grant live account/i);
  assert.match(source,/Actual sign-in requires secure OAuth/);
});

test('no provider account secrets or OAuth capability are promised by prototype',()=>{
  assert.match(guide,/Current state/);
  assert.match(guide,/No outside OAuth/);
  assert.match(guide,/CEO/);
  assert.match(schema,/not_connected/);
  assert.match(schema,/enable row level security/);
  assert.match(schema,/grant select on public.hq_provider_accounts/);
  assert.doesNotMatch(schema,/grant (insert|update|delete|all) on public\.hq_agent_jobs.*to authenticated/i);
});
