/* Workforce Control Center: landing page, shares the single management shell. */
(()=>{'use strict';
const $=selector=>document.querySelector(selector);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconMap={request:'✉',invoice:'▤',lab:'✚',website:'▧',pricing:'$',access:'◇'};
const cards=[
 {title:'Customer Requests',tag:'CUSTOMER ACTIVITY',desc:'New inquiries, support tickets, supply orders and contractor submissions.',url:'workforce-inbox.html',icon:'request'},
 {title:'Billing & Invoices',tag:'FINANCE',desc:'View customer invoices, balances and voided billing history.',url:'workforce-billing.html',icon:'invoice'},
 {title:'Lab Account & Supplies',tag:'LAB OPERATIONS',desc:'Manage laboratory accounts, supply requests and fulfillment.',url:'lab-supplies.html',icon:'lab'},
 {title:'Website & Content',tag:'DIGITAL EXPERIENCE',desc:'Manage pages, resources, content and connected websites.',url:'workforce-website.html',icon:'website'},
 {title:'Checkout Prices',tag:'PRICING',desc:'Maintain checkout offerings and active subscriptions.',url:'workforce-checkout-plans.html',icon:'pricing'},
 {title:'Portal Access',tag:'PORTAL CONTROL',desc:'Manage customers, organizations and portal permissions.',url:'workforce-portal-control.html',icon:'access'}
];
const portals=[
 ['C/TPA','workforce-ctpas.html','Compliance and client accounts'],
 ['Employers','workforce-employers.html','Companies and employees'],
 ['Owner-Operators','dot-owner-operators.html','DOT compliance and records'],
 ['Independent Contractors','ic-contractors.html','Agreements and work orders'],
 ['DOT Agencies','dot-portal-control.html','Regulatory workspaces'],
 ['Customer Access','workforce-portal-control.html','User and role assignments']
];
const shortcuts=[
 ['Supply Requests','ic-supply-management.html'],
 ['Lab Support','workforce-lab-support.html'],
 ['Services & Orders','workforce-services.html'],
 ['Subscriptions','subscription-management.html?workspace=workforce'],
 ['Notifications','workforce-notifications.html'],
 ['Customer 360','global-customer-360.html?workspace=workforce']
];
function metric(label,value,desc,href){
 return '<a href="'+esc(href)+'" class="wmd-metric"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(desc)+'</small><span class="wmd-metric-arrow" aria-hidden="true">↗</span></a>';
}
async function getSummary(){
 const {data,error}=await dotSupabase.auth.getSession();
 if(error||!data.session?.access_token)throw Error('Staff sign-in required');
 const headers={'Content-Type':'application/json',apikey:DOT_PORTAL_CONFIG.supabaseAnonKey,Authorization:'Bearer '+data.session.access_token};
 const url=DOT_PORTAL_CONFIG.supabaseUrl+'/functions/v1/nondot-management-read';
 const call=async action=>{const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({action}),cache:'no-store'});const result=await res.json().catch(()=>({}));if(!res.ok||result.error)throw Error(result.error||'Data unavailable');return result;};
 return Promise.allSettled([call('overview'),call('workforce_portal_network')]);
}
function render(root){
 root.innerHTML='<section class="wmd-dashboard">'
 +'<section class="wmd-hero"><div class="wmd-hero-content"><span class="wmd-eyebrow">WORKFORCE / MANAGEMENT</span><h1>One workspace.<br>Every operation.</h1><p>Manage customers, testing programs, lab supplies, billing, and connected Workforce portals from one place.</p><div class="wmd-hero-buttons"><a href="workforce-inbox.html" class="wmd-primary">Review Requests <span aria-hidden="true">→</span></a><a href="workforce-billing.html" class="wmd-outline">Billing & Invoices <span aria-hidden="true">→</span></a></div></div><div class="wmd-hero-aside"><span>YOUR WORKSPACE</span><strong>Workforce<br>Control Center</strong><small>Secure management workspace</small></div></section>'
 +'<header class="wmd-section-head"><div><span class="wmd-overline">PLATFORM OVERVIEW</span><h2>Operations at a glance</h2></div><button id="wmdRefresh" type="button" class="wmd-refresh">Refresh Data</button></header>'
 +'<div class="wmd-metrics" id="wmdMetrics" aria-live="polite">'+metric('C/TPA Accounts','—','Loading data','workforce-ctpas.html')+metric('Employers','—','Loading data','workforce-employers.html')+metric('People & Drivers','—','Loading data','workforce-people.html')+metric('Connected Portals','—','Loading data','workforce-portal-control.html')+'</div>'
 +'<header class="wmd-section-head"><div><span class="wmd-overline">WORKSPACE DIRECTORY</span><h2>Manage your business</h2></div><a class="wmd-text-link" href="workforce-inbox.html">View customer requests →</a></header>'
 +'<div class="wmd-actions">'+cards.map(c=>'<a class="wmd-action" href="'+esc(c.url)+'"><span class="wmd-action-symbol" aria-hidden="true">'+esc(iconMap[c.icon])+'</span><div class="wmd-action-content"><span class="wmd-action-tag">'+esc(c.tag)+'</span><strong>'+esc(c.title)+'</strong><p>'+esc(c.desc)+'</p></div><span class="wmd-action-arrow" aria-hidden="true">↗</span></a>').join('')+'</div>'
 +'<div class="wmd-bottom"><section class="wmd-portal-panel"><header class="wmd-section-head"><div><span class="wmd-overline">CONNECTED WORKSPACES</span><h2>Customer & regulatory portals</h2></div><a class="wmd-text-link" href="workforce-portal-control.html">All portals →</a></header><div class="wmd-portal-list">'+portals.map(([name,url,desc])=>'<a class="wmd-portal-row" href="'+esc(url)+'"><span class="wmd-portal-dot" aria-hidden="true"></span><span class="wmd-portal-name"><strong>'+esc(name)+'</strong><small>'+esc(desc)+'</small></span><span aria-hidden="true">↗</span></a>').join('')+'</div></section>'
 +'<section class="wmd-sidebar-panel"><span class="wmd-overline">QUICK ACCESS</span><h2>Frequently used tools</h2><p>Jump to the teams and records you use most.</p><div class="wmd-shortcuts">'+shortcuts.map(([name,url])=>'<a href="'+esc(url)+'">'+esc(name)+' <span aria-hidden="true">→</span></a>').join('')+'</div></section></div>'
 +'<p id="wmdStatus" class="wmd-status" role="status">Loading live management totals…</p></section>';
}
async function start(){
 const state=await DOTAuth.requireAuth();if(!state)return;DOTShell.render(state);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wmd-root');render(root);
 async function reload(){
  const button=$('#wmdRefresh'),status=$('#wmdStatus');button.disabled=true;status.textContent='Refreshing live totals…';
  try{
   const result=await getSummary();
   const overview=result[0].status==='fulfilled'?result[0].value.metrics:null;
   const network=result[1].status==='fulfilled'?result[1].value:null;
   const domains=new Set([...(network?.managed_surfaces||[]).map(x=>x.hostname),...(network?.customer_portals||[]).map(x=>x.hostname),...(network?.agency_portals||[]).map(x=>x.domain)].filter(Boolean));
   $('#wmdMetrics').innerHTML=[
    metric('C/TPA Accounts',overview?.ctpas??'—','Managed accounts','workforce-ctpas.html'),
    metric('Employers',overview?.employers??'—','Organizations','workforce-employers.html'),
    metric('People & Drivers',overview?.employees??'—','Workforce records','workforce-people.html'),
    metric('Connected Portals',network?domains.size:'—','Customer and agency portals','workforce-portal-control.html')
   ].join('');
   status.textContent=!overview||!network?'Some live totals are unavailable. Management links remain accessible.':'Live management totals loaded successfully.';
  }catch(err){status.textContent='Unable to load totals: '+(err.message||'Please try again.');}finally{button.disabled=false;}
 }
 $('#wmdRefresh').onclick=reload;await reload();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(err=>{const el=$('#dotPageMount');if(el)el.textContent=err.message||'Unable to load dashboard';}),{once:true});else start().catch(err=>{const el=$('#dotPageMount');if(el)el.textContent=err.message||'Unable to load dashboard';});
})();