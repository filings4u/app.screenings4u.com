(async()=>{"use strict";
const $=id=>document.getElementById(id),esc=x=>String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\x27/g,"&#39;");
try{
 const session=await DOTAuth.requireAuth();if(!session)return;DOTShell.render(session);
 const root=$("dotPageMount"),sb=window.dotSupabase;if(!root||!sb)throw Error("Workforce staff session unavailable");
 let tenant="",tab="notices",canWrite=false,records={notices:[],replies:[]};
 root.innerHTML='<div class="ctpa-rate-page"><section class="ctpa-rate-hero"><small>WORKFORCE / C/TPA ACCOUNT COMMUNICATIONS</small><h1>Notifications & Support Replies</h1><p>Publish official notices to C/TPA accounts and review replies submitted through the C/TPA Support page. Separate from private C/TPA/employer messaging.</p></section><section class="ctpa-rate-panel"><div class="ctpa-rate-grid"><label>Select C/TPA account<select id="adminNoticeTenant"><option value="">Select organization</option></select></label></div><div class="ctpa-rate-controls"><button type="button" id="adminNoticesRefresh">Refresh</button></div><div id="adminNoticeStatus" role="status" class="ctpa-rate-status"></div></section><section class="ctpa-rate-panel"><h2>Create Workforce Notification</h2><form id="adminNoticeForm"><div class="wf-notice-form-grid"><label class="wide">Notice title<input name="title" required maxlength="180" placeholder="Account update"></label><label>Category<select name="category"><option value="general">General</option><option value="billing">Billing</option><option value="testing">Testing</option><option value="compliance">Compliance</option><option value="account">Account</option><option value="service">Service</option><option value="urgent">Urgent</option></select></label><label>Audience<select name="operating_context"><option value="shared">Both workspaces</option><option value="dot">DOT</option><option value="nondot">NON-DOT</option></select></label><label class="wide">Notice body<textarea name="body" rows="6" maxlength="8000" required placeholder="Full notice"></textarea></label><label class="checkbox wide"><input type="checkbox" name="reply_enabled"> Allow C/TPA to reply through Support</label></div><div class="ctpa-rate-controls"><button type="submit" id="adminNoticeSave">Save Draft</button></div></form></section><section class="ctpa-rate-panel"><div class="wf-notice-tabs"><button id="adminNoticeTab" class="active" type="button">Notices</button><button id="adminReplyTab" type="button">Support Replies</button></div><div id="adminNoticeContent">Select a C/TPA account to view its notices and support responses.</div></section></div>';
 const say=x=>{$("adminNoticeStatus").textContent=x};
 const api=async(action,other={})=>{
  const token=(await sb.auth.getSession()).data?.session?.access_token;if(!token)throw Error("Workforce staff session expired");
  const response=await fetch("https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/management-ctpa-notifications",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":window.DOT_PORTAL_CONFIG.supabaseAnonKey,"Content-Type":"application/json"},body:JSON.stringify({action,...other})});
  const out=await response.json().catch(()=>({}));if(!response.ok||out.error)throw Error(out.error||"Unable to manage notifications");return out;
 };
 function render(){
  $("adminNoticeTab").classList.toggle("active",tab==="notices");$("adminReplyTab").classList.toggle("active",tab==="replies");
  const rows=tab==="notices"?records.notices:records.replies;
  $("adminNoticeContent").innerHTML=rows.length?rows.map(r=>'<article class="wf-notice-admin-row"><div><strong>'+esc(tab==="notices"?r.title:r.subject)+'</strong><small>'+esc(tab==="notices"?(r.category+" · "+r.operating_context+" · "+r.status):(r.status+" · "+new Date(r.submitted_at).toLocaleString()))+'</small><p>'+esc(tab==="notices"?r.body:r.message)+'</p></div><div>'+(tab==="notices"&&canWrite&&r.status==="draft"?'<button data-notice-publish="'+esc(r.id)+'">Publish to C/TPA</button>':'')+(tab==="notices"&&canWrite&&r.status==="published"?'<button data-notice-archive="'+esc(r.id)+'">Archive</button>':'')+(tab==="replies"&&canWrite?'<select data-reply-status="'+esc(r.id)+'"><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>':'')+'</div></article>').join(""):'<p>No '+(tab==="notices"?"notices":"support replies")+' for this C/TPA.</p>';
  $("adminNoticeContent").querySelectorAll("[data-notice-publish]").forEach(b=>b.onclick=()=>void apply("publish",b.dataset.noticePublish));
  $("adminNoticeContent").querySelectorAll("[data-notice-archive]").forEach(b=>b.onclick=()=>void apply("archive",b.dataset.noticeArchive));
  $("adminNoticeContent").querySelectorAll("[data-reply-status]").forEach(s=>{const id=s.dataset.replyStatus;const record=rows.find(r=>r.id===id);s.value=record.status;s.onchange=()=>void apply("reply_status",id,{status:s.value})});
 }
 async function refresh(){if(!tenant){records={notices:[],replies:[]};$("adminNoticeContent").textContent="Select a C/TPA account.";return}const x=await api("list",{tenant_id:tenant});records=x;canWrite=x.can_write;render()}
 async function apply(action,id,extra={}){try{await api(action,{tenant_id:tenant,id,...extra});say("Record updated successfully.");await refresh()}catch(e){say(e.message)}}
 $("adminNoticeTenant").onchange=()=>{tenant=$("adminNoticeTenant").value;void refresh().catch(e=>say(e.message))};
 $("adminNoticesRefresh").onclick=()=>void refresh().catch(e=>say(e.message));
 $("adminNoticeTab").onclick=()=>{tab="notices";render()};$("adminReplyTab").onclick=()=>{tab="replies";render()};
 $("adminNoticeForm").onsubmit=async e=>{
  e.preventDefault();if(!tenant){say("Select a C/TPA organization first.");return}const button=$("adminNoticeSave"),form=e.currentTarget;
  button.disabled=true;say("Saving notice draft…");
  try{
   const fields=Object.fromEntries(new FormData(form).entries());fields.reply_enabled=form.elements.reply_enabled.checked;
   await api("create",{tenant_id:tenant,...fields});form.reset();say("Draft saved. Select Publish to make the notice visible to the C/TPA.");tab="notices";await refresh();
  }catch(error){say(error.message)}finally{button.disabled=false}
 };
 const loaded=await api("organizations");canWrite=loaded.can_write;
 $("adminNoticeTenant").innerHTML='<option value="">Select organization</option>'+(loaded.organizations||[]).map(o=>'<option value="'+esc(o.id)+'">'+esc(o.name)+'</option>').join("");
 if(!canWrite)$("adminNoticeForm").hidden=true;
 say("Choose a C/TPA organization. Draft notifications are not sent until published.");
}catch(e){console.error("[Management notifications]",e);const root=document.getElementById("dotPageMount")||document.getElementById("wfNoticesInitial");if(root)root.textContent="Unable to load notification management: "+(e.message||String(e))}
})();