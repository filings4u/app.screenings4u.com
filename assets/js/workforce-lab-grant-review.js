(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=v=>/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(String(v||''));
const approvalPhrase='ACTIVATE LAB ACCOUNT';
let selected=null,approvedReady=false,busy=false;
async function invoke(action,extra={}){
 const {data,error}=await dotSupabase.functions.invoke('workforce-lab-grant-approval',{body:{action,...extra}});
 if(error||data?.error)throw new Error(data?.error||error?.message||'Unable to load Lab Account grants');
 return data;
}
function message(text,isError=false){
 const el=document.getElementById('wfGrantStatus');if(!el)return;
 el.textContent=text;el.classList.toggle('wf-error',isError);
}
function setBusy(value){
 busy=value;
 document.querySelectorAll('[data-grant-action]').forEach(button=>button.disabled=busy);
 const approve=document.getElementById('wfGrantApprove');
 if(approve)approve.disabled=busy||!approvedReady||document.getElementById('wfGrantConfirm')?.value!==approvalPhrase;
}
function resetReview(){
 selected=null;approvedReady=false;
 const panel=document.getElementById('wfGrantReview');
 if(panel)panel.hidden=true;
 const input=document.getElementById('wfGrantConfirm');if(input)input.value='';
}
function row(g){
 const id=esc(g.id),status=esc(g.status||'unknown');
 return '<tr><td><code>'+id+'</code></td><td><code>'+esc(g.organization_id||'')+'</code></td><td><code>'+esc(g.ctpa_id||'')+'</code></td><td><span class="wf-pill '+(g.status==='pending'?'pending':g.status==='active'?'active':'')+'">'+status+'</span></td><td>'+esc(g.grant_source||'—')+'</td><td><button type="button" class="secondary" data-grant-action="review" data-id="'+id+'">Review</button></td></tr>';
}
async function load(){
 resetReview();setBusy(true);message('Loading verified grants…');
 try{
  const data=await invoke('list');
  const grants=(data.grants||[]).filter(g=>uuid(g.id));
  const tbody=document.getElementById('wfGrantRows');
  tbody.innerHTML=grants.map(row).join('')||'<tr><td colspan="6">No Lab Account company grants were returned.</td></tr>';
  const pending=grants.filter(g=>g.status==='pending').length;
  message(grants.length+' company grant(s) found. '+pending+' awaiting review.');
 }catch(error){
  document.getElementById('wfGrantRows').innerHTML='<tr><td colspan="6">Grant records unavailable. Check management permissions and service deployment.</td></tr>';
  message(error.message||String(error),true);
 }finally{setBusy(false)}
}
async function review(id){
 if(!uuid(id))return;
 resetReview();setBusy(true);message('Checking purchase, company and laboratory readiness…');
 try{
  const data=await invoke('review',{grant_id:id});
  selected=id;approvedReady=data.ready===true&&data.status==='pending';
  const panel=document.getElementById('wfGrantReview');panel.hidden=false;
  document.getElementById('wfGrantReviewId').textContent=id;
  document.getElementById('wfGrantDecision').textContent=approvedReady?'All automated checks passed. Final staff verification is still required.':'Approval blocked. Resolve the items below before activating access.';
  const reasons=data.reasons||[];
  document.getElementById('wfGrantReasons').innerHTML=reasons.length?reasons.map(r=>'<li>'+esc(r)+'</li>').join(''):'<li>No automated blockers reported.</li>';
  document.getElementById('wfGrantApprovalPanel').hidden=!approvedReady;
  message(approvedReady?'Eligible for final manual approval. No changes made.':'The selected grant is not eligible for approval.');
 }catch(error){message(error.message||String(error),true)}
 finally{setBusy(false)}
}
async function approve(){
 if(busy||!selected||!approvedReady)return;
 const input=document.getElementById('wfGrantConfirm');
 if(input.value!==approvalPhrase)return;
 // Explicit typed confirmation; the backend independently rechecks the grant and role.
 setBusy(true);message('Rechecking eligibility and submitting approval…');
 try{
  const data=await invoke('approve',{grant_id:selected,confirmation:approvalPhrase});
  message('Approval recorded for grant '+(data.grant?.id||selected)+'. Refreshing records.');
  await load();
 }catch(error){message(error.message||String(error),true);resetReview()}
 finally{setBusy(false)}
}
async function start(){
 const state=await DOTAuth.requireAuth();if(!state)return;
 DOTShell.render(state);
 const root=document.getElementById('dotPageMount');if(!root)return;
 root.innerHTML='<section class="dot-page wf-grants"><header><span class="wf-eyebrow">WORKFORCE · LAB ACCOUNT ENTITLEMENTS</span><h1>Lab Account Grant Review</h1><p>Review company-level Lab Account purchases and activation readiness. Approval is restricted to authorized Workforce testing management staff.</p></header><div class="wf-note"><strong>Separate from laboratory onboarding.</strong> A paid purchase is not proof that setup is complete. This page does not create tests, change pricing, assign lab numbers, or bypass the original Lab Account portal.</div><div class="wf-actions"><button data-grant-action="refresh" type="button" id="wfGrantRefresh">Refresh verified grants</button><a href="lab-overview.html">Return to Lab Account Overview</a></div><p class="wf-status" id="wfGrantStatus" role="status" aria-live="polite"></p><div class="wf-table-wrap"><table><thead><tr><th>Grant ID</th><th>Company ID</th><th>C/TPA ID</th><th>Status</th><th>Source</th><th>Review</th></tr></thead><tbody id="wfGrantRows"><tr><td colspan="6">Loading…</td></tr></tbody></table></div><section class="wf-review" id="wfGrantReview" hidden><h2>Grant readiness</h2><p><span class="wf-label">Grant:</span> <code id="wfGrantReviewId"></code></p><p id="wfGrantDecision"></p><ul class="wf-review-list" id="wfGrantReasons"></ul><div id="wfGrantApprovalPanel" hidden><p>Verify the purchase and company record with your approved internal process before activating access. Type the exact confirmation below.</p><label class="wf-approve-confirm" for="wfGrantConfirm"><span class="wf-label">Type '+approvalPhrase+'</span><input id="wfGrantConfirm" type="text" autocomplete="off" spellcheck="false"></label><button class="approve" id="wfGrantApprove" type="button" data-grant-action="approve" disabled>Approve and activate company grant</button></div></section></section>';
 root.addEventListener('click',event=>{
  const button=event.target.closest('[data-grant-action]');if(!button||busy)return;
  if(button.dataset.grantAction==='refresh')load();
  if(button.dataset.grantAction==='review')review(button.dataset.id);
  if(button.dataset.grantAction==='approve')approve();
 });
 root.addEventListener('input',event=>{
  if(event.target.id==='wfGrantConfirm'){const button=document.getElementById('wfGrantApprove');if(button)button.disabled=busy||!approvedReady||event.target.value!==approvalPhrase;}
 });
 await load();
}
addEventListener('DOMContentLoaded',()=>start().catch(e=>{console.error(e);const el=document.getElementById('wfGrantStatus');if(el)el.textContent='Failed to load: '+String(e.message||e)}),{once:true});
})();