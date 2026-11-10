/* Workforce: read-only staff billing history. No payment actions on void invoices. */
(()=>{'use strict';
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=(v,c='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency:c||'USD'}).format(Number(v||0));
const date=v=>v?new Date(v).toLocaleDateString('en-US'):'—';
let rows=[];
async function api(action,extra={}){
 const result=await dotSupabase.auth.getSession(),token=result.data?.session?.access_token;
 if(!token)throw Error('Staff sign-in required');
 const res=await fetch(DOT_PORTAL_CONFIG.supabaseUrl+'/functions/v1/workforce-inbox-management',{
  method:'POST',headers:{'Content-Type':'application/json',apikey:DOT_PORTAL_CONFIG.supabaseAnonKey,Authorization:'Bearer '+token},body:JSON.stringify({action,...extra}),cache:'no-store'});
 const data=await res.json().catch(()=>({}));if(!res.ok||data.error)throw Error(data.error||'Billing records unavailable');return data;
}
function stateLabel(v){return '<span class="wmb-state '+esc(v)+'">'+esc(String(v||'unknown').toUpperCase())+'</span>';}
function showDetail(id){
 const entry=rows.find(x=>x.id===id);if(!entry)return;
 const panel=$('#wmbDetail');panel.hidden=false;panel.innerHTML='<div class="wmb-detail-head"><h2>Invoice details</h2><button type="button" id="wmbClose" class="wmb-clear">Close</button></div><p>Loading invoice details…</p>';
 $('#wmbClose').onclick=()=>{panel.hidden=true};
 api('invoice_detail',{id}).then(data=>{
 const v=data.invoice;
 panel.innerHTML='<div class="wmb-detail-head"><div><span class="wmd-overline">INVOICE RECORD</span><h2>'+esc(v.invoice_number)+'</h2></div><button type="button" id="wmbClose" class="wmb-clear">Close</button></div>'
 +'<div class="wmb-detail-meta"><p><strong>Customer</strong><span>'+esc(v.customer_name||v.customer_email)+'</span></p><p><strong>Status</strong>'+stateLabel(v.status)+'</p><p><strong>Issued</strong><span>'+date(v.issue_date)+'</span></p><p><strong>Balance due</strong><span>'+cash(v.amount_due,v.currency)+'</span></p></div>'
 +'<div class="wmb-table-wrap"><table class="wmb-table"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>'+(data.items||[]).map(x=>'<tr><td>'+esc(x.description)+'</td><td>'+esc(x.quantity)+'</td><td>'+cash(x.unit_price,v.currency)+'</td><td>'+cash(x.line_total,v.currency)+'</td></tr>').join('')+'</tbody></table></div>'
 +'<div class="wmb-detail-total">Original invoice total: '+cash(v.total,v.currency)+'</div>'
 +'<p class="wmb-detail-note">'+esc(v.status==='void'?'Voided invoice. No payment is due or collectible.':v.terms||'')+'</p>';
 $('#wmbClose').onclick=()=>{panel.hidden=true};
 panel.scrollIntoView({block:'nearest',behavior:'smooth'});
 }).catch(err=>{panel.innerHTML='<p role="alert">'+esc(err.message)+'</p>'});
}
function paint(){
 const query=($('#wmbSearch')?.value||'').trim().toLowerCase(),filter=$('#wmbFilter')?.value||'all';
 const filtered=rows.filter(x=>(filter==='all'||x.status===filter)&&[x.invoice_number,x.customer_name,x.customer_email,x.status].some(v=>String(v||'').toLowerCase().includes(query)));
 $('#wmbCount').textContent=filtered.length+' invoice'+(filtered.length===1?'':'s');
 $('#wmbRows').innerHTML=filtered.length?filtered.map(x=>'<tr><td><strong>'+esc(x.invoice_number)+'</strong><small>'+date(x.issue_date)+'</small></td><td>'+esc(x.customer_name||'Customer')+'<small>'+esc(x.customer_email||'')+'</small></td><td>'+cash(x.total,x.currency)+'</td><td>'+cash(x.amount_due,x.currency)+'</td><td>'+stateLabel(x.status)+'</td><td><button class="wmb-view" type="button" data-invoice="'+esc(x.id)+'">View</button></td></tr>').join(''):'<tr><td colspan="6" class="wmb-empty">No invoices match these filters.</td></tr>';
 $('#wmbRows').querySelectorAll('[data-invoice]').forEach(b=>b.onclick=()=>showDetail(b.dataset.invoice));
}
async function load(){
 $('#wmbStatus').textContent='Loading billing history…';
 try{const r=await api('invoices');rows=r.invoices||[];
  const open=rows.filter(x=>['open','sent','past_due'].includes(x.status));
  $('#wmbTotal').textContent=rows.length;
  $('#wmbOpen').textContent=open.length;
  $('#wmbOutstanding').textContent=cash(open.reduce((s,x)=>s+Number(x.amount_due||0),0));
  $('#wmbVoided').textContent=rows.filter(x=>x.status==='void').length;
  $('#wmbStatus').textContent='Records loaded from the existing Workforce invoice ledger. Voided invoices remain visible for audit.';
  paint();
 }catch(err){$('#wmbStatus').textContent='Unable to load billing history: '+err.message}
}
async function start(){
 const state=await DOTAuth.requireAuth();if(!state)return;DOTShell.render(state);
 const root=$('#dotPageMount');if(!root)return;root.classList.add('wmd-root');
 root.innerHTML='<section class="wmd-dashboard wmb-dashboard"><header class="wmb-intro"><div><span class="wmd-overline">WORKFORCE / FINANCE</span><h1>Billing & Invoices</h1><p>Find customer invoices, review payment status and retain voided records for a complete audit trail.</p></div><button id="wmbRefresh" class="wmd-refresh" type="button">Refresh Records</button></header>'
 +'<div class="wmb-stats"><article><span>Total invoices</span><strong id="wmbTotal">—</strong></article><article><span>Awaiting payment</span><strong id="wmbOpen">—</strong></article><article><span>Outstanding balance</span><strong id="wmbOutstanding">—</strong></article><article><span>Voided invoices</span><strong id="wmbVoided">—</strong></article></div>'
 +'<section class="wmb-directory"><div class="wmb-directory-head"><div><h2>Invoice Directory</h2><p id="wmbStatus" role="status">Loading billing history…</p></div><strong id="wmbCount"></strong></div><div class="wmb-toolbar"><input id="wmbSearch" type="search" placeholder="Search invoice number, name or email" aria-label="Search invoices"><select id="wmbFilter" aria-label="Filter invoice status"><option value="all">All statuses</option><option value="open">Open</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="void">Void</option><option value="draft">Draft</option></select></div><div class="wmb-table-wrap"><table class="wmb-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Total</th><th>Balance due</th><th>Status</th><th>Action</th></tr></thead><tbody id="wmbRows"></tbody></table></div></section><section id="wmbDetail" class="wmb-directory wmb-detail" hidden></section></section>';
 $('#wmbSearch').oninput=paint;$('#wmbFilter').onchange=paint;$('#wmbRefresh').onclick=load;
 await load();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(console.error),{once:true});else start().catch(console.error);
})();