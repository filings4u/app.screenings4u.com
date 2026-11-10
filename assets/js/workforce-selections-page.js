/* Workforce Random Selection Management: read-only directory and CSV export using existing NON-DOT API. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=v=>{if(!v)return 'Not scheduled';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleDateString()};
let records=[];
function draw(){
 const q=($('#wsSearch')?.value||'').trim().toLowerCase(),state=$('#wsStatus')?.value||'all';
 const filtered=records.filter(r=>(state==='all'||String(r.status||'').toLowerCase()===state)&&[r.id,r.pool_id,r.selection_date,r.status].some(v=>String(v??'').toLowerCase().includes(q)));
 $('#wsCount').textContent=filtered.length+' of '+records.length+' selections';
 $('#wsTotal').textContent=records.length;
 $('#wsDraft').textContent=records.filter(r=>String(r.status).toLowerCase()==='draft').length;
 $('#wsCompleted').textContent=records.filter(r=>String(r.status).toLowerCase()==='completed').length;
 $('#wsLocked').textContent=records.filter(r=>String(r.status).toLowerCase()==='locked').length;
 $('#wsRows').innerHTML=filtered.length?filtered.map(r=>{
 const s=String(r.status||'Unknown'),cls=s.toLowerCase().replace(/[^a-z-]/g,'');
 const id=String(r.id||'');
 return '<tr><td><div class="ws-record"><span class="ws-avatar" aria-hidden="true">▦</span><div><strong>'+esc(id.slice(0,12)||'Selection')+'</strong><small>'+esc(id)+'</small></div></div></td><td>'+esc(r.pool_name||r.pool_id||'Not assigned')+'</td><td>'+esc(date(r.selection_date))+'</td><td><span class="ws-status '+esc(cls)+'">'+esc(s)+'</span></td><td><a class="ws-manage" href="workforce-record.html?module=selection&id='+encodeURIComponent(id)+'">Manage <span aria-hidden="true">→</span></a></td></tr>';
 }).join(''):'<tr><td class="ws-empty" colspan="5"><strong>No selections found</strong><span>There are no records matching the current search and status filters.</span></td></tr>';
}
async function load(){
 $('#wsMessage').textContent='Loading random selection records…';
 try{const data=await WorkforceManagementApi.read('selections');records=Array.isArray(data.selections)?data.selections:[];draw();$('#wsMessage').textContent='Search, review, and manage random selection events.'}
 catch(e){records=[];draw();$('#wsMessage').textContent='Unable to load selection records: '+(e.message||String(e))}
}
function exportCsv(){
 if(!records.length){$('#wsMessage').textContent='No selection records are available to export.';return}
 const keys=[...new Set(records.flatMap(r=>Object.keys(r).filter(k=>typeof r[k]!=='object')))].slice(0,24);
 const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
 const content=[keys.map(quote).join(','),...records.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\r\n');
 const blob=new Blob([content],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='workforce-selections.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function init(){
 const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
 const mount=$('#dotPageMount');if(!mount)return;mount.classList.add('ws-root');
 mount.innerHTML=`<section class="ws-page" aria-label="Random Selection Management">
 <header class="ws-head"><div><span class="ws-overline">WORKFORCE / TESTING & COMPLIANCE</span><h1>Random Selection Management</h1><p>Monitor testing selections, pool assignments, and workflow status.</p></div><div class="ws-actions"><button type="button" class="ws-button ws-export" id="wsExport">Export CSV</button><button type="button" class="ws-button" id="wsRefresh">↻ Refresh</button></div></header>
 <div class="ws-metrics"><article><span class="ws-icon" aria-hidden="true">▦</span><div><span>Total selections</span><strong id="wsTotal">—</strong><small>All selection events</small></div></article><article><span class="ws-icon" aria-hidden="true">◷</span><div><span>Draft selections</span><strong id="wsDraft">—</strong><small>Not yet completed</small></div></article><article><span class="ws-icon" aria-hidden="true">✓</span><div><span>Completed</span><strong id="wsCompleted">—</strong><small>Finalized selections</small></div></article><article><span class="ws-icon" aria-hidden="true">▣</span><div><span>Locked</span><strong id="wsLocked">—</strong><small>Protected records</small></div></article></div>
 <section class="ws-directory" aria-labelledby="wsDirectoryTitle"><div class="ws-directory-head"><div><h2 id="wsDirectoryTitle">Selection Directory</h2><p id="wsMessage" role="status" aria-live="polite">Loading selection records…</p></div><span class="ws-count" id="wsCount">0 selections</span></div>
 <div class="ws-toolbar"><div class="ws-search"><span aria-hidden="true">⌕</span><input id="wsSearch" type="search" aria-label="Search selection records" placeholder="Search selection or pool ID"></div><select id="wsStatus" aria-label="Filter selection status"><option value="all">All statuses</option><option value="draft">Draft</option><option value="completed">Completed</option><option value="locked">Locked</option><option value="cancelled">Cancelled</option></select><button class="ws-button" type="button" id="wsClear">Clear filters</button></div>
 <div class="ws-table-wrap"><table class="ws-table"><thead><tr><th scope="col">Selection</th><th scope="col">Pool</th><th scope="col">Date</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody id="wsRows"></tbody></table></div></section></section>`;
 $('#wsSearch').addEventListener('input',draw);$('#wsStatus').addEventListener('change',draw);
 $('#wsClear').addEventListener('click',()=>{$('#wsSearch').value='';$('#wsStatus').value='all';draw()});
 $('#wsRefresh').addEventListener('click',load);$('#wsExport').addEventListener('click',exportCsv);await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error),{once:true});else init().catch(console.error);
})();