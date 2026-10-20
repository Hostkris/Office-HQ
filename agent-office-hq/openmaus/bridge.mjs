// Local OpenMausBot connector. No credentials or model actions are exposed on GitHub Pages.
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

export const STARTER_BOT = 'Office HQ Marketing Research';
const validId = x => typeof x === 'string' && /^[\w.-]{1,100}$/.test(x);
const fail = (s, code=400) => Object.assign(new Error(s), {status:code});
export async function localCli(args,input=''){
  const port=Number(process.env.OFFICE_HQ_OPENMAUS_PORT || 8799);
  if(!Number.isInteger(port)||port<1||port>65535)throw fail('Invalid local OpenMausBot port.');
  const env={...process.env,OMB_PORT:String(port)};
  delete env.OPENMAUSBOT_URL;
  delete env.ALLOW_INSECURE_HTTP;
  return await new Promise((resolve,reject)=>{
    let output='', settled=false;
    const child=spawn(process.env.OFFICE_HQ_OPENMAUS_BIN||'openmausbot',args,{shell:false,env,stdio:['pipe','pipe','pipe']});
    const timeout=setTimeout(()=>child.kill('SIGKILL'),18000);
    child.stdout.on('data',b=>{output+=b.toString();if(output.length>300000)child.kill('SIGKILL');});
    child.stderr.on('data',()=>{}); // Never return CLI diagnostic secrets to browsers.
    child.once('error',e=>{if(!settled){settled=true;clearTimeout(timeout);reject(fail('OpenMausBot CLI unavailable. Install its CLI and start the desktop app.',503));}});
    child.once('close',code=>{
      clearTimeout(timeout);if(settled)return;settled=true;
      if(code!==0)return reject(fail('OpenMausBot command failed (exit '+code+').',503));
      try{resolve(JSON.parse(output));}catch{reject(fail('OpenMausBot returned invalid JSON.',503));}
    });
    child.stdin.on('error',()=>{});
    child.stdin.end(input);
  });
}
function names(data){
  const list=Array.isArray(data)?data:[data?.bots,data?.data?.bots,data?.result?.bots,data?.items].find(Array.isArray)||[];
  return list.map(b=>typeof b==='string'?b:b?.name).filter(x=>typeof x==='string'&&x.length<120);
}
export function createOpenMausBridge({root,invoke=localCli,allowSend=process.env.OFFICE_HQ_OPENMAUS_SEND==='1'}={}){
  const folder=resolve(process.env.OFFICE_HQ_DATA_DIR||join(root,'.office-hq-private'));
  const file=join(folder,'maus-bindings.json');
  let pending;
  const load=()=>pending||=(async()=>{try{const data=JSON.parse(await readFile(file,'utf8'));return Array.isArray(data.bindings)?data.bindings:[];}catch(e){if(e.code==='ENOENT')return [];throw e;}})();
  async function save(list){
    await mkdir(folder,{recursive:true,mode:0o700});
    const tmp=file+'.'+randomUUID();
    await writeFile(tmp,JSON.stringify({version:1,bindings:list}),{mode:0o600});
    await rename(tmp,file);
    pending=Promise.resolve(list);
  }
  let serial=Promise.resolve();
  function locked(fn){const next=serial.then(fn);serial=next.catch(()=>{});return next;}
  async function bots(){await invoke(['doctor','--json']);return names(await invoke(['bots','--json']));}
  async function status(){
    const bindings=(await load()).map(b=>({companyId:b.companyId,employeeId:b.employeeId,employeeName:b.employeeName,botName:b.botName}));
    try {const available=await bots();return {connected:true,dispatchEnabled:allowSend,bots:available.filter(n=>n===STARTER_BOT),bindings,localOnly:true};}
    catch{return {connected:false,dispatchEnabled:allowSend,bots:[],bindings,localOnly:true,message:'Install the CLI and start OpenMausBot on this computer.'};}
  }
  async function action(body){
    if(!body||typeof body!=='object')throw fail('Invalid action.');
    if(body.action==='bind')return locked(async()=>{
      if(body.ownerConfirmed!==true)throw fail('Owner confirmation required.',403);
      if(!validId(body.companyId)||!validId(body.employeeId)||body.department!=='Marketing'||body.botName!==STARTER_BOT)throw fail('Only the dedicated Marketing bot and Marketing employees are supported in this first phase.',403);
      const employeeName=typeof body.employeeName==='string'?body.employeeName.trim().slice(0,100):'';
      if(employeeName.length<2)throw fail('Missing employee name.');
      if(!(await bots()).includes(STARTER_BOT))throw fail('Apply the safe Office HQ Marketing team template in OpenMausBot first.',409);
      const current=await load();
      if(current.some(b=>b.botName===STARTER_BOT&&(b.companyId!==body.companyId||b.employeeId!==body.employeeId)))throw fail('That bot is already bound to another employee.',409);
      const updated=current.filter(b=>!(b.companyId===body.companyId&&b.employeeId===body.employeeId));
      updated.push({companyId:body.companyId,employeeId:body.employeeId,employeeName,botName:STARTER_BOT});
      await save(updated);return {bound:true,employeeName,botName:STARTER_BOT};
    });
    if(body.action==='revoke')return locked(async()=>{
      if(body.ownerConfirmed!==true)throw fail('Owner confirmation required.',403);
      if(!validId(body.companyId)||!validId(body.employeeId))throw fail('Invalid mapping.');
      await save((await load()).filter(b=>!(b.companyId===body.companyId&&b.employeeId===body.employeeId)));
      return {revoked:true,note:'Mapping revoked. Stop running bots and revoke third-party apps inside OpenMausBot separately.'};
    });
    if(body.action==='send')return locked(async()=>{
      if(!allowSend)throw fail('Sending is OFF. The computer owner must opt in with OFFICE_HQ_OPENMAUS_SEND=1.',403);
      if(body.ownerConfirmed!==true)throw fail('Review and approve each assignment.',403);
      if(!validId(body.companyId)||!validId(body.employeeId))throw fail('Invalid employee.');
      const title=typeof body.title==='string'?body.title.trim().slice(0,120):'';
      const description=typeof body.description==='string'?body.description.trim().slice(0,1600):'';
      if(title.length<6||description.length<15)throw fail('Provide a meaningful job title and instructions.');
      const b=(await load()).find(b=>b.companyId===body.companyId&&b.employeeId===body.employeeId);
      if(!b||b.botName!==STARTER_BOT)throw fail('Employee has no authorized bot mapping.',403);
      if(!(await bots()).includes(STARTER_BOT))throw fail('Assigned bot unavailable.',503);
      const sendId=randomUUID();
      const message='OFFICE HQ - OWNER APPROVED DRAFT-ONLY ASSIGNMENT\nEmployee: '+b.employeeName+'\nTitle: '+title+
        '\nInstructions: '+description+
        '\nDo not access authenticated websites or external accounts, email, publish, purchase, or modify external systems. Draft only; request CEO approval before other actions.';
      const receipt=await invoke(['send',STARTER_BOT,'-','--send-id',sendId,'--json'],message);
      return {submitted:true,sendId,botName:STARTER_BOT,messageId:typeof receipt?.messageId==='string'?receipt.messageId:null,
        note:'Submitted to OpenMausBot. This does not mean the task is complete; review the bot conversation.'};
    });
    throw fail('Unknown action.');
  }
  return {status,action};
}
