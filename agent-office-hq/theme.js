/* Manual Office HQ day/night appearance. Stored separately from workforce data. */
(()=>{
  'use strict';
  const KEY='office-hq-theme-v1';
  const root=document.documentElement;
  let saved=null;
  try{saved=localStorage.getItem(KEY);}catch{}
  // New installations start in readable light mode; explicit night/day choices persist.
  let theme=saved==='night'?'night':'day';
  root.dataset.theme=theme;

  // Shared scene palette for the canvas-based RPG floor (including Command Center).
  // Only office scenery and readable UI labels are remapped; custom worker
  // skin, hair and outfit colors continue to use their original values.
  const DAY_SCENE_COLORS=Object.freeze({
    '#243c4a':'#e6eef3','#2a4553':'#e8f0f4','#2d4b59':'#d8e5ed',
    '#102c3b':'#f8fcff','#e7f4ef':'#1d3d4b','#91cfbe':'#4a6b72',
    '#e7c87d':'#845d11','#193541':'#fffefd','#f6dfab':'#79521c',
    '#957458':'#b28a68','#e2b97f':'#d7b084','#446573':'#c0d8e1',
    '#171f28':'#42596a','#c3a97e':'#987346','#3c6070':'#d4e6ee',
    '#d2e8e6':'#2d6973','#244957':'#f5fbff','#f4dc96':'#765417',
    '#936f52':'#a27b5b','#192e3c':'#345362','#c3d9d3':'#3d6570',
    '#f1dfb0':'#72501e','#193440':'#d1e2e8','#294d5a':'#f8fbff',
    '#987858':'#b38d6d','#c8a078':'#d5b187','#152938':'#314d5d',
    '#72c8c5':'#85d5d5','#182938':'#486674','#436572':'#bed8e2',
    '#c1d7d8':'#395e6c','#142d3970':'#6b899344','#263d49':'#405a67',
    '#122d3dea':'#fffdf4ef','#f1dc9d':'#765515','#e8f5ec':'#294655',
    '#b3d8d2':'#4c6c7a','#122d3df0':'#fffffff5','#eed08d':'#74591a',
    '#f6e3b4':'#654c28','#c8b992':'#9c855e','#b4ebba':'#246c52',
    '#f8e7b5':'#664c20','#d9ece4':'#466977',
    // Standalone fallback scene, if the animated office module isn't loaded.
    '#1b3544':'#e6eef3','#244858':'#e8f0f4','#294d5b':'#d8e5ed',
    '#102e3d':'#f8fcff','#e0f4ef':'#1d3d4b','#89c6c0':'#4a6b72',
    '#365867':'#d1e2e8','#e7cd80':'#845d11','#345d60':'#e8f4f5',
    '#2a505d':'#f8fbff','#936f54':'#b38d6d','#c39b6d':'#d5b187',
    '#1a2939':'#314d5d','#69c4c4':'#85d5d5','#315c64':'#51717b',
    '#243844':'#486674','#192833':'#345362','#466973':'#bed8e2',
    '#9bb8b7':'#395e6c','#76a6a6':'#7eafb7','#314b59':'#405a67',
    '#16323dea':'#fffdf4ef','#eac887':'#845d11','#e2efec':'#294655',
    '#e4d18e':'#74591a','#b7ecc0':'#246c52','#e0e9e2':'#466977',
    '#f0e1aa':'#765515'
  });
  function sceneColor(color){
    return theme==='day'?(DAY_SCENE_COLORS[String(color).toLowerCase()]||color):color;
  }

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
  window.OfficeHQTheme={get:()=>theme,set:setTheme,sceneColor};
})();