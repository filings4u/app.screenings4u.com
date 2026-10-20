/* Workforce | screenings4u Management Portal — standalone navigation shell */
(()=>{
"use strict";
const page=location.pathname.split('/').pop()||'dot-dashboard.html';
const sharedPages=new Set(['global-customer-360.html','global-work-orders.html','task-manager.html','task-automations.html','results-management.html','dot-invoices.html','dot-invoice-detail.html','dot-invoice-new.html','dot-recent-subscriptions.html','subscription-management.html']);
const requestedWorkspace=new URLSearchParams(location.search).get('workspace');
const business=page.startsWith('workforce-')||(sharedPages.has(page)&&requestedWorkspace==='workforce')?'nondot':'dot';
const workspaceHome='workforce-management.html';
const workspaceHref=href=>sharedPages.has(href)?href+(href.includes('?')?'&':'?')+'workspace='+(business==='nondot'?'workforce':'dot'):href;
const groups=[
 ['Shared Operations',[['global-customer-360.html','Customer 360','◎'],['global-work-orders.html','Work Orders','▤'],['results-management.html','Results Management','✓'],['dot-invoices.html','Invoice Management','▧'],['subscription-management.html','Subscription Management','▧'],['dot-recent-subscriptions.html','DOT Subscription History','◷'],['workforce-subscriptions.html','NON-DOT Subscription History','◷'],['task-manager.html','Task Manager','✓'],['task-automations.html','Task Automations','◷']]],
 ['NON-DOT Workspace',[['workforce-dashboard.html','Management Home','⌂'],['workforce-portal-control.html','Portal Network Management','◎']]],
 ['Management Workspace',[['dot-dashboard.html','Management Home','⌂'],['dot-portal-control.html','DOT Portal Management','◎'],['ic-pricing.html','IC Pricing & Rates','▤']]],
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
const sections=[
['Workforce Management',[['workforce-management.html','Overview','⌂'],['global-customer-360.html','Customer 360','◎'],['global-work-orders.html','Work Orders','▤'],['task-manager.html','Task Manager','✓']]],
['Programs & Testing',[['workforce-employers.html','Employers','▣'],['workforce-ctpas.html','C/TPAs','◈'],['workforce-people.html','People & Drivers','◉'],['workforce-programs.html','Programs','≡'],['workforce-pools.html','Pools & Consortium','⊙'],['workforce-selections.html','Random Selections','⌁'],['workforce-testing.html','Testing Orders','✚'],['results-management.html','Results','✓']]],
['Compliance & Regulatory',[['workforce-compliance.html','Compliance','⚑'],['dot-clearinghouse.html','FMCSA Clearinghouse','⇄'],['dot-return-to-duty.html','Return-to-Duty / SAP','↺'],['dot-follow-up-testing.html','Follow-Up Testing','⟳'],['dot-agencies.html','Regulatory Agencies','✦']]],
['Operations',[['workforce-documents.html','Documents','▱'],['dot-invoices.html','Invoices','▧'],['subscription-management.html','Subscriptions','▧'],['workforce-services.html','Orders & Services','▤'],['workforce-reports.html','Reports','☷']]],
['Administration',[['workforce-notifications.html','Notifications','●'],['workforce-integrations.html','Integrations','⌘'],['workforce-support.html','Support','?'],['workforce-settings.html','Settings','⚙'],['workforce-website.html','Website','◫'],['workforce-user-access.html','User Access','♙']]]
];return sections.map(([label,items])=>'<div class="dot-nav-group"><span>'+esc(label)+'</span>'+items.map(([href,name,icon])=>'<a href="'+href+'" class="'+(page===href?'active':'')+'"><i class="dot-nav-icon">'+icon+'</i><b>'+esc(name)+'</b></a>').join('')+'</div>').join('');
}
function render(state){const p=state?.profile||{},u=state?.user||{},name=p.display_name||[p.first_name,p.last_name].filter(Boolean).join(' ')||u.user_metadata?.full_name||u.email||'Workforce Administrator',role=(state?.roles||[])[0]||'staff';document.body.classList.add('dot-shell-ready');const existing=document.querySelector('.dot-app');if(existing){const now=location.pathname.split('/').pop()||'dot-dashboard.html';document.querySelectorAll('.dot-nav a').forEach(a=>a.classList.toggle('active',(a.getAttribute('href')||'').split('?')[0]===now));return existing}document.body.innerHTML=`<div class="dot-app"><aside class="dot-sidebar"><div class="dot-brand"><a href="${workspaceHome}" aria-label="Workforce | screenings4u Management"><img class="dot-brand-logo" src="images/logo.png" alt="Workforce | screenings4u"></a></div><nav class="dot-nav" aria-label="Selected business management">${nav()}</nav></aside><div class="dot-main"><header class="dot-topbar"><div class="dot-topbar-left"><button class="dot-menu-button" id="dotMenu" aria-label="Open navigation">☰</button><button class="dot-sidebar-toggle" id="dotSidebarToggle" aria-label="Hide sidebar" title="Hide sidebar">◀</button><div class="dot-topbar-title"><strong>Workforce Management</strong></div></div><div class="dot-topbar-actions"><a class="dot-icon-button" href="workforce-notifications.html" title="Notifications">●</a><a class="dot-icon-button" href="workforce-support.html" title="Support">?</a><a class="dot-user-button" id="dotUser" href="workforce-settings.html"><span class="dot-avatar">${esc(initials(name))}</span><span class="dot-user-copy"><strong>${esc(name)}</strong><small>${esc(role)}</small></span></a></div></header><main id="dotPageMount"></main></div></div><div class="dot-overlay" id="dotOverlay"></div>`;document.getElementById('dotMenu')?.addEventListener('click',()=>document.body.classList.add('dot-menu-open'));document.getElementById('dotOverlay')?.addEventListener('click',()=>document.body.classList.remove('dot-menu-open'));const saved=localStorage.getItem('dot-sidebar-collapsed')==='1';if(saved)document.body.classList.add('dot-sidebar-collapsed');const t=document.getElementById('dotSidebarToggle');const sync=()=>{const collapsed=document.body.classList.contains('dot-sidebar-collapsed');if(t){t.textContent=collapsed?'▶':'◀';t.setAttribute('aria-label',collapsed?'Show sidebar':'Hide sidebar');t.setAttribute('title',collapsed?'Show sidebar':'Hide sidebar')}};sync();t?.addEventListener('click',()=>{document.body.classList.toggle('dot-sidebar-collapsed');localStorage.setItem('dot-sidebar-collapsed',document.body.classList.contains('dot-sidebar-collapsed')?'1':'0');sync()});document.querySelectorAll('.dot-nav a').forEach(a=>{a.addEventListener('click',()=>document.body.classList.remove('dot-menu-open'));const warm=()=>{const href=(a.getAttribute('href')||'').split('?')[0],action=prefetchActions[href];if(action&&window.DOTApi?.prefetch)window.DOTApi.prefetch(action)};a.addEventListener('pointerenter',warm,{once:true,passive:true});a.addEventListener('touchstart',warm,{once:true,passive:true});a.addEventListener('focus',warm,{once:true,passive:true})});}

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

window.DOTShell=Object.freeze({render,groups,escape:esc});
})();
