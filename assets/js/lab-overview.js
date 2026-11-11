(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v??'').trim().toLowerCase();
const fmt=v=>v?new Date(v).toLocaleDateString():'—';
const invoke=async(fn,body)=>{const {data,error}=await dotSupabase.functions.invoke(fn,{body});if(error||data?.error)throw Error(data?.error||error?.message||'Unable to load');return data};
async function start(){
const state=await DOTAuth.requireAuth();if(!state)return;DOTShell.render(state);
const root=document.getElementById('dotPageMount');if(!root)return;
root.innerHTML='<section class="dot-page wf-lab-overview"><header class="dot-page-head"><div><span class="dot-eyebrow">WORKFORCE MANAGEMENT · READ ONLY</span><h1>Testing & Lab Account Overview</h1><p>Operational visibility across drug and alcohol testing and laboratory accounts. Changes are managed only in the Testing Portal.</p></div></header><div class="wf-lab-actions"><a class="dot-btn primary" href="https://testing-portal.screenings4u.com/dashboard.html" target="_blank" rel="noopener">Open Testing Management</a></div><div id="wfLabStatus" role="status">Loading live laboratory records…</div><div id="wfLabMetrics" class="dot-metrics"></div><div class="dot-card"><div class="dot-card-head"><h2>Purchased Lab Accounts</h2><p>View only. No account edits, onboarding approvals, shipment changes, or laboratory number changes are available here.</p></div><div class="wf-lab-filters"><label for="wfLabSearch">Search companies</label><input id="wfLabSearch" type="search" placeholder="Company, email, or order"></div><div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Company / Email</th><th>Order</th><th>Purchase</th><th>Account status</th><th>Intake status</th></tr></thead><tbody id="wfLabRows"></tbody></table></div></div></section>';
const status=document.getElementById('wfLabStatus'),metrics=document.getElementById('wfLabMetrics'),rows=document.getElementById('wfLabRows');
try{
const [pr,lr,fr]=await Promise.allSettled([
invoke('enterprise-forms-management',{action:'lab_account_purchases'}),
invoke('house-lab-fulfillment-management',{action:'list'}),
invoke('enterprise-forms-management',{action:'submissions'})]);
if(pr.status!=='fulfilled')throw pr.reason;
const p=pr.value.purchases||[];
const active=p.filter(x=>norm(x.account_status)==='active').length;
const ships=lr.status==='fulfilled'?(lr.value.shipments||[]):[];
const intakes=fr.status==='fulfilled'?(fr.value.submissions||[]).filter(x=>['lab_account_intake','lab_account_intake_standalone'].includes(x.form_key)):[];
metrics.innerHTML=[['Lab purchases',p.length],['Active accounts',active],['Supply / tracking records',lr.status==='fulfilled'?ships.length:'Unavailable'],['Intakes',fr.status==='fulfilled'?intakes.length:'Unavailable']].map(([name,value])=>'<article class="dot-metric"><span>'+esc(name)+'</span><strong>'+esc(value)+'</strong></article>').join('');
status.textContent=(lr.status==='fulfilled'&&fr.status==='fulfilled')?'Live records · Read-only overview':'Partial live data. Some sources are currently unavailable.';
const search=document.getElementById('wfLabSearch');
const draw=()=>{const q=norm(search.value);const matches=p.filter(x=>!q||[x.customer_email,x.order_number,x.intake_data?.legal_business_name,x.intake_data?.company_name].some(v=>norm(v).includes(q)));rows.innerHTML=matches.map(x=>'<tr><td><strong>'+esc(x.intake_data?.legal_business_name||x.intake_data?.company_name||x.customer_email||'Company')+'</strong><small>'+esc(x.customer_email)+'</small></td><td>'+esc(x.order_number||'—')+'</td><td>'+esc(fmt(x.created_at))+'</td><td>'+esc(x.account_status||'pending')+'</td><td>'+esc(x.status||'pending')+'</td></tr>').join('')||'<tr><td colspan="5">No matching companies.</td></tr>'};search.addEventListener('input',draw);draw();
}catch(e){status.textContent='Unable to load lab overview: '+String(e?.message||e)}
}
addEventListener('DOMContentLoaded',()=>start().catch(console.error),{once:true});
})();