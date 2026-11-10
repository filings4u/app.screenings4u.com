/* Workforce People & Drivers directory powered by existing management API. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let records=[];
const nameOf=r=>[r.first_name,r.last_name].filter(Boolean).join(' ')||'Employee';
const emailOf=r=>r.email||'';
function paint(){
 const q=($('#wfPersonSearch')?.value||'').trim().toLowerCase(),status=$('#wfPersonStatus')?.value||'all';
 const filtered=records.filter(r=>(status==='all'||String(r.employment_status||'').toLowerCase()===status)&&[nameOf(r),r.employee_number,emailOf(r),r.job_title,r.id].some(v=>String(v||'').toLowerCase().includes(q)));
 $('#wfPersonCount').textContent=filtered.length+' of '+records.length+' people';
 $('#wfPersonRows').innerHTML=filtered.length?filtered.map(r=>{
   const name=nameOf(r),initials=[r.first_name,r.last_name].filter(Boolean).map(w=>w[0]).join('').toUpperCase()||'WF',statusText=String(r.employment_status||'Unknown');
   return '<tr><td><div class="wfe-employer"><span class="wfe-avatar" aria-hidden="true">'+esc(initials)+'</span><div class="wfe-employer-name"><strong>'+esc(name)+'</strong>'+(r.employee_number?'<small>Employee #'+esc(r.employee_number)+'</small>':'')+'</div></div></td><td><span class="wfe-contact">'+esc(emailOf(r)||'Not provided')+'</span></td><td><span class="wfe-type">'+esc(r.job_title||r.workforce_worker_type||'—')+'</span></td><td><span class="wmb-state '+esc(statusText.toLowerCase().replaceAll('_','-'))+'">'+esc(statusText.replaceAll('_',' '))+'</span></td><td><a class="wmb-view wfe-manage" href="workforce-record.html?module=person&id='+encodeURIComponent(r.id)+'">Manage <span aria-hidden="true">→</span></a></td></tr>'
 }).join(''):'<tr><td class="wmb-empty" colspan="5">No people match your filters.</td></tr>';
 $('#wfPersonAll').textContent=records.length;
 $('#wfPersonActive').textContent=records.filter(r=>String(r.employment_status||'').toLowerCase()==='active').length;
 $('#wfPersonDrivers').textContent=records.filter(r=>String(r.workforce_worker_type||'').toLowerCase()==='driver').length;
 $('#wfPersonInactive').textContent=records.filter(r=>['terminated','leave_of_absence'].includes(String(r.employment_status||'').toLowerCase())).length;
}
async function load(){
 const msg=$('#wfPersonMessage');msg.textContent='Loading people…';
 try{const result=await WorkforceManagementApi.read('people');records=Array.isArray(result.people)?result.people:[];paint();msg.textContent='Browse employees and drivers across your Workforce accounts.'}
 catch(e){msg.textContent='Unable to load people: '+(e.message||String(e));records=[];paint()}
}
async function main(){
 const staff=await DOTAuth.requireAuth();if(!staff)return;
 DOTShell.render(staff);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wmd-root');
 root.innerHTML=`
 <section class="wmd-dashboard wmb-dashboard wfe-dashboard" aria-label="People and Drivers Management">
  <header class="wfe-page-header">
   <div class="wfe-heading-copy"><span class="wmd-overline">WORKFORCE / PEOPLE & ORGANIZATIONS</span><h1>People & Drivers</h1><p>Manage employee and driver profiles, employment status, and workforce records.</p></div>
   <div class="wfe-page-actions"><a class="wfe-btn wfe-btn-primary" href="workforce-record.html?module=person&amp;mode=new">+ Add Employee</a><button class="wfe-btn wfe-btn-secondary" type="button" id="wfPersonRefresh">↻ Refresh</button></div>
  </header>
  <div class="wmb-stats wfe-metrics" aria-label="People summary">
   <article><span class="wfe-metric-icon" aria-hidden="true">♙</span><div><span>Total people</span><strong id="wfPersonAll">—</strong><small>Employee and driver profiles</small></div></article>
   <article><span class="wfe-metric-icon" aria-hidden="true">✓</span><div><span>Active employees</span><strong id="wfPersonActive">—</strong><small>Currently active records</small></div></article>
   <article><span class="wfe-metric-icon" aria-hidden="true">▤</span><div><span>Drivers</span><strong id="wfPersonDrivers">—</strong><small>Driver-designated profiles</small></div></article>
   <article><span class="wfe-metric-icon" aria-hidden="true">○</span><div><span>Other statuses</span><strong id="wfPersonInactive">—</strong><small>Leave or terminated records</small></div></article>
  </div>
  <section class="wmb-directory wfe-directory" aria-labelledby="wfPersonDirectoryTitle">
   <div class="wmb-directory-head"><div><h2 id="wfPersonDirectoryTitle">People Directory</h2><p id="wfPersonMessage" role="status">Loading records…</p></div><span class="wfe-result-count" id="wfPersonCount">0 people</span></div>
   <div class="wmb-toolbar wfe-toolbar"><div class="wfe-search-wrap"><span aria-hidden="true">⌕</span><input id="wfPersonSearch" type="search" aria-label="Search people" placeholder="Search name, email, job title or employee number"></div>
   <select id="wfPersonStatus" aria-label="Filter by employment status"><option value="all">All statuses</option><option value="active">Active</option><option value="leave_of_absence">On Leave</option><option value="terminated">Terminated</option></select>
   <button class="wfe-btn wfe-reset" id="wfPersonClear" type="button">Clear filters</button></div>
   <div class="wmb-table-wrap"><table class="wmb-table wfe-table"><thead><tr><th scope="col">Employee / Driver</th><th scope="col">Email</th><th scope="col">Role</th><th scope="col">Employment Status</th><th scope="col">Actions</th></tr></thead><tbody id="wfPersonRows"></tbody></table></div>
  </section>
 </section>`;
 $('#wfPersonSearch').addEventListener('input',paint);
 $('#wfPersonStatus').addEventListener('change',paint);
 $('#wfPersonRefresh').addEventListener('click',load);
 $('#wfPersonClear').addEventListener('click',()=>{$('#wfPersonSearch').value='';$('#wfPersonStatus').value='all';paint()});
 await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>main().catch(console.error),{once:true});else main().catch(console.error);
})();