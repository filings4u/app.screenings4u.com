(async()=>{'use strict';
const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
const root=document.getElementById('dotPageMount');if(!root)return;
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const call=async(fn,body)=>{const {data,error}=await dotSupabase.functions.invoke(fn,{body});if(error||data?.error)throw Error(data?.error||error?.message||'Request failed');return data};
const isNumbers=location.pathname.endsWith('lab-account-numbers.html');
const isDetail=location.pathname.endsWith('lab-account-intake-detail.html');
const isAssignment=location.pathname.endsWith('lab-account-assignment.html');
const isStatus=location.pathname.endsWith('lab-account-status.html');
const heading=isNumbers?'Lab Account Numbers':isAssignment?'Lab Account Assignment':isStatus?'House Lab Account Status':isDetail?'Lab Account Record':'Lab Account Intakes';
root.innerHTML='<div class="lab-wrap"><h1>'+heading+'</h1><p id="labMessage" role="status">Loading…</p><div id="labContent"></div></div>';
const msg=root.querySelector('#labMessage'),container=root.querySelector('#labContent');
const when=x=>x?new Date(x).toLocaleDateString():'—';
const button=(label,attrs='')=>'<button type="button" '+attrs+'>'+E(label)+'</button>';
let submissions=[],accounts=[],ctpas=[],organizations=[];
function modal(html){const el=document.createElement('div');el.className='modal';el.innerHTML='<div class="modal-card"><div class="top"><h2>Record details</h2>'+button('Close','data-close')+'</div>'+html+'</div>';root.querySelector('.lab-wrap').append(el);const close=()=>el.remove();el.querySelector('[data-close]').onclick=close;el.addEventListener('click',e=>{if(e.target===el)close()});return el}

const norm=v=>String(v||'').trim().toLowerCase();
const safeId=v=>/^[0-9a-f-]{36}$/i.test(v||'');
const statusUrl=id=>'lab-account-status.html?id='+encodeURIComponent(id||'');
const detailUrl=(email,kind,id,mode)=>'lab-account-intake-detail.html?'+new URLSearchParams(Object.fromEntries(Object.entries({email,kind,id,mode}).filter(([,v])=>v))).toString();
const groupsFor=rows=>{
 const groups=new Map();
 for(const x of rows){
  const email=norm(x.submitter_email||x.details?.primary_contact_email||x.details?.billing_contact_email);
  const key=email||('unknown:'+x.kind+':'+x.id);
  if(!groups.has(key))groups.set(key,{key,email,rows:[],customer_user_id:null});
  const g=groups.get(key);g.rows.push(x);if(x.customer_user_id)g.customer_user_id=x.customer_user_id;
 }
 return [...groups.values()].sort((a,b)=>Math.max(...b.rows.map(x=>+new Date(x.created_at||0)))-Math.max(...a.rows.map(x=>+new Date(x.created_at||0))));
};
async function fetchIntakes(){
 const [forms,purchases]=await Promise.all([call('enterprise-forms-management',{action:'submissions'}),call('enterprise-forms-management',{action:'lab_account_purchases'})]);
 const purchaseList=purchases.purchases||[];
 const linkedByOrder=new Map(purchaseList.filter(x=>x.order_id).map(x=>[x.order_id,x]));
 const byCustomer=new Map();for(const p of purchaseList){const key=norm(p.customer_email);if(!byCustomer.has(key))byCustomer.set(key,[]);byCustomer.get(key).push(p)}
 const fromForms=(forms.submissions||[]).filter(x=>['lab_account_intake_standalone','lab_account_intake'].includes(x.form_key)).map(x=>({...x,kind:'submission',details:x.payload||{},linked_purchase:linkedByOrder.get(x.related_order_id)||null}));
 for(const form of fromForms){form.linked_purchases=byCustomer.get(norm(form.submitter_email))||[];if(!form.linked_purchase)form.linked_purchase=form.linked_purchases[0]||null;}
 const known=new Set(fromForms.flatMap(x=>(x.linked_purchases||[]).map(p=>p.order_id)).filter(Boolean));
 const fromPurchases=purchaseList.filter(x=>!known.has(x.order_id)).map(x=>({...x,kind:'purchase',submission_number:x.order_number,submitter_email:x.customer_email,submitter_name:x.customer_email,details:x.intake_data||{}}));
 return [...fromForms,...fromPurchases].filter(x=>x.status!=='archived').sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
}
const actionLink=(href,label,extra='')=>'<a class="lab-action '+extra+'" href="'+E(href)+'">'+E(label)+'</a>';
const names=x=>x.rows.map(r=>r.submitter_name).find(v=>v&&v.includes(' '))||x.rows.find(r=>r.submitter_name)?.submitter_name||x.email||'Customer';
const business=x=>x.rows.map(r=>r.details?.legal_business_name||r.details?.business_name).find(Boolean)||'—';
const latest=x=>x.rows[0]||{};
const linkedPurchases=g=>[...new Map(g.rows.flatMap(x=>[...(x.linked_purchases||[]),...(x.linked_purchase?[x.linked_purchase]:[])]).map(x=>[x.id,x])).values()];
async function loadIntakes(){
 submissions=await fetchIntakes();const grouped=groupsFor(submissions);
 msg.textContent=grouped.length+' unique customers • '+submissions.length+' active intake and purchase records';
 container.innerHTML='<div class="lab-panel"><div class="lab-toolbar"><label class="lab-search-label">Search customers, emails, businesses, or submissions<input id="labSearch" type="search" placeholder="Search customer, email, business, or submission"></label><label class="lab-status-label">Filter by status<select id="labStatus"><option value="">All statuses</option>'+[...new Set(submissions.map(x=>x.status).filter(Boolean))].map(x=>'<option>'+E(x)+'</option>').join('')+'</select></label><a class="lab-action lab-primary" href="lab-account-numbers.html">Manage Lab Account Numbers</a><a class="lab-action" href="house-lab-fulfillment.html">Fulfillment &amp; Invoices</a><a class="lab-action" href="https://lab-account.screenings4u.com/dashboard.html" target="_blank" rel="noopener">Lab Account Portal</a></div><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Customer</th><th>Email</th><th>Business</th><th>Records</th><th>Latest status</th><th>Last activity</th><th>Manage</th></tr></thead><tbody id="labRows"></tbody></table></div></div>';
 const draw=()=>{
  const q=norm(container.querySelector('#labSearch').value),status=container.querySelector('#labStatus').value;
  const shown=grouped.filter(group=>(!status||group.rows.some(x=>x.status===status))&&(!q||[group.email,names(group),business(group),...group.rows.flatMap(x=>[x.submission_number,x.status])].some(v=>norm(v).includes(q))));
  container.querySelector('#labRows').innerHTML=shown.map(group=>{
   const record=latest(group),link=detailUrl(group.email,'','',''),count=group.rows.length;
   return '<tr><td>'+actionLink(link,names(group),'lab-customer-link')+'</td><td>'+E(group.email||'Unverified')+'</td><td>'+E(business(group))+'</td><td><span class="lab-count">'+count+'</span> '+(count===1?'record':'records')+'</td><td><span class="lab-pill">'+E(record.status||'unknown')+'</span></td><td>'+when(record.created_at)+'</td><td><div class="lab-row-actions">'+actionLink(link,'Manage customer','lab-primary')+actionLink(detailUrl(group.email,record.kind,record.id,''),'Latest record')+'</div></td></tr>';
  }).join('')||'<tr><td colspan="7" class="lab-empty">No customers match your search.</td></tr>';
 };
 container.querySelector('#labSearch').addEventListener('input',draw);container.querySelector('#labStatus').addEventListener('change',draw);draw();
}
const editableFields=x=>Object.entries(x.details||{}).filter(([k,v])=>typeof v==='string'&& !/token|captcha|turnstile|password|secret|signature|website_trap|form_started_at/i.test(k));
const detailsView=x=>editableFields(x).map(([k,v])=>'<div class="lab-detail-field"><span>'+E(k.replaceAll('_',' '))+'</span><strong>'+E(v||'—')+'</strong></div>').join('')||'<p>No additional intake details have been submitted yet.</p>';
async function loadDetail(){
 submissions=await fetchIntakes();const params=new URLSearchParams(location.search),email=norm(params.get('email')),id=params.get('id')||'',kind=params.get('kind')||'',mode=params.get('mode')||'';
 const grouped=groupsFor(submissions);
 const group=grouped.find(g=>g.email===email)|| (safeId(id)?grouped.find(g=>g.rows.some(x=>x.id===id)):null);
 if(!group){msg.textContent='Customer not found or archived.';container.innerHTML=actionLink('lab-account-intakes.html','← Back to customer intakes');return}
 const record=safeId(id)?group.rows.find(x=>x.id===id&&x.kind===kind):null;
 const pageUrl=detailUrl(group.email,'','','');
 if(!record){
  root.querySelector('h1').textContent=names(group);
  msg.textContent=group.rows.length+' active intake record'+(group.rows.length===1?'':'s')+' • '+linkedPurchases(group).length+' linked house lab account purchase'+(linkedPurchases(group).length===1?'':'s')+' • One customer identity';
  const purchasesForCustomer=linkedPurchases(group);const accountStatus=purchasesForCustomer.some(p=>p.account_status==='active')?'Active':purchasesForCustomer.length?'Pending':'Not purchased';
  container.innerHTML='<div class="lab-detail-nav">'+actionLink('lab-account-intakes.html','← All customers')+actionLink('lab-account-numbers.html','Manage Lab Account Numbers')+actionLink('house-lab-fulfillment.html','Fulfillment & invoices')+'</div><div class="lab-panel"><h2>Customer profile</h2><div class="lab-detail"><div class="lab-detail-field"><span>Customer</span><strong>'+E(names(group))+'</strong></div><div class="lab-detail-field"><span>Account email</span><strong>'+E(group.email)+'</strong></div><div class="lab-detail-field"><span>Business</span><strong>'+E(business(group))+'</strong></div><div class="lab-detail-field"><span>Active intake forms</span><strong>'+group.rows.filter(x=>x.kind==='submission').length+'</strong></div><div class="lab-detail-field"><span>House lab account status</span><strong>'+E(accountStatus)+'</strong></div></div></div><div class="lab-panel"><h2>Customer intake &amp; purchase</h2><p class="lab-muted">One managed lab account intake per customer. Matching purchases stay linked to this record; original order and payment history remain in Supabase.</p><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Intake reference</th><th>Type</th><th>Status</th><th>Linked purchase / order</th><th>Date</th><th>Manage</th></tr></thead><tbody>'+group.rows.map(x=>'<tr><td>'+actionLink(detailUrl(group.email,x.kind,x.id,''),x.submission_number||x.id,'lab-customer-link')+'</td><td>'+E(x.kind==='purchase'?'Purchase intake':'Submitted form')+'</td><td><span class="lab-pill">'+E(x.status||'unknown')+'</span></td><td>'+(x.linked_purchase?E(x.linked_purchase.order_number||'—')+' <span class="lab-pill">'+E(x.linked_purchase.status||'pending')+'</span>':x.kind==='purchase'?E(x.order_number||'—'):'—')+'</td><td>'+when(x.created_at)+'</td><td><div class="lab-row-actions">'+actionLink(detailUrl(group.email,x.kind,x.id,''),'View')+actionLink(detailUrl(group.email,x.kind,x.id,'edit'),'Edit')+(x.linked_purchase?actionLink(statusUrl(x.linked_purchase.id),'Change account status')+actionLink('house-lab-fulfillment.html?intake_id='+encodeURIComponent(x.linked_purchase.id),'Manage supplies & invoices'):'')+'</div></td></tr>').join('')+'</tbody></table></div></div>';
  return;
 }
 root.querySelector('h1').textContent=record.submission_number||'Lab account record';
 msg.textContent=(record.kind==='purchase'?'Purchase intake':'Submitted form')+' • '+group.email+' • '+record.status;
 const recordHref=detailUrl(group.email,record.kind,record.id,''),editing=mode==='edit';
 const fields=editableFields(record);
 const formHtml='<form id="labManageForm" class="lab-edit-grid">'+fields.map(([k,v])=>'<label><span>'+E(k.replaceAll('_',' '))+'</span><input name="'+E(k)+'" value="'+E(v)+'" maxlength="3000" '+(editing?'':'readonly')+'></label>').join('')+(editing?'<div class="lab-form-actions"><button type="submit" class="lab-primary">Save changes</button>'+actionLink(recordHref,'Cancel')+'</div>':'')+'</form>';
 container.innerHTML='<div class="lab-detail-nav">'+actionLink(pageUrl,'← Customer account')+actionLink('lab-account-intakes.html','All customers')+'</div><div class="lab-panel"><div class="lab-detail-header"><div><h2>'+E(record.submission_number||'Record')+'</h2><p>Associated with <strong>'+E(group.email)+'</strong></p></div><span class="lab-pill">'+E(record.status||'unknown')+'</span></div><div class="lab-row-actions">'+actionLink(recordHref,'View')+actionLink(detailUrl(group.email,record.kind,record.id,'edit'),'Edit','lab-primary')+(record.linked_purchase?actionLink(statusUrl(record.linked_purchase.id),'Change account status'):'')+'</div><div class="lab-detail"><div class="lab-detail-field"><span>Record type</span><strong>'+E(record.kind==='purchase'?'Purchase intake':'Submitted form')+'</strong></div><div class="lab-detail-field"><span>Created</span><strong>'+when(record.created_at)+'</strong></div><div class="lab-detail-field"><span>Business</span><strong>'+E(record.details?.legal_business_name||business(group))+'</strong></div><div class="lab-detail-field"><span>Customer email</span><strong>'+E(group.email)+'</strong></div>'+(record.linked_purchase?'<div class="lab-detail-field"><span>House lab account status</span><strong>'+E(record.linked_purchase.account_status||'pending')+'</strong></div>':'')+'</div></div><div class="lab-panel"><h2>'+ (editing?'Edit intake details':'Submitted details')+'</h2>'+(editing?formHtml:'<div class="lab-detail">'+detailsView(record)+'</div>')+'<p id="saveStatus" role="status" class="lab-notice"></p></div><div class="lab-panel lab-manage-actions"><h2>Manage record</h2><p class="lab-muted">Change the review status or archive this individual record. Other records and customer account history are preserved.</p><div class="lab-row-actions">'+(record.kind==='submission'?'<button type="button" data-status="reviewing">Mark reviewing</button><button type="button" data-status="completed">Mark completed</button>':'')+'<button type="button" data-archive-record class="lab-danger">Archive record</button></div></div>';
 const saveMsg=container.querySelector('#saveStatus');
 if(editing){container.querySelector('#labManageForm').addEventListener('submit',async e=>{e.preventDefault();const btn=e.target.querySelector('button[type="submit"]');btn.disabled=true;try{const payload=Object.fromEntries(new FormData(e.target).entries());await call('enterprise-forms-management',{action:record.kind==='purchase'?'edit_lab_purchase':'edit_submission_payload',id:record.id,payload});location.href=recordHref}catch(error){saveMsg.textContent=error.message;btn.disabled=false}})}
 container.querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await call('enterprise-forms-management',{action:'update_submission',id:record.id,status:b.dataset.status});location.href=recordHref}catch(e){saveMsg.textContent=e.message;b.disabled=false}}));
 container.querySelector('[data-archive-record]').addEventListener('click',async()=>{if(!confirm('Archive this record? The account and other records will remain.'))return;try{await call('enterprise-forms-management',record.kind==='purchase'?{action:'archive_lab_purchase',id:record.id}:{action:'update_submission',id:record.id,status:'archived'});location.href=pageUrl}catch(e){saveMsg.textContent=e.message}});
}

