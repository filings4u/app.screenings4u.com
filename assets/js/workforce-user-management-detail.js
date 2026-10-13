/* NON-DOT membership and portal access management */
(()=>{'use strict';
const params=new URLSearchParams(location.search),userId=params.get('user_id'),orgId=params.get('organization_id');
const esc=v=>DOTShell.escape(String(v??''));
const host=()=>document.getElementById('dotPageMount');
const request=(action,extra={})=>WorkforceManagementApi.portalAccess(action,extra);
let membership,grants=[],portals=[];
function feedback(message,error=false){const n=document.getElementById('msg');n.hidden=false;n.className='nd-page-message '+(error?'error':'success');n.textContent=message;}
function grantFor(code){return grants.find(x=>x.user_id===userId&&x.organization_id===orgId&&x.portal_code===code)}
function renderRows(){
 const body=document.getElementById('portalRows');body.replaceChildren();
 for(const port of portals){
  const code=port.metadata?.access_code||port.portal_code;if(!code)continue;
  const g=grantFor(code),tr=document.createElement('tr');
  const info=document.createElement('td');const strong=document.createElement('strong');strong.textContent=port.name||code;
  const small=document.createElement('small');small.textContent=port.hostname||code;info.append(strong,small);
  const state=document.createElement('td');state.textContent=g?(g.enabled?'Granted':'Revoked'):'Not assigned';
  const levelTd=document.createElement('td'),level=document.createElement('select');level.setAttribute('aria-label','Access level for '+(port.name||code));
  for(const [value,label] of [['standard','Standard'],['manager','Manager'],['admin','Administrator'],['view','View only']]){const opt=document.createElement('option');opt.value=value;opt.textContent=label;level.append(opt)}
  level.value=g?.access_level||'standard';levelTd.append(level);
  const action=document.createElement('td'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=!!g?.enabled;toggle.setAttribute('aria-label','Enable '+(port.name||code));
  const save=document.createElement('button');save.type='button';save.className='nd-btn primary';save.textContent='Save Access';
  save.onclick=async()=>{save.disabled=true;save.textContent='Saving…';try{
   const changed=await request('set_user_access',{user_id:userId,organization_id:orgId,portal_code:code,enabled:toggle.checked,access_level:level.value});
   if(!changed.user_access)throw Error('No update returned by server');
   const latest=await request('list');const saved=(latest.user_access||[]).find(x=>x.user_id===userId&&x.organization_id===orgId&&x.portal_code===code);
   if(!saved||saved.enabled!==toggle.checked||saved.access_level!==level.value)throw Error('Update could not be verified. Reload before trying again.');
   grants=latest.user_access||[];renderRows();feedback((port.name||code)+' access saved and verified.');
  }catch(e){feedback(e.message||'Unable to save portal access.',true);save.disabled=false;save.textContent='Save Access';}};
  action.append(toggle,document.createTextNode(' Enable  '),save);tr.append(info,state,levelTd,action);body.append(tr);
 }
}
async function start(){
 if(!userId||!orgId)throw Error('Select a user and organization from User Access Management.');
 const d=await request('list');membership=(d.memberships||[]).find(x=>x.user_id===userId&&x.organization_id===orgId);
 if(!membership)throw Error('The requested membership was not found.');
 const u=(d.users||[]).find(x=>(x.user_id||x.id)===userId)||{},o=(d.organizations||[]).find(x=>x.id===orgId)||{};
 portals=(d.portals||[]).filter(x=>x.active!==false);grants=d.user_access||[];
 host().innerHTML=`<section class="nd-page"><div class="nd-page-head"><div><span class="nd-eyebrow">NON-DOT / ACCOUNTS & PEOPLE</span><h1>User Management</h1><p>${esc(u.display_name||u.email||userId)} · ${esc(o.legal_name||o.dba_name||orgId)}</p></div><div class="nd-actions"><a class="nd-btn" href="workforce-user-access.html">Back to User Access</a></div></div><div id="msg" class="nd-page-message" role="status" hidden></div><div class="nd-card"><div class="nd-card-head"><div><h2>Membership Management</h2><p>Update the user's organization membership.</p></div></div><div class="nd-card-body"><form id="membershipForm"><div class="nd-field-grid"><label>Status<select name="status"><option value="active">Active</option><option value="invited">Invited</option><option value="inactive">Inactive</option></select></label><label>Primary Membership<select name="is_primary"><option value="true">Yes</option><option value="false">No</option></select></label></div><div class="nd-form-actions"><button class="nd-btn primary" id="membershipSave" type="submit">Save Membership</button></div></form></div></div><div class="nd-card"><div class="nd-card-head"><div><h2>Portal Access Management</h2><p>Grant, revoke, or change permission levels directly for each NON-DOT portal.</p></div></div><div class="nd-table-wrap"><table class="nd-table"><thead><tr><th>Portal</th><th>Current Access</th><th>Permission Level</th><th>Manage Access</th></tr></thead><tbody id="portalRows"></tbody></table></div></div></section>`;
 const form=document.getElementById('membershipForm');form.elements.status.value=membership.status||'active';form.elements.is_primary.value=String(!!membership.is_primary);renderRows();
 form.onsubmit=async event=>{event.preventDefault();const button=document.getElementById('membershipSave');button.disabled=true;button.textContent='Saving…';try{
 const status=form.elements.status.value,is_primary=form.elements.is_primary.value==='true';
 const result=await request('set_membership_status',{membership_id:membership.id,status,is_primary});
 if(!result.membership)throw Error('Server did not confirm membership update.');
 const check=await request('list');const verified=(check.memberships||[]).find(x=>x.id===membership.id);
 if(!verified||verified.status!==status||!!verified.is_primary!==is_primary)throw Error('Membership update could not be verified.');
 membership=verified;feedback('Membership saved and verified.');
 }catch(e){feedback(e.message||'Unable to save membership.',true)}finally{button.disabled=false;button.textContent='Save Membership'}};
}
document.addEventListener('DOMContentLoaded',async()=>{try{const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);await start()}catch(e){if(host())host().textContent=e.message||String(e)}},{once:true});
})();