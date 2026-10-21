/* Unified NON-DOT subscription and portal access administration. Requires staff session and explicit confirmation. */
(()=>{'use strict';
const mode=location.pathname.includes('subscription')?'subscriptions':'access';
const root=()=>document.getElementById('dotPageMount');
const config=()=>window.DOT_PORTAL_CONFIG;
async function request(fn,body){const {data,error}=await dotSupabase.auth.getSession();if(error||!data?.session?.access_token)throw Error('Staff session required.');const res=await fetch(config().supabaseUrl+'/functions/v1/'+fn,{method:'POST',headers:{'Content-Type':'application/json',apikey:config().supabaseAnonKey,Authorization:'Bearer '+data.session.access_token},body:JSON.stringify(body)});const result=await res.json().catch(()=>({}));if(!res.ok||result.error)throw Error(result.error||'Request failed ('+res.status+').');return result}
function el(tag,props={},children=[]){const x=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='text')x.textContent=v;else if(k==='className')x.className=v;else x.setAttribute(k,String(v))}for(const child of children)x.append(child);return x}
function line(text){return el('p',{text})}
function button(label,fn){const b=el('button',{type:'button',text:label});b.style.cssText='padding:9px 14px;border:1px solid #315b9d;border-radius:8px;background:#24467f;color:white;cursor:pointer';b.onclick=fn;return b}
function setup(title,description){const node=el('section');node.style.cssText='padding:28px;max-width:1250px';node.append(el('a',{href:'workforce-dashboard.html',text:'← NON-DOT Overview'}),el('h1',{text:title}),line(description));root().replaceChildren(node);return node}
function errorBox(node){const box=el('p',{role:'status'});box.style.cssText='color:#9a2525;font-weight:600';node.append(box);return box}
function select(options,value){const s=el('select');s.style.cssText='padding:9px;border:1px solid #dbe4ef;border-radius:8px';for(const [code,label] of options){const opt=el('option',{value:code,text:label});if(code===value)opt.selected=true;s.append(opt)}return s}
async function subscriptions(){
 const panel=setup('NON-DOT Subscriptions','Review subscription status. Status updates affect customer access and require confirmation.');const msg=errorBox(panel);const result=await request('nondot-management-read',{action:'billing'});const rows=result.subscriptions||[];
 const list=el('div');list.style.cssText='display:grid;gap:12px';panel.append(line(rows.length+' subscriptions'),list);
 for(const r of rows){const card=el('div',{className:'dot-card'});card.style.cssText='padding:18px;display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap';const info=el('div');info.append(el('strong',{text:'Subscription '+r.id}),line('Status: '+(r.status||'Unknown')+' | Customer: '+(r.employer_id||r.ctpa_id||'Unknown')));const control=el('div');control.style.cssText='display:flex;gap:8px;align-items:center';const options=[...new Set([r.status,'active','paused','cancelled'].filter(Boolean))].map(x=>[x,x]);const s=select(options,r.status);const save=button('Update status',async()=>{if(s.value===r.status)return;if(!await window.DOTDialog.confirm('Change NON-DOT subscription '+r.id+' from '+r.status+' to '+s.value+'? This can change customer access.',{title:'Update Subscription',confirmText:'Update'}))return;save.disabled=true;msg.textContent='Saving status…';try{await request('nondot-management-actions',{action:'update_subscription',subscription_id:r.id,status:s.value});msg.textContent='Status saved. Refresh the page to review the latest records.';info.querySelector('p').textContent='Status: '+s.value+' | Customer: '+(r.employer_id||r.ctpa_id||'Unknown')}catch(e){msg.textContent=e.message}finally{save.disabled=false}});control.append(s,save);card.append(info,control);list.append(card)}
}
async function portalAccess(){
 const panel=setup('NON-DOT Organization Access','Grant, review, and revoke organization access to NON-DOT customer portals. Changes require confirmation.');
 panel.className='dot-page wf-access-page';
 const msg=errorBox(panel);msg.className='wf-access-message';msg.setAttribute('aria-live','polite');
 const result=await request('nondot-portal-control',{action:'list'});
 const portals=result.portals||[],organizations=result.organizations||[],grants=[...(result.organization_access||[])];
 if(result.warnings?.length)msg.textContent='Some data sources returned warnings: '+result.warnings.map(x=>x.section).join(', ');
 const portalCode=x=>x.metadata?.access_code||x.portal_code||'';
 const portalName=code=>portals.find(x=>portalCode(x)===code)?.name||code;
 const organizationName=id=>{const x=organizations.find(o=>o.id===id);return x?.legal_name||x?.dba_name||id||'Unknown organization'};
 const header=el('div',{className:'wf-access-header'});
 header.append(el('div',{className:'wf-access-intro'},[el('span',{className:'wf-access-eyebrow',text:'NON-DOT / ACCESS MANAGEMENT'}),el('h2',{text:'Organization Portal Permissions'}),line('Select an organization and portal to grant or revoke access, then review existing permissions below.')]));
 const shortcuts=el('div',{className:'wf-access-shortcuts'},[el('a',{href:'workforce-portal-control.html',className:'wf-btn secondary',text:'Portal Network'}),el('a',{href:'workforce-user-access.html',className:'wf-btn secondary',text:'User Access'})]);header.append(shortcuts);panel.append(header);
 const stats=el('div',{className:'wf-access-stats'});panel.append(stats);
 const form=el('section',{className:'dot-card wf-access-editor'});
 form.append(el('div',{className:'wf-access-section-head'},[el('h3',{text:'Manage Organization Access'}),line('Permissions apply only to the selected organization and portal.')]));
 const fields=el('div',{className:'wf-access-fields'});
 const orgBox=select(organizations.map(x=>[x.id,x.legal_name||x.dba_name||x.id]),organizations[0]?.id);
 const portalBox=select(portals.map(x=>[portalCode(x),x.name+' ('+(x.hostname||'No hostname')+')']),portalCode(portals[0]||{}));
 const wrapField=(title,input)=>el('label',{className:'wf-access-field'},[el('span',{text:title}),input]);
 fields.append(wrapField('Organization',orgBox),wrapField('NON-DOT portal',portalBox));form.append(fields);
 const selectedStatus=el('div',{className:'wf-access-selection-status',role:'status'}),enabled=el('input',{type:'checkbox'}),toggle=el('label',{className:'wf-access-toggle'},[enabled,el('span',{text:'Allow this organization to access the selected portal'})]);
 const save=el('button',{type:'button',className:'wf-btn',text:'Save Access Changes'});
 const controls=el('div',{className:'wf-access-editor-footer'},[toggle,save]);
 form.append(selectedStatus,controls);panel.append(form);
 const directory=el('section',{className:'dot-card wf-access-directory'});
 directory.append(el('div',{className:'wf-access-section-head'},[el('h3',{text:'Organization Access Directory'}),line('Review all recorded portal grants and manage their status.')]));
 const toolbar=el('div',{className:'wf-access-directory-toolbar'});
 const search=el('input',{type:'search',placeholder:'Search organizations or portals','aria-label':'Search access records'});
 const filter=select([['all','All statuses'],['enabled','Granted'],['disabled','Revoked']],'all');
 toolbar.append(search,filter);directory.append(toolbar);
 const tableWrap=el('div',{className:'wf-table-scroll'}),count=el('p',{className:'wf-access-count',role:'status'});
 directory.append(tableWrap,count);panel.append(directory);
 function statsRender(){const total=grants.length,active=grants.filter(x=>x.enabled===true).length;stats.replaceChildren(...[['Organizations',organizations.length],['NON-DOT Portals',portals.length],['Granted Access',active],['Recorded Grants',total]].map(([title,n])=>el('article',{className:'wf-access-stat'},[el('span',{text:title}),el('strong',{text:String(n)})])))}
 function selectedGrant(){return grants.find(x=>x.organization_id===orgBox.value&&x.portal_code===portalBox.value)}
 function refresh(){const row=selectedGrant();enabled.checked=!!row?.enabled;selectedStatus.textContent=row?'Current permission: '+(row.enabled?'Granted':'Revoked'):'Current permission: No grant recorded';save.disabled=!orgBox.value||!portalBox.value}
 function directoryRender(){
  const q=search.value.trim().toLowerCase(),mode=filter.value;
  const rows=grants.filter(x=>(mode==='all'||(mode==='enabled'?x.enabled===true:x.enabled!==true))&&(organizationName(x.organization_id)+' '+portalName(x.portal_code)).toLowerCase().includes(q));
  const table=el('table',{className:'wf-table'}),thead=el('thead'),tr=el('tr');
  for(const h of ['Organization','Portal','Access Status','Actions'])tr.append(el('th',{text:h}));thead.append(tr);table.append(thead);
  const tbody=el('tbody');
  for(const x of rows){
   const row=el('tr'),name=organizationName(x.organization_id),portal=portalName(x.portal_code);
   const status=el('span',{className:'wf-access-pill '+(x.enabled?'granted':'revoked'),text:x.enabled?'Granted':'Revoked'});
   const edit=el('button',{type:'button',className:'wf-btn secondary',text:'Manage'});
   edit.addEventListener('click',()=>{orgBox.value=x.organization_id;portalBox.value=x.portal_code;refresh();form.scrollIntoView({behavior:'smooth',block:'start'})});
   row.append(el('td',{},[el('strong',{text:name})]),el('td',{},[el('strong',{text:portal}),el('small',{text:portals.find(p=>portalCode(p)===x.portal_code)?.hostname||''})]),el('td',{},[status]),el('td',{},[edit]));tbody.append(row)
  }
  if(!rows.length){const tr=el('tr'),td=el('td',{colspan:'4',className:'wf-access-empty',text:grants.length?'No grants match your filters.':'No organization portal grants have been recorded.'});tr.append(td);tbody.append(tr)}
  table.append(tbody);tableWrap.replaceChildren(table);count.textContent=rows.length+' of '+grants.length+' recorded grants'
 }
 orgBox.onchange=refresh;portalBox.onchange=refresh;search.oninput=directoryRender;filter.onchange=directoryRender;
 save.onclick=async()=>{const org=organizations.find(x=>x.id===orgBox.value),portal=portals.find(x=>portalCode(x)===portalBox.value),yes=enabled.checked;
  if(!org||!portal)return;
  if(!await window.DOTDialog.confirm((yes?'GRANT':'REVOKE')+' access to '+portal.name+' for '+organizationName(org.id)+'?',{title:'Change Portal Access',confirmText:'Confirm'})){refresh();return}
  save.disabled=true;msg.textContent='Saving authorization…';
  try{const response=await request('nondot-portal-control',{action:'set_org_access',organization_id:org.id,portal_code:portalCode(portal),enabled:yes});
   const idx=grants.findIndex(x=>x.organization_id===org.id&&x.portal_code===portalCode(portal));
   const record=response.access||{organization_id:org.id,portal_code:portalCode(portal),enabled:yes};
   if(idx>=0)grants[idx]=record;else grants.push(record);
   msg.textContent='Organization portal access updated successfully.';refresh();statsRender();directoryRender()
  }catch(e){msg.textContent=e.message||String(e);refresh()}finally{save.disabled=false}
 };
 statsRender();refresh();directoryRender();
}
async function init(){const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);try{await(mode==='subscriptions'?subscriptions():portalAccess())}catch(e){const panel=setup('NON-DOT Management Unavailable','The requested module could not be loaded.');errorBox(panel).textContent=e.message||String(e)}}
addEventListener('DOMContentLoaded',()=>init(),{once:true});
})();