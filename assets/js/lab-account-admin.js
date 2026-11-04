(async()=>{'use strict';
const user=await DOTAuth.requireAuth();if(!user)return;DOTShell.render(user);
const root=document.getElementById('dotPageMount');if(!root)return;
const E=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const call=async(fn,body)=>{const {data,error}=await dotSupabase.functions.invoke(fn,{body});if(error){const detail=await error.context?.json?.().catch(()=>null);throw Error(detail?.error||error.message||'Request failed')}if(data?.error)throw Error(data.error);return data};
const isNumbers=location.pathname.endsWith('lab-account-numbers.html');
const isDetail=location.pathname.endsWith('lab-account-intake-detail.html');
const isAssignment=location.pathname.endsWith('lab-account-assignment.html');
const isStatus=location.pathname.endsWith('lab-account-status.html');
const heading=isNumbers?'Lab Account Numbers':isAssignment?'Lab Account Assignment':isStatus?'House Lab Account Status':isDetail?'Lab Account Record':'Lab Account Intakes';
const labSections=[['lab-account-numbers.html','Customer accounts'],['lab-account-intakes.html','Intake review'],['house-lab-fulfillment.html','Supplies & shipping'],['house-lab-invoices.html','Testing invoices']];
const labNav=labSections.map(([url,label])=>'<a href="'+url+'" class="lab-section-tab'+(location.pathname.endsWith(url)?' current':'')+'">'+label+'</a>').join('');
root.innerHTML='<div class="lab-wrap"><header class="lab-page-header"><div><span class="lab-eyebrow">SCREENINGS4U / LAB OPERATIONS</span><h1>'+heading+'</h1><p class="lab-page-subtitle">Manage customer profiles, laboratory assignments and fulfillment from one connected workspace.</p></div><a href="lab-account-numbers.html" class="lab-header-home">C/TPA directory</a></header><nav class="lab-section-nav" aria-label="Lab account management">'+labNav+'</nav><p id="labMessage" role="status">Loading…</p><div id="labContent"></div></div>';
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
  container.innerHTML='<div class="lab-detail-nav">'+actionLink('lab-account-intakes.html','← All customers')+actionLink('lab-account-numbers.html','Manage Lab Account Numbers')+actionLink('house-lab-fulfillment.html','Supplies & shipping')+actionLink('house-lab-invoices.html','Testing invoices')+(purchasesForCustomer.length?actionLink('house-lab-ctpa-setup.html?intake_id='+encodeURIComponent(purchasesForCustomer[0].id),'Manage C/TPA'):'')+'</div><div class="lab-panel"><h2>Customer profile</h2><div class="lab-detail"><div class="lab-detail-field"><span>Customer</span><strong>'+E(names(group))+'</strong></div><div class="lab-detail-field"><span>Account email</span><strong>'+E(group.email)+'</strong></div><div class="lab-detail-field"><span>Business</span><strong>'+E(business(group))+'</strong></div><div class="lab-detail-field"><span>Active intake forms</span><strong>'+group.rows.filter(x=>x.kind==='submission').length+'</strong></div><div class="lab-detail-field"><span>House lab account status</span><strong>'+E(accountStatus)+'</strong></div></div></div><div class="lab-panel"><h2>Customer intake &amp; purchase</h2><p class="lab-muted">One managed lab account intake per customer. Matching purchases stay linked to this record; original order and payment history remain in Supabase.</p><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>Intake reference</th><th>Type</th><th>Status</th><th>Linked purchase / order</th><th>Date</th><th>Manage</th></tr></thead><tbody>'+group.rows.map(x=>'<tr><td>'+actionLink(detailUrl(group.email,x.kind,x.id,''),x.submission_number||x.id,'lab-customer-link')+'</td><td>'+E(x.kind==='purchase'?'Purchase intake':'Submitted form')+'</td><td><span class="lab-pill">'+E(x.status||'unknown')+'</span></td><td>'+(x.linked_purchase?E(x.linked_purchase.order_number||'—')+' <span class="lab-pill">'+E(x.linked_purchase.account_status||'pending')+'</span>':x.kind==='purchase'?E(x.order_number||'—'):'—')+'</td><td>'+when(x.created_at)+'</td><td><div class="lab-row-actions">'+actionLink(detailUrl(group.email,x.kind,x.id,''),'View')+actionLink(detailUrl(group.email,x.kind,x.id,'edit'),'Edit')+(x.linked_purchase?actionLink(statusUrl(x.linked_purchase.id),'Change account status')+actionLink('house-lab-ctpa-setup.html?intake_id='+encodeURIComponent(x.linked_purchase.id),'Manage C/TPA')+actionLink('house-lab-fulfillment.html?intake_id='+encodeURIComponent(x.linked_purchase.id),'Manage supplies')+actionLink('house-lab-invoices.html?intake_id='+encodeURIComponent(x.linked_purchase.id),'Manage invoices'):'')+'</div></td></tr>').join('')+'</tbody></table></div></div>';
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
 container.querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await call('enterprise-forms-management',{action:'update_submission',id:record.id,status:b.dataset.status});location.href=(b.dataset.status==='completed'&&record.linked_purchase)?'house-lab-ctpa-setup.html?intake_id='+encodeURIComponent(record.linked_purchase.id):recordHref}catch(e){saveMsg.textContent=e.message;b.disabled=false}}));
 container.querySelector('[data-archive-record]').addEventListener('click',async()=>{if(!confirm('Archive this record? The account and other records will remain.'))return;try{await call('enterprise-forms-management',record.kind==='purchase'?{action:'archive_lab_purchase',id:record.id}:{action:'update_submission',id:record.id,status:'archived'});location.href=pageUrl}catch(e){saveMsg.textContent=e.message}});
}

