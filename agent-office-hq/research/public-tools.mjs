/* Permissioned zero-key public tools. Localhost only, GET-only, per company+employee+service.
 * No arbitrary URLs, cookies, OAuth, tokens, browser automation or external writes.
 */
import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import catalog from '../openmaus/essential-workforce.json' with {type:'json'};

const roles=new Map(catalog.roles.map(r=>[r.key,r]));
const allowed=Object.freeze({
 'github-public':{name:'GitHub public repository facts',departments:['Technology','PMO','Marketing','Product'],site:'api.github.com'},
 frankfurter:{name:'Frankfurter public currency rates',departments:['Finance','Audit','Operations'],site:'api.frankfurter.dev'},
 openfoodfacts:{name:'Open Food Facts barcode lookup',departments:['Operations','Product'],site:'world.openfoodfacts.org'}
});
const valid=s=>typeof s==='string'&&/^[a-zA-Z0-9_.-]{1,100}$/.test(s);
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const limit=(s,n=180)=>String(s??'').slice(0,n);
const fileFor=root=>resolve(process.env.OFFICE_HQ_DATA_DIR||join(root,'.office-hq-private'),'public-tool-grants.json');
const view=g=>({companyId:g.companyId,employeeId:g.employeeId,roleKey:g.roleKey,provider:g.provider,approvedAt:g.approvedAt});
const authorizes=(g,c,e,p)=>g.companyId===c&&g.employeeId===e&&g.provider===p;