const assignUrl=id=>'lab-account-assignment.html'+(id?'?id='+encodeURIComponent(id):'');
const buyerName=x=>{const d=x.intake_data||{};return d.legal_business_name||d.business_name||d.company_name||d.contact_name||[d.first_name,d.last_name].filter(Boolean).join(' ')||x.customer_email||'Customer'};
async function loadNumbers(){
 const [data,purchasesData]=await Promise.all([call('lab-account-management',{action:'list'}),call('enterprise-forms-management',{action:'lab_account_purchases'})]);
 accounts=data.accounts||[];ctpas=data.ctpas||[];organizations=data.organizations||[];
 const purchases=(purchasesData.purchases||[]).filter(x=>x.status!=='archived');
 const orgName=id=>{const o=organizations.find(x=>x.id===id);return o?.display_name||o?.legal_name||o?.name||id||'—'};
 msg.textContent=accounts.length+' assigned lab account records • '+purchases.length+' house lab account purchase records';
 container.innerHTML='<div class="lab-panel"><div class="lab-detail-header"><div><h2>Customer laboratory accounts</h2><p class="lab-muted">Assigned lab account numbers and customers who purchased a house lab account. A purchase is not an active assignment until it has been provisioned.</p></div><div class="lab-row-actions">'+actionLink('lab-account-intakes.html','Customer intakes')+actionLink('house-lab-fulfillment.html','Fulfillment & invoices')+actionLink(assignUrl(''),'Assign lab account','lab-primary')+'</div></div><div class="lab-toolbar"><label class="lab-search-label">Search customers and lab account records<input id="labSearch" type="search" placeholder="Customer, laboratory, account number, email or order"></label><label class="lab-status-label">Record type<select id="labType"><option value="">All records</option><option value="assigned">Assigned accounts</option><option value="purchase">House account purchases</option></select></label><label class="lab-status-label">Account status<select id="labActivation"><option value="">All statuses</option><option value="pending">Pending</option><option value="active">Active</option></select></label></div><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Customer / C/TPA</th><th>Type</th><th>Laboratory</th><th>Account number / Order</th><th>Primary</th><th>Status</th><th>Actions</th></tr></thead><tbody id="labRows"></tbody></table></div></div>';
 const rows=[
 ...accounts.map(x=>({type:'assigned',name:orgName(x.organization_id),lab:x.lab_name||x.laboratory_name||'—',code:x.account_code||'—',primary:x.is_primary?'Yes':'No',status:x.status||'—',href:assignUrl(x.id),action:'Edit account'})),
 ...purchases.map(x=>({type:'purchase',name:buyerName(x),email:x.customer_email||'',lab:'Pending assignment',code:x.order_number||'—',primary:'—',status:x.account_status||'pending',workflow_status:x.status||'pending',href:statusUrl(x.id),action:'Manage status'}))
 ];
 const draw=()=>{const q=norm(container.querySelector('#labSearch').value),type=container.querySelector('#labType').value;
  const activation=container.querySelector('#labActivation').value;const shown=rows.filter(x=>(!type||x.type===type)&&(!activation||norm(x.status)===activation)&&(!q||[x.name,x.email,x.lab,x.code,x.status,x.type].some(v=>norm(v).includes(q))));
  container.querySelector('#labRows').innerHTML=shown.map(x=>'<tr><td>'+actionLink(x.href,x.name,'lab-customer-link')+(x.email?'<div class="lab-muted">'+E(x.email)+'</div>':'')+'</td><td><span class="lab-pill">'+(x.type==='purchase'?'House account purchase':'Assigned lab account')+'</span></td><td>'+E(x.lab)+'</td><td>'+E(x.code)+'</td><td>'+E(x.primary)+'</td><td>'+E(x.status)+'</td><td>'+actionLink(x.href,x.action,'lab-primary')+'</td></tr>').join('')||'<tr><td colspan="7" class="lab-empty">No records match this search.</td></tr>';
 };
 container.querySelector('#labSearch').addEventListener('input',draw);
 container.querySelector('#labType').addEventListener('change',draw);container.querySelector('#labActivation').addEventListener('change',draw);draw();
}
async function loadStatus(){
 const id=new URLSearchParams(location.search).get('id')||'';
 if(!safeId(id)){msg.textContent='Valid purchase ID required';container.innerHTML=actionLink('lab-account-numbers.html','Back to Lab Account Numbers');return}
 const data=await call('enterprise-forms-management',{action:'get_lab_purchase',id});
 const p=data.purchase;if(!p){msg.textContent='Purchase not found';return}
 root.querySelector('h1').textContent='Manage House Lab Account';
 msg.textContent='Order '+(p.order_number||'—')+' • Customer '+(p.customer_email||'—');
 const current=String(p.account_status||'pending').toLowerCase();
 container.innerHTML='<div class="lab-detail-nav">'+actionLink('lab-account-numbers.html','← Lab Account Numbers')+actionLink(detailUrl(p.customer_email||'','','',''),'Customer intake')+'</div><div class="lab-panel"><h2>Account activation</h2><p class="lab-muted">Set this house lab account to Pending or Active. This does not change purchase payment status, order status, or intake workflow.</p><div class="lab-detail"><div class="lab-detail-field"><span>Customer email</span><strong>'+E(p.customer_email||'—')+'</strong></div><div class="lab-detail-field"><span>Order</span><strong>'+E(p.order_number||'—')+'</strong></div><div class="lab-detail-field"><span>Intake workflow</span><strong>'+E(p.status||'—')+'</strong></div></div><form id="statusForm" class="lab-edit-grid"><label>Account status<select name="account_status" required><option value="pending" '+(current==='pending'?'selected':'')+'>Pending</option><option value="active" '+(current==='active'?'selected':'')+'>Active</option></select></label><div class="lab-form-actions"><button type="submit" class="lab-primary">Save status</button>'+actionLink('lab-account-numbers.html','Cancel')+'</div></form><p class="lab-notice" role="status" id="saveStatus"></p></div>';
 container.querySelector('#statusForm').addEventListener('submit',async event=>{event.preventDefault();const button=event.target.querySelector('button[type="submit"]');button.disabled=true;try{await call('enterprise-forms-management',{action:'set_lab_account_status',id,account_status:new FormData(event.target).get('account_status')});location.href='lab-account-numbers.html'}catch(error){container.querySelector('#saveStatus').textContent=error.message;button.disabled=false}});
}
async function loadAssignment(){
 const data=await call('lab-account-management',{action:'list'});
 accounts=data.accounts||[];ctpas=data.ctpas||[];organizations=data.organizations||[];
 // Include submitted lab-account applications as C/TPA onboarding candidates.
 const intakeResult=await call('enterprise-forms-management',{action:'submissions'});
 const intakeRows=(intakeResult.submissions||[]).filter(x=>['lab_account_intake_standalone','lab_account_intake'].includes(x.form_key)&&x.status!=='archived');
 const existingOrgIds=new Set(ctpas.map(c=>c.organization_id));
 const intakeMap=new Map();
 for(const x of intakeRows){if(x.organization_id&&existingOrgIds.has(x.organization_id))continue;const email=norm(x.submitter_email);if(!email)continue;const old=intakeMap.get(email);if(!old||new Date(x.created_at)>new Date(old.created_at))intakeMap.set(email,x)}
 const candidates=[...intakeMap.values()];
 const params=new URLSearchParams(location.search),id=params.get('id')||'';
 const existing=id?accounts.find(x=>x.id===id):null;
 if(id&&!existing){msg.textContent='Assignment not found';container.innerHTML=actionLink('lab-account-numbers.html','Back to Lab Account Numbers');return}
 const selectedId=existing?.ctpa_id||params.get('ctpa_id')||'';
 const nameFor=c=>{const o=organizations.find(x=>x.id===c.organization_id);return o?.display_name||o?.legal_name||o?.name||c.id};
 const ctpaChoices=[...ctpas].sort((x,y)=>nameFor(x).localeCompare(nameFor(y))).map(c=>'<option value="'+E(c.id)+'" '+(c.id===selectedId?'selected':'')+'>'+E(nameFor(c))+' ('+E(c.status||'unknown')+')</option>').join('');
 const choices=ctpaChoices+candidates.map(x=>'<option disabled>'+E(x.payload?.legal_business_name||x.submitter_name||x.submitter_email)+' — Intake pending C/TPA setup</option>').join('');
 root.querySelector('h1').textContent=existing?'Edit Lab Account Number':'Assign Lab Account Numbers';
 msg.textContent='Add as many laboratory account numbers as needed. Every saved account belongs to the selected C/TPA.';
 container.innerHTML='<div class="lab-detail-nav">'+actionLink('lab-account-numbers.html','← Lab Account Numbers')+'</div><div class="lab-panel"><div class="lab-detail-header"><div><h2>Choose the C/TPA</h2><p class="lab-muted">All new account numbers will be assigned to this C/TPA and displayed in its authorized portals.</p></div></div><label class="lab-search-label">C/TPA<select id="assignmentCtpa" '+(existing?'disabled':'')+'><option value="">Select C/TPA</option>'+choices+'</select></label></div><div class="lab-panel"><div class="lab-detail-header"><div><h2>Laboratory account numbers</h2><p class="lab-muted">Each row is a separate account. Add multiple rows, including different numbers for the same laboratory.</p></div><button type="button" class="lab-action lab-primary" id="addNumber">+ Add another number</button></div><div id="accountEditors"></div><div class="lab-row-actions" style="margin-top:18px"><button type="button" class="lab-primary" id="saveNumbers">Save account numbers</button>'+actionLink('lab-account-numbers.html','Cancel')+'</div><p id="saveStatus" class="lab-notice" role="status"></p></div><div class="lab-panel"><h2>Existing numbers for selected C/TPA</h2><div id="assignmentExisting" class="lab-table-scroll"></div></div><div class="lab-panel lab-ctpa-directory"><div class="lab-detail-header"><div><h2>All C/TPAs and assigned lab account numbers</h2><p class="lab-muted" id="directoryCount"></p></div><label class="lab-directory-search">Search C/TPAs or account numbers<input type="search" id="directorySearch" placeholder="Search customer, laboratory, number..." autocomplete="off"></label></div><div id="ctpaDirectory" class="lab-table-scroll"></div></div>';
 const editor=container.querySelector('#accountEditors'),ctpa=container.querySelector('#assignmentCtpa'),message=container.querySelector('#saveStatus');
 const types=['dot','non_dot','hair','oral','other'];
 const typeField=(value='dot')=>'<select name="account_type">'+types.map(t=>'<option value="'+t+'" '+(value===t?'selected':'')+'>'+E(t.replaceAll('_',' ').toUpperCase())+'</option>').join('')+'</select>';
 function addRow(record={}){
  const box=document.createElement('div');box.className='lab-account-editor';
  const type=record.config?.account_type||'dot';
  box.innerHTML='<div class="lab-edit-grid"><label>Laboratory<input name="lab_name" maxlength="180" required placeholder="Labcorp, CRL, Quest..." value="'+E(record.lab_name||record.laboratory_name||'')+'"></label><label>Account type'+typeField(type)+'</label><label>Account number<input name="account_code" maxlength="120" required placeholder="Enter lab account number" value="'+E(record.account_code||'')+'"></label><label>Status<select name="status"><option value="active" '+(record.status!=='inactive'?'selected':'')+'>Active</option><option value="inactive" '+(record.status==='inactive'?'selected':'')+'>Inactive</option></select></label><label>Primary<select name="is_primary"><option value="false" '+(!record.is_primary?'selected':'')+'>No</option><option value="true" '+(record.is_primary?'selected':'')+'>Yes</option></select></label><label>Notes<input name="notes" maxlength="2000" value="'+E(record.notes||'')+'"></label></div><div class="lab-row-actions"><button class="lab-danger removeNumber" type="button">Remove row</button></div>';
  box.querySelector('.removeNumber').onclick=()=>{box.remove();renderExisting()};
  editor.append(box);
 }
 function renderExisting(){
  const rows=accounts.filter(x=>x.ctpa_id===ctpa.value);
  const mount=container.querySelector('#assignmentExisting');
  mount.innerHTML=rows.length?'<table class="lab-table"><thead><tr><th>Laboratory</th><th>Type</th><th>Number</th><th>Status</th><th>Manage</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+E(x.lab_name)+'</td><td>'+E(x.config?.account_type||'DOT')+'</td><td>'+E(x.account_code)+'</td><td>'+E(x.status)+'</td><td>'+actionLink('lab-account-assignment.html?id='+encodeURIComponent(x.id),'Edit')+'</td></tr>').join('')+'</tbody></table>':'<p class="lab-muted">No lab account numbers assigned yet.</p>';
 }
 function renderDirectory(){
  const query=norm(container.querySelector('#directorySearch').value);
  const list=[...ctpas].sort((x,y)=>nameFor(x).localeCompare(nameFor(y))).map(c=>({ctpa:c,name:nameFor(c),numbers:accounts.filter(a=>a.ctpa_id===c.id)}));
  const shown=list.filter(x=>!query||[x.name,x.ctpa.status,...x.numbers.flatMap(a=>[a.lab_name,a.account_code,a.config?.account_type])].some(v=>norm(v).includes(query)));
  container.querySelector('#directoryCount').textContent=ctpas.length+' provisioned C/TPAs • '+candidates.length+' intake applicants awaiting setup • '+accounts.length+' assigned numbers';
  const body=shown.map(x=>'<tr><td><strong>'+E(x.name)+'</strong><div class="lab-muted">'+E(x.ctpa.status||'Unknown')+'</div></td><td><span class="lab-count">'+x.numbers.length+'</span></td><td>'+(x.numbers.length?x.numbers.map(a=>'<div class="lab-directory-number"><strong>'+E(a.lab_name||'Laboratory')+'</strong><span>'+E(a.config?.account_type||'DOT')+' · '+E(a.account_code||'—')+'</span><span class="lab-pill">'+E(a.status||'—')+'</span></div>').join(''):'<span class="lab-muted">No numbers assigned</span>')+'</td><td><div class="lab-row-actions"><button type="button" class="lab-action selectCtpa" data-id="'+E(x.ctpa.id)+'">Select C/TPA</button>'+x.numbers.map(a=>actionLink('lab-account-assignment.html?id='+encodeURIComponent(a.id),'Edit '+(a.lab_name||'account'))).join('')+'</div></td></tr>').join('');
  const applicants=candidates.filter(x=>!query||[x.submitter_email,x.submitter_name,x.payload?.legal_business_name].some(v=>norm(v).includes(query)));
  const candidateRows=applicants.map(x=>'<tr><td><strong>'+E(x.payload?.legal_business_name||x.submitter_name||x.submitter_email)+'</strong><div class="lab-muted">'+E(x.submitter_email)+'</div></td><td>—</td><td><span class="lab-pill">Intake pending C/TPA setup</span></td><td>'+actionLink(detailUrl(x.submitter_email,'submission',x.id,''),'Review intake')+'</td></tr>').join('');
  container.querySelector('#ctpaDirectory').innerHTML='<table class="lab-table lab-directory-table"><thead><tr><th>C/TPA</th><th>Accounts</th><th>Laboratory account numbers</th><th>Management</th></tr></thead><tbody>'+ (body+candidateRows||'<tr><td colspan="4">No matching C/TPAs.</td></tr>')+'</tbody></table>';
  container.querySelectorAll('.selectCtpa').forEach(b=>b.onclick=()=>{if(existing){location.href='lab-account-assignment.html?ctpa_id='+encodeURIComponent(b.dataset.id);return}ctpa.value=b.dataset.id;renderExisting();ctpa.scrollIntoView({behavior:'smooth',block:'center'});});
 }
 container.querySelector('#directorySearch').addEventListener('input',renderDirectory);
 renderDirectory();
 const setupButton=document.createElement('button');setupButton.type='button';setupButton.className='lab-action';setupButton.textContent='Send setup-ready email';
 setupButton.onclick=async()=>{if(!ctpa.value){message.textContent='Select a C/TPA first.';return;}setupButton.disabled=true;try{const result=await call('lab-account-management',{action:'notify_setup',ctpa_id:ctpa.value});message.textContent='Setup email: '+(result.notification_status||'unknown');}catch(e){message.textContent=e.message;}finally{setupButton.disabled=false}};
 container.querySelector('#saveNumbers').parentElement.appendChild(setupButton);
 container.querySelector('#addNumber').onclick=()=>addRow();
 ctpa.onchange=renderExisting;
 const readRow=box=>Object.fromEntries([...box.querySelectorAll('[name]')].map(e=>[e.name,e.value]));
 container.querySelector('#saveNumbers').onclick=async()=>{
  if(!ctpa.value){message.textContent='Select a C/TPA first.';ctpa.focus();return}
  const rows=[...editor.children].map(readRow).map(r=>({...r,is_primary:r.is_primary==='true'}));
  if(!rows.length||rows.some(r=>!r.lab_name.trim()||!r.account_code.trim())){message.textContent='Enter a laboratory and account number for every row.';return}
  if(rows.filter(r=>r.is_primary).length>1){message.textContent='Only one number can be marked primary.';return}
  const button=container.querySelector('#saveNumbers');button.disabled=true;
  try{
   if(existing){await call('lab-account-management',{action:'save',ctpa_id:ctpa.value,id:existing.id,...rows[0]})}
   else{for(let i=0;i<rows.length;i+=100)await call('lab-account-management',{action:'save_many',ctpa_id:ctpa.value,accounts:rows.slice(i,i+100)})}
   location.href='lab-account-numbers.html';
  }catch(e){message.textContent=e.message;button.disabled=false}
 };
 addRow(existing||{});container.querySelector('#addNumber').disabled=!!existing;renderExisting();
}
try{if(isNumbers)await loadNumbers();else if(isAssignment)await loadAssignment();else if(isStatus)await loadStatus();else if(isDetail)await loadDetail();else await loadIntakes()}catch(err){msg.textContent=err.message}
})();