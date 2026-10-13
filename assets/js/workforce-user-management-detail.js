/* NON-DOT membership and portal access management */
(()=>{'use strict';
const params=new URLSearchParams(location.search),userId=params.get('user_id'),orgId=params.get('organization_id');
const esc=v=>DOTShell.escape(String(v??''));
const host=()=>document.getElementById('dotPageMount');
const request=(action,extra={})=>WorkforceManagementApi.portalAccess(action,extra);
let grants=[],portals=[],organizationGrants=[],ctpaAccounts=[],employerAccounts=[];
function feedback(message,error=false){const n=document.getElementById('msg');n.hidden=false;n.className='nd-page-message '+(error?'error':'success');n.textContent=message;}
function grantFor(code){return grants.find(x=>String(x.user_id)===userId&&String(x.organization_id)===orgId&&String(x.portal_code)===String(code))}
function renderRows(){
 const body=document.getElementById('portalRows');body.replaceChildren();
 for(const port of portals){
  const code=port.metadata?.access_code||port.portal_code;if(!code)continue;
  const g=grantFor(code),orgGrant=organizationGrants.find(x=>x.organization_id===orgId&&x.portal_code===code),effective=g?g.enabled===true:orgGrant?.enabled===true,tr=document.createElement('tr');
  const info=document.createElement('td');const strong=document.createElement('strong');strong.textContent=port.name||code;
  const small=document.createElement('small');small.textContent=port.hostname||code;info.append(strong,small);
  const provisioned=code==='ctpa_workforce'?ctpaAccounts.some(x=>x.organization_id===orgId&&x.status==='active'):code==='employer_workforce'?employerAccounts.some(x=>x.organization_id===orgId&&x.status==='active'):true;
  const state=document.createElement('td');state.textContent=effective?(provisioned?(g?'Granted':'Granted via organization'):'Permission saved — account setup required'):(g?'Revoked':'Not assigned');
  const levelTd=document.createElement('td'),level=document.createElement('select');level.setAttribute('aria-label','Access level for '+(port.name||code));
  for(const [value,label] of [['standard','Standard'],['manager','Manager'],['admin','Administrator'],['view','View only']]){const opt=document.createElement('option');opt.value=value;opt.textContent=label;level.append(opt)}
  const storedLevel=String(g?.access_level??'standard');
  if(![...level.options].some(option=>option.value===storedLevel)){
    const existing=document.createElement('option');
    existing.value=storedLevel;existing.textContent='Current: '+(storedLevel||'Unspecified');
    level.prepend(existing);
  }
  level.value=storedLevel;levelTd.append(level);
  const action=document.createElement('td'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=effective;toggle.setAttribute('aria-label','Enable '+(port.name||code));
  const save=document.createElement('button');save.type='button';save.className='nd-btn primary';save.textContent='Save Access';
  const initialEnabled=effective;
  const initialLevel=storedLevel;
  const updateDirty=()=>{
    const dirty=toggle.checked!==initialEnabled||level.value!==initialLevel;
    save.textContent=dirty?'Save Changes':'Saved';
    save.disabled=!dirty;
    tr.classList.toggle('wa-unsaved',dirty);
    state.textContent=dirty?'Unsaved changes':initialEnabled?(provisioned?(g?'Granted':'Granted via organization'):'Permission saved — account setup required'):(g?'Revoked':'Not assigned');
  };
  toggle.addEventListener('change',updateDirty);
  level.addEventListener('change',updateDirty);
  save.onclick=async()=>{
    const enabled=toggle.checked,accessLevel=level.value;
    save.disabled=true;toggle.disabled=true;level.disabled=true;save.textContent='Saving…';
    try{
      await request('set_user_access',{user_id:userId,organization_id:orgId,portal_code:code,enabled,access_level:accessLevel});
      const latest=await request('list');
      const saved=(latest.user_access||[]).find(x=>String(x.user_id)===userId&&String(x.organization_id)===orgId&&String(x.portal_code)===String(code));
      if(!saved||Boolean(saved.enabled)!==enabled||String(saved.access_level??'standard')!==accessLevel)
        throw Error('The server did not confirm these permissions. Refresh and try again.');
      grants=latest.user_access||[];orgGrants=latest.organization_access||[];organizationGrants=latest.organization_access||[];ctpaAccounts=latest.ctpas||[];employerAccounts=latest.employers||[];
      renderRows();
      feedback((port.name||code)+' access saved and verified.');
    }catch(e){
      feedback((port.name||code)+': '+(e?.message||'Unable to save portal access.'),true);
      toggle.disabled=false;level.disabled=false;updateDirty();
    }
  };
  updateDirty();
  const toggleLabel=document.createElement('label');toggleLabel.className='wa-access-toggle';toggleLabel.append(toggle,document.createTextNode('Enable'));const controls=document.createElement('div');controls.className='wa-access-controls';controls.append(toggleLabel,save);action.append(controls);tr.append(info,state,levelTd,action);body.append(tr);
 }
}
async function start(){
 if(!userId||!orgId)throw Error('Select a user and organization from User Access Management.');
 const d=await request('list');const membership=(d.memberships||[]).find(x=>x.user_id===userId&&x.organization_id===orgId);
 if(!membership)throw Error('The requested membership was not found.');
 const u=(d.users||[]).find(x=>(x.user_id||x.id)===userId)||{},o=(d.organizations||[]).find(x=>x.id===orgId)||{};
 portals=(d.portals||[]).filter(x=>x.active!==false);grants=d.user_access||[];orgGrants=d.organization_access||[];ctpas=d.ctpas||[];employers=d.employers||[];subscriptions=d.subscriptions||[];organizationGrants=d.organization_access||[];ctpaAccounts=d.ctpas||[];employerAccounts=d.employers||[];
 host().innerHTML=`<section class="nd-page wa-user-detail"><header class="nd-page-head"><div><span class="nd-eyebrow">NON-DOT / ACCOUNTS & PEOPLE</span><h1>User Portal Access</h1><p>${esc(u.display_name||u.email||userId)} · ${esc(o.legal_name||o.dba_name||orgId)}</p></div><div class="nd-actions"><a class="nd-btn" href="workforce-user-access.html">Back to User Access</a></div></header><div id="msg" class="nd-page-message" role="status" hidden></div><section class="nd-card wa-portal-access"><div class="nd-card-head"><div><h2>Portal Access Management</h2><p>Grant, revoke, or change permission levels for this user's NON-DOT portals.</p></div></div><div class="nd-table-wrap"><table class="nd-table"><thead><tr><th scope="col">Portal</th><th scope="col">Current Access</th><th scope="col">Permission Level</th><th scope="col">Manage Access</th></tr></thead><tbody id="portalRows"></tbody></table></div></section></section>`;
 renderRows();
}
document.addEventListener('DOMContentLoaded',async()=>{try{const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);await start()}catch(e){if(host())host().textContent=e.message||String(e)}},{once:true});
})();