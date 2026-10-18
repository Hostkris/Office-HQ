// Minimal same-page bridge on Office HQ only. Safari extension tokens and cookies are never returned.
(()=>{'use strict';
const channel='officehq-ios-web-v1';
if(location.origin!=='https://hostkris.github.io'||!location.pathname.startsWith('/Office-HQ/'))return;
window.addEventListener('message',async event=>{
 if(event.source!==window||event.origin!==location.origin)return;
 const input=event.data;
 if(!input||input.channel!==channel||input.sender!=='officehq-page'||typeof input.id!=='string'||input.id.length>90)return;
 const allow=['ping','status','authorize','revoke','inspect','insert','forget'];
 if(!allow.includes(input.command))return;
 try{
  const response=await browser.runtime.sendMessage({type:'office-command',command:input.command,payload:input.payload||{}});
  window.postMessage({channel,sender:'officehq-extension',id:input.id,response},location.origin);
 }catch(error){window.postMessage({channel,sender:'officehq-extension',id:input.id,response:{ok:false,error:'Safari extension could not process the request.'}},location.origin);}
});
})();