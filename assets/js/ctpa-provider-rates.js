(async()=>{"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const money=v=>v==null?"Not assigned":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(v));
const txt=(v,n=160)=>String(v??"").trim().slice(0,n);
const status=s=>{$("providerMessage").textContent=s};
try{
 const auth=await DOTAuth.requireAuth();if(!auth)return;
 DOTShell.render(auth);
 const root=$("dotPageMount");if(!root)throw Error("Management page unavailable");
 root.innerHTML='<div class="ctpa-rate-page"><section class="ctpa-rate-hero"><small>WORKFORCE / PARTNER COMPENSATION</small><h1>C/TPA Provider Services & Rates</h1><p>Define which services C/TPAs perform on behalf of Workforce, publish approved default payout rates, then assign negotiated rates for each C/TPA. These amounts are separate from customer testing prices.</p></section>'+
 '<section class="ctpa-rate-panel"><h2>Choose a C/TPA</h2><p>Select a C/TPA to assign individual compensation rates, or use the catalog without a selection to manage default rates.</p><div class="ctpa-rate-grid"><label>C/TPA organization<select id="providerTenant"><option value="">Default service catalog</option></select></label><label>Workspace<select id="providerContext"><option value="dot">DOT</option><option value="nondot">NON-DOT</option></select></label><label>Find a service<input id="providerFind" type="search" placeholder="Search services"></label></div><div class="ctpa-rate-controls"><button id="providerRefresh" type="button" class="secondary">Refresh services</button><button id="providerNew" type="button">Add new service</button></div><div id="providerMessage" class="ctpa-rate-status" role="status"></div></section>'+
 '<section class="ctpa-rate-panel" id="providerEditPanel" hidden><h2 id="providerEditTitle">Create new provider service</h2><p>Default rates are compensation amounts paid by Workforce, not the customer's retail price. A service remains unpublished until an approved rate is entered.</p><form id="providerServiceForm"><input type="hidden" name="id" id="providerServiceId"><div class="ctpa-rate-grid"><label>Service name<input name="name" required maxlength="160" placeholder="e.g., Mobile urine collection"></label><label>Unique service code<input name="service_code" required maxlength="80" pattern="[a-z][a-z0-9-]{2,79}" placeholder="e.g., mobile-urine-collection"></label><label>Category<input name="category" required maxlength="100" placeholder="e.g., Mobile Collection"></label><label>Compensation basis<input name="unit" maxlength="80" value="per service"></label><label>Applicable workspace<select name="operating_context"><option value="both">DOT and NON-DOT</option><option value="dot">DOT only</option><option value="nondot">NON-DOT only</option></select></label><label>Approved default payout (USD)<input name="default_rate" type="number" min="0" max="100000" step="0.01" placeholder="Awaiting approval"></label><label>Publication<select name="status"><option value="draft">Draft / not published</option><option value="published">Published</option><option value="inactive">Inactive</option></select></label><label class="span2">Description<textarea name="description" maxlength="900"></textarea></label></div><div class="ctpa-rate-controls"><button type="button" class="secondary" id="providerCancel">Cancel</button><button type="submit" id="providerSaveService">Save service</button></div></form></section>'+
 '<section class="ctpa-rate-panel"><h2>Provider compensation schedule</h2><p>Set default rates for all C/TPAs, or select a C/TPA above to save an individual rate. Services marked Draft are not visible in the C/TPA portal.</p><div class="ctpa-rate-scroll"><table><thead><tr><th>Service</th><th>Default payout</th><th>Publication</th><th id="providerIndividualHeading">Individual payout</th><th>Action</th></tr></thead><tbody id="providerRows"><tr><td colspan="5">Loading services…</td></tr></tbody></table></div><p class="ctpa-rate-disclaimer">Changes apply only to this provider compensation catalog and do not alter published testing prices or generate payment orders.</p></section></div>';
 const sb=window.dotSupabase;
 if(!sb)throw Error("Supabase session unavailable");
 let services=[],canManage=false,activeContext="dot",tenantId="",search="";
 async function api(action,payload={}){
  const {data:{session},error:e}=await sb.auth.getSession();if(e||!session?.access_token)throw Error("Sign-in required");
  const response=await fetch("https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/management-ctpa-provider-rates",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json","apikey":window.DOT_PORTAL_CONFIG.supabaseAnonKey,"Authorization":"Bearer "+session.access_token},body:JSON.stringify({action,...payload})});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||result.error)throw Error(result.error||"Provider pricing request failed");
  return result;
 }
 function filterRows(){
  const matched=services.filter(s=>[s.name,s.service_code,s.category,s.description].join(" ").toLowerCase().includes(search.toLowerCase()));
  $("providerIndividualHeading").textContent=tenantId?"C/TPA assigned payout":"Default catalog";
  $("providerRows").innerHTML=matched.length?matched.map(s=>{
   const o=s.override||null,mode=o?.status||"inherit",amount=mode==="published"?o.rate:s.default_rate;
   const showValue=amount===null?"":Number(amount);
   const choices='<option value="inherit"'+(mode==="inherit"?" selected":"")+'>Use default</option><option value="published"'+(mode==="published"?" selected":"")+'>Custom payout</option><option value="hidden"'+(mode==="hidden"?" selected":"")+'>Hide from C/TPA</option>';
   return '<tr data-provider-service="'+esc(s.id)+'"><td><strong>'+esc(s.name)+'</strong><small>'+esc(s.category)+' · '+esc(s.service_code)+' · '+esc(s.unit)+'</small></td><td>'+money(s.default_rate)+'</td><td>'+esc(s.status)+'</td><td>'+(tenantId?'<div class="rate-entry"><input aria-label="Payout for '+esc(s.name)+'" class="individual-rate" type="number" min="0" max="100000" step="0.01" value="'+esc(showValue)+'"><select aria-label="Rate mode" class="individual-mode">'+choices+'</select></div>':'<small>Choose C/TPA to override</small>')+'</td><td>'+(canManage?'<div class="rate-entry"><button type="button" data-edit-service="'+esc(s.id)+'" class="secondary">Edit service</button>'+(tenantId?'<button type="button" data-save-rate="'+esc(s.id)+'">Save C/TPA rate</button>':'')+'</div>':'View only')+'</td></tr>';
  }).join(""):'<tr><td colspan="5" class="ctpa-rate-pending">No matching services</td></tr>';
  $("providerRows").querySelectorAll("[data-edit-service]").forEach(b=>b.onclick=()=>openService(b.dataset.editService));
  $("providerRows").querySelectorAll("[data-save-rate]").forEach(b=>b.onclick=()=>void saveRate(b));
 }
 async function load(){
  tenantId=$("providerTenant").value;activeContext=$("providerContext").value;status("Loading compensation rates…");
  try{const result=await api("list",{tenant_id:tenantId||null,operating_context:activeContext});services=result.services||[];canManage=!!result.can_manage;filterRows();status(services.length+" services loaded. "+(tenantId?"Individual C/TPA rates can be saved here.":"Choose a C/TPA to edit their rates."))}
  catch(error){$("providerRows").innerHTML='<tr><td colspan="5">Unable to load provider services.</td></tr>';status(error.message)}
 }
 function openService(id){
  const record=services.find(s=>s.id===id),form=$("providerServiceForm");
  form.reset();
  form.elements.id.value=record?.id||"";
  for(const field of ["name","service_code","category","description","unit","operating_context","status","default_rate"]){
   if(record&&form.elements[field])form.elements[field].value=record[field]??"";
  }
  if(!record){form.elements.unit.value="per service";form.elements.operating_context.value="both";form.elements.status.value="draft"}
  $("providerEditTitle").textContent=record?"Edit provider service":"Create provider service";
  $("providerEditPanel").hidden=false;$("providerEditPanel").scrollIntoView({behavior:"smooth",block:"start"});
 }
 async function saveRate(button){
  if(!tenantId){status("Choose a C/TPA");return}
  const tr=button.closest("[data-provider-service]"),mode=tr.querySelector(".individual-mode").value,value=tr.querySelector(".individual-rate").value;
  if(mode==="published"&&(value.trim()===""||!Number.isFinite(Number(value))||Number(value)<0)){status("Enter an approved compensation rate");return}
  button.disabled=true;status("Saving individual rate…");
  try{await api("set_rate",{tenant_id:tenantId,service_id:button.dataset.saveRate,status:mode,rate:mode==="published"?Number(value):null});await load();status("C/TPA compensation rate saved.")}
  catch(error){status(error.message)}finally{button.disabled=false}
 }
 $("providerTenant").onchange=()=>void load();$("providerContext").onchange=()=>void load();$("providerRefresh").onclick=()=>void load();
 $("providerFind").oninput=e=>{search=e.target.value;filterRows()};
 $("providerNew").onclick=()=>openService(null);$("providerCancel").onclick=()=>{$("providerEditPanel").hidden=true};
 $("providerServiceForm").onsubmit=async e=>{
  e.preventDefault();const form=e.currentTarget,b=$("providerSaveService");b.disabled=true;status("Saving service…");
  try{const body=Object.fromEntries(new FormData(form).entries());body.default_rate=body.default_rate===""?null:Number(body.default_rate);const action=body.id?"update_service":"create_service";await api(action,body);$("providerEditPanel").hidden=true;await load();status("Service saved successfully.")}
  catch(error){status(error.message)}finally{b.disabled=false}
 };
 const result=await api("organizations");
 $("providerTenant").innerHTML='<option value="">Default service catalog</option>'+(result.organizations||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
 await load();
}catch(e){console.error("[CTPA Provider Rates]",e);const root=document.getElementById("dotPageMount")||document.getElementById("providerInitialLoading");if(root)root.textContent="Unable to load provider compensation management: "+String(e.message||e)}
})();