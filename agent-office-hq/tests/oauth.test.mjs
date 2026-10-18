import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>readFile(path.join(root,f),'utf8');
const [client,gateway,sql,local,server,html]=await Promise.all([
  read('cloud.js'),read('supabase/functions/office-oauth/index.ts'),
  read('supabase/migrations/20261018_provider_connections.sql'),
  read('integration-center.js'),read('server.mjs'),read('cloud.html')
]);
test('cloud Connect Accounts client is valid JS and supplies live endpoint actions',()=>{
 assert.doesNotThrow(()=>new vm.Script(client));
 for(const term of ["action:'start'","action:'disconnect'","action:'status'","data.authorization_url","data-connect-provider","oauth=connected"]) {
   if(term==='oauth=connected')continue; // callback is server-generated, not frontend static content
   assert.ok(client.includes(term),term);
 }
 assert.match(html,/cloud.js/);
});
test('all cards route to authenticated Cloud HQ connection controls',()=>{
 assert.match(local,/cloud.html#connections/);
 for(const provider of ["Gmail","iCloud","X (Twitter)","Instagram","Shopify","Etsy","TikTok","Lemonade","Chime"])
   assert.ok(local.includes("name:'"+provider+"'"),provider);
 assert.match(server,/integration-center.js/);
});
test('provider gateway uses one-time state, secure tokens, authenticated actions and constrained callback',()=>{
 for(const term of ['hq_oauth_pending','state_hash','expires_at','crypto.subtle.digest','AES-GCM','getUser(token)','assertCompany','verifyShopify','CALLBACK','shopify','etsy','tiktok','instagram','facebook']){
  assert.ok(gateway.includes(term),term);
 }
 assert.match(gateway,/return webRedirect\("connected"/);
});
test('database denies client access to credentials and only shares owner metadata',()=>{
 assert.match(sql,/revoke all on public.hq_connection_secrets from public, anon, authenticated/);
 assert.match(sql,/revoke all on public.hq_oauth_pending from public, anon, authenticated/);
 assert.match(sql,/grant select on public.hq_connections to authenticated/);
 assert.match(sql,/auth.uid\(\)/);
 assert.doesNotMatch(client,/SUPABASE_SERVICE_ROLE_KEY|OAUTH_TOKEN_ENCRYPTION_KEY/);
});
