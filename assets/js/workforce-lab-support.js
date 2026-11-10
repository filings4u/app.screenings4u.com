(async()=>{"use strict";
 const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
 const root=document.getElementById("dotPageMount");if(!root)return;
 const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const fmt=v=>v?new Date(v).toLocaleString():"—";
 const config=window.DOT_PORTAL_CONFIG;
 async function api(body){
  const r=await dotSupabase.auth.getSession(),token=r.data?.session?.access_token;
  if(!token)throw Error("Staff authentication required");
  const res=await fetch(config.supabaseUrl+"/functions/v1/testing-support-management",{method:"POST",headers:{"Content-Type":"application/json",apikey:config.supabaseAnonKey,Authorization:"Bearer "+token},body:JSON.stringify(body)});
  const data=await res.json();if(!res.ok||data.error)throw Error(data.error||"Support request failed");return data;
 }
 root.innerHTML='<section class="nd-page nd-management-page"><div class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE MANAGEMENT</span><h1>Lab Account Support</h1><p>Respond to customers and review their laboratory account support tickets.</p></div><div class="nd-actions"><a class="nd-btn" href="workforce-inbox.html">Customer Requests</a></div></div><div id="labSupport" aria-live="polite">Loading tickets…</div></section>';
 const body=document.getElementById("labSupport");
 async function detail(id){
  const d=await api({action:"get",ticket_id:id}),t=d.ticket;
  const items=(d.messages||[]).filter(x=>!x.is_internal_note);
  body.innerHTML='<div class="nd-card" style="padding:20px;margin-top:16px"><a class="nd-btn" href="workforce-lab-support.html">Back to Lab Support</a><h2>'+esc(t.subject)+'</h2><p>Ticket '+esc(t.ticket_number)+' · '+esc(t.requester_email)+' · '+esc(t.status)+'</p><div style="display:grid;gap:10px;margin:20px 0">'+items.map(m=>'<article style="border:1px solid #dce6f0;border-radius:10px;padding:14px"><strong>'+esc(m.sender_type==="customer"?"Customer":"Workforce Support")+'</strong><small style="float:right">'+esc(fmt(m.created_at))+'</small><p style="white-space:pre-wrap">'+esc(m.body)+'</p></article>').join("")+'</div><form id="sendLabReply"><label for="labMessage">Reply to customer</label><textarea id="labMessage" rows="5" required maxlength="20000" style="display:block;width:100%;border:1px solid #cbd9eb;border-radius:8px;padding:12px;margin:8px 0 15px"></textarea><button class="nd-btn primary" type="submit">Send Reply</button></form><p id="labStatus" role="status"></p></div>';
  document.getElementById("sendLabReply").onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector("button"),text=document.getElementById("labMessage").value.trim();if(!text)return;button.disabled=true;try{await api({action:"reply",ticket_id:id,body:text});document.getElementById("labStatus").textContent="Reply saved and customer notification requested.";await detail(id)}catch(err){document.getElementById("labStatus").textContent=err.message}finally{button.disabled=false}};
 }
 async function list(){
  const d=await api({action:"list"}),rows=(d.tickets||[]).filter(x=>x.source==="lab_account_portal");
  body.innerHTML='<div class="nd-card" style="margin-top:16px"><div class="nd-table-wrap"><table class="nd-table"><thead><tr><th>Ticket</th><th>Customer</th><th>Subject</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>'+ (rows.length?rows.map(x=>'<tr><td>'+esc(x.ticket_number)+'</td><td>'+esc(x.requester_email)+'</td><td>'+esc(x.subject)+'</td><td>'+esc(x.status)+'</td><td>'+esc(fmt(x.updated_at))+'</td><td><a class="nd-btn nd-btn-small primary" href="workforce-lab-support.html?ticket='+encodeURIComponent(x.id)+'">Reply</a></td></tr>').join(""):'<tr><td colspan="6" style="padding:24px;text-align:center">No Lab Account support tickets yet</td></tr>')+'</tbody></table></div></div>';
 }
 try{const ticket=new URLSearchParams(location.search).get("ticket");if(ticket&&/^[0-9a-f-]{36}$/i.test(ticket))await detail(ticket);else await list()}catch(e){body.textContent="Unable to load Lab Account support: "+e.message}
})();