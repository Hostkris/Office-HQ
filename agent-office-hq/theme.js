/* Manual Office HQ day/night appearance. Stored separately from workforce data. */
(()=>{
  'use strict';
  const KEY='office-hq-theme-v1';
  const root=document.documentElement;
  let saved=null;
  try{saved=localStorage.getItem(KEY);}catch{}
  let theme=saved==='day'?'day':'night';
  root.dataset.theme=theme;

  function syncButtons(){
    for(const button of document.querySelectorAll('[data-theme-toggle]')){
      const day=theme==='day';
      button.setAttribute('aria-pressed',String(day));
      button.setAttribute('aria-label',day?'Day mode active. Switch to night mode':'Night mode active. Switch to day mode');
      button.title=day?'Switch to night mode':'Switch to day mode';
      const icon=button.querySelector('.theme-icon');
      const label=button.querySelector('.theme-label');
      if(icon)icon.textContent=day?'☀':'☾';
      if(label)label.textContent=day?'Day Mode':'Night Mode';
    }
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',theme==='day'?'#f5f8fa':'#101d29');
  }
  function setTheme(next){
    if(next!=='day'&&next!=='night')return;
    theme=next;
    root.dataset.theme=theme;
    try{localStorage.setItem(KEY,theme);}catch{}
    syncButtons();
    window.dispatchEvent(new CustomEvent('officehq:themechange',{detail:{theme}}));
  }
  function init(){
    syncButtons();
    document.addEventListener('click',event=>{
      if(event.target.closest('[data-theme-toggle]'))setTheme(theme==='night'?'day':'night');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
  window.OfficeHQTheme={get:()=>theme,set:setTheme};
})();