function extract(task){
 const t=String(task||'').slice(0,3000);
 const git=t.match(/(?:github|repository|repo)(?:\s+(?:at|named|called|details for|information on|about))?\s+([a-z0-9][a-z0-9_.-]{0,38}\/[-a-z0-9_.]{1,100})/i);
 if(git&&!git[1].includes('..'))return {provider:'github-public',input:git[1]};
 const fx=t.match(/\b([A-Z]{3})\s+(?:to|into)\s+([A-Z]{3})\b/i);
 if(fx&&/\b(currency|exchange|rate|convert|forex|fx)\b/i.test(t))return {provider:'frankfurter',input:fx[1].toUpperCase()+'-'+fx[2].toUpperCase()};
 const food=t.match(/\b(?:barcode|ean|gtin)\s*(?:number|is|:|#)?\s*(\d{8,14})\b/i);
 if(food)return {provider:'openfoodfacts',input:food[1]};
 return null;
}
function endpoint(provider,input){
 if(provider==='github-public'){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,38}\/[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(input)||input.includes('..'))throw fail('Enter a public owner/repository.');
  return 'https://api.github.com/repos/'+input;
 }
 if(provider==='frankfurter'){
  if(!/^[A-Z]{3}-[A-Z]{3}$/.test(input))throw fail('Enter two three-letter currency codes, e.g. USD-EUR.');
  const [base,quote]=input.split('-');if(base===quote)throw fail('Choose different currencies.');
  return 'https://api.frankfurter.dev/v1/latest?base='+base+'&symbols='+quote;
 }
 if(provider==='openfoodfacts'){
  if(!/^\d{8,14}$/.test(input))throw fail('Enter an 8–14 digit product barcode.');
  return 'https://world.openfoodfacts.org/api/v2/product/'+input+'.json?fields=code,product_name,brands,nutriscore_grade,quantity';
 }
 throw fail('Unsupported public provider.');
}
function summarize(provider,d,input,url){
 if(provider==='github-public'){
  if(d?.private||!d?.full_name)throw fail('Repository is not public or could not be verified.',404);
  return {name:limit(d.full_name),description:limit(d.description,300),stars:Number(d.stargazers_count||0),
   defaultBranch:limit(d.default_branch,80),lastUpdated:limit(d.updated_at,50),source:url};
 }
 if(provider==='frankfurter'){
  const [base,quote]=input.split('-'),rate=d?.rates?.[quote];
  if(!Number.isFinite(rate)||rate<=0)throw fail('No published rate found for that currency pair.',404);
  return {base,quote,rate,date:limit(d.date,30),source:url};
 }
 if(d?.status!==1||!d.product)return {barcode:input,found:false,source:url};
 return {barcode:input,found:true,name:limit(d.product.product_name,180),brand:limit(d.product.brands,130),
  quantity:limit(d.product.quantity,50),nutriscore:limit(d.product.nutriscore_grade,20),source:url};
}
export function createPublicTools({root,request=fetch}={}){
 if(!root)throw Error('Local workspace path required.');
 const path=fileFor(root);let memo,lock=Promise.resolve();
 async function read(){if(memo)return memo;try{const d=JSON.parse(await readFile(path,'utf8'));memo=Array.isArray(d.grants)?d.grants.filter(g=>allowed[g.provider]):[];}
  catch(e){if(e.code!=='ENOENT')throw e;memo=[];}return memo;}
 async function save(grants){await mkdir(resolve(path,'..'),{recursive:true,mode:0o700});
  const tmp=path+'.'+randomUUID();await writeFile(tmp,JSON.stringify({version:1,grants},null,2),{mode:0o600});
  await rename(tmp,path);await chmod(path,0o600).catch(()=>{});memo=grants;}
 const serial=fn=>{const p=lock.then(fn);lock=p.catch(()=>{});return p;};
 function providers(){return Object.entries(allowed).map(([id,p])=>({id,name:p.name,departments:p.departments,mode:'public-read-only',needsCredentials:false}));}
 async function status(){return {localOnly:true,providers:providers(),grants:(await read()).map(view),credentialsConnected:false,note:'These are user-approved permissions for three public GET endpoints, not private account connections. API service availability has not been checked.'};}
 async function action(body){
  if(!body||body.ownerConfirmed!==true)throw fail('CEO approval required before changing API access.',403);
  if(!valid(body.companyId))throw fail('Invalid company.');
  if(body.action==='grant-batch'){
   if(!Array.isArray(body.employees)||body.employees.length===0||body.employees.length>100)throw fail('Provide 1–100 selected employees.');
   return serial(async()=>{
    const previous=await read(),grants=[...previous],added=[];
    for(const e of body.employees){
     if(!valid(e.employeeId)||!roles.has(e.roleKey)||!valid(e.roleKey))throw fail('Employee role not recognized.');
     const role=roles.get(e.roleKey);
     for(const [provider,p] of Object.entries(allowed)){
      if(!p.departments.includes(role.department))continue;
      if(!grants.some(g=>authorizes(g,body.companyId,e.employeeId,provider))){
       const g={companyId:body.companyId,employeeId:e.employeeId,roleKey:e.roleKey,provider,approvedAt:new Date().toISOString()};
       grants.push(g);added.push(view(g));
      }
     }
    }
    if(grants.length>700)throw fail('Too many grants; use individual companies.');
    await save(grants);return {added:added.length,total:grants.filter(g=>g.companyId===body.companyId).length,grants:added,note:'Public read-only service permissions recorded; no provider account was connected.'};
   });
  }
  if(body.action==='revoke-company')return serial(async()=>{
   const before=await read(),remaining=before.filter(g=>g.companyId!==body.companyId);
   await save(remaining);return {revoked:before.length-remaining.length};
  });
  if(body.action==='lookup')return lookup({...body,ownerConfirmed:true});
  throw fail('Unsupported public API operation.');
 }
 async function lookup({companyId,employeeId,roleKey,provider,input}={}){
  if(!valid(companyId)||!valid(employeeId)||!valid(roleKey)||!allowed[provider])throw fail('Invalid company, employee or API.',403);
  const role=roles.get(roleKey);
  if(!role||!allowed[provider].departments.includes(role.department))throw fail('Employee role is not eligible for this API.',403);
  const grants=await read();
  if(!grants.some(g=>authorizes(g,companyId,employeeId,provider)&&g.roleKey===roleKey))throw fail('The CEO has not authorized this employee for this public API.',403);
  const url=endpoint(provider,String(input??''));
  const response=await request(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Accept':'application/json','User-Agent':'OfficeHQ/1.0 (read-only public information; https://github.com/Hostkris/Office-HQ)'}});
  if(!response.ok)throw fail('Public provider returned HTTP '+response.status,response.status===404?404:503);
  const payload=await response.text();if(payload.length>180000)throw fail('Provider response exceeded data limit.',503);
  let data;try{data=JSON.parse(payload);}catch{throw fail('Provider response was not valid JSON.',503);}
  return {provider,employeeId,companyId,readOnly:true,verifiedFromProvider:true,data:summarize(provider,data,String(input),url)};
 }
 async function contextFor({companyId,employeeId,roleKey,description,title}={}){
  const hint=extract([title,description].join('\n'));if(!hint)return null;
  if(!(await read()).some(g=>authorizes(g,companyId,employeeId,hint.provider)&&g.roleKey===roleKey))return null;
  try{return await lookup({companyId,employeeId,roleKey,provider:hint.provider,input:hint.input});}
  catch(e){return {provider:hint.provider,readOnly:true,verifiedFromProvider:false,error:limit(e.message,180)};}
 }
 return {status,action,lookup,contextFor,providers};
}
