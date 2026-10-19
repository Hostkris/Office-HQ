// Office HQ — iOS Safari extension coordinator. This is a local extension, NOT a cloud browser.
// Only messages from the Office HQ first-party page are accepted. No website passwords, cookies
// or authentication codes are accessed. Per-company employee grants never bypass Safari permissions.
const HOME='https://hostkris.github.io/Office-HQ/';
const SITES={
 google:{hosts:['google.com'],url:'https://www.google.com/',roles:['Technology','Marketing','Leadership','PMO','Sales','Customer']},
 gmail:{hosts:['mail.google.com'],url:'https://mail.google.com/',roles:['Customer','Leadership','Marketing','Sales','PMO']},
 calendar:{hosts:['calendar.google.com'],url:'https://calendar.google.com/',roles:['Leadership','PMO','People']},
 drive:{hosts:['drive.google.com'],url:'https://drive.google.com/',roles:['Leadership','PMO','Technology']},
 youtube:{hosts:['youtube.com'],url:'https://www.youtube.com/',roles:['Marketing']},
 instagram:{hosts:['instagram.com'],url:'https://www.instagram.com/',roles:['Marketing']},
 facebook:{hosts:['facebook.com'],url:'https://www.facebook.com/',roles:['Marketing']},
 tiktok:{hosts:['tiktok.com'],url:'https://www.tiktok.com/',roles:['Marketing']},
 suno:{hosts:['suno.com'],url:'https://suno.com/',roles:['Marketing']},
 lemon8:{hosts:['lemon8-app.com'],url:'https://www.lemon8-app.com/',roles:['Marketing']},
 x:{hosts:['x.com','twitter.com'],url:'https://x.com/',roles:['Marketing']},
 shopify:{hosts:['shopify.com','myshopify.com'],url:'https://admin.shopify.com/',roles:['Sales','Product','Marketing','Customer','Operations','Finance']},
 etsy:{hosts:['etsy.com'],url:'https://www.etsy.com/',roles:['Sales','Product','Marketing','Customer','Operations']},
 chatgpt:{hosts:['chatgpt.com'],url:'https://chatgpt.com/',roles:['Technology','Leadership','Marketing']},
 icloud:{hosts:['icloud.com'],url:'https://www.icloud.com/',roles:['Leadership','PMO','Customer']},
 chime:{hosts:['chime.com'],url:'https://www.chime.com/',roles:['Finance','Audit','Leadership']},
 lemonade:{hosts:['lemonade.com'],url:'https://www.lemonade.com/',roles:['Finance','Audit','Leadership']}
};
function validId(v){return typeof v==='string'&&/^[a-zA-Z0-9_.-]{1,90}$/.test(v);}
function allowed(site,url){
 try{const u=new URL(url),conf=SITES[site];return u.protocol==='https:'&&!!conf&&conf.hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h));}
 catch{return false;}
}
const err=e=>({ok:false,error:String(e||'Operation unsuccessful').slice(0,180)});
const storageKey='officehq_ios_grants_v1';
async function grants(){const data=await browser.storage.local.get(storageKey);return Array.isArray(data?.[storageKey])?data[storageKey]:[];}
async function save(list){await browser.storage.local.set({[storageKey]:list.slice(-180)});}
function match(grant,p){return grant.companyId===p.companyId&&grant.employeeId===p.employeeId&&grant.site===p.site;}
async function findSiteTab(site){
 const tabs=await browser.tabs.query({});
 return tabs.find(t=>allowed(site,t.url||''))||null;
}
async function run(msg,sender){
 if(sender?.tab?.url?.split('#')[0]?.startsWith(HOME)!==true)return err('Only the Office HQ page can request work.');
 const command=msg.command,p=msg.payload||{},list=await grants();
 if(command==='ping')return {ok:true,extension:true,mode:'ios-safari-extension',version:'0.1.0'};
 if(command==='status')return {ok:true,extension:true,
  grants:list.filter(g=>!p.companyId||g.companyId===p.companyId).map(g=>({...g,ownerAssertionOnly:true})),
  sites:Object.keys(SITES)};
 if(command==='authorize'){
  if(!validId(p.companyId)||!validId(p.employeeId)||!SITES[p.site]||!SITES[p.site].roles.includes(p.department))
   return err('Employee company, website or department not eligible.');
  if(p.confirmed!==true)return err('The owner must explicitly confirm the selected employee.');
  if(!await findSiteTab(p.site))return err('Open this website in Safari and sign in yourself before authorizing.');
  const remaining=list.filter(g=>!match(g,p));
  remaining.push({companyId:p.companyId,employeeId:p.employeeId,employeeName:String(p.employeeName||'Employee').slice(0,70),
    site:p.site,department:p.department,grantedAt:new Date().toISOString()});
  await save(remaining);return {ok:true,note:'Employee authorized for this website on this Safari installation. Log-in status was not verified.'};
 }
 if(command==='revoke'){
  if(!validId(p.companyId)||!validId(p.employeeId)||!SITES[p.site])return err('Invalid employee permission.');
  await save(list.filter(g=>!match(g,p)));return {ok:true,note:'Safari employee authorization revoked.'};
 }
 if(command==='forget'){
  if(!validId(p.companyId)||!SITES[p.site]||p.confirm!=='FORGET')return err('Explicit confirmation required.');
  await save(list.filter(g=>!(g.companyId===p.companyId&&g.site===p.site)));
  return {ok:true,note:'Workforce grants removed. Safari sign-in cookies remain managed by Safari; sign out on the website to end that login session.'};
 }
 if(!['inspect','insert'].includes(command))return err('Unsupported Safari command.');
 if(!validId(p.companyId)||!validId(p.employeeId)||!SITES[p.site]||!list.some(g=>match(g,p)))return err('Employee is not authorized for this website.');
 const tab=await findSiteTab(p.site);
 if(!tab||!tab.id)return err('Open the authorized website in Safari first.');
 if(!allowed(p.site,tab.url||''))return err('Site is outside the approved website.');
 if(command==='insert'&&['icloud','chime','lemonade'].includes(p.site))return err('This account is restricted to read-only assistance.');
 try{
  const response=await browser.tabs.sendMessage(tab.id,{channel:'officehq-ios-site',action:command,
    text:command==='insert'?String(p.draft||'').slice(0,450):undefined});
  if(!response?.ok)return err(response?.error||'Website could not be reached. Grant Safari website permissions in Settings.');
  return {ok:true,note:response.note||'Action completed in this browser tab.',
    excerpt:command==='inspect'?String(response.excerpt||'').slice(0,1600):undefined,
    title:command==='inspect'?String(response.title||'').slice(0,180):undefined,
    site:p.site,employeeId:p.employeeId};
 }catch{return err('Safari has not allowed the Office HQ extension on this website, or the tab needs refreshing.');}
}
browser.runtime.onMessage.addListener((msg,sender)=>{
 if(msg?.type!=='office-command')return;
 return run(msg,sender).catch(()=>err('The Safari extension could not complete the requested action.'));
});