(async()=>{"use strict";
 const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
 const root=document.getElementById("dotPageMount");if(!root)return;
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const id=new URLSearchParams(location.search).get("id");
 root.innerHTML='<section class="nd-page nd-management-page"><div class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE MANAGEMENT</span><h1>Independent Contractor Request</h1><p>Review the customer submission received from the IC portal.</p></div><div class="nd-actions"><a class="nd-btn" href="workforce-inbox.html">Back to Requests</a></div></div><div id="icRequest">Loading request…</div></section>';
 const box=document.getElementById("icRequest");
 try{
  if(!id||!/^[0-9a-f-]{36}$/i.test(id))throw Error("Invalid request reference");
  const session=await dotSupabase.auth.getSession(),token=session.data?.session?.access_token;
  if(!token)throw Error("Staff authentication required");
  const c=window.DOT_PORTAL_CONFIG,r=await fetch(c.supabaseUrl+"/functions/v1/workforce-inbox-management",{method:"POST",headers:{"Content-Type":"application/json",apikey:c.supabaseAnonKey,Authorization:"Bearer "+token},body:JSON.stringify({action:"ic_detail",id})});
  const data=await r.json();if(!r.ok||data.error)throw Error(data.error||"Request unavailable");
  const record=data.record||{},details=record.details||{};
  box.innerHTML='<div class="nd-card" style="padding:23px;margin-top:16px"><h2>'+esc(record.title)+'</h2><p><b>Status:</b> '+esc(record.status)+' · <b>Section:</b> '+esc(record.section)+' · <b>Submitted:</b> '+esc(new Date(record.created_at).toLocaleString())+'</p><p><b>Contractor:</b> '+esc(record.customer_email)+'</p><div style="margin-top:22px"><h3>Submission details</h3><table class="nd-table"><tbody>'+Object.entries(details).filter(([k])=>!/(token|secret|password|path)/i.test(k)).map(([k,v])=>'<tr><th style="width:220px">'+esc(k.replaceAll("_"," "))+'</th><td style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(typeof v==="object"?JSON.stringify(v):v)+'</td></tr>').join("")+'</tbody></table></div><p style="margin-top:22px"><a class="nd-btn primary" href="ic-operations.html">IC Operations</a></p></div>';
 }catch(e){box.textContent="Unable to view request: "+e.message}
})();