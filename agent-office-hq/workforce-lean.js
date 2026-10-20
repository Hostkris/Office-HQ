/* Office HQ lean workforce policy — 40 essential roles across twelve departments.
   Browser-only roster migration; no external agent/account action is performed. */
(function initializeLeanWorkforce(root){
'use strict';
const KEYS=[
 'ceo','chief_staff','exec_assistant',
 'project_mgr',
 'cfo','budget_officer','bookkeeper','ap','ar',
 'coo','inventory_mgr','purchaser','fulfillment','qa_manager',
 'cmo','content','social','ads','research','graphic_designer',
 'cro','sales_rep','account_mgr',
 'support_lead','support',
 'hr_dir','people_ops',
 'cto','integrator','security','backend_engineer','frontend_engineer',
 'counsel','privacy','contracts',
 'chief_audit','internal_auditor',
 'product_mgr','catalog','pricing_analyst'
];
const REPORTS_TO={
 project_mgr:'chief_staff',
 budget_officer:'cfo',bookkeeper:'cfo',ap:'cfo',ar:'cfo',
 inventory_mgr:'coo',purchaser:'coo',fulfillment:'coo',qa_manager:'coo',
 content:'cmo',social:'cmo',ads:'cmo',research:'cmo',graphic_designer:'cmo',
 sales_rep:'cro',account_mgr:'cro',support_lead:'cro',
 hr_dir:'ceo',people_ops:'hr_dir',
 integrator:'cto',security:'cto',backend_engineer:'cto',frontend_engineer:'cto',
 privacy:'counsel',contracts:'counsel',product_mgr:'coo'
};
const keyset=new Set(KEYS);
function selectRoles(catalog){
 const existing=new Map(catalog.map(r=>[r.key,r]));
 if(KEYS.some(k=>!existing.has(k)))throw Error('The approved compact workforce has missing role definitions.');
 const roles=KEYS.map(k=>{
  const item=existing.get(k);
  return {...item,reportsTo:Object.prototype.hasOwnProperty.call(REPORTS_TO,k)?REPORTS_TO[k]:item.reportsTo};
 });
 const keys=new Set(roles.map(r=>r.key)),scopes=new Set(roles.map(r=>r.scope));
 if(scopes.size!==roles.length)throw Error('Duplicate exclusive job scopes.');
 for(const r of roles){if(r.reportsTo&&!keys.has(r.reportsTo))throw Error('Missing reporting line: '+r.key);}
 return roles;
}
function consolidate(state,roles,catalog,seedEmployees){
 if(!state||!Array.isArray(state.companies)||!Array.isArray(state.employees))return {changed:false,removed:0,held:0};
 if(state.workforceRevision===2)return {changed:false,removed:0,held:0};
 const rosterKeys=new Set(roles.map(r=>r.key)),legacyRoles=new Map(catalog.map(r=>[r.key,r]));
 const original=state.employees.slice(),retained=[],retired=[],keptIds=new Set();
 const now=new Date().toISOString();
 for(const company of state.companies){
  const staff=original.filter(e=>e.companyId===company.id);
  const existing=new Map(),dup=[];
  for(const e of staff){
   if(rosterKeys.has(e.roleKey)&&!existing.has(e.roleKey))existing.set(e.roleKey,e);
   else dup.push(e);
  }
  const fresh=seedEmployees(company.id);
  for(const role of roles){
   const worker=existing.get(role.key)||fresh.find(e=>e.roleKey===role.key);
   if(!worker)throw Error('Unable to provision the essential role: '+role.key);
   retained.push(worker);keptIds.add(worker.id);
  }
  retired.push(...dup);
 }
 // Archive only once; never silently delete the worker's profile information.
 state.workforceArchive??=[];
 const known=new Set(state.workforceArchive.map(x=>x.id));
 for(const old of retired){
  if(!known.has(old.id)){state.workforceArchive.push({...old,retiredAt:now,retirementReason:'Lean 40-role workforce consolidation'});known.add(old.id);}
 }
 state.employees=retained;
 const byKey=new Map(retained.map(e=>[e.companyId+'::'+e.roleKey,e]));
 for(const e of retained){
  const role=roles.find(r=>r.key===e.roleKey);
  e.managerId=role.reportsTo?byKey.get(e.companyId+'::'+role.reportsTo)?.id||null:null;
 }
 const retiredIds=new Set(retired.map(e=>e.id)),retiredById=new Map(retired.map(e=>[e.id,e]));
 let held=0;
 for(const t of state.tasks||[]){
  const former=retiredById.get(t.ownerId);
  if(!former)continue;
  t.originalOwnerId??=former.id;
  t.originalOwnerName??=former.name;
  t.originalRoleKey??=former.roleKey;
  t.originalScope??=t.scope;
  t.ownerId=null;
  t.needsReassignment=true;
  t.reassignmentDepartment=legacyRoles.get(former.roleKey)?.dept||'';
  if(t.status!=='done'&&t.status!=='review'){
   t.preConsolidationStatus=t.status;
   t.status='blocked';
   held++;
  }
  t.updatedAt=now;
 }
 // Old RPG placements do not place retired workers back into the live office.
 const floor=state.enterprise?.projectFloor;
 if(floor){
  for(const f of floor.floors||[])f.placements=(f.placements||[]).filter(p=>keptIds.has(p.employeeId));
  for(const p of floor.projects||[])p.members=(p.members||[]).filter(id=>keptIds.has(id));
 }
 // Locally recorded account grants held by retired agents must not remain active.
 if(Array.isArray(state.enterprise?.grants)){
  state.workforceArchivedGrants??=[];
  state.enterprise.grants=state.enterprise.grants.filter(g=>{
   if(!retiredIds.has(g.employeeId))return true;
   state.workforceArchivedGrants.push({id:g.id,companyId:g.companyId,employeeId:g.employeeId,provider:g.provider,scope:g.scope,archivedAt:now,revokedByWorkforceConsolidation:true});
   return false;
  });
 }
 state.workforceRevision=2;
 state.workforceTransition={at:now,retired:retired.length,held,active:retained.length};
 return {changed:true,removed:retired.length,held};
}
root.OfficeHQLeanWorkforce=Object.freeze({KEYS:Object.freeze(KEYS),selectRoles,consolidate});
})(typeof window==='object'?window:globalThis);
