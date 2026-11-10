/* Workforce C/TPA Management: dedicated directory powered by existing management API. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records=[];
const nameOf=r=>r.organizations?.legal_name||r.legal_name||'C/TPA';
const emailOf=r=>r.support_email||r.organizations?.support_email||'';
function paint(){
 const q=($('#wfCtpaSearch')?.value||'').trim().toLowerCase(),status=$('#wfCtpaStatus')?.value||'all';
 const filtered=records.filter(r=>(status==='all'||String(r.status||'').toLowerCase()===status)&&[nameOf(r),r.dba_name,r.organizations?.dba_name,emailOf(r),r.id].some(v=>String(v||'').toLowerCase().includes(q)));
 $('#wfCtpaCount').textContent=filtered.length+' of '+records.length+' C/TPAs';
 $('#wfCtpaRows').innerHTML=filtered.length?filtered.map(r=>{
   const name=nameOf(r),email=emailOf(r),initials=name.split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase(),statusText=String(r.status||'Unknown');
   const dba=r.organizations?.dba_name||r.dba_name||'';
   return '<tr><td><div class="wfe-employer"><span class="wfe-avatar" aria-hidden="true">'+esc(initials)+'</span><div class="wfe-employer-name"><strong>'+esc(name)+'</strong>'+(dba&&dba!==name?'<small>'+esc(dba)+'</small>':'')+'</div></div></td><td><span class="wfe-contact">'+esc(email||'Not provided')+'</span></td><td><span class="wmb-state '+esc(statusText.toLowerCase())+'">'+esc(statusText)+'</span></td><td><a class="wmb-view wfe-manage" href="workforce-record.html?module=ctpa&id='+encodeURIComponent(r.id)+'">Manage <span aria-hidden="true">→</span></a></td></tr>'
 }).join(''):'<tr><td class="wmb-empty" colspan="4">No C/TPA accounts match your filters.</td></tr>';
 $('#wfCtpaAll').textContent=records.length;
 $('#wfCtpaActive').textContent=records.filter(r=>String(r.status||'').toLowerCase()==='active').length;
 $('#wfCtpaInactive').textContent=records.filter(r=>String(r.status||'').toLowerCase()==='inactive').length;
 $('#wfCtpaMissing').textContent=records.filter(r=>!emailOf(r).trim()).length;
}
async function load(){
 const msg=$('#wfCtpaMessage');msg.textContent='Loading C/TPA accounts…';
 try{const result=await WorkforceManagementApi.read('ctpas');records=Array.isArray(result.ctpas)?result.ctpas:[];paint();msg.textContent='Search and manage your C/TPA organizations.'}
 catch(e){msg.textContent='Unable to load C/TPAs: '+(e.message||String(e));records=[];paint()}
}
async function main(){
 const staff=await DOTAuth.requireAuth();if(!staff)return;
 DOTShell.render(staff);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wmd-root');
 root.innerHTML=`
 <section class="wmd-dashboard wmb-dashboard wfe-dashboard" aria-label="C/TPA Management">
  <header class="wfe-page-header">
   <div class="wfe-heading-copy"><span class="wmd-overline">WORKFORCE / PEOPLE & ORGANIZATIONS</span><h1>C/TPA Management</h1><p>Manage consortium and third-party administrator accounts, contacts, status, and portal access.</p></div>
   <div class="wfe-page-actions"><a class="wfe-btn wfe-btn-primary" href="workforce-record.html?module=ctpa&amp;mode=new">+ Create C/TPA</a><button class="wfe-btn wfe-btn-secondary" type="button" id="wfCtpaRefresh">↻ Refresh</button></div>
  </header>
  <div class="wmb-stats wfe-metrics" aria-label="C/TPA account summary">
   <article><span class="wfe-metric-icon" aria-hidden="true">▣</span><div><span>Total C/TPAs</span><strong id="wfCtpaAll">—</strong><small>Registered administrators</small></div></article>
   <article><span class="wfe-metric-icon" aria-hidden="true">✓</span><div><span>Active accounts</span><strong id="wfCtpaActive">—</strong><small>Currently enabled</small></div></article>
   <article><span class="wfe-metric-icon" aria-hidden="true">○</span><div><span>Inactive accounts</span><strong id="wfCtpaInactive">—</strong><small>Not currently active</small></div></article>
   <article><span class="wfe-metric-icon" aria-hidden="true">✉</span><div><span>Missing support email</span><strong id="wfCtpaMissing">—</strong><small>Contact details to complete</small></div></article>
  </div>
  <section class="wmb-directory wfe-directory" aria-labelledby="wfCtpaDirectoryTitle">
   <div class="wmb-directory-head"><div><h2 id="wfCtpaDirectoryTitle">C/TPA Directory</h2><p id="wfCtpaMessage" role="status">Loading records…</p></div><span class="wfe-result-count" id="wfCtpaCount">0 accounts</span></div>
   <div class="wmb-toolbar wfe-toolbar"><div class="wfe-search-wrap"><span aria-hidden="true">⌕</span><input id="wfCtpaSearch" type="search" aria-label="Search C/TPA records" placeholder="Search business name, email or account ID"></div>
   <select id="wfCtpaStatus" aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Active</option><option value="onboarding">Onboarding</option><option value="inactive">Inactive</option></select>
   <button class="wfe-btn wfe-reset" id="wfCtpaClear" type="button">Clear filters</button></div>
   <div class="wmb-table-wrap"><table class="wmb-table wfe-table"><thead><tr><th scope="col">C/TPA Organization</th><th scope="col">Support Email</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody id="wfCtpaRows"></tbody></table></div>
  </section>
 </section>`;
 $('#wfCtpaSearch').addEventListener('input',paint);
 $('#wfCtpaStatus').addEventListener('change',paint);
 $('#wfCtpaRefresh').addEventListener('click',load);
 $('#wfCtpaClear').addEventListener('click',()=>{$('#wfCtpaSearch').value='';$('#wfCtpaStatus').value='all';paint()});
 await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>main().catch(console.error),{once:true});else main().catch(console.error);
})();