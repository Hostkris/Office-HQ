// Local OpenMausBot bridge for Office HQ. Never deploy the HTTP server publicly.
// API calls are only accepted on the computer's loopback listener by server.mjs.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {join,resolve,isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';

export const STARTER_BOT='Office HQ Marketing Research';
const validId=x=>typeof x==='string'&&/^[\w.-]{1,100}$/.test(x);
const fail=(reason,status=400)=>Object.assign(new Error(reason),{status});
const clip=(s,n=3500)=>String(s??'').replace(/[\x00-\x08\x0b-\x1f]/g,'').slice(0,n);
const active=new Set(['submitted','running','stop_requested','needs-input']);

export async function localCli(args,input='',options={}){
  const port=Number(process.env.OFFICE_HQ_OPENMAUS_PORT||8799);
  if(!Number.isInteger(port)||port<1||port>65535)throw fail('Invalid local OpenMausBot port.');
  const tokenFile=process.env.OFFICE_HQ_OPENMAUS_TOKEN_FILE;
  if(tokenFile&&(!isAbsolute(tokenFile)||tokenFile.length>400))throw fail('A paired-session token file must have a private absolute path.');
  const cliArgs=tokenFile?[...args,'--token-file',tokenFile]:args;
  const env={...process.env,OMB_PORT:String(port)};
  delete env.OPENMAUSBOT_URL; delete env.ALLOW_INSECURE_HTTP;
  return await new Promise((resolve,reject)=>{
    let output='',settled=false;
    const child=spawn(process.env.OFFICE_HQ_OPENMAUS_BIN||'openmausbot',cliArgs,{shell:false,env,stdio:['pipe','pipe','pipe']});
    const timer=setTimeout(()=>child.kill('SIGKILL'),12000);
    child.stdout.on('data',b=>{output+=b.toString();if(output.length>300000)child.kill('SIGKILL');});
    child.stderr.on('data',()=>{}); // Do not send CLI debug logs or credentials to Safari.
    child.once('error',()=>{if(!settled){settled=true;clearTimeout(timer);reject(fail('OpenMausBot CLI unavailable. Install the CLI and start the application.',503));}});
    child.once('close',code=>{
      clearTimeout(timer);if(settled)return;settled=true;
      const accepted=code===0||(Array.isArray(options.acceptExitCodes)&&options.acceptExitCodes.includes(code));
      if(!accepted)return reject(fail('OpenMausBot command failed (exit '+code+').',503));
      try{resolve(JSON.parse(output));}catch{reject(fail('OpenMausBot returned unreadable JSON.',503));}
    });
    child.stdin.on('error',()=>{});child.stdin.end(input);
  });
}
function botNames(data){
  const list=Array.isArray(data)?data:[data?.bots,data?.data?.bots,data?.result?.bots,data?.items].find(Array.isArray)||[];
  return list.map(b=>typeof b==='string'?b:b?.name).filter(x=>typeof x==='string'&&x.length<120);
}
const publicRun=j=>({id:j.id,companyId:j.companyId,employeeId:j.employeeId,employeeName:j.employeeName,
  botName:j.botName,officeTaskId:j.officeTaskId,title:j.title,threadId:j.threadId,
  status:j.status,thought:j.thought,result:j.result,reason:j.reason,createdAt:j.createdAt,updatedAt:j.updatedAt});
