/* Workforce Compliance Management — one page controller, existing NON-DOT API */
(()=>{'use strict';
const $=(selector,root=document)=>root.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const safeClass=value=>String(value||'unknown').toLowerCase().replace(/[^a-z0-9_-]/g,'');
let records=[];
function render(){
 const page=$('#wcPage');if(!page||!page.isConnected)return;
 const search=($('#wcSearch',page)?.value||'').trim().toLowerCase();
 const status=$('#wcStatus',page)?.value||'all';
 const priority=$('#wcPriority',page)?.value||'all';
 const rows=records.filter(item=>(status==='all'||String(item.status||'').toLowerCase()===status)&&(priority==='all'||String(item.priority||'').toLowerCase()===priority)&&(!search||[item.case_number,item.id,item.summary,item.priority,item.status,item.employer_id].some(value=>String(value??'').toLowerCase().includes(search))));
 const set=(id,value)=>{const target=$('#'+id,page);if(target)target.textContent=String(value)};
 const openStatuses=new Set(['open','active','pending','in_progress','under_review','investigating']);
 const closedStatuses=new Set(['closed','resolved','completed']);
 set('wcTotal',records.length);
 set('wcOpen',records.filter(item=>openStatuses.has(String(item.status||'').toLowerCase())).length);
 set('wcPriorityCount',records.filter(item=>['high','critical','urgent'].includes(String(item.priority||'').toLowerCase())).length);
 set('wcResolved',records.filter(item=>closedStatuses.has(String(item.status||'').toLowerCase())).length);
 set('wcCount',rows.length+' of '+records.length+' cases');
 const body=$('#wcRows',page);if(!body)return;
 if(!rows.length){body.innerHTML='<tr><td colspan="6" class="wc-empty"><strong>No compliance cases found</strong><span>Create a case or adjust your search and filters to see available records.</span></td></tr>';return}
 body.innerHTML=rows.map(item=>{
   const id=String(item.id||''),number=item.case_number||id.slice(0,12)||'Unnumbered case',statusText=String(item.status||'Not set'),priorityText=String(item.priority||'Not set');
   const created=item.created_at?new Date(item.created_at):null,createdText=created&&!Number.isNaN(created.getTime())?created.toLocaleDateString():'—';
   return '<tr><td><div class="wc-case"><span class="wc-case-icon" aria-hidden="true">⚑</span><div><strong>'+escapeHtml(number)+'</strong><small>'+escapeHtml(item.summary||id)+'</small></div></div></td><td>'+escapeHtml(item.employer_name||item.organizations?.legal_name||item.employer_id||'Not assigned')+'</td><td><span class="wc-pill priority-'+safeClass(priorityText)+'">'+escapeHtml(priorityText)+'</span></td><td><span class="wc-pill status-'+safeClass(statusText)+'">'+escapeHtml(statusText.replaceAll('_',' '))+'</span></td><td>'+escapeHtml(createdText)+'</td><td><a class="wc-manage" href="workforce-record.html?module=compliance&id='+encodeURIComponent(id)+'">Manage <span aria-hidden="true">→</span></a></td></tr>';
 }).join('');
}
async function load(){
 const page=$('#wcPage');if(!page)return;const message=$('#wcMessage',page);
 if(message)message.textContent='Loading compliance cases…';
 try{
   const response=await WorkforceManagementApi.read('compliance');
   records=Array.isArray(response.compliance_cases)?response.compliance_cases:[];
   const statuses=[...new Set(records.map(x=>String(x.status||'').toLowerCase()).filter(Boolean))].sort();
   const priorities=[...new Set(records.map(x=>String(x.priority||'').toLowerCase()).filter(Boolean))].sort();
   for(const [id,values,label] of [['wcStatus',statuses,'status'],['wcPriority',priorities,'priority']]){
      const input=$('#'+id,page);if(!input)continue;const prior=input.value;
      input.replaceChildren(new Option('All '+(label==='status'?'statuses':'priorities'),'all'));
      for(const value of values)input.add(new Option(value.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase()),value));
      input.value=values.includes(prior)?prior:'all';
   }
   render();if(message?.isConnected)message.textContent='Review compliance cases, priorities, and corrective actions.';
 }catch(error){records=[];render();if(message?.isConnected)message.textContent='Unable to load compliance cases: '+(error.message||String(error))}
}
async function init(){
 const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wc-root');
 root.innerHTML=`<section class="wc-page" id="wcPage" aria-labelledby="wcTitle">
 <header class="wc-head"><div><span class="wc-eyebrow">WORKFORCE / TESTING &amp; COMPLIANCE</span><h1 id="wcTitle">Compliance Management</h1><p>Manage compliance cases, corrective actions, and follow-up priorities.</p></div><div class="wc-header-actions"><a class="wc-button wc-button-primary" href="workforce-record.html?module=compliance&amp;mode=new">+ Create Case</a><button class="wc-button" id="wcRefresh" type="button">↻ Refresh</button></div></header>
 <section class="wc-stats" aria-label="Compliance overview"><article><span class="wc-stat-icon" aria-hidden="true">▦</span><div><span>Total cases</span><strong id="wcTotal">—</strong><small>All compliance records</small></div></article><article><span class="wc-stat-icon" aria-hidden="true">◷</span><div><span>Open cases</span><strong id="wcOpen">—</strong><small>Require attention</small></div></article><article><span class="wc-stat-icon" aria-hidden="true">!</span><div><span>High priority</span><strong id="wcPriorityCount">—</strong><small>High, urgent, or critical</small></div></article><article><span class="wc-stat-icon" aria-hidden="true">✓</span><div><span>Resolved cases</span><strong id="wcResolved">—</strong><small>Closed or completed</small></div></article></section>
 <section class="wc-directory" aria-labelledby="wcDirectoryTitle"><div class="wc-directory-head"><div><h2 id="wcDirectoryTitle">Compliance Case Directory</h2><p role="status" aria-live="polite" id="wcMessage">Loading compliance cases…</p></div><span id="wcCount" class="wc-count">0 cases</span></div>
 <div class="wc-toolbar"><div class="wc-search"><span aria-hidden="true">⌕</span><input id="wcSearch" type="search" aria-label="Search compliance cases" placeholder="Search case number, employer, or summary"></div><select id="wcStatus" aria-label="Filter by status"><option value="all">All statuses</option></select><select id="wcPriority" aria-label="Filter by priority"><option value="all">All priorities</option></select><button type="button" class="wc-button" id="wcClear">Clear filters</button></div>
 <div class="wc-table-wrap"><table class="wc-table"><thead><tr><th scope="col">Case</th><th scope="col">Employer</th><th scope="col">Priority</th><th scope="col">Status</th><th scope="col">Created</th><th scope="col">Management</th></tr></thead><tbody id="wcRows"><tr><td colspan="6" class="wc-empty">Loading compliance cases…</td></tr></tbody></table></div></section></section>`;
 $('#wcSearch',root).addEventListener('input',render);
 $('#wcStatus',root).addEventListener('change',render);
 $('#wcPriority',root).addEventListener('change',render);
 $('#wcClear',root).addEventListener('click',()=>{$('#wcSearch',root).value='';$('#wcStatus',root).value='all';$('#wcPriority',root).value='all';render()});
 $('#wcRefresh',root).addEventListener('click',load);
 await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error),{once:true});else init().catch(console.error);
})();