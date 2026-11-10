/* Workforce management landing page — the actual /dashboard.html entry point. */
(()=>{'use strict';
const $=q=>document.querySelector(q);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=(name)=>({'Building':'▣','People':'◎','Shield':'◇','Clipboard':'▤','Credit':'
const links=[
{title:'Customer Requests',desc:'New supply requests, inquiries and portal submissions.',href:'workforce-inbox.html',icon:'Requests',tag:'Customer activity'},
{title:'Billing & Invoices',desc:'Review paid, open and voided invoices in one ledger.',href:'workforce-billing.html',icon:'Invoice',tag:'Finance'},
{title:'Lab Account & Supplies',desc:'Review laboratory accounts, supply orders and fulfillment.',href:'lab-supplies.html',icon:'Lab',tag:'Lab operations'},
{title:'Website & Content',desc:'Manage pages, resources and website content.',href:'workforce-website.html',icon:'Content',tag:'Website'},
{title:'Checkout Prices',desc:'Maintain live subscriptions and pricing plans.',href:'workforce-checkout-plans.html',icon:'Credit',tag:'Revenue'},
{title:'Portal Access',desc:'Manage roles and customer portal assignments.',href:'workforce-portal-control.html',icon:'Shield',tag:'Access'}
];
const portalLinks=[
['C/TPA','workforce-ctpas.html','Customer accounts, client employers and audit workflows'],
['Employers','workforce-employers.html','Companies, employees and compliance programs'],
['Owner-Operators','dot-owner-operators.html','Owner-operator accounts and DOT compliance'],
['Independent Contractors','ic-contractors.html','Contractor administration and work orders'],
['DOT Agency Portals','dot-portal-control.html','FMCSA, FAA, FRA, FTA, PHMSA and USCG'],
['Customer Access','workforce-portal-control.html','Permissions across connected customer portals']
];
function metric(label,value,description,href){return '<a class="wmd-metric" href="'+href+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(description)+'</small></a>'}
function linkCard(c){return '<a class="wmd-action" href="'+esc(c.href)+'"><div class="wmd-action-symbol" aria-hidden="true">'+icon(c.icon)+'</div><div class="wmd-action-content"><span class="wmd-action-tag">'+esc(c.tag||'Workspace')+'</span><strong>'+esc(c.title)+'</strong><p>'+esc(c.desc)+'</p></div><span class="wmd-action-arrow" aria-hidden="true">→</span></a>'}
async function getSummary(){
 const {data,error}=await dotSupabase.auth.getSession();
 if(error||!data.session?.access_token)throw Error('Staff sign-in required');
 const headers={'Content-Type':'application/json',apikey:DOT_PORTAL_CONFIG.supabaseAnonKey,Authorization:'Bearer '+data.session.access_token};
 const url=DOT_PORTAL_CONFIG.supabaseUrl+'/functions/v1/nondot-management-read';
 const request=async action=>{const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({action}),cache:'no-store'});const result=await res.json().catch(()=>({}));if(!res.ok||result.error)throw Error(result.error||'Information unavailable');return result};
 return Promise.allSettled([request('overview'),request('workforce_portal_network')]);
}
async function start(){
 const state=await DOTAuth.requireAuth();if(!state)return;
 DOTShell.render(state);
 const root=$('#dotPageMount');if(!root)return;
 root.classList.add('wmd-root');
 root.innerHTML='<section class="wmd-dashboard">'
 +'<div class="wmd-hero"><div class="wmd-hero-content"><span class="wmd-eyebrow">WORKFORCE MANAGEMENT / OPERATIONS</span><h1>One workspace.<br>Every operation.</h1><p>Oversee customers, training and testing programs, supply requests, billing, and connected Workforce portals.</p><div class="wmd-hero-buttons"><a class="wmd-primary" href="workforce-inbox.html">Review Customer Requests <span>→</span></a><a class="wmd-outline" href="workforce-billing.html">Billing & Invoices <span>→</span></a></div></div><div class="wmd-hero-aside"><span class="wmd-hero-aside-label">YOUR WORKSPACE</span><strong>Workforce<br>Control Center</strong><span>Connected operations</span><div class="wmd-hero-aside-rule"></div><span>Secure management</span></div></div>'
 +'<div class="wmd-section-head"><div><span class="wmd-overline">PLATFORM OVERVIEW</span><h2>Your operations</h2></div><button id="wmdRefresh" class="wmd-refresh" type="button">↻ Refresh Data</button></div>'
 +'<div id="wmdMetrics" class="wmd-metrics" aria-live="polite">'+metric('C/TPA Accounts','—','Loading accounts','workforce-ctpas.html')+metric('Employers','—','Loading employers','workforce-employers.html')+metric('People & Drivers','—','Loading records','workforce-people.html')+metric('Connected Portals','—','Loading portals','workforce-portal-control.html')+'</div>'
 +'<div class="wmd-section-head"><div><span class="wmd-overline">WORKSPACE DIRECTORY</span><h2>Manage your business</h2></div></div>'
 +'<div class="wmd-actions">'+links.map(linkCard).join('')+'</div>'
 +'<div class="wmd-bottom"><section class="wmd-portal-panel"><div class="wmd-section-head"><div><span class="wmd-overline">CONNECTED WORKSPACES</span><h2>Customer & regulatory portals</h2></div><a href="workforce-portal-control.html" class="wmd-text-link">All portals →</a></div><div class="wmd-portal-list">'+portalLinks.map(([name,href,desc])=>'<a class="wmd-portal-row" href="'+esc(href)+'"><span class="wmd-portal-dot" aria-hidden="true"></span><div><strong>'+esc(name)+'</strong><small>'+esc(desc)+'</small></div><span aria-hidden="true">→</span></a>').join('')+'</div></section>'
 +'<section class="wmd-sidebar-panel"><span class="wmd-overline">WORKFORCE SHORTCUTS</span><h2>Frequently used</h2><p>Open your existing operational tools and connected customer services.</p><div class="wmd-shortcuts"><a href="workforce-billing.html">Billing & Invoices <span>→</span></a><a href="workforce-inbox.html">Customer Requests <span>→</span></a><a href="workforce-services.html">Services & Orders <span>→</span></a><a href="subscription-management.html?workspace=workforce">Subscriptions <span>→</span></a><a href="workforce-notifications.html">Notifications <span>→</span></a><a href="global-customer-360.html">Customer 360 <span>→</span></a><a href="task-manager.html">Task Manager <span>→</span></a><a href="workforce-reports.html">Reports <span>→</span></a></div></section></div>'
 +'<p id="wmdStatus" role="status" class="wmd-status">Live data is loaded from Workforce management services.</p></section>';
 async function reload(){
  const button=$('#wmdRefresh'),status=$('#wmdStatus');button.disabled=true;status.textContent='Refreshing management data…';
  try{
   const result=await getSummary();
   const overview=result[0].status==='fulfilled'?result[0].value.metrics:null;
   const network=result[1].status==='fulfilled'?result[1].value:null;
   const domains=new Set([...(network?.managed_surfaces||[]).map(x=>x.hostname),...(network?.customer_portals||[]).map(x=>x.hostname),...(network?.agency_portals||[]).map(x=>x.domain)].filter(Boolean));
   $('#wmdMetrics').innerHTML=[
    metric('C/TPA Accounts',overview?.ctpas??'—','Managed C/TPA companies','workforce-ctpas.html'),
    metric('Employers',overview?.employers??'—','Employer organizations','workforce-employers.html'),
    metric('People & Drivers',overview?.employees??'—','Workforce records','workforce-people.html'),
    metric('Connected Portals',network?domains.size:'—','Registered customer and agency portals','workforce-portal-control.html')
   ].join('');
   status.textContent=(!overview||!network)?'Some live totals are unavailable. Your management pages remain accessible.':'Live management totals loaded successfully.';
  }catch(err){status.textContent='Live totals unavailable: '+(err.message||'Please try again.')}
  finally{button.disabled=false}
 }
 $('#wmdRefresh').onclick=reload;
 await reload();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(err=>{const el=$('#dotPageMount');if(el)el.textContent=err.message||'Unable to load dashboard'}),{once:true});else start().catch(err=>{const el=$('#dotPageMount');if(el)el.textContent=err.message||'Unable to load dashboard'});
})();,'Content':'▧','Folder':'▤','Link':'↗','Bell':'◉','Clock':'◷','Check':'✓','Invoice':'▤','Requests':'✉','Lab':'✚'}[name]||'▣');
const links=[
{title:'Website & Content',desc:'Pages, SEO, marketing content and portal connections.',href:'workforce-website.html',icon:'Content'},
{title:'Main Website Pages & SEO',desc:'Edit all 44 Workforce website page metadata records.',href:'workforce-main-site.html',icon:'Content'},
{title:'Live Checkout Prices',desc:'Manage production C/TPA, employer, owner-operator and agency plans.',href:'workforce-checkout-plans.html',icon:'Credit'},
{title:'Documents & Records',desc:'Manage customer documents and secure record access.',href:'workforce-documents.html',icon:'Folder'},
{title:'Portal Access',desc:'Control organization and user portal assignments.',href:'workforce-portal-control.html',icon:'Shield'},
{title:'Independent Contractors',desc:'Contractor applications, work orders, agreements and compliance.',href:'ic-contractors.html',icon:'People'}
];
const portalLinks=[
['C/TPA','workforce-ctpas.html','Customer accounts, client employers and audit workflows'],
['Employers','workforce-employers.html','Companies, employees and compliance programs'],
['Owner-Operators','dot-owner-operators.html','Owner-operator accounts and DOT compliance'],
['Independent Contractors','ic-contractors.html','Contractor administration and work orders'],
['DOT Agency Portals','dot-portal-control.html','FMCSA, FAA, FRA, FTA, PHMSA and USCG'],
['Customer Access','workforce-portal-control.html','Permissions across connected customer portals']
];
function metric(label,value,description,href){return '<a class="wmd-metric" href="'+href+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(description)+'</small></a>'}
function linkCard(c){return '<a class="wmd-action" href="'+esc(c.href)+'"><div class="wmd-action-symbol" aria-hidden="true">'+icon(c.icon)+'</div><div class="wmd-action-content"><strong>'+esc(c.title)+'</strong><p>'+esc(c.desc)+'</p></div><span class="wmd-action-arrow" aria-hidden="true">→</span></a>'}
async function getSummary(){
 const {data,error}=await dotSupabase.auth.getSession();
 if(error||!data.session?.access_token)throw Error('Staff sign-in required');
 const headers={'Content-Type':'application/json',apikey:DOT_PORTAL_CONFIG.supabaseAnonKey,Authorization:'Bearer '+data.session.access_token};
 const url=DOT_PORTAL_CONFIG.supabaseUrl+'/functions/v1/nondot-management-read';
 const request=async action=>{const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({action}),cache:'no-store'});const result=await res.json().catch(()=>({}));if(!res.ok||result.error)throw Error(result.error||'Information unavailable');return result};
 return Promise.allSettled([request('overview'),request('workforce_portal_network')]);
}
async function start(){
 const state=await DOTAuth.requireAuth();if(!state)return;
 DOTShell.render(state);
 const root=$('#dotPageMount');if(!root)return;
 root.classList.add('wmd-root');
 root.innerHTML='<section class="wmd-dashboard">'
 +'<div class="wmd-hero"><div class="wmd-hero-content"><span class="wmd-eyebrow">WORKFORCE BY SCREENINGS4U · MANAGEMENT</span><h1>Workforce Control Center</h1><p>Manage your websites, customers, DOT programs, pricing, documents, and connected portals from one workspace.</p><div class="wmd-hero-buttons"><a class="wmd-primary" href="workforce-main-site.html">Manage Main Website <span>→</span></a><a class="wmd-outline" href="workforce-website.html">View Connected Portals <span>→</span></a></div></div><div class="wmd-hero-mark" aria-hidden="true"><span>W</span></div></div>'
 +'<div class="wmd-section-head"><div><span class="wmd-overline">OPERATIONS AT A GLANCE</span><h2>Workforce overview</h2></div><button id="wmdRefresh" class="wmd-refresh" type="button">↻ Refresh Data</button></div>'
 +'<div id="wmdMetrics" class="wmd-metrics" aria-live="polite">'+metric('C/TPA Accounts','—','Loading accounts','workforce-ctpas.html')+metric('Employers','—','Loading employers','workforce-employers.html')+metric('People & Drivers','—','Loading records','workforce-people.html')+metric('Connected Portals','—','Loading portals','workforce-website.html')+'</div>'
 +'<div class="wmd-section-head"><div><span class="wmd-overline">ADMINISTRATION</span><h2>Manage the platform</h2></div></div>'
 +'<div class="wmd-actions">'+links.map(linkCard).join('')+'</div>'
 +'<div class="wmd-bottom"><section class="wmd-portal-panel"><div class="wmd-section-head"><div><span class="wmd-overline">CONNECTED WORKSPACES</span><h2>Customer & regulatory portals</h2></div><a href="workforce-website.html" class="wmd-text-link">All portals →</a></div><div class="wmd-portal-list">'+portalLinks.map(([name,href,desc])=>'<a class="wmd-portal-row" href="'+esc(href)+'"><span class="wmd-portal-dot" aria-hidden="true"></span><div><strong>'+esc(name)+'</strong><small>'+esc(desc)+'</small></div><span aria-hidden="true">→</span></a>').join('')+'</div></section>'
 +'<section class="wmd-sidebar-panel"><span class="wmd-overline">QUICK ACTIONS</span><h2>Business operations</h2><p>Continue to your existing management tools. Customer records and operational workflows remain connected.</p><div class="wmd-shortcuts"><a href="workforce-services.html">Services & Orders <span>→</span></a><a href="subscription-management.html?workspace=workforce">Subscriptions <span>→</span></a><a href="workforce-notifications.html">Notifications <span>→</span></a><a href="global-customer-360.html">Customer 360 <span>→</span></a><a href="task-manager.html">Task Manager <span>→</span></a><a href="workforce-reports.html">Reports <span>→</span></a></div></section></div>'
 +'<p id="wmdStatus" role="status" class="wmd-status">Data loads from your existing Supabase management services.</p></section>';
 async function reload(){
  const button=$('#wmdRefresh'),status=$('#wmdStatus');button.disabled=true;status.textContent='Refreshing management data…';
  try{
   const result=await getSummary();
   const overview=result[0].status==='fulfilled'?result[0].value.metrics:null;
   const network=result[1].status==='fulfilled'?result[1].value:null;
   const domains=new Set([...(network?.managed_surfaces||[]).map(x=>x.hostname),...(network?.customer_portals||[]).map(x=>x.hostname),...(network?.agency_portals||[]).map(x=>x.domain)].filter(Boolean));
   $('#wmdMetrics').innerHTML=[
    metric('C/TPA Accounts',overview?.ctpas??'—','Managed C/TPA companies','workforce-ctpas.html'),
    metric('Employers',overview?.employers??'—','Employer organizations','workforce-employers.html'),
    metric('People & Drivers',overview?.employees??'—','Workforce records','workforce-people.html'),
    metric('Connected Portals',network?domains.size:'—','Registered customer and agency portals','workforce-website.html')
   ].join('');
   status.textContent=(!overview||!network)?'Some live totals are unavailable. Your management pages remain accessible.':'Live management totals loaded successfully.';
  }catch(err){status.textContent='Live totals unavailable: '+(err.message||'Please try again.')}
  finally{button.disabled=false}
 }
 $('#wmdRefresh').onclick=reload;
 await reload();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(err=>{const el=$('#dotPageMount');if(el)el.textContent=err.message||'Unable to load dashboard'}),{once:true});else start().catch(err=>{const el=$('#dotPageMount');if(el)el.textContent=err.message||'Unable to load dashboard'});
})();