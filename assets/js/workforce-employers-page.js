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
 const sub=r.organizations?.dba_name||r.dba_name||'',group=r.ctpa_id?'C/TPA sponsored':'Direct';
 return '<tr><td><strong>'+esc(name)+'</strong>'+(sub&&sub!==name?'<small>'+esc(sub)+'</small>':'')+'</td><td>'+esc(email)+'</td><td>'+esc(group)+'</td><td><span class="wmb-state '+esc(r.status||'')+'">'+esc(r.status||'Unknown')+'</span></td><td><a class="wmb-view" href="workforce-record.html?module=employer&id='+encodeURIComponent(r.id)+'">Manage</a></td></tr>';
 }).join(''):'<tr><td class="wmb-empty" colspan="5">No employer accounts match your filters.</td></tr>';
 $('#wfAll').textContent=records.length;$('#wfActive').textContent=records.filter(x=>String(x.status||'').toLowerCase()==='active').length;
 $('#wfDirect').textContent=records.filter(x=>!x.ctpa_id).length;$('#wfSponsored').textContent=records.filter(x=>!!x.ctpa_id).length;
}
async function load(){
 $('#wfEmployerMessage').textContent='Loading employers…';
 try{const result=await WorkforceManagementApi.read('employers');records=Array.isArray(result.employers)?result.employers:[];
 view();$('#wfEmployerMessage').textContent='Employer records are loaded from the existing Workforce management database.'}
 catch(e){$('#wfEmployerMessage').textContent='Unable to load employers: '+e.message}
}
async function main(){
 const staff=await DOTAuth.requireAuth();if(!staff)return;DOTShell.render(staff);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wmd-root');
 root.innerHTML='<section class="wmd-dashboard wmb-dashboard"><header class="wmb-intro"><div><span class="wmd-overline">WORKFORCE / PEOPLE & ORGANIZATIONS</span><h1>Employer Management</h1><p>Manage direct employers and C/TPA-sponsored organizations, their contacts and account status.</p></div><div style="display:flex;flex-wrap:wrap;gap:10px"><a class="wmd-refresh" href="workforce-record.html?module=employer&mode=new">+ Create Employer</a><button class="wmb-clear" id="wfEmployerRefresh" type="button">Refresh</button></div></header>'
 +'<div class="wmb-stats"><article><span>Employer accounts</span><strong id="wfAll">—</strong></article><article><span>Active accounts</span><strong id="wfActive">—</strong></article><article><span>Direct employers</span><strong id="wfDirect">—</strong></article><article><span>C/TPA sponsored</span><strong id="wfSponsored">—</strong></article></div>'
 +'<section class="wmb-directory"><div class="wmb-directory-head"><div><h2>Employer Directory</h2><p id="wfEmployerMessage" role="status">Loading records…</p></div><strong id="wfEmployerCount"></strong></div>'
 +'<div class="wmb-toolbar"><input type="search" id="wfEmployerSearch" aria-label="Search employers" placeholder="Search employer, contact email or organization"><select id="wfEmployerType" aria-label="Employer type"><option value="all">All employer types</option><option value="direct">Direct Employers</option><option value="sponsored">C/TPA Sponsored</option></select><select id="wfEmployerStatus" aria-label="Employer status"><option value="all">All statuses</option><option value="active">Active</option><option value="onboarding">Onboarding</option><option value="inactive">Inactive</option></select></div>'
 +'<div class="wmb-table-wrap"><table class="wmb-table"><thead><tr><th>Employer</th><th>Primary Contact</th><th>Account Type</th><th>Status</th><th>Management</th></tr></thead><tbody id="wfEmployerRows"></tbody></table></div></section></section>';
 $('#wfEmployerSearch').oninput=view;$('#wfEmployerType').onchange=view;$('#wfEmployerStatus').onchange=view;$('#wfEmployerRefresh').onclick=load;
 await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>main().catch(console.error),{once:true});else main().catch(console.error);
})();