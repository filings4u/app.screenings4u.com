(async()=>{"use strict";
const $=id=>document.getElementById(id);
const esc=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#39;");
const money=x=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(x)||0);
try{
 const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);
 const root=$("dotPageMount"),supabase=window.dotSupabase;if(!root||!supabase)throw Error("Workforce management session unavailable");
 let tenant="",context="dot",kind="bill",records={bills:[],settlements:[]},items=[{description:"",amount:""}],canWrite=false;
 root.innerHTML='<div class="ctpa-rate-page"><section class="ctpa-rate-hero"><small>WORKFORCE / FINANCE OPERATIONS</small><h1>C/TPA Workforce Billing & Settlements</h1><p>Create and publish Workforce invoices to C/TPA accounts. Record completed payouts and publish settlement statements for C/TPAs to view and download. Payment links use the new C/TPA checkout mode.</p></section><section class="ctpa-rate-panel"><div class="ctpa-rate-grid"><label>C/TPA account<select id="fmTenant"><option value="">Select C/TPA</option></select></label><label>DOT or NON-DOT<select id="fmContext"><option value="dot">DOT</option><option value="nondot">NON-DOT</option></select></label></div><div class="finance-tabs"><button type="button" class="active" id="fmBillTab">Workforce Billing</button><button type="button" id="fmSetTab">Settlements</button></div><div id="fmMessage" class="ctpa-rate-status" role="status"></div></section><section class="ctpa-rate-panel"><h2 id="fmHeading">Create Workforce Invoice</h2><form id="fmForm"><div id="fmFields"></div><div id="fmItems"></div><button class="secondary" type="button" id="fmAddItem">Add line item</button><div class="ctpa-rate-controls"><button type="submit" id="fmCreate">Save Draft Invoice</button></div></form></section><section class="ctpa-rate-panel"><h2 id="fmHistoryTitle">Workforce Invoices</h2><div id="fmHistory" class="finance-pending">Choose an organization to see records.</div></section></div>';
 const say=t=>{$("fmMessage").textContent=t};
 async function call(action,data={}){
  const token=(await supabase.auth.getSession()).data?.session?.access_token;if(!token)throw Error("Sign in required");
  const r=await fetch("https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/management-ctpa-finance",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":window.DOT_PORTAL_CONFIG.supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({action,...data})});
  const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||"Management request failed");return d;
 }
 const today=()=>new Date().toISOString().slice(0,10);
 function drawForm(){
  $("fmHeading").textContent=kind==="bill"?"Create Workforce Invoice":"Create C/TPA Settlement";
  $("fmHistoryTitle").textContent=kind==="bill"?"Workforce Invoices":"C/TPA Settlements";
  $("fmCreate").textContent=kind==="bill"?"Save Draft Invoice":"Save Pending Settlement";
  $("fmFields").innerHTML=kind==="bill"?'<div class="ctpa-rate-grid"><label>Invoice reference<input name="number" required placeholder="WF-CTPA-0001"></label><label>Title<input name="title" value="Workforce Invoice"></label><label>Issue date<input type="date" name="issued_at" required value="'+today()+'"></label><label>Due date<input type="date" name="due_at" required value="'+today()+'"></label><label>Tax amount ($)<input type="number" name="tax" step="0.01" min="0" value="0"></label><label>Discount ($)<input type="number" name="discount" step="0.01" min="0" value="0"></label><label class="span2">Notes<textarea name="notes" maxlength="1500"></textarea></label></div>':'<div class="ctpa-rate-grid"><label>Settlement reference<input name="number" required placeholder="SET-CTPA-0001"></label><label>Period start<input name="period_start" type="date" required value="'+today()+'"></label><label>Period end<input name="period_end" type="date" required value="'+today()+'"></label><label>Adjustments ($; may be negative)<input name="adjustments" type="number" step="0.01" value="0"></label><label class="span2">Notes<textarea name="notes" maxlength="1500"></textarea></label></div>';
  items=[{description:"",amount:""}];drawItems();
 }
 function drawItems(){
  $("fmItems").innerHTML='<h3>Itemized '+(kind==="bill"?"charges":"services performed")+'</h3>'+items.map((it,i)=>'<div class="finance-entry" data-idx="'+i+'"><input class="fmDescription" placeholder="Service description" value="'+esc(it.description)+'" maxlength="240" aria-label="Item description"><input class="fmAmount" placeholder="Amount ($)" type="number" min="0" step="0.01" value="'+esc(it.amount)+'" aria-label="Item amount"><button class="secondary" data-remove="'+i+'" type="button">Remove</button></div>').join("");
  $("fmItems").querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{collect();if(items.length<2)return;items.splice(Number(b.dataset.remove),1);drawItems()});
 }
 function collect(){items=[...$("fmItems").querySelectorAll(".finance-entry")].map(e=>({description:e.querySelector(".fmDescription").value,amount:e.querySelector(".fmAmount").value}))}
 async function refresh(){
  if(!tenant){$("fmHistory").textContent="Select an organization.";records={bills:[],settlements:[]};return}
  const d=await call("list",{tenant_id:tenant,operating_context:context});records=d;canWrite=d.can_write;
  const list=kind==="bill"?d.bills:d.settlements;
  $("fmHistory").innerHTML=list.length?list.map(x=>'<article class="finance-record"><div><strong>'+esc(kind==="bill"?x.invoice_number:x.settlement_number)+'</strong><small>'+esc(kind==="bill"?x.title:x.period_start+" — "+x.period_end)+'</small><small>'+money(kind==="bill"?x.total:x.net)+' · '+esc(x.status)+'</small></div><div class="actions">'+(kind==="bill"&&x.status==="draft"?'<button data-publish="'+x.id+'">Publish Invoice</button>':'')+(kind==="bill"&&["draft","open"].includes(x.status)&&!x.payment_intent_id?'<button class="secondary" data-void="'+x.id+'">Void</button>':'')+(kind==="settlement"&&x.status==="pending"?'<button data-paid="'+x.id+'">Record Payout</button>':'')+'</div></article>').join(""):'<p>No records yet for this workspace.</p>';
  $("fmHistory").querySelectorAll("[data-publish]").forEach(b=>b.onclick=()=>void perform("publish_bill",b.dataset.publish));
  $("fmHistory").querySelectorAll("[data-void]").forEach(b=>b.onclick=()=>void perform("void_bill",b.dataset.void));
  $("fmHistory").querySelectorAll("[data-paid]").forEach(b=>b.onclick=()=>void recordPayout(b.dataset.paid));
 }
 async function perform(action,id){try{await call(action,{id,tenant_id:tenant,operating_context:context});say("Record updated.");await refresh()}catch(e){say(e.message)}}
 async function recordPayout(id){
  const method=prompt("Actual payout method (e.g., ACH)");if(!method)return;
  const reference=prompt("Confirmed bank or payout reference");if(!reference)return;
  const paid_at=prompt("Payment date (YYYY-MM-DD)",today());if(!paid_at)return;
  try{await call("mark_settlement_paid",{id,tenant_id:tenant,operating_context:context,payment_method:method,payment_reference:reference,paid_at});say("Settlement marked paid and published to the C/TPA.");await refresh()}catch(e){say(e.message)}
 }
 $("fmTenant").onchange=()=>{tenant=$("fmTenant").value;void refresh().catch(e=>say(e.message))};
 $("fmContext").onchange=()=>{context=$("fmContext").value;void refresh().catch(e=>say(e.message))};
 const switchTab=k=>{kind=k;$("fmBillTab").classList.toggle("active",k==="bill");$("fmSetTab").classList.toggle("active",k==="settlement");drawForm();void refresh().catch(e=>say(e.message))};
 $("fmBillTab").onclick=()=>switchTab("bill");$("fmSetTab").onclick=()=>switchTab("settlement");
 $("fmAddItem").onclick=()=>{collect();items.push({description:"",amount:""});drawItems()};
 $("fmForm").onsubmit=async e=>{e.preventDefault();if(!tenant){say("Select a C/TPA account");return}const button=$("fmCreate");button.disabled=true;collect();
 try{const values=Object.fromEntries(new FormData(e.currentTarget).entries());values.items=items.map(i=>({description:i.description,amount:Number(i.amount)}));await call(kind==="bill"?"create_bill":"create_settlement",{...values,tenant_id:tenant,operating_context:context});say("Record saved; "+(kind==="bill"?"publish the invoice when approved.":"record the actual payout when funds have been sent."));drawForm();await refresh()}catch(error){say(error.message)}finally{button.disabled=false}};
 drawForm();const bootstrap=await call("organizations");
 $("fmTenant").innerHTML='<option value="">Select C/TPA</option>'+(bootstrap.organizations||[]).map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>').join("");
 canWrite=bootstrap.can_write;say("Choose the C/TPA to manage published financial records.");
}catch(e){console.error("finance management",e);const target=document.getElementById("dotPageMount")||document.getElementById("financeInitialLoading");if(target)target.textContent="Unable to load finance management: "+String(e.message||e)}
})();