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
test('manual theme toggles on every visit and preserves original night default',async()=>{
  const script=await readFile(path.join(root,'theme.js'),'utf8');
  const saved=new Map();
  const storage={getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
  const first=loadTheme(script,storage);
  assert.equal(first.html.dataset.theme,'night');
  assert.equal(first.label.textContent,'Night Mode');
  first.click();
  assert.equal(first.html.dataset.theme,'day');
  assert.equal(first.attrs.get('aria-pressed'),'true');
  assert.equal(first.attrs.get('meta:content'),'#f5f8fa');
  assert.equal(saved.get('office-hq-theme-v1'),'day');
  const next=loadTheme(script,storage);
  assert.equal(next.html.dataset.theme,'day');
  next.click();
  assert.equal(next.html.dataset.theme,'night');
  assert.equal(saved.get('office-hq-theme-v1'),'night');
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
  const saved=new Map();
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
