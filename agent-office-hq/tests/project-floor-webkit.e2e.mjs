// Real mobile WebKit UI integration test for the updated Live RPG office.
// Workers are visual representatives, not real third-party website automation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {webkit,devices} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {createServer} from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let browser,server,base;
async function port(){return await new Promise(ok=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});}
test.before(async()=>{
 base='http://127.0.0.1:'+await port();
 server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:base.split(':').at(-1),HOST:'127.0.0.1',OPENAI_API_KEY:''},stdio:'pipe'});
 let live=false;for(let n=0;n<65;n++){try{if((await fetch(base)).ok){live=true;break;}}catch{}await sleep(100);}
 assert.ok(live);
 browser=await webkit.launch({headless:true});
});
test.after(async()=>{await browser?.close();server?.kill('SIGTERM');await sleep(100);});
async function pageFor(device='iPhone 13'){
 const context=await browser.newContext({...devices[device]});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#/office',{waitUntil:'domcontentloaded'});
 await page.locator('h1').filter({hasText:'Project Floor'}).waitFor({timeout:15000});
 return {page,context,errors};
}
test('iPhone: empty live RPG office, touch janitor toggle and place only chosen worker',async()=>{
 const {page,context,errors}=await pageFor();
 try{
  assert.match(await page.locator('.pf-status').innerText(),/0 \/ 10/);
  assert.match(await page.locator('.pf-placed').innerText(),/Empty office/);
  const initialized=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.projectFloor);
  assert.equal(initialized.floors[0].placements.length,0);
  assert.equal(initialized.floors[0].janitor,false);
  await page.locator('#pfJanitor').check();
  assert.equal(await page.locator('#pfJanitor').isChecked(),true);
  await page.locator('#pfEmployee').selectOption({index:1});
  await page.locator('#pfSeat').selectOption('0');
  await page.locator('#pfPlaceForm [type=submit]').click();
  await page.locator('.pf-status').getByText('1 / 10').waitFor({timeout:7000});
  assert.equal(await page.locator('.pf-person').count()>0,true);
  const live=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.projectFloor.floors[0]);
  assert.equal(live.placements.length,1);
  assert.equal(live.janitor,true);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
test('iPad: project groups, 10 worker cap per level, independent empty second floor',async()=>{
 const {page,context,errors}=await pageFor('iPad Pro 11');
 page.on('dialog',async dialog=>{if(dialog.type()==='prompt')await dialog.accept('TikTok campaign');else await dialog.accept();});
 try{
  await page.locator('[data-pf="new-project"]').click();
  await page.locator('#pfProject option').filter({hasText:'TikTok campaign'}).waitFor({state:'attached'});
  assert.equal(await page.locator('#pfProject').inputValue(),await page.locator('#pfPlacementProject').inputValue());
  // Make the first floor maximally populated through explicit desk assignments.
  for(let i=0;i<10;i++){
   const worker=await page.locator('#pfEmployee option').evaluateAll(nodes=>nodes.find(x=>x.value)?.value);
   assert.ok(worker,'expected an available worker');
   await page.locator('#pfEmployee').selectOption(worker);
   await page.locator('#pfSeat').selectOption(String(i));
   await page.locator('#pfPlaceForm [type=submit]').click();
   await page.locator('.pf-status').getByText(String(i+1)+' / 10').waitFor({timeout:6000});
  }
  assert.equal(await page.locator('#pfPlaceForm [type=submit]').isDisabled(),true);
  const floor1=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.projectFloor.floors[0]);
  assert.equal(floor1.placements.length,10);
  assert.equal(new Set(floor1.placements.map(p=>p.employeeId)).size,10);
  await page.locator('[data-pf="new-floor"]').click();
  await page.locator('.pf-status').getByText('0 / 10').waitFor({timeout:7000});
  assert.equal(await page.locator('#pfProject').inputValue(),'all');
  const floors=await page.evaluate(()=>window.OfficeHQBridge.getState().enterprise.projectFloor.floors);
  assert.equal(floors.length,2);assert.equal(floors[0].placements.length,10);assert.equal(floors[1].placements.length,0);
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});
