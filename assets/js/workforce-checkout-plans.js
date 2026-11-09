(()=>{"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const url="https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/workforce-checkout-plan-admin";
let records=[],selected=null;
async function api(action,data={}){
 const {data:auth,error}=await dotSupabase.auth.getSession();if(error||!auth.session?.access_token)throw Error("Staff session required");
 const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+auth.session.access_token,"apikey":DOT_PORTAL_CONFIG.supabaseAnonKey},body:JSON.stringify({action,...data}),cache:"no-store"});
 const body=await response.json().catch(()=>({}));if(!response.ok||body.error)throw Error(body.error||"Unable to load pricing");return body;
}
function select(plan){
 selected=plan;
 $("#wfPlanName").value=plan.name||"";$("#wfPlanCode").value=plan.code||"";$("#wfPlanDescription").value=plan.description||"";
 $("#wfPlanPrice").value=Number(plan.displayed_price??0).toFixed(2);
 $("#wfPlanFrequency").textContent=plan.billing_frequency==="yearly"?"USD / year":"USD / month";
 $("#wfPlanScope").textContent=plan.audience==="owner_operator"?"Owner-Operator":plan.audience==="ctpa"?"C/TPA":"Employer or Regulatory Agency";
 $("#wfPlanFormTitle").textContent=plan.name;
 $("#wfPricingStatus").textContent="";
 document.querySelectorAll("[data-wf-plan]").forEach(el=>el.classList.toggle("selected",el.dataset.wfPlan===plan.id));
}
function render(){
 const q=($("#wfPricingSearch").value||"").toLowerCase();
 const list=records.filter(p=>(p.name+" "+p.code+" "+p.audience).toLowerCase().includes(q));
 $("#wfPricingList").innerHTML=list.map(p=>'<button type="button" class="wf-pricing-record" data-wf-plan="'+esc(p.id)+'"><span><strong>'+esc(p.name)+'</strong><small>'+esc(p.code)+'</small></span><b>$'+Number(p.displayed_price||0).toFixed(2)+' <small>/ '+(p.billing_frequency==="yearly"?"year":"month")+'</small></b></button>').join("")||'<p>No matching plans.</p>';
 document.querySelectorAll("[data-wf-plan]").forEach(el=>el.onclick=()=>select(records.find(p=>p.id===el.dataset.wfPlan)));
 if(selected)document.querySelectorAll("[data-wf-plan]").forEach(el=>el.classList.toggle("selected",el.dataset.wfPlan===selected.id));
}
async function refresh(code){
 const payload=await api("list");records=payload.plans||[];render();$("#wfPlanCount").textContent=records.length+" live catalog plans";
 const next=records.find(x=>x.code===code)||records[0];if(next)select(next);
}
async function save(e){
 e.preventDefault();if(!selected)return;
 const amount=Number($("#wfPlanPrice").value),name=$("#wfPlanName").value.trim(),description=$("#wfPlanDescription").value.trim();
 if(!(amount>=1&&amount<=10000)){$("#wfPricingStatus").textContent="Enter a valid amount between $1 and $10,000.";return}
 if(!confirm("Update "+selected.code+" to $"+amount.toFixed(2)+"? This changes the price used for new checkout sessions, but does not reprice existing subscriptions."))return;
 const b=$("#wfPlanSave");b.disabled=true;$("#wfPricingStatus").textContent="Saving live checkout price…";
 try{await api("save",{plan_id:selected.id,amount,name,description});$("#wfPricingStatus").textContent="Saved. New checkouts use the updated catalog price.";await refresh(selected.code)}catch(err){$("#wfPricingStatus").textContent=err.message||"Unable to save price"}finally{b.disabled=false}
}
async function main(){
 const root=$("#dotPageMount");
 root.innerHTML='<section class="nd-page wf-price-admin"><div class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE · SECURE LIVE CHECKOUT</span><h1>Subscription Plan Pricing</h1><p>Edit C/TPA, employer, owner-operator and agency plan prices used by the production checkout catalog.</p></div><a class="nd-btn" href="workforce-main-site.html">Main Website SEO</a></div><div class="wf-pricing-notice"><strong>Changes apply to future checkout sessions only.</strong> Existing subscriptions and their Stripe billing prices are not automatically changed. Checkout creates or reuses a matching Stripe price when a new purchase starts.</div><div class="wf-price-layout"><section class="nd-card wf-price-list"><h2>Plans <small id="wfPlanCount"></small></h2><input type="search" id="wfPricingSearch" placeholder="Search C/TPA, employer, owner-operator or agency" aria-label="Search plans"><div id="wfPricingList">Loading plans…</div></section><section class="nd-card wf-price-editor"><h2 id="wfPlanFormTitle">Select a plan</h2><p id="wfPlanScope"></p><form id="wfPlanForm"><label>Plan code<input readonly id="wfPlanCode"></label><label>Plan name<input required maxlength="180" id="wfPlanName"></label><label>Description<textarea id="wfPlanDescription" rows="4"></textarea></label><label>Subscription amount <span id="wfPlanFrequency"></span><input required id="wfPlanPrice" type="number" min="1" max="10000" step="0.01"></label><div class="wf-price-actions"><span role="status" id="wfPricingStatus"></span><button type="submit" id="wfPlanSave" class="nd-btn primary">Save Live Price</button></div></form></section></div></section>';
 const style=document.createElement("style");style.textContent='.wf-pricing-notice{background:#fff9e4;border:1px solid #f1dc94;border-left:4px solid #fdc102;padding:14px 16px;border-radius:9px;font-size:12px;line-height:1.6;margin-bottom:17px;color:#32475f}.wf-price-layout{display:grid;grid-template-columns:minmax(270px,.9fr) minmax(0,1.3fr);gap:17px}.wf-price-list,.wf-price-editor{padding:20px}.wf-price-layout h2{font-size:18px;margin:0 0 14px;color:#01122f}.wf-price-list h2 small{font-size:11px;font-weight:500;color:#61758c}.wf-price-list input[type=search]{width:100%;min-height:43px;padding:11px;border:1px solid #cbd7e5;border-radius:8px;margin-bottom:10px}.wf-pricing-record{display:flex;width:100%;align-items:center;justify-content:space-between;gap:10px;padding:12px;background:#fff;border:1px solid #e0e7ef;border-radius:9px;margin:8px 0;text-align:left;cursor:pointer}.wf-pricing-record.selected{background:#fff9df;border-color:#fdc102}.wf-pricing-record span{display:grid;gap:4px}.wf-pricing-record strong{font-size:12px;color:#01122f}.wf-pricing-record small{font-size:10px;color:#70829a}.wf-pricing-record b{white-space:nowrap;font-size:13px;color:#01122f}.wf-price-editor>p{color:#61758c;font-size:12px;margin:0 0 18px}.wf-price-editor form{display:grid;gap:16px}.wf-price-editor label{display:grid;gap:7px;font-size:12px;color:#274360;font-weight:750}.wf-price-editor label>span{color:#6a7c91;font-weight:500}.wf-price-editor input,.wf-price-editor textarea{width:100%;min-height:42px;border:1px solid #cbd7e5;border-radius:8px;padding:10px 12px;font:inherit;color:#01122f}.wf-price-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #e2e8ef;padding-top:18px}.wf-price-actions>span{font-size:12px;color:#286a42}@media(max-width:860px){.wf-price-layout{grid-template-columns:1fr}}';document.head.append(style);
 $("#wfPricingSearch").addEventListener("input",render);$("#wfPlanForm").addEventListener("submit",save);await refresh();
}
document.addEventListener("DOMContentLoaded",async()=>{try{const state=await DOTAuth.requireAuth();if(!state)return;DOTShell.render(state);await main()}catch(e){const root=$("#dotPageMount");if(root)root.textContent=e.message||"Unable to load live pricing"}},{once:true});
})();