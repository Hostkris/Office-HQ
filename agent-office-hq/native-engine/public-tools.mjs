/* Fixed, keyless, read-only public-data tools for approved local draft jobs.
 * No arbitrary URL, shell, cookies, account sessions, OAuth or external writes.
 * Incoming web data is untrusted evidence, never model instructions.
 */
const limited=(x,n=250)=>String(x??'').replace(/[\u0000-\u001f]/g,' ').slice(0,n).trim();
const PAIRS=new Set(['USD','EUR','GBP','JPY','CAD','AUD','CHF','NZD']);
const PUBLIC_TOOLS=Object.freeze([
 {id:'github',name:'GitHub public repository metadata',access:'No API key; read-only; rate limited'},
 {id:'currency',name:'Frankfurter exchange rates',access:'No API key; read-only'},
 {id:'food',name:'Open Food Facts product barcode',access:'No API key; read-only; crowdsourced'}
]);
export const publicToolCatalog=()=>PUBLIC_TOOLS.map(t=>({...t}));
async function json(url,{fetchImpl=fetch}={}){
 // urls are generated ONLY inside this module from validated identifiers.
 const res=await fetchImpl(url,{method:'GET',redirect:'error',credentials:'omit',
  headers:{Accept:'application/json','User-Agent':'OfficeHQ-Local-ReadOnly/1.0'},
  signal:AbortSignal.timeout(7500)});
 if(!res.ok)throw Error('Public provider returned HTTP '+res.status);
 const text=await res.text();
 if(text.length>90000)throw Error('Public provider returned oversized data');
 return JSON.parse(text);
}
function identify(task){
 const value=limited((task?.title||'')+'\n'+(task?.description||''),2900);
 const out=[];
 const github=value.match(/(?:github\.com\/|\b(?:github\s+(?:repository|repo)?|repo)\s*[:\-]?\s*)([a-z\d][a-z\d_.-]{0,38})\/([a-z\d][a-z\d_.-]{0,99})\b/i);
 if(github&&!github[1].includes('..')&&!github[2].includes('..')){
  out.push({id:'github',path:github[1]+'/'+github[2]});
 }
 const pair=value.match(/\b(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD)\s*(?:to|\/|->|→|into|in)\s*(USD|EUR|GBP|JPY|CAD|AUD|CHF|NZD)\b/i);
 if(pair&&/\b(currency|exchange|fx|foreign exchange|convert|rate)\b/i.test(value)){
  const from=pair[1].toUpperCase(),to=pair[2].toUpperCase();
  if(PAIRS.has(from)&&PAIRS.has(to)&&from!==to)out.push({id:'currency',from,to});
 }
 const code=value.match(/\b(?:barcode|EAN|UPC)\s*[:#]?\s*(\d{8,14})\b/i);
 if(code)out.push({id:'food',barcode:code[1]});
 return out.slice(0,2);
}
export async function collectPublicEvidence(task,{fetchImpl=fetch}={}){
 const sources=[];
 for(const req of identify(task)){
  try{
   if(req.id==='github'){
    const url='https://api.github.com/repos/'+encodeURIComponent(req.path.split('/')[0])+'/'+encodeURIComponent(req.path.split('/')[1]);
    const data=await json(url,{fetchImpl});
    if(data?.private||!data?.full_name)continue;
    sources.push({provider:'GitHub',source:limited(data.html_url||'https://github.com/'+req.path,250),
     accessedAt:new Date().toISOString(),facts:{
      repository:limited(data.full_name,160),description:limited(data.description,350),
      stars:Number.isInteger(data.stargazers_count)?data.stargazers_count:null,
      language:limited(data.language,60),updatedAt:limited(data.updated_at,40)}});
   }
   if(req.id==='currency'){
    const url='https://api.frankfurter.dev/v1/latest?base='+req.from+'&symbols='+req.to;
    const data=await json(url,{fetchImpl});
    const rate=Number(data?.rates?.[req.to]);
    if(!Number.isFinite(rate)||rate<=0)throw Error('Rate unavailable');
    sources.push({provider:'Frankfurter',source:'https://frankfurter.dev/',
     accessedAt:new Date().toISOString(),facts:{base:req.from,target:req.to,rate,date:limited(data.date,20)}});
   }
   if(req.id==='food'){
    const url='https://world.openfoodfacts.org/api/v2/product/'+req.barcode+'.json?fields=code,product_name,brands,quantity';
    const data=await json(url,{fetchImpl});
    if(data.status!==1||!data.product)throw Error('Barcode is not in Open Food Facts');
    sources.push({provider:'Open Food Facts',source:'https://world.openfoodfacts.org/product/'+req.barcode,
     accessedAt:new Date().toISOString(),facts:{
      barcode:req.barcode,name:limited(data.product.product_name,220),
      brand:limited(data.product.brands,160),quantity:limited(data.product.quantity,100)}});
   }
  }catch{/* Absence of live evidence must not be misrepresented as verified data. */}
 }
 return sources;
}
