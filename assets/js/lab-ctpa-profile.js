(async()=>{'use strict';
const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
const root=document.getElementById('dotPageMount');if(!root)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=new URLSearchParams(location.search).get('ctpa_id')||new URLSearchParams(location.search).get('id')||'';
const valid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
root.innerHTML='<div class="lab-wrap"><h1>Manage C/TPA Profile</h1><p id="profileNotice" role="status">Loading customer profile…</p><div class="lab-detail-nav"><a class="lab-action" href="lab-account-numbers.html">Lab Account Numbers</a><a class="lab-action" href="lab-account-intakes.html">Customer intakes</a><a class="lab-action" href="house-lab-fulfillment.html">Supplies &amp; invoices</a></div><div id="profileContent"></div></div>';
const notice=root.querySelector('#profileNotice'),mount=root.querySelector('#profileContent');
const invoke=async(body)=>{const {data,error}=await dotSupabase.functions.invoke('lab-account-management',{body});if(error||data?.error)throw Error(data?.error||error?.message||'Unable to manage C/TPA');return data;};
const fields=[['legal_name','Legal business name',true],['dba_name','DBA / trade name'],['phone','Business phone'],['website','Website'],['ein','EIN'],['address_line1','Street address'],['address_line2','Unit / suite'],['city','City'],['state_region','State'],['postal_code','ZIP code'],['support_email','Support email'],['support_phone','Support phone']];
const assign='lab-account-assignment.html?ctpa_id='+encodeURIComponent(id);
async function render(){
 const data=await invoke({action:'get_ctpa_profile',ctpa_id:id}),org=data.organization||{},ctpa=data.ctpa||{},accounts=data.accounts||[],purchases=data.purchases||[];
 if(!data.organization||!data.ctpa)throw Error('The C/TPA record could not be loaded');
 root.querySelector('h1').textContent=org.legal_name||'Manage C/TPA Profile';
 notice.textContent='One business profile · '+(ctpa.company_code||'C/TPA')+' · '+(ctpa.status||'unknown')+' · '+accounts.length+' lab account number(s)';
 const input=([key,label,required])=>'<label>'+esc(label)+'<input name="'+key+'" value="'+esc((key==='support_email'||key==='support_phone'?ctpa[key]:org[key])||'')+'" maxlength="250" '+(required?'required':'')+'></label>';
 mount.innerHTML='<div class="lab-panel"><div class="lab-detail-header"><div><h2>Business &amp; contact details</h2><p class="lab-muted">Edit the existing organization record. Changes are saved to the C/TPA profile used across Workforce.</p></div><span class="lab-pill">'+esc(ctpa.status||'Unknown')+'</span></div><p><strong>Account email:</strong> '+esc(org.primary_email||'—')+' <span class="lab-muted">(account identity — manage email through customer account management)</span></p><form id="ctpaProfileForm" class="lab-edit-grid">'+fields.map(input).join('')+'<div class="lab-form-actions"><button type="submit" class="lab-primary">Save C/TPA Profile</button></div></form><p class="lab-notice" id="profileSaveStatus" role="status"></p></div>'+
 '<div class="lab-panel"><div class="lab-detail-header"><h2>Assigned laboratory account numbers</h2><a class="lab-action lab-primary" href="'+assign+'">+ Assign lab account number</a></div><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Laboratory</th><th>Type</th><th>Account number</th><th>Status</th><th>Manage</th></tr></thead><tbody>'+(accounts.map(x=>'<tr><td>'+esc(x.lab_name||'—')+'</td><td>'+esc(x.config?.account_type||'—')+'</td><td>'+esc(x.account_code||'—')+'</td><td>'+esc(x.status)+'</td><td><a class="lab-action" href="lab-account-assignment.html?id='+encodeURIComponent(x.id)+'">Edit number</a></td></tr>').join('')||'<tr><td colspan="5">No numbers assigned yet.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="lab-panel"><h2>House Lab Account purchases</h2><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Order</th><th>Intake</th><th>Account</th><th>Manage</th></tr></thead><tbody>'+(purchases.map(x=>'<tr><td>'+esc(x.order_number||'—')+'</td><td>'+esc(x.status||'—')+'</td><td>'+esc(x.account_status||'—')+'</td><td><a class="lab-action" href="house-lab-ctpa-setup.html?intake_id='+encodeURIComponent(x.id)+'">Manage onboarding</a><a class="lab-action" href="house-lab-fulfillment.html?intake_id='+encodeURIComponent(x.id)+'">Supplies &amp; invoices</a></td></tr>').join('')||'<tr><td colspan="4">No House Lab Account purchases linked.</td></tr>')+'</tbody></table></div></div>';
 const form=mount.querySelector('#ctpaProfileForm');form.onsubmit=async(e)=>{
  e.preventDefault();const btn=form.querySelector('button[type=submit]');const output=mount.querySelector('#profileSaveStatus');
  btn.disabled=true;output.textContent='Saving profile…';
  try{const fields=Object.fromEntries(new FormData(form).entries());await invoke({action:'update_ctpa_profile',ctpa_id:id,...fields});await render();mount.querySelector('#profileSaveStatus').textContent='C/TPA profile saved.'}
  catch(error){output.textContent=error.message;btn.disabled=false}
 };
}
try{if(!valid)throw Error('Open the profile by selecting a C/TPA from Lab Account Numbers.');await render()}catch(e){notice.textContent=e.message;mount.innerHTML='<div class="lab-panel"><a href="lab-account-numbers.html" class="lab-action">Return to Lab Account Numbers</a></div>'}
})();