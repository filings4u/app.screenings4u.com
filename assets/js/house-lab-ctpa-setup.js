(async()=>{'use strict';
const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
const root=document.getElementById('dotPageMount');if(!root)return;
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=new URLSearchParams(location.search).get('intake_id')||'';
root.innerHTML='<div class="lab-wrap"><h1>C/TPA Management</h1><p id="ctpaMessage" role="status">Opening C/TPA profile…</p><div id="ctpaManagement"></div></div>';
const message=root.querySelector('#ctpaMessage'),mount=root.querySelector('#ctpaManagement');
const request=async action=>{
 const {data,error}=await dotSupabase.functions.invoke('house-lab-ctpa-provision',{body:{action,intake_id:id}});
 if(error){const detail=await error.context?.json?.().catch(()=>null);throw Error(detail?.error||error.message||'Unable to load C/TPA')}
 if(data?.error)throw Error(data.error);return data;
};
try{
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))throw Error('Open C/TPA management from an existing customer record.');
 const result=await request('status'),ctpa=result.ctpa||null;
 if(ctpa?.id){
  location.replace('lab-ctpa-profile.html?ctpa_id='+encodeURIComponent(ctpa.id));
  return;
 }
 message.textContent='The purchased account does not yet have a C/TPA profile.';
 mount.innerHTML='<div class="lab-panel"><h2>Link C/TPA customer profile</h2><p class="lab-muted">Create or link the C/TPA record for this existing paid purchase. No testing privileges are activated until account review is completed.</p><div class="lab-row-actions"><button type="button" id="createCtpa" class="lab-primary">Create / link C/TPA</button><a class="lab-action" href="lab-account-intake-detail.html?email='+encodeURIComponent(result.purchase?.customer_email||'')+'">Review customer intake</a></div><p id="ctpaError" class="lab-notice" role="status"></p></div>';
 const button=mount.querySelector('#createCtpa');
 button.onclick=async()=>{button.disabled=true;try{await request('provision');const refreshed=await request('status');if(!refreshed.ctpa?.id)throw Error('The C/TPA profile was not linked.');location.replace('lab-ctpa-profile.html?ctpa_id='+encodeURIComponent(refreshed.ctpa.id))}catch(e){mount.querySelector('#ctpaError').textContent=e.message;button.disabled=false}};
}catch(e){message.textContent=e.message;mount.innerHTML='<div class="lab-panel"><a class="lab-action" href="lab-account-intakes.html">Return to Lab Account Intakes</a></div>'}
})();