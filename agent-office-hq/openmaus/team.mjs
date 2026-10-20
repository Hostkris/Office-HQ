import catalog from './essential-workforce.json' with {type:'json'};
// Generates one private, non-pruning OpenMausBot team file per Office HQ company.
// Each job title, scope and instruction is unique to its actual essential role.
export const roles=catalog.roles;
export const POLICY=catalog.policy;
export const roleFor=key=>roles.find(r=>r.key===key);
export const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/.test(v);
export const botName=(companyId,roleKey)=>'HQ_'+companyId+'_'+roleKey;
export function manifest(companyId){
 if(!safeId(companyId))throw Error('Invalid company identifier (40 characters max).');
 const group=dept=>'HQ_'+companyId+'_'+dept;
 const teams=catalog.departments.map(dept=>({name:group(dept),prune:false,
  brief:'Office HQ department: '+dept+'. Draft and analyze only, within a distinct job scope. The human CEO approves every external action. No third-party accounts, purchases, messages, publishing, financial movement or permissions are implicitly authorized.'}));
 const bots=roles.map(r=>({
  name:botName(companyId,r.key),team:group(r.department),
  title:r.title,description:r.description,
  approval:'ask',computer:'off',browser:false,
  // Supported engines are offered NO tools. Some agent CLIs preserve native tools:
  // users must inspect effective engine security and isolate those runtimes.
  tools:{allow:[]},
  soul:'You are the '+r.title+' (Office HQ role '+r.key+'). Your exclusive job scope is '+r.scope+
   '. Your manager role is '+(r.reportsTo||'the human CEO')+'. Responsibilities: '+r.description+
   '\nPrepare only drafts, analyses, plans, checklists or internal work products from information supplied in an authorized assignment. Never call a tool, access browser sessions, read unrelated local files, enter accounts, fetch private messages, publish, send email, buy, transfer money, or edit an external system. Never delegate to or impersonate another Office HQ employee. Do not fabricate a completion, citation, bank balance, shipment or social post. Mark unverified information clearly. All sensitive or external work goes back to the human CEO for explicit authorization.'
 }));
 return {version:1,teams,bots};
}
