/* Workforce employer directory using authoritative NON-DOT management records. */
(()=>{'use strict';
const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records=[];
function view(){
 const query=($('#wfEmployerSearch')?.value||'').toLowerCase().trim(),status=$('#wfEmployerStatus')?.value||'all',type=$('#wfEmployerType')?.value||'all';
 const visible=records.filter(r=>(status==='all'||String(r.status||'').toLowerCase()===status)&&(type==='all'||(r.ctpa_id?'sponsored':'direct')===type)&&[r.legal_name,r.dba_name,r.organizations?.legal_name,r.organizations?.dba_name,r.primary_contact_email,r.organizations?.primary_email,r.id].some(t=>String(t||'').toLowerCase().includes(query)));
 $('#wfEmployerCount').textContent=visible.length+' of '+records.length+' employers';
 $('#wfEmployerRows').innerHTML=visible.length?visible.map(r=>{
 const name=r.organizations?.legal_name||r.legal_name||'Employer',email=r.primary_contact_email||r.organizations?.primary_email||'Not provided';
 const sub=r.organizations?.dba_name||r.dba_name||'',group=r.ctpa_id?'C/TPA Sponsored':'Direct Employer';
 const initials=name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase();
 const statusLabel=String(r.status||'Unknown');
 return '<tr><td><div class="wfe-employer"><span class="wfe-avatar" aria-hidden="true">'+esc(initials)+'</span><div class="wfe-employer-name"><strong>'+esc(name)+'</strong>'+(sub&&sub!==name?'<small>'+esc(sub)+'</small>':'')+'</div></div></td><td><span class="wfe-contact">'+esc(email)+'</span></td><td><span class="wfe-type">'+esc(group)+'</span></td><td><span class="wmb-state '+esc(statusLabel.toLowerCase())+'">'+esc(statusLabel)+'</span></td><td><a class="wmb-view wfe-manage" href="workforce-record.html?module=employer&id='+encodeURIComponent(r.id)+'">Manage <span aria-hidden="true">→</span></a></td></tr>';
 }).join(''):'<tr><td class="wmb-empty" colspan="5">No employer accounts match your filters.</td></tr>';
 $('#wfAll').textContent=records.length;$('#wfActive').textContent=records.filter(x=>String(x.status||'').toLowerCase()==='active').length;
 $('#wfDirect').textContent=records.filter(x=>!x.ctpa_id).length;$('#wfSponsored').textContent=records.filter(x=>!!x.ctpa_id).length;
}
async function load(){
 $('#wfEmployerMessage').textContent='Loading employers…';
 try{const result=await WorkforceManagementApi.read('employers');records=Array.isArray(result.employers)?result.employers:[];
 view();$('#wfEmployerMessage').textContent='Review and manage all employer accounts.'}
 catch(e){$('#wfEmployerMessage').textContent='Unable to load employers: '+e.message}
}
async function main(){
 const staff=await DOTAuth.requireAuth();if(!staff)return;DOTShell.render(staff);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wmd-root');
 root.innerHTML=`
 <section class="wmd-dashboard wmb-dashboard wfe-dashboard" aria-label="Employer Management">
   <header class="wfe-page-header">
     <div class="wfe-heading-copy">
       <span class="wmd-overline">WORKFORCE / ORGANIZATIONS</span>
       <h1>Employer Management</h1>
       <p>Manage employer accounts, contacts, subscriptions and portal access from one workspace.</p>
     </div>
     <div class="wfe-page-actions">
       <a class="wfe-btn wfe-btn-primary" href="workforce-record.html?module=employer&amp;mode=new">+ Create Employer</a>
       <button class="wfe-btn wfe-btn-secondary" id="wfEmployerRefresh" type="button">↻ Refresh</button>
     </div>
   </header>
   <div class="wmb-stats wfe-metrics" aria-label="Employer account summary">
     <article><span class="wfe-metric-icon" aria-hidden="true">▣</span><div><span>Employer accounts</span><strong id="wfAll">—</strong><small>All registered organizations</small></div></article>
     <article><span class="wfe-metric-icon" aria-hidden="true">✓</span><div><span>Active accounts</span><strong id="wfActive">—</strong><small>Currently active employers</small></div></article>
     <article><span class="wfe-metric-icon" aria-hidden="true">▤</span><div><span>Direct employers</span><strong id="wfDirect">—</strong><small>Independent accounts</small></div></article>
     <article><span class="wfe-metric-icon" aria-hidden="true">◇</span><div><span>C/TPA sponsored</span><strong id="wfSponsored">—</strong><small>Managed through C/TPAs</small></div></article>
   </div>
   <section class="wmb-directory wfe-directory" aria-labelledby="wfe-directory-title">
     <div class="wmb-directory-head">
       <div><h2 id="wfe-directory-title">Employer Directory</h2><p id="wfEmployerMessage" role="status">Loading employer records…</p></div>
       <span id="wfEmployerCount" class="wfe-result-count">0 employers</span>
     </div>
     <div class="wmb-toolbar wfe-toolbar">
       <div class="wfe-search-wrap"><span aria-hidden="true">⌕</span><input type="search" id="wfEmployerSearch" aria-label="Search employers" placeholder="Search organization name, email or record ID"></div>
       <select id="wfEmployerType" aria-label="Employer type"><option value="all">All employer types</option><option value="direct">Direct Employers</option><option value="sponsored">C/TPA Sponsored</option></select>
       <select id="wfEmployerStatus" aria-label="Employer status"><option value="all">All statuses</option><option value="active">Active</option><option value="onboarding">Onboarding</option><option value="inactive">Inactive</option></select>
       <button type="button" id="wfEmployerReset" class="wfe-btn wfe-reset">Clear filters</button>
     </div>
     <div class="wmb-table-wrap"><table class="wmb-table wfe-table"><thead><tr><th scope="col">Employer</th><th scope="col">Primary Contact</th><th scope="col">Account Type</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody id="wfEmployerRows"></tbody></table></div>
   </section>
 </section>`;
 $('#wfEmployerSearch').oninput=view;$('#wfEmployerType').onchange=view;$('#wfEmployerStatus').onchange=view;$('#wfEmployerRefresh').onclick=load;
 $('#wfEmployerReset').onclick=()=>{$('#wfEmployerSearch').value='';$('#wfEmployerType').value='all';$('#wfEmployerStatus').value='all';view()};
 await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>main().catch(console.error),{once:true});else main().catch(console.error);
})();