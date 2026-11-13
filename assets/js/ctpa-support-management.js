(async()=>{"use strict";
const $=id=>document.getElementById(id),esc=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#39;");
try{
 const session=await DOTAuth.requireAuth();if(!session)return;DOTShell.render(session);
 const root=$("dotPageMount"),sb=window.dotSupabase;if(!root||!sb)throw Error("Workforce staff session unavailable");
 let tenant="",tickets=[],selected=null,canWrite=false,timer=null;
 const api=async(action,data={})=>{
  const token=(await sb.auth.getSession()).data?.session?.access_token;if(!token)throw Error("Workforce staff session expired");
  const response=await fetch("https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/management-ctpa-support-v2",{method:"POST",cache:"no-store",headers:{"Authorization":"Bearer "+token,"apikey":window.DOT_PORTAL_CONFIG.supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({action,...data})});
  const out=await response.json().catch(()=>({}));if(!response.ok||out.error)throw Error(out.error||"Workforce Support unavailable");return out;
 };
 root.innerHTML='<div class="wf-support-app"><header class="wf-support-hero"><small>WORKFORCE / C/TPA CUSTOMER SUPPORT</small><h1>Support Tickets & Conversations</h1><p>Respond directly to C/TPAs through their Workforce Support portal. Chat and ticket replies share the same conversation.</p><div class="wf-support-tools"><select id="wfSupportTenant"><option value="">Choose C/TPA organization</option></select><button id="wfSupportRefresh" type="button">Refresh Tickets</button></div></header><section class="wf-support-board"><aside class="wf-support-list" id="wfSupportTickets">Select a C/TPA to view support requests.</aside><section class="wf-support-room" id="wfSupportRoom"><p class="wf-support-welcome">Select a support ticket to begin.</p></section></section><p id="wfSupportStatus" role="status" class="wf-support-status"></p></div>';
 const say=s=>{$("wfSupportStatus").textContent=s};
 async function list(){
  if(!tenant){$("wfSupportTickets").textContent="Choose a C/TPA organization.";return}
  const result=await api("list",{tenant_id:tenant});tickets=result.tickets||[];canWrite=result.can_write;
  $("wfSupportTickets").innerHTML=tickets.length?tickets.map(t=>'<button type="button" class="'+(selected===t.id?"selected":"")+'" data-support-ticket="'+esc(t.id)+'"><strong>'+esc(t.subject)+'</strong><small>'+esc(t.status.replaceAll("_"," "))+' · '+esc(t.priority)+' priority · '+esc(t.operating_context.toUpperCase())+'</small><small>'+esc(new Date(t.last_message_at).toLocaleString())+'</small></button>').join(""):'<p style="padding:20px;color:#627890">No support tickets for this organization.</p>';
  $("wfSupportTickets").querySelectorAll("[data-support-ticket]").forEach(b=>b.onclick=()=>void open(b.dataset.supportTicket));
 }
 async function history(id){
  if(selected!==id)return;const result=await api("history",{tenant_id:tenant,ticket_id:id});
  if(selected!==id)return;const el=$("wfSupportMessages");if(!el)return;
  const near=el.scrollHeight-el.scrollTop-el.clientHeight<140;
  el.innerHTML=(result.messages||[]).map(m=>'<div class="wf-support-bubble '+esc(m.sender_type)+'"><strong>'+esc(m.sender_type==="staff"?"Workforce Support":"C/TPA")+'</strong><div>'+esc(m.body)+'</div><small>'+esc(new Date(m.created_at).toLocaleString())+'</small></div>').join("")||'<p>No messages.</p>';
  if(near)el.scrollTop=el.scrollHeight;
 }
 async function open(id){
  selected=id;const ticket=tickets.find(x=>x.id===id);if(!ticket)return;await list();
  $("wfSupportRoom").innerHTML='<div class="wf-support-room-head"><div><h2>'+esc(ticket.subject)+'</h2><small>'+esc(ticket.operating_context.toUpperCase())+' · '+esc(ticket.priority)+' priority</small></div><div class="wf-support-actions"><select id="wfSupportTicketStatus"><option value="open">Open</option><option value="in_progress">In Progress</option><option value="waiting_for_customer">Waiting for Customer</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div></div><div class="wf-support-messages" id="wfSupportMessages"></div><form id="wfSupportSend" class="wf-support-send"><textarea name="message" maxlength="8000" required rows="3" placeholder="Type a response to the C/TPA…" '+(!canWrite||ticket.status==="closed"?"disabled":"")+'></textarea><button type="submit" '+(!canWrite||ticket.status==="closed"?"disabled":"")+'>Send Response</button></form>';
  $("wfSupportTicketStatus").value=ticket.status;$("wfSupportTicketStatus").disabled=!canWrite;
  $("wfSupportTicketStatus").onchange=async e=>{try{await api("status",{tenant_id:tenant,ticket_id:id,status:e.target.value});await list();say("Ticket status updated")}catch(err){say(err.message)}};
  $("wfSupportSend").onsubmit=async e=>{
   e.preventDefault();const field=e.currentTarget.elements.message,message=field.value.trim();if(!message)return;
   const btn=e.currentTarget.querySelector("button");btn.disabled=true;say("Sending reply…");
   try{await api("send",{tenant_id:tenant,ticket_id:id,message});field.value="";await history(id);await list();say("Response saved and notification queued.")}catch(err){say(err.message)}finally{btn.disabled=false}
  };
  await history(id);
 }
 $("wfSupportTenant").onchange=()=>{tenant=$("wfSupportTenant").value;selected=null;$("wfSupportRoom").innerHTML='<p class="wf-support-welcome">Select a ticket.</p>';void list().catch(e=>say(e.message))};
 $("wfSupportRefresh").onclick=()=>void list().catch(e=>say(e.message));
 const orgs=await api("organizations");canWrite=orgs.can_write;
 $("wfSupportTenant").innerHTML='<option value="">Choose C/TPA organization</option>'+(orgs.organizations||[]).map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>').join("");
 timer=setInterval(()=>{if(document.hidden)return;if(tenant)void list().then(()=>selected?history(selected):null).catch(e=>say(e.message))},9000);
 window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
 say("Workforce Support inbox ready.");
}catch(e){console.error("[C/TPA Support Management]",e);const root=document.getElementById("dotPageMount")||document.getElementById("supportInitial");if(root)root.textContent="Unable to load Workforce Support: "+(e.message||String(e))}
})();