import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function loadTheme(script,storage){
  const listeners=new Map(),attrs=new Map(),icon={textContent:''},label={textContent:''};
  const button={title:'',setAttribute:(key,value)=>attrs.set(key,value),querySelector:sel=>sel==='.theme-icon'?icon:sel==='.theme-label'?label:null};
  const meta={setAttribute:(k,v)=>attrs.set('meta:'+k,v)};
  const html={dataset:{}};
  const document={
    documentElement:html,readyState:'complete',
    querySelectorAll:sel=>sel==='[data-theme-toggle]'?[button]:[],
    querySelector:sel=>sel==='meta[name="theme-color"]'?meta:null,
    addEventListener:(event,fn)=>listeners.set(event,fn)
  };
  const win={dispatchEvent:()=>{}};
  const CustomEvent=class{constructor(name,opts){this.type=name;this.detail=opts.detail;}};
  vm.runInNewContext(script,{document,window:win,CustomEvent,localStorage:storage});
  return {html,attrs,icon,label,click:()=>listeners.get('click')({target:{closest:sel=>sel==='[data-theme-toggle]'?button:null}}),api:win.OfficeHQTheme};
}
test('manual theme toggles on every visit and defaults new installations to readable day mode',async()=>{
  const script=await readFile(path.join(root,'theme.js'),'utf8');
  const saved=new Map();
  const storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
  const first=loadTheme(script,storage);
  assert.equal(first.html.dataset.theme,'day');
  assert.equal(first.label.textContent,'Day Mode');
  assert.equal(first.attrs.get('meta:content'),'#f5f8fa');
  first.click();
  assert.equal(first.html.dataset.theme,'night');
  assert.equal(first.attrs.get('aria-pressed'),'false');
  assert.equal(saved.get('office-hq-theme-v1'),'night');
  const second=loadTheme(script,storage);
  assert.equal(second.html.dataset.theme,'night','an explicit user preference must remain night');
  second.click();
  assert.equal(second.html.dataset.theme,'day');
  assert.equal(saved.get('office-hq-theme-v1'),'day');
});
test('day theme is shared by both Office HQ entrypoints and cached for offline use',async()=>{
  const index=await readFile(path.join(root,'index.html'),'utf8');
  const cloud=await readFile(path.join(root,'cloud.html'),'utf8');
  const sw=await readFile(path.join(root,'sw.js'),'utf8');
  const css=await readFile(path.join(root,'styles.css'),'utf8');
  for(const html of [index,cloud]){assert.match(html,/src="\.?\/?theme\.js"/);assert.match(html,/data-theme-toggle/);}
  assert.match(sw,/'\.\/theme\.js'/);
  assert.match(css,/:root\[data-theme="day"\]/);
  assert.match(css,/:root\[data-theme="night"\]/);
});


test('the canvas RPG office and its command view share daytime scenery without recoloring agents',async()=>{
  const themeScript=await readFile(path.join(root,'theme.js'),'utf8');
  const sceneScript=await readFile(path.join(root,'office-life.js'),'utf8');
  const saved=new Map([['office-hq-theme-v1','night']]);
  const theme=loadTheme(themeScript,{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)});
  const nightBackdrop=theme.api.sceneColor('#243c4a');
  const originalSkin='#f5d6bd';
  assert.equal(nightBackdrop,'#243c4a');
  assert.equal(theme.api.sceneColor(originalSkin),originalSkin);

  const context={window:{OfficeHQTheme:theme.api},Date,Math,Array,Map,Set,String,Number,console};
  vm.runInNewContext(sceneScript,context,{filename:'office-life.js'});
  const life=context.window.OfficeHQOfficeLife;
  const fills=[];
  const canvas={
    fillStyle:'',textAlign:'left',font:'',
    fillRect(x,y,w,h){if(x===0&&y===0&&w===1240&&h===1135)fills.push(this.fillStyle);},
    beginPath(){},roundRect(){},fill(){},fillText(){},save(){},restore(){},translate(){}
  };
  const payload={c:canvas,now:100,cid:'company',floor:{id:'level1',name:'Level 1',placements:[],janitor:false},project:null,
    handoff:null,staff:[],tasks:[],approvals:[],thoughts:{},B:{roleFor:()=>({title:'Staff'})}};
  life.draw(payload);
  assert.equal(fills.at(-1),'#243c4a','the original night scene remains intact');
  theme.api.set('day');
  life.draw(payload);
  assert.equal(fills.at(-1),'#e6eef3','daylight repaints the real RPG canvas without reloading');
  assert.equal(theme.api.sceneColor('#122d3dea'),'#fffdf4ef','thought bubbles become daytime readable');
  assert.equal(theme.api.sceneColor(originalSkin),originalSkin,'skin tones are never recolored');
  theme.api.set('night');
  life.draw(payload);
  assert.equal(fills.at(-1),'#243c4a','night mode restores the original canvas palette');
});

