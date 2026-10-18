// Runs only within Safari sites the user allowed. No silent auto-login, posting or sending.
(()=>{'use strict';
const cap=(value,max=1500)=>String(value??'').replace(/[\u0000-\u001f]/g,' ').slice(0,max);
const sensitive=el=>{
 const a=[el.type,el.name,el.id,el.autocomplete,el.getAttribute('aria-label')].map(x=>String(x||'')).join(' ').toLowerCase();
 return /password|passcode|one.time|otp|pin|card|cvv|security|verification|payment|bank/.test(a);
};
browser.runtime.onMessage.addListener(async msg=>{
 if(!msg||msg.channel!=='officehq-ios-site')return;
 if(msg.action==='inspect'){
  // Read only the currently visible webpage. Never read form values or website cookies.
  const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(node){
    const parent=node.parentElement;
    if(!parent||['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','OPTION'].includes(parent.tagName))return NodeFilter.FILTER_REJECT;
    if(parent.closest('input,textarea,select,[contenteditable],[type=password]'))return NodeFilter.FILTER_REJECT;
    const css=getComputedStyle(parent);
    if(css.display==='none'||css.visibility==='hidden')return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  let t='',node;
  while((node=walk.nextNode())&&t.length<1800){
   const x=String(node.nodeValue||'').trim();
   if(x)t+=' '+x;
  }
  return {ok:true,url:location.origin,title:cap(document.title,180),excerpt:cap(t,1600),
    note:'Visible page text only; the AI has not verified the data against an external API.'};
 }
 if(msg.action==='insert'){
  const field=document.activeElement;
  if(!field||sensitive(field))return {ok:false,error:'Select an ordinary, non-sensitive text field first.'};
  const textarea=field.tagName==='TEXTAREA',input=field.tagName==='INPUT';
  const safeInput=input&&['text','search'].includes((field.type||'text').toLowerCase());
  // No contenteditable on sites with rich auto-saving editors; prevent unexpected publication.
  if(!textarea&&!safeInput)return {ok:false,error:'Select an ordinary text input or textarea, not an auto-saving editor.'};
  const val=String(msg.text||'').slice(0,450);
  if(val.length<1)return {ok:false,error:'Empty draft.'};
  // Trigger no Enter, submit or click. Native value setter ensures React can detect an input change.
  const setter=Object.getOwnPropertyDescriptor(textarea?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value')?.set;
  if(!setter)return {ok:false,error:'This website does not support ordinary text-field insertion.'};
  setter.call(field,val);
  field.dispatchEvent(new Event('input',{bubbles:true}));
  return {ok:true,note:'Draft text inserted in the selected field. No submit, send or publish button was pressed. This website may auto-save input.'};
 }
 return {ok:false,error:'Unrecognized extension action.'};
});
})();