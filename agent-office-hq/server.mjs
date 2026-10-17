/** Optional local AI drafting server for Agent Office HQ. Node.js 22+; no dependencies. */
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const host=process.env.HOST||'127.0.0.1';
const port=Number(process.env.PORT||3000);
const apiKey=process.env.OPENAI_API_KEY;
const model=process.env.OPENAI_MODEL||'gpt-4.1-mini';
const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/styles.css':'styles.css','/icon.svg':'icon.svg','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js'};
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
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/status'&&req.method==='GET'){send(res,200,JSON.stringify({aiReady:!!apiKey,role:'draft-only',storage:'browser-only',externalActions:false}));return}
  if(url.pathname==='/api/run-agent'&&req.method==='POST'){
    if(!apiKey){send(res,503,JSON.stringify({error:'OPENAI_API_KEY missing from server environment'}));return}
    try{const payload=await parseJson(req);const output=await aiDraft(payload);send(res,200,JSON.stringify({output,reviewRequired:true,externalActions:false}))}catch(err){send(res,400,JSON.stringify({error:String(err.message).slice(0,200)}))}return;
  }
  if(req.method==='GET'&&files[url.pathname]){const filename=files[url.pathname],file=await readFile(path.join(root,filename));send(res,200,file,types[filename.split('.').pop()]||'application/octet-stream');return}
  send(res,404,JSON.stringify({error:'Not found'}));
}catch(e){send(res,500,JSON.stringify({error:'Unexpected local server error'}));}});
server.listen(port,host,()=>{console.log(`Agent Office HQ is running at http://${host}:${port}`);console.log(apiKey?'AI draft connector ready':'No API key: local template mode (fully usable)')});
