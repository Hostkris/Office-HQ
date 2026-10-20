/* Optional local web-search bridge with a private, bounded OFFLINE reference cache.
 * Configure OFFICE_HQ_SEARCH_URL to an owner-controlled SearXNG endpoint with JSON enabled.
 * No credentials, cookie scraping, account actions, CAPTCHA bypass, or unrestricted network crawling.
 */
import {mkdir,readFile,writeFile,rename,chmod} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
const maxCache=75,dir=()=>resolve(process.env.OFFICE_HQ_NATIVE_DIR||join(process.env.HOME||process.cwd(),'.officehq-agent-engine'));
const store=()=>join(dir(),'research-cache.json');
const short=(v,n=260)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,n).trim();
const base=()=>{
 const raw=String(process.env.OFFICE_HQ_SEARCH_URL||'').trim();
 if(!raw)return null;
 try{
  const url=new URL(raw);
  if(url.username||url.password||url.search||url.hash) return null;
  if(url.protocol!=='https:' && !(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]','::1'].includes(url.hostname)))return null;
  return url;
 }catch{return null;}
};
const validUrl=raw=>{
 try{
  const u=new URL(raw);
  if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return '';
  if(['localhost','127.0.0.1','::1'].includes(u.hostname))return '';
  return u.href.slice(0,600);
 }catch{return '';}
};
async function load(){
 try{const d=JSON.parse(await readFile(store(),'utf8'));return Array.isArray(d)?d:[];}
 catch{return [];}
}
async function save(rows){
 await mkdir(dir(),{recursive:true,mode:0o700});
 const file=store(),tmp=file+'.'+randomUUID();
 await writeFile(tmp,JSON.stringify(rows.slice(-maxCache)),{mode:0o600});
 await rename(tmp,file);await chmod(file,0o600).catch(()=>{});
}
export function createWebResearch({request=fetch}={}){
 async function status(){return {configured:!!base(),cacheEntries:(await load()).length,offlineReady:(await load()).length>0};}
 async function search(query){
  const q=short(query,280);
  if(q.length<3)throw Error('Enter a research question.');
  const entries=await load();
  const saved=entries.find(x=>x.query.toLowerCase()===q.toLowerCase());
  const endpoint=base();
  if(!endpoint){
   return {status:'unconfigured',results:saved?.results||[],cached:!!saved,
    message:saved?'Showing saved sources, not live information.':'Connect a search provider in Mac settings to enable live research. No saved sources for this question.'};
  }
  try{
   const url=new URL('/search',endpoint);url.searchParams.set('q',q);url.searchParams.set('format','json');
   const result=await request(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
   if(!result.ok)throw Error('Search service returned HTTP '+result.status);
   const data=await result.json();
   const results=(Array.isArray(data.results)?data.results:[]).slice(0,8).map(x=>({
    title:short(x.title,175),snippet:short(x.content,330),url:validUrl(x.url)
   })).filter(x=>x.url&&x.title);
   if(results.length){
    await save([...entries.filter(x=>x.query.toLowerCase()!==q.toLowerCase()),{query:q,at:new Date().toISOString(),results}]);
   }
   return {status:'live',results,cached:false,message:results.length?'Live public search results from configured search provider.':'No results returned by search provider.'};
  }catch{
   return {status:'unavailable',results:saved?.results||[],cached:!!saved,
    message:saved?'Search is offline; showing previously saved public-source excerpts.':'Live search is offline and there is no saved result for this query.'};
  }
 }
 return {status,search};
}
