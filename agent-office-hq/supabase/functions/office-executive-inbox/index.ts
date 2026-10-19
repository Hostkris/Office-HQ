// Secure read-only Gmail monitor for Office HQ's existing Executive Assistant role.
// Provider tokens are never exposed to the browser. No Gmail send/modify/delete calls.
import { createClient } from "npm:@supabase/supabase-js@2";
const URL_BASE=Deno.env.get("SUPABASE_URL")||"";
const admin=createClient(URL_BASE,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{autoRefreshToken:false,persistSession:false}});
const allowed=["https://hostkris.github.io","http://localhost:3000","http://127.0.0.1:3000"];
function cors(req:Request){const origin=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":allowed.includes(origin)?origin:allowed[0],"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type","Cache-Control":"no-store","Vary":"Origin"};}
function answer(req:Request,value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json","X-Content-Type-Options":"nosniff",...cors(req)}});}
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
const encode=(b:Uint8Array)=>btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
async function cipherKey(){const k=Deno.env.get("OAUTH_TOKEN_ENCRYPTION_KEY")||"";if(!k)throw Error("The secure Gmail credential vault has not been configured.");const raw=decode(k);if(raw.length!==32)throw Error("The credential vault key is invalid.");return crypto.subtle.importKey("raw",raw,"AES-GCM",false,["decrypt","encrypt"]);}
async function decrypt(s:string){const [v,iv,encrypted]=s.split(".");if(v!=="v1"||!iv||!encrypted)throw Error("Gmail token format is unsupported.");const p=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(iv)},await cipherKey(),decode(encrypted));return JSON.parse(new TextDecoder().decode(p));}
async function encrypt(p:unknown){const iv=crypto.getRandomValues(new Uint8Array(12));const raw=await crypto.subtle.encrypt({name:"AES-GCM",iv},await cipherKey(),new TextEncoder().encode(JSON.stringify(p)));return "v1."+encode(iv)+"."+encode(new Uint8Array(raw));}
async function actor(req:Request){const authorization=req.headers.get("Authorization")||"";if(!authorization.startsWith("Bearer "))throw Error("Sign in to Secure Cloud HQ.");const {data,error}=await admin.auth.getUser(authorization.slice(7));if(error||!data.user)throw Error("Your Cloud HQ session expired.");return data.user.id;}
async function company(owner:string,companyId:string){if(!uuid(companyId))throw Error("Choose a valid company.");const {data,error}=await admin.from("hq_companies").select("id").eq("owner_id",owner).eq("id",companyId).maybeSingle();if(error||!data)throw Error("You do not own that company.");}
async function gmail(owner:string,companyId:string){
 const {data,error}=await admin.from("hq_connections").select("id,provider,granted_scopes,display_name").eq("owner_id",owner).eq("company_id",companyId).eq("provider","gmail").order("connected_at",{ascending:false}).limit(1);
 if(error)throw Error("Could not check Gmail connection.");
 if(!data?.length)throw Error("Connect Gmail through Secure Cloud HQ before assigning inbox access.");
 const conn=data[0];
 if(!(conn.granted_scopes||[]).includes("https://www.googleapis.com/auth/gmail.readonly"))throw Error("Reconnect Gmail and grant read-only email access.");
 return conn;
}
async function token(connId:string){
 const {data,error}=await admin.from("hq_connection_secrets").select("ciphertext").eq("connection_id",connId).maybeSingle();
 if(error||!data)throw Error("Gmail connection token unavailable. Reconnect Gmail.");
 let stored=await decrypt(data.ciphertext);
 if(stored.expires_at&&Number(stored.expires_at)<Date.now()+60000){
  if(!stored.refresh_token)throw Error("Gmail authorization expired. Reconnect Gmail.");
  const clientId=Deno.env.get("GOOGLE_CLIENT_ID")||"",clientSecret=Deno.env.get("GOOGLE_CLIENT_SECRET")||"";
  if(!clientId||!clientSecret)throw Error("Google client authorization is not configured.");
  const form=new URLSearchParams({client_id:clientId,client_secret:clientSecret,refresh_token:String(stored.refresh_token),grant_type:"refresh_token"});
  const resp=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form,signal:AbortSignal.timeout(12000)});
  const body=await resp.json();
  if(!resp.ok||!body.access_token)throw Error("Gmail access must be renewed through Google sign-in.");
  stored={...stored,access_token:String(body.access_token),expires_at:Date.now()+Number(body.expires_in||3500)*1000,refresh_token:body.refresh_token||stored.refresh_token};
  const {error:updateError}=await admin.from("hq_connection_secrets").update({ciphertext:await encrypt(stored),updated_at:new Date().toISOString()}).eq("connection_id",connId);
  if(updateError)throw Error("Could not securely renew Gmail access.");
 }
 if(!stored.access_token)throw Error("Gmail access token missing.");
 return String(stored.access_token);
}
async function gmailGet(path:string,accessToken:string){const resp=await fetch("https://gmail.googleapis.com/gmail/v1/users/me/"+path,{headers:{"Authorization":"Bearer "+accessToken},signal:AbortSignal.timeout(12000)});
 if(!resp.ok){if(resp.status===401||resp.status===403)throw Error("Gmail authorization was rejected; reconnect and check Gmail API permissions.");throw Error("Gmail read request failed.");}
 return resp.json();
}
function classify(subject:string,snippet:string,sender:string){
 const s=(subject+" "+snippet).toLowerCase();
 if(/\b(urgent|asap|immediate|action required|past due|overdue|payment failed|account suspended|security alert|deadline today|verify your account)\b/.test(s))return ["urgent","Contains a time-sensitive or security-related phrase (preliminary)."];
 if(/\b(customer|client|order|refund|invoice|payment|proposal|meeting|appointment|contract|follow.up|deadline|shipping|application|interview|opportunity)\b/.test(s))return ["important","Contains a possible business or follow-up topic (preliminary)."];
 if(/no.reply|noreply/.test(sender.toLowerCase()))return ["routine","Automated sender; review if relevant."];
 return ["routine","No priority phrase found; review manually if necessary."];
}
async function scan(owner:string,companyId:string){
 const connection=await gmail(owner,companyId);
 const accessToken=await token(connection.id);
 const list=await gmailGet("messages?labelIds=INBOX&maxResults=20&q="+encodeURIComponent("newer_than:7d"),accessToken);
 const refs=Array.isArray(list.messages)?list.messages.slice(0,20):[];
 const items:Record<string,unknown>[]=[];
 for(let i=0;i<refs.length;i+=5){
  const batch=await Promise.allSettled(refs.slice(i,i+5).map((m:any)=>gmailGet("messages/"+encodeURIComponent(String(m.id))+"?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date",accessToken)));
  for(const result of batch){if(result.status!=="fulfilled")continue;const m=result.value;const headers=Array.isArray(m.payload?.headers)?m.payload.headers:[];
   const get=(name:string)=>String(headers.find((h:any)=>String(h.name).toLowerCase()===name)?.value||"").slice(0,name==="subject"?300:250);
   const subject=get("subject")||"(no subject)",sender=get("from")||"Unknown sender",snippet=String(m.snippet||"").slice(0,500);
   const [priority,reason]=classify(subject,snippet,sender);
   items.push({owner_id:owner,company_id:companyId,connection_id:connection.id,gmail_id:String(m.id).slice(0,100),thread_id:String(m.threadId||m.id).slice(0,100),sender,subject,snippet,priority,reason,received_at:m.internalDate?new Date(Number(m.internalDate)).toISOString():null,reviewed_at:new Date().toISOString()});
  }
 }
 let newImportant:Record<string,unknown>[]=[];
 if(items.length){
  // Notify the CEO only about previously unseen important or urgent inbox messages.
  const {data:known,error:knownError}=await admin.from("hq_exec_email_reviews")
   .select("gmail_id").eq("connection_id",connection.id)
   .in("gmail_id",items.map(i=>String(i.gmail_id)));
  if(knownError)throw Error("Could not check prior inbox reviews.");
  const seen=new Set((known||[]).map(r=>String(r.gmail_id)));
  newImportant=items.filter(i=>i.priority!=="routine"&&!seen.has(String(i.gmail_id)));
  const {error}=await admin.from("hq_exec_email_reviews").upsert(items,{onConflict:"connection_id,gmail_id"});
  if(error)throw Error("Could not securely save the Executive Assistant email review.");
  if(newImportant.length){
   const alerts=newImportant.slice(0,5).map(i=>({
    owner_id:owner,company_id:companyId,sender:"Executive Assistant",
    body:("Email "+String(i.priority).toUpperCase()+": "+String(i.subject)+" | From: "+String(i.sender)+
      ". Review the original in Executive Assistant → Gmail inbox. No reply was sent.").slice(0,1590)
   }));
   // Reports are already safely stored if an optional internal notification fails.
   const {error:notifyError}=await admin.from("hq_messages").insert(alerts);
   if(notifyError)console.error("Internal inbox alert could not be written.");
  }
 }
 const {data:existing}=await admin.from("hq_exec_email_settings").select("enabled").eq("owner_id",owner).eq("company_id",companyId).maybeSingle();
 const settings={owner_id:owner,company_id:companyId,role_key:"exec_assistant",enabled:!!existing?.enabled,last_scan_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()};
 const {error:sErr}=await admin.from("hq_exec_email_settings").upsert(settings,{onConflict:"owner_id,company_id"});if(sErr)throw Error("Could not save inbox scan status.");
 return {worker:"Executive Assistant",company_id:companyId,connection:connection.display_name,checked:refs.length,reviewed:items.length,urgent:items.filter(x=>x.priority==="urgent").length,important:items.filter(x=>x.priority==="important").length,read_only:true,scanned_at:settings.last_scan_at};
}
function officeHour(){
 const d=new Date();
 const fields=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",weekday:"short",hour:"numeric",hourCycle:"h23"}).formatToParts(d);
 const get=(type:string)=>fields.find(x=>x.type===type)?.value||"";
 const hour=Number(get("hour")),weekday=get("weekday");
 return !["Sat","Sun"].includes(weekday)&&hour>=9&&hour<18;
}
async function secureCron(req:Request){
 const supplied=req.headers.get("x-office-cron-key")||"";
 const {data,error}=await admin.from("hq_exec_email_cron_secret").select("secret").eq("id",true).maybeSingle();
 if(error||!data||supplied.length!==64||data.secret.length!==64) return false;
 const enc=new TextEncoder(),a=enc.encode(supplied),b=enc.encode(data.secret);
 let diff=0;for(let i=0;i<64;i++)diff|=a[i]^b[i];
 return diff===0;
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=="POST")return answer(req,{error:"POST required."},405);
 try{
  const body=await req.json(),action=String(body.action||"");
  if(action==="cron"){
   if(!await secureCron(req))return answer(req,{error:"Unauthorized."},401);
   if(!officeHour())return answer(req,{skipped:"Outside weekday 9am–6pm America/New_York"});
   const {data,error}=await admin.from("hq_exec_email_settings").select("owner_id,company_id").eq("enabled",true).limit(100);
   if(error)throw Error("Could not load enabled monitoring settings.");
   let processed=0,failures=0;
   for(const p of data||[]){try{await scan(p.owner_id,p.company_id);processed++;}
    catch{failures++;await admin.from("hq_exec_email_settings").update({last_error:"Gmail scan failed. Check the connection and permissions.",updated_at:new Date().toISOString()}).eq("owner_id",p.owner_id).eq("company_id",p.company_id);}}
   return answer(req,{worker:"Executive Assistant",processed,failures});
  }
  const owner=await actor(req),companyId=String(body.companyId||"");
  await company(owner,companyId);
  if(action==="scan")return answer(req,await scan(owner,companyId));
  if(action==="configure"){
    const enabled=body.enabled===true;
    if(enabled)await gmail(owner,companyId);
    const {error}=await admin.from("hq_exec_email_settings").upsert({owner_id:owner,company_id:companyId,role_key:"exec_assistant",enabled,updated_at:new Date().toISOString()},{onConflict:"owner_id,company_id"});
    if(error)throw Error("Could not save Executive Assistant monitoring setting.");
    return answer(req,{worker:"Executive Assistant",enabled,read_only:true});
  }
  return answer(req,{error:"Unknown request."},422);
 }catch(e){
  const s=e instanceof Error?e.message:"Unexpected error.";
  const safe=/Sign in|expired|valid company|own that company|Connect Gmail|Reconnect Gmail|Gmail authorization|Gmail access|Google client|not configured|read-only|connection token|Unknown request|Could not/.test(s)?s:"Executive Assistant inbox request failed.";
  return answer(req,{error:safe},/Sign in|expired/.test(safe)?401:/Connect Gmail|Reconnect Gmail|not configured/.test(safe)?409:400);
 }
});
