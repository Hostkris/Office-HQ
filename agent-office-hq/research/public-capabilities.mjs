// Keyless, read-only public research tools for independently authorized Office HQ staff.
// This intentionally does not manage OAuth, API keys, social publishing, or browser sessions.
import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';

const HOME=()=>resolve(process.env.OFFICE_HQ_NATIVE_DIR||join(process.env.HOME||process.cwd(),'.officehq-agent-engine'));
const POLICY='public-source-grants.json';
const safeId=s=>typeof s==='string'&&/^[A-Za-z0-9_.-]{1,100}$/.test(s);
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const CAPABILITIES=Object.freeze({
  github:{name:'GitHub public repositories',roles:['research','integrator','backend_engineer','frontend_engineer','security','cto']},
  forex:{name:'Frankfurter exchange rates',roles:['cfo','finance_dir','budget_officer','pricing_analyst']},
  food:{name:'Open Food Facts barcode lookup',roles:['inventory_mgr','catalog','product_mgr','research']}
});
const published=Object.entries(CAPABILITIES).map(([id,entry])=>({id,name:entry.name,roles:entry.roles,readOnly:true,requiresKey:false}));
const parseJob=(title,description)=>{
 const text=String(title||'')+'\n'+String(description||'');
 const github=/(?:github(?:\.com\/|\s+(?:repository|repo)\s+|\s+))([A-Za-z0-9][\w.-]{0,38}\/[-\w.]{1,100})\b/i.exec(text);
 if(github&&!github[1].includes('..')&&!github[1].split('/')[1].startsWith('-'))
   return {capability:'github',target:github[1]};
 const fx=/\b([A-Z]{3})\s*(?:to|\/|→)\s*([A-Z]{3})\b/i.exec(text);
 if(fx&&/\b(?:exchange|currency|convert|forex|fx|rate)\b/i.test(text))
   return {capability:'forex',target:fx[1].toUpperCase()+'/'+fx[2].toUpperCase()};
 const food=/\b(?:barcode|upc|ean)\s*:?\s*(\d{8,14})\b/i.exec(text);
 if(food)return {capability:'food',target:food[1]};
 return null;
};
async function fetchPublic(url,{transport=fetch,timeout=8000}={}){
 const response=await transport(url,{headers:{Accept:'application/json','User-Agent':'OfficeHQ-Public-Research/1.0'},signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw fail('Public source returned HTTP '+response.status,503);
 const length=Number(response.headers?.get?.('content-length')||0);
 if(length>180000)throw fail('Public source response too large',502);
 const raw=await response.text();
 if(raw.length>180000)throw fail('Public source response too large',502);
 try{return JSON.parse(raw);}catch{throw fail('Public source returned invalid JSON',502);}
}
export function createPublicCapabilities({root=HOME(),transport=fetch}={}){
 const file=join(resolve(root),POLICY);
 let serial=Promise.resolve();
 const lock=fn=>{const p=serial.then(fn);serial=p.catch(()=>{});return p;};
 async function load(){try{const d=JSON.parse(await readFile(file,'utf8'));return d?.version===1&&Array.isArray(d.grants)?d:{version:1,grants:[]};}catch(e){if(e.code==='ENOENT')return {version:1,grants:[]};throw e;}}
 async function save(data){await mkdir(resolve(root),{recursive:true,mode:0o700});await chmod(resolve(root),0o700).catch(()=>{});
   const tmp=file+'.'+randomUUID();await writeFile(tmp,JSON.stringify(data,null,2),{mode:0o600});await rename(tmp,file);await chmod(file,0o600).catch(()=>{});}
 async function status(companyId){const d=await load();
  return {localOnly:true,capabilities:published,
    grants:d.grants.filter(g=>!companyId||g.companyId===companyId).map(g=>({companyId:g.companyId,employeeId:g.employeeId,roleKey:g.roleKey,capability:g.capability,grantedAt:g.grantedAt})),
    note:'Only listed keyless, read-only public lookups. Every grant is restricted to its named employee and company.'};}
 async function action(body){
  if(!body||!['enable','revoke'].includes(body.action))throw fail('Unsupported public-source operation.');
  if(body.ownerConfirmed!==true)throw fail('CEO confirmation is required to change permissions.',403);
  if(!safeId(body.companyId))throw fail('Choose a valid company.',400);
  if(body.action==='revoke')return lock(async()=>{
    const d=await load();const before=d.grants.length;d.grants=d.grants.filter(g=>g.companyId!==body.companyId);
    await save(d);return {revoked:before-d.grants.length,companyId:body.companyId};
  });
  if(!Array.isArray(body.employees)||body.employees.length>80)throw fail('Supply up to 80 actual employee identities.',400);
  const team=new Map();
  for(const e of body.employees){
   if(!safeId(e?.employeeId)||!safeId(e?.roleKey))throw fail('Invalid employee identity.');
   if(team.has(e.employeeId))throw fail('Duplicate employee identity.');
   team.set(e.employeeId,e.roleKey);
  }
  if(!team.size)throw fail('No eligible employees were selected.');
  return lock(async()=>{
   const d=await load(),now=new Date().toISOString();
   d.grants=d.grants.filter(g=>g.companyId!==body.companyId);
   for(const [employeeId,roleKey] of team){
     for(const [capability,p] of Object.entries(CAPABILITIES)){
       if(p.roles.includes(roleKey))d.grants.push({companyId:body.companyId,employeeId,roleKey,capability,grantedAt:now});
     }
   }
   await save(d);
   return {enabled:d.grants.filter(g=>g.companyId===body.companyId).length,
     capabilities:published,companyId:body.companyId,
     note:'Keyless, read-only tools enabled for explicitly listed compatible employee identities. Other accounts still need separate OAuth or API keys.'};
  });
 }
 async function evidence({companyId,employeeId,title,description}={}){
  if(!safeId(companyId)||!safeId(employeeId))return null;
  const job=parseJob(title,description);if(!job)return null;
  const d=await load(),grant=d.grants.find(g=>g.companyId===companyId&&g.employeeId===employeeId&&g.capability===job.capability);
  if(!grant)return {capability:job.capability,authorized:false,
    notice:'This public source is not authorized for this employee. No external request was made.'};
  let url,data;
  if(job.capability==='github'){
    url='https://api.github.com/repos/'+job.target;
    const raw=await fetchPublic(url,{transport});data={name:String(raw.name||'').slice(0,120),description:String(raw.description||'').slice(0,450),
      stars:Number.isInteger(raw.stargazers_count)?raw.stargazers_count:null,openIssues:Number.isInteger(raw.open_issues_count)?raw.open_issues_count:null,
      archived:raw.archived===true,private:raw.private===true};
    if(data.private)throw fail('This is not a public GitHub repository.',403);
  }else if(job.capability==='forex'){
    const [base,quote]=job.target.split('/');
    if(base===quote)throw fail('Choose two different currencies.');
    url='https://api.frankfurter.dev/v1/latest?base='+base+'&symbols='+quote;
    const raw=await fetchPublic(url,{transport});
    if(!Number.isFinite(raw?.rates?.[quote]))throw fail('Currency pair unavailable from public source.',503);
    data={base,quote,rate:raw.rates[quote],date:String(raw.date||'').slice(0,20)};
  }else{
    url='https://world.openfoodfacts.org/api/v2/product/'+job.target+'.json?fields=code,product_name,brands,quantity';
    const raw=await fetchPublic(url,{transport});
    data={barcode:job.target,found:raw.status===1,name:String(raw.product?.product_name||'').slice(0,180),
      brands:String(raw.product?.brands||'').slice(0,130),quantity:String(raw.product?.quantity||'').slice(0,80)};
  }
  return {authorized:true,capability:job.capability,source:url,retrievedAt:new Date().toISOString(),data};
 }
 return {status,action,evidence};
}
export {parseJob,CAPABILITIES};
