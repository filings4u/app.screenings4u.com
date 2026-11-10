(async()=>{"use strict";
 const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
 const root=document.getElementById("dotPageMount");if(!root)return;
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const labels={marketing:"Website Inquiry",contractor:"Independent Contractor",lab_support:"Lab Support",lab_account_order:"Lab Account Order",lab_testing_request:"Testing Request"};
 const fmt=x=>x?new Date(x).toLocaleString():"—";
 const title='<section class="nd-page nd-management-page"><div class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE MANAGEMENT</span><h1>Customer Requests</h1><p>Website inquiries, Lab Account orders and tickets, and Independent Contractor submissions from the connected portals.</p></div><div class="nd-actions"><a class="nd-btn" href="workforce-dashboard.html">Dashboard</a><button id="refresh" class="nd-btn primary" type="button">Refresh</button></div></div><div id="inboxBody" aria-live="polite">Loading requests…</div></section>';
 root.innerHTML=title;
 let all=[];
 function paint(){
  const q=String(document.getElementById("inboxSearch")?.value||"").toLowerCase(),kind=document.getElementById("inboxKind")?.value||"all";
  const rows=all.filter(x=>(kind==="all"||x.source===kind)&&[x.reference,x.subject,x.customer,x.status].some(y=>String(y||"").toLowerCase().includes(q)));
  document.getElementById("inboxList").innerHTML=rows.length?rows.map(x=>'<tr><td><strong>'+esc(labels[x.source]||x.source)+'</strong></td><td>'+esc(x.reference)+'</td><td>'+esc(x.subject)+'</td><td>'+esc(x.customer)+'</td><td>'+esc(x.status)+'</td><td>'+esc(fmt(x.created_at))+'</td><td><a class="nd-btn nd-btn-small primary" href="'+esc(x.destination+(x.source==='lab_support'?'?ticket='+encodeURIComponent(x.id):''))+'">Manage</a></td></tr>').join(""):'<tr><td colspan="7" style="padding:28px;text-align:center">No matching requests</td></tr>';
  document.getElementById("inboxCount").textContent=rows.length+" records";
 }
 async function load(){
  const body=document.getElementById("inboxBody");body.textContent="Loading requests…";
  try{
   const session=await dotSupabase.auth.getSession();const token=session.data?.session?.access_token;
   if(!token)throw Error("Staff session required");
   const config=window.DOT_PORTAL_CONFIG;
   const r=await fetch(config.supabaseUrl+"/functions/v1/workforce-inbox-management",{method:"POST",headers:{"Content-Type":"application/json",apikey:config.supabaseAnonKey,Authorization:"Bearer "+token},body:JSON.stringify({action:"list"})});
   const d=await r.json();if(!r.ok||d.error)throw Error(d.error||"Unable to load requests");
   all=d.rows||[];
   body.innerHTML='<div class="nd-card" style="padding:18px;margin:15px 0"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><input id="inboxSearch" type="search" placeholder="Search requests and customers" aria-label="Search requests" style="min-height:38px;padding:9px;flex:1;min-width:220px;border:1px solid #d6e2f0;border-radius:8px"><select id="inboxKind" aria-label="Request source" style="min-height:38px;padding:9px;border:1px solid #d6e2f0;border-radius:8px"><option value="all">All Requests</option>'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join("")+'</select><strong id="inboxCount"></strong></div></div><div class="nd-card"><div class="nd-table-wrap"><table class="nd-table"><thead><tr><th>Source</th><th>Reference</th><th>Request</th><th>Customer</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead><tbody id="inboxList"></tbody></table></div></div>';
   document.getElementById("inboxSearch").addEventListener("input",paint);
   document.getElementById("inboxKind").addEventListener("change",paint);paint();
  }catch(e){body.textContent="Unable to load customer requests: "+(e.message||"Unknown error");}
 }
 document.getElementById("refresh").addEventListener("click",load);await load();
})();