test('RPG employee controls follow both modes and reduced-motion still repaints',async()=>{
  const css=await readFile(path.join(root,'styles.css'),'utf8');
  const floor=await readFile(path.join(root,'project-floor.js'),'utf8');
  assert.match(css,/\[data-theme="day"\] \.pf-person\{/);
  assert.match(css,/\[data-theme="day"\] \.pf-command-controls \[data-pf="command-remove"\]/);
  assert.match(css,/\[data-theme="day"\] \.pf-command-controls label/);
  assert.match(floor,/officehq:themechange/);
  assert.match(floor,/if\(ctx&&\$\('#officeCanvas'\)\)renderFloor\(ctx,performance\.now\(\)\)/);
  assert.match(floor,/sceneColor\(focused\?/,'fallback RPG scene also obeys appearance switch');
});

test('company inbox voice fields and message headings use high-contrast light colors',async()=>{
  const css=await readFile(path.join(root,'officehq-voice.css'),'utf8');
  assert.match(css,/\[data-theme="day"\] \.hq-voice-composer :is\(textarea,select\)/);
  assert.match(css,/\[data-theme="day"\] \.ops-thread-list \.ops-message/);
  assert.match(css,/\[data-theme="day"\] \.ops-thread-list \.ops-message :is\(\.ops-msg-top/);
  // WCAG contrast checks for our explicit day-mode text/background pairs.
  function luminance(hex){const rgb=hex.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255).map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
  function contrast(a,b){const x=luminance(a.slice(1)),y=luminance(b.slice(1));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  for(const [fg,bg] of [['#193744','#ffffff'],['#193744','#f0f6f8'],['#355a67','#f1f9fa'],['#4b6672','#ffffff']])assert.ok(contrast(fg,bg)>=4.5,fg+' on '+bg+' below AA contrast');
});


test('day-mode audit covers dashboard, workflow, office, modal, email, phone and voice surfaces',async()=>{
  const css=await readFile(path.join(root,'styles.css'),'utf8');
  const voice=await readFile(path.join(root,'officehq-voice.css'),'utf8');
  const cloud=await readFile(path.join(root,'cloud.html'),'utf8');
  const floor=await readFile(path.join(root,'project-floor.js'),'utf8');
  const expected=['.hero-band','.brand-mark','.nav-count','.field label','.close-modal',
    '.office-plan-form label','.ios-guide','.ios-insert textarea','.pf-route-builder',
    '.pf-route-item','.ops-msg-top','.ops-message details pre','.budget-row .tiny',
    '.desktop-check','.brief','.task-card:hover','.office-phone-header'];
  for(const selector of expected){
    assert.ok(css.includes(selector), 'Day-mode stylesheet missing '+selector);
  }
  assert.match(css,/\[data-theme="day"\] \.hero-band\s*\{/);
  assert.match(css,/background:linear-gradient\(110deg,#e0f3f2/);
  assert.match(voice,/\[data-theme="day"\] \.ops-thread-list \.ops-message/);
  assert.match(voice,/\[data-theme="day"\] \.hq-voice-composer :is\(textarea,select\)/);
  assert.match(cloud,/\[data-theme="day"\] \.error\{color:#a53842\}/);
  assert.match(floor,/sceneColor\(\(Math\.floor\(x\/28/);
  // Text colors on their declared pale day-mode surfaces must reach WCAG AA.
  const toLin=(h)=>h.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255)
    .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  const lum=h=>{const c=toLin(h.slice(1));return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const contrast=(a,b)=>{const l=lum(a),r=lum(b);return (Math.max(l,r)+.05)/(Math.min(l,r)+.05);};
  for(const [fg,bg] of [
    ['#1c3542','#e0f3f2'], // header band
    ['#193744','#ffffff'], // inputs/messages
    ['#466773','#eef6f9'], // hero description
    ['#355968','#ffffff'], // form labels
    ['#a13d30','#ffffff'], // budget alert
    ['#ffffff','#096f73']  // highlighted brand / primary action
  ])assert.ok(contrast(fg,bg)>=4.5,fg+' vs '+bg+' contrast is too low');
});
