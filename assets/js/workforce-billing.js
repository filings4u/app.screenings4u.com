/* Workforce unified invoice workspace: DOT and general ledgers, no cross-ledger mutations. */
(()=>{'use strict';
const $=(s)=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>Number(v||0).toLocaleString('en-US',{style:'currency',currency:'USD'});
const day=v=>v?String(v).slice(0,10):'—';
const clients={general:[],dot:[],ctpas:[],direct_employers:[],owner_operators:[]};
let active=null,editing=false;
async function api(ledger,action,extra={}){
 const sess=await dotSupabase.auth.getSession(),token=sess.data?.session?.access_token;
 if(!token)throw Error('Workforce management sign-in is required.');
 const fn=ledger==='dot'?'dot-invoice-admin':'workforce-inbox-management';
 const response=await fetch(DOT_PORTAL_CONFIG.supabaseUrl+'/functions/v1/'+fn,{
 method:'POST',headers:{apikey:DOT_PORTAL_CONFIG.supabaseAnonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},
 body:JSON.stringify({action,...extra}),cache:'no-store'});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.error)throw Error(typeof data.error==='string'?data.error:data.error?.message||'Billing request could not be completed.');
 return data;
}
function msg(value,bad=false){const el=$('#billingMessage');if(el){el.textContent=value||'';el.style.color=bad?'#b42318':'#204772';el.setAttribute('role',bad?'alert':'status')}}
function badge(status){return '<span class="wmb-state '+esc(status||'draft')+'">'+esc(String(status||'draft').toUpperCase())+'</span>'}
function normalized(){
 return [...clients.general.map(v=>({ledger:'general',...v})),...clients.dot.map(v=>({ledger:'dot',...v,customer_email:v.recipient_email,customer_name:v.customer_name||v.recipient_name,issue_date:v.issued_at||v.created_at,due_date:v.due_at}))].sort((a,b)=>String(b.created_at||b.issue_date).localeCompare(String(a.created_at||a.issue_date)));
}
function paint(){
 const q=($('#billSearch')?.value||'').trim().toLowerCase(),source=$('#billLedger')?.value||'all',status=$('#billStatus')?.value||'all';
 const rows=normalized(),list=rows.filter(x=>(source==='all'||source===x.ledger)&&(status==='all'||status===x.status)&&[x.invoice_number,x.customer_name,x.customer_email,x.invoice_title,x.status].some(v=>String(v||'').toLowerCase().includes(q)));
 $('#billCount').textContent=list.length+' of '+rows.length+' invoices';
 $('#billRows').innerHTML=list.length?list.map(x=>'<tr><td><strong>'+esc(x.invoice_number)+'</strong><small>'+day(x.issue_date)+'</small></td><td>'+esc(x.customer_name||'Customer')+'<small>'+esc(x.customer_email||'')+'</small></td><td>'+esc(x.ledger==='dot'?'DOT':'Workforce')+'</td><td>'+money(x.total)+'</td><td>'+money(x.amount_due)+'</td><td>'+badge(x.status)+'</td><td><button type="button" class="wmb-view" data-ledger="'+x.ledger+'" data-id="'+esc(x.id)+'">View & Manage</button></td></tr>').join(''):'<tr><td colspan="7" class="wmb-empty">No invoices match your filters.</td></tr>';
 $('#billRows').querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>detail(b.dataset.ledger,b.dataset.id));
 const open=rows.filter(x=>['draft','open','sent','past_due'].includes(x.status)&&Number(x.amount_due)>0);
 $('#billTotal').textContent=rows.length;$('#billOpen').textContent=open.length;
 $('#billDue').textContent=money(open.reduce((n,x)=>n+Number(x.amount_due||0),0));
 $('#billPaid').textContent=rows.filter(x=>x.status==='paid').length;
 $('#billVoid').textContent=rows.filter(x=>x.status==='void').length;
}
async function reload(){
 msg('Loading both invoice ledgers…');
 const results=await Promise.allSettled([api('general','invoices'),api('dot','list')]);
 if(results[0].status==='fulfilled')clients.general=results[0].value.invoices||[];
 if(results[1].status==='fulfilled'){
  const d=results[1].value;clients.dot=d.invoices||[];clients.ctpas=d.ctpas||[];
  clients.direct_employers=d.direct_employers||[];clients.owner_operators=d.owner_operators||[];
 }
 paint();
 const errors=results.map((r,i)=>r.status==='rejected'?(i?'DOT':'Workforce')+': '+r.reason.message:null).filter(Boolean);
 msg(errors.length?'Some ledgers could not load. '+errors.join(' | '):'Both ledgers loaded. Historical records and voided invoices are preserved.',!!errors.length);
}
function itemHtml(x={}){
 const qty=x.quantity??1,rate=x.unit_price??x.unit_amount??0;
 return '<div class="bill-line" style="display:grid;grid-template-columns:minmax(0,3fr) 85px 130px auto;gap:9px;margin:9px 0;align-items:center"><input aria-label="Line description" class="bill-desc" placeholder="Service or product" value="'+esc(x.description||'')+'"><input aria-label="Quantity" class="bill-qty" type="number" min="0.01" step="0.01" value="'+esc(qty)+'"><input aria-label="Unit price" class="bill-rate" type="number" min="0" step=".01" value="'+esc(rate)+'"><button type="button" class="wmb-clear bill-remove">Remove</button></div>';
}
function fields(inv={},ledger='general'){
 const isDot=ledger==='dot',isEdit=!!inv.id;
 const type=inv.customer_type||'ctpa',customerId=inv.ctpa_id||inv.employer_id||inv.owner_operator_id||inv.metadata?.customer_id||'';
 const lines=inv.invoice_items||inv.items||[{}];
 return '<div class="wmb-detail-head"><h2>'+esc(isEdit?'Edit '+inv.invoice_number:'Create Workforce Invoice')+'</h2><button class="wmb-clear" id="billClose">Close</button></div>'
 +'<form id="billForm" style="padding:5px 0 16px"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:15px;margin:15px 0">'
 +(!isEdit?'<label>Invoice category<select id="billMode"><option value="general" '+(!isDot?'selected':'')+'>Workforce / General</option><option value="dot" '+(isDot?'selected':'')+'>DOT Customer</option></select></label>':'')
 +(isDot?'<label>Customer type<select id="billType"><option value="ctpa" '+(type==='ctpa'?'selected':'')+'>C/TPA</option><option value="employer" '+(type==='employer'?'selected':'')+'>Employer</option><option value="owner_operator" '+(type==='owner_operator'?'selected':'')+'>Owner-Operator</option></select></label><label>Customer<select id="billCustomer"></select></label><label>Invoice title<input id="billTitle" value="'+esc(inv.invoice_title||'Workforce Invoice')+'"></label>':'')
 +'<label>Customer name<input id="billName" required value="'+esc(inv.customer_name||inv.recipient_name||'')+'"></label><label>Customer email<input id="billEmail" type="email" required value="'+esc(inv.customer_email||inv.recipient_email||'')+'"></label><label>Due date<input id="billDueDate" type="date" value="'+esc(day(inv.due_date||inv.due_at).replace('—',''))+'"></label></div>'
 +'<h3>Line Items</h3><div id="billLines">'+lines.map(itemHtml).join('')+'</div><button class="wmb-clear" type="button" id="billAdd">+ Add Line Item</button>'
 +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin:20px 0"><label>Tax<input id="billTax" type="number" step=".01" min="0" value="'+esc(inv.tax_total??inv.tax??0)+'"></label><label>Discount / Credits<input id="billDiscount" type="number" step=".01" min="0" value="'+esc(inv.discount_total??inv.credits??0)+'"></label><div><span style="font-size:12px;color:#49647d">Calculated invoice total</span><strong id="billCalculated" style="display:block;font-size:24px">'+money(inv.total||0)+'</strong></div></div>'
 +'<label>Payment terms<input id="billTerms" value="'+esc(inv.terms||inv.payment_terms||'Due on receipt')+'"></label><label style="display:block;margin:12px 0">Notes<textarea id="billNotes" rows="3">'+esc(inv.notes||'')+'</textarea></label>'
 +'<p id="billFormMessage" role="status"></p><button type="submit" class="wmd-refresh" id="billSave">Save Invoice</button> <button class="wmb-clear" id="billCancel" type="button">Cancel</button></form>';
}
function dotCustomers(type){return type==='ctpa'?clients.ctpas:type==='employer'?clients.direct_employers:clients.owner_operators}
function selectDotCustomer(id=''){
 const type=$('#billType')?.value,sel=$('#billCustomer');if(!sel)return;
 sel.innerHTML='<option value="">Select an existing customer</option>'+dotCustomers(type).map(c=>{const name=c.organization?.dba_name||c.organization?.legal_name||c.dba_name||c.legal_name||c.company_code||c.id;return '<option value="'+esc(c.id)+'" '+(id===c.id?'selected':'')+'>'+esc(name)+'</option>'}).join('');
}
function wireForm(inv={},ledger='general'){
 const panel=$('#billDetail');panel.hidden=false;panel.innerHTML=fields(inv,ledger);panel.scrollIntoView({behavior:'smooth',block:'start'});
 $('#billClose').onclick=$('#billCancel').onclick=()=>{panel.hidden=true};
 if($('#billMode'))$('#billMode').onchange=()=>wireForm({},$('#billMode').value);
 if(ledger==='dot'){selectDotCustomer(inv.metadata?.customer_id||inv.ctpa_id||inv.employer_id||inv.owner_operator_id||'');$('#billType').onchange=()=>selectDotCustomer()}
 const updateTotal=()=>{let total=0;panel.querySelectorAll('.bill-line').forEach(el=>{total+=Number(el.querySelector('.bill-qty').value||0)*Number(el.querySelector('.bill-rate').value||0)});total+=Number($('#billTax').value||0)-Number($('#billDiscount').value||0);$('#billCalculated').textContent=money(total)};
 const wire=()=>{panel.querySelectorAll('.bill-line').forEach(el=>{el.querySelector('.bill-remove').onclick=()=>{if(panel.querySelectorAll('.bill-line').length>1)el.remove();updateTotal()};el.querySelectorAll('input').forEach(x=>x.oninput=updateTotal)})};
 $('#billAdd').onclick=()=>{$('#billLines').insertAdjacentHTML('beforeend',itemHtml());wire()};wire();$('#billTax').oninput=$('#billDiscount').oninput=updateTotal;
 $('#billForm').onsubmit=async e=>{
  e.preventDefault();const button=$('#billSave'),status=$('#billFormMessage');
  const items=[...panel.querySelectorAll('.bill-line')].map(el=>({description:el.querySelector('.bill-desc').value.trim(),quantity:Number(el.querySelector('.bill-qty').value),unit_price:Number(el.querySelector('.bill-rate').value)}));
  if(items.some(i=>!i.description||!(i.quantity>0)||!Number.isFinite(i.unit_price)||i.unit_price<0)){status.textContent='Complete every line item with a description, quantity, and price.';return}
  if(ledger==='dot'&&!$('#billCustomer').value){status.textContent='Choose an existing DOT customer.';return}
  button.disabled=true;status.textContent='Saving invoice…';
  const data=ledger==='dot'?{id:inv.id||'',customer_type:$('#billType').value,customer_id:$('#billCustomer').value,invoice_title:$('#billTitle').value.trim(),recipient_name:$('#billName').value.trim(),recipient_email:$('#billEmail').value.trim(),due_at:$('#billDueDate').value||null,tax:Number($('#billTax').value||0),credits:Number($('#billDiscount').value||0),payment_terms:$('#billTerms').value,notes:$('#billNotes').value,items:items.map(x=>({description:x.description,quantity:x.quantity,unit_amount:x.unit_price}))}:{customer_name:$('#billName').value.trim(),customer_email:$('#billEmail').value.trim(),due_date:$('#billDueDate').value||null,tax_total:Number($('#billTax').value||0),discount_total:Number($('#billDiscount').value||0),terms:$('#billTerms').value,notes:$('#billNotes').value,items};
  try{const r=await api(ledger,ledger==='dot'?'save':'billing_save',ledger==='dot'?{invoice:data}:{id:inv.id||'',invoice:data});
   status.textContent='Invoice saved. No email sent.';
   await reload();await detail(ledger,r.invoice.id);
  }catch(err){status.textContent=err.message;button.disabled=false}
 };
}
function canEdit(v,ledger){return ledger==='dot'?['draft','open'].includes(v.status)&&!v.sent_at&&!Number(v.amount_paid||0):['draft','open'].includes(v.status)&&!v.sent_at&&!Number(v.amount_paid||0)}
async function detail(ledger,id){
 const panel=$('#billDetail');panel.hidden=false;panel.innerHTML='<p>Loading invoice…</p>';panel.scrollIntoView({behavior:'smooth',block:'start'});
 try{
  const r=await api(ledger,ledger==='dot'?'get':'invoice_detail',{id}),v=r.invoice,items=ledger==='dot'?v.invoice_items:r.items;active={ledger,id,invoice:v,items};
  panel.innerHTML='<div class="wmb-detail-head"><div><span class="wmd-overline">'+esc(ledger==='dot'?'DOT CUSTOMER INVOICE':'WORKFORCE INVOICE')+'</span><h2>'+esc(v.invoice_number)+'</h2></div><button id="billClose" class="wmb-clear">Close</button></div>'
  +'<div class="wmb-detail-meta"><p><strong>Customer</strong><span>'+esc(v.customer_name||v.recipient_name)+'<br>'+esc(v.customer_email||v.recipient_email)+'</span></p><p><strong>Status</strong>'+badge(v.status)+'</p><p><strong>Issued</strong><span>'+day(v.issue_date||v.issued_at)+'</span></p><p><strong>Due</strong><span>'+day(v.due_date||v.due_at)+'</span></p><p><strong>Balance</strong><span>'+money(v.amount_due)+'</span></p></div>'
  +'<div class="wmb-table-wrap"><table class="wmb-table"><thead><tr><th>Description</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>'+items.map(x=>'<tr><td>'+esc(x.description)+'</td><td>'+esc(x.quantity)+'</td><td>'+money(x.unit_price??x.unit_amount)+'</td><td>'+money(x.line_total??x.amount)+'</td></tr>').join('')+'</tbody></table></div>'
  +'<div class="wmb-detail-total">Total: '+money(v.total)+' · Balance due: '+money(v.amount_due)+'</div>'
  +'<div style="display:flex;flex-wrap:wrap;gap:9px;padding:14px 0"><button class="wmd-refresh" id="billPdf">Download PDF</button>'
  +(canEdit(v,ledger)?'<button class="wmb-clear" id="billEdit">Edit Invoice</button>':'')
  +(!['paid','void'].includes(v.status)&&Number(v.amount_due)>0?'<button class="wmd-refresh" id="billSend">Send Invoice</button><button class="wmb-clear" id="billVoid">Void Invoice</button>':'')
  +'</div><p id="billDetailStatus" role="status"></p>';
  $('#billClose').onclick=()=>{panel.hidden=true};
  $('#billPdf').onclick=()=>pdf(v,items,ledger);
  if($('#billEdit'))$('#billEdit').onclick=()=>wireForm({...v,invoice_items:items},ledger);
  if($('#billVoid'))$('#billVoid').onclick=async()=>{
   const reason=prompt('Reason for voiding invoice '+v.invoice_number+'? This is irreversible.');
   if(reason===null)return;if(reason.trim().length<5){$('#billDetailStatus').textContent='Enter a meaningful void reason.';return}
   if(!confirm('Confirm void invoice '+v.invoice_number+'? The customer must not pay it after voiding.'))return;
   try{await api(ledger,ledger==='dot'?'void':'billing_void',{id,reason:reason.trim()});await reload();await detail(ledger,id);msg('Invoice voided. Payment history preserved.')}catch(e){$('#billDetailStatus').textContent=e.message}
  };
  if($('#billSend'))$('#billSend').onclick=async()=>{
   if(!confirm('Send invoice '+v.invoice_number+' for '+money(v.amount_due)+' to '+(v.customer_email||v.recipient_email)+'?'))return;
   const btn=$('#billSend');btn.disabled=true;$('#billDetailStatus').textContent='Sending invoice…';
   try{
    const result=await api(ledger,ledger==='dot'?'push':'billing_send',{id});
    if(result.email_error)throw Error('Invoice saved, but email failed: '+result.email_error);
    await reload();await detail(ledger,id);msg('Invoice delivery request accepted.');
   }catch(e){$('#billDetailStatus').textContent=e.message;btn.disabled=false}
  };
 }catch(e){panel.innerHTML='<p role="alert">'+esc(e.message)+'</p>'}
}
async function pdf(v,items,ledger){
 if(!window.jspdf?.jsPDF){msg('PDF library unavailable.',true);return}
 const doc=new window.jspdf.jsPDF({unit:'pt',format:'letter'}),left=42,right=570;let y=48;
 doc.setFillColor(255,255,255);doc.rect(0,0,612,98,'F');doc.setTextColor(1,18,47);doc.setFontSize(20);doc.setFont('helvetica','bold');
 try{const image=new Image();image.src='images/logo.png';await image.decode();const scale=Math.min(175/image.naturalWidth,58/image.naturalHeight);doc.addImage(image,'PNG',left,18,image.naturalWidth*scale,image.naturalHeight*scale)}catch{doc.text('WORKFORCE',left,53)}
 doc.setFontSize(18);doc.text('INVOICE',right,47,{align:'right'});doc.setFontSize(9);doc.text(String(v.invoice_number||''),right,66,{align:'right'});
 doc.setDrawColor(253,193,2);doc.setLineWidth(3);doc.line(left,90,right,90);doc.setTextColor(1,18,47);y=140;
 const line=(label,value)=>{doc.setFont('helvetica','bold');doc.text(label,left,y);doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(String(value||'—'),340),225,y);y+=23};
 line('BILL TO',v.customer_name||v.recipient_name);line('Email',v.customer_email||v.recipient_email);line('Issue date',day(v.issue_date||v.issued_at));line('Due date',day(v.due_date||v.due_at));line('Status',String(v.status||'').toUpperCase());y+=16;
 doc.setFillColor(238,243,249);doc.rect(left,y,right-left,27,'F');doc.setFont('helvetica','bold');doc.text('DESCRIPTION',left+8,y+17);doc.text('QTY',386,y+17);doc.text('AMOUNT',right-8,y+17,{align:'right'});y+=45;
 for(const i of items){const desc=doc.splitTextToSize(String(i.description||'Item'),260),h=Math.max(32,desc.length*13+12);if(y+h>705){doc.addPage();y=60}doc.setFont('helvetica','normal');doc.text(desc,left+8,y);doc.text(String(i.quantity||1),386,y);doc.text(money(i.line_total??i.amount??Number(i.quantity)*Number(i.unit_price??i.unit_amount)),right-8,y,{align:'right'});y+=h}
 if(y>680){doc.addPage();y=70}doc.setFont('helvetica','bold');doc.setFontSize(12);doc.text('TOTAL  '+money(v.total),right,y+25,{align:'right'});doc.text('BALANCE DUE  '+money(v.amount_due),right,y+47,{align:'right'});
 doc.setFontSize(9);doc.setFont('helvetica','normal');doc.text('Workforce · Secure invoice record',left,765);doc.save('Workforce-'+String(v.invoice_number||'invoice').replace(/[^A-Za-z0-9-_]/g,'')+'.pdf');
}
async function start(){
 const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);const root=$('#dotPageMount');if(!root)return;
 root.classList.add('wmd-root');root.innerHTML='<section class="wmd-dashboard wmb-dashboard"><header class="wmb-intro"><div><span class="wmd-overline">WORKFORCE / FINANCE</span><h1>Billing & Invoices</h1><p>Create and manage Workforce and DOT customer invoices in one workspace.</p></div><div style="display:flex;gap:10px"><button id="billNew" class="wmd-refresh">+ Create Invoice</button><button id="billRefresh" class="wmb-clear">Refresh Records</button></div></header>'
 +'<div class="wmb-stats"><article><span>Total invoices</span><strong id="billTotal">—</strong></article><article><span>Awaiting payment</span><strong id="billOpen">—</strong></article><article><span>Outstanding balance</span><strong id="billDue">—</strong></article><article><span>Paid invoices</span><strong id="billPaid">—</strong></article><article><span>Voided</span><strong id="billVoid">—</strong></article></div>'
 +'<section class="wmb-directory"><div class="wmb-directory-head"><div><h2>Invoice Directory</h2><p id="billingMessage" role="status"></p></div><strong id="billCount"></strong></div><div class="wmb-toolbar"><input id="billSearch" type="search" placeholder="Invoice number, customer, email" aria-label="Search invoices"><select id="billLedger" aria-label="Ledger"><option value="all">All invoices</option><option value="general">Workforce</option><option value="dot">DOT</option></select><select id="billStatus" aria-label="Status"><option value="all">All statuses</option><option value="draft">Draft</option><option value="open">Open</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="void">Void</option></select></div><div class="wmb-table-wrap"><table class="wmb-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Type</th><th>Total</th><th>Balance</th><th>Status</th><th>Actions</th></tr></thead><tbody id="billRows"></tbody></table></div></section><section id="billDetail" class="wmb-directory wmb-detail" hidden></section></section>';
 $('#billSearch').oninput=$('#billLedger').onchange=$('#billStatus').onchange=paint;
 $('#billNew').onclick=()=>wireForm({},'general');$('#billRefresh').onclick=reload;await reload();const params=new URLSearchParams(location.search);if(params.get('create')==='dot')wireForm({},'dot');else if(params.get('create')==='general')wireForm({},'general');else if(params.get('ledger')&&params.get('id')){if(params.get('edit')==='1'){const led=params.get('ledger');const rec=await api(led,led==='dot'?'get':'invoice_detail',{id:params.get('id')});wireForm({...rec.invoice,invoice_items:led==='dot'?rec.invoice.invoice_items:rec.items},led)}else await detail(params.get('ledger'),params.get('id'))}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start().catch(console.error),{once:true});else start().catch(console.error);
})();