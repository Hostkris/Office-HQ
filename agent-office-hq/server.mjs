/** Optional local AI drafting server for Agent Office HQ. Node.js 22+; no dependencies. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createDesktopService} from './desktop/runner.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const host=process.env.HOST||'127.0.0.1';
if(!['127.0.0.1','localhost','::1'].includes(host))throw Error('The desktop workforce must only listen on this computer (127.0.0.1).');
const port=Number(process.env.PORT||3000);
const apiKey=process.env.OPENAI_API_KEY;
const model=process.env.OPENAI_MODEL||'gpt-4.1-mini';
const desktop=createDesktopService({root,apiKey,model});
const files={'/':'index.html','/index.html':'index.html','/cloud.html':'cloud.html','/cloud.js':'cloud.js','/app.js':'app.js','/office-features.js':'office-features.js','/project-floor.js':'project-floor.js','/integration-center.js':'integration-center.js','/ios-workstations.js':'ios-workstations.js','/desktop-workstations.js':'desktop-workstations.js','/refresh.js':'refresh.js','/styles.css':'styles.css','/icon.svg':'icon.svg','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js'};
const types={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',webmanifest:'application/manifest+json'};
function send(res,status,content,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; worker-src 'self';"});res.end(content)}
async function parseJson(req){let input='';for await(const c of req){input+=c;if(input.length>24000)throw Error('Payload too large')}return JSON.parse(input)}
const safe=s=>String(s??'').slice(0,3500);
const instructions=`You are one specialist in a multi-company AI workforce app. You ONLY carry out the narrowly stated job scope and draft a useful work product. Do not impersonate another job, approve your own work, fabricate sources, give unqualified legal/accounting/regulatory assurances, spend money, send messages, change external systems, or say you took actions you did not take. You have no tools or live data integrations. Label assumptions and requested evidence clearly. Produce concise, structured, practical draft text that a human can verify. Never reveal secrets.`;
async function aiDraft(payload){const task=payload.task||{},e=payload.employee||{};
  if(!task.title||!task.scope||!e.role||!task.description||typeof task.title!=='string'||typeof task.description!=='string')throw Error('Missing task fields');
  const input=`Company: ${safe(payload.company)}\nExclusive role: ${safe(e.role)}\nRole mandate: ${safe(e.description)}\nAuthorized specialty: ${safe(task.scope)}\nJob title: ${safe(task.title)}\nTask description: ${safe(task.description)}\nHigh-level application facts (not externally verified): ${JSON.stringify(payload.facts||{}).slice(0,700)}\nReturn draft for human review only.`;
  const resp=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,instructions,input,max_output_tokens:1100})});
  const data=await resp.json();if(!resp.ok)throw Error('AI provider returned status '+resp.status);
  const output=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('\n')||data.output_text||'';
  if(!output)throw Error('No output from model');return output.slice(0,12000);
}
const server=http.createServer(async(req,res)=>{try{
  const remote=String(req.socket.remoteAddress||'');
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote)){send(res,403,JSON.stringify({error:'Desktop browser is available locally only.'}));return;}
  const hostname=String(req.headers.host||'').split(':')[0];
  if(!['127.0.0.1','localhost','[::1]'].includes(hostname)){send(res,403,JSON.stringify({error:'Invalid localhost hostname.'}));return;}
  if(req.method!=='GET'&&req.headers.origin){
    try{const o=new URL(req.headers.origin);if(!['127.0.0.1','localhost'].includes(o.hostname)||o.host!==req.headers.host)throw Error('origin mismatch');}
    catch{send(res,403,JSON.stringify({error:'Desktop actions must originate from the same local website.'}));return;}
  }
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/desktop/')){
    try{const result=await desktop.handle(req,url);send(res,result.code,JSON.stringify(result.data));}
    catch(err){send(res,Number(err.status)||400,JSON.stringify({error:String(err.message||'Desktop operation failed').slice(0,300)}));}
    return;
  }
  if(url.pathname==='/api/status'&&req.method==='GET'){send(res,200,JSON.stringify({aiReady:!!apiKey,role:'draft-only',storage:'browser-only',externalActions:false}));return}
  if(url.pathname==='/api/run-agent'&&req.method==='POST'){
    if(!apiKey){send(res,503,JSON.stringify({error:'OPENAI_API_KEY missing from server environment'}));return}
    try{const payload=await parseJson(req);const output=await aiDraft(payload);send(res,200,JSON.stringify({output,reviewRequired:true,externalActions:false}))}catch(err){send(res,400,JSON.stringify({error:String(err.message).slice(0,200)}))}return;
  }
  if(req.method==='GET'&&files[url.pathname]){const filename=files[url.pathname],file=await readFile(path.join(root,filename));send(res,200,file,types[filename.split('.').pop()]||'application/octet-stream');return}
  send(res,404,JSON.stringify({error:'Not found'}));
}catch(e){send(res,500,JSON.stringify({error:'Unexpected local server error'}));}});
server.listen(port,host,()=>{console.log(`Agent Office HQ is running at http://${host}:${port}`);console.log(apiKey?'AI draft and desktop browser tasks available when Playwright is installed':'No AI key: manual desktop login works; automatic browser jobs require OPENAI_API_KEY')});
process.on('SIGTERM',()=>{void desktop.shutdown().finally(()=>server.close(()=>process.exit(0)));});
process.on('SIGINT',()=>{void desktop.shutdown().finally(()=>server.close(()=>process.exit(0)));});
