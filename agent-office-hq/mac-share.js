/* Share the GitHub-hosted Office HQ Mac launcher from Safari/Home Screen.
 * Sharing sends a public download URL, never accounts, credentials, local
 * company records or device permissions. The Mac user installs manually.
 */
(()=>{
  'use strict';
  const URL='https://raw.githubusercontent.com/Hostkris/Office-HQ/main/downloads/Office_HQ_for_Mac.zip';
  const LABEL='Office HQ for Mac';
  const notify=message=>{
    const label=document.getElementById('macShareStatus');
    if(label)label.textContent=message;
    if(window.OfficeHQBridge?.toast)window.OfficeHQBridge.toast(message);
  };
  let sharing=false;
  async function shareToMac(){
    if(sharing)return;
    sharing=true;
    try{
      if(typeof navigator.share==='function'){
        try{
          await navigator.share({
            title:LABEL,
            text:'Open this link on your Mac to download Office HQ. Unzip it, then open Office HQ.app.',
            url:URL
          });
          notify('Mac download link shared. Open the link on your Mac to download the ZIP.');
          return;
        }catch(error){
          if(error?.name==='AbortError'){
            notify('Sharing canceled. No files were sent.');
            return;
          }
          // iOS may not allow the native sheet when launched from an older PWA.
          console.info('Office HQ share sheet unavailable:',error);
        }
      }
      if(navigator.clipboard?.writeText){
        try{
          await navigator.clipboard.writeText(URL);
          notify('Mac download link copied. Send it to your Mac using AirDrop or Messages.');
          return;
        }catch(error){
          console.info('Office HQ clipboard unavailable:',error);
        }
      }
      notify('Open the Mac installer page to copy or download the link.');
      if(!location.pathname.endsWith('/mac.html'))window.location.href='./mac.html';
    }finally{sharing=false;}
  }
  document.addEventListener('click',event=>{
    const action=event.target?.closest?.('[data-mac-share]');
    if(!action)return;
    event.preventDefault();
    void shareToMac();
  });
})();
