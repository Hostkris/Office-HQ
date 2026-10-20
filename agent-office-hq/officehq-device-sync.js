/* Office HQ device-to-device synchronization indicator.
 * Truthful connection status: a browser online state, a local Mac process
 * or a cloud sign-in alone are never proof of successful two-way data sync.
 * The indicator turns on only after a trusted same-origin endpoint attests:
 * authenticated pairing, live remote peer, and recent bidirectional ACKs.
 */
(()=>{
  'use strict';
  const MAX_AGE_MS=90_000;
  const POLL_MS=15_000;
  const LOCAL_HOSTS=new Set(['localhost','127.0.0.1','[::1]','::1']);
  const CONNECTED='Mac and iPhone/iPad are securely paired and syncing.';
  const DISCONNECTED='Mac and iPhone/iPad are not synced.';
  let state={connected:false,reason:'No authenticated cross-device synchronization has been configured.',checkedAt:null,peer:''};
  let inFlight=false;
  const local=()=>LOCAL_HOSTS.has(location.hostname);
  const fresh=(value,now)=>{
    const ms=Date.parse(value);
    return typeof value==='string'&&Number.isFinite(ms)&&ms<=now+10_000&&now-ms>=0&&now-ms<MAX_AGE_MS;
  };
  function verified(data,now=Date.now()){
    return !!(
      data&&data.connected===true&&
      data.authenticated===true&&data.paired===true&&
      data.peerOnline===true&&data.bidirectional===true&&
      typeof data.peerDevice==='string'&&/^(mac|iphone|ipad|ios)$/i.test(data.peerDevice)&&
      fresh(data.lastInboundAck,now)&&fresh(data.lastOutboundAck,now)
    );
  }
  function snapshot(){return {...state};}
  function textFor(){
    return state.connected?'Synced':'Not synced';
  }
  function statusFor(){
    if(state.connected)return CONNECTED;
    if(!navigator.onLine)return 'Offline. The devices are not syncing.';
    return DISCONNECTED+' '+state.reason;
  }
  function draw(){
    for(const button of document.querySelectorAll('[data-hq-sync-indicator]')){
      button.classList.toggle('is-connected',state.connected);
      button.classList.toggle('is-disconnected',!state.connected);
      button.dataset.connected=String(state.connected);
      button.setAttribute('aria-label',(state.connected?'Device sync connected. ':'Device sync disconnected. ')+statusFor());
      button.setAttribute('title',statusFor());
      const label=button.querySelector('[data-hq-sync-label]');
      if(label)label.textContent=textFor();
    }
    for(const content of document.querySelectorAll('[data-hq-sync-explanation]')){
      content.textContent=statusFor()+(state.checkedAt?' Checked '+new Date(state.checkedAt).toLocaleTimeString([],{
        hour:'numeric',minute:'2-digit'
      })+'.':'');
    }
  }
  function set(next){
    state=next;
    draw();
    window.dispatchEvent?.(new CustomEvent('officehq:syncstatus',{detail:snapshot()}));
  }
  async function refresh(){
    if(inFlight)return;
    inFlight=true;
    try{
      if(navigator.onLine===false){
        set({connected:false,reason:'Device is offline.',checkedAt:Date.now(),peer:''});
        return;
      }
      if(!local()){
        // The public GitHub Pages origin is static. Cloud login, internet
        // service, or merely seeing the Mac's name do not prove sync.
        set({connected:false,reason:'No authenticated Mac pairing is active in this web app.',checkedAt:Date.now(),peer:''});
        return;
      }
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),5000);
      try{
        const response=await fetch('/api/device-sync/status',{
          method:'GET',cache:'no-store',credentials:'same-origin',signal:controller.signal
        });
        if(!response.ok)throw Error('No supported sync status endpoint.');
        const info=await response.json();
        // Even a locally running server must provide recently verified
        // bi-directional acknowledgements. Do not trust online-only pings.
        if(verified(info)){
          set({connected:true,reason:'',peer:info.peerDevice,checkedAt:Date.now()});
        }else{
          set({connected:false,reason:String(info?.reason||'No verified two-way sync or paired device.').slice(0,180),checkedAt:Date.now(),peer:''});
        }
      }finally{clearTimeout(timeout);}
    }catch{
      set({connected:false,reason:'The Mac has not confirmed a paired, two-way sync.',checkedAt:Date.now(),peer:''});
    }finally{inFlight=false;}
  }
  function markup(compact=false){
    return '<div class="hq-device-sync-wrap'+(compact?' is-compact':'')+'">'+
      '<button type="button" class="hq-device-sync is-disconnected" data-hq-sync-indicator data-connected="false" '+
      'aria-label="Device sync disconnected. Mac and iPhone/iPad are not synced." title="Mac and iPhone/iPad are not synced.">'+
      '<span class="hq-sync-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><b class="hq-sync-x">×</b></span>'+
      '<span class="hq-sync-name" data-hq-sync-label>Not synced</span>'+
      '</button>'+
      (!compact?'<span class="hq-sync-caption">Mac ↔ iPhone / iPad</span>':'')+
      '<span class="hq-sync-detail" data-hq-sync-explanation aria-live="polite">Mac and iPhone/iPad are not synced.</span>'+
      '</div>';
  }
  function infoClick(event){
    const btn=event.target.closest?.('[data-hq-sync-indicator]');
    if(!btn)return;
    const wrap=btn.closest('.hq-device-sync-wrap');
    if(!wrap)return;
    wrap.classList.toggle('show-details');
    if(wrap.classList.contains('show-details')){void refresh();}
    draw();
  }
  document.addEventListener('click',infoClick);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
  window.addEventListener?.('online',()=>{void refresh();});
  window.addEventListener?.('offline',()=>{void refresh();});
  window.addEventListener?.('pageshow',()=>{void refresh();});
  window.OfficeHQDeviceSync={markup,refresh,draw,snapshot,verified};
  const start=()=>{draw();void refresh();setInterval(()=>{if(!document.hidden)void refresh();},POLL_MS);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();