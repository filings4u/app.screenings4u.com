(()=>{'use strict';
const qs=new URLSearchParams(location.search);
const selected=qs.get('workspace')==='workforce'||qs.get('workspace')==='nondot'?'nondot':'dot';
const modules=[
['Overview','dot-dashboard.html','workforce-dashboard.html'],
['Customers & C/TPAs','global-customer-360.html','global-customer-360.html'],
['Employers','dot-employers.html','workforce-employers.html'],
['C/TPAs','dot-ctpas.html','workforce-ctpas.html'],
['People & Drivers','dot-drivers.html','workforce-people.html'],
['Program Management','dot-programs.html','workforce-programs.html'],
['Pools & Consortium','dot-pools.html','workforce-pools.html'],
['Random Selections','dot-random-selections.html','workforce-selections.html'],
['Testing Orders','dot-testing-orders.html','workforce-testing.html'],
['Results','results-management.html','results-management.html'],
['Compliance','dot-compliance.html','workforce-compliance.html'],
['Documents','dot-documents.html','workforce-documents.html'],
['Invoices','dot-invoices.html','dot-invoices.html'],
['Subscriptions','subscription-management.html','subscription-management.html'],
['Orders & Services','dot-orders.html','workforce-services.html'],
['Notifications','dot-notifications.html','workforce-notifications.html'],
['Integrations','dot-integrations.html','workforce-integrations.html'],
['Support','dot-support.html','workforce-support.html'],
['Settings','dot-settings.html','workforce-settings.html'],
['Website','dot-website.html','workforce-website.html'],
['User Access','dot-users-access.html','workforce-user-access.html'],
['Reports','dot-audit.html','workforce-reports.html'],
['Work Orders','global-work-orders.html','global-work-orders.html'],
['Task Manager','task-manager.html','task-manager.html']
];
const dotOnly=[['Owner-Operators','dot-owner-operators.html'],['Clearinghouse','dot-clearinghouse.html'],['Return-to-Duty / SAP','dot-return-to-duty.html'],['Follow-Up Testing','dot-follow-up-testing.html'],['DOT Agencies','dot-agencies.html']];
const shared=new Set(['global-customer-360.html','results-management.html','dot-invoices.html','subscription-management.html','global-work-orders.html','task-manager.html']);
function card(label,href,program){const a=document.createElement('a');a.className='wf-tile';a.href=href+(shared.has(href)?'?workspace='+(program==='nondot'?'workforce':'dot'):'');const name=document.createElement('strong');name.textContent=label;const meta=document.createElement('small');meta.textContent='Open '+label; a.append(name,meta);return a}
async function start(){const user=await window.DOTAuth.requireAuth();if(!user)return;window.DOTShell.render(user);const mount=document.getElementById('dotPageMount');if(!mount)return;const main=document.createElement('section');main.className='wf-home';main.innerHTML='<div class="wf-hero"><div><span class="dot-eyebrow">WORKFORCE | SCREENINGS4U</span><h1>Workforce Management</h1><p>One management portal for DOT and Non-DOT tasks.</p></div><label class="wf-select">Program<select id="wfProgram"><option value="dot">DOT</option><option value="nondot">NON-DOT</option></select></label></div><h2 class="wf-category">Management & Operations</h2><div id="wfTasks" class="wf-grid"></div><div id="wfSpecific"></div>';mount.replaceChildren(main);const select=main.querySelector('#wfProgram');select.value=selected;
function paint(){const program=select.value;const host=main.querySelector('#wfTasks');host.replaceChildren(...modules.map(([label,dot,non])=>card(label,program==='dot'?dot:non,program)));const extra=main.querySelector('#wfSpecific');extra.replaceChildren();if(program==='dot'){const title=document.createElement('h2');title.className='wf-category';title.textContent='DOT-specific compliance';const grid=document.createElement('div');grid.className='wf-grid';grid.append(...dotOnly.map(([label,href])=>card(label,href,program)));extra.append(title,grid)}}
select.addEventListener('change',()=>{history.replaceState(null,'','workforce-management.html?workspace='+(select.value==='nondot'?'workforce':'dot'));paint();const sidebar=document.querySelector('#dotBusinessSelect');if(sidebar&&sidebar.value!==select.value)sidebar.value=select.value;});paint()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();