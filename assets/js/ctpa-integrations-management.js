(async()=>{"use strict";
const $=id=>document.getElementById(id),esc=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#39;");
try{
 const session=await DOTAuth.requireAuth();if(!session)return;DOTShell.render(session);
 const root=$("dotPageMount"),sb=window.dotSupabase;if(!root||!sb)throw Error("Workforce staff session unavailable");
 let requests=[],catalog=[],organizations=[],canEdit=false,search="",filter="all";
 const api=async(action,body={})=>{
  const token=(await sb.auth.getSession()).data?.session?.access_token;if(!token)throw Error("Workforce staff session expired");
  const response=await fetch("https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/management-ctpa-integrations-v2",{method:"POST",cache:"no-store",headers:{"Authorization":"Bearer "+token,"apikey":window.DOT_PORTAL_CONFIG.supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({action,...body})});
  const d=await response.json().catch(()=>({}));if(!response.ok||d.error)throw Error(d.error||"Integration management unavailable");return d;
 };
 root.innerHTML='<div class="int-admin"><header class="int-admin-hero"><small>WORKFORCE / C/TPA ENTERPRISE SERVICES</small><h1>Integration Approvals & Setup</h1><p>Review integration requests, approve supported providers, coordinate connection setup and make integrations available after verified testing.</p></header><section class="int-admin-panel"><h2>Integration Requests</h2><div class="int-admin-note">Approval does not activate an integration. Workforce must configure and successfully test each provider connection before marking it connected. Passwords and API secrets must never be entered in request notes.</div><div class="int-admin-controls"><input type="search" id="intAdminSearch" placeholder="Search organization or integration"><select id="intAdminFilter"><option value="all">All statuses</option><option value="requested">Requested</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="configuration">Configuring</option><option value="connected">Connected</option><option value="rejected">Rejected</option><option value="disabled">Disabled</option></select><button type="button" id="intAdminRefresh">Refresh</button></div><div id="intAdminRequests"></div></section><p class="int-admin-status" role="status" id="intAdminStatus"></p></div>';
 const say=x=>{$("intAdminStatus").textContent=x};
 const named=(id)=>catalog.find(x=>x.id===id)?.name||"Integration";
 const org=(id)=>organizations.find(x=>x.id===id)?.name||"C/TPA";
 const transitions={requested:["under_review","rejected"],under_review:["approved","rejected"],approved:["configuration","rejected"],configuration:["connected","rejected"],connected:["disabled"],rejected:[],disabled:[]};
 function draw(){
  const filtered=requests.filter(r=>(filter==="all"||r.status===filter)&&[named(r.catalog_id),org(r.tenant_id),r.status].join(" ").toLowerCase().includes(search.toLowerCase()));
  $("intAdminRequests").innerHTML=filtered.length?filtered.map(r=>'<article class="int-admin-request"><div><strong>'+esc(named(r.catalog_id))+'</strong><small>'+esc(org(r.tenant_id))+'</small><small>Requested '+esc(new Date(r.created_at).toLocaleDateString())+'</small></div><div><strong>'+esc(r.status.replaceAll("_"," "))+'</strong><p>'+esc(r.request_notes||"No customer notes.")+'</p>'+(r.admin_notes?'<small>Workforce notes: '+esc(r.admin_notes)+'</small>':"")+'</div><div>'+(canEdit&&transitions[r.status]?.length?'<select id="intAdminState-'+esc(r.id)+'"><option value="">Choose next step</option>'+transitions[r.status].map(x=>'<option value="'+x+'">'+x.replaceAll("_"," ")+'</option>').join("")+'</select><textarea id="intAdminNotes-'+esc(r.id)+'" rows="2" maxlength="2000" placeholder="Internal setup instructions or customer-facing update">'+esc(r.admin_notes||"")+'</textarea><button type="button" data-save="'+esc(r.id)+'">Update Request</button>':'<small>No further workflow actions are available.</small>')+'</div></article>').join(""):'<div class="int-admin-empty">No integration requests match your selection.</div>';
  $("intAdminRequests").querySelectorAll("[data-save]").forEach(btn=>btn.onclick=async()=>{
   const id=btn.dataset.save,state=$("intAdminState-"+id)?.value,notes=$("intAdminNotes-"+id)?.value;if(!state){say("Select a status before updating.");return}
   btn.disabled=true;say("Updating integration request…");
   try{await api("update",{id,status:state,notes});await refresh();say("Integration request updated. Connected status requires a verified provider connection.")}catch(e){say(e.message);btn.disabled=false}
  });
 }
 async function refresh(){const r=await api("list");requests=r.requests||[];catalog=r.catalog||[];organizations=r.organizations||[];canEdit=!!r.can_edit;draw()}
 $("intAdminSearch").oninput=e=>{search=e.target.value;draw()};$("intAdminFilter").onchange=e=>{filter=e.target.value;draw()};$("intAdminRefresh").onclick=()=>void refresh().catch(e=>say(e.message));
 await refresh();say("Workforce integration approval queue loaded.");
}catch(e){console.error("[Integration approvals]",e);const target=document.getElementById("dotPageMount")||document.getElementById("intAdminInit");if(target)target.textContent="Unable to load integration management: "+(e.message||String(e))}
})();