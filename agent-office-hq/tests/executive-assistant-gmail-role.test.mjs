import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const [app,librarySource]=await Promise.all([
  readFile(join(root,'app.js'),'utf8'),
  readFile(join(root,'assignment-library.js'),'utf8')
]);
const context={window:{}};
vm.runInNewContext(librarySource,context,{filename:'assignment-library.js'});
const assignments=context.window.OfficeHQAssignmentLibrary;

test('Executive Assistant remains within Leadership and reports to Chief of Staff',()=>{
  const role=app.match(/\['exec_assistant','Executive Assistant','Leadership','Associate','chief_staff','executive_scheduling','([^']+)'\]/);
  assert.ok(role,'Preloaded Executive Assistant role must exist');
  for(const responsibility of ['Gmail','urgent','briefings','follow-ups','drafts','Chief of Staff','approval']){
    assert.match(role[1],new RegExp(responsibility,'i'));
  }
  assert.match(app,/function editableJobDescription\(e\)/,'Profile descriptions must remain owner-editable');
  assert.match(app,/name="jobDescription"/,'Owner can change the preloaded job description');
});

test('Executive Assistant offers email checking and reporting as their own editable sub-jobs',()=>{
  const role={key:'exec_assistant',title:'Executive Assistant',
    description:'Manage executive schedule and authorized Gmail email monitoring.'};
  const presets=assignments.library(role);
  assert.equal(presets.length,6);
  assert.deepEqual(Array.from(presets.slice(3),p=>p.title),[
    'Check authorized Gmail inbox and flag urgent messages',
    'Prepare daily CEO email briefing and follow-up list',
    'Draft email replies for CEO approval'
  ]);
  assert.equal(new Set(presets.map(p=>p.id)).size,6);
  for(const preset of presets.slice(3)){
    for(const key of ['Urgent','Important','Routine','Suspicious','Chief of Staff','Company Messages','Never send','Gmail is not connected']){
      assert.ok(preset.description.includes(key),'Missing safety/reporting term '+key);
    }
    assert.match(preset.description,/Acceptance criteria:/);
    assert.match(preset.description,/Stay within the Executive Assistant specialty/);
  }
});

test('Gmail Executive Assistant assignment options do not overwrite unrelated roles',()=>{
  const customer=assignments.library({key:'email_triage',title:'Email Priority Triage Specialist',description:'Customer email summary'});
  const chief=assignments.library({key:'chief_staff',title:'Chief of Staff',description:'Executive coordination'});
  assert.equal(customer.length,3);
  assert.equal(chief.length,3);
  assert.ok(customer.every(t=>!t.title.includes('CEO email briefing')));
  assert.ok(chief.every(t=>!t.title.includes('authorized Gmail inbox')));
});
