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
