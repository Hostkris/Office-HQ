// Office HQ provider-specific OAuth gateway. No provider tokens or secrets are returned to clients.
// Start/status/disconnect require Supabase Auth JWT; callback validates one-time OAuth state.
import { createClient } from "npm:@supabase/supabase-js@2";
const SUPA=Deno.env.get("SUPABASE_URL")||"";
const SKEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const APP="https://hostkris.github.io/Office-HQ/cloud.html";
const CALLBACK=SUPA+"/functions/v1/office-oauth";
const admin=createClient(SUPA,SKEY,{auth:{autoRefreshToken:false,persistSession:false}});
const cors=(req:Request)=>({
  "Access-Control-Allow-Origin": ["https://hostkris.github.io","http://127.0.0.1:3000","http://localhost:3000"].includes(req.headers.get("origin")||"")?(req.headers.get("origin")||"https://hostkris.github.io"):"https://hostkris.github.io",
  "Access-Control-Allow-Headers":"authorization,apikey,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Vary":"Origin","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"
});
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json",...cors(req)}});
const secret=(key:string)=>Deno.env.get(key)||"";
const providers:Record<string,{id:string,secret:string,kind:string,scope:string,auth:string,token:string}>={
 gmail:{id:"GOOGLE_CLIENT_ID",secret:"GOOGLE_CLIENT_SECRET",kind:"google",scope:"openid email https://www.googleapis.com/auth/gmail.readonly",auth:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token"},
 calendar:{id:"GOOGLE_CLIENT_ID",secret:"GOOGLE_CLIENT_SECRET",kind:"google",scope:"openid email https://www.googleapis.com/auth/calendar.readonly",auth:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token"},
 drive:{id:"GOOGLE_CLIENT_ID",secret:"GOOGLE_CLIENT_SECRET",kind:"google",scope:"openid email https://www.googleapis.com/auth/drive.metadata.readonly",auth:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token"},
 youtube:{id:"GOOGLE_CLIENT_ID",secret:"GOOGLE_CLIENT_SECRET",kind:"google",scope:"openid email https://www.googleapis.com/auth/youtube.readonly",auth:"https://accounts.google.com/o/oauth2/v2/auth",token:"https://oauth2.googleapis.com/token"},
 tiktok:{id:"TIKTOK_CLIENT_KEY",secret:"TIKTOK_CLIENT_SECRET",kind:"tiktok",scope:"user.info.basic",auth:"https://www.tiktok.com/v2/auth/authorize/",token:"https://open.tiktokapis.com/v2/oauth/token/"},
 x:{id:"X_CLIENT_ID",secret:"X_CLIENT_SECRET",kind:"x",scope:"tweet.read users.read offline.access",auth:"https://twitter.com/i/oauth2/authorize",token:"https://api.x.com/2/oauth2/token"},
 etsy:{id:"ETSY_CLIENT_ID",secret:"ETSY_CLIENT_SECRET",kind:"etsy",scope:"shops_r listings_r",auth:"https://www.etsy.com/oauth/connect",token:"https://api.etsy.com/v3/public/oauth/token"},
 shopify:{id:"SHOPIFY_CLIENT_ID",secret:"SHOPIFY_CLIENT_SECRET",kind:"shopify",scope:"read_products",auth:"",token:""},
 facebook:{id:"META_APP_ID",secret:"META_APP_SECRET",kind:"facebook",scope:"public_profile",auth:"https://www.facebook.com/v26.0/dialog/oauth",token:"https://graph.facebook.com/v26.0/oauth/access_token"},
 instagram:{id:"INSTAGRAM_APP_ID",secret:"INSTAGRAM_APP_SECRET",kind:"instagram",scope:"instagram_business_basic",auth:"https://www.instagram.com/oauth/authorize",token:"https://api.instagram.com/oauth/access_token"}
};
const unsupported:Record<string,string>={
 icloud:"There is no universal third-party iCloud OAuth grant for Mail, Drive and Apple data. A separate Apple-supported connector is required.",
 chime:"Chime has no approved direct banking OAuth connector here. A contracted financial-data aggregator may support consent-based read-only access; banking credentials and transfers are prohibited.",
 lemonade:"No verified Lemonade insurance API authorization is available for independent AI workers.",
 lemon8:"A general-purpose Lemon8 account-management authorization API has not been verified.",
 chatgpt:"ChatGPT account login does not grant API access or private chat histories. Model execution requires separate authorized OpenAI API credentials."
};
const b64=(buf:Uint8Array)=>btoa(String.fromCharCode(...buf)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const bytes=(v:string)=>Uint8Array.from(atob(v.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
const random=(n=32)=>b64(crypto.getRandomValues(new Uint8Array(n)));
const sha=async(input:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input))));
const shaHex=async(input:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input)))).map(x=>x.toString(16).padStart(2,"0")).join("");
async function aesKey(){
 const key=secret("OAUTH_TOKEN_ENCRYPTION_KEY");
 if(!key)throw Error("Vault encryption key is not configured.");
 const raw=bytes(key);
 if(raw.byteLength!==32)throw Error("Vault key must contain 32 bytes.");
 return crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]);
}
async function encrypt(payload:unknown){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const enc=await crypto.subtle.encrypt({name:"AES-GCM",iv},await aesKey(),new TextEncoder().encode(JSON.stringify(payload)));
 return "v1."+b64(iv)+"."+b64(new Uint8Array(enc));
}
async function decrypt(ciphertext:string){
 const [version,iv,data]=ciphertext.split(".");
 if(version!=="v1"||!iv||!data)throw Error("Unexpected vault payload.");
 const raw=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(iv)},await aesKey(),bytes(data));
 return JSON.parse(new TextDecoder().decode(raw));
}
async function refreshConnection(req:Request,userId:string,id:string){
 if(!/^[0-9a-f-]{36}$/.test(id))return json(req,{error:"Invalid connection ID"},422);
 const {data:conn,error}=await admin.from("hq_connections").select("id,provider,owner_id").eq("id",id).eq("owner_id",userId).single();
 if(error||!conn)return json(req,{error:"Connection not found"},404);
 const {data:row,error:se}=await admin.from("hq_connection_secrets").select("ciphertext").eq("connection_id",id).single();
 if(se||!row)return json(req,{error:"No credential available. Reconnect this account."},409);
 const stored=await decrypt(row.ciphertext),provider=String(conn.provider);
 if(provider==="shopify")return json(req,{status:"shopify_offline",note:"Shopify offline installation tokens have no standard refresh endpoint; reinstall if revoked."});
 if(provider==="facebook")return json(req,{error:"Facebook requires explicit reauthorization or the separate long-lived Page-token flow. Reconnect the account."},409);
 if(provider==="instagram")return json(req,{error:"Instagram requires the approved long-lived token refresh flow; please reconnect until that is configured."},409);
 if(!stored.refresh_token)return json(req,{error:"No refresh token is stored. Reconnect and grant offline access."},409);
 const cfg=providers[provider];if(!cfg||!ready(provider))return json(req,{error:"Provider setup is missing."},409);
 const params=new URLSearchParams({grant_type:"refresh_token",refresh_token:stored.refresh_token});
 if(cfg.kind==="google"){params.set("client_id",secret(cfg.id));params.set("client_secret",secret(cfg.secret));}
 if(cfg.kind==="tiktok"){params.set("client_key",secret(cfg.id));params.set("client_secret",secret(cfg.secret));}
 if(cfg.kind==="etsy")params.set("client_id",secret(cfg.id));
 if(cfg.kind==="x")params.set("client_id",secret(cfg.id));
 const headers:Record<string,string>={};
 if(cfg.kind==="x")headers.Authorization="Basic "+btoa(secret(cfg.id)+":"+secret(cfg.secret));
 const raw=await postToken(cfg.token,params,headers);
 if(!raw.access_token)throw Error("Provider did not renew access.");
 const payload={...stored,access_token:String(raw.access_token),refresh_token:raw.refresh_token||stored.refresh_token,expires_at:raw.expires_in?Date.now()+Number(raw.expires_in)*1000:stored.expires_at};
 const {error:save}=await admin.from("hq_connection_secrets").update({ciphertext:await encrypt(payload),updated_at:new Date().toISOString()}).eq("connection_id",id);
 if(save)throw Error("Could not save renewed authorization.");
 return json(req,{refreshed:true,provider});
}
async function getUser(req:Request){
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))throw Error("Sign in to Secure Cloud HQ first.");
 const token=auth.slice(7);
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)throw Error("Your Cloud HQ session has expired.");
 return data.user;
}
function ready(provider:string){
 const cfg=providers[provider];
 return !!cfg&&!!secret(cfg.id)&&!!secret(cfg.secret)&&!!secret("OAUTH_TOKEN_ENCRYPTION_KEY");
}
function checkShop(shop:unknown){
 const v=String(shop||"").toLowerCase().trim();
 if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(v)||v.length>90)throw Error("Enter a valid shop-name.myshopify.com domain.");
 return v;
}
async function assertCompany(userId:string,companyId:string){
 if(!/^[0-9a-f-]{36}$/.test(companyId))throw Error("Choose your Cloud HQ company first.");
 const {data,error}=await admin.from("hq_companies").select("id").eq("id",companyId).eq("owner_id",userId).single();
 if(error||!data)throw Error("You do not own that company.");
}
const webRedirect=(result:string,provider="")=>{
 const u=new URL(APP);u.hash="oauth="+encodeURIComponent(result)+(provider?"&provider="+encodeURIComponent(provider):"");
 return Response.redirect(u.toString(),303);
};
async function bodyOrThrow(resp:Response){
 const text=await resp.text();
 let data:Record<string,any>={};
 try{data=JSON.parse(text)}catch{const form=new URLSearchParams(text);data=Object.fromEntries(form)}
 if(!resp.ok||data.error||data.error_code){throw Error("Provider rejected the authorization exchange.");}
 return data;
}
async function postToken(url:string,params:URLSearchParams,headers:Record<string,string>={}){
 return bodyOrThrow(await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",...headers},body:params,signal:AbortSignal.timeout(12000)}));
}
async function profile(provider:string,token:string,exchange:Record<string,any>,shop:string){
 if(provider==="shopify")return {id:shop,name:shop};
 if(["gmail","calendar","drive","youtube"].includes(provider)){
  const r=await bodyOrThrow(await fetch("https://openidconnect.googleapis.com/v1/userinfo",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000)}));
  if(!r.sub)throw Error("Account identity missing.");
  return {id:String(r.sub),name:String(r.email||r.sub)};
 }
 if(provider==="tiktok"){
  const r=await bodyOrThrow(await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000)}));
  if(!r?.data?.user?.open_id)throw Error("Account identity missing.");
  return {id:String(r.data.user.open_id),name:String(r.data.user.display_name||r.data.user.open_id)};
 }
 if(provider==="etsy"){
  const r=await bodyOrThrow(await fetch("https://openapi.etsy.com/v3/application/users/me",{headers:{Authorization:"Bearer "+token,"x-api-key":secret("ETSY_CLIENT_ID")+":"+secret("ETSY_CLIENT_SECRET")},signal:AbortSignal.timeout(12000)}));
  if(!r.user_id)throw Error("Account identity missing.");
  return {id:String(r.user_id),name:String(r.login_name||r.user_id)};
 }
 if(provider==="x"){
  const r=await bodyOrThrow(await fetch("https://api.x.com/2/users/me?user.fields=name,username",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000)}));
  if(!r?.data?.id)throw Error("Account identity missing.");
  return {id:String(r.data.id),name:String(r.data.username||r.data.name||r.data.id)};
 }
 if(provider==="facebook"){
  const r=await bodyOrThrow(await fetch("https://graph.facebook.com/v26.0/me?fields=id,name",{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(12000)}));
  if(!r.id)throw Error("Account identity missing.");
  return {id:String(r.id),name:String(r.name||r.id)};
 }
 if(provider==="instagram"){
  if(!exchange.user_id)throw Error("Account identity missing.");
  const id=String(exchange.user_id);
  return {id,name:"Instagram account "+id};
 }
 throw Error("Unsupported provider.");
}
async function verifyShopify(url:URL,clientSecret:string,expectedShop:string){
 const shop=checkShop(url.searchParams.get("shop"));
 if(shop!==expectedShop)throw Error("Shop mismatch.");
 const hmac=url.searchParams.get("hmac");
 if(!hmac||!/^[a-f0-9]{64}$/i.test(hmac))throw Error("Shopify signature missing.");
 const sorted=[...url.searchParams.entries()].filter(([key])=>key!=="hmac"&&key!=="signature").sort(([a],[b])=>a.localeCompare(b));
 const message=sorted.map(([k,v])=>k+"="+v).join("&");
 const signature=await crypto.subtle.sign("HMAC",await crypto.subtle.importKey("raw",new TextEncoder().encode(clientSecret),{name:"HMAC",hash:"SHA-256"},false,["sign"]),new TextEncoder().encode(message));
 const expected=Array.from(new Uint8Array(signature)).map(x=>x.toString(16).padStart(2,"0")).join("");
 let diff=0;for(let i=0;i<64;i++)diff|=expected.charCodeAt(i)^hmac.toLowerCase().charCodeAt(i);
 if(diff!==0)throw Error("Shopify signature invalid.");
}
async function exchangeToken(provider:string,pending:any,code:string,url:URL){
 const cfg=providers[provider],id=secret(cfg.id),key=secret(cfg.secret);
 if(provider==="shopify"){
  await verifyShopify(url,key,pending.shop);
  const r=await bodyOrThrow(await fetch("https://"+pending.shop+"/admin/oauth/access_token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:id,client_secret:key,code}),signal:AbortSignal.timeout(12000)}));
  return r;
 }
 const params=new URLSearchParams({grant_type:"authorization_code",code,redirect_uri:CALLBACK});
 if(cfg.kind==="google"){params.set("client_id",id);params.set("client_secret",key);}
 if(cfg.kind==="tiktok"){params.set("client_key",id);params.set("client_secret",key);}
 if(cfg.kind==="etsy"){params.set("client_id",id);params.set("code_verifier",pending.code_verifier);}
 if(cfg.kind==="x"){params.set("client_id",id);params.set("code_verifier",pending.code_verifier);}
 if(cfg.kind==="instagram"){params.set("client_id",id);params.set("client_secret",key);params.delete("redirect_uri");params.set("redirect_uri",CALLBACK);}
 if(cfg.kind==="facebook"){params.set("client_id",id);params.set("client_secret",key);return bodyOrThrow(await fetch(cfg.token+"?"+params.toString(),{signal:AbortSignal.timeout(12000)}));}
 const hdr:Record<string,string>={};
 if(cfg.kind==="x")hdr.Authorization="Basic "+btoa(id+":"+key);
 return postToken(cfg.token,params,hdr);
}
async function callback(req:Request,u:URL){
 const state=u.searchParams.get("state")||"";
 if(state.length<32||state.length>200)return webRedirect("invalid_state");
 const hash=await shaHex(state);
 const {data:rows,error}=await admin.from("hq_oauth_pending").delete().eq("state_hash",hash).select("*");
 const pending=rows?.[0];
 if(error||!pending)return webRedirect("expired_or_invalid_state");
 const provider=pending.provider;
 if(new Date(pending.expires_at).getTime()<Date.now())return webRedirect("expired_state",provider);
 if(u.searchParams.has("error"))return webRedirect("denied",provider);
 const code=u.searchParams.get("code");
 if(!code||code.length>3000||!ready(provider))return webRedirect("setup_required",provider);
 try{
  await assertCompany(pending.owner_id,pending.company_id);
  const raw=await exchangeToken(provider,pending,code,u);
  const token=String(raw.access_token||"");
  if(!token)throw Error("Missing access token.");
  const identity=await profile(provider,token,raw,pending.shop||"");
  const scopes=String(raw.scope||pending.requested_scopes.join(" ")).split(/[ ,]+/).filter(Boolean).slice(0,30);
  const {data:conn,error:ce}=await admin.from("hq_connections").upsert({
   owner_id:pending.owner_id,company_id:pending.company_id,provider,remote_id:identity.id,
   display_name:identity.name.slice(0,255),granted_scopes:scopes,connected_at:new Date().toISOString(),updated_at:new Date().toISOString()
  },{onConflict:"owner_id,company_id,provider,remote_id"}).select("id").single();
  if(ce||!conn)throw Error("Failed to record connected account.");
  const encrypted=await encrypt({access_token:token,refresh_token:raw.refresh_token||null,
   token_type:raw.token_type||"Bearer",expires_at:raw.expires_in?Date.now()+Number(raw.expires_in)*1000:null,provider});
  const {error:se}=await admin.from("hq_connection_secrets").upsert({connection_id:conn.id,ciphertext:encrypted,updated_at:new Date().toISOString()});
  if(se){await admin.from("hq_connections").delete().eq("id",conn.id).eq("owner_id",pending.owner_id);throw Error("Failed to protect credentials.");}
  return webRedirect("connected",provider);
 }catch(e){console.error("OAuth connection callback failure",provider,e instanceof Error?e.message:"unknown");return webRedirect("failed",provider);}
}
async function start(req:Request,userId:string,body:any){
 const provider=String(body.provider||"").toLowerCase();
 if(unsupported[provider])return json(req,{error:unsupported[provider],supported:false},422);
 const cfg=providers[provider];
 if(!cfg)return json(req,{error:"Unknown provider."},422);
 const companyId=String(body.companyId||"");
 await assertCompany(userId,companyId);
 if(!ready(provider))return json(req,{error:"Provider application credentials or encrypted token vault are not configured. Open the provider setup instructions first.",configured:false},409);
 const shop=provider==="shopify"?checkShop(body.shop):null;
 const nonce=random(32),verifier=random(48),challenge=await sha(verifier);
 const {error:dbErr}=await admin.from("hq_oauth_pending").insert({
  state_hash:await shaHex(nonce),owner_id:userId,company_id:companyId,
  provider,code_verifier:verifier,shop,requested_scopes:cfg.scope.split(" ")
 });
 if(dbErr)throw Error("Could not initialize secure authorization.");
 let login="";
 if(provider==="shopify"){
  const u=new URL("https://"+shop+"/admin/oauth/authorize");
  u.searchParams.set("client_id",secret(cfg.id));u.searchParams.set("scope",cfg.scope);
  u.searchParams.set("redirect_uri",CALLBACK);u.searchParams.set("state",nonce);login=u.toString();
 }else{
  const u=new URL(cfg.auth);
  if(provider==="tiktok"){u.searchParams.set("client_key",secret(cfg.id));u.searchParams.set("scope",cfg.scope.replace(/ /g,","));}
  else{u.searchParams.set("client_id",secret(cfg.id));u.searchParams.set("scope",cfg.scope);}
  u.searchParams.set("response_type","code");u.searchParams.set("redirect_uri",CALLBACK);u.searchParams.set("state",nonce);
  if(cfg.kind==="google"){u.searchParams.set("access_type","offline");u.searchParams.set("prompt","consent");}
  if(["x","etsy"].includes(cfg.kind)){u.searchParams.set("code_challenge",challenge);u.searchParams.set("code_challenge_method","S256");}
  login=u.toString();
 }
 return json(req,{authorization_url:login,expires_in:600});
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:cors(req),status:204});
 const u=new URL(req.url);
 if(req.method==="GET"&&(u.searchParams.has("state")||u.searchParams.has("code")||u.searchParams.has("error")))return callback(req,u);
 if(req.method!=="POST")return json(req,{error:"POST with authenticated session required."},405);
 try{
  const user=await getUser(req);
  const body=await req.json();
  if(body.action==="status"){
   const configured=Object.fromEntries(Object.keys(providers).map(p=>[p,ready(p)]));
   return json(req,{configured,unsupported,callback_url:CALLBACK,mode:"oauth-authorization-only",external_actions:false});
  }
  if(body.action==="start")return start(req,user.id,body);
  if(body.action==="refresh")return refreshConnection(req,user.id,String(body.connectionId||""));
  if(body.action==="disconnect"){
   const id=String(body.connectionId||"");
   if(!/^[0-9a-f-]{36}$/.test(id))return json(req,{error:"Invalid connection id"},422);
   const {data,error}=await admin.from("hq_connections").delete().eq("id",id).eq("owner_id",user.id).select("id");
   if(error||!data?.length)return json(req,{error:"Connection not found"},404);
   return json(req,{disconnected:true,note:"Local credentials removed. To revoke the provider's grant, also remove Office HQ from that platform's authorized apps."});
  }
  return json(req,{error:"Unknown action"},422);
 }catch(e){
  const msg=e instanceof Error?e.message:"Unexpected error.";
  const safe=/Sign in|expired|company|valid shop|Unknown provider|vault|initialize/.test(msg)?msg:"Could not complete request. Please try again.";
  return json(req,{error:safe},/Sign in|expired/.test(safe)?401:400);
 }
});