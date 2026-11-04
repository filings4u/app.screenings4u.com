(async()=>{"use strict";
const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);
const root=document.getElementById("dotPageMount");if(!root)return;
const html=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const id=new URLSearchParams(location.search).get("intake_id")||"";
const url=id=>"house-lab-fulfillment.html?intake_id="+encodeURIComponent(id);
root.innerHTML='<div class="lab-wrap"><h1>C/TPA Account Setup</h1><p id="ctpaMessage" role="status">Checking the purchase and C/TPA profile…</p><div class="lab-detail-nav"><a class="lab-action" href="lab-account-intakes.html">Customer intakes</a><a class="lab-action" href="house-lab-fulfillment.html">All account purchases</a></div><div id="ctpaManagement"></div></div>';
const message=document.getElementById("ctpaMessage"),mount=document.getElementById("ctpaManagement");
const request=async action=>{const {data,error}=await dotSupabase.functions.invoke("house-lab-ctpa-provision",{body:{action,intake_id:id}});if(error||data?.error)throw Error(data?.error||error?.message||"C/TPA operation failed");return data};
async function render(){
 const d=await request("status"),purchase=d.purchase||{},ctpa=d.ctpa||null;
 const t=d.stages||{},intakeUrl="lab-account-intake-detail.html?email="+encodeURIComponent(purchase.customer_email||"");
 const steps=[
 ["Paid lab account purchase",!!t.payment_verified,"house-lab-fulfillment.html?intake_id="+encodeURIComponent(id)],
 ["Branded customer receipt",null,intakeUrl],
 ["Branded administrator purchase alert",null,intakeUrl],
 ["Complete customer intake",!!t.intake_submitted,intakeUrl],
 ["Branded intake confirmation",null,intakeUrl],
 ["Administrator intake notification",null,intakeUrl],
 ["Administrator intake review",!!t.intake_completed,intakeUrl],
 ["Assign laboratory account numbers",(t.assigned_lab_numbers||0)>0,ctpa?"lab-account-assignment.html?ctpa_id="+encodeURIComponent(ctpa.id):"#ctpaActions"],
 ["Send C/TPA account-ready email",null,ctpa?"lab-account-assignment.html?ctpa_id="+encodeURIComponent(ctpa.id):"#ctpaActions"],
 ["Order supplies and enter tracking",(t.shipments||0)>0,url(id)],
 ["Tracking email and portal link",(t.shipment_notices||0)>0,url(id)],
 ["Join collector network",(t.collector_referrals||0)>0,intakeUrl],
 ["Receive supplies and begin testing",(t.delivered||0)>0,url(id)],
 ["Submit specimens to laboratory",null,url(id)],
 ["Issue invoice and notify customer",(t.sent_invoices||0)>0,url(id)]
 ];
 const workflow='<div class="lab-panel"><h2>15-step workflow verification</h2><p class="lab-muted">Live database checkpoints are marked Recorded. Email delivery and physical test processing remain Unverified until confirmed by their systems.</p><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Step</th><th>Workflow</th><th>Verification</th><th>Management</th></tr></thead><tbody>'+steps.map((item,i)=>'<tr><td>'+String(i+1).padStart(2,"0")+'</td><td>'+html(item[0])+'</td><td><span class="lab-pill">'+(item[1]===true?"Recorded":item[1]===false?"Pending":"Unverified")+'</span></td><td><a class="lab-action" href="'+html(item[2])+'">Manage</a></td></tr>').join("")+'</tbody></table></div></div>';

 message.textContent=ctpa?"C/TPA profile is linked to this purchase.":"This paid purchase needs a C/TPA onboarding record.";
 mount.innerHTML='<div class="lab-panel"><h2>House Lab Account identity</h2><div class="lab-detail"><div class="lab-detail-field"><span>Customer</span><strong>'+html(purchase.customer_email||"—")+'</strong></div><div class="lab-detail-field"><span>Intake stage</span><strong>'+html(purchase.status||"pending")+'</strong></div><div class="lab-detail-field"><span>Lab account activation</span><strong>'+html(purchase.account_status||"pending")+'</strong></div><div class="lab-detail-field"><span>C/TPA onboarding</span><strong>'+html(ctpa?.status||"Not yet linked")+'</strong></div>'+(ctpa?'<div class="lab-detail-field"><span>C/TPA company code</span><strong>'+html(ctpa.company_code||"—")+'</strong></div>':'')+'</div><div class="lab-row-actions" id="ctpaActions"></div><p id="ctpaError" role="status" class="lab-notice"></p></div>'+
 '<div class="lab-panel"><h2>Next management actions</h2><p class="lab-muted">Complete intake review, assign account numbers, and manage shipping and invoices from dedicated pages. Onboarding does not activate laboratory testing privileges.</p><div class="lab-row-actions">'+
 '<a class="lab-action" href="lab-account-intake-detail.html?email='+encodeURIComponent(purchase.customer_email||"")+'">Review customer intake</a>'+
 (ctpa?'<a class="lab-action lab-primary" href="lab-account-assignment.html?ctpa_id='+encodeURIComponent(ctpa.id)+'">Assign lab numbers</a>':'')+
 '<a class="lab-action" href="lab-account-status.html?id='+encodeURIComponent(id)+'">Manage activation</a>'+
 '<a class="lab-action" href="'+url(id)+'">Manage supplies and invoices</a></div></div>';
 mount.insertAdjacentHTML("beforeend",workflow);
 if(ctpa&&t.intake_completed){
   const finalize=document.createElement("button");finalize.type="button";finalize.className="lab-primary";finalize.textContent="Apply reviewed intake to C/TPA profile";
   finalize.onclick=async()=>{finalize.disabled=true;const errorNode=document.getElementById("ctpaError");errorNode.textContent="";try{await request("finalize_profile");await render()}catch(e){errorNode.textContent=e.message;finalize.disabled=false}};
   document.getElementById("ctpaActions").append(finalize);
 }
 if(!ctpa){
   const button=document.createElement("button");button.className="lab-primary";button.textContent="Create / link C/TPA onboarding profile";button.type="button";
   button.onclick=async()=>{button.disabled=true;const errorNode=document.getElementById("ctpaError");errorNode.textContent="";try{await request("provision");await render()}catch(e){errorNode.textContent=e.message;button.disabled=false}};
   document.getElementById("ctpaActions").append(button);
 }
}
try{
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))throw Error("Open this page from a customer's purchased Lab Account record.");
 await render();
}catch(e){message.textContent=e.message;mount.innerHTML='<a class="lab-action" href="house-lab-fulfillment.html">Return to customer purchases</a>'}
})();