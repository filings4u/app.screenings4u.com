/* Workforce Pool Management — uses existing NON-DOT management read API. */
(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);let pools=[];
const poolName=p=>p.name||'Unnamed pool';
function renderRows(){
 if(!$('#wpCount')||!$('#wpRows')||!$('#wpTotal')||!$('#wpActive')||!$('#wpInactive')||!$('#wpCtpa'))return;
 const q=($('#wpSearch')?.value||'').trim().toLowerCase(),filter=$('#wpStatus')?.value||'all';
 const shown=pools.filter(p=>(filter==='all'||String(p.status||'').toLowerCase()===filter)&&[p.name,p.id,p.selection_frequency,p.employer_id,p.ctpa_id].some(v=>String(v||'').toLowerCase().includes(q)));
 $('#wpCount').textContent=shown.length+' of '+pools.length+' pools';
 $('#wpTotal').textContent=pools.length;
 $('#wpActive').textContent=pools.filter(p=>String(p.status).toLowerCase()==='active').length;
 $('#wpInactive').textContent=pools.filter(p=>String(p.status).toLowerCase()==='inactive').length;
 $('#wpCtpa').textContent=pools.filter(p=>Boolean(p.ctpa_id)).length;
 $('#wpRows').innerHTML=shown.length?shown.map(p=>{
 const status=String(p.status||'Unknown'),s=status.toLowerCase().replace(/[^a-z-]/g,'');
 const frequency=p.selection_frequency||'Not set';
 return '<tr><td><div class="wp-pool"><span class="wp-avatar" aria-hidden="true">◉</span><div><strong>'+esc(poolName(p))+'</strong><small>'+esc(p.id||'')+'</small></div></div></td><td>'+esc(p.ctpa_id?'C/TPA managed':'Employer pool')+'</td><td>'+esc(frequency)+'</td><td><span class="wp-status '+esc(s)+'">'+esc(status)+'</span></td><td><a class="wp-manage" href="workforce-edit.html?module=pool&id='+encodeURIComponent(p.id)+'">Manage <span aria-hidden="true">→</span></a></td></tr>';
 }).join(''):'<tr><td class="wp-empty" colspan="5"><strong>No matching pools</strong><span>Create your first pool or clear your filters to see available records.</span></td></tr>';
}
async function load(){
 const message=$('#wpMessage');if(!message)return;
 message.textContent='Loading pool records…';
 try{const result=await WorkforceManagementApi.read('pools');pools=Array.isArray(result.pools)?result.pools:[];renderRows();if(message.isConnected)message.textContent='Search and manage testing pools and program membership.'}
 catch(e){pools=[];renderRows();if(message.isConnected)message.textContent='Unable to load pools: '+(e.message||String(e));}
}
async function init(){
 const staff=await DOTAuth.requireAuth();if(!staff)return;DOTShell.render(staff);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wp-root');
 root.innerHTML=`<section class="wp-page" aria-label="Pool Management">
 <header class="wp-head"><div><span class="wp-overline">WORKFORCE / PEOPLE & PROGRAMS</span><h1>Pool Management</h1><p>Manage testing pools, C/TPA relationships, and selection schedules.</p></div>
 <div class="wp-actions"><a class="wp-button wp-primary" href="workforce-edit.html?module=pool">+ Create Pool</a><button type="button" class="wp-button" id="wpRefresh">↻ Refresh</button></div></header>
 <div class="wp-metrics" aria-label="Pool overview"><article><span class="wp-icon" aria-hidden="true">▦</span><div><span>Total pools</span><strong id="wpTotal">—</strong><small>Configured testing pools</small></div></article><article><span class="wp-icon" aria-hidden="true">✓</span><div><span>Active pools</span><strong id="wpActive">—</strong><small>Currently enabled</small></div></article><article><span class="wp-icon" aria-hidden="true">○</span><div><span>Inactive pools</span><strong id="wpInactive">—</strong><small>Not currently enabled</small></div></article><article><span class="wp-icon" aria-hidden="true">◇</span><div><span>C/TPA managed</span><strong id="wpCtpa">—</strong><small>Pools linked to C/TPAs</small></div></article></div>
 <section class="wp-directory" aria-labelledby="wpDirectoryTitle"><div class="wp-directory-head"><div><h2 id="wpDirectoryTitle">Pool Directory</h2><p id="wpMessage" role="status">Loading pool records…</p></div><span class="wp-count" id="wpCount">0 pools</span></div>
 <div class="wp-toolbar"><div class="wp-search"><span aria-hidden="true">⌕</span><input id="wpSearch" type="search" aria-label="Search pools" placeholder="Search pool names, frequency or record IDs"></div><select id="wpStatus" aria-label="Filter by pool status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select><button class="wp-button" type="button" id="wpClear">Clear filters</button></div>
 <div class="wp-table-wrap"><table class="wp-table"><thead><tr><th scope="col">Pool</th><th scope="col">Pool Type</th><th scope="col">Selection Frequency</th><th scope="col">Status</th><th scope="col">Management</th></tr></thead><tbody id="wpRows"></tbody></table></div></section></section>`;
 $('#wpSearch').addEventListener('input',renderRows);$('#wpStatus').addEventListener('change',renderRows);
 $('#wpClear').addEventListener('click',()=>{$('#wpSearch').value='';$('#wpStatus').value='all';renderRows()});
 $('#wpRefresh').addEventListener('click',load);await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error),{once:true});else init().catch(console.error);
})();