const assignUrl=(id,ctpaId)=>'lab-ctpa-profile.html?ctpa_id='+encodeURIComponent(ctpaId||accounts.find(x=>x.id===id)?.ctpa_id||'')+(id?'&account_id='+encodeURIComponent(id):'');
const buyerName=x=>{const d=x.intake_data||{};return d.legal_business_name||d.business_name||d.company_name||d.contact_name||[d.first_name,d.last_name].filter(Boolean).join(' ')||x.customer_email||'Customer'};
async function loadNumbers(){
 const [d,p]=await Promise.all([call('lab-account-management',{action:'list'}),call('enterprise-forms-management',{action:'lab_account_purchases'})]);
 accounts=d.accounts||[];ctpas=d.ctpas||[];organizations=d.organizations||[];
 const purchases=(p.purchases||[]).filter(x=>x.status!=='archived');
 const orgById=new Map(organizations.map(o=>[o.id,o]));
 const ctpaMap=new Map(ctpas.map(c=>[c.organization_id,c]));
 const purchaseByEmail=new Map();
 for(const purchase of purchases){const k=norm(purchase.customer_email);if(!purchaseByEmail.has(k))purchaseByEmail.set(k,[]);purchaseByEmail.get(k).push(purchase);}
 const list=ctpas.map(c=>{
  const org=orgById.get(c.organization_id)||{};
  const name=org.legal_name||org.name||c.company_code||c.id;
  const numbers=accounts.filter(a=>a.ctpa_id===c.id);
  return {ctpa:c,org,name,numbers,purchases:purchaseByEmail.get(norm(org.primary_email))||[]};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const profile=c=>'lab-ctpa-profile.html?ctpa_id='+encodeURIComponent(c.id);
 msg.textContent=list.length+' unique C/TPA profiles · '+accounts.length+' assigned laboratory numbers · '+purchases.length+' House Lab purchases';
 container.innerHTML='<div class="lab-workflow-overview"><div class="lab-workflow-title">HOUSE LAB ACCOUNT WORKFLOW</div><div class="lab-workflow-grid"><div><strong>01 · Purchase & intake</strong><span>Customer purchase, branded notifications, intake review</span></div><div><strong>02 · Account setup</strong><span>Manage C/TPA and assign lab numbers on their profile</span></div><div><strong>03 · Supplies & collection</strong><span>Fulfillment, tracking and collector verification</span></div><div><strong>04 · Processing & billing</strong><span>Specimen processing, invoice delivery and notifications</span></div></div></div><div class="lab-panel"><div class="lab-detail-header"><div><h2>Customer laboratory account directory</h2><p class="lab-muted">One customer profile per C/TPA. Manage business information and unlimited laboratory assignments together in the customer profile.</p></div><div class="lab-row-actions">'+actionLink('lab-account-intakes.html','Review new intake','lab-primary')+actionLink('lab-account-intakes.html','Review intakes')+actionLink('house-lab-fulfillment.html','Supplies & shipping')+actionLink('house-lab-invoices.html','Testing invoices')+'</div></div><div class="lab-toolbar"><label class="lab-search-label">Search C/TPA, email, laboratory, or account number<input id="labSearch" type="search" placeholder="Search business, laboratory, account number..."></label><label class="lab-status-label">C/TPA status<select id="labActivation"><option value="">All statuses</option><option value="active">Active</option><option value="onboarding">Onboarding</option><option value="inactive">Inactive</option></select></label></div><div class="lab-table-scroll"><table class="lab-table"><thead><tr><th>C/TPA profile</th><th>Laboratory account numbers</th><th>Setup status</th><th>Management</th></tr></thead><tbody id="labRows"></tbody></table></div></div>';
 const draw=()=>{
  const q=norm(container.querySelector('#labSearch').value),status=container.querySelector('#labActivation').value;
  const shown=list.filter(x=>(!status||norm(x.ctpa.status)===status)&&(!q||[x.name,x.org.primary_email,x.ctpa.company_code,...x.numbers.flatMap(a=>[a.lab_name,a.account_code,a.config?.account_type])].some(v=>norm(v).includes(q))));
  container.querySelector('#labRows').innerHTML=shown.map(x=>{
   const nums=x.numbers.length?x.numbers.map(a=>'<div class="lab-directory-number"><strong>'+E(a.lab_name||'Laboratory')+'</strong> '+E(a.config?.account_type||'')+' · '+E(a.account_code||'')+' <span class="lab-pill">'+E(a.status||'')+'</span> '+actionLink(assignUrl(a.id,x.ctpa.id),'Edit')+'</div>').join(''):'<span class="lab-muted">No laboratory numbers assigned</span>';
   const order=x.purchases.length?'<div class="lab-muted">'+x.purchases.length+' purchased Lab Account(s) · '+E(x.purchases[0].account_status||'pending')+'</div>':'';
   return '<tr><td>'+actionLink(profile(x.ctpa),x.name,'lab-customer-link')+'<div class="lab-muted">'+E(x.org.primary_email||x.ctpa.company_code||'')+'</div></td><td>'+nums+'</td><td><span class="lab-pill">'+E(x.ctpa.status||'unknown')+'</span>'+order+'</td><td><div class="lab-row-actions">'+actionLink(profile(x.ctpa),'Open / edit profile','lab-primary')+actionLink(profile(x.ctpa)+'#accountSection','Manage numbers')+'</div></td></tr>';
  }).join('')||'<tr><td colspan="4" class="lab-empty">No matching C/TPAs.</td></tr>';
 };
 container.querySelector('#labSearch').addEventListener('input',draw);
 container.querySelector('#labActivation').addEventListener('change',draw);draw();
}

async function loadStatus(){
 const id=new URLSearchParams(location.search).get('id')||'';
 if(!safeId(id)){msg.textContent='Valid purchase ID required';container.innerHTML=actionLink('lab-account-numbers.html','Back to Lab Account Numbers');return}
 const data=await call('enterprise-forms-management',{action:'get_lab_purchase',id});
 const p=data.purchase;if(!p){msg.textContent='Purchase not found';return}
 root.querySelector('h1').textContent='Manage House Lab Account';
 msg.textContent='Order '+(p.order_number||'—')+' • Customer '+(p.customer_email||'—');
 const current=String(p.account_status||'pending').toLowerCase();
 container.innerHTML='<div class="lab-detail-nav">'+actionLink('lab-account-numbers.html','← Lab Account Numbers')+actionLink(detailUrl(p.customer_email||'','','',''),'Customer intake')+actionLink('house-lab-ctpa-setup.html?intake_id='+encodeURIComponent(p.id),'C/TPA onboarding')+'</div><div class="lab-panel"><h2>Account activation</h2><p class="lab-muted">An Active account requires a confirmed payment, completed intake, reviewed C/TPA business profile, and at least one active assigned laboratory number. Pending accounts remain in onboarding. The $1 workflow test cannot activate live laboratory services.</p><div class="lab-detail"><div class="lab-detail-field"><span>Customer email</span><strong>'+E(p.customer_email||'—')+'</strong></div><div class="lab-detail-field"><span>Order</span><strong>'+E(p.order_number||'—')+'</strong></div><div class="lab-detail-field"><span>Intake workflow</span><strong>'+E(p.status||'—')+'</strong></div></div><form id="statusForm" class="lab-edit-grid"><label>Account status<select name="account_status" required><option value="pending" '+(current==='pending'?'selected':'')+'>Pending</option><option value="active" '+(current==='active'?'selected':'')+'>Active</option></select></label><div class="lab-form-actions"><button type="submit" class="lab-primary">Save status</button>'+actionLink('lab-account-numbers.html','Cancel')+'</div></form><p class="lab-notice" role="status" id="saveStatus"></p></div>';
 container.querySelector('#statusForm').addEventListener('submit',async event=>{event.preventDefault();const button=event.target.querySelector('button[type="submit"]');button.disabled=true;try{const result=await call('enterprise-forms-management',{action:'set_lab_account_status',id,account_status:new FormData(event.target).get('account_status')});if(result.setup_notification_status==='failed'){container.querySelector('#saveStatus').textContent='Account status saved, but the C/TPA setup email failed. Use Lab Account Numbers → Send setup-ready email to retry.';button.disabled=false;}else{location.href='house-lab-ctpa-setup.html?intake_id='+encodeURIComponent(id)}}catch(error){container.querySelector('#saveStatus').textContent=error.message;button.disabled=false}});
}
async function loadAssignment(){
 const data=await call('lab-account-management',{action:'list'});
 accounts=data.accounts||[];ctpas=data.ctpas||[];organizations=data.organizations||[];
 const params=new URLSearchParams(location.search),id=params.get('id')||'';
 const existing=id?accounts.find(x=>x.id===id):null;
 if(id&&!existing){msg.textContent='Lab account number not found';container.innerHTML=actionLink('lab-account-numbers.html','Return to Lab Account Numbers');return}
 const selected=existing?.ctpa_id||params.get('ctpa_id')||'';
 if(selected){location.replace('lab-ctpa-profile.html?ctpa_id='+encodeURIComponent(selected)+(existing?'&account_id='+encodeURIComponent(existing.id):'')+'#accountSection');return}
 if(!id){location.replace('lab-account-numbers.html');return}
 const selectionExists=ctpas.some(c=>c.id===selected);
 if(selected&&!selectionExists){msg.textContent='The selected C/TPA no longer exists. Choose an existing customer.';}
 const orgById=new Map(organizations.map(o=>[o.id,o]));
 const nameOf=c=>orgById.get(c.organization_id)?.legal_name||c.company_code||c.id;
 const options=[...ctpas].sort((a,b)=>nameOf(a).localeCompare(nameOf(b))).map(c=>'<option value="'+E(c.id)+'" '+(c.id===selected?'selected':'')+'>'+E(nameOf(c))+' ('+E(c.status)+')</option>').join('');
 root.querySelector('h1').textContent=existing?'Edit Laboratory Account Number':'Assign Laboratory Account Number';
 msg.textContent='One record per laboratory number. Select the C/TPA and save changes to the existing record.';
 container.innerHTML='<div class="lab-detail-nav">'+actionLink('lab-account-numbers.html','← Lab Account Numbers')+'<span id="profileNav"></span></div><div class="lab-panel"><h2>C/TPA customer</h2><label class="lab-search-label">Choose C/TPA<select id="assignmentCtpa" '+(existing?'disabled':'')+'><option value="">Select a C/TPA</option>'+options+'</select></label><p class="lab-muted" id="selectedAccountStatus"></p><div id="existingAssignments" class="lab-assignment-existing"></div></div><div class="lab-panel"><div class="lab-detail-header"><div><h2>'+ (existing?'Edit assigned number':'Laboratory account numbers') +'</h2><p class="lab-muted">Edit this laboratory number, or add a new number for the selected C/TPA. Existing records are never duplicated when editing.</p></div>'+(existing?'':'<button type="button" class="lab-action lab-primary" id="addNumber">+ Add another number</button>')+'</div><div id="accountEditors"></div><div class="lab-row-actions" style="margin-top:16px"><button id="saveNumbers" type="button" class="lab-primary">'+(existing?'Save changes':'Save laboratory numbers')+'</button>'+actionLink('lab-account-numbers.html','Cancel')+'<button type="button" id="setupReady" class="lab-action">Send setup-ready email</button></div><p class="lab-notice" id="saveStatus" role="status"></p></div>';
 const ctpa=container.querySelector('#assignmentCtpa'),editors=container.querySelector('#accountEditors'),output=container.querySelector('#saveStatus');
 function profileLink(){
  const c=ctpas.find(x=>x.id===ctpa.value);
  container.querySelector('#profileNav').innerHTML=c?actionLink('lab-ctpa-profile.html?ctpa_id='+encodeURIComponent(c.id),'Open / edit C/TPA profile'):'';
  const assigned=c?accounts.filter(x=>x.ctpa_id===c.id):[];
  container.querySelector('#selectedAccountStatus').textContent=c?'Customer: '+nameOf(c)+' · '+c.status+' · '+assigned.length+' existing laboratory number(s)':'Select a C/TPA to continue';
  const slot=container.querySelector('#existingAssignments');
  if(slot)slot.innerHTML=assigned.length?'<h3>Existing assignments — edit instead of duplicating</h3><div class="lab-existing-list">'+assigned.map(x=>'<a class="lab-existing-item" href="'+assignUrl(x.id)+'"><strong>'+E(x.lab_name||'Laboratory')+' · '+E((x.config?.account_type||'dot').toUpperCase())+'</strong><span>'+E(x.account_code||'')+'</span><span>Edit assignment →</span></a>').join('')+'</div>':'<p class="lab-muted">No existing laboratory accounts for this C/TPA.</p>';
 }
 const types=['dot','non_dot','hair','oral','other'];
 function addRow(record={}){
  const box=document.createElement('div');box.className='lab-account-editor';
  const type=record.config?.account_type||'dot';
  box.innerHTML='<div class="lab-edit-grid"><label>Laboratory<input name="lab_name" maxlength="180" required placeholder="Labcorp, CRL, Quest..." value="'+E(record.lab_name||record.laboratory_name||'')+'"></label><label>Account type<select name="account_type">'+types.map(t=>'<option value="'+t+'" '+(t===type?'selected':'')+'>'+E(t.replaceAll('_',' ').toUpperCase())+'</option>').join('')+'</select></label><label>Account number<input name="account_code" maxlength="120" required placeholder="Enter laboratory account number" value="'+E(record.account_code||'')+'"></label><label>Status<select name="status"><option value="active" '+(record.status!=='inactive'?'selected':'')+'>Active</option><option value="inactive" '+(record.status==='inactive'?'selected':'')+'>Inactive</option></select></label><label>Primary<select name="is_primary"><option value="false" '+(!record.is_primary?'selected':'')+'>No</option><option value="true" '+(record.is_primary?'selected':'')+'>Yes</option></select></label><label>Notes<input name="notes" maxlength="2000" value="'+E(record.notes||'')+'"></label></div>'+(existing?'':'<div class="lab-row-actions"><button type="button" class="lab-action removeNumber">Remove row</button></div>');
  box.querySelector('.removeNumber')?.addEventListener('click',()=>{if(editors.children.length>1)box.remove();else output.textContent='At least one laboratory number is required.'});
  editors.append(box);
 }
 addRow(existing||{});
 container.querySelector('#addNumber')?.addEventListener('click',()=>addRow());
 ctpa.addEventListener('change',profileLink);profileLink();
 container.querySelector('#setupReady').onclick=async()=>{
  if(!ctpa.value){output.textContent='Choose a C/TPA first.';return}
  const btn=container.querySelector('#setupReady');btn.disabled=true;
  try{const result=await call('lab-account-management',{action:'notify_setup',ctpa_id:ctpa.value});output.textContent='Setup email: '+(result.notification_status||'unknown')}
  catch(e){output.textContent=e.message}finally{btn.disabled=false}
 };
 container.querySelector('#saveNumbers').onclick=async()=>{
  if(!ctpa.value){output.textContent='Select a C/TPA first.';ctpa.focus();return}
  const rows=[...editors.children].map(box=>Object.fromEntries([...box.querySelectorAll('[name]')].map(field=>[field.name,field.value]))).map(x=>({...x,is_primary:x.is_primary==='true'}));
  if(rows.some(x=>!x.lab_name.trim()||!x.account_code.trim())){output.textContent='Every row requires a laboratory and account number.';return}
  if(rows.filter(x=>x.is_primary).length>1){output.textContent='Only one number can be marked primary.';return}
  const key=x=>norm(x.lab_name)+'|'+norm(x.account_type);
  if(new Set(rows.map(key)).size!==rows.length){output.textContent='A laboratory and account type can only appear once. Remove the duplicate row.';return}
  if(!existing){
   const duplicate=rows.find(row=>accounts.some(a=>a.ctpa_id===ctpa.value&&key(row)===norm(a.lab_name)+'|'+norm(a.config?.account_type||'dot')));
   if(duplicate){output.textContent='This laboratory and account type is already assigned. Use the Edit assignment link above.';return}
  }
  const button=container.querySelector('#saveNumbers');button.disabled=true;output.textContent='Saving…';
  try{
   if(existing)await call('lab-account-management',{action:'save',ctpa_id:ctpa.value,id:existing.id,...rows[0]});
   else await call('lab-account-management',{action:'save_many',ctpa_id:ctpa.value,accounts:rows});
   location.href='lab-ctpa-profile.html?ctpa_id='+encodeURIComponent(ctpa.value);
  }catch(e){output.textContent=e.message;button.disabled=false}
 };
}

try{if(isNumbers)await loadNumbers();else if(isAssignment)await loadAssignment();else if(isStatus)await loadStatus();else if(isDetail)await loadDetail();else await loadIntakes()}catch(err){msg.textContent=err.message}
})();