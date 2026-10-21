(()=>{'use strict';
const groups=[
['Overview',[['Dashboard','workforce-management.html','⌂'],['Customer 360','global-customer-360.html','◎'],['Work Orders','global-work-orders.html','▤'],['Task Manager','task-manager.html','✓'],['Task Automations','task-automations.html','◷']]],
['People & Programs',[['Employers','workforce-employers.html','▣'],['C/TPAs','workforce-ctpas.html','◈'],['People & Drivers','workforce-people.html','◉'],['Programs','workforce-programs.html','≡'],['Pools & Consortium','workforce-pools.html','⊙']]],
['Testing & Compliance',[['Random Selections','workforce-selections.html','⌁'],['Testing Orders','workforce-testing.html','✚'],['Results','results-management.html','✓'],['Compliance','workforce-compliance.html','⚑'],['Clearinghouse','dot-clearinghouse.html','⇄'],['Return-to-Duty / SAP','dot-return-to-duty.html','↺'],['Follow-Up Testing','dot-follow-up-testing.html','⟳'],['Regulatory Agencies','dot-agencies.html','✦'],['Owner-Operators','dot-owner-operators.html','◇']]],
['Business Operations',[['Documents','workforce-documents.html','▱'],['Invoices','dot-invoices.html','▧'],['Proposals','nondot-proposals.html','▤'],['Subscriptions','subscription-management.html','▧'],['Services & Orders','workforce-services.html','▤'],['Reports','workforce-reports.html','☷']]],
['Administration',[['Notifications','workforce-notifications.html','●'],['Integrations','workforce-integrations.html','⌘'],['Support','workforce-support.html','?'],['Settings','workforce-settings.html','⚙'],['Website','workforce-website.html','◫'],['User Access','workforce-user-access.html','♙'],['Portal Network','workforce-portal-control.html','◎']]]
];
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function link(label,href,icon,kind){const a=document.createElement('a');a.href=href;a.className=kind;const symbol=document.createElement('span');symbol.textContent=icon;symbol.setAttribute('aria-hidden','true');const caption=document.createElement('strong');caption.textContent=label;a.append(symbol,caption);return a}
async function start(){
 const user=await window.DOTAuth.requireAuth();if(!user)return;
 const root=document.getElementById('workforceApp');if(!root)return;
 const name=user.profile?.display_name||user.user?.email||'Staff';
 root.innerHTML='<aside class="wf-side"><a class="wf-brand" href="/workforce-management.html"><img src="images/logo.png" alt="screenings4u"><span>Workforce Management</span></a><nav id="wfNav" aria-label="Workforce Management"></nav></aside><div class="wf-main"><header class="wf-top"><button id="wfMenu" type="button" aria-label="Toggle navigation">☰</button><strong>Workforce | screenings4u</strong><div class="wf-profile"><span id="wfName"></span><button id="wfSignOut" type="button">Sign out</button></div></header><main class="wf-content"><p class="wf-kicker">WORKFORCE MANAGEMENT</p><h1>Management Overview</h1><p class="wf-intro">One portal for testing programs, regulatory compliance, people and operations.</p><div id="wfSections"></div></main></div>';
 document.getElementById('wfName').textContent=name;
 document.getElementById('wfSignOut').onclick=()=>window.DOTAuth.signOut();
 document.getElementById('wfMenu').onclick=()=>root.classList.toggle('wf-nav-open');
 const nav=document.getElementById('wfNav'),body=document.getElementById('wfSections');
 for(const [title,items] of groups){const section=document.createElement('section');section.className='wf-nav-section';const heading=document.createElement('h2');heading.textContent=title;section.append(heading);for(const [label,href,icon] of items)section.append(link(label,href,icon,'wf-nav-link'));nav.append(section);
 const area=document.createElement('section');area.className='wf-section';const h=document.createElement('h2');h.textContent=title;const grid=document.createElement('div');grid.className='wf-grid';for(const [label,href,icon] of items)grid.append(link(label,href,icon,'wf-card'));area.append(h,grid);body.append(area)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();