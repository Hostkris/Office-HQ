// Office HQ's strictly read-only local Agent Reach research adapter.
// Never deploy this server publicly. No cookie scraping, OAuth/token exchange,
// shell execution, auto-installs, publishing, messages, purchases or bank operations.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';

const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(x)&&!x.startsWith('-');
const error=(msg,status=400)=>Object.assign(new Error(msg),{status});
const compact=(text,n)=>String(text??'').trim().slice(0,n);
const roles=new Set(['research','social','content','cmo','product_mgr','catalog','pricing_analyst','integrator','security','backend_engineer','frontend_engineer','cto']);
const channels={github:'GitHub (public repository details)',youtube:'YouTube (public video metadata)'};
function normalizeTarget(channel,input){
  if(channel==='github'){
    const s=compact(input,200);
    if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(s)||s.includes('..'))throw error('Enter a public GitHub owner/repository, e.g. public-apis/public-apis.');
    return s;
  }
  if(channel==='youtube'){
    const s=compact(input,80);
    if(!/^[A-Za-z0-9_-]{11}$/.test(s))throw error('Enter the 11-character public YouTube video ID, not a URL.');
    return s;
  }
  throw error('Only public GitHub and YouTube research are currently implemented.');
}
export async function runTool(executable,args,{timeout=14000}={}){
  return new Promise((ok,no)=>{
    let stdout='',done=false,tooLarge=false;
    const child=spawn(executable,args,{shell:false,stdio:['ignore','pipe','pipe'],
      env:{...process.env,GH_PROMPT_DISABLED:'1',GIT_TERMINAL_PROMPT:'0',NO_COLOR:'1'}});
    const timer=setTimeout(()=>child.kill('SIGKILL'),timeout);
    child.stdout.on('data',part=>{stdout+=part.toString();if(stdout.length>140000){tooLarge=true;child.kill('SIGKILL');}});
    child.stderr.on('data',()=>{}); // Do not return diagnostics that might contain local paths or credentials.
    child.once('error',()=>{if(!done){done=true;clearTimeout(timer);no(error('Local research tool not installed or executable.',503));}});
    child.once('close',code=>{clearTimeout(timer);if(done)return;done=true;
      if(code!==0||tooLarge)return no(error('Local research command failed. Check Agent Reach doctor and sign-in requirements.',503));
      try{ok(JSON.parse(stdout));}catch{no(error('Local research tool returned unreadable results.',503));}
    });
  });
}
function publicRequest(r){return {id:r.id,companyId:r.companyId,employeeId:r.employeeId,employeeName:r.employeeName,
  roleKey:r.roleKey,channel:r.channel,target:r.target,purpose:r.purpose,status:r.status,
  createdAt:r.createdAt,approvedAt:r.approvedAt||null,completedAt:r.completedAt||null,
  result:r.result||null,notice:r.notice||''};}