export function createOpenMausBridge({root,invoke=localCli,allowSend=process.env.OFFICE_HQ_OPENMAUS_SEND==='1'}={}){
  const folder=resolve(process.env.OFFICE_HQ_DATA_DIR||join(root,'.office-hq-private'));
  const file=join(folder,'maus-bindings.json');
  let promise,queue=Promise.resolve();
  async function load(){
    if(!promise)promise=(async()=>{try{
      const d=JSON.parse(await readFile(file,'utf8'));
      return {version:2,bindings:Array.isArray(d.bindings)?d.bindings:[],runs:Array.isArray(d.runs)?d.runs:[]};
    }catch(e){if(e.code==='ENOENT')return {version:2,bindings:[],runs:[]};throw e;}})();
    return promise;
  }
  async function save(state){
    await mkdir(folder,{recursive:true,mode:0o700});
    const temporary=file+'.'+randomUUID();
    await writeFile(temporary,JSON.stringify(state,null,2),{mode:0o600});
    await rename(temporary,file);promise=Promise.resolve(state);
  }
  function locked(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}
  async function bots(){
    const doctor=await invoke(['doctor','--json']);
    if(doctor?.ok===false)throw fail('OpenMausBot is not ready.',503);
    return botNames(await invoke(['bots','--json']));
  }
  async function status(){
    const s=await load();
    const bindings=s.bindings.map(b=>({companyId:b.companyId,employeeId:b.employeeId,employeeName:b.employeeName,botName:b.botName}));
    const runs=s.runs.slice(-50).reverse().map(publicRun);
    try{return {connected:true,dispatchEnabled:allowSend,bots:(await bots()).filter(n=>n===STARTER_BOT),bindings,runs,localOnly:true};}
    catch{return {connected:false,dispatchEnabled:allowSend,bots:[],bindings,runs,localOnly:true,message:'Start OpenMausBot and install its CLI.'};}
  }
  async function action(body){
    if(!body||typeof body!=='object')throw fail('Invalid action.');
    if(body.action==='bind')return locked(async()=>{
      if(body.ownerConfirmed!==true)throw fail('Owner confirmation required.',403);
      if(!validId(body.companyId)||!validId(body.employeeId)||body.department!=='Marketing'||body.botName!==STARTER_BOT)
        throw fail('Only the dedicated Marketing bot and Marketing employees are supported in this phase.',403);
      const employeeName=clip(body.employeeName,100).trim();
      if(employeeName.length<2)throw fail('Missing employee name.');
      if(!(await bots()).includes(STARTER_BOT))throw fail('Apply the restricted Office HQ Marketing team in OpenMausBot first.',409);
      const s=await load();
      if(s.bindings.some(b=>b.botName===STARTER_BOT&&(b.companyId!==body.companyId||b.employeeId!==body.employeeId)))
        throw fail('That bot is bound exclusively to another employee.',409);
      s.bindings=s.bindings.filter(b=>!(b.companyId===body.companyId&&b.employeeId===body.employeeId));
      s.bindings.push({companyId:body.companyId,employeeId:body.employeeId,employeeName,botName:STARTER_BOT});
      await save(s);return {bound:true,employeeName,botName:STARTER_BOT};
    });
    if(body.action==='revoke')return locked(async()=>{
      if(body.ownerConfirmed!==true)throw fail('Owner confirmation required.',403);
      if(!validId(body.companyId)||!validId(body.employeeId))throw fail('Invalid employee.');
      const s=await load();
      s.bindings=s.bindings.filter(b=>!(b.companyId===body.companyId&&b.employeeId===body.employeeId));
      await save(s);
      return {revoked:true,note:'Mapping revoked. Stop running bots and revoke OAuth sessions in OpenMausBot separately.'};
    });
    if(body.action==='send')return locked(async()=>{
      if(!allowSend)throw fail('Sending is OFF. The owner must opt in with OFFICE_HQ_OPENMAUS_SEND=1.',403);
      if(body.ownerConfirmed!==true)throw fail('Review and approve each assignment.',403);
      if(!validId(body.companyId)||!validId(body.employeeId)||!validId(body.officeTaskId))
        throw fail('A valid existing Office HQ assignment is required.');
      const title=clip(body.title,120).trim(),description=clip(body.description,1600).trim();
      if(title.length<6||description.length<15)throw fail('Provide a specific job and instructions.');
      const s=await load();
      const b=s.bindings.find(b=>b.companyId===body.companyId&&b.employeeId===body.employeeId&&b.botName===STARTER_BOT);
      if(!b)throw fail('No authorized bot for this employee.',403);
      if(s.runs.some(r=>r.companyId===body.companyId&&r.officeTaskId===body.officeTaskId&&active.has(r.status)))
        throw fail('This assignment already has an active or paused OpenMausBot job.',409);
      if(!(await bots()).includes(STARTER_BOT))throw fail('Assigned bot is unavailable.',503);
      const sendId=randomUUID();
      const instruction='OFFICE HQ - OWNER APPROVED DRAFT-ONLY ASSIGNMENT\nEmployee: '+b.employeeName+
        '\nTitle: '+title+'\nInstructions: '+description+
        '\nDraft only. No authenticated websites, account access, posting, spending, external messages, uploads, or modification of external systems. Request CEO approval if any new permission is needed.';
      // The upstream run verb creates a new named task and returns its exact threadId and since without waiting.
      const receipt=await invoke(['run',STARTER_BOT,'-','--wait','none','--title',title,'--send-id',sendId,'--json'],instruction);
      if(receipt?.ok===false||typeof receipt?.threadId!=='string'||!validId(receipt.threadId))
        throw fail('OpenMausBot did not confirm the new task thread. Check the OpenMausBot application.',503);
      const now=new Date().toISOString();
      const record={id:randomUUID(),companyId:body.companyId,employeeId:body.employeeId,employeeName:b.employeeName,
        botName:STARTER_BOT,officeTaskId:body.officeTaskId,title,threadId:receipt.threadId,
        since:Number.isSafeInteger(receipt.since)?receipt.since:undefined,sendId,status:'submitted',
        thought:'Job submitted; awaiting live status',result:'',reason:'',createdAt:now,updatedAt:now};
      s.runs.push(record);if(s.runs.length>200)s.runs=s.runs.slice(-200);
      await save(s);
      return {submitted:true,sendId,runId:record.id,threadId:record.threadId,botName:STARTER_BOT,
        note:'An actual OpenMausBot task thread was created. OpenMausBot must report a completed job before Office HQ shows a result.'};
    });
    if(body.action==='check')return locked(async()=>{
      if(!validId(body.companyId)||!validId(body.runId))throw fail('Invalid job.');
      const s=await load(),job=s.runs.find(j=>j.id===body.runId&&j.companyId===body.companyId);
      if(!job)throw fail('Job not found.',404);
      if(!active.has(job.status))return {run:publicRun(job)};
      // The upstream wait command returns JSON with a meaningful state and often exit code 3 or 4
      // when approval is needed or the short polling window times out. These aren't errors.
      const args=['wait','--thread',job.threadId,'--timeout','2s','--on-input','exit','--json'];
      if(Number.isSafeInteger(job.since))args.push('--since',String(job.since));
      const result=await invoke(args,'',{acceptExitCodes:[1,3,4]});
      const state=clip(result?.state||result?.job?.state,50);
      const now=new Date().toISOString();
      if(state==='completed'){
        job.status='review';
        job.result=clip(result?.reply?.text||'',4500);
        job.thought='Draft completed; awaiting CEO review';
        job.reason='';
      }else if(state==='needs-input'){
        job.status='needs-input';job.thought='Needs your approval in OpenMausBot';
        job.reason=clip(result?.job?.reason||result?.reason||'Open OpenMausBot to review the request.',300);
      }else if(state==='failed'||state==='stalled'||state==='idle'){
        job.status='failed';job.thought='Job failed; inspect OpenMausBot';
        job.reason=clip(result?.reason||result?.job?.reason||state,300);
      }else{
        job.status='running';job.thought='Working in OpenMausBot';job.reason='';
      }
      job.updatedAt=now;await save(s);
      return {run:publicRun(job)};
    });
    if(body.action==='interrupt')return locked(async()=>{
      if(body.ownerConfirmed!==true)throw fail('CEO confirmation required to interrupt.',403);
      if(!validId(body.companyId)||!validId(body.runId))throw fail('Invalid job.');
      const s=await load(),job=s.runs.find(j=>j.id===body.runId&&j.companyId===body.companyId);
      if(!job)throw fail('Job not found.',404);
      if(!active.has(job.status))throw fail('This job is not active.',409);
      await invoke(['interrupt','--thread',job.threadId,'--tree','--json']);
      job.status='stopped';job.thought='Stopped by the CEO';job.reason='Stopped through the official OpenMausBot command';
      job.updatedAt=new Date().toISOString();await save(s);
      return {run:publicRun(job)};
    });
    throw fail('Unknown OpenMausBot action.');
  }
  return {status,action};
}
