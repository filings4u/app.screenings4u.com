(async()=>{'use strict';
const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
const root=document.getElementById('dotPageMount');if(!root)return;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=new URLSearchParams(location.search).get('ctpa_id')||new URLSearchParams(location.search).get('id')||'';
const valid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
root.innerHTML='<div class="lab-wrap"><h1>Manage C/TPA Profile</h1><p id="profileNotice" role="status">Loading customer profile…</p><div class="lab-detail-nav"><a class="lab-action" href="lab-account-numbers.html">All customers</a><a class="lab-action" href="lab-account-intakes.html">Intake review</a><a class="lab-action" href="house-lab-fulfillment.html">Supplies &amp; invoices</a></div><div id="profileContent"></div></div>';
const notice=root.querySelector('#profileNotice'),mount=root.querySelector('#profileContent');
const invoke=async(body)=>{const {data,error}=await dotSupabase.functions.invoke('lab-account-management',{body});if(error){const detail=await error.context?.json?.().catch(()=>null);throw Error(detail?.error||error.message||'Unable to manage C/TPA')}if(data?.error)throw Error(data.error);return data;};
const fields=[['legal_name','Legal business name',true],['dba_name','DBA / trade name'],['phone','Business phone'],['website','Website'],['ein','EIN'],['address_line1','Street address'],['address_line2','Unit / suite'],['city','City'],['state_region','State'],['postal_code','ZIP code'],['support_email','Support email'],['support_phone','Support phone']];
const accountTypes=['dot','non_dot','hair','oral','other'];
const requestedAccount=new URLSearchParams(location.search).get('account_id')||'';
const accountEditor=(a={})=>'<form class="lab-edit-grid" id="accountNumberForm"><input type="hidden" name="id" value="'+esc(a.id||'')+'"><label>Laboratory<input required name="lab_name" maxlength="180" value="'+esc(a.lab_name||'')+'" placeholder="Laboratory name"></label><label>Account type<select name="account_type">'+accountTypes.map(t=>'<option value="'+t+'" '+((a.config?.account_type||'dot')===t?'selected':'')+'>'+esc(t.replaceAll('_',' ').toUpperCase())+'</option>').join('')+'</select></label><label>Account number<input name="account_code" required maxlength="120" value="'+esc(a.account_code||'')+'" placeholder="Assigned laboratory number"></label><label>Status<select name="status"><option value="active" '+(a.status!=='inactive'?'selected':'')+'>Active</option><option value="inactive" '+(a.status==='inactive'?'selected':'')+'>Inactive</option></select></label><label>Primary account<select name="is_primary"><option value="false" '+(!a.is_primary?'selected':'')+'>No</option><option value="true" '+(a.is_primary?'selected':'')+'>Yes</option></select></label><label>Notes<input name="notes" maxlength="2000" value="'+esc(a.notes||'')+'"></label><div class="lab-form-actions"><button type="submit" class="lab-primary">Save laboratory number</button><button id="cancelNumber" type="button">Cancel</button></div></form>';
async function render(){
 const data=await invoke({action:'get_ctpa_profile',ctpa_id:id}),org=data.organization||{},ctpa=data.ctpa||{},accounts=data.accounts||[],purchases=data.purchases||[];
 if(!data.organization||!data.ctpa)throw Error('The C/TPA record could not be loaded');
 root.querySelector('h1').textContent=org.legal_name||'Manage C/TPA Profile';
 notice.textContent='One business profile · '+(ctpa.company_code||'C/TPA')+' · '+(ctpa.status||'unknown')+' · '+accounts.length+' lab account number(s)';
 const input=([key,label,required])=>'<label>'+esc(label)+'<input name="'+key+'" value="'+esc((key==='support_email'||key==='support_phone'?ctpa[key]:org[key])||'')+'" maxlength="250" '+(required?'required':'')+'></label>';
 mount.innerHTML='<div class="lab-panel"><div class="lab-detail-header"><div><h2>Business &amp; contact details</h2><p class="lab-muted">Edit the existing organization record. Changes are saved to the C/TPA profile used across Workforce.</p></div><span class="lab-pill">'+esc(ctpa.status||'Unknown')+'</span></div><p><strong>Account email:</strong> '+esc(org.primary_email||'—')+' <span class="lab-muted">(account identity — manage email through customer account management)</span></p><form id="ctpaProfileForm" class="lab-edit-grid">'+fields.map(input).join('')+'<div class="lab-form-actions"><button type="submit" class="lab-primary">Save C/TPA Profile</button></div></form><p class="lab-notice" id="profileSaveStatus" role="status"></p></div>'+
 '<div class="lab-panel" id="accountSection"><div class="lab-detail-header"><div><h2>Laboratory account numbers</h2><p class="lab-muted">Manage all assigned laboratory numbers directly on this customer profile. No separate assignment page.</p></div><button class="lab-primary" type="button" id="addLabNumber">+ Add laboratory number</button></div><div id="labNumberEditor" hidden></div><p class="lab-notice" id="accountNumberNotice" role="status"></p><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Laboratory</th><th>Type</th><th>Account number</th><th>Status</th><th>Manage</th></tr></thead><tbody>'+(accounts.map(x=>'<tr><td>'+esc(x.lab_name||'—')+'</td><td>'+esc(x.config?.account_type||'—')+'</td><td>'+esc(x.account_code||'—')+'</td><td>'+esc(x.status)+'</td><td><button type="button" class="lab-action editLabNumber" data-account-id="'+esc(x.id)+'">Edit number</button></td></tr>').join('')||'<tr><td colspan="5">No numbers assigned yet.</td></tr>')+'</tbody></table></div></div>'+
 '<div class="lab-panel"><h2>House Lab Account purchases</h2><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Order</th><th>Intake</th><th>Account</th><th>Manage</th></tr></thead><tbody>'+(purchases.map(x=>'<tr><td>'+esc(x.order_number||'—')+'</td><td>'+esc(x.status||'—')+'</td><td>'+esc(x.account_status||'—')+'</td><td><a class="lab-action" href="house-lab-ctpa-setup.html?intake_id='+encodeURIComponent(x.id)+'">Manage onboarding</a><a class="lab-action" href="house-lab-fulfillment.html?intake_id='+encodeURIComponent(x.id)+'">Supplies &amp; invoices</a></td></tr>').join('')||'<tr><td colspan="4">No House Lab Account purchases linked.</td></tr>')+'</tbody></table></div></div>';
 const numberEditor=mount.querySelector('#labNumberEditor');
 function openNumber(a={}){
  numberEditor.hidden=false;numberEditor.innerHTML=accountEditor(a);
  numberEditor.querySelector('#cancelNumber').onclick=()=>{numberEditor.hidden=true;numberEditor.innerHTML='';};
  numberEditor.querySelector('#accountNumberForm').onsubmit=async event=>{
   event.preventDefault();const submit=event.target.querySelector('[type=submit]');const notice=mount.querySelector('#accountNumberNotice');
   const values=Object.fromEntries(new FormData(event.target).entries());
   submit.disabled=true;notice.textContent='Saving laboratory number…';
   try{await invoke({action:'save',ctpa_id:id,...values,is_primary:values.is_primary==='true'});await render();mount.querySelector('#accountNumberNotice').textContent='Laboratory number saved.';}
   catch(error){notice.textContent=error.message;submit.disabled=false;}
  };
  numberEditor.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 mount.querySelector('#addLabNumber').onclick=()=>openNumber();
 mount.querySelectorAll('.editLabNumber').forEach(button=>button.onclick=()=>openNumber(accounts.find(a=>a.id===button.dataset.accountId)||{}));
 if(requestedAccount){const found=accounts.find(a=>a.id===requestedAccount);if(found)openNumber(found);}
 const form=mount.querySelector('#ctpaProfileForm');form.onsubmit=async(e)=>{
  e.preventDefault();const btn=form.querySelector('button[type=submit]');const output=mount.querySelector('#profileSaveStatus');
  btn.disabled=true;output.textContent='Saving profile…';
  try{const fields=Object.fromEntries(new FormData(form).entries());await invoke({action:'update_ctpa_profile',ctpa_id:id,...fields});await render();mount.querySelector('#profileSaveStatus').textContent='C/TPA profile saved.'}
  catch(error){output.textContent=error.message;btn.disabled=false}
 };
}
try{if(!valid)throw Error('Open the profile by selecting a C/TPA from Lab Account Numbers.');await render()}catch(e){notice.textContent=e.message;mount.innerHTML='<div class="lab-panel"><a href="lab-account-numbers.html" class="lab-action">Return to Lab Account Numbers</a></div>'}
})();