export function createReachBridge({root,invoke=runTool,enabled=process.env.OFFICE_HQ_RESEARCH_EXECUTE==='1'}={}){
 const folder=resolve(process.env.OFFICE_HQ_DATA_DIR||join(root,'.office-hq-private'));
 const filename=join(folder,'research-requests.json');
 let statePromise,lock=Promise.resolve();
 const load=()=>statePromise||=(async()=>{try{
   const data=JSON.parse(await readFile(filename,'utf8'));
   return {version:1,requests:Array.isArray(data.requests)?data.requests:[]};
 }catch(e){if(e.code==='ENOENT')return {version:1,requests:[]};throw e;}})();
 async function save(data){
   await mkdir(folder,{recursive:true,mode:0o700});
   const tmp=filename+'.'+randomUUID();
   await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});
   await rename(tmp,filename);statePromise=Promise.resolve(data);
 }
 function serial(fn){const next=lock.then(fn);lock=next.catch(()=>{});return next;}
 async function status(){
   let agentReachReady=false;
   try{await invoke('agent-reach',['doctor','--json'],{timeout:9000});agentReachReady=true;}catch{}
   return {localOnly:true,enabled,agentReachReady,
     channels:channels,requests:(await load()).requests.slice(-50).reverse().map(publicRequest),
     note:'Agent Reach diagnoses local tools. GitHub and YouTube actions use their installed upstream read-only CLIs. No credentialed social sessions or publishing tools are exposed.'};
 }
 async function action(body){
   if(!body||typeof body!=='object')throw error('Invalid research request.');
   if(body.action==='request')return serial(async()=>{
     if(!validId(body.companyId)||!validId(body.employeeId))throw error('Choose a company and active specialist.');
     if(!roles.has(body.roleKey))throw error('This research action is not assigned to that specialty.',403);
     const department=compact(body.department,35);
     const permitted=body.roleKey==='research'||body.roleKey==='cmo'||body.roleKey==='social'||body.roleKey==='content'?'Marketing':
       ['product_mgr','catalog','pricing_analyst'].includes(body.roleKey)?'Product':'Technology';
     if(department!==permitted)throw error('Employee specialty and department do not match.',403);
     const channel=compact(body.channel,20),target=normalizeTarget(channel,body.target);
     const purpose=compact(body.purpose,400),employeeName=compact(body.employeeName,90);
     if(purpose.length<12||employeeName.length<2)throw error('Include the employee and a specific research reason.');
     const now=new Date().toISOString(),data=await load();
     const request={id:randomUUID(),companyId:body.companyId,employeeId:body.employeeId,
       employeeName,roleKey:body.roleKey,channel,target,purpose,status:'pending',createdAt:now};
     data.requests.push(request);data.requests=data.requests.slice(-100);await save(data);
     return {request:publicRequest(request),note:'Requested only. No tool has run and no login or account access was granted.'};
   });
   if(['approve','deny','revoke'].includes(body.action))return serial(async()=>{
     if(body.ownerConfirmed!==true)throw error('CEO confirmation required.',403);
     if(!validId(body.companyId)||!validId(body.requestId))throw error('Invalid request.');
     const data=await load(),r=data.requests.find(r=>r.id===body.requestId&&r.companyId===body.companyId);
     if(!r)throw error('Request not found.',404);
     if(body.action==='approve'&&r.status!=='pending')throw error('Only pending requests can be approved.',409);
     if(body.action==='deny'&&r.status!=='pending')throw error('Only pending requests can be denied.',409);
     if(body.action==='revoke'&&!['pending','approved'].includes(r.status))throw error('That authorization is no longer active.',409);
     r.status=body.action==='approve'?'approved':body.action==='deny'?'denied':'revoked';
     r.approvedAt=body.action==='approve'?new Date().toISOString():null;
     r.notice=body.action==='approve'?'One-time read-only research permission. Explicit Run is still required.':'No research tool will run.';
     await save(data);return {request:publicRequest(r)};
   });
   if(body.action==='run')return serial(async()=>{
     if(!enabled)throw error('Research execution is disabled. Owner must set OFFICE_HQ_RESEARCH_EXECUTE=1 on the local computer.',403);
     if(body.ownerConfirmed!==true)throw error('Explicit CEO confirmation to run is required.',403);
     if(!validId(body.companyId)||!validId(body.requestId))throw error('Invalid request.');
     const data=await load(),r=data.requests.find(r=>r.id===body.requestId&&r.companyId===body.companyId);
     if(!r||r.status!=='approved')throw error('This particular research request lacks an active one-time approval.',403);
     r.status='running';r.notice='One-time research attempt started';await save(data);
     try{
       let raw,result;
       if(r.channel==='github'){
         raw=await invoke('gh',['repo','view',r.target,'--json','name,description,url,stargazerCount,visibility'],{timeout:16000});
         result={kind:'public-github-repo',name:compact(raw.name,150),description:compact(raw.description,2000),
           url:/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(raw.url||'')?raw.url:'',
           stars:Number.isInteger(raw.stargazerCount)?raw.stargazerCount:null,visibility:compact(raw.visibility,20)};
       }else if(r.channel==='youtube'){
         raw=await invoke('yt-dlp',['--dump-single-json','--skip-download','--no-playlist','--no-warnings',
           'https://www.youtube.com/watch?v='+r.target],{timeout:19000});
         result={kind:'public-youtube-video',title:compact(raw.title,240),creator:compact(raw.uploader,140),
           durationSeconds:Number.isFinite(raw.duration)?raw.duration:null,
           uploadDate:compact(raw.upload_date,16),url:'https://www.youtube.com/watch?v='+r.target};
       }else throw error('Unsupported research channel.');
       r.result=result;r.status='completed';r.completedAt=new Date().toISOString();
       r.notice='Read-only research completed. Verify facts before using in business decisions.';
     }catch(e){
       r.status='failed';r.notice='Research tool failed locally. No external changes were performed.';
       await save(data);throw error(r.notice,503);
     }
     await save(data);return {request:publicRequest(r)};
   });
   throw error('Unknown research action.');
 }
 return {status,action};
}
