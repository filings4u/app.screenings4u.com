/* Workforce | screenings4u Management Portal — standalone navigation shell */
(()=>{
"use strict";
const page=location.pathname.split('/').pop()||'workforce-management.html';
const sharedPages=new Set(['workforce-management.html','global-customer-360.html','global-work-orders.html','task-manager.html','task-automations.html','results-management.html','dot-invoices.html','dot-invoice-detail.html','dot-invoice-new.html','dot-recent-subscriptions.html','subscription-management.html']);
const requestedWorkspace=new URLSearchParams(location.search).get('workspace');
const activeWorkspace=requestedWorkspace==='workforce'||requestedWorkspace==='nondot'?'nondot':requestedWorkspace==='dot'?'dot':page.startsWith('workforce-')?'nondot':'dot';
const business=activeWorkspace;
const workspaceHome='workforce-management.html?workspace='+ (business==='nondot'?'workforce':'dot');
const routes=[
 ['Overview','workforce-management.html','workforce-management.html','⌂'],
 ['Customer 360','global-customer-360.html','global-customer-360.html','◎'],
 ['C/TPA Management','dot-ctpas.html','workforce-ctpas.html','◈'],
 ['Employer Management','dot-employers.html','workforce-employers.html','▣'],
 ['People & Drivers','dot-drivers.html','workforce-people.html','◉'],
 ['Portal Access','dot-users-access.html','workforce-user-access.html','♙'],
 ['Program Management','dot-programs.html','workforce-programs.html','≡'],
 ['Pools & Consortiums','dot-pools.html','workforce-pools.html','⊙'],
 ['Random Selections','dot-random-selections.html','workforce-selections.html','⌁'],
 ['Testing Orders','dot-testing-orders.html','workforce-testing.html','✚'],
 ['Results Management','results-management.html','results-management.html','✓'],
 ['Compliance Management','dot-compliance.html','workforce-compliance.html','⚑'],
 ['Documents','dot-documents.html','workforce-documents.html','▱'],
 ['Invoices','dot-invoices.html','dot-invoices.html','▧'],
 ['Subscriptions','subscription-management.html','subscription-management.html','▧'],
 ['Subscription History','dot-recent-subscriptions.html','workforce-subscriptions.html','◷'],
 ['Service Orders','dot-orders.html','workforce-services.html','▤'],
 ['Reports & Audit','dot-audit.html','workforce-reports.html','☷'],
 ['Website','dot-website.html','workforce-website.html','◫'],
 ['Notifications','dot-notifications.html','workforce-notifications.html','●'],
 ['Integrations','dot-integrations.html','workforce-integrations.html','⌘'],
 ['Support','dot-support.html','workforce-support.html','?'],
 ['Settings','dot-settings.html','workforce-settings.html','⚙'],
 ['Staff','dot-users-access.html','workforce-staff.html','♙'],
 ['Work Orders','global-work-orders.html','global-work-orders.html','▤'],
 ['Task Manager','task-manager.html','task-manager.html','✓'],
 ['Task Automations','task-automations.html','task-automations.html','◷']
];
const dotOnly=[['Owner-Operators','dot-owner-operators.html','◇'],['Clearinghouse','dot-clearinghouse.html','⇄'],['Return-to-Duty / SAP','dot-return-to-duty.html','↺'],['Follow-Up Testing','dot-follow-up-testing.html','⟳'],['DOT Agencies','dot-agencies.html','✦'],['DOT Plans & Pricing','dot-catalog.html','$']];
const workspaceHref=href=>sharedPages.has(href)?href+(href.includes('?')?'&':'?')+'workspace='+(business==='nondot'?'workforce':'dot'):href;
const prefetchActions={
 'dot-dashboard.html':'overview','dot-ctpas.html':'ctpas','dot-employers.html':'employers','dot-owner-operators.html':'owner_operators','dot-drivers.html':'drivers','dot-users-access.html':'portal_access','dot-programs.html':'programs','dot-pools.html':'pools','dot-random-selections.html':'selections','dot-testing-orders.html':'testing','dot-results.html':'results','dot-compliance.html':'compliance','dot-clearinghouse.html':'clearinghouse','dot-return-to-duty.html':'rtd','dot-follow-up-testing.html':'follow_up_testing','dot-catalog.html':'services','dot-orders.html':'orders','dot-recent-orders.html':'orders','dot-recent-subscriptions.html':'billing','dot-training.html':'training','dot-integrations.html':'integrations','dot-settings.html':'reports','dot-audit.html':'audit_history'
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function initials(v){return String(v||'DOT').split(/\s+|@/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'DOT'}
function nav(){
 const html=routes.map(([label,dot,non,icon])=>{const href=business==='nondot'?non:dot;const url=workspaceHref(href);return `<a href="${url}" class="${page===href?'active':''}"><i class="dot-nav-icon">${icon}</i><b>${esc(label)}</b></a>`}).join('');
 const extra=business==='dot'?'<div class="dot-nav-group"><span>DOT-SPECIFIC TASKS</span>'+dotOnly.map(([label,href,icon])=>`<a href="${href}" class="${page===href?'active':''}"><i class="dot-nav-icon">${icon}</i><b>${esc(label)}</b></a>`).join('')+'</div>':'';
 return '<div class="dot-nav-group"><span>WORKFORCE MANAGEMENT</span>'+html+'</div>'+extra;
}
function render(state){const p=state?.profile||{},u=state?.user||{},name=p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||u.user_metadata?.full_name||u.email||'DOT Administrator',role=(state?.roles||[])[0]||'staff';document.body.classList.add('dot-shell-ready');const existing=document.querySelector('.dot-app');if(existing){const now=location.pathname.split('/').pop()||'dot-dashboard.html';document.querySelectorAll('.dot-nav a').forEach(a=>a.classList.toggle('active',(a.getAttribute('href')||'').split('?')[0]===now));return existing}document.body.innerHTML=`<div class="dot-app"><aside class="dot-sidebar"><div class="dot-brand"><a href="${workspaceHome}" aria-label="Workforce | screenings4u Management"><img class="dot-brand-logo" src="images/logo2.png" alt="Workforce | screenings4u"></a></div><div class="dot-business-switcher" style="padding:12px;border-bottom:1px solid #e0e6ef"><label for="dotBusinessSelect" style="display:block;font-size:11px;font-weight:700;margin-bottom:7px;color:#667085">BUSINESS WORKSPACE</label><select id="dotBusinessSelect" aria-label="Choose business" style="width:100%;padding:10px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;color:#24467f;font:inherit"><option value="dot" ${business==='dot'?'selected':''}>DOT</option><option value="nondot" ${business==='nondot'?'selected':''}>NON-DOT</option></select></div><nav class="dot-nav" aria-label="Selected business management">${nav()}</nav></aside><div class="dot-main"><header class="dot-topbar"><div class="dot-topbar-left"><button class="dot-menu-button" id="dotMenu" aria-label="Open navigation">☰</button><button class="dot-sidebar-toggle" id="dotSidebarToggle" aria-label="Hide sidebar" title="Hide sidebar">◀</button><div class="dot-topbar-title"><strong>Workforce Management — ${business==='nondot'?'NON-DOT':'DOT'}</strong></div></div><div class="dot-topbar-actions"><a class="dot-icon-button" href="${business==='nondot'?'workforce-notifications.html':'dot-notifications.html'}" title="Notifications">●</a><a class="dot-icon-button" href="${business==='nondot'?'workforce-support.html':'dot-support.html'}" title="Support">?</a><div class="wf-account"><button type="button" class="dot-user-button wf-account-trigger" id="dotUser" aria-haspopup="true" aria-expanded="false" aria-controls="wfAccountMenu"><span class="dot-avatar">${esc(initials(name))}</span><span class="dot-user-copy"><strong>${esc(name)}</strong><small>${esc(role)}</small></span><span class="wf-chevron" aria-hidden="true">▾</span></button><div id="wfAccountMenu" class="wf-account-menu" hidden role="menu"><div class="wf-account-heading"><strong>${esc(name)}</strong><span>${esc(role)}</span></div><a role="menuitem" href="workforce-management.html">Workforce Home</a><a role="menuitem" href="${business==='nondot'?'workforce-settings.html':'dot-settings.html'}">Settings</a><a role="menuitem" href="${business==='nondot'?'workforce-notifications.html':'dot-notifications.html'}">Notifications</a><div class="wf-account-separator"></div><button role="menuitem" type="button" id="wfSignOut">Sign Out</button></div></div></div></header><main id="dotPageMount"></main></div></div><div class="dot-overlay" id="dotOverlay"></div>`;document.getElementById('dotBusinessSelect')?.addEventListener('change',e=>{const target=e.target.value==='nondot'?'workforce':'dot';location.assign('workforce-management.html?workspace='+target)});const accountButton=document.getElementById('dotUser'),accountMenu=document.getElementById('wfAccountMenu');const closeAccount=()=>{if(!accountMenu)return;accountMenu.hidden=true;accountButton?.setAttribute('aria-expanded','false')};accountButton?.addEventListener('click',e=>{e.stopPropagation();const opening=accountMenu.hidden;accountMenu.hidden=!opening;accountButton.setAttribute('aria-expanded',String(opening))});document.addEventListener('click',e=>{if(!e.target.closest('.wf-account'))closeAccount()});document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAccount();accountButton?.focus()}});document.getElementById('wfSignOut')?.addEventListener('click',async()=>{closeAccount();await window.DOTAuth.signOut()});document.getElementById('dotMenu')?.addEventListener('click',()=>document.body.classList.add('dot-menu-open'));document.getElementById('dotOverlay')?.addEventListener('click',()=>document.body.classList.remove('dot-menu-open'));const saved=localStorage.getItem('dot-sidebar-collapsed')==='1';if(saved)document.body.classList.add('dot-sidebar-collapsed');const t=document.getElementById('dotSidebarToggle');const sync=()=>{const collapsed=document.body.classList.contains('dot-sidebar-collapsed');if(t){t.textContent=collapsed?'▶':'◀';t.setAttribute('aria-label',collapsed?'Show sidebar':'Hide sidebar');t.setAttribute('title',collapsed?'Show sidebar':'Hide sidebar')}};sync();t?.addEventListener('click',()=>{document.body.classList.toggle('dot-sidebar-collapsed');localStorage.setItem('dot-sidebar-collapsed',document.body.classList.contains('dot-sidebar-collapsed')?'1':'0');sync()});document.querySelectorAll('.dot-nav a').forEach(a=>{a.addEventListener('click',()=>document.body.classList.remove('dot-menu-open'));const warm=()=>{const href=(a.getAttribute('href')||'').split('?')[0],action=prefetchActions[href];if(action&&window.DOTApi?.prefetch)window.DOTApi.prefetch(action)};a.addEventListener('pointerenter',warm,{once:true,passive:true});a.addEventListener('touchstart',warm,{once:true,passive:true});a.addEventListener('focus',warm,{once:true,passive:true})});}

// Shared branded modal; resolves only after explicit user action.
window.DOTDialog=Object.freeze({
 open({title='Please confirm',message='',confirmText='Continue',cancelText='Cancel',danger=false,input=false}={}){
  return new Promise(resolve=>{
   const backdrop=document.createElement('div');
   backdrop.style.cssText='position:fixed;inset:0;z-index:2147483000;background:rgba(10,28,55,.58);display:flex;align-items:center;justify-content:center;padding:20px';
   const panel=document.createElement('section');
   panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
   panel.setAttribute('aria-label',title);
   panel.style.cssText='width:min(100%,480px);background:#fff;border:1px solid #dce6f2;border-radius:16px;box-shadow:0 24px 64px rgba(9,30,62,.28);padding:28px;font:inherit;color:#17365f';
   const stripe=document.createElement('div');stripe.style.cssText='height:5px;background:#f05a00;border-radius:8px;margin:-28px -28px 24px';
   const heading=document.createElement('h2');heading.textContent=title;heading.style.cssText='font-size:22px;margin:0 0 12px;color:#17365f';
   const copy=document.createElement('p');copy.textContent=message;copy.style.cssText='font-size:15px;line-height:1.55;margin:0 0 22px;color:#53657c;white-space:pre-wrap';
   const field=input?document.createElement('input'):null;
   if(field){field.style.cssText='width:100%;height:43px;padding:10px;border:1px solid #bfcddd;border-radius:8px;margin-bottom:20px';}
   const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap';
   const createButton=(label,primary)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='padding:12px 20px;border-radius:9px;font-weight:700;cursor:pointer;border:1px solid '+(primary?'#e65a00':'#cdd9e7')+';background:'+(primary?(danger?'#b42318':'#f05a00'):'#fff')+';color:'+(primary?'#fff':'#17365f');return b};
   const no=createButton(cancelText,false),yes=createButton(confirmText,true);
   const prior=document.activeElement;
   const close=value=>{document.removeEventListener('keydown',onKey,true);backdrop.remove();if(prior&&prior.isConnected&&prior.focus)prior.focus();resolve(value)};
   const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close(input?null:false)}if(e.key==='Tab'){const focusables=field?[field,no,yes]:[no,yes];const index=focusables.indexOf(document.activeElement);if(e.shiftKey&&index===0){e.preventDefault();yes.focus()}else if(!e.shiftKey&&index===focusables.length-1){e.preventDefault();focusables[0].focus()}}};
   no.onclick=()=>close(input?null:false);yes.onclick=()=>close(input?field.value:true);
   actions.append(no,yes);panel.append(stripe,heading,copy);if(field)panel.append(field);panel.append(actions);backdrop.append(panel);document.body.append(backdrop);document.addEventListener('keydown',onKey,true);(field||no).focus();
  });
 },
 confirm(message,options={}){return this.open({message,...options})},
 prompt(message,options={}){return this.open({message,input:true,...options})},
 alert(message,options={}){return this.open({message,confirmText:'OK',cancelText:'Close',...options})}
});

window.DOTShell=Object.freeze({render,groups:[['Workforce Management',routes]],escape:esc});
})();
