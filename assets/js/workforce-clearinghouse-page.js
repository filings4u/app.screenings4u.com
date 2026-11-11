/* Workforce FMCSA Clearinghouse. Dedicated page controller; no DOT page renderer/router. */
(()=>{
'use strict';
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const text=value=>String(value??'').trim();
const date=value=>{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?text(value):d.toLocaleDateString()};
const el=id=>document.getElementById(id);
let accounts=[];
function badge(status){
 const key=text(status||'not started').toLowerCase(),cls=['registered','complete','completed'].includes(key)?'good':['not started','pending','unknown'].includes(key)?'neutral':'attention';
 return '<span class="ch-status '+cls+'">'+escapeHtml(key.replaceAll('_',' '))+'</span>';
}
function draw(){
 const root=el('chPage');if(!root||!root.isConnected)return;
 const q=text(el('chSearch')?.value).toLowerCase(),type=el('chType')?.value||'',status=el('chStatus')?.value||'';
 const visible=accounts.filter(a=>(!type||a.kind===type)&&(!status||a.status===status)&&(!q||a.search.includes(q)));
 const count=el('chCount');if(count)count.textContent=visible.length+' of '+accounts.length+' accounts';
 const body=el('chRows');if(!body)return;
 body.innerHTML=visible.length?visible.map(a=>'<tr><td><div class="ch-account"><strong>'+escapeHtml(a.name)+'</strong><small>'+escapeHtml(a.subtitle)+'</small></div></td><td>'+badge(a.status)+'</td><td>'+escapeHtml(a.identifier||'—')+'</td><td>'+escapeHtml(a.kind==='employer'?(a.designated?'Yes':'No'):'—')+'</td><td>'+escapeHtml(a.kind==='employer'?(a.queryStatus||'Not recorded'):'Not required')+'</td><td>'+escapeHtml(date(a.annualDue))+'</td></tr>').join(''):'<tr><td colspan="6" class="ch-empty"><strong>No matching Clearinghouse accounts</strong><span>Adjust the search or filters to view other accounts.</span></td></tr>';
}
function setValue(id,value){const target=el(id);if(target)target.textContent=String(value)}
async function load(){
 const info=el('chMessage');if(info)info.textContent='Loading Clearinghouse records…';
 try{
 const result=await DOTApi.call('clearinghouse');
 const tracking=Array.isArray(result.clearinghouse_tracking)?result.clearinghouse_tracking:Array.isArray(result.clearinghouse)?result.clearinghouse:[];
 const ctpas=Array.isArray(result.ctpas)?result.ctpas:[];
 const employers=Array.isArray(result.employers)?result.employers:[];
 const byOrg=new Map(tracking.map(a=>[String(a.organization_id||''),a]));
 const mapped=(kind,item)=>{
  const t=byOrg.get(String(item.organization_id||''))||{};
  const name=kind==='ctpa'?(item.legal_name||item.name||item.company_code||'C/TPA'):(item.legal_name||item.dba_name||'Employer');
  const subtitle=kind==='ctpa'?'C/TPA':item.ctpa_id?'C/TPA Sponsored Employer':'Direct Employer';
  const status=text(t.registration_status||(t.registered?'registered':'not started')).toLowerCase();
  const identifier=t.clearinghouse_account_identifier||'';
  const queryStatus=t.query_plan_status||'';
  return {kind,name,subtitle,status,identifier,designated:t.ctpa_designated===true,queryStatus,annualDue:t.annual_query_due_date,registered:t.registered===true,search:[name,subtitle,status,identifier,queryStatus].join(' ').toLowerCase()};
 };
 accounts=[...ctpas.map(c=>mapped('ctpa',c)),...employers.map(e=>mapped('employer',e))];
 setValue('chTotal',accounts.length);
 setValue('chRegistered',accounts.filter(a=>a.registered||['registered','complete','completed'].includes(a.status)).length);
 setValue('chDesignated',accounts.filter(a=>a.kind==='employer'&&a.designated).length);
 setValue('chAttention',accounts.filter(a=>!['registered','complete','completed','not started'].includes(a.status)).length);
 const statusSelect=el('chStatus'),previous=statusSelect.value;
 statusSelect.replaceChildren(new Option('All registration statuses',''));
 const statuses=[...new Set(accounts.map(a=>a.status))].sort();
 for(const item of statuses)statusSelect.add(new Option(item.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()),item));
 statusSelect.value=statuses.includes(previous)?previous:'';
 if(info)info.textContent='Review registration, designation, query plan status, and annual query due dates.';
 draw();
 }catch(error){
 accounts=[];['chTotal','chRegistered','chDesignated','chAttention'].forEach(id=>setValue(id,'—'));
 draw();if(info)info.textContent='Unable to load Clearinghouse accounts: '+(error.message||String(error));
 }
}
async function init(){
 const staff=await DOTAuth.requireAuth();if(!staff)return;
 DOTShell.render(staff);
 const mount=el('dotPageMount');if(!mount)return;
 mount.classList.add('ch-mount');
 mount.innerHTML=`<section id="chPage" class="ch-page" aria-labelledby="chTitle">
 <header class="ch-heading"><div><span class="ch-kicker">WORKFORCE / TESTING &amp; COMPLIANCE</span><h1 id="chTitle">FMCSA Clearinghouse</h1><p>Track registration, C/TPA designation, query plan status, annual query dates, and account identifiers.</p></div><button id="chRefresh" type="button" class="ch-button">↻ Refresh</button></header>
 <section class="ch-stats" aria-label="Clearinghouse overview"><article><span class="ch-stat-icon">▦</span><div><span>Tracked accounts</span><strong id="chTotal">—</strong><small>C/TPAs and DOT employers</small></div></article><article><span class="ch-stat-icon">✓</span><div><span>Registered</span><strong id="chRegistered">—</strong><small>Registration confirmed</small></div></article><article><span class="ch-stat-icon">◇</span><div><span>C/TPA designated</span><strong id="chDesignated">—</strong><small>Employer designations</small></div></article><article><span class="ch-stat-icon">!</span><div><span>Needs attention</span><strong id="chAttention">—</strong><small>Pending or incomplete setups</small></div></article></section>
 <section class="ch-directory" aria-labelledby="chDirectoryTitle"><div class="ch-directory-head"><div><h2 id="chDirectoryTitle">Clearinghouse Readiness</h2><p id="chMessage" role="status" aria-live="polite">Loading Clearinghouse records…</p><p class="ch-privacy">Internal tracking only. Never enter Clearinghouse passwords or credentials here.</p></div><span class="ch-count" id="chCount">0 accounts</span></div>
 <div class="ch-controls"><div class="ch-search"><span aria-hidden="true">⌕</span><input id="chSearch" aria-label="Search Clearinghouse accounts" type="search" placeholder="Search company, account type, identifier or status"></div><select id="chType" aria-label="Filter account type"><option value="">All account types</option><option value="ctpa">C/TPA</option><option value="employer">Employer</option></select><select id="chStatus" aria-label="Filter registration status"><option value="">All registration statuses</option></select><button type="button" id="chClear" class="ch-button">Clear filters</button></div>
 <div class="ch-table-wrap"><table class="ch-table"><thead><tr><th scope="col">Account</th><th scope="col">Registration</th><th scope="col">Identifier</th><th scope="col">C/TPA Designated</th><th scope="col">Query Plan</th><th scope="col">Annual Query Due</th></tr></thead><tbody id="chRows"></tbody></table></div></section></section>`;
 el('chSearch').addEventListener('input',draw);el('chType').addEventListener('change',draw);el('chStatus').addEventListener('change',draw);
 el('chClear').addEventListener('click',()=>{el('chSearch').value='';el('chType').value='';el('chStatus').value='';draw()});
 el('chRefresh').addEventListener('click',load);
 await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error),{once:true});else init().catch(console.error);
})();