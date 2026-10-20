import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createReachBridge} from '../research/reach-bridge.mjs';
const data={action:'request',companyId:'company1',employeeId:'employee1',employeeName:'Alex Researcher',
 roleKey:'research',department:'Marketing',channel:'github',target:'public-apis/public-apis',
 purpose:'Investigate public API sources for competitor research.'};
const fake=async (exe,args)=>{
 if(exe==='agent-reach')return {ready:true};
 if(exe==='gh')return {name:'public-apis',description:'Community directory',url:'https://github.com/public-apis/public-apis',stargazerCount:1234,visibility:'PUBLIC'};
 if(exe==='yt-dlp')return {title:'Tutorial',uploader:'Creator',duration:42,upload_date:'20261001'};
 throw Error('Unexpected executable '+exe);
};
async function sandbox(fn){const root=await mkdtemp(join(tmpdir(),'office-reach-'));try{return await fn(root);}finally{await rm(root,{recursive:true,force:true});}}
test('research CLI does not run without explicit enablement and approval',()=>sandbox(async root=>{
 const b=createReachBridge({root,invoke:fake,enabled:false});
 const s=await b.status();assert.equal(s.agentReachReady,true);assert.equal(s.enabled,false);
 await assert.rejects(b.action({...data,roleKey:'ap',department:'Finance'}),/not assigned/);
 await assert.rejects(b.action({...data,department:'Technology'}),/do not match/);
 await assert.rejects(b.action({...data,target:'-delete'}),/Enter a public GitHub/);
 const created=await b.action(data);
 assert.equal(created.request.status,'pending');
 await assert.rejects(b.action({action:'run',companyId:data.companyId,requestId:created.request.id,ownerConfirmed:true}),/disabled/);
 await assert.rejects(b.action({action:'approve',companyId:data.companyId,requestId:created.request.id,ownerConfirmed:false}),/CEO confirmation/);
 await b.action({action:'deny',companyId:data.companyId,requestId:created.request.id,ownerConfirmed:true});
 assert.equal((await b.status()).requests[0].status,'denied');
}));
test('one-time owner-approved GitHub lookup runs an exact fixed upstream read-only command',()=>sandbox(async root=>{
 let called;const run=async(exe,args,opt)=>{if(exe==='gh')called={exe,args,opt};return fake(exe,args)};
 const a=createReachBridge({root,invoke:run,enabled:true});
 const created=await a.action(data);const req=created.request;
 await assert.rejects(a.action({action:'run',companyId:data.companyId,requestId:req.id,ownerConfirmed:true}),/lacks an active/);
 await a.action({action:'approve',companyId:data.companyId,requestId:req.id,ownerConfirmed:true});
 await assert.rejects(a.action({action:'run',companyId:data.companyId,requestId:req.id,ownerConfirmed:false}),/Explicit CEO confirmation/);
 const result=await a.action({action:'run',companyId:data.companyId,requestId:req.id,ownerConfirmed:true});
 assert.deepEqual(called.args,['repo','view','public-apis/public-apis','--json','name,description,url,stargazerCount,visibility']);
 assert.equal(called.exe,'gh');
 assert.equal(result.request.status,'completed');
 assert.equal(result.request.result.kind,'public-github-repo');
 assert.equal(result.request.result.stars,1234);
 await assert.rejects(a.action({action:'run',companyId:data.companyId,requestId:req.id,ownerConfirmed:true}),/lacks an active/);
 const reboot=createReachBridge({root,invoke:fake,enabled:false});
 assert.equal((await reboot.status()).requests[0].result.name,'public-apis');
}));
test('YouTube video metadata uses a validated video ID and cannot turn into arbitrary URL fetch',()=>sandbox(async root=>{
 let called;
 const b=createReachBridge({root,invoke:async(exe,args)=>{if(exe==='yt-dlp')called={exe,args};return fake(exe,args)},enabled:true});
 await assert.rejects(b.action({...data,channel:'youtube',target:'https://localhost/admin'}),/11-character/);
 const req=(await b.action({...data,channel:'youtube',target:'dQw4w9WgXcQ'})).request;
 await b.action({action:'approve',companyId:data.companyId,requestId:req.id,ownerConfirmed:true});
 const res=await b.action({action:'run',companyId:data.companyId,requestId:req.id,ownerConfirmed:true});
 assert.equal(called.exe,'yt-dlp');assert.ok(called.args.includes('--skip-download'));
 assert.ok(called.args.includes('https://www.youtube.com/watch?v=dQw4w9WgXcQ'));
 assert.equal(res.request.result.title,'Tutorial');
}));
test('CEO can revoke before execution; no financial, credentialed-social or arbitrary channel permitted',()=>sandbox(async root=>{
 const b=createReachBridge({root,invoke:fake,enabled:true});
 await assert.rejects(b.action({...data,channel:'instagram',target:'test'}),/Only public GitHub and YouTube/);
 const req=(await b.action(data)).request;
 await b.action({action:'approve',companyId:data.companyId,requestId:req.id,ownerConfirmed:true});
 await b.action({action:'revoke',companyId:data.companyId,requestId:req.id,ownerConfirmed:true});
 await assert.rejects(b.action({action:'run',companyId:data.companyId,requestId:req.id,ownerConfirmed:true}),/lacks an active/);
}));
test('source-derived public API directory is loaded but no backend credentials are published',async()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const ui=await readFile(new URL('../research-center.js',import.meta.url),'utf8');
 const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 assert.match(html,/data-view="research"/);
 assert.match(html,/src="research-center.js"/);
 for(const item of ['Open Food Facts','Marketstack','US Recalls MCP','ShapelessAI MCP','VirusTotal'])assert.ok(ui.includes(item));
 assert.match(build,/research-center.js/);
 assert.doesNotMatch(build,/reach-bridge.mjs/);
 assert.doesNotMatch(ui,/TWITTER_AUTH_TOKEN|Cookie-Editor|GH_TOKEN|OPENAI_API_KEY/);
});
