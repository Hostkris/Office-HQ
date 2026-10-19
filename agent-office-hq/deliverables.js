/* Completed Work & Files: owner-reviewed local deliverables, never implied external work. */
(()=>{
 'use strict';
 const B=window.OfficeHQBridge;if(!B||!window.OfficeHQExtraViews)return;
 const E=B.E,$=q=>document.querySelector(q),S=()=>B.getState();
 let selectedId=null;
 const MAX_BYTES=1024*1024,MAX_TOTAL_CHARS=3900000;
 const ACCEPTED=new Set(['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/markdown']);
 const now=()=>new Date().toISOString();
 const records=()=>{const s=S();s.enterprise??={};s.enterprise.deliverables??=[];return s.enterprise.deliverables;};
 const taskFor=id=>S().tasks.find(t=>t.id===id);
 const company=()=>{const cid=$('#companyPicker')?.value;return cid&&cid!=='all'?cid:null;};
 const itemsFor=id=>records().filter(x=>x.taskId===id);
 function safeUrl(value){
  try{const u=new URL(String(value).trim());return u.protocol==='https:'&&!u.username&&!u.password&&u.href.length<=2048?u.href:null;}
  catch{return null;}
 }
 const safeFileName=name=>String(name||'work-product').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,90)||'work-product';
 const isImage=r=>r.type==='image'&&!!r.data;
 function preview(r){
  if(isImage(r))return '<button class="hq-attachment-image" type="button" data-files-action="preview" data-id="'+E(r.id)+'" aria-label="View '+E(r.name)+'"><img src="'+r.data+'" alt="'+E(r.name)+'" loading="lazy"></button>';
  if(r.type==='file'&&r.mime==='application/pdf')return '<div class="hq-attachment-placeholder">PDF document · Tap Preview to open</div>';
  if(r.type==='link')return '<p class="hq-attachment-url">'+E(r.url)+'</p>';
  return '<div class="hq-attachment-placeholder">Document attached</div>';
 }
 function card(r){
  return '<article class="hq-attachment-card">'+preview(r)+'<div class="hq-attachment-content"><strong>'+E(r.name)+'</strong>'+
   '<small>'+E(r.type==='link'?'External link saved (not a file copy)':r.mime||'Document')+' · '+E((r.createdAt||'').slice(0,10))+'</small>'+
   '<div class="inline-actions"><button class="btn btn-sm" data-files-action="preview" data-id="'+E(r.id)+'">View</button>'+
   (r.data?'<button class="btn btn-sm" data-files-action="download" data-id="'+E(r.id)+'">↓ Save file</button>':'<a class="btn btn-sm" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" href="'+E(r.url)+'">Open link ↗</a>')+
   '<button class="btn btn-sm" data-files-action="remove" data-id="'+E(r.id)+'" aria-label="Remove '+E(r.name)+'">Remove</button></div></div></article>';
 }
 function renderTask(t){
  const e=S().employees.find(x=>x.id===t.ownerId),files=itemsFor(t.id);
  const a=S().approvals.find(x=>x.id===t.approvalId&&x.kind==='task');
  const reviewStatus=a?.status==='approved'?'Approved':a?.status==='rejected'?'Declined':a?.status==='pending'?'Awaiting your approval':
    t.status==='done'?'Completed · no pending approval':'Not yet approved';
  const canReview=t.status!=='done'&&a?.status!=='approved';
  return '<section class="card hq-deliverable-detail" id="hqDeliverableDetail"><div class="section-top"><h2>'+E(t.title)+'</h2><span class="pill-stat">'+E(reviewStatus)+'</span></div>'+
   '<p class="muted small">'+E(e?.name||'Unassigned')+' · '+E(t.status.replaceAll('_',' '))+' · '+E(t.companyId||'')+'</p>'+
   '<div class="hq-deliverable-preview"><h3>Work product</h3>'+(t.output?'<pre class="hq-deliverable-text">'+E(t.output)+'</pre>':
   '<p class="muted">No text output has been saved for this assignment yet. You can still attach the actual file or link for review.</p>')+'</div>'+
   '<div class="section-top"><h3>Attached pictures, documents & links</h3><span>'+files.length+' items</span></div>'+
   (files.length?'<div class="hq-attachments">'+files.map(card).join('')+'</div>':
   '<p class="muted small">No finished files have been attached. Image and music services need a real connection before they can supply media automatically.</p>')+
   '<details class="hq-disclosure" id="hqAddDeliverable"><summary>＋ Add completed file or external link</summary>'+
   '<div class="hq-file-add-grid"><form id="hqUploadDeliverable"><label>Attach an actual finished file (1 MB maximum)<input type="file" name="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,.md" required></label><button class="btn btn-primary" type="submit">Save attachment locally</button></form>'+
   '<form id="hqLinkDeliverable"><label>Finished work link<input name="url" type="url" placeholder="https://..." required maxlength="2048"></label>'+
   '<label>Label<input name="name" required maxlength="110" placeholder="Artwork, research, song preview…"></label>'+
   '<button class="btn" type="submit">Add review link</button></form></div>'+
   '<p class="tiny muted">Only the link is saved for online content; the external file is not copied. Local attachments use this browser’s limited storage. Export backups in Settings.</p></details>'+
   '<div class="hq-review-actions"><button class="btn" data-files-action="text" data-task="'+E(t.id)+'"'+(!t.output?' disabled':'')+'>↓ Save text</button>'+
   '<button class="btn" data-files-action="pdf" data-task="'+E(t.id)+'">Print / Save as PDF</button>'+
   (canReview?'<button class="btn btn-primary" data-files-action="approve" data-task="'+E(t.id)+'">✓ Approve work</button>'+
   '<button class="btn btn-danger" data-files-action="decline" data-task="'+E(t.id)+'">✕ Decline work</button>':'')+'</div>'+
   '<p class="tiny muted">Approval records your decision and completes this task locally. It does not publish content, charge funds, or prove a connected AI generated any file.</p></section>';
 }
 function render(){
  const all=S().tasks.filter(t=>(!company()||t.companyId===company())&&(t.output||t.approvalId||itemsFor(t.id).length||['review','done'].includes(t.status)));
  const selected=all.find(t=>t.id===selectedId)||taskFor(selectedId);
  const scoped=selected&&(!company()||selected.companyId===company())?selected:null;
  return '<div class="page-head"><div><div class="eyebrow">OWNER REVIEW & DOCUMENTATION</div><h1>Completed Work & Files</h1>'+
  '<p class="subtitle">Preview finished work, view source links, approve or decline, and save original files or a PDF copy.</p></div>'+
  '<div class="head-actions"><button class="btn" data-view="approvals">Open approval inbox →</button></div></div>'+
  '<div class="hq-file-layout"><section class="card"><div class="section-top"><h2>Work library</h2><span class="pill-stat">'+all.length+' items</span></div>'+
  '<p class="muted small">Assignments appear here when they have output, an approval request, or an attachment.</p>'+
  (all.length?'<div class="hq-file-list">'+all.map(t=>{
   const a=S().approvals.find(x=>x.id===t.approvalId);
   return '<button class="hq-file-entry'+(scoped?.id===t.id?' is-active':'')+'" type="button" data-files-action="select" data-task="'+E(t.id)+'"><strong>'+E(t.title)+'</strong>'+
    '<small>'+E(t.status==='done'?'Completed':a?.status==='pending'?'Needs approval':t.status==='review'?'Ready for review':t.status.replaceAll('_',' '))+
    ' · '+itemsFor(t.id).length+' files/links</small></button>';
  }).join('')+'</div>':'<p class="muted">No completed work yet. Open a task or add a finished file to begin.</p>')+
  '</section>'+(scoped?renderTask(scoped):'<section class="card"><h2>Select work to review</h2><p class="muted">When a worker delivers text, an image, a document, or a review link, open it here and save your decision.</p><button class="btn" data-view="tasks">Open assignments →</button></section>')+'</div>';
 }
 function openTask(id){selectedId=id;B.setView('files');}
 function notify(message,bad=false){B.toast(message,bad?'error':'ok');}
 function approvalFor(t){
  let a=S().approvals.find(x=>x.id===t.approvalId&&x.kind==='task');
  if(a&&a.status!=='pending')return a;
  if(!a){
   a={id:B.uid('approve'),companyId:t.companyId,kind:'task',taskId:t.id,title:'Review finished work: '+t.title,
    note:'Inspect the attached work product or source link before deciding.',status:'pending',createdAt:now()};
   S().approvals.unshift(a);t.approvalId=a.id;
  }
  t.requiresApproval=true;t.status='review';t.updatedAt=now();B.save();
  return a;
 }
 function decide(taskId,approved){
  const t=taskFor(taskId);
  if(!t||t.status==='done'){notify('This assignment is already completed and cannot be decided again.',true);return;}
  if(!t.output&&!itemsFor(t.id).length){notify('Attach a file/link or save real text output before approving or declining.',true);return;}
  const a=approvalFor(t);
  if(a.status!=='pending'){notify('This review was already decided.',true);return;}
  B.decideApproval(a.id,approved?'approved':'rejected');
  selectedId=t.id;B.setView('files');
  notify(approved?'Work approved and recorded.':'Work declined and returned as blocked.');
 }
 function saveBlob(name,data,mime){
  const url=URL.createObjectURL(new Blob([data],{type:mime||'text/plain'}));
  const a=document.createElement('a');a.href=url;a.download=safeFileName(name);document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
 }
 function saveAttachment(r){
  if(!r?.data)return;
  const a=document.createElement('a');a.href=r.data;a.download=safeFileName(r.name);document.body.appendChild(a);a.click();a.remove();
 }
 function printTask(t){
  const list=itemsFor(t.id),sheet=document.createElement('section');sheet.className='hq-print-sheet';
  sheet.innerHTML='<h1>'+E(t.title)+'</h1><p>Office HQ · Work review · '+E(now().slice(0,10))+'</p>'+
   '<pre>'+E(t.output||'No saved text output')+'</pre>'+
   '<h2>Attached records</h2>'+list.map(r=>'<p>'+E(r.name)+(r.url?' · '+E(r.url):' · original file attached in local workspace')+'</p>'+
   (isImage(r)?'<img src="'+r.data+'" alt="'+E(r.name)+'">':'')).join('')+
   '<p>Approval: '+E(S().approvals.find(a=>a.id===t.approvalId)?.status||'Not yet approved')+'</p>';
  document.body.appendChild(sheet);
  const cleanup=()=>sheet.remove();
  window.addEventListener('afterprint',cleanup,{once:true});
  window.print();
  setTimeout(cleanup,12000);
 }
 function viewAttachment(r){
  if(!r)return;
  const url=r.type==='link'?safeUrl(r.url):r.data;
  if(!url){notify('This file has no valid review link.',true);return;}
  if(r.type==='image'){
   const area=document.createElement('div');area.className='hq-image-modal';
   area.innerHTML='<button type="button" class="btn hq-image-close" aria-label="Close image preview">✕ Close</button><img alt="'+E(r.name)+'" src="'+url+'"><button class="btn btn-primary" type="button" data-files-action="download" data-id="'+E(r.id)+'">↓ Save image</button>';
   area.querySelector('.hq-image-close').addEventListener('click',()=>area.remove());
   area.addEventListener('click',ev=>{if(ev.target===area)area.remove()});
   document.body.appendChild(area);return;
  }
  if(r.type==='link'||r.mime==='application/pdf'||r.type==='file'){
   const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';document.body.appendChild(a);a.click();a.remove();
  }
 }
 document.addEventListener('click',ev=>{
  const btn=ev.target.closest('[data-files-action]');if(!btn)return;
  const op=btn.dataset.filesAction,id=btn.dataset.id,t=taskFor(btn.dataset.task),r=records().find(x=>x.id===id);
  if(op==='select'){selectedId=btn.dataset.task;B.setView('files');return;}
  if(op==='preview'){viewAttachment(r);return;}
  if(op==='download'){saveAttachment(r);return;}
  if(op==='text'&&t){saveBlob(t.title+'.txt',t.output||'','text/plain;charset=utf-8');return;}
  if(op==='pdf'&&t){printTask(t);return;}
  if(op==='approve'&&t){decide(t.id,true);return;}
  if(op==='decline'&&t){decide(t.id,false);return;}
  if(op==='remove'&&r){
   if(!confirm('Remove this local file or link? The original assignment and approval will remain.'))return;
   S().enterprise.deliverables=records().filter(x=>x.id!==id);B.save();B.setView('files');notify('Attachment removed.');return;
  }
 });
 document.addEventListener('submit',async ev=>{
  if(!['hqUploadDeliverable','hqLinkDeliverable'].includes(ev.target.id))return;
  ev.preventDefault();const t=taskFor(selectedId);if(!t)return;
  if(ev.target.id==='hqLinkDeliverable'){
   const fields=new FormData(ev.target),url=safeUrl(fields.get('url')),name=String(fields.get('name')||'').trim().slice(0,110);
   if(!url||!name){notify('Enter a valid HTTPS link and descriptive label.',true);return;}
   records().push({id:B.uid('deliverable'),companyId:t.companyId,taskId:t.id,type:'link',name,url,createdAt:now()});
  }else{
   const file=ev.target.querySelector('input[type=file]')?.files?.[0];
   if(!file||!ACCEPTED.has(file.type)||file.size>MAX_BYTES){notify('Choose a supported image, PDF or text file up to 1 MB.',true);return;}
   const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(Error('Could not read file'));reader.readAsDataURL(file);}).catch(()=>null);
   if(!data||!data.startsWith('data:')){notify('Could not read this local file.',true);return;}
   if(JSON.stringify(records()).length+data.length>MAX_TOTAL_CHARS){notify('Local file space is full. Save files to your phone and remove older copies.',true);return;}
   records().push({id:B.uid('deliverable'),companyId:t.companyId,taskId:t.id,type:file.type.startsWith('image/')?'image':'file',
    mime:file.type,name:safeFileName(file.name),data,createdAt:now()});
  }
  B.save();B.setView('files');notify('Finished work saved to this device for review.');
 });
 window.OfficeHQExtraViews.files=render;
 window.OfficeHQDeliverables={render,openTask,safeUrl,records};
 if(location.hash.replace('#/','')==='files')B.setView('files');
})();
