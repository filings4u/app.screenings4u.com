/* Dashboard | screenings4u Management Portal — standalone navigation shell */
(()=>{
"use strict";
const page=location.pathname.split('/').pop()||'dot-dashboard.html';
const sharedPages=new Set(['global-customer-360.html','global-work-orders.html','task-manager.html','task-automations.html','results-management.html','dot-invoices.html','dot-invoice-detail.html','dot-invoice-new.html','dot-recent-subscriptions.html','subscription-management.html']);
const requestedWorkspace=new URLSearchParams(location.search).get('workspace');
const business=page.startsWith('workforce-')||(sharedPages.has(page)&&requestedWorkspace==='workforce')?'nondot':'dot';
const workspaceHome=business==='nondot'?'workforce-dashboard.html':'dot-dashboard.html';
const workspaceHref=href=>sharedPages.has(href)?href+(href.includes('?')?'&':'?')+'workspace='+(business==='nondot'?'workforce':'dot'):href;
const groups=[
 ['Shared Operations',[['global-customer-360.html','Customer 360','◎'],['global-work-orders.html','Work Orders','▤'],['results-management.html','Results Management','✓'],['dot-invoices.html','Invoice Management','▧'],['nondot-proposals.html','Proposals Management','▤'],['subscription-management.html','Subscription Management','▧'],['dot-recent-subscriptions.html','DOT Subscription History','◷'],['workforce-subscriptions.html','NON-DOT Subscription History','◷'],['task-manager.html','Task Manager','✓'],['task-automations.html','Task Automations','◷']]],
 ['Independent Contractors',[['ic-contractors.html','IC Directory','♙'],['ic-work-orders.html','IC Work Orders','▤'],['ic-pricing.html','IC Pricing & Rates','$']]],
 ['NON-DOT Workspace',[['workforce-dashboard.html','Management Home','⌂'],['workforce-portal-control.html','Portal Network Management','◎']]],
 ['Management Workspace',[['dot-dashboard.html','Management Home','⌂'],['dot-portal-control.html','DOT Portal Management','◎']]],
 ['DOT Accounts & People',[['dot-ctpas.html','C/TPA Management','◈'],['dot-employers.html','Employer Management','▣'],['dot-owner-operators.html','Owner-Operator Management','◇'],['dot-drivers.html','Driver Management','◉'],['dot-users-access.html','DOT User Access','♙']]],
 ['DOT Programs & Testing',[['dot-programs.html','Program Management','≡'],['dot-pools.html','Consortium Management','⊙'],['dot-random-selections.html','Random Selection Management','⌁'],['dot-testing-orders.html','Testing Order Management','✚'],['dot-follow-up-testing.html','Follow-Up Management','⟳']]],
 ['DOT Compliance',[['dot-compliance.html','Compliance Management','⚑'],['dot-clearinghouse.html','Clearinghouse Management','⇄'],['dot-return-to-duty.html','Return-to-Duty / SAP','↺'],['dot-agencies.html','DOT Agency Management','✦']]],
 ['NON-DOT Accounts & People',[['workforce-ctpas.html','C/TPA Management','◈'],['workforce-employers.html','Employer Management','▣'],['workforce-people.html','Employee Management','◉'],['workforce-access.html','Organization Access','♙'],['workforce-user-access.html','User Access','♙']]],
 ['NON-DOT Programs & Testing',[['workforce-programs.html','Program Management','≡'],['workforce-pools.html','Pool Management','⊙'],['workforce-testing.html','Testing Order Management','✚'],['workforce-compliance.html','Compliance Management','⚑']]],
 ['NON-DOT Operations & Services',[['workforce-selections.html','Random Selection Management','⌁'],['workforce-documents.html','Document Management','▱'],['workforce-services.html','Service Catalog Management','▤'],['workforce-reports.html','Report Management','☷']]],
 ['NON-DOT Administration',[['workforce-website.html','Website Management','◫'],['workforce-notifications.html','Notification Management','●'],['workforce-integrations.html','Integration Management','⌘'],['workforce-support.html','Support Management','?'],['workforce-staff.html','Staff Management','♙'],['workforce-settings.html','Settings Management','⚙']]],
 ['DOT Catalog & Orders',[['dot-catalog.html','DOT Plans & Pricing','$'],['dot-ctpa-pricing.html','DOT C/TPA Pricing','¢'],['dot-orders.html','Service Order Management','▤'],['dot-recent-orders.html','Recent Order Management','◷']]],
 ['Documents & Services',[['dot-documents.html','Document Management','▱'],['dot-training.html','Training Management','△'],['dot-distribution.html','Distribution Management','⇧'],['dot-website.html','DOT Website Management','◫']]],
 ['System Administration',[['dot-notifications.html','Notification Management','●'],['dot-demo-management.html','Demo Management','◫'],['dot-support.html','Support Management','?'],['dot-integrations.html','Integration Management','⌘'],['dot-settings.html','Settings Management','⚙'],['dot-audit.html','Audit History','☷']]]
];
const prefetchActions={
 'dot-dashboard.html':'overview','dot-ctpas.html':'ctpas','dot-employers.html':'employers','dot-owner-operators.html':'owner_operators','dot-drivers.html':'drivers','dot-users-access.html':'portal_access','dot-programs.html':'programs','dot-pools.html':'pools','dot-random-selections.html':'selections','dot-testing-orders.html':'testing','dot-results.html':'results','dot-compliance.html':'compliance','dot-clearinghouse.html':'clearinghouse','dot-return-to-duty.html':'rtd','dot-follow-up-testing.html':'follow_up_testing','dot-catalog.html':'services','dot-orders.html':'orders','dot-recent-orders.html':'orders','dot-recent-subscriptions.html':'billing','dot-training.html':'training','dot-integrations.html':'integrations','dot-settings.html':'reports','dot-audit.html':'audit_history'
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function initials(v){return String(v||'DOT').split(/\s+|@/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()).join('')||'DOT'}
function nav(){
 const allowed=groups;
 return allowed.map(([label,links])=>{
  const visible=links;
  if(!visible.length)return '';
  const items=visible.map(([href,name,icon])=>{
   const url=workspaceHref(href);
   return `<a href="${url}" class="${page===href?'active':''}"><i class="dot-nav-icon">${icon}</i><b>${esc(name)}</b></a>`;
  }).join('');
  return `<div class="dot-nav-group"><span>${esc(label)}</span>${items}</div>`;
 }).join('');
}
function render(state){const p=state?.profile||{},u=state?.user||{},name=p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||u.user_metadata?.full_name||u.email||'DOT Administrator',role=(state?.roles||[])[0]||'staff';if(!document.querySelector('link[data-unified-shell]')){const style=document.createElement('link');style.rel='stylesheet';style.href='assets/css/management-unified-shell.css?v=2';style.dataset.unifiedShell='true';document.head.append(style)}document.body.classList.add('dot-shell-ready');const existing=document.querySelector('.dot-app');if(existing){const now=location.pathname.split('/').pop()||'dot-dashboard.html';document.querySelectorAll('.dot-nav a').forEach(a=>a.classList.toggle('active',(a.getAttribute('href')||'').split('?')[0]===now));return existing}document.body.innerHTML=`<div class="dot-app"><aside class="dot-sidebar" id="s4uSidebar"><a class="dot-brand" href="/dashboard/"><img src="images/logo.png" alt="screenings4u"></a><nav class="dot-nav" aria-label="Management navigation">${nav()}</nav></aside><div class="dot-main"><header class="dot-topbar"><button class="dot-menu-button" id="dotMenu" type="button" aria-label="Open menu">☰</button><strong class="dot-topbar-title">Workforce | screenings4u</strong><div class="dot-topbar-actions"><button id="dotAccountToggle" class="dot-account-toggle" aria-expanded="false" aria-controls="dotAccountMenu" type="button">${esc(u.email||name)} ▾</button><div id="dotAccountMenu" class="dot-account-menu" hidden><a href="/dashboard/">Management Home</a><a href="dot-dashboard.html">Switch to DOT</a><a href="workforce-dashboard.html">Switch to NON-DOT</a><button id="dotSignOut" type="button">Sign out</button></div></div></header><main id="dotPageMount"></main></div></div><div class="dot-overlay" id="dotOverlay"></div>`;const sidebarToggle=document.getElementById('s4uSidebarToggle');const sidebarSync=()=>{const hidden=document.body.classList.contains('s4u-sidebar-hidden');sidebarToggle.textContent=hidden?'☰ Show sidebar':'☰ Hide sidebar';sidebarToggle.setAttribute('aria-expanded',String(!hidden));};try{if(localStorage.getItem('s4u-sidebar-hidden')==='1')document.body.classList.add('s4u-sidebar-hidden')}catch{}sidebarToggle.onclick=()=>{document.body.classList.toggle('s4u-sidebar-hidden');document.body.classList.toggle('dot-menu-open',!document.body.classList.contains('s4u-sidebar-hidden')&&matchMedia('(max-width:900px)').matches);try{localStorage.setItem('s4u-sidebar-hidden',document.body.classList.contains('s4u-sidebar-hidden')?'1':'0')}catch{}sidebarSync()};sidebarSync();const toggle=document.getElementById('dotAccountToggle'),menu=document.getElementById('dotAccountMenu');toggle.onclick=()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden))};document.getElementById('dotSignOut').onclick=()=>window.DOTAuth.signOut();document.addEventListener('click',e=>{if(!toggle.contains(e.target)&&!menu.contains(e.target)){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}});document.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;toggle.setAttribute('aria-expanded','false')}});document.getElementById('dotBusinessSelect')?.addEventListener('change',e=>{const target=e.target.value==='nondot'?'workforce':'dot';const counterpart=sharedPages.has(page)?page+'?workspace='+target:target==='workforce'?'workforce-dashboard.html':'dot-dashboard.html';location.assign(counterpart)});document.getElementById('dotMenu')?.addEventListener('click',()=>document.body.classList.add('dot-menu-open'));document.getElementById('dotOverlay')?.addEventListener('click',()=>document.body.classList.remove('dot-menu-open'));const saved=localStorage.getItem('dot-sidebar-collapsed')==='1';if(saved)document.body.classList.add('dot-sidebar-collapsed');const t=document.getElementById('dotSidebarToggle');const sync=()=>{const collapsed=document.body.classList.contains('dot-sidebar-collapsed');if(t){t.textContent=collapsed?'▶':'◀';t.setAttribute('aria-label',collapsed?'Show sidebar':'Hide sidebar');t.setAttribute('title',collapsed?'Show sidebar':'Hide sidebar')}};sync();t?.addEventListener('click',()=>{document.body.classList.toggle('dot-sidebar-collapsed');localStorage.setItem('dot-sidebar-collapsed',document.body.classList.contains('dot-sidebar-collapsed')?'1':'0');sync()});document.querySelectorAll('.dot-nav a').forEach(a=>{a.addEventListener('click',()=>document.body.classList.remove('dot-menu-open'));const warm=()=>{const href=(a.getAttribute('href')||'').split('?')[0],action=prefetchActions[href];if(action&&window.DOTApi?.prefetch)window.DOTApi.prefetch(action)};a.addEventListener('pointerenter',warm,{once:true,passive:true});a.addEventListener('touchstart',warm,{once:true,passive:true});a.addEventListener('focus',warm,{once:true,passive:true})});}

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
   const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close(input?null:false)}if(e.key==='Tab'){const focusables=field?(cancelText?[field,no,yes]:[field,yes]):(cancelText?[no,yes]:[yes]);const index=focusables.indexOf(document.activeElement);if(e.shiftKey&&index===0){e.preventDefault();yes.focus()}else if(!e.shiftKey&&index===focusables.length-1){e.preventDefault();focusables[0].focus()}}};
   no.onclick=()=>close(input?null:false);yes.onclick=()=>close(input?field.value:true);
   if(cancelText)actions.append(no);actions.append(yes);panel.append(stripe,heading,copy);if(field)panel.append(field);panel.append(actions);backdrop.append(panel);document.body.append(backdrop);document.addEventListener('keydown',onKey,true);(field||(cancelText?no:yes)).focus();
  });
 },
 confirm(message,options={}){return this.open({message,...options})},
 prompt(message,options={}){return this.open({message,input:true,...options})},
 alert(message,options={}){return this.open({message,title:'Notice',confirmText:'OK',cancelText:null,...options})}
});

window.DOTShell=Object.freeze({render,groups,escape:esc});
})();
