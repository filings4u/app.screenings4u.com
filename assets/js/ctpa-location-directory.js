(async()=>{"use strict";
const $=id=>document.getElementById(id),esc=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#39;");
try{
 const session=await DOTAuth.requireAuth();if(!session)return;
 DOTShell.render(session);
 const root=$("dotPageMount"),sb=window.dotSupabase;if(!root||!sb)throw Error("Workforce management session unavailable");
 root.innerHTML='<div class="ctpa-rate-page"><section class="ctpa-rate-hero"><small>WORKFORCE / CUSTOMER DIRECTORY</small><h1>C/TPA Business Locations</h1><p>This is the live location directory entered by C/TPA account owners. Locations are shared across DOT and NON-DOT and updates appear here automatically when refreshed.</p></section><section class="ctpa-rate-panel"><div class="ctpa-rate-grid"><label>Choose C/TPA<select id="locAdminTenant"><option value="">Select organization</option></select></label></div><div class="ctpa-rate-controls"><button id="locAdminRefresh" type="button">Refresh Locations</button></div><div class="ctpa-rate-status" id="locAdminStatus" role="status"></div></section><section class="ctpa-rate-panel"><h2>Registered Business Locations</h2><div id="locAdminResults">Select an organization to view its locations.</div></section></div>';
 const say=x=>{$("locAdminStatus").textContent=x};
 const api=async(action,extra={})=>{
  const token=(await sb.auth.getSession()).data?.session?.access_token;if(!token)throw Error("Staff session expired");
  const res=await fetch("https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/management-ctpa-locations",{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json","apikey":window.DOT_PORTAL_CONFIG.supabaseAnonKey},body:JSON.stringify({action,...extra})});
  const data=await res.json().catch(()=>({}));if(!res.ok||data.error)throw Error(data.error||"Unable to retrieve locations");return data;
 };
 let ticket=0;
 const load=async()=>{
  const tenant=$("locAdminTenant").value,seq=++ticket;if(!tenant){$("locAdminResults").textContent="Select an organization.";return}
  say("Loading locations…");
  try{
   const r=await api("list",{tenant_id:tenant});if(seq!==ticket)return;
   const items=r.locations||[];
   $("locAdminResults").innerHTML=items.length?'<div class="loc-admin-list">'+items.map(l=>'<article class="loc-admin-card">'+(l.is_primary?'<span class="loc-admin-primary">Primary</span>':'')+'<h3>'+esc(l.name)+'</h3><strong>'+esc(l.business_name)+'</strong><p>'+esc(l.address_line1)+(l.address_line2?'<br>'+esc(l.address_line2):'')+'<br>'+esc(l.city)+', '+esc(l.state)+' '+esc(l.postal_code)+'<br>'+esc(l.country)+'</p><small>Phone: '+esc(l.phone||"Not specified")+'</small><small>Email: '+esc(l.email||"Not specified")+'</small><small>Type: '+esc(l.location_type.replaceAll("_"," "))+'</small><small>Updated: '+esc(l.updated_at?.slice(0,10)||"—")+'</small></article>').join("")+'</div>':'<p>No registered locations. This C/TPA must complete first-location onboarding.</p>';
   say(items.length+" business locations available to Workforce.");
  }catch(e){if(seq!==ticket)return;say(e.message);$("locAdminResults").textContent="Could not load C/TPA location records."}
 };
 $("locAdminTenant").onchange=()=>void load();$("locAdminRefresh").onclick=()=>void load();
 const organizations=await api("organizations");
 $("locAdminTenant").innerHTML='<option value="">Select organization</option>'+(organizations.organizations||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join("");
 say("Select a C/TPA to view its live company locations.");
}catch(e){console.error("[CTPA locations management]",e);const target=document.getElementById("dotPageMount")||document.getElementById("ctpaLocationsLoading");if(target)target.textContent="C/TPA location directory unavailable: "+String(e.message||e)}
})();