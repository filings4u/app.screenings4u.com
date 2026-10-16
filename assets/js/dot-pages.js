/* screenings4u DOT Management Portal — page controllers */
(()=>{
"use strict";
const page=location.pathname.split('/').pop()||'dot-dashboard.html';
const $=s=>document.querySelector(s),esc=v=>window.DOTShell.escape(v),fmtDate=v=>{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(d)},badge=v=>`<span class="dot-status-pill ${/active|complete|paid|published|resolved|sent/i.test(v||'')?'ok':/error|failed|cancel|inactive/i.test(v||'')?'bad':/pending|draft|open|queued/i.test(v||'')?'warn':''}">${esc(String(v||'—').replaceAll('_',' '))}</span>`;
function message(msg,type='ok'){const n=$('#dotPageStatus');if(n)n.innerHTML=`<div class="dot-banner ${type==='error'?'warning':''}"><div><strong>${type==='error'?'Action needs attention':'Saved'}</strong><span>${esc(msg)}</span></div></div>`}
function ensureBrandModal(){
 let modal=document.getElementById('dotBrandModal');
 if(modal)return modal;
 modal=document.createElement('div');
 modal.id='dotBrandModal';
 modal.className='dot-brand-modal';
 modal.hidden=true;
 modal.innerHTML=`<div class="dot-brand-modal-backdrop" data-modal-close></div><section class="dot-brand-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="dotBrandModalTitle"><header class="dot-brand-modal-head"><div><span id="dotBrandModalKicker">SCREENINGS4U DOT</span><h2 id="dotBrandModalTitle">Management</h2></div><button type="button" class="dot-brand-modal-close" data-modal-close aria-label="Close">×</button></header><div class="dot-brand-modal-body" id="dotBrandModalBody"></div><footer class="dot-brand-modal-actions" id="dotBrandModalActions"></footer></section>`;
 document.body.appendChild(modal);
 modal.addEventListener('click',e=>{if(e.target.closest('[data-modal-close]'))closeBrandModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeBrandModal()});
 return modal;
}
function closeBrandModal(){const modal=document.getElementById('dotBrandModal');if(modal){modal.hidden=true;document.body.classList.remove('dot-modal-open')}}
function openBrandModal({title='Management',kicker='SCREENINGS4U DOT',body='',actions=''}){const modal=ensureBrandModal();$('#dotBrandModalTitle').textContent=title;$('#dotBrandModalKicker').textContent=kicker;$('#dotBrandModalBody').innerHTML=body;$('#dotBrandModalActions').innerHTML=actions||'<button class="dot-btn primary" type="button" data-modal-close>Close</button>';modal.hidden=false;document.body.classList.add('dot-modal-open');return modal}
function base({eyebrow='DOT MANAGEMENT',title,copy,actions=''}){return `<section class="dot-page"><header class="dot-page-head"><div><span class="dot-eyebrow">${esc(eyebrow)}</span><h1>${esc(title)}</h1><p>${esc(copy)}</p></div><div class="dot-actions">${actions}<button class="dot-btn" type="button" id="dotRefresh">Refresh</button></div></header><div id="dotPageStatus"></div><div id="dotPageBody"><div class="dot-card"><div class="dot-empty"><div class="dot-instant-placeholder" aria-hidden="true"></div></div></div></div></section>`}
function renderBase(o){$('#dotPageMount').innerHTML=base(o);$('#dotRefresh')?.addEventListener('click',()=>load().catch(showError))}
function showError(e){console.error(e);$('#dotPageStatus').innerHTML=`<div class="dot-banner warning"><div><strong>Unable to load this DOT module.</strong><span>${esc(e?.message||String(e))}</span></div></div>`;$('#dotPageBody').innerHTML='<div class="dot-card"><div class="dot-empty">The page shell is ready, but its backend request did not complete.</div></div>'}
function table(headers,rows){return `<div class="dot-card"><div class="dot-table-wrap"><table class="dot-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}"><div class="dot-empty">No DOT records found.</div></td></tr>`}</tbody></table></div></div>`}
function metric(label,value,small=''){const shown=(value===0||value==='0')?'0':(value??'0');return `<article class="dot-metric"><span>${esc(label)}</span><strong>${esc(String(shown))}</strong><small>${esc(small)}</small></article>`}
function metrics(items){return `<div class="dot-metrics">${items.map(x=>metric(...x)).join('')}</div>`}
function get(d,...keys){for(const k of keys){if(Array.isArray(d?.[k]))return d[k]}return []}
function name(x){return esc(x?.legal_name||x?.name||x?.organizations?.legal_name||[x?.first_name,x?.last_name].filter(Boolean).join(' ')||x?.email||x?.id||'—')}
const listPages={
 'dot-ctpas.html':{action:'ctpas',title:'DOT C/TPAs',copy:'Manage every C/TPA account, subscription, features, staff, customer portfolio, branding, billing, support, and portal controls.',headers:['C/TPA','Contact','Portal','Status','Manage'],rows:d=>get(d,'ctpas').map(x=>[name(x),esc(x.support_email||x.organizations?.primary_email||'—'),badge(x.portal_status||'configured'),badge(x.status),`<a class="dot-btn small primary" href="dot-ctpa-detail.html?id=${encodeURIComponent(x.id)}">Manage</a>`])},
 'dot-employers.html':{action:'employers',title:'DOT Employers',copy:'Manage direct and C/TPA-sponsored employers, USDOT details, agencies, and status.',headers:['Employer','USDOT / MC','Agency','Status'],rows:d=>get(d,'employers').map(x=>[name(x),esc([x.dot_number,x.mc_number].filter(Boolean).join(' / ')||'—'),esc(x.applicable_dot_agency||x.dot_agency||'—'),badge(x.status)])},
 'dot-owner-operators.html':{action:'owner_operators',title:'Owner-Operators',copy:'Manage FMCSA owner-operator accounts and consortium participation.',headers:['Owner-Operator','USDOT / MC','Consortium','Status'],rows:d=>get(d,'owner_operators').map(x=>[name(x),esc([x.dot_number,x.mc_number].filter(Boolean).join(' / ')||'—'),esc(x.consortium_name||x.pool_name||'—'),badge(x.status)])},
 'dot-drivers.html':{action:'drivers',title:'DOT Drivers',copy:'Manage safety-sensitive drivers and DOT workforce records.',headers:['Driver','Employer','Agency / CDL','Status'],rows:d=>get(d,'drivers','employees').map(x=>[name(x),esc(x.employer_name||x.employer_id||'—'),esc([x.dot_agency,x.cdl_number].filter(Boolean).join(' · ')||'—'),badge(x.status||x.employment_status)])},
 'dot-pools.html':{action:'pools',title:'Consortiums',copy:'Manage DOT Consortiums, ownership, membership, and random-selection setup.',headers:['Consortium','Owner','Agency','Members','Status'],rows:d=>get(d,'pools').map(x=>[name(x),esc(x.ctpa_name||x.employer_name||x.ctpa_id||x.employer_id||'—'),esc(x.dot_agency||'—'),esc(x.member_count??x.population_size??'—'),badge(x.status)])},
 'dot-random-selections.html':{action:'selections',title:'Random Selections',copy:'Review DOT random selection events, population, completion, and notices.',headers:['Selection','Consortium','Date','Population','Status'],rows:d=>get(d,'selections').map(x=>[esc(x.selection_number||x.id||'—'),esc(x.pool_name||x.pool_id||'—'),fmtDate(x.selection_date||x.created_at),esc(x.population_size??'—'),badge(x.status)])},
 'dot-testing-orders.html':{action:'testing',title:'DOT Testing Orders',copy:'Manage drug and alcohol testing requests, collections, status, and handoff.',headers:['Order','Person','Employer','Test','Status'],rows:d=>get(d,'testing_orders','orders').map(x=>[esc(x.order_number||x.id||'—'),esc(x.driver_name||x.employee_name||x.employee_id||'—'),esc(x.employer_name||x.employer_id||'—'),esc([x.test_reason,x.test_type].filter(Boolean).join(' · ')||'—'),badge(x.status)])},
 'dot-results.html':{action:'results',title:'DOT Results',copy:'Review DOT test results, documents, publication status, and final disposition.',headers:['Result','Order','Person','Outcome','Status'],rows:d=>get(d,'results').map(x=>[esc(x.result_number||x.id||'—'),esc(x.order_number||x.testing_order_id||'—'),esc(x.driver_name||x.employee_name||x.employee_id||'—'),esc(x.result||x.outcome||'—'),badge(x.status)])},
 'dot-compliance.html':{action:'compliance',title:'Compliance Cases',copy:'Manage DOT compliance cases, deadlines, priorities, and corrective action.',headers:['Case','Employer','Event','Priority','Status'],rows:d=>get(d,'compliance_cases','cases').map(x=>[esc(x.case_number||x.id||'—'),esc(x.employer_name||x.employer_id||'—'),esc(x.event_type||'—'),esc(x.priority||'—'),badge(x.status)])},
 'dot-return-to-duty.html':{action:'rtd',title:'Return-to-Duty / SAP',copy:'Manage SAP evaluations and return-to-duty cases.',headers:['Case','Evaluation','RTD Status','Compliance Case','Status'],rows:d=>get(d,'sap_cases','rtd','cases').map(x=>[esc(x.id||'—'),fmtDate(x.evaluation_date),esc(x.return_to_duty_status||'—'),esc(x.compliance_case_id||'—'),badge(x.status)])},
 'dot-catalog.html':{action:'services',title:'DOT Catalog & Pricing',copy:'Manage DOT services and the product catalog presented to DOT customers.',headers:['Service','Category','Delivery','Price / Code','Status'],rows:d=>get(d,'services').map(x=>[name(x),esc(x.category||'—'),esc(x.delivery_method||x.delivery||'—'),esc(x.price??x.code??'—'),badge(x.status)])},
 'dot-orders.html':{action:'orders',title:'DOT Service Orders',copy:'Review service orders and order status for DOT customers.',headers:['Order','Customer','Service','Total','Status'],rows:d=>get(d,'orders','service_orders').map(x=>[esc(x.order_number||x.id||'—'),esc(x.customer_name||x.employer_name||x.organization_id||'—'),esc(x.service_name||x.service_code||'—'),esc(x.total??x.amount??'—'),badge(x.status)])},
 'dot-invoices.html':{action:'billing',title:'DOT Billing & Invoices',copy:'Review subscriptions, invoices, receivables, and billing status for DOT accounts.',headers:['Invoice / Account','Customer','Amount','Due','Status'],rows:d=>get(d,'invoices','subscriptions').map(x=>[esc(x.invoice_number||x.id||'—'),esc(x.customer_name||x.organization_id||'—'),esc(x.total??x.amount_due??x.amount??'—'),fmtDate(x.due_date||x.current_period_end),badge(x.status)])},
 'dot-documents.html':{action:'documents',title:'DOT Documents',copy:'Manage documents attached to DOT employers, drivers, programs, and compliance records.',headers:['Document','Customer','Type','Updated','Status'],rows:d=>get(d,'documents').map(x=>[name(x),esc(x.customer_name||x.employer_id||'—'),esc(x.document_type||'—'),fmtDate(x.updated_at||x.uploaded_at||x.created_at),badge(x.status||'active')])},
 'dot-training.html':{action:'training',title:'DOT Training Records',copy:'Review DOT-required and customer-assigned training records.',headers:['Training','Person / Account','Type','Completed','Status'],rows:d=>get(d,'training_records','training').map(x=>[name(x),esc(x.driver_name||x.employee_id||x.organization_id||'—'),esc(x.training_type||'—'),fmtDate(x.completed_at),badge(x.status)])},
 'dot-notifications.html':{action:'notifications',title:'DOT Notifications',copy:'Review and manage outbound DOT portal notifications and notices.',headers:['Subject','Channel','Recipient','Queued / Sent','Status'],rows:d=>get(d,'notifications').map(x=>[esc(x.subject||x.event_type||'—'),esc(x.channel||'—'),esc(x.recipient||x.email||'—'),fmtDate(x.sent_at||x.queued_at||x.created_at),badge(x.status)])},
 'dot-support.html':{action:'support',title:'DOT Support',copy:'Manage support activity for DOT C/TPAs, employers, owner-operators, drivers, and portal users.',headers:['Ticket','Customer','Priority','Updated','Status'],rows:d=>get(d,'tickets','support_tickets').map(x=>[esc(x.ticket_number||x.id||'—'),esc(x.customer_name||x.organization_id||'—'),esc(x.priority||'—'),fmtDate(x.updated_at||x.created_at),badge(x.status)])},
 'dot-audit.html':{action:'audit_history',title:'DOT Audit History',copy:'Review DOT management actions and operational audit events.',headers:['Event','Actor','Resource','Date','Status'],rows:d=>get(d,'audit','events').map(x=>[esc(x.action||x.event_type||'—'),esc(x.actor_email||x.actor_id||'—'),esc(x.resource_type||x.resource_id||'—'),fmtDate(x.created_at),badge(x.status||'recorded')])}
};

function programSource(x){
 const raw=String(x.source_type||x.owner_type||x.created_source||x.program_source||'').toLowerCase();
 if(x.ctpa_id||x.ctpa_name||x.ctpa_organization_id||raw.includes('ctpa')||raw.includes('c/tpa'))return 'C/TPA';
 if(x.admin_created===true||x.created_by_admin===true||x.management_created===true||raw.includes('admin')||raw.includes('management'))return 'Admin';
 if(x.employer_id||x.employer_name||x.organization_id||raw.includes('employer'))return 'Direct Employer';
 return 'Admin';
}
function programAccount(x){return x.ctpa_name||x.employer_name||x.organization_name||x.customer_name||x.organizations?.legal_name||x.account_name||x.ctpa_id||x.employer_id||x.organization_id||'screenings4u DOT'}
function programName(x){return x.name||x.program_name||x.title||x.program_code||x.id||'DOT Program'}
function programAgency(x){return x.dot_agency||x.agency||x.regulatory_authority||x.agency_code||'—'}
function programPanel(x){return x.testing_panel||x.panel_name||x.panel||x.testing_method||x.program_type||'—'}
function programDirectoryIndex(ctpas=[],employers=[]){
 const byId=new Map(),byOrg=new Map();
 const add=(x,type)=>{if(!x)return;const record={...x,_directoryType:type};if(x.id)byId.set(String(x.id),record);if(x.organization_id)byOrg.set(String(x.organization_id),record);if(x.organizations?.id)byOrg.set(String(x.organizations.id),record)};
 ctpas.forEach(x=>add(x,'C/TPA'));employers.forEach(x=>add(x,'Direct Employer'));
 return {byId,byOrg};
}
function resolveProgramCompany(x,src,index){
 let rec=null;
 if(src==='C/TPA')rec=index.byId.get(String(x.ctpa_id||''))||index.byOrg.get(String(x.ctpa_organization_id||x.organization_id||''));
 else if(src==='Direct Employer')rec=index.byId.get(String(x.employer_id||''))||index.byOrg.get(String(x.organization_id||''));
 const org=rec?.organizations||x.organizations||{};
 const company=rec?.legal_name||rec?.company_name||rec?.name||org.legal_name||org.dba_name||x.ctpa_name||x.employer_name||x.organization_name||x.customer_name||x.account_name||(src==='Admin'?'screenings4u':'—');
 const dba=rec?.dba_name||org.dba_name||x.dba_name||'';
 const dot=rec?.dot_number||rec?.usdot_number||x.dot_number||x.usdot_number||'';
 const mc=rec?.mc_number||x.mc_number||'';
 const email=rec?.support_email||rec?.primary_email||org.primary_email||rec?.email||x.contact_email||x.email||'';
 const phone=rec?.support_phone||rec?.phone||org.phone||x.contact_phone||x.phone||'';
 const accountId=(src==='C/TPA'?(x.ctpa_id||rec?.id):(src==='Direct Employer'?(x.employer_id||rec?.id):(x.organization_id||'')))||'';
 const orgId=x.organization_id||x.ctpa_organization_id||rec?.organization_id||org.id||'';
 return {company,dba,dot,mc,email,phone,accountId,orgId};
}
function companyCell(c,src){
 const identifiers=[];
 if(c.dot)identifiers.push(`USDOT ${esc(c.dot)}`);
 if(c.mc)identifiers.push(`MC ${esc(c.mc)}`);
 const contact=[c.email,c.phone].filter(Boolean).map(esc).join(' · ');
 const ids=[];
 if(c.accountId)ids.push(`Account ${esc(c.accountId)}`);
 if(c.orgId&&c.orgId!==c.accountId)ids.push(`Org ${esc(c.orgId)}`);
 return `<div class="dot-program-company"><strong>${esc(c.company)}</strong>${c.dba&&c.dba!==c.company?`<small>DBA: ${esc(c.dba)}</small>`:''}${identifiers.length?`<small>${identifiers.join(' · ')}</small>`:''}${contact?`<small>${contact}</small>`:''}${ids.length?`<small class="dot-muted-id">${ids.join(' · ')}</small>`:''}</div>`;
}
async function loadPrograms(){
 const INTERNAL_CTPA_ID='ceba7ede-f60d-463e-85b0-ff2c5e3eb89c';
 renderBase({title:'DOT Programs',copy:'Administrative program management. screenings4u administrators can create unlimited central DOT programs and assign DOT employers to them. C/TPAs and direct employers continue to create and manage their own programs in their portals.',actions:`<button class="dot-btn primary" id="toggleProgramCreate">New Admin Program</button>`});
 document.querySelector('.dot-page')?.classList.add('program-admin-page');
 const settled=await Promise.allSettled([
   window.DOTApi.call('programs',{admin_workspace:true},{fresh:true}),
   window.DOTApi.call('ctpas'),
   window.DOTApi.call('employers')
 ]);
 const d=settled[0].status==='fulfilled'?settled[0].value:{programs:[],program_employers:[]},ctpaData=settled[1].status==='fulfilled'?settled[1].value:{ctpas:[]},employerData=settled[2].status==='fulfilled'?settled[2].value:{employers:[]};
 const programs=get(d,'programs').filter(Boolean),assignments=get(d,'program_employers').filter(x=>!x.removed_at&&String(x.status||'active')==='active'),employers=get(employerData,'employers').filter(x=>!x.archived_at&&String(x.status||'active')!=='archived');
 const directory=programDirectoryIndex(get(ctpaData,'ctpas'),employers);
 const isAdmin=x=>String(x.ctpa_id||'')===INTERNAL_CTPA_ID||x.agency_configuration?.source_type==='admin'||x.agency_configuration?.managed_by==='screenings4u_dot';
 const source=x=>isAdmin(x)?'Admin':programSource(x);
 const rows=programs.map((x,i)=>{
   const src=source(x),srcClass=src==='C/TPA'?'ctpa':src==='Direct Employer'?'direct':'admin',company=src==='Admin'?{company:'screenings4u DOT',dba:'',dot:'',mc:'',email:'',phone:'',accountId:'',orgId:''}:resolveProgramCompany(x,src,directory),agency=String(programAgency(x));
   const assigned=assignments.filter(a=>String(a.program_id)===String(x.id));
   const search=[programName(x),company.company,company.dba,company.dot,company.mc,company.email,company.phone,src,agency,programPanel(x)].filter(Boolean).join(' ').toLowerCase();
   return {src,agency,html:`<tr data-program-row data-source="${esc(srcClass)}" data-agency="${esc(agency.toLowerCase())}" data-search="${esc(search)}"><td><strong>${esc(programName(x))}</strong><small>${esc(x.id||'')}</small></td><td><span class="dot-source-pill ${srcClass}">${esc(src)}</span></td><td>${companyCell(company,src)}</td><td>${esc(agency)}</td><td>${esc(programPanel(x))}</td><td>${src==='Admin'?esc(String(assigned.length)):'—'}</td><td>${badge(x.status||'active')}</td><td>${src==='Admin'?`<button class="dot-btn small" data-manage-admin-program="${esc(x.id)}">Manage Employers</button>`:`<a class="dot-btn small" href="dot-record.html?module=programs&row=${i}">View</a>`}</td></tr>`};
 });
 const agencies=[...new Set(rows.map(r=>r.agency).filter(v=>v&&v!=='—'))].sort();
 $('#dotPageBody').innerHTML=`
 <div id="adminProgramCreate" class="dot-card" hidden>
  <div class="dot-card-head"><div><h2>Create screenings4u Admin Program</h2><p>Create a central DOT program. Employers are assigned after the program is created.</p></div></div>
  <div class="dot-card-body"><div class="dot-field-grid">
   <div class="dot-field"><label>Program Name</label><input id="adminProgramName" value="FMCSA DOT Drug & Alcohol Program"></div>
   <div class="dot-field"><label>DOT Agency</label><select id="adminProgramAgency"><option>FMCSA</option><option>FAA</option><option>FRA</option><option>FTA</option><option>PHMSA</option><option>USCG</option></select></div>
   <div class="dot-field"><label>Testing Panel</label><input id="adminProgramPanel" value="DOT 5 Panel"></div>
   <div class="dot-field"><label>Testing Method</label><input id="adminProgramMethod" value="urine"></div>
   <div class="dot-field"><label>Effective Date</label><input id="adminProgramEffective" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
   <div class="dot-field"><label>Testing Frequency</label><select id="adminProgramFrequency"><option value="quarterly">Quarterly</option><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div>
  </div><div class="dot-actions"><button class="dot-btn primary" id="createAdminProgram">Create Admin Program</button><button class="dot-btn" id="cancelAdminProgram">Cancel</button></div><div id="adminProgramMsg"></div></div>
 </div>
 ${metrics([['All Programs',programs.length,'Visible across DOT operations'],['Admin Programs',programs.filter(isAdmin).length,'Managed by screenings4u administrators'],['C/TPA Programs',programs.filter(x=>source(x)==='C/TPA').length,'Created by C/TPAs'],['Direct Employer Programs',programs.filter(x=>source(x)==='Direct Employer').length,'Created by direct employers']])}
 <div class="dot-card dot-program-directory">
  <div class="dot-card-head"><div><h2>Program Directory</h2><p>Admin programs accept employer assignments. C/TPA and direct-employer programs remain customer-managed.</p></div><span class="dot-badge active" id="programVisibleCount">${programs.length} programs</span></div>
  <div class="dot-card-body dot-program-filters"><div class="dot-filter-row"><input id="programSearch" type="search" placeholder="Search program, company, USDOT, MC, email, agency or panel"><select id="programSource"><option value="">All sources</option><option value="admin">Admin</option><option value="ctpa">C/TPAs</option><option value="direct">Direct employers</option></select><select id="programAgency"><option value="">All agencies</option>${agencies.map(a=>`<option value="${esc(a.toLowerCase())}">${esc(a)}</option>`).join('')}</select></div></div>
  <div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Program</th><th>Source</th><th>Owner</th><th>Agency</th><th>Panel / Type</th><th>Assigned Employers</th><th>Status</th><th>Manage</th></tr></thead><tbody>${rows.length?rows.map(r=>r.html).join(''):'<tr><td colspan="8"><div class="dot-empty">No DOT programs found.</div></td></tr>'}</tbody></table></div>
 </div>
 <div class="dot-card" id="programEmployerManager" hidden><div class="dot-card-head"><div><h2 id="programEmployerTitle">Program Employer Assignments</h2><p>Assign an employer and set that employer's Consortium expiration date. Each employer keeps its own expiration date.</p></div></div><div class="dot-card-body"><div class="dot-field-grid dot-assignment-grid"><div class="dot-field"><label>Employer</label><select id="programEmployerSelect"><option value="">Select employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(e.legal_name||e.dba_name||e.id)}${e.dot_number?' — USDOT '+esc(e.dot_number):''}</option>`).join('')}</select></div><div class="dot-field"><label>Consortium Expires</label><input id="programEmployerExpires" type="date"><div class="dot-help">Required. This expiration date belongs only to the selected employer.</div></div></div><div class="dot-actions"><button class="dot-btn primary" id="assignProgramEmployer">Assign Employer</button><button class="dot-btn" id="closeProgramEmployer">Close</button></div><div id="programEmployerList"></div></div></div>`;
 const filter=()=>{const q=($('#programSearch')?.value||'').trim().toLowerCase(),src=$('#programSource')?.value||'',agency=$('#programAgency')?.value||'';let visible=0;document.querySelectorAll('[data-program-row]').forEach(tr=>{const ok=(!q||tr.dataset.search.includes(q))&&(!src||tr.dataset.source===src)&&(!agency||tr.dataset.agency===agency);tr.hidden=!ok;if(ok)visible++;});if($('#programVisibleCount'))$('#programVisibleCount').textContent=`${visible} program${visible===1?'':'s'}`};
 ['programSearch','programSource','programAgency'].forEach(id=>$('#'+id)?.addEventListener(id==='programSearch'?'input':'change',filter));
 const showCreate=on=>{$('#adminProgramCreate').hidden=!on}; $('#toggleProgramCreate').onclick=()=>showCreate(true); $('#cancelAdminProgram').onclick=()=>showCreate(false);
 $('#createAdminProgram').onclick=async()=>{const btn=$('#createAdminProgram');try{btn.disabled=true;await DOTApi.call('admin_create_program',{program:{name:$('#adminProgramName').value,dot_agency:$('#adminProgramAgency').value,regulatory_authority:$('#adminProgramAgency').value,testing_panel:$('#adminProgramPanel').value,testing_method:$('#adminProgramMethod').value,effective_date:$('#adminProgramEffective').value,testing_frequency:$('#adminProgramFrequency').value,status:'active'}});DOTApi.clearCache();location.reload()}catch(e){$('#adminProgramMsg').innerHTML=`<div class="dot-banner warning"><strong>Unable to create program</strong><span>${esc(e.message)}</span></div>`;btn.disabled=false}};
 let activeProgram=null;
 const renderAssignments=()=>{const list=assignments.filter(a=>String(a.program_id)===String(activeProgram));$('#programEmployerList').innerHTML=list.length?`<div class="dot-table-wrap" style="margin-top:16px"><table class="dot-table dot-assignment-table"><thead><tr><th>Employer</th><th>USDOT</th><th>Assigned</th><th>Consortium Expires</th><th></th></tr></thead><tbody>${list.map(a=>{const e=employers.find(x=>String(x.id)===String(a.employer_id))||{};return `<tr><td><strong>${esc(e.legal_name||e.dba_name||a.employer_id)}</strong></td><td>${esc(e.dot_number||'—')}</td><td>${fmtDate(a.assigned_at||a.created_at)}</td><td><div class="dot-inline-date"><input type="date" value="${esc(a.consortium_expires_on||'')}" data-consortium-expiration="${esc(a.id)}"><button class="dot-btn small" data-save-consortium-expiration="${esc(a.id)}">Save</button></div></td><td><button class="dot-btn small" data-remove-program-employer="${esc(a.id)}">Remove</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="dot-empty">No employers assigned to this program.</div>';document.querySelectorAll('[data-save-consortium-expiration]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.saveConsortiumExpiration,input=document.querySelector(`[data-consortium-expiration="${CSS.escape(id)}"]`);if(!input?.value)return alert('Select a Consortium expiration date.');try{btn.disabled=true;await DOTApi.call('admin_update_employer_consortium_expiration',{assignment_id:id,consortium_expires_on:input.value});DOTApi.clearCache();location.reload()}catch(e){alert(e.message);btn.disabled=false}});document.querySelectorAll('[data-remove-program-employer]').forEach(btn=>btn.onclick=async()=>{try{await DOTApi.call('admin_remove_employer_program',{assignment_id:btn.dataset.removeProgramEmployer});DOTApi.clearCache();location.reload()}catch(e){alert(e.message)}})};
 document.querySelectorAll('[data-manage-admin-program]').forEach(btn=>btn.onclick=()=>{activeProgram=btn.dataset.manageAdminProgram;const p=programs.find(x=>String(x.id)===String(activeProgram));$('#programEmployerTitle').textContent=`${p?.name||'Program'} — Employers`;$('#programEmployerManager').hidden=false;renderAssignments();$('#programEmployerManager').scrollIntoView({behavior:'smooth',block:'start'})});
 $('#closeProgramEmployer').onclick=()=>{$('#programEmployerManager').hidden=true;activeProgram=null};
 $('#assignProgramEmployer').onclick=async()=>{if(!activeProgram||!$('#programEmployerSelect').value)return;const expires=$('#programEmployerExpires').value;if(!expires)return alert('Select the Consortium expiration date for this employer.');try{await DOTApi.call('admin_assign_employer_program',{program_id:activeProgram,employer_id:$('#programEmployerSelect').value,consortium_expires_on:expires});DOTApi.clearCache();location.reload()}catch(e){alert(e.message)}};
}


function poolSource(x){
 const raw=String(x.source_type||x.owner_type||x.account_type||x.created_by_type||x.management_type||'').toLowerCase();
 if(x.ctpa_id||x.ctpa_name||raw.includes('ctpa')||raw.includes('c/tpa'))return 'C/TPA';
 if(x.admin_created===true||x.created_by_admin===true||raw.includes('admin')||raw.includes('management'))return 'Admin';
 if(x.employer_id||x.employer_name||x.organization_id||raw.includes('employer'))return 'Direct Employer';
 return 'Admin';
}
function poolName(x){return x.name||x.pool_name||x.consortium_name||x.title||x.pool_code||x.id||'DOT Consortium'}
function poolAgency(x){return x.dot_agency||x.agency||x.regulatory_authority||x.agency_code||'—'}
function poolMembers(x){return x.member_count??x.population_size??x.members_count??x.driver_count??'—'}
async function loadPools(){
 const INTERNAL_CTPA_ID='ceba7ede-f60d-463e-85b0-ff2c5e3eb89c';
 renderBase({title:'Consortiums',copy:'Administrative Consortium management. screenings4u administrators create central Consortiums and add DOT-covered drivers or safety-sensitive workers. Customer C/TPAs and direct employers create their own Consortiums in their portals.',actions:`<button class="dot-btn primary" id="togglePoolCreate">New Admin Consortium</button>`});
 document.querySelector('.dot-page')?.classList.add('program-admin-page');
 const settled=await Promise.allSettled([
  window.DOTApi.call('pools',{admin_workspace:true},{fresh:true}),
  window.DOTApi.call('programs',{admin_workspace:true},{fresh:true})
 ]);
 const d=settled[0].status==='fulfilled'?settled[0].value:{pools:[],pool_members:[],employers:[],ctpas:[]},pd=settled[1].status==='fulfilled'?settled[1].value:{programs:[],program_employers:[],employers:[],ctpas:[]};
 const pools=get(d,'pools').filter(x=>x&&!x.archived_at&&String(x.status||'').toLowerCase()!=='archived'),members=get(d,'pool_members','pool_memberships').filter(x=>!x.removed_at&&String(x.eligibility_status||'')!=='removed'),programs=get(pd,'programs').filter(Boolean),programAssignments=get(pd,'program_employers').filter(x=>!x.removed_at&&String(x.status||'active')==='active');
 const employers=[...new Map([...get(d,'employers'),...get(pd,'employers')].filter(x=>x&&!x.archived_at).map(x=>[x.id,x])).values()];
 const ctpas=[...new Map([...get(d,'ctpas'),...get(pd,'ctpas')].filter(Boolean).map(x=>[x.id,x])).values()];
 const directory=programDirectoryIndex(ctpas,employers),isAdminPool=x=>String(x.ctpa_id||'')===INTERNAL_CTPA_ID,isAdminProgram=x=>String(x.ctpa_id||'')===INTERNAL_CTPA_ID||x.agency_configuration?.source_type==='admin';
 const rows=pools.map((x,i)=>{const src=isAdminPool(x)?'Admin':poolSource(x),srcClass=src==='C/TPA'?'ctpa':src==='Direct Employer'?'direct':'admin',company=src==='Admin'?{company:'screenings4u DOT',dba:'',dot:'',mc:'',email:'',phone:'',accountId:'',orgId:''}:resolveProgramCompany(x,src,directory),agency=String(poolAgency(x)),cnt=members.filter(m=>String(m.pool_id)===String(x.id)).length,type=x.pool_type||'consortium',search=[poolName(x),company.company,src,agency,type].join(' ').toLowerCase();return {src,agency,html:`<tr data-pool-row data-source="${esc(srcClass)}" data-agency="${esc(agency.toLowerCase())}" data-search="${esc(search)}"><td><strong>${esc(poolName(x))}</strong><small>${esc(x.id||'')}</small></td><td><span class="dot-source-pill ${srcClass}">${esc(src)}</span></td><td>${companyCell(company,src)}</td><td>${esc(agency)}</td><td>${esc(type)}</td><td>${cnt}</td><td>${badge(x.status||'active')}</td><td>${src==='Admin'?`<button class="dot-btn small" data-manage-admin-pool="${esc(x.id)}">Manage Workers</button>`:`<a class="dot-btn small" href="dot-record.html?module=pools&row=${i}">View</a>`}</td></tr>`}});
 const agencies=[...new Set(rows.map(r=>r.agency).filter(v=>v&&v!=='—'))].sort(),adminPrograms=programs.filter(isAdminProgram);
 $('#dotPageBody').innerHTML=`
 <div id="adminPoolCreate" class="dot-card"><div class="dot-card-head"><div><h2>Create screenings4u Admin Consortium</h2><p>Create the central Consortium first, then add eligible workers.</p></div></div><div class="dot-card-body"><div class="dot-field-grid">
  <div class="dot-field"><label>Name</label><input id="adminPoolName" value="Workforce DOT FMCSA Consortium"></div>
  <div class="dot-field"><label>Program</label><select id="adminPoolProgram"><option value="">Select admin program</option>${adminPrograms.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.id)}</option>`).join('')}</select></div>
  <div class="dot-field"><label>Consortium Type</label><select id="adminPoolType"><option value="consortium">Consortium</option></select></div>
  <div class="dot-field"><label>Effective Date</label><input id="adminPoolEffective" type="date" value="${new Date().toISOString().slice(0,10)}"></div>
  <div class="dot-field"><label>Drug Random Rate</label><input id="adminPoolDrug" type="number" step="0.01"></div>
  <div class="dot-field"><label>Alcohol Random Rate</label><input id="adminPoolAlcohol" type="number" step="0.01"></div>
 </div><div class="dot-actions"><button type="button" class="dot-btn primary" id="createAdminPool">Create Admin Consortium</button><button class="dot-btn" id="cancelAdminPool">Cancel</button></div><div id="adminPoolMsg"></div></div></div>
 ${metrics([['All Consortiums',pools.length,'Visible across DOT operations'],['Admin Consortiums',pools.filter(isAdminPool).length,'Managed by screenings4u administrators'],['C/TPA Consortiums',pools.filter(x=>!isAdminPool(x)&&poolSource(x)==='C/TPA').length,'Created by C/TPAs'],['Direct Employer Consortiums',pools.filter(x=>!isAdminPool(x)&&poolSource(x)==='Direct Employer').length,'Created by direct employers']])}
 <div class="dot-card dot-program-directory"><div class="dot-card-head"><div><h2>Consortium Directory</h2><p>Admin Consortiums accept DOT-covered drivers and safety-sensitive workers. Customer-owned Consortiums remain customer-managed.</p></div><span class="dot-badge active" id="poolVisibleCount">${pools.length} records</span></div><div class="dot-card-body dot-program-filters"><div class="dot-filter-row"><input id="poolSearch" type="search" placeholder="Search Consortium, agency or source"><select id="poolSource"><option value="">All sources</option><option value="admin">Admin</option><option value="ctpa">C/TPAs</option><option value="direct">Direct employers</option></select><select id="poolAgency"><option value="">All agencies</option>${agencies.map(a=>`<option value="${esc(a.toLowerCase())}">${esc(a)}</option>`).join('')}</select></div></div><div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Consortium</th><th>Source</th><th>Owner</th><th>Agency</th><th>Type</th><th>Members</th><th>Status</th><th>Manage</th></tr></thead><tbody>${rows.length?rows.map(r=>r.html).join(''):'<tr><td colspan="8"><div class="dot-empty">No DOT Consortiums found.</div></td></tr>'}</tbody></table></div></div>
 <div class="dot-card" id="poolWorkerManager" hidden><div class="dot-card-head"><div><h2 id="poolWorkerTitle">Consortium Worker Membership</h2><p>All employees for employers assigned to this program are listed by name. DOT-covered drivers and safety-sensitive employees can be added to the Consortium.</p></div></div><div class="dot-card-body"><div class="dot-field-grid"><div class="dot-field"><label>Worker</label><select id="poolWorkerSelect"><option value="">Select eligible worker</option></select></div></div><div class="dot-actions"><button class="dot-btn primary" id="assignPoolWorker">Add Worker to Consortium</button><button class="dot-btn" id="closePoolWorker">Close</button></div><div id="poolWorkerList"></div></div></div>`;
 const filter=()=>{const q=($('#poolSearch')?.value||'').trim().toLowerCase(),src=$('#poolSource')?.value||'',agency=$('#poolAgency')?.value||'';let visible=0;document.querySelectorAll('[data-pool-row]').forEach(tr=>{const ok=(!q||tr.dataset.search.includes(q))&&(!src||tr.dataset.source===src)&&(!agency||tr.dataset.agency===agency);tr.hidden=!ok;if(ok)visible++;});if($('#poolVisibleCount'))$('#poolVisibleCount').textContent=`${visible} record${visible===1?'':'s'}`};['poolSearch','poolSource','poolAgency'].forEach(id=>$('#'+id)?.addEventListener(id==='poolSearch'?'input':'change',filter));
 const showCreate=on=>{const card=$('#adminPoolCreate');if(!card)return;card.hidden=!on;if(on)card.scrollIntoView({behavior:'smooth',block:'start'})};
 const toggleBtn=$('#togglePoolCreate');if(toggleBtn){toggleBtn.type='button';toggleBtn.addEventListener('click',e=>{e.preventDefault();showCreate(true)})}
 const cancelBtn=$('#cancelAdminPool');if(cancelBtn){cancelBtn.type='button';cancelBtn.addEventListener('click',e=>{e.preventDefault();showCreate(false)})}
 $('#createAdminPool').onclick=async()=>{const btn=$('#createAdminPool');try{btn.disabled=true;await DOTApi.call('admin_create_pool',{pool:{name:$('#adminPoolName').value,program_id:$('#adminPoolProgram').value,pool_type:$('#adminPoolType').value,effective_date:$('#adminPoolEffective').value,drug_testing_rate:$('#adminPoolDrug').value===''?null:Number($('#adminPoolDrug').value),alcohol_testing_rate:$('#adminPoolAlcohol').value===''?null:Number($('#adminPoolAlcohol').value),selection_schedule:'quarterly',status:'active'}});DOTApi.clearCache();location.reload()}catch(e){$('#adminPoolMsg').innerHTML=`<div class="dot-banner warning"><strong>Unable to create Consortium</strong><span>${esc(e.message)}</span></div>`;btn.disabled=false}};
 let activePool=null,activePoolOptions=null;
 const renderPoolMembers=async()=>{const pool=pools.find(x=>String(x.id)===String(activePool));if(!pool)return;$('#poolWorkerSelect').innerHTML='<option value="">Loading employer employees…</option>';$('#poolWorkerList').innerHTML='<div class="dot-empty">Loading assigned employer employees…</div>';try{activePoolOptions=await DOTApi.call('admin_pool_worker_options',{pool_id:activePool},{fresh:true});const opts=activePoolOptions||{},allWorkers=opts.workers||[],current=opts.pool_memberships||[],available=allWorkers.filter(w=>!w.already_in_pool);$('#poolWorkerSelect').innerHTML='<option value="">Select employee / driver by name</option>'+available.map(w=>`<option value="${esc(w.id)}" ${w.eligible?'':'disabled'}>${esc(w.display_name)} — ${esc(w.employer_name)}${w.cdl_number?' — CDL '+esc(w.cdl_number):''}${w.eligible?'':' — Not DOT/safety-sensitive'}</option>`).join('');const workerMap=new Map(allWorkers.map(w=>[String(w.id),w]));$('#poolWorkerList').innerHTML=current.length?`<div class="dot-table-wrap" style="margin-top:16px"><table class="dot-table"><thead><tr><th>Employee / Driver</th><th>Employer</th><th>DOT / Safety Sensitive</th><th>Eligibility</th><th></th></tr></thead><tbody>${current.map(m=>{const w=workerMap.get(String(m.employee_id))||{};return `<tr><td><strong>${esc(w.display_name||'Employee')}</strong>${w.employee_number?`<small>${esc(w.employee_number)}</small>`:''}</td><td>${esc(w.employer_name||'—')}</td><td>${w.dot_covered||w.safety_sensitive?'Yes':'No'}</td><td>${badge(m.eligibility_status||'eligible')}</td><td><button class="dot-btn small" data-remove-pool-worker="${esc(m.id)}">Remove</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="dot-empty">No employees or drivers have been added to this Consortium yet.</div>';if(!allWorkers.length){$('#poolWorkerSelect').innerHTML='<option value="">No employees found for employers assigned to this program</option>'}document.querySelectorAll('[data-remove-pool-worker]').forEach(btn=>btn.onclick=async()=>{try{await DOTApi.call('admin_remove_pool_worker',{membership_id:btn.dataset.removePoolWorker});await renderPoolMembers()}catch(e){alert(e.message)}})}catch(e){$('#poolWorkerSelect').innerHTML='<option value="">Unable to load employees</option>';$('#poolWorkerList').innerHTML=`<div class="dot-banner warning"><strong>Unable to load employees</strong><span>${esc(e.message)}</span></div>`}};
 document.querySelectorAll('[data-manage-admin-pool]').forEach(btn=>btn.onclick=async()=>{activePool=btn.dataset.manageAdminPool;const pool=pools.find(x=>String(x.id)===String(activePool));$('#poolWorkerTitle').textContent=`${pool?.name||'Pool'} — Employees & Drivers`;$('#poolWorkerManager').hidden=false;await renderPoolMembers();$('#poolWorkerManager').scrollIntoView({behavior:'smooth',block:'start'})});$('#closePoolWorker').onclick=()=>{$('#poolWorkerManager').hidden=true;activePool=null;activePoolOptions=null};$('#assignPoolWorker').onclick=async()=>{if(!activePool||!$('#poolWorkerSelect').value)return;try{await DOTApi.call('admin_assign_pool_worker',{pool_id:activePool,employee_id:$('#poolWorkerSelect').value,effective_date:new Date().toISOString().slice(0,10)});await renderPoolMembers()}catch(e){alert(e.message)}};
}


function selectionPoolId(x){return x.pool_id||x.random_pool_id||x.consortium_id||x.dot_pool_id||''}
function selectionNumber(x){return x.selection_number||x.selection_code||x.event_number||x.id||'DOT Selection'}
function selectionAgency(x,pool){return x.dot_agency||x.agency||x.agency_code||pool?.dot_agency||pool?.agency||pool?.agency_code||'—'}
function selectionPopulation(x){return x.population_size??x.population_count??x.eligible_count??x.total_population??'—'}
function selectionSelected(x){return x.selected_count??x.selection_count??x.selected_drivers_count??x.selected_employees_count??(Array.isArray(x.selected_members)?x.selected_members.length:'—')}
function selectionSource(x,pool){return poolSource({...pool,...x})}
async function loadSelections(){
 const scopedCtpa=new URLSearchParams(location.search).get('ctpa_id')||'';
 const actions=(scopedCtpa?`<a class="dot-btn" href="dot-ctpa-detail.html?id=${encodeURIComponent(scopedCtpa)}">Back to C/TPA</a>`:'')+`<a class="dot-btn primary" href="dot-record.html?module=selections&mode=new${scopedCtpa?'&ctpa_id='+encodeURIComponent(scopedCtpa):''}">New Random Selection</a>`;
 renderBase({title:'Random Selections',copy:scopedCtpa?'All random selection events for the selected C/TPA account.':'All DOT random selection events across C/TPAs, direct employers, and screenings4u administrators.',actions});
 document.querySelector('.dot-page')?.classList.add('program-admin-page');
 let selectionData={selections:[]},poolData={pools:[]},ctpaData={ctpas:[]},employerData={employers:[]};
 if(scopedCtpa){
   const settled=await Promise.allSettled([window.DOTApi.call('customer_detail',{customer_type:'ctpa',customer_id:scopedCtpa}),window.DOTApi.call('pools'),window.DOTApi.call('ctpas'),window.DOTApi.call('employers')]);
   selectionData=settled[0].status==='fulfilled'?settled[0].value:{selections:[]};poolData=settled[1].status==='fulfilled'?settled[1].value:{pools:[]};ctpaData=settled[2].status==='fulfilled'?settled[2].value:{ctpas:[]};employerData=settled[3].status==='fulfilled'?settled[3].value:{employers:[]};
 }else{
   const settled=await Promise.allSettled([window.DOTApi.call('selections'),window.DOTApi.call('pools'),window.DOTApi.call('ctpas'),window.DOTApi.call('employers')]);
   selectionData=settled[0].status==='fulfilled'?settled[0].value:{selections:[]};poolData=settled[1].status==='fulfilled'?settled[1].value:{pools:[]};ctpaData=settled[2].status==='fulfilled'?settled[2].value:{ctpas:[]};employerData=settled[3].status==='fulfilled'?settled[3].value:{employers:[]};
 }
 const selections=get(selectionData,'selections','random_selections').filter(Boolean);
 const pools=[...get(poolData,'pools','consortiums'),...get(selectionData,'pools','consortiums')].filter(Boolean);
 const poolIndex=new Map();pools.forEach(x=>{if(x.id)poolIndex.set(String(x.id),x);if(x.pool_id)poolIndex.set(String(x.pool_id),x)});
 const directory=programDirectoryIndex(get(ctpaData,'ctpas'),get(employerData,'employers'));
 const counts={ctpa:0,direct:0,admin:0};
 const rows=selections.map((x,i)=>{
   const pool=poolIndex.get(String(selectionPoolId(x)))||null;
   const src=selectionSource(x,pool),srcClass=src==='C/TPA'?'ctpa':src==='Direct Employer'?'direct':'admin';
   if(src==='C/TPA')counts.ctpa++;else if(src==='Direct Employer')counts.direct++;else counts.admin++;
   const ownerRecord={...(pool||{}),...x};
   const company=resolveProgramCompany(ownerRecord,src,directory);
   const agency=String(selectionAgency(x,pool));
   const poolLabel=x.pool_name||poolName(pool||{})||(selectionPoolId(x)||'—');
   const poolId=selectionPoolId(x)||pool?.id||'';
   const search=[selectionNumber(x),poolLabel,poolId,company.company,company.dba,company.dot,company.mc,company.email,company.phone,company.accountId,company.orgId,src,agency,x.status].filter(Boolean).join(' ').toLowerCase();
   return {source:src,agency,html:`<tr data-selection-row data-source="${esc(srcClass)}" data-agency="${esc(agency.toLowerCase())}" data-search="${esc(search)}"><td><strong>${esc(selectionNumber(x))}</strong><small>${esc(x.id&&x.id!==selectionNumber(x)?x.id:'')}</small></td><td><strong>${esc(poolLabel)}</strong>${poolId?`<small>${esc(poolId)}</small>`:''}</td><td><span class="dot-source-pill ${srcClass}">${esc(src)}</span></td><td>${companyCell(company,src)}</td><td>${esc(agency)}</td><td>${fmtDate(x.selection_date||x.run_date||x.created_at)}</td><td><strong>${esc(selectionPopulation(x))}</strong><small>${esc(selectionSelected(x))} selected</small></td><td>${badge(x.status||'locked')}</td><td><a class="dot-btn small" href="dot-record.html?module=selections&row=${i}${scopedCtpa?'&ctpa_id='+encodeURIComponent(scopedCtpa):''}">View</a></td></tr>`};
 });
 const agencies=[...new Set(rows.map(r=>r.agency).filter(v=>v&&v!=='—'))].sort();
 $('#dotPageBody').innerHTML=`${metrics([['All Selections',selections.length,'Across every DOT account'],['C/TPA Selections',counts.ctpa,'Selections tied to C/TPA Consortiums'],['Direct Employer',counts.direct,'Employer-owned selections'],['Admin Created',counts.admin,'Created by screenings4u staff']])}
 <div class="dot-card dot-program-directory">
  <div class="dot-card-head"><div><h2>Random Selection Directory</h2><p>Each selection is matched to its Consortium and company record so you can see exactly who the selection belongs to.</p></div><span class="dot-badge active" id="selectionVisibleCount">${selections.length} selections</span></div>
  <div class="dot-card-body dot-program-filters"><div class="dot-filter-row"><input id="selectionSearch" type="search" placeholder="Search selection, Consortium, company, USDOT, MC, email or agency"><select id="selectionSource"><option value="">All sources</option><option value="ctpa">C/TPAs</option><option value="direct">Direct employers</option><option value="admin">Admins</option></select><select id="selectionAgency"><option value="">All agencies</option>${agencies.map(a=>`<option value="${esc(a.toLowerCase())}">${esc(a)}</option>`).join('')}</select></div></div>
  <div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Selection</th><th>Consortium</th><th>Source</th><th>Company / Account Details</th><th>Agency</th><th>Date</th><th>Population</th><th>Status</th><th>View</th></tr></thead><tbody>${rows.length?rows.map(r=>r.html).join(''):'<tr><td colspan="9"><div class="dot-empty">No DOT random selections found.</div></td></tr>'}</tbody></table></div>
 </div>`;
 const filter=()=>{const q=($('#selectionSearch')?.value||'').trim().toLowerCase(),src=$('#selectionSource')?.value||'',agency=$('#selectionAgency')?.value||'';let visible=0;document.querySelectorAll('[data-selection-row]').forEach(tr=>{const ok=(!q||tr.dataset.search.includes(q))&&(!src||tr.dataset.source===src)&&(!agency||tr.dataset.agency===agency);tr.hidden=!ok;if(ok)visible++;});if($('#selectionVisibleCount'))$('#selectionVisibleCount').textContent=`${visible} selection${visible===1?'':'s'}`};
 ['selectionSearch','selectionSource','selectionAgency'].forEach(id=>$('#'+id)?.addEventListener(id==='selectionSearch'?'input':'change',filter));
}

function testingSource(x){
 const raw=String(x.source_type||x.order_source||x.owner_type||x.account_type||x.created_by_type||'').toLowerCase();
 const meta=x.metadata||{};
 if(raw.startsWith('admin')||String(meta.ordered_by_type||'').toLowerCase()==='admin'||String(meta.created_from||'').includes('dot_management'))return 'Admin';
 if(x.ctpa_id||x.ctpa_name||x.ctpa_organization_id||raw.includes('ctpa')||raw.includes('c/tpa'))return 'C/TPA';
 if(x.employer_id||x.employer_name||x.organization_id||raw.includes('employer'))return 'Direct Employer';
 return 'Direct Employer';
}
function testingOrderNumber(x){return x.order_number||x.testing_order_number||x.reference_number||x.id||'DOT Test Order'}
function testingPersonIndex(rows=[]){
 const byId=new Map(),byEmail=new Map();
 const add=(x)=>{
  if(!x)return;
  const ids=[x.id,x.driver_id,x.employee_id,x.person_id,x.worker_id,x.user_id].filter(Boolean);
  ids.forEach(id=>byId.set(String(id),x));
  const emails=[x.email,x.driver_email,x.employee_email,x.personal_email,x.work_email].filter(Boolean);
  emails.forEach(email=>byEmail.set(String(email).trim().toLowerCase(),x));
 };
 rows.forEach(add);
 return {byId,byEmail};
}
function testingPerson(x,index){
 const nested=x.driver||x.employee||x.person||x.candidate||null;
 const id=String(x.driver_id||x.employee_id||x.person_id||x.worker_id||'');
 const email=String(x.driver_email||x.employee_email||x.person_email||x.email||'').trim().toLowerCase();
 const rec=nested||(id&&index?.byId?.get(id))||(email&&index?.byEmail?.get(email))||null;
 const full=[rec?.first_name||x.driver_first_name||x.employee_first_name||x.first_name,rec?.last_name||x.driver_last_name||x.employee_last_name||x.last_name].filter(Boolean).join(' ').trim();
 const display=x.driver_name||x.employee_name||x.person_name||x.candidate_name||rec?.full_name||rec?.name||full||'—';
 const resolvedEmail=x.driver_email||x.employee_email||x.person_email||rec?.email||rec?.driver_email||rec?.employee_email||'';
 const employeeNumber=x.employee_number||x.driver_number||rec?.employee_number||rec?.driver_number||'';
 const cdl=x.cdl_number||rec?.cdl_number||'';
 return {name:display,email:resolvedEmail,employeeNumber,cdl,id:id||rec?.id||''};
}
function testingAgency(x){return x.dot_agency||x.agency||x.agency_code||x.regulatory_authority||'—'}
function testingType(x){return x.test_type||x.testing_panel||x.panel_name||x.panel||x.service_name||x.product_name||'—'}
function testingReason(x){return x.test_reason||x.reason||x.reason_for_test||x.testing_reason||'—'}
function testingStatus(x){return x.status||x.order_status||x.collection_status||'pending'}
function testingEmployer(x,index){
 const id=String(x.employer_id||''); const orgId=String(x.employer_organization_id||x.organization_id||'');
 const rec=(id&&index.byId.get(id))||(orgId&&index.byOrg.get(orgId))||null;
 const org=rec?.organizations||{};
 return {
  name:rec?.legal_name||rec?.company_name||rec?.name||org.legal_name||x.employer_name||x.company_name||'—',
  dot:rec?.dot_number||rec?.usdot_number||x.dot_number||x.usdot_number||'',
  id:x.employer_id||rec?.id||''
 };
}
async function loadTestingOrders(){
 const scopedCtpa=new URLSearchParams(location.search).get('ctpa_id')||'';
 const actions=scopedCtpa?`<a class="dot-btn" href="dot-ctpa-detail.html?id=${encodeURIComponent(scopedCtpa)}">Back to C/TPA</a>`:'<button class="dot-btn primary" id="newAdminTest">New Test Order</button>';
 renderBase({title:'DOT Testing Orders',copy:scopedCtpa?'All DOT drug and alcohol tests ordered under the selected C/TPA account.':'All DOT drug and alcohol tests ordered by C/TPAs, direct employers, and screenings4u administrators.',actions});
 document.querySelector('.dot-page')?.classList.add('testing-admin-page');
 let orderData={testing_orders:[]},ctpaData={ctpas:[]},employerData={employers:[]},personData={drivers:[]},programData={};
 if(scopedCtpa){
  const settled=await Promise.allSettled([DOTApi.call('customer_detail',{customer_type:'ctpa',customer_id:scopedCtpa}),DOTApi.call('ctpas'),DOTApi.call('employers'),DOTApi.call('drivers')]);
  orderData=settled[0].status==='fulfilled'?settled[0].value:{testing_orders:[]};
  ctpaData=settled[1].status==='fulfilled'?settled[1].value:{ctpas:[]};
  employerData=settled[2].status==='fulfilled'?settled[2].value:{employers:[]};
  personData=settled[3].status==='fulfilled'?settled[3].value:{drivers:[]};
 }else{
  const settled=await Promise.allSettled([DOTApi.call('overview'),DOTApi.call('ctpas'),DOTApi.call('employers'),DOTApi.call('drivers'),DOTApi.call('programs')]);
  orderData=settled[0].status==='fulfilled'?settled[0].value:{testing_orders:[]};
  ctpaData=settled[1].status==='fulfilled'?settled[1].value:{ctpas:[]};
  employerData=settled[2].status==='fulfilled'?settled[2].value:{employers:[]};
  personData=settled[3].status==='fulfilled'?settled[3].value:{drivers:[]};
  programData=settled[4].status==='fulfilled'?settled[4].value:{};
  if(!get(orderData,'testing_orders').length){
   const fallback=await DOTApi.call('testing').catch(()=>null);
   if(fallback)orderData=fallback;
  }
 }
 const ctpas=get(ctpaData,'ctpas'),employers=get(employerData,'employers');
 const directory=programDirectoryIndex(ctpas,employers);
 const personRows=[...get(personData,'drivers','employees'),...get(orderData,'drivers','employees')];
 const people=testingPersonIndex(personRows);
 const orders=get(orderData,'testing_orders','tests').filter(Boolean).filter(x=>{const src=testingSource(x);return ['C/TPA','Direct Employer','Admin'].includes(src)});
 const counts={ctpa:0,direct:0,admin:0,open:0,complete:0};
 const rows=orders.map((x,i)=>{
  const src=testingSource(x),srcClass=src==='C/TPA'?'ctpa':src==='Admin'?'admin':'direct';
  if(src==='C/TPA')counts.ctpa++;else if(src==='Admin')counts.admin++;else counts.direct++;
  const status=String(testingStatus(x));
  if(/completed|complete|resulted|closed|cancelled|canceled/i.test(status))counts.complete++;else counts.open++;
  const orderedBy=resolveProgramCompany(x,src,directory);
  const employer=testingEmployer(x,directory);
  const agency=String(testingAgency(x));
  const person=testingPerson(x,people);
  const type=testingType(x),reason=testingReason(x);
  const date=x.ordered_at||x.order_date||x.created_at||x.requested_at||x.scheduled_at;
  const search=[testingOrderNumber(x),person.name,person.email,person.employeeNumber,person.cdl,person.id,src,orderedBy.company,orderedBy.dba,orderedBy.dot,orderedBy.mc,orderedBy.email,orderedBy.accountId,employer.name,employer.dot,agency,type,reason,status].filter(Boolean).join(' ').toLowerCase();
  const employerCell=`<div class="dot-program-company"><strong>${esc(employer.name)}</strong>${employer.dot?`<small>USDOT ${esc(employer.dot)}</small>`:''}${employer.id?`<small class="dot-muted-id">Employer ${esc(employer.id)}</small>`:''}</div>`;
  return {source:src,agency,status:status.toLowerCase(),html:`<tr data-test-row data-source="${esc(srcClass)}" data-agency="${esc(agency.toLowerCase())}" data-status="${esc(status.toLowerCase())}" data-search="${esc(search)}"><td><strong>${esc(testingOrderNumber(x))}</strong><small>${fmtDate(date)}</small></td><td><div class="dot-test-person"><strong>${esc(person.name)}</strong></div></td><td><span class="dot-source-pill ${srcClass}">${esc(src)}</span></td><td>${companyCell(orderedBy,src)}</td><td>${employerCell}</td><td><strong>${esc(type)}</strong><small>${esc(reason)}</small></td><td>${esc(agency)}</td><td>${badge(status)}</td><td><a class="dot-btn small" href="dot-record.html?module=testing&id=${encodeURIComponent(x.id||'')}&row=${i}${scopedCtpa?'&ctpa_id='+encodeURIComponent(scopedCtpa):''}">View</a></td></tr>`};
 });
 const agencies=[...new Set(rows.map(r=>r.agency).filter(v=>v&&v!=='—'))].sort();
 $('#dotPageStatus').innerHTML='<div class="dot-banner"><div><strong>Testing order directory</strong><span>Showing DOT test orders from C/TPAs, direct employers, and screenings4u administrators. All fulfillment remains read-only here and is handled by screenings4u Testing.</span></div></div>'; 
 $('#dotPageBody').innerHTML=`${metrics([['All DOT Tests',orders.length,'C/TPA, direct-employer, and admin orders'],['C/TPA Ordered',counts.ctpa,'Tests ordered through C/TPAs'],['Direct Employer',counts.direct,'Tests ordered directly by employers'],['Admin Ordered',counts.admin,'Created by screenings4u DOT Management'],['Open Tests',counts.open,'Not yet complete or closed']])}
 <div class="dot-card dot-program-directory">
  <div class="dot-card-head"><div><h2>DOT Testing Order Directory</h2><p>Each test order shows the person being tested, who ordered it, the employer/company, test reason and current status.</p></div><span class="dot-badge active" id="testVisibleCount">${orders.length} tests</span></div>
  <div class="dot-card-body dot-program-filters"><div class="dot-filter-row"><input id="testSearch" type="search" placeholder="Search order, person, company, USDOT, email, test or agency"><select id="testSource"><option value="">All sources</option><option value="ctpa">C/TPAs</option><option value="direct">Direct employers</option><option value="admin">Admin</option></select><select id="testAgency"><option value="">All agencies</option>${agencies.map(a=>`<option value="${esc(a.toLowerCase())}">${esc(a)}</option>`).join('')}</select><select id="testStatus"><option value="">All statuses</option><option value="open">Open / In progress</option><option value="complete">Completed / Closed</option></select></div></div>
  <div class="dot-table-wrap"><table class="dot-table"><colgroup><col style="width:8%"><col style="width:11%"><col style="width:9%"><col style="width:22%"><col style="width:21%"><col style="width:10%"><col style="width:6%"><col style="width:8%"><col style="width:5%"></colgroup><thead><tr><th>Order</th><th>Person</th><th>Source</th><th>Ordered By / Account</th><th>Employer / Company</th><th>Test / Reason</th><th>Agency</th><th>Status</th><th>View</th></tr></thead><tbody>${rows.length?rows.map(r=>r.html).join(''):'<tr><td colspan="9"><div class="dot-empty">No DOT testing orders were found.</div></td></tr>'}</tbody></table></div>
 </div>`;
 const filter=()=>{const q=($('#testSearch')?.value||'').trim().toLowerCase(),src=$('#testSource')?.value||'',agency=$('#testAgency')?.value||'',status=$('#testStatus')?.value||'';let visible=0;document.querySelectorAll('[data-test-row]').forEach(tr=>{const closed=/completed|complete|resulted|closed|cancelled|canceled/.test(tr.dataset.status||'');const statusOk=!status||(status==='complete'?closed:!closed);const ok=(!q||tr.dataset.search.includes(q))&&(!src||tr.dataset.source===src)&&(!agency||tr.dataset.agency===agency)&&statusOk;tr.hidden=!ok;if(ok)visible++;});if($('#testVisibleCount'))$('#testVisibleCount').textContent=`${visible} test${visible===1?'':'s'}`};
 ['testSearch','testSource','testAgency','testStatus'].forEach(id=>$('#'+id)?.addEventListener(id==='testSearch'?'input':'change',filter));
 if(!scopedCtpa&&$('#newAdminTest')){
  $('#newAdminTest').onclick=async()=>{
   const pData=programData&&Object.keys(programData).length?programData:await DOTApi.call('programs').catch(()=>({}));
   const allPrograms=get(pData,'programs').filter(x=>String(x.status||'active')==='active'&&!x.archived_at);
   const assignments=get(pData,'program_employers');
   const workers=get(personData,'drivers','employees').filter(x=>!x.archived_at&&(x.dot_covered===true||x.safety_sensitive===true));
   const emps=get(employerData,'employers').filter(x=>!x.archived_at&&x.status!=='archived');
   $('#dotPageStatus').innerHTML=`<div class="dot-card"><div class="dot-card-head"><div><h2>Create Admin Test Order</h2><p>Create the DOT order here. screenings4u Testing will handle fulfillment after creation.</p></div><button class="dot-btn" id="cancelAdminTest">Cancel</button></div><div class="dot-card-body"><div class="dot-field-grid"><div class="dot-field"><label>Employer / Owner-Operator Account</label><select id="adminTestEmployer" required><option value="">Select employer</option>${emps.map(e=>`<option value="${esc(e.id)}">${esc(e.legal_name||e.dba_name||e.id)}</option>`).join('')}</select></div><div class="dot-field"><label>DOT Program</label><select id="adminTestProgram" required><option value="">Select employer first</option></select></div><div class="dot-field"><label>Driver / Safety-Sensitive Worker</label><select id="adminTestWorker" required><option value="">Select employer first</option></select></div><div class="dot-field"><label>Reason</label><select id="adminTestReason"><option value="random">Random</option><option value="pre_employment">Pre-Employment</option><option value="post_accident">Post-Accident</option><option value="reasonable_suspicion">Reasonable Suspicion</option><option value="return_to_duty">Return-to-Duty</option><option value="follow_up">Follow-Up</option></select></div><div class="dot-field"><label>Test Type</label><select id="adminTestType"><option value="drug">Drug</option><option value="alcohol">Alcohol</option></select></div><div class="dot-field"><label>Collection Deadline</label><input id="adminTestDeadline" type="datetime-local"></div></div><div id="adminTestMsg"></div><div class="dot-actions"><button class="dot-btn primary" id="createAdminTest">Create Test Order</button></div></div></div>`;
   const empSel=$('#adminTestEmployer'),progSel=$('#adminTestProgram'),workerSel=$('#adminTestWorker');
   const sync=()=>{const eid=empSel.value;const allowedIds=new Set(assignments.filter(a=>a.employer_id===eid&&String(a.status||'active')==='active'&&!a.removed_at).map(a=>a.program_id));const ps=allPrograms.filter(p=>p.employer_id===eid||allowedIds.has(p.id));progSel.innerHTML='<option value="">Select program</option>'+ps.map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.id)}</option>`).join('');const ws=workers.filter(w=>w.employer_id===eid);workerSel.innerHTML='<option value="">Select worker</option>'+ws.map(w=>`<option value="${esc(w.id)}">${esc([w.first_name,w.last_name].filter(Boolean).join(' ')||w.employee_number||w.id)}</option>`).join('')};
   empSel.onchange=sync; $('#cancelAdminTest').onclick=()=>location.reload();
   $('#createAdminTest').onclick=async()=>{const btn=$('#createAdminTest');try{btn.disabled=true;const deadline=$('#adminTestDeadline').value;const payload={employer_id:empSel.value,program_id:progSel.value,employee_id:workerSel.value,reason:$('#adminTestReason').value,test_type:$('#adminTestType').value,collection_deadline:deadline?new Date(deadline).toISOString():null,source_type:'admin_manual'};if(!payload.employer_id||!payload.program_id||!payload.employee_id)throw new Error('Employer, program, and worker are required.');await DOTApi.call('create_testing_order',{testing:payload});DOTApi.clearCache();location.reload()}catch(e){$('#adminTestMsg').innerHTML=`<div class="dot-banner warning"><strong>Unable to create test order</strong><span>${esc(e.message)}</span></div>`;btn.disabled=false}};
  };
 }
}


function resultValue(x, keys){for(const k of keys){const v=x?.[k];if(v!==undefined&&v!==null&&String(v)!=='')return v}return ''}
function resultDocument(x){
 const nested=[x?.official_document,x?.result_document,x?.document,x?.report,x?.attachment].find(v=>v&&typeof v==='object')||{};
 const arrays=[x?.documents,x?.attachments,x?.files].find(Array.isArray)||[];
 const first=arrays.find(v=>v&&typeof v==='object')||{};
 const url=resultValue(x,['official_document_url','result_document_url','document_url','report_url','pdf_url','file_url','download_url'])||resultValue(nested,['url','public_url','signed_url','download_url','file_url'])||resultValue(first,['url','public_url','signed_url','download_url','file_url']);
 const name=resultValue(x,['official_document_name','result_document_name','document_name','report_name','file_name'])||resultValue(nested,['name','file_name','filename'])||resultValue(first,['name','file_name','filename'])||'Official Result';
 return {url:String(url||''),name:String(name||'Official Result')};
}
function resultOutcome(x){return resultValue(x,['final_result','result','outcome','result_status','disposition','status'])||'Completed'}
function resultStatusClass(v){return /negative|complete|completed|final|published|reported/i.test(String(v||''))?'ok':/positive|refusal|cancel|error|invalid/i.test(String(v||''))?'bad':'warn'}
function resultPill(v){return `<span class="dot-status-pill ${resultStatusClass(v)}">${esc(String(v||'—').replaceAll('_',' '))}</span>`}
function normalizeDocUrl(url){const u=String(url||'').trim();if(!u)return'';if(/^https?:\/\//i.test(u)||u.startsWith('/')||u.startsWith('blob:')||u.startsWith('data:'))return u;return''}
async function loadResults(){
 renderBase({title:'DOT Results',copy:'View completed DOT drug and alcohol test results returned by screenings4u Testing.',actions:''});
 document.querySelector('.dot-page')?.classList.add('results-admin-page');
 const settled=await Promise.allSettled([DOTApi.call('overview'),DOTApi.call('results'),DOTApi.call('drivers'),DOTApi.call('employers'),DOTApi.call('testing')]);
 const overview=settled[0].status==='fulfilled'?settled[0].value:{};
 const direct=settled[1].status==='fulfilled'?settled[1].value:{};
 const peopleData=settled[2].status==='fulfilled'?settled[2].value:{};
 const employerData=settled[3].status==='fulfilled'?settled[3].value:{};
 const testingData=settled[4].status==='fulfilled'?settled[4].value:{};
 let results=[...get(overview,'test_results','results')];
 if(!results.length)results=[...get(direct,'test_results','results')];
 const orders=[...get(overview,'testing_orders','tests'),...get(testingData,'testing_orders','tests')];
 const orderById=new Map();orders.forEach(o=>{[o.id,o.testing_order_id,o.order_id,o.order_number,o.testing_order_number].filter(Boolean).forEach(k=>orderById.set(String(k),o))});
 const people=testingPersonIndex([...get(peopleData,'drivers','employees'),...get(overview,'drivers','employees')]);
 const employers=programDirectoryIndex([],get(employerData,'employers').length?get(employerData,'employers'):get(overview,'employers'));
 const rows=results.map((r,i)=>{
   const orderKey=resultValue(r,['testing_order_id','test_order_id','order_id','order_number','testing_order_number']);
   const order=orderById.get(String(orderKey||''))||{};
   const merged={...order,...r};
   const person=testingPerson(merged,people);
   const employer=testingEmployer(merged,employers);
   const tested=resultValue(r,['tested_at','test_date','collection_date','collected_at','specimen_collected_at'])||resultValue(order,['tested_at','test_date','collection_date','collected_at','specimen_collected_at','completed_at']);
   const reported=resultValue(r,['reported_at','resulted_at','results_reported_at','published_at','completed_at','finalized_at']);
   const outcome=resultOutcome(r),doc=resultDocument(r),docUrl=normalizeDocUrl(doc.url);
   const search=[person.name,employer.name,testingOrderNumber(order),resultValue(r,['result_number','id']),outcome,tested,reported].filter(Boolean).join(' ').toLowerCase();
   const actions=docUrl?`<div class="result-actions"><button class="dot-btn small result-view" type="button" data-doc-url="${esc(docUrl)}" data-doc-name="${esc(doc.name)}" data-result-title="${esc(person.name)}">View</button><a class="dot-btn small" href="${esc(docUrl)}" download="${esc(doc.name)}" target="_blank" rel="noopener">Download</a></div>`:`<span class="dot-muted-text">No document</span>`;
   return `<tr data-result-row data-search="${esc(search)}"><td><strong>${esc(person.name)}</strong></td><td><strong>${esc(employer.name)}</strong>${employer.dot?`<small>USDOT ${esc(employer.dot)}</small>`:''}</td><td>${fmtDate(tested)}</td><td>${fmtDate(reported)}</td><td>${resultPill(outcome)}</td><td><div class="result-doc-name">${esc(doc.name)}</div></td><td>${actions}</td></tr>`;
 });
 const withDocs=results.filter(r=>normalizeDocUrl(resultDocument(r).url)).length;
 $('#dotPageBody').innerHTML=`${metrics([['Completed Results',results.length,'Returned by screenings4u Testing'],['Official Documents',withDocs,'Available to view or download'],['Missing Documents',Math.max(0,results.length-withDocs),'Result records without an attached document'],['Access','View Only','No result editing in DOT portal']])}
 <div class="dot-card dot-results-directory"><div class="dot-card-head"><div><h2>Completed Test Results</h2><p>Official results are supplied by screenings4u Testing. This DOT portal is view-only.</p></div><span class="dot-badge active" id="resultVisibleCount">${results.length} results</span></div>
 <div class="dot-card-body result-filter-bar"><input id="resultSearch" type="search" placeholder="Search donor, employer, order or result"></div>
 <div class="dot-table-wrap"><table class="dot-table result-table"><colgroup><col style="width:15%"><col style="width:22%"><col style="width:11%"><col style="width:13%"><col style="width:12%"><col style="width:15%"><col style="width:12%"></colgroup><thead><tr><th>Donor</th><th>Employer</th><th>Date Tested</th><th>Results Reported</th><th>Result</th><th>Official Document</th><th>Actions</th></tr></thead><tbody>${rows.length?rows.join(''):'<tr><td colspan="7"><div class="dot-empty">No completed DOT test results have been returned by screenings4u Testing yet.</div></td></tr>'}</tbody></table></div></div>
 <div class="dot-modal-backdrop result-preview-modal" id="resultPreviewModal" hidden><div class="dot-modal-card result-preview-card" role="dialog" aria-modal="true" aria-labelledby="resultPreviewTitle"><div class="result-preview-head"><div><span class="dot-eyebrow">OFFICIAL RESULT</span><h2 id="resultPreviewTitle">Test Result</h2><p id="resultPreviewName"></p></div><button class="dot-btn small" type="button" id="resultPreviewClose">Close</button></div><div class="result-preview-body" id="resultPreviewBody"></div><div class="dot-modal-actions"><a class="dot-btn primary" id="resultPreviewDownload" href="#" download target="_blank" rel="noopener">Download Official Document</a><button class="dot-btn" type="button" id="resultPreviewClose2">Close</button></div></div></div>`;
 const filter=()=>{const q=($('#resultSearch')?.value||'').trim().toLowerCase();let visible=0;document.querySelectorAll('[data-result-row]').forEach(tr=>{const ok=!q||tr.dataset.search.includes(q);tr.hidden=!ok;if(ok)visible++});if($('#resultVisibleCount'))$('#resultVisibleCount').textContent=`${visible} result${visible===1?'':'s'}`};
 $('#resultSearch')?.addEventListener('input',filter);
 const modal=$('#resultPreviewModal'),body=$('#resultPreviewBody'),download=$('#resultPreviewDownload');
 const close=()=>{if(modal)modal.hidden=true;if(body)body.innerHTML=''};
 $('#resultPreviewClose')?.addEventListener('click',close);$('#resultPreviewClose2')?.addEventListener('click',close);modal?.addEventListener('click',e=>{if(e.target===modal)close()});
 document.querySelectorAll('.result-view').forEach(btn=>btn.addEventListener('click',()=>{const url=btn.dataset.docUrl||'',name=btn.dataset.docName||'Official Result';$('#resultPreviewTitle').textContent=btn.dataset.resultTitle||'Test Result';$('#resultPreviewName').textContent=name;download.href=url;download.setAttribute('download',name);const low=url.toLowerCase();body.innerHTML=/\.(png|jpe?g|webp|gif)(\?|#|$)/.test(low)?`<img class="result-preview-image" src="${esc(url)}" alt="${esc(name)}">`:`<iframe class="result-preview-frame" src="${esc(url)}" title="${esc(name)}"></iframe>`;modal.hidden=false;}));
}

function genericActionButtons(action){return `<a class="dot-btn primary" href="dot-record.html?module=${encodeURIComponent(action)}&mode=new">New Record</a>`}

function complianceEventLabel(v){return String(v||'—').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function compliancePriority(x){return String(x.priority||x.severity||x.risk_level||'normal')}
function complianceDue(x){return x.due_date||x.deadline||x.response_due_at||x.corrective_action_due_at||x.follow_up_due_at||''}
function complianceSource(x){
 const raw=String(x.source_type||x.account_type||x.owner_type||'').toLowerCase();
 if(x.ctpa_id||raw.includes('ctpa')||raw.includes('c/tpa'))return 'C/TPA';
 if(x.employer_id||x.organization_id||raw.includes('employer'))return 'Direct Employer';
 return 'Admin';
}
async function loadCompliance(){
 renderBase({title:'Compliance Cases',copy:'Review and manage DOT compliance cases, deadlines, priorities, and corrective-action activity across every customer account.',actions:'<a class="dot-btn primary" href="dot-record.html?module=compliance&mode=new">New Compliance Case</a>'});
 document.querySelector('.dot-page')?.classList.add('program-admin-page','compliance-admin-page');
 let data={compliance_cases:[],cases:[],ctpas:[],employers:[]};
 try{const {data:fast,error}=await window.dotSupabase.rpc('dot_compliance_page_fast');if(error)throw error;data=fast||data}catch(e){console.warn('[DOT compliance fast read fallback]',e);const settled=await Promise.allSettled([DOTApi.call('compliance'),DOTApi.call('ctpas'),DOTApi.call('employers')]);data=settled[0].status==='fulfilled'?settled[0].value:data;data.ctpas=settled[1].status==='fulfilled'?get(settled[1].value,'ctpas'):[];data.employers=settled[2].status==='fulfilled'?get(settled[2].value,'employers'):[]}
 const ctpas=get(data,'ctpas');
 const employers=get(data,'employers');
 const cases=get(data,'compliance_cases','cases').filter(Boolean),directory=programDirectoryIndex(ctpas,employers);
 let open=0,inProgress=0,high=0,resolved=0;
 const rows=cases.map((x,i)=>{
   const status=String(x.status||'open'),priority=compliancePriority(x),src=complianceSource(x);
   if(/resolved|closed|complete|completed/i.test(status))resolved++;else open++;
   if(/progress|processing|working/i.test(status))inProgress++;
   if(/critical|high|urgent/i.test(priority))high++;
   const company=resolveProgramCompany(x,src,directory);
   const event=complianceEventLabel(x.event_type||x.event||x.case_type||x.issue_type);
   const due=complianceDue(x);
   const search=[x.case_number,x.id,company.company,company.dba,company.dot,company.mc,company.email,event,priority,status,due].filter(Boolean).join(' ').toLowerCase();
   return `<tr data-compliance-row data-status="${esc(status.toLowerCase())}" data-priority="${esc(priority.toLowerCase())}" data-event="${esc(String(x.event_type||x.event||x.case_type||x.issue_type||'').toLowerCase())}" data-search="${esc(search)}"><td><strong>${esc(x.case_number||x.id||'—')}</strong>${x.created_at?`<small>Opened ${fmtDate(x.created_at)}</small>`:''}</td><td>${companyCell(company,src)}</td><td>${esc(event)}</td><td>${fmtDate(due)}</td><td><span class="dot-status-pill ${/critical|high|urgent/i.test(priority)?'bad':/medium|elevated/i.test(priority)?'warn':''}">${esc(priority.replaceAll('_',' '))}</span></td><td>${badge(status)}</td><td><a class="dot-btn small" href="dot-record.html?module=compliance&row=${i}">Manage</a></td></tr>`;
 });
 const events=[...new Set(cases.map(x=>String(x.event_type||x.event||x.case_type||x.issue_type||'')).filter(Boolean))].sort();
 $('#dotPageBody').innerHTML=`${metrics([['All Cases',cases.length,'Across all DOT customer accounts'],['Open Cases',open,'Not yet resolved or closed'],['In Progress',inProgress,'Corrective action underway'],['High / Critical',high,'Priority attention required']])}
 <div class="dot-card dot-program-directory compliance-directory"><div class="dot-card-head"><div><h2>Compliance Case Directory</h2><p>Cases are matched to their employer or C/TPA records so the responsible company is visible instead of an internal UUID.</p></div><span class="dot-badge active" id="complianceVisibleCount">${cases.length} cases</span></div>
 <div class="dot-card-body dot-program-filters"><div class="dot-filter-row compliance-filter-row"><input id="complianceSearch" type="search" placeholder="Search case, company, USDOT, event or priority"><select id="complianceStatus"><option value="">All statuses</option><option value="open">Open</option><option value="progress">In progress</option><option value="resolved">Resolved / closed</option></select><select id="compliancePriority"><option value="">All priorities</option><option value="critical">Critical</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select><select id="complianceEvent"><option value="">All event types</option>${events.map(v=>`<option value="${esc(v.toLowerCase())}">${esc(complianceEventLabel(v))}</option>`).join('')}</select></div></div>
 <div class="dot-table-wrap"><table class="dot-table compliance-table"><colgroup><col style="width:15%"><col style="width:30%"><col style="width:16%"><col style="width:11%"><col style="width:10%"><col style="width:10%"><col style="width:8%"></colgroup><thead><tr><th>Case</th><th>Company / Account</th><th>Event</th><th>Due</th><th>Priority</th><th>Status</th><th>Manage</th></tr></thead><tbody>${rows.length?rows.join(''):'<tr><td colspan="7"><div class="dot-empty">No DOT compliance cases found.</div></td></tr>'}</tbody></table></div></div>`;
 const filter=()=>{const q=($('#complianceSearch')?.value||'').trim().toLowerCase(),st=$('#complianceStatus')?.value||'',pri=$('#compliancePriority')?.value||'',ev=$('#complianceEvent')?.value||'';let visible=0;document.querySelectorAll('[data-compliance-row]').forEach(tr=>{let statusOk=true;if(st==='open')statusOk=!/resolved|closed|complete/.test(tr.dataset.status);else if(st==='progress')statusOk=/progress|processing|working/.test(tr.dataset.status);else if(st==='resolved')statusOk=/resolved|closed|complete/.test(tr.dataset.status);const ok=(!q||tr.dataset.search.includes(q))&&statusOk&&(!pri||tr.dataset.priority===pri)&&(!ev||tr.dataset.event===ev);tr.hidden=!ok;if(ok)visible++;});if($('#complianceVisibleCount'))$('#complianceVisibleCount').textContent=`${visible} case${visible===1?'':'s'}`};
 ['complianceSearch','complianceStatus','compliancePriority','complianceEvent'].forEach(id=>$('#'+id)?.addEventListener(id==='complianceSearch'?'input':'change',filter));
}

async function loadList(c){const scopedCtpa=new URLSearchParams(location.search).get('ctpa_id')||'';const actions=(scopedCtpa?`<a class="dot-btn" href="dot-ctpa-detail.html?id=${encodeURIComponent(scopedCtpa)}">Back to C/TPA</a>`:'')+genericActionButtons(c.action);renderBase({title:c.title,copy:scopedCtpa?c.copy+' Showing records for the selected C/TPA only.':c.copy,actions});const d=scopedCtpa?await window.DOTApi.call('customer_detail',{customer_type:'ctpa',customer_id:scopedCtpa}):await window.DOTApi.call(c.action);const rows=c.rows(d).map((r,i)=>[...r,`<a class="dot-btn small" href="dot-record.html?module=${encodeURIComponent(c.action)}&row=${i}${scopedCtpa?'&ctpa_id='+encodeURIComponent(scopedCtpa):''}">Manage</a>`]);$('#dotPageBody').innerHTML=metrics([['Records',rows.length,'Live DOT records'],['Module',c.action,'DOT data source'],['C/TPA Scope',scopedCtpa?'Selected':'All','Management filter'],['Host','dot-portal','Management']])+table([...c.headers,'Manage'],rows)}
async function loadCtpas(){
 renderBase({title:'DOT C/TPAs',copy:'Create and manage every C/TPA account, subscription, portal access, billing, invitations, features, staff, customers, and support.',actions:'<a class="dot-btn primary" href="dot-account-creation.html">Create C/TPA Account</a><a class="dot-btn" href="dot-portal-detail.html?portal=ctpa_dot">C/TPA Portal Control</a>'});
 const settled=await Promise.allSettled([DOTApi.call('ctpas'),DOTApi.call('billing'),DOTApi.call('portal_access')]);
 const cdata=settled[0].status==='fulfilled'?settled[0].value:{ctpas:[]},billing=settled[1].status==='fulfilled'?settled[1].value:{subscriptions:[],plans:[]},accessData=settled[2].status==='fulfilled'?settled[2].value:{};
 const allCtpas=get(cdata,'ctpas'),subs=get(billing,'subscriptions'),plans=get(billing,'plans'),access=get(accessData,'portal_access','organization_portal_access','ctpa_portal_access');
 const emailKey=x=>String(x?.support_email||x?.organizations?.primary_email||'').trim().toLowerCase();
 const stamp=x=>Math.max(Date.parse(x?.organizations?.updated_at||0)||0,Date.parse(x?.updated_at||0)||0,Date.parse(x?.created_at||0)||0);
 const grouped=new Map();for(const x of allCtpas){const k=emailKey(x)||('ctpa:'+x.id);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(x)}
 const ctpas=[...grouped.values()].map(list=>list.slice().sort((a,b)=>stamp(b)-stamp(a))[0]).filter(x=>String(x.status||'').toLowerCase()!=='inactive');
 const pm=new Map(plans.map(x=>[x.id,x]));
 const rows=ctpas.map(x=>{const sub=subs.find(z=>z.ctpa_id===x.id&&['active','trial','trialing','past_due'].includes(String(z.status||'').toLowerCase()))||subs.find(z=>z.ctpa_id===x.id)||null,plan=sub?pm.get(sub.plan_id):null,pa=access.find(z=>z.organization_id===x.organization_id&&z.portal_code==='ctpa_dot')||null;return [
   `<strong>${name(x)}</strong><br><small>${esc(x.id)}</small>`,
   esc(x.support_email||x.organizations?.primary_email||'—'),
   sub?`<strong>${esc(plan?.name||plan?.code||'Subscription')}</strong><br><small>${esc(sub.billing_frequency||'')} · ${badge(sub.status)}</small>`:'<span class="dot-status-pill warn">No subscription</span>',
   pa?.enabled?'<span class="dot-status-pill ok">Granted</span>':'<span class="dot-status-pill warn">Not granted</span>',
   badge(x.status),
   `<a class="dot-btn small primary" href="dot-ctpa-detail.html?id=${encodeURIComponent(x.id)}">Manage</a>`
 ]});
 $('#dotPageBody').innerHTML=metrics([['C/TPA Accounts',String(ctpas.length),'Live DOT C/TPA accounts'],['Active Subscriptions',String(subs.filter(x=>ctpas.some(c=>c.id===x.ctpa_id)&&String(x.status).toLowerCase()==='active').length),'Current C/TPA subscriptions'],['Portal Access',String(access.filter(x=>x.portal_code==='ctpa_dot'&&x.enabled===true&&ctpas.some(c=>c.organization_id===x.organization_id)).length),'C/TPA portal grants'],['Portal','ctpa-dot','Customer management portal']])+`<div class="dot-card"><div class="dot-card-head"><div><h2>C/TPA Accounts</h2><p>Orange Manage opens the complete account-control workspace for that C/TPA.</p></div><a class="dot-btn primary" href="dot-account-creation.html">New C/TPA</a></div>${table(['C/TPA','Primary Contact','Subscription','Portal Access','Status','Management'],rows)}</div>`;
}
function money(v){const n=Number(v||0);return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(n)?n:0)}
async function loadOrders(){
 const qs=new URLSearchParams(location.search),requestedCtpa=qs.get('ctpa_id')||'';
 renderBase({title:'Create Order',copy:'Create screenings4u drug & alcohol testing, instant-test, and collection-supply orders from the screenings4u Workforce DOT management portal. This page creates orders only — it never creates or changes customer accounts.',actions:`${requestedCtpa?`<a class="dot-btn" href="dot-ctpa-detail.html?id=${encodeURIComponent(requestedCtpa)}">Back to C/TPA</a>`:'<a class="dot-btn" href="dot-ctpas.html">C/TPA Accounts</a>'}<a class="dot-btn" href="dot-invoices.html">Billing & Invoices</a>`});
 let fastPage=null;try{const {data,error}=await window.dotSupabase.rpc('dot_order_page_fast');if(error)throw error;fastPage=data}catch(e){console.warn('[DOT order fast read fallback]',e)}
 let cat=fastPage?{services:fastPage.services||[]}:await DOTApi.invoke(DOT_PORTAL_CONFIG.adminOrderFunction||'dot-admin-order',{action:'catalog'});
 let ctpaDirectory=fastPage?{ctpas:fastPage.ctpas||[]}:await DOTApi.call('ctpas').catch(()=>({ctpas:[]}));
 const existing=requestedCtpa?await DOTApi.call('customer_detail',{customer_type:'ctpa',customer_id:requestedCtpa}):null,services=cat.services||[],org=existing?.organization||existing?.customer?.organizations||{},ctpa=existing?.customer||null,members=existing?.memberships||[],primary=members.find(x=>x.is_primary)||members[0]||{},profile=primary.profiles||{},meta=org.metadata||{};
 if(requestedCtpa&&!ctpa)throw new Error('The selected C/TPA account was not found.');
 const v=x=>esc(x||''),states=['','AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
 const stateOpts=cur=>states.map(x=>`<option value="${x}" ${String(cur||'')===x?'selected':''}>${x||'Select'}</option>`).join('');
 const groups={};for(const x of services){const g=x.metadata?.catalog_group||x.metadata?.category||x.product_type||'Services';(groups[g]??=[]).push(x)}
 const groupOrder=['Collection Supplies','Instant Tests'];const sortedGroups=Object.keys(groups).sort((a,b)=>{const ia=groupOrder.indexOf(a),ib=groupOrder.indexOf(b);if(ia>=0||ib>=0)return (ia<0?99:ia)-(ib<0?99:ib);return a.localeCompare(b)});
 const cards=sortedGroups.map(g=>`<section class="dot-order-category"><div class="dot-order-category-head"><div><h3>${esc(g)}</h3><p>Select one or more items and adjust quantities.</p></div></div><div class="dot-order-grid">${groups[g].map(x=>{const pr=Number(x.current_price?.amount||0);return `<label class="dot-order-choice order-product"><input type="checkbox" class="orderItem" value="${esc(x.id)}" data-price="${pr}" data-name="${esc(x.name)}"><span><strong>${esc(x.name)}</strong><b>${money(pr)}</b><small>${esc(x.description||'')}</small><span class="order-qty-row"><em>Qty</em><input class="orderQty" type="number" min="1" max="999" value="1" data-service="${esc(x.id)}"></span></span></label>`}).join('')}</div></section>`).join('');
 const company=org.legal_name||org.dba_name||'',contactFirst=profile.first_name||meta.contact_first_name||'',contactLast=profile.last_name||meta.contact_last_name||'',contactEmail=profile.email||org.primary_email||ctpa?.support_email||meta.contact_email||'',contactPhone=profile.phone||org.phone||ctpa?.support_phone||meta.contact_phone||'';
 $('#dotPageBody').innerHTML=`
 ${requestedCtpa?`<div class="dot-banner"><div><strong>Ordering for existing C/TPA</strong><span>${esc(company||requestedCtpa)}. Creating this order will not create another account or alter the C/TPA subscription.</span></div></div>`:''}
 <div class="dot-order-layout">
  <div class="dot-order-main">
   <article class="dot-card"><div class="dot-card-head"><div><h2>1. Business Information</h2><p>Customer business associated with this screenings4u order.</p></div></div><div class="dot-card-body"><div class="dot-field-grid">
    <div class="dot-field"><label>Business / Company Name *</label><input id="ordCompany" value="${v(company)}"></div>
    <div class="dot-field"><label>DBA / Display Name</label><input id="ordDba" value="${v(org.dba_name)}"></div>
    <div class="dot-field"><label>EIN</label><input id="ordEin" value="${v(org.ein)}"></div>
    <div class="dot-field"><label>Website</label><input id="ordWebsite" value="${v(org.website)}"></div>
    <div class="dot-field"><label>Business Phone</label><input id="ordBusinessPhone" value="${v(org.phone||ctpa?.support_phone)}"></div>
    <div class="dot-field"><label>Customer / C/TPA ID</label><input value="${v(requestedCtpa)}" disabled></div>
   </div></div></article>
   <article class="dot-card"><div class="dot-card-head"><div><h2>2. Contact Information</h2><p>Order contact and receipt information.</p></div></div><div class="dot-card-body"><div class="dot-field-grid">
    <div class="dot-field"><label>First Name *</label><input id="ordFirst" value="${v(contactFirst)}"></div>
    <div class="dot-field"><label>Last Name *</label><input id="ordLast" value="${v(contactLast)}"></div>
    <div class="dot-field"><label>Email *</label><input id="ordEmail" type="email" value="${v(contactEmail)}"></div>
    <div class="dot-field"><label>Phone</label><input id="ordPhone" value="${v(contactPhone)}"></div>
   </div></div></article>
   <article class="dot-card"><div class="dot-card-head"><div><h2>3. Addresses</h2><p>Billing, shipping, and mailing details are stored with the order.</p></div></div><div class="dot-card-body">
    <div class="dot-address-columns">
     ${addressBlock('Billing','bill',org)}
     ${addressBlock('Shipping','ship',org,true)}
     ${addressBlock('Mailing','mail',org,true)}
    </div>
   </div></article>
   <article class="dot-card"><div class="dot-card-head"><div><h2>4. Services & Supplies</h2><p>Prices come directly from the screenings4u Supabase service catalog.</p></div><span class="dot-badge active">${services.length} items</span></div><div class="dot-card-body">${cards||'<div class="dot-empty">No orderable screenings4u items are configured.</div>'}</div></article>
   <article class="dot-card"><div class="dot-card-head"><div><h2>5. Order Notes</h2><p>Internal and customer-facing order notes.</p></div></div><div class="dot-card-body"><div class="dot-field-grid">
    <div class="dot-field"><label>Internal Notes</label><textarea id="ordInternalNotes" rows="4"></textarea></div>
    <div class="dot-field"><label>Customer Notes</label><textarea id="ordCustomerNotes" rows="4"></textarea></div>
   </div></div></article>
   <div id="orderResult" class="dot-order-result"></div>
  </div>
  <aside class="dot-order-sidebar">
   <article class="dot-card dot-order-summary-card"><div class="dot-card-head"><div><h2>Order Summary</h2><p>screenings4u order</p></div></div><div class="dot-card-body">
    <div id="orderSummaryItems" class="dot-summary-lines"><div class="dot-empty compact">Select services or supplies.</div></div>
    <div class="dot-summary-total"><span>Total</span><strong id="orderTotal">$0.00</strong></div>
    <div class="dot-form-subhead">Payment</div>
    <label class="dot-payment-choice"><input type="radio" name="orderPayment" value="stripe" checked><span><strong>Take payment now</strong><small>Secure Stripe Payment Element mounted on this page.</small></span></label>
    <label class="dot-payment-choice"><input type="radio" name="orderPayment" value="unpaid"><span><strong>Create without payment</strong><small>Create an unpaid screenings4u order for follow-up billing.</small></span></label>
    <button class="dot-btn primary dot-btn-block" id="processOrder" type="button">Process Order</button>
    <div id="stripePaymentPanel" class="dot-stripe-panel" hidden><div class="dot-form-subhead">Secure Payment</div><div id="paymentElement"></div><div id="stripeMessage" class="dot-help"></div><button class="dot-btn primary dot-btn-block" id="completeStripePayment" type="button">Pay & Complete Order</button></div>
    <p class="dot-help">Seller: screenings4u, LLC · Created by: screenings4u Workforce DOT.</p>
   </div></article>
  </aside>
 </div>`;
 function addressBlock(title,prefix,o,same=false){return `<section class="dot-address-card"><div class="dot-address-title"><h3>${title} Address</h3>${same?`<label class="dot-check mini"><input type="checkbox" class="copyBilling" data-target="${prefix}"> Same as billing</label>`:''}</div><div class="dot-field"><label>Address 1</label><input id="${prefix}Address1" value="${v(o.address_line1)}"></div><div class="dot-field"><label>Address 2</label><input id="${prefix}Address2" value="${v(o.address_line2)}"></div><div class="dot-field-grid"><div class="dot-field"><label>City</label><input id="${prefix}City" value="${v(o.city)}"></div><div class="dot-field"><label>State</label><select id="${prefix}State">${stateOpts(o.state_region)}</select></div><div class="dot-field"><label>ZIP</label><input id="${prefix}Zip" value="${v(o.postal_code)}"></div><div class="dot-field"><label>Country</label><select id="${prefix}Country"><option value="US" selected>United States of America</option><option value="CA">Canada</option><option value="MX">Mexico</option></select></div></div></section>`}
 function selected(){return [...document.querySelectorAll('.orderItem:checked')].map(ch=>{const q=document.querySelector(`.orderQty[data-service="${CSS.escape(ch.value)}"]`);return {service_id:ch.value,quantity:Math.max(1,Number(q?.value||1)),name:ch.dataset.name||'',price:Number(ch.dataset.price||0)}})}
 function redraw(){const lines=selected(),total=lines.reduce((a,x)=>a+x.price*x.quantity,0);$('#orderTotal').textContent=money(total);$('#orderSummaryItems').innerHTML=lines.length?lines.map(x=>`<div class="dot-summary-line"><span>${esc(x.name)} × ${x.quantity}</span><strong>${money(x.price*x.quantity)}</strong></div>`).join(''):'<div class="dot-empty compact">Select services or supplies.</div>'}
 document.querySelectorAll('.orderItem,.orderQty').forEach(x=>x.addEventListener('change',redraw));
 document.querySelectorAll('.orderQty').forEach(x=>x.addEventListener('click',e=>e.stopPropagation()));
 document.querySelectorAll('.copyBilling').forEach(x=>x.addEventListener('change',()=>{if(!x.checked)return;const t=x.dataset.target;for(const f of ['Address1','Address2','City','State','Zip','Country']){const a=$(`#bill${f}`),b=$(`#${t}${f}`);if(a&&b)b.value=a.value}}));
 function addr(prefix){return {address_line1:$(`#${prefix}Address1`).value.trim(),address_line2:$(`#${prefix}Address2`).value.trim(),city:$(`#${prefix}City`).value.trim(),state:$(`#${prefix}State`).value,postal_code:$(`#${prefix}Zip`).value.trim(),country:$(`#${prefix}Country`).value}}
 function canonicalCtpaByEmail(email){const key=String(email||'').trim().toLowerCase(),rows=ctpaDirectory.ctpas||[],stamp=x=>Math.max(Date.parse(x?.organizations?.updated_at||0)||0,Date.parse(x?.updated_at||0)||0,Date.parse(x?.created_at||0)||0);return rows.filter(x=>String(x.support_email||x.organizations?.primary_email||'').trim().toLowerCase()===key&&String(x.status||'').toLowerCase()!=='inactive').sort((a,b)=>stamp(b)-stamp(a))[0]||null}
 async function syncExistingCtpa(p){const match=canonicalCtpaByEmail(p.customer.email);if(!match)return p;const detail=await DOTApi.call('customer_detail',{customer_type:'ctpa',customer_id:match.id}).catch(()=>({})),mbrs=detail.memberships||[],prim=mbrs.find(x=>x.is_primary)||mbrs[0]||{};await DOTApi.invoke(DOT_PORTAL_CONFIG.ctpaAdminFunction||'dot-ctpa-admin-data',{action:'save_company_profile',ctpa_id:match.id,profile:{primary_user_id:prim.user_id||'',legal_name:p.business.company_name,dba_name:p.business.dba_name,website:p.business.website,ein:p.business.ein,office_phone:p.business.phone,contact_first_name:p.customer.first_name,contact_last_name:p.customer.last_name,contact_phone:p.customer.phone,contact_email:p.customer.email,address_line1:p.billing.address_line1,address_line2:p.billing.address_line2,city:p.billing.city,state:p.billing.state,postal_code:p.billing.postal_code,country:p.billing.country||'US',status:'active',support_email:p.customer.email,support_phone:p.business.phone||p.customer.phone}});p.ctpa_id=match.id;p.organization_id=match.organization_id;return p}
 function payload(){return {ctpa_id:requestedCtpa||null,organization_id:org.id||null,business:{company_name:$('#ordCompany').value.trim(),dba_name:$('#ordDba').value.trim(),ein:$('#ordEin').value.trim(),website:$('#ordWebsite').value.trim(),phone:$('#ordBusinessPhone').value.trim()},customer:{first_name:$('#ordFirst').value.trim(),last_name:$('#ordLast').value.trim(),email:$('#ordEmail').value.trim(),phone:$('#ordPhone').value.trim()},billing:addr('bill'),shipping:addr('ship'),mailing:addr('mail'),items:selected(),internal_notes:$('#ordInternalNotes').value.trim(),customer_notes:$('#ordCustomerNotes').value.trim()}}
 let stripe=null,elements=null,prepared=null;
 $('#processOrder').onclick=async()=>{const btn=$('#processOrder');try{let p=payload();if(!p.business.company_name||!p.customer.first_name||!p.customer.last_name||!p.customer.email)throw new Error('Business name and contact first name, last name, and email are required.');if(!p.items.length)throw new Error('Select at least one service or supply item.');p=await syncExistingCtpa(p);const mode=document.querySelector('input[name="orderPayment"]:checked')?.value||'stripe';btn.disabled=true;btn.textContent=mode==='stripe'?'Preparing Secure Payment…':'Creating Order…';if(mode==='unpaid'){const r=await DOTApi.invoke(DOT_PORTAL_CONFIG.adminOrderFunction||'dot-admin-order',{action:'create_unpaid',...p});$('#orderResult').innerHTML=`<div class="dot-banner dot-order-success"><div><strong>Order ${esc(r.order.order_number)} created</strong><span>The order was created in the screenings4u order table without payment. Total ${money(r.order.total)}.</span></div><a class="dot-btn small primary" href="dot-recent-orders.html">Manage Recent Orders</a></div>`;btn.textContent='Order Created';return}
 const r=await DOTApi.invoke(DOT_PORTAL_CONFIG.adminOrderFunction||'dot-admin-order',{action:'prepare_stripe_payment',...p});prepared=r;if(!window.Stripe)throw new Error('Stripe.js did not load.');stripe=Stripe(r.publishable_key);elements=stripe.elements({clientSecret:r.client_secret,appearance:{theme:'stripe'}});elements.create('payment',{layout:'tabs'}).mount('#paymentElement');$('#stripePaymentPanel').hidden=false;btn.hidden=true;$('#stripeMessage').textContent=`Order ${r.order.order_number} has been prepared. Complete the secure payment below.`;}catch(e){btn.disabled=false;btn.textContent='Process Order';message(e.message,'error')}};
 $('#completeStripePayment').onclick=async()=>{const btn=$('#completeStripePayment');try{if(!stripe||!elements||!prepared)throw new Error('Secure payment is not ready.');btn.disabled=true;btn.textContent='Processing Payment…';const result=await stripe.confirmPayment({elements,redirect:'if_required'});if(result.error)throw new Error(result.error.message||'Payment failed.');const r=await DOTApi.invoke(DOT_PORTAL_CONFIG.adminOrderFunction||'dot-admin-order',{action:'confirm_stripe_payment',order_id:prepared.order.id});$('#stripeMessage').textContent='Payment completed successfully.';$('#orderResult').innerHTML=`<div class="dot-banner dot-order-success"><div><strong>Order ${esc(r.order.order_number)} paid</strong><span>The screenings4u order is now paid and ready for fulfillment.</span></div><a class="dot-btn small primary" href="dot-recent-orders.html">Manage Recent Orders</a></div>`;btn.textContent='Payment Complete';}catch(e){btn.disabled=false;btn.textContent='Pay & Complete Order';$('#stripeMessage').textContent=e.message;message(e.message,'error')}};
 redraw();
}
async function loadManagementHome(){
 renderBase({eyebrow:'SCREENINGS4U OPERATIONS',title:'DOT Management',copy:'Manage DOT accounts, programs, testing, compliance, portal access, billing and operations.',actions:'<a class="dot-btn primary" href="dot-portal-control.html">Manage DOT Portals</a>'});
 const sections=[
  ['DOT Account Management',[['C/TPAs','dot-ctpas.html'],['Employers','dot-employers.html'],['Owner-Operators','dot-owner-operators.html'],['Drivers','dot-drivers.html'],['User Access','dot-users-access.html']]],
  ['DOT Testing & Compliance',[['Programs','dot-programs.html'],['Consortiums','dot-pools.html'],['Testing Orders','dot-testing-orders.html'],['Test Results','dot-results.html'],['Compliance Cases','dot-compliance.html'],['Return-to-Duty','dot-return-to-duty.html']]],
  ['Business & System Management',[['DOT Pricing','dot-catalog.html'],['Orders','dot-orders.html'],['Invoices','dot-invoices.html'],['Documents','dot-documents.html'],['Support','dot-support.html'],['Audit History','dot-audit.html']]]
 ];
 $('#dotPageBody').innerHTML='<div class="dot-management-directory">'+sections.map(([heading,links])=>'<section class="dot-card"><div class="dot-card-head"><div><h2>'+esc(heading)+'</h2><p>Open a management page to view and work with records.</p></div></div><div class="dot-card-body"><div class="dot-management-links">'+links.map(([label,url])=>'<a class="dot-btn" href="'+url+'">'+esc(label)+' →</a>').join('')+'</div></div></section>').join('')+'</div>';
}

async function loadDashboard(){
 renderBase({title:'DOT Management Dashboard',copy:'Executive overview of dot.screenings4u.com, all 35 DOT portals, customers, testing, compliance, billing, support, and distribution activity.',actions:'<a class="dot-btn primary" href="dot-portal-control.html">Portal Control</a><a class="dot-btn" href="dot-website.html">DOT Website</a><a class="dot-btn" href="dot-distribution.html">Distribution</a>'});
 const settled=await Promise.allSettled([
   window.DOTApi.call('overview'),
   window.DOTApi.registry('inventory'),
   window.DOTApi.distribution('inventory'),
   window.DOTApi.call('support'),
   window.DOTApi.call('billing')
 ]);
 const value=i=>settled[i]?.status==='fulfilled'?(settled[i].value||{}):{};
 const overview=value(0),registry=value(1),distribution=value(2),support=value(3),billing=value(4);
 const failures=settled.filter(x=>x.status==='rejected');
 const portals=registry.portals||[],portalPages=registry.portal_pages||[],websitePages=registry.website_pages||[],targets=distribution.targets||[],distEvents=distribution.events||[];
 const ctpas=get(overview,'ctpas'),employers=get(overview,'employers').filter(x=>!x.archived_at&&x.status!=='archived'),owners=get(overview,'owner_operators'),drivers=get(overview,'drivers','employees').filter(x=>!x.archived_at),programs=get(overview,'programs'),pools=get(overview,'pools'),orders=get(overview,'testing_orders','orders'),results=get(overview,'test_results','results'),compliance=get(overview,'compliance_cases','cases'),tickets=get(support,'tickets','support_tickets'),subscriptions=get(billing,'subscriptions'),invoices=get(billing,'invoices');
 const openCompliance=compliance.filter(x=>!['resolved','closed','complete','completed'].includes(String(x.status||'').toLowerCase())).length;
 const openSupport=tickets.filter(x=>!['resolved','closed'].includes(String(x.status||'').toLowerCase())).length;
 const openTests=orders.filter(x=>!['completed','complete','cancelled','canceled'].includes(String(x.status||'').toLowerCase())).length;
 const activeSubs=subscriptions.filter(x=>['active','trialing'].includes(String(x.status||'').toLowerCase())).length;
 const outstandingInvoices=invoices.filter(x=>!['paid','void','cancelled','canceled'].includes(String(x.status||'').toLowerCase())).length;
 const ctpaPortal=portals.find(x=>x.portal_code==='ctpa_dot')||{};
 const websiteTarget=targets.find(x=>x.target_key==='website:dot.screenings4u.com')||{};
 const ctpaTarget=targets.find(x=>x.target_key==='portal:ctpa_dot')||{};
 const wiredPortals=portals.filter(x=>x.managed===true).length;
 const agencyPortals=portals.filter(x=>x.portal_kind==='agency').length;
 const activePortals=portals.filter(x=>String(x.status||'active').toLowerCase()==='active').length;
 const portalKinds=[...new Set(portals.map(x=>x.portal_kind).filter(Boolean))].length;
 const connectionOk=failures.length===0;
 $('#dotPageStatus').innerHTML=`<div class="dot-banner ${connectionOk?'':'warning'}"><div><strong>${connectionOk?'DOT management overview is live':'DOT management overview loaded with partial data'}</strong><span>${connectionOk?'Portal registry, website registry, operations, billing, support, and distribution are connected.':`${failures.length} dashboard data source${failures.length===1?'':'s'} did not answer. Available sections are still shown.`}</span></div><span class="dot-status-pill ${connectionOk?'ok':'warn'}">${connectionOk?'Live':'Partial'}</span></div>`;
 const topMetrics=[
  ['DOT Portals',String(portals.length),'Registered customer-facing portals'],
  ['Portal Pages',String(portalPages.length),'Managed portal pages'],
  ['Website Pages',String(websitePages.length),'dot.screenings4u.com'],
  ['C/TPAs',String(ctpas.length),'Managed C/TPA accounts'],
  ['Employers',String(employers.length),'DOT employer accounts'],
  ['DOT Workers',String(drivers.length),'Covered people / drivers'],
  ['Open Compliance',String(openCompliance),'Cases needing attention'],
  ['Open Support',String(openSupport),'Unresolved support tickets']
 ];
 const operations=[
  ['C/TPAs',ctpas.length,'dot-ctpas.html','Accounts, subscriptions, features, staff, customers, branding, billing, and support.'],
  ['Employers',employers.length,'dot-employers.html','Direct and C/TPA-sponsored DOT employers.'],
  ['Owner-Operators',owners.length,'dot-owner-operators.html','Owner-operator accounts and consortium relationships.'],
  ['Drivers / People',drivers.length,'dot-drivers.html','Safety-sensitive workforce records.'],
  ['Programs',programs.length,'dot-programs.html','DOT programs and employer program configuration.'],
  ['Pools',pools.length,'dot-pools.html','Consortiums, Consortiums, and membership.'],
  ['Open Testing',openTests,'dot-testing-orders.html','Testing orders not yet complete.'],
  ['Results',results.length,'dot-results.html','DOT testing result records.'],
  ['Compliance',openCompliance,'dot-compliance.html','Open compliance and corrective-action cases.'],
  ['Support',openSupport,'dot-support.html','Open customer and C/TPA support activity.'],
  ['Billing',outstandingInvoices,'dot-invoices.html',`${activeSubs} active subscriptions · ${outstandingInvoices} open invoices.`],
  ['Audit',get(overview,'audit_events','audit').length,'dot-audit.html','Management and operational audit history.']
 ];
 const portalStatusRows=portals.slice().sort((a,b)=>String(a.label||'').localeCompare(String(b.label||''))).slice(0,8).map(x=>[
   `<strong>${esc(x.label)}</strong><small>${esc(x.portal_code)}</small>`,
   esc(x.portal_kind||'portal'),
   esc(String(x.page_count??portalPages.filter(p=>p.portal_id===x.id).length)),
   badge(x.status||'active'),
   `<a class="dot-btn small" href="dot-portal-detail.html?portal=${encodeURIComponent(x.portal_code)}">Manage</a>`
 ]);
 const recentRows=distEvents.slice(0,8).map(x=>[
   esc(x.action||'—'),
   esc(targets.find(t=>t.id===x.target_id)?.label||x.target_id||'—'),
   esc(String(x.revision??'—')),
   fmtDate(x.created_at)
 ]);
 $('#dotPageBody').innerHTML=metrics(topMetrics)+`
 <div class="dot-grid dot-dashboard-grid">
   <article class="dot-card half dot-property-card">
     <div class="dot-card-head"><div><h2>Main DOT Website</h2><p>Public website management for dot.screenings4u.com.</p></div>${badge(websiteTarget.enabled===false?'disabled':'active')}</div>
     <div class="dot-card-body">
       <div class="dot-property-domain">dot.screenings4u.com</div>
       <div class="dot-property-stats"><div><strong>${websitePages.length}</strong><span>registered pages</span></div><div><strong>${websiteTarget.published_revision??0}</strong><span>published revision</span></div></div>
       <div class="dot-inline-actions"><a class="dot-btn primary" href="dot-website.html">Manage Website</a><a class="dot-btn" href="dot-distribution.html?target=website%3Adot.screenings4u.com">Distribution</a><a class="dot-btn" href="https://dot.screenings4u.com" target="_blank" rel="noopener">Open Live</a></div>
     </div>
   </article>
   <article class="dot-card half dot-property-card">
     <div class="dot-card-head"><div><h2>DOT Portal Network</h2><p>Central management for every DOT customer-facing portal.</p></div>${badge(activePortals===portals.length?'active':'attention')}</div>
     <div class="dot-card-body">
       <div class="dot-property-domain">${portals.length} registered portals</div>
       <div class="dot-property-stats"><div><strong>${activePortals}</strong><span>active portals</span></div><div><strong>${portalPages.length}</strong><span>registered pages</span></div><div><strong>${portalKinds}</strong><span>portal types</span></div></div>
       <div class="dot-inline-actions"><a class="dot-btn primary" href="dot-portal-control.html">Portal Control</a><a class="dot-btn" href="dot-distribution.html">Distribution</a><a class="dot-btn" href="dot-users-access.html">Access</a></div>
     </div>
   </article>
   <article class="dot-card half dot-property-card dot-property-accent">
     <div class="dot-card-head"><div><h2>C/TPA DOT — Phase 1</h2><p>First fully wired portal in the management control plane.</p></div>${badge(ctpaPortal.status||'active')}</div>
     <div class="dot-card-body">
       <div class="dot-property-domain">${esc(ctpaPortal.domain||'ctpa-dot.screenings4u.com')}</div>
       <div class="dot-property-stats"><div><strong>${ctpaPortal.page_count??portalPages.filter(p=>p.portal_id===ctpaPortal.id).length}</strong><span>managed pages</span></div><div><strong>${ctpaTarget.published_revision??0}</strong><span>published revision</span></div><div><strong>${ctpas.length}</strong><span>C/TPA accounts</span></div></div>
       <div class="dot-inline-actions"><a class="dot-btn primary" href="dot-portal-detail.html?portal=ctpa_dot">Manage Portal</a><a class="dot-btn" href="dot-ctpas.html">C/TPA Accounts</a><a class="dot-btn" href="https://ctpa-dot.screenings4u.com" target="_blank" rel="noopener">Open Live</a></div>
     </div>
   </article>
   <article class="dot-card half">
     <div class="dot-card-head"><div><h2>Management Coverage</h2><p>Current inventory and Phase 1 control status.</p></div></div>
     <div class="dot-card-body"><div class="dot-kpi-list">
       <div class="dot-kpi-row"><span>Registered DOT portals</span><strong>${portals.length}</strong></div>
       <div class="dot-kpi-row"><span>Managed registry entries</span><strong>${wiredPortals}</strong></div>
       <div class="dot-kpi-row"><span>Agency portals</span><strong>${agencyPortals}</strong></div>
       <div class="dot-kpi-row"><span>C/TPA DOT page controls</span><strong>${ctpaPortal.page_count??portalPages.filter(p=>p.portal_id===ctpaPortal.id).length}</strong></div>
       <div class="dot-kpi-row"><span>DOT website page controls</span><strong>${websitePages.length}</strong></div>
     </div></div>
   </article>
   <article class="dot-card">
     <div class="dot-card-head"><div><h2>Operations Overview</h2><p>Jump directly into the operational areas managed by the DOT control plane.</p></div></div>
     <div class="dot-card-body"><div class="dot-dashboard-action-grid">${operations.map(([label,count,href,copy])=>`<a class="dot-dashboard-action" href="${href}"><span class="dot-dashboard-action-count">${esc(String(count))}</span><b>${esc(label)}</b><small>${esc(copy)}</small><span class="dot-dashboard-action-link">Open →</span></a>`).join('')}</div></div>
   </article>
   <article class="dot-card half">
     <div class="dot-card-head"><div><h2>Portal Snapshot</h2><p>Quick access to managed DOT portals.</p></div><a class="dot-card-head-link" href="dot-portal-control.html">View all ${portals.length}</a></div>
     <div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Portal</th><th>Type</th><th>Pages</th><th>Status</th><th></th></tr></thead><tbody>${portalStatusRows.length?portalStatusRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="5"><div class="dot-empty">Portal registry has no records.</div></td></tr>'}</tbody></table></div>
   </article>
   <article class="dot-card half">
     <div class="dot-card-head"><div><h2>Current Attention</h2><p>Operational items that may need management review.</p></div></div>
     <div class="dot-card-body"><div class="dot-attention-grid">
       <a href="dot-support.html"><span>Open support</span><strong>${openSupport}</strong></a>
       <a href="dot-compliance.html"><span>Open compliance</span><strong>${openCompliance}</strong></a>
       <a href="dot-testing-orders.html"><span>Open testing</span><strong>${openTests}</strong></a>
       <a href="dot-invoices.html"><span>Open invoices</span><strong>${outstandingInvoices}</strong></a>
     </div></div>
   </article>
   <article class="dot-card">
     <div class="dot-card-head"><div><h2>Recent Distribution Activity</h2><p>Latest website and portal configuration/distribution activity.</p></div><a class="dot-card-head-link" href="dot-distribution.html">Open distribution</a></div>
     <div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Action</th><th>Target</th><th>Revision</th><th>Date</th></tr></thead><tbody>${recentRows.length?recentRows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="4"><div class="dot-empty">No distribution activity has been recorded yet.</div></td></tr>'}</tbody></table></div>
   </article>
 </div>`;
}

async function loadRecentSubscriptions(){
 renderBase({title:'Recent DOT Subscriptions',copy:'Manage DOT subscriptions and review purchases from dot.screenings4u.com. Website purchases and subscriptions are tracked separately.',actions:'<a class="dot-btn primary" href="dot-recent-orders.html">Recent Orders</a><a class="dot-btn" href="dot-invoices.html">Invoices</a>'});
 const results=await Promise.allSettled([DOTApi.call('billing',{}, {fresh:true}),DOTApi.call('orders',{}, {fresh:true})]);
 const billing=results[0].status==='fulfilled'?results[0].value:{};
 const ordersData=results[1].status==='fulfilled'?results[1].value:{};
 const planMap=new Map(get(billing,'plans').map(x=>[String(x.id),x]));
 const employerMap=new Map(get(billing,'employers').map(x=>[String(x.id),x]));
 const ctpaMap=new Map(get(billing,'ctpas').map(x=>[String(x.id),x]));
 const subscriptions=get(billing,'subscriptions').filter(Boolean).sort((a,b)=>new Date(b.created_at||b.start_date||0)-new Date(a.created_at||a.start_date||0));
 const allOrders=get(ordersData,'orders','service_orders').filter(Boolean);
 const webOrders=allOrders.filter(x=>String(x.source||x.metadata?.source||'').toLowerCase()==='website'||/dot\.screenings4u\.com/i.test(String(x.metadata?.origin||x.metadata?.source_url||x.metadata?.website||''))).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
 const active=subscriptions.filter(x=>['active','trialing'].includes(String(x.status||'').toLowerCase())).length;
 const paid=webOrders.filter(x=>String(x.payment_status||'').toLowerCase()==='paid').length;
 const warn=results.filter(x=>x.status==='rejected').map(x=>x.reason?.message||'Backend request failed');
 if(warn.length)message('Some records could not be loaded: '+warn.join('; '),'error');
 $('#dotPageBody').innerHTML=metrics([['Subscriptions',subscriptions.length,'Returned by DOT billing management'],['Active',active,'Active or trialing subscriptions'],['Website Orders',webOrders.length,'Website-originated orders available to management'],['Website Payments',paid,'Paid website orders']])+
 '<div class="dot-card"><div class="dot-card-head"><div><h2>Subscription Directory</h2><p>Search plans, account IDs, renewal dates and billing status. Open the associated account to make changes using existing management controls.</p></div><span id="subVisible"></span></div><div class="dot-card-body"><div class="dot-filter-row"><input id="subSearch" type="search" placeholder="Search subscription, customer, plan or Stripe ID"><select id="subStatus"><option value="">All subscription statuses</option><option value="active">Active</option><option value="trialing">Trialing</option><option value="past_due">Past due</option><option value="canceled">Canceled</option><option value="inactive">Inactive</option></select></div></div><div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Created</th><th>Account</th><th>Plan</th><th>Subscription</th><th>Renewal</th><th>Status</th><th>Manage</th></tr></thead><tbody id="subRows"></tbody></table></div></div>'+
 '<div class="dot-card" style="margin-top:20px"><div class="dot-card-head"><div><h2>Recent Website Purchases</h2><p>Orders entered through the website, regardless of whether they created a recurring subscription.</p></div><span id="webOrderVisible"></span></div><div class="dot-card-body"><div class="dot-filter-row"><input id="webOrderSearch" type="search" placeholder="Search order, customer, company or email"></div></div><div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Date</th><th>Order</th><th>Customer</th><th>Total</th><th>Payment</th><th>Status</th><th>Manage</th></tr></thead><tbody id="webOrderRows"></tbody></table></div></div>';
 const drawSubs=()=>{const q=($('#subSearch')?.value||'').toLowerCase(),st=$('#subStatus')?.value||'';const rows=subscriptions.filter(x=>(!st||String(x.status||'').toLowerCase()===st)&&(!q||[x.id,x.employer_id,x.ctpa_id,x.plan_id,x.order_reference,x.stripe_subscription_id,x.external_subscription_id].some(v=>String(v||'').toLowerCase().includes(q))));$('#subVisible').textContent=rows.length+' records';$('#subRows').innerHTML=rows.map(x=>'<tr><td>'+fmtDate(x.created_at||x.start_date)+'</td><td>'+esc(x.employer_name||x.customer_name||employerMap.get(String(x.employer_id))?.legal_name||ctpaMap.get(String(x.ctpa_id))?.legal_name||x.employer_id||x.ctpa_id||'—')+'</td><td>'+esc(x.plan_name||x.plans?.name||planMap.get(String(x.plan_id))?.name||x.plan_code||x.plan_id||'—')+'</td><td><strong>'+esc(x.order_reference||x.external_subscription_id||x.stripe_subscription_id||x.id)+'</strong><small>'+esc(x.billing_frequency||'')+'</small></td><td>'+fmtDate(x.renewal_date||x.stripe_current_period_end)+'</td><td>'+badge(x.status)+'</td><td>'+(x.employer_id?'<a class="dot-btn small" href="dot-employers.html">Employer Management</a>':x.ctpa_id?'<a class="dot-btn small" href="dot-ctpas.html">C/TPA Management</a>':'<a class="dot-btn small" href="dot-invoices.html">Billing</a>')+'</td></tr>').join('')||'<tr><td colspan="7"><div class="dot-empty">No subscription records returned. Check the DOT billing backend if purchases exist.</div></td></tr>'};
 const drawOrders=()=>{const q=($('#webOrderSearch')?.value||'').toLowerCase();const rows=webOrders.filter(x=>!q||[x.id,x.order_number,x.customer_email,x.company_name,x.customer_first_name,x.customer_last_name].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,200);$('#webOrderVisible').textContent=rows.length+' shown';$('#webOrderRows').innerHTML=rows.map(x=>'<tr><td>'+fmtDate(x.created_at)+'</td><td><strong>'+esc(x.order_number||x.id)+'</strong></td><td>'+esc(x.company_name||[x.customer_first_name,x.customer_last_name].filter(Boolean).join(' ')||'—')+'<small>'+esc(x.customer_email||'')+'</small></td><td>'+money(x.total||0)+'</td><td>'+badge(x.payment_status)+'</td><td>'+badge(x.status)+'</td><td><a class="dot-btn small" href="dot-recent-orders.html">Order Management</a></td></tr>').join('')||'<tr><td colspan="7"><div class="dot-empty">No website orders returned by the management API.</div></td></tr>'};
 $('#subSearch').addEventListener('input',drawSubs);$('#subStatus').addEventListener('change',drawSubs);$('#webOrderSearch').addEventListener('input',drawOrders);drawSubs();drawOrders();
}

async function loadRecentOrders(){
 renderBase({title:'Recent Orders',copy:'Review and manage DOT website purchases and management-created service orders. View order details, resend customer receipts, and maintain carrier tracking numbers.',actions:'<a class="dot-btn primary" href="dot-orders.html">Create Service Order</a><a class="dot-btn" href="dot-invoices.html">Invoices</a>'});
 const d=await DOTApi.call('orders');
 const all=get(d,'orders','service_orders').filter(x=>x.metadata?.created_by_business==='screenings4u_workforce_dot'||x.metadata?.source==='screenings4u_workforce_dot_admin_order'||['admin','website'].includes(String(x.source||'').toLowerCase()));
 all.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
 const orders=all.slice(0,100);
 const paid=orders.filter(x=>String(x.payment_status||'').toLowerCase()==='paid').length;
 const unpaid=orders.filter(x=>String(x.payment_status||'').toLowerCase()==='unpaid').length;
 const total=orders.reduce((sum,x)=>sum+Number(x.total||0),0);
 $('#dotPageBody').innerHTML=`${metrics([['Recent Orders',orders.length,'Latest 100 orders'],['Paid',paid,'Completed payments'],['Unpaid',unpaid,'Needs payment follow-up'],['Order Value',money(total),'Recent order total']])}
 <div class="dot-card recent-orders-card"><div class="dot-card-head"><div><h2>Recent Service Orders</h2><p>Customer receipts and shipping tracking are managed here, separate from the Create Service Order page.</p></div><span id="recentOrderCount">${orders.length} orders</span></div>
 <div class="dot-card-body"><div class="dot-filter-row"><input id="recentOrderSearch" type="search" placeholder="Search order, company, email, payment, or tracking"><select id="recentOrderPayment"><option value="">All payment statuses</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option><option value="pending">Pending</option></select></div></div>
 <div id="recentOrdersTable"></div></div>`;
 const trackingSummary=x=>{const t=x.metadata?.shipping_tracking||{};const vals=[['USPS',t.usps],['UPS',t.ups],['FedEx',t.fedex]].filter(v=>String(v[1]||'').trim());return vals.length?vals.map(v=>`<small><strong>${v[0]}:</strong> ${esc(v[1])}</small>`).join(''):'<small>No carrier tracking entered</small>'};
 const actions=x=>`<div class="recent-order-actions"><button class="dot-btn small recentView" data-id="${esc(x.id)}" type="button">View</button><button class="dot-btn small recentReceipt" data-id="${esc(x.id)}" type="button">Send Receipt</button><button class="dot-btn small primary recentTracking" data-id="${esc(x.id)}" type="button">Tracking</button></div>`;
 const render=()=>{const q=($('#recentOrderSearch')?.value||'').toLowerCase(),pay=$('#recentOrderPayment')?.value||'';const filtered=orders.filter(x=>{const payment=String(x.payment_status||x.status||'').toLowerCase(),track=x.metadata?.shipping_tracking||{};const hay=[x.order_number,x.company_name,x.customer_email,x.customer_first_name,x.customer_last_name,payment,x.tracking_number,track.usps,track.ups,track.fedex].join(' ').toLowerCase();return (!q||hay.includes(q))&&(!pay||payment===pay)});const rows=filtered.map(x=>[`<strong>${esc(x.order_number||x.id||'—')}</strong>${trackingSummary(x)}`,`<strong>${esc(x.company_name||[x.customer_first_name,x.customer_last_name].filter(Boolean).join(' ')||'—')}</strong><small>${esc(x.customer_email||'')}</small>`,money(x.total||0),badge(x.payment_status||x.status),fmtDate(x.created_at),actions(x)]);$('#recentOrdersTable').innerHTML=table(['Order / Tracking','Customer','Total','Payment','Created','Actions'],rows);if($('#recentOrderCount'))$('#recentOrderCount').textContent=filtered.length+' order'+(filtered.length===1?'':'s');wireRows()};
 const wireRows=()=>{
  document.querySelectorAll('.recentView').forEach(btn=>btn.onclick=async()=>{try{const out=await DOTApi.invoke(DOT_PORTAL_CONFIG.adminOrderFunction||'dot-admin-order',{action:'get_order',order_id:btn.dataset.id});const o=out.order||{},items=out.items||[],track=o.metadata?.shipping_tracking||{};openBrandModal({title:o.order_number||'Order Details',kicker:'SERVICE ORDER',body:`<div class="order-detail-grid"><div><span>Customer</span><strong>${esc(o.company_name||[o.customer_first_name,o.customer_last_name].filter(Boolean).join(' ')||'—')}</strong><small>${esc(o.customer_email||'')}</small></div><div><span>Total</span><strong>${money(o.total||0)}</strong><small>${esc(o.payment_status||'')}</small></div><div><span>Created</span><strong>${fmtDate(o.created_at)}</strong><small>${esc(o.status||'')}</small></div><div><span>Tracking</span><strong>${esc(o.tracking_number||'Not entered')}</strong><small>${[track.usps&&'USPS '+track.usps,track.ups&&'UPS '+track.ups,track.fedex&&'FedEx '+track.fedex].filter(Boolean).map(esc).join(' · ')||'No carrier tracking'}</small></div></div><div class="order-detail-items"><h3>Order Items</h3>${items.length?items.map(it=>`<div><span>${esc(it.metadata?.name||'Service')} × ${Number(it.quantity||1)}</span><strong>${money(Number(it.unit_price||0)*Number(it.quantity||1))}</strong></div>`).join(''):'<div class="dot-empty compact">No order items found.</div>'}</div>`,actions:'<button class="dot-btn" type="button" data-modal-close>Close</button><button class="dot-btn primary recentTrackingFromView" type="button" data-id="'+esc(o.id)+'">Edit Tracking</button>'});document.querySelector('.recentTrackingFromView')?.addEventListener('click',()=>{closeBrandModal();openTracking(o)})}catch(e){message(e.message||'Unable to load the order.','error')}});
  document.querySelectorAll('.recentReceipt').forEach(btn=>btn.onclick=async()=>{const order=orders.find(x=>String(x.id)===String(btn.dataset.id));openBrandModal({title:'Send Receipt',kicker:'CUSTOMER EMAIL',body:`<div class="dot-modal-message"><strong>${esc(order?.order_number||'Order')}</strong><p>Send a branded screenings4u receipt to <b>${esc(order?.customer_email||'the customer email')}</b>?</p></div>`,actions:`<button class="dot-btn" type="button" data-modal-close>Cancel</button><button class="dot-btn primary" type="button" id="confirmSendReceipt">Send Receipt</button>`});$('#confirmSendReceipt').onclick=async()=>{const b=$('#confirmSendReceipt');b.disabled=true;b.textContent='Sending…';try{const out=await DOTApi.invoke('dot-order-email',{action:'send_receipt',order_id:btn.dataset.id});closeBrandModal();message(out.receipt?.sent===true?'Receipt sent successfully.':`Receipt request completed, but delivery was not confirmed${out.receipt?.reason?': '+out.receipt.reason:''}.`,out.receipt?.sent===true?'ok':'error')}catch(e){closeBrandModal();message(e.message||'Unable to send receipt.','error')}}});
  document.querySelectorAll('.recentTracking').forEach(btn=>btn.onclick=()=>openTracking(orders.find(x=>String(x.id)===String(btn.dataset.id))||{}));
 };
 const openTracking=order=>{const track=order.metadata?.shipping_tracking||{};openBrandModal({title:'Shipping Tracking',kicker:order.order_number||'SERVICE ORDER',body:`<div class="tracking-carrier-grid"><label><span>USPS Tracking Number</span><input id="trackUsps" value="${esc(track.usps||'')}" placeholder="Enter USPS tracking number"></label><label><span>UPS Tracking Number</span><input id="trackUps" value="${esc(track.ups||'')}" placeholder="Enter UPS tracking number"></label><label><span>FedEx Tracking Number</span><input id="trackFedex" value="${esc(track.fedex||'')}" placeholder="Enter FedEx tracking number"></label></div><p class="dot-help">Enter the carrier tracking number, save it to the order, or save and email the tracking information directly to the customer.</p>`,actions:'<button class="dot-btn" type="button" data-modal-close>Cancel</button><button class="dot-btn" id="saveTracking" type="button">Save Tracking</button><button class="dot-btn primary" id="sendTracking" type="button">Save & Send Tracking</button>'});const payload=()=>({usps:$('#trackUsps').value.trim(),ups:$('#trackUps').value.trim(),fedex:$('#trackFedex').value.trim()});const save=async()=>{const out=await DOTApi.invoke(DOT_PORTAL_CONFIG.adminOrderFunction||'dot-admin-order',{action:'update_tracking',order_id:order.id,tracking:payload()});order.metadata=out.order.metadata;order.tracking_number=out.order.tracking_number;return out};$('#saveTracking').onclick=async()=>{const b=$('#saveTracking');b.disabled=true;b.textContent='Saving…';try{const out=await save();closeBrandModal();message(`Tracking updated for ${out.order.order_number}.`);render()}catch(e){b.disabled=false;b.textContent='Save Tracking';message(e.message||'Unable to update tracking.','error')}};$('#sendTracking').onclick=async()=>{const b=$('#sendTracking');b.disabled=true;$('#saveTracking').disabled=true;b.textContent='Saving & Sending…';try{const out=await save();const sent=await DOTApi.invoke('dot-order-email',{action:'send_tracking',order_id:order.id});closeBrandModal();message(sent.tracking_email?.sent===true?`Tracking saved and emailed to ${out.order.customer_email||order.customer_email}.`:`Tracking saved, but email delivery was not confirmed${sent.tracking_email?.reason?': '+sent.tracking_email.reason:''}.`,sent.tracking_email?.sent===true?'ok':'error');render()}catch(e){b.disabled=false;$('#saveTracking').disabled=false;b.textContent='Save & Send Tracking';message(e.message||'Unable to send tracking.','error')}}};
 $('#recentOrderSearch')?.addEventListener('input',render);$('#recentOrderPayment')?.addEventListener('change',render);render();
}

async function loadWebsite(){
 renderBase({title:'DOT Website Management',copy:'Manage every registered page on dot.screenings4u.com, including live page settings, navigation, SEO, and distribution.',actions:'<a class="dot-btn primary" href="dot-distribution.html?target=website%3Adot.screenings4u.com">Website Distribution</a><a class="dot-btn" href="https://dot.screenings4u.com" target="_blank" rel="noopener">Open Live Website</a>'});
 const d=await window.DOTApi.registry('inventory'),pages=d.website_pages||[];
 $('#dotPageBody').innerHTML=`${metrics([['Website Pages',String(pages.length),'Registered public pages'],['Active',String(pages.filter(x=>x.status==='active').length),'Live pages'],['SEO Indexed',String(pages.filter(x=>x.seo_index!==false).length),'Search indexing enabled'],['Hidden From Nav',String(pages.filter(x=>x.nav_visible===false).length),'Not shown in navigation']])}
 <div class="dot-card"><div class="dot-card-head"><div><h2>Website Pages</h2><p>Search and manage every registered public page.</p></div><a class="dot-btn" href="https://dot.screenings4u.com" target="_blank" rel="noopener">Open Website</a></div><div class="dot-card-body"><div class="dot-field-grid"><div class="dot-field"><label for="siteSearch">Search pages</label><input id="siteSearch" placeholder="Title, route, file, or type"></div><div class="dot-field"><label for="siteTypeFilter">Page type</label><select id="siteTypeFilter"><option value="">All types</option>${[...new Set(pages.map(x=>x.page_type).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div><div class="dot-field"><label for="siteStatusFilter">Status</label><select id="siteStatusFilter"><option value="">All statuses</option>${[...new Set(pages.map(x=>x.status).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('')}</select></div></div></div><div id="sitePagesTable"></div></div>`;
 const render=()=>{const q=($('#siteSearch').value||'').toLowerCase(),type=$('#siteTypeFilter').value,status=$('#siteStatusFilter').value,rows=pages.filter(x=>(!q||[x.title,x.route,x.file_name,x.page_type].some(v=>String(v||'').toLowerCase().includes(q)))&&(!type||x.page_type===type)&&(!status||x.status===status)).map(x=>[`<a href="dot-website-page.html?page=${encodeURIComponent(x.page_key)}"><strong>${esc(x.title)}</strong></a><br><small>${esc(x.route)}</small>`,esc(x.file_name),esc(x.page_type),badge(x.status),x.seo_index===false?badge('noindex'):badge('indexed'),x.nav_visible===false?badge('hidden'):badge('visible'),`<div class="dot-inline-actions"><a class="dot-btn small primary" href="dot-website-page.html?page=${encodeURIComponent(x.page_key)}">Manage</a><a class="dot-btn small" href="https://dot.screenings4u.com${esc(x.route)}" target="_blank" rel="noopener">Open</a></div>`]);$('#sitePagesTable').innerHTML=table(['Page','File','Type','Status','SEO','Navigation','Actions'],rows)};
 ['siteSearch','siteTypeFilter','siteStatusFilter'].forEach(id=>document.getElementById(id)?.addEventListener(id==='siteSearch'?'input':'change',render));render();
}
async function loadPortalControl(){renderBase({title:'DOT Portal Control',copy:'Open any DOT portal to manage its identity, every registered page, runtime distribution, and connected operational workflows.',actions:'<a class="dot-btn" href="dot-distribution.html">Distribution Management</a>'});const d=await window.DOTApi.registry('inventory');const rows=(d.portals||[]).map(x=>[`<strong>${esc(x.label)}</strong><small>${esc(x.portal_code)}</small>`,esc(x.portal_kind),esc(x.agency_code||'All DOT'),`<span>${esc(x.domain)}</span>`,`<a href="dot-portal-detail.html?portal=${encodeURIComponent(x.portal_code)}"><strong>${esc(String(x.page_count||0))}</strong> pages</a>`,badge(x.status),`<a class="dot-btn small primary" href="dot-portal-detail.html?portal=${encodeURIComponent(x.portal_code)}">Manage Portal</a>`]);$('#dotPageBody').innerHTML=metrics([['DOT Portals',rows.length,'Registered control targets'],['Portal Pages',String((d.portal_pages||[]).length),'Registered managed pages'],['Agency Portals',String((d.portals||[]).filter(x=>x.portal_kind==='agency').length),'FMCSA / FAA / FRA / FTA / PHMSA / USCG'],['Management Host','dot-portal','Central control plane']])+`<div class="dot-card"><div class="dot-card-head"><div><h2>Managed DOT Portals</h2><p>Select a portal to manage its pages and connected operations.</p></div></div>${table(['Portal','Type','Agency','Host','Pages','Status','Management'],rows)}</div>`}
async function loadAgencies(){
 const agencies=[
  {code:'FMCSA',name:'Federal Motor Carrier Safety Administration',desc:'Motor carriers and CDL drivers',reg:'49 CFR Part 382',mode:'Federal systems',status:'External systems',tone:'blue',tools:['Motus registration','SAFER carrier lookup','SMS safety data']},
  {code:'FAA',name:'Federal Aviation Administration',desc:'Aviation safety-sensitive programs',reg:'14 CFR Part 120',mode:'API + federal systems',status:'API available',tone:'green',tools:['FAA Data Portal APIs','Drug Abatement resources','Program registration guidance']},
  {code:'FRA',name:'Federal Railroad Administration',desc:'Railroad drug and alcohol programs',reg:'49 CFR Part 219',mode:'REST / OData API',status:'API available',tone:'green',tools:['FRA Safety Data API','Rail safety datasets','Agency guidance']},
  {code:'FTA',name:'Federal Transit Administration',desc:'Public transit programs',reg:'49 CFR Part 655',mode:'Open-data API',status:'Read-only data',tone:'blue',tools:['NTD datasets','data.transportation.gov API','FTA D&A resources']},
  {code:'PHMSA',name:'Pipeline & Hazardous Materials Safety Administration',desc:'Pipeline operator programs',reg:'49 CFR Part 199',mode:'Open-data API',status:'Read-only data',tone:'blue',tools:['PHMSA datasets','DAMIS public data','Pipeline safety data']},
  {code:'USCG',name:'United States Coast Guard',desc:'Maritime drug testing programs',reg:'46 CFR Parts 4 & 16',mode:'Federal resources',status:'No public API found',tone:'gray',tools:['DAPI program','Marine employer guidance','MIS reporting guidance']}
 ];
 document.body.classList.add('agency-admin-page');
 renderBase({title:'DOT Agency Data & Systems',copy:'Use official federal systems and supported government data services here. Portal page management stays in Portal Control.',actions:'<a class="dot-btn" href="dot-portal-control.html">Portal Control</a>'});
 const apiCount=agencies.filter(x=>x.status==='API available').length;
 const dataCount=agencies.filter(x=>x.status==='Read-only data').length;
 $('#dotPageBody').innerHTML=`
 <div class="dot-callout dot-agency-callout"><div><strong>Agency integrations, not portal-page management</strong><span>These workspaces now focus on official DOT systems, public datasets, API opportunities, and regulatory resources. We will only label something “connected” after credentials and a supported API are actually configured.</span></div></div>
 <div class="dot-agency-metrics">
  <div class="dot-metric"><span>AGENCIES</span><strong>${agencies.length}</strong><small>DOT / USCG testing authorities</small></div>
  <div class="dot-metric"><span>DIRECT APIS</span><strong>${apiCount}</strong><small>FAA and FRA developer services</small></div>
  <div class="dot-metric"><span>OPEN DATA</span><strong>${dataCount}</strong><small>FTA and PHMSA public data APIs</small></div>
  <div class="dot-metric"><span>FMCSA</span><strong>Motus</strong><small>Registration moved to Motus in 2026</small></div>
 </div>
 <div class="dot-agency-grid">${agencies.map(a=>`<a class="dot-agency-card" href="dot-agency-detail.html?agency=${encodeURIComponent(a.code)}">
   <div class="dot-agency-card-top"><span class="dot-agency-code">${a.code}</span><span class="dot-integration-badge ${a.tone}">${a.status}</span></div>
   <h2>${a.name}</h2><p>${a.desc}</p>
   <div class="dot-agency-reg">${a.reg}</div>
   <div class="dot-agency-mode">${a.mode}</div>
   <div class="dot-agency-tools">${a.tools.map(t=>`<span>${t}</span>`).join('')}</div>
   <div class="dot-agency-open">Open agency workspace →</div>
  </a>`).join('')}</div>
 <div class="dot-card dot-agency-note"><div class="dot-card-head"><div><h2>Integration rule</h2><p>screenings4u should consume supported public/read APIs where useful, but regulated filings, registrations, queries, and submissions remain in the official federal system unless that agency explicitly provides an authorized transactional API.</p></div></div></div>`;
}


function rtdPersonName(person){return [person?.first_name,person?.middle_name,person?.last_name].filter(Boolean).join(' ')||person?.email||person?.id||'—'}
function rtdCompanyName(emp){return emp?.legal_name||emp?.dba_name||emp?.workforce_display_name||emp?.id||'—'}
function rtdStage(status,plan={}){
 const s=String(status||'').toLowerCase();
 if(/closed|complete|completed|eligible|returned/.test(s))return 6;
 if(plan.rtd_test_completed||/rtd_test_completed|test_completed/.test(s))return 5;
 if(plan.rtd_test_ordered||/rtd_test|test_ordered/.test(s))return 4;
 if(plan.follow_up_evaluation_completed||/follow_up_evaluation/.test(s))return 3;
 if(plan.education_treatment_completed||/education|treatment/.test(s))return 2;
 if(plan.initial_evaluation_completed||/evaluation_completed|recommendation/.test(s))return 1;
 return 0;
}
function rtdStatusLabel(x){const s=String(x||'sap_evaluation_pending').replaceAll('_',' ');return s.replace(/\b\w/g,m=>m.toUpperCase())}
function rtdSource(emp,ctpaMap,plan={}){const raw=String(plan?.source||plan?.created_source||'').toLowerCase();if(raw.includes('admin')||raw.includes('management'))return{code:'admin',label:'Admin',name:'screenings4u DOT'};if(raw.includes('ctpa')||raw.includes('c/tpa')||emp?.ctpa_id)return{code:'ctpa',label:'C/TPA',name:ctpaMap.get(String(emp?.ctpa_id||''))?.organizations?.legal_name||ctpaMap.get(String(emp?.ctpa_id||''))?.company_name||'C/TPA'};return{code:'direct',label:'Direct Employer',name:'Direct Employer'}}
function rtdSteps(stage){const labels=['SAP Referral','Initial SAP Evaluation','Education / Treatment','Follow-up SAP Evaluation','RTD Test','Eligible to Return'];return `<div class="rtd-timeline">${labels.map((l,i)=>`<div class="rtd-step ${i<stage?'done':i===stage?'current':''}"><span>${i<stage?'✓':i+1}</span><b>${esc(l)}</b></div>`).join('')}</div>`}
async function loadReturnToDuty(){
 renderBase({title:'Return-to-Duty / SAP',copy:'Manage every DOT return-to-duty workflow created by C/TPAs, direct employers, and screenings4u administrators.',actions:'<a class="dot-btn primary" href="dot-return-to-duty-new.html">New RTD Workflow</a>'});
 document.querySelector('.dot-page')?.classList.add('rtd-admin-page');
 const d=await DOTApi.call('rtd');
 const cases=get(d,'sap_cases','rtd_cases'), compliance=get(d,'compliance_cases'), employers=get(d,'employers'), employees=get(d,'employees'), ctpas=get(d,'ctpas');
 const ccMap=new Map(compliance.map(x=>[String(x.id),x])),empMap=new Map(employers.map(x=>[String(x.id),x])),personMap=new Map(employees.map(x=>[String(x.id),x])),ctpaMap=new Map(ctpas.map(x=>[String(x.id),x]));
 const enriched=cases.map((x,i)=>{const cc=ccMap.get(String(x.compliance_case_id))||{},emp=empMap.get(String(cc.employer_id))||{},person=personMap.get(String(cc.employee_id))||{},plan=x.follow_up_plan||{},src=rtdSource(emp,ctpaMap,plan),stage=rtdStage(x.return_to_duty_status,plan);return{x,cc,emp,person,src,plan,stage,i}});
 const open=enriched.filter(o=>!/closed|complete|completed/.test(String(o.x.status||''))).length,ctpaCount=enriched.filter(o=>o.src.code==='ctpa').length,directCount=enriched.filter(o=>o.src.code==='direct').length,adminCount=enriched.filter(o=>o.src.code==='admin').length;
 const rows=enriched.map(o=>`<tr data-rtd-row data-search="${esc([rtdPersonName(o.person),rtdCompanyName(o.emp),o.src.label,o.src.name,o.cc.case_number,o.x.return_to_duty_status].join(' ').toLowerCase())}" data-source="${o.src.code}" data-status="${esc(String(o.x.status||'open').toLowerCase())}"><td><strong>${esc(o.cc.case_number||('RTD-'+String(o.x.id).slice(0,8)))}</strong><small>${fmtDate(o.cc.violation_date||o.x.created_at)}</small></td><td><strong>${esc(rtdPersonName(o.person))}</strong></td><td><strong>${esc(rtdCompanyName(o.emp))}</strong></td><td>${esc(o.src.label)}</td><td><strong>${esc(rtdStatusLabel(o.x.return_to_duty_status))}</strong><small>Step ${Math.min(o.stage+1,6)} of 6</small></td><td>${fmtDate(o.x.evaluation_date)}</td><td>${badge(o.x.status||'open')}</td><td><a class="dot-btn small rtd-view-btn" href="dot-return-to-duty-detail.html?id=${encodeURIComponent(o.x.id)}">View</a></td></tr>`).join('');
 $('#dotPageBody').innerHTML=`${metrics([['All RTD Workflows',enriched.length,'Across all creation sources'],['Open Workflows',open,'Currently in the RTD process'],['C/TPA',ctpaCount,'Created through C/TPA workflows'],['Direct Employer',directCount,'Created through employer workflows'],['Admin',adminCount,'Created by screenings4u staff']])}
 <div class="dot-card rtd-directory"><div class="dot-card-head"><div><h2>Return-to-Duty Workflow Directory</h2><p>Track the SAP and return-to-duty process from referral through eligibility to return to safety-sensitive duty.</p></div><span id="rtdCount">${enriched.length} workflow${enriched.length===1?'':'s'}</span></div><div class="dot-card-body rtd-filters"><input id="rtdSearch" type="search" placeholder="Search donor, company, case or status"><select id="rtdSource"><option value="">All sources</option><option value="ctpa">C/TPA</option><option value="direct">Direct Employer</option><option value="admin">Admin</option></select><select id="rtdStatus"><option value="">All statuses</option><option value="open">Open</option><option value="closed">Closed / Complete</option></select></div><div class="dot-table-wrap rtd-table-wrap"><table class="dot-table rtd-table"><thead><tr><th>Case</th><th>Donor / Employee</th><th>Employer</th><th>Source</th><th>Current Step</th><th>SAP Evaluation</th><th>Status</th><th>View</th></tr></thead><tbody>${rows||'<tr><td colspan="8"><div class="dot-empty">No return-to-duty workflows have been created yet.</div></td></tr>'}</tbody></table></div></div>`;
 const filter=()=>{const q=($('#rtdSearch').value||'').toLowerCase(),src=$('#rtdSource').value,st=$('#rtdStatus').value;let n=0;document.querySelectorAll('[data-rtd-row]').forEach(tr=>{const closed=/closed|complete|completed/.test(tr.dataset.status||''),ok=(!q||tr.dataset.search.includes(q))&&(!src||tr.dataset.source===src)&&(!st||(st==='closed'?closed:!closed));tr.hidden=!ok;if(ok)n++});$('#rtdCount').textContent=`${n} workflow${n===1?'':'s'}`};['rtdSearch','rtdSource','rtdStatus'].forEach(id=>$('#'+id)?.addEventListener(id==='rtdSearch'?'input':'change',filter));
}

async function loadReturnToDutyNew(){
 renderBase({title:'Create Return-to-Duty Workflow',copy:'Start a new SAP / return-to-duty case for a DOT-covered employee.',actions:'<a class="dot-btn" href="dot-return-to-duty.html">Back to RTD</a>'});
 document.querySelector('.dot-page')?.classList.add('rtd-form-page');
 const d=await DOTApi.call('rtd'),employers=get(d,'employers'),employees=get(d,'employees');
 $('#dotPageBody').innerHTML=`<div class="dot-card rtd-page-card"><div class="dot-card-head"><div><span class="dot-eyebrow">NEW WORKFLOW</span><h2>Return-to-Duty Case Setup</h2><p>Create the internal workflow record used to track the SAP and RTD process.</p></div></div><form id="rtdCreateForm" class="dot-card-body"><div class="dot-field-grid rtd-form-grid"><div class="dot-field"><label>Employer</label><select id="rtdEmployer" required><option value="">Select employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(rtdCompanyName(e))}${e.ctpa_id?' · C/TPA':' · Direct'}</option>`).join('')}</select></div><div class="dot-field"><label>Employee / Donor</label><select id="rtdEmployee" required><option value="">Select employer first</option></select></div><div class="dot-field"><label>Trigger</label><select id="rtdEvent"><option value="positive_drug_test">Positive drug test</option><option value="positive_alcohol_test">Positive alcohol test</option><option value="refusal_to_test">Refusal to test</option><option value="other_dot_violation">Other DOT violation</option></select></div><div class="dot-field"><label>Violation Date</label><input id="rtdViolation" type="date" required></div><div class="dot-field"><label>Priority</label><select id="rtdPriority"><option value="normal">Normal</option><option value="high" selected>High</option><option value="critical">Critical</option></select></div><div class="dot-field"><label>Compliance Due Date</label><input id="rtdDue" type="date"></div><div class="dot-field full"><label>Internal Notes</label><textarea id="rtdNotes" rows="6" placeholder="Internal workflow notes"></textarea></div></div><div class="dot-help">This creates an internal screenings4u DOT workflow. SAP evaluations, treatment recommendations, and regulated RTD testing are tracked here as documentation is received.</div><div class="rtd-page-actions"><a class="dot-btn" href="dot-return-to-duty.html">Cancel</a><button class="dot-btn primary" type="submit" id="rtdCreateSave">Create Workflow</button></div></form></div>`;
 $('#rtdViolation').value=new Date().toISOString().slice(0,10);
 const syncEmployees=()=>{const id=$('#rtdEmployer').value,opts=employees.filter(x=>String(x.employer_id)===String(id));$('#rtdEmployee').innerHTML='<option value="">Select employee</option>'+opts.map(p=>`<option value="${esc(p.id)}">${esc(rtdPersonName(p))}</option>`).join('')};$('#rtdEmployer').onchange=syncEmployees;
 $('#rtdCreateForm').onsubmit=async e=>{e.preventDefault();const btn=$('#rtdCreateSave');btn.disabled=true;btn.textContent='Creating…';try{const r=await DOTApi.call('create_rtd_workflow',{workflow:{employer_id:$('#rtdEmployer').value,employee_id:$('#rtdEmployee').value,event_type:$('#rtdEvent').value,violation_date:$('#rtdViolation').value,priority:$('#rtdPriority').value,compliance_due_at:$('#rtdDue').value||null,notes:$('#rtdNotes').value.trim(),source:'admin'}});window.DOTRouter?.navigate('dot-return-to-duty-detail.html?id='+encodeURIComponent(r.sap_case?.id||''))||void 0}catch(err){message(err.message||'Unable to create RTD workflow.','error');btn.disabled=false;btn.textContent='Create Workflow'}};
}

async function loadReturnToDutyDetail(){
 const id=new URLSearchParams(location.search).get('id')||'';
 renderBase({title:'Return-to-Duty Workflow',copy:'Review and update the internal SAP / RTD workflow.',actions:'<a class="dot-btn" href="dot-return-to-duty.html">Back to RTD</a>'});
 document.querySelector('.dot-page')?.classList.add('rtd-detail-page');
 if(!id){message('No return-to-duty workflow was selected.','error');$('#dotPageBody').innerHTML='<div class="dot-card"><div class="dot-empty">Select a workflow from Return-to-Duty / SAP.</div></div>';return}
 const d=await DOTApi.call('rtd'),cases=get(d,'sap_cases','rtd_cases'),compliance=get(d,'compliance_cases'),employers=get(d,'employers'),employees=get(d,'employees'),ctpas=get(d,'ctpas');
 const x=cases.find(v=>String(v.id)===String(id));if(!x){message('The requested return-to-duty workflow was not found.','error');$('#dotPageBody').innerHTML='<div class="dot-card"><div class="dot-empty">Workflow not found.</div></div>';return}
 const cc=compliance.find(v=>String(v.id)===String(x.compliance_case_id))||{},emp=employers.find(v=>String(v.id)===String(cc.employer_id))||{},person=employees.find(v=>String(v.id)===String(cc.employee_id))||{},ctpaMap=new Map(ctpas.map(v=>[String(v.id),v])),plan=x.follow_up_plan||{},src=rtdSource(emp,ctpaMap,plan),stage=rtdStage(x.return_to_duty_status,plan);
 $('#dotPageBody').innerHTML=`<div class="rtd-detail-page-head"><div><span class="dot-eyebrow">RETURN-TO-DUTY WORKFLOW</span><h2>${esc(cc.case_number||'RTD Case')}</h2><p>${esc(rtdPersonName(person))} · ${esc(rtdCompanyName(emp))}</p></div>${badge(x.status||'open')}</div>${rtdSteps(stage)}<div class="rtd-detail-grid"><div><span>Source</span><strong>${esc(src.label)}${src.code==='ctpa'?' · '+esc(src.name):''}</strong></div><div><span>Trigger</span><strong>${esc(String(cc.event_type||'—').replaceAll('_',' '))}</strong></div><div><span>Violation Date</span><strong>${fmtDate(cc.violation_date)}</strong></div><div><span>Current Status</span><strong>${esc(rtdStatusLabel(x.return_to_duty_status))}</strong></div></div><div class="dot-card rtd-progress-card"><div class="dot-card-head"><div><h2>Workflow Controls</h2><p>Update internal RTD milestones as documentation is received.</p></div></div><form id="rtdUpdateForm" class="dot-card-body"><div class="rtd-check-grid"><label><input type="checkbox" id="rtdInitial" ${plan.initial_evaluation_completed?'checked':''}> Initial SAP evaluation completed</label><label><input type="checkbox" id="rtdTreatment" ${plan.education_treatment_completed?'checked':''}> Education / treatment completed</label><label><input type="checkbox" id="rtdFollowEval" ${plan.follow_up_evaluation_completed?'checked':''}> Follow-up SAP evaluation completed</label><label><input type="checkbox" id="rtdTestOrdered" ${plan.rtd_test_ordered?'checked':''}> RTD test ordered</label><label><input type="checkbox" id="rtdTestComplete" ${plan.rtd_test_completed?'checked':''}> RTD test completed</label><label><input type="checkbox" id="rtdEligible" ${/eligible|returned|complete|closed/i.test(String(x.return_to_duty_status))?'checked':''}> Eligible to return to duty</label></div><div class="dot-field-grid rtd-form-grid"><div class="dot-field"><label>SAP Evaluation Date</label><input id="rtdEvalDate" type="date" value="${esc(x.evaluation_date?String(x.evaluation_date).slice(0,10):'')}"></div><div class="dot-field"><label>Workflow Status</label><select id="rtdCaseStatus"><option value="open" ${x.status==='open'?'selected':''}>Open</option><option value="in_progress" ${x.status==='in_progress'?'selected':''}>In Progress</option><option value="completed" ${x.status==='completed'?'selected':''}>Completed</option><option value="closed" ${x.status==='closed'?'selected':''}>Closed</option></select></div><div class="dot-field full"><label>SAP Recommendations / Notes</label><textarea id="rtdRecommendations" rows="7">${esc(x.recommendations||plan.notes||'')}</textarea></div></div><div class="rtd-page-actions"><a class="dot-btn" href="dot-return-to-duty.html">Cancel</a><button class="dot-btn primary" type="submit" id="rtdUpdateSave">Save Workflow</button></div></form></div>`;
 $('#rtdUpdateForm').onsubmit=async e=>{e.preventDefault();const initial=$('#rtdInitial').checked,treatment=$('#rtdTreatment').checked,follow=$('#rtdFollowEval').checked,ordered=$('#rtdTestOrdered').checked,complete=$('#rtdTestComplete').checked,eligible=$('#rtdEligible').checked;let status='sap_evaluation_pending';if(initial)status='sap_evaluation_completed';if(treatment)status='education_treatment_completed';if(follow)status='follow_up_evaluation_completed';if(ordered)status='rtd_test_ordered';if(complete)status='rtd_test_completed';if(eligible)status='eligible_to_return';const btn=$('#rtdUpdateSave');btn.disabled=true;btn.textContent='Saving…';try{await DOTApi.call('save_rtd_workflow',{id:x.id,workflow:{evaluation_date:$('#rtdEvalDate').value||null,recommendations:$('#rtdRecommendations').value.trim(),return_to_duty_status:status,status:$('#rtdCaseStatus').value,compliance_status:eligible?'resolved':'in_progress',follow_up_plan:{...plan,initial_evaluation_completed:initial,education_treatment_completed:treatment,follow_up_evaluation_completed:follow,rtd_test_ordered:ordered,rtd_test_completed:complete}}});window.DOTRouter?.refresh()}catch(err){message(err.message||'Unable to save RTD workflow.','error');btn.disabled=false;btn.textContent='Save Workflow'}};
}

async function loadIntegrations(){renderBase({title:'DOT Integrations',copy:'DOT-only external systems and data connections, isolated from the enterprise application.',actions:''});let d={};try{d=await window.DOTApi.call('integrations')}catch(e){d={integrations:[]};$('#dotPageStatus').innerHTML=`<div class="dot-banner warning"><div><strong>Integration inventory is not available yet.</strong><span>${esc(e.message)}</span></div></div>`}const rows=get(d,'integrations').map(x=>[name(x),esc(x.provider||x.integration_type||'—'),badge(x.status),fmtDate(x.updated_at)]);$('#dotPageBody').innerHTML=table(['Integration','Provider','Status','Updated'],rows)}
async function loadSettings(){renderBase({title:'DOT Portal Settings',copy:'Configuration for the standalone DOT management portal only.',actions:'<a class="dot-btn primary" href="dot-settings-general.html">Manage Settings</a>'});$('#dotPageBody').innerHTML=`<div class="dot-card"><div class="dot-card-head"><div><h2>Portal Identity</h2><p>These settings belong to the dedicated DOT control plane.</p></div></div><div class="dot-card-body"><div class="dot-field-grid"><div class="dot-field"><label>Management Host</label><input value="dot-portal.screenings4u.com" readonly></div><div class="dot-field"><label>Managed Website</label><input value="https://dot.screenings4u.com" readonly></div><div class="dot-field"><label>Portal Name</label><input id="portalName" value="screenings4u DOT Management Portal"></div><div class="dot-field"><label>Backend Adapter</label><input value="DOT-only Supabase Edge Function" readonly></div></div><div class="dot-help">No Enterprise navigation, CSS, or JavaScript files are loaded by this portal.</div></div></div>`}

function followUpPlanSource(plan,emp){
 const raw=String(plan?.source||'').toLowerCase();
 if(raw==='admin'||raw.includes('management'))return{code:'admin',label:'Admin'};
 if(raw==='ctpa'||raw.includes('c/tpa')||plan?.ctpa_id||emp?.ctpa_id)return{code:'ctpa',label:'C/TPA'};
 return{code:'direct',label:'Direct Employer'};
}
function followUpStatusLabel(v){return String(v||'active').replaceAll('_',' ').replace(/\b\w/g,m=>m.toUpperCase())}
function followUpPlanName(plan){return plan?.sap_name||plan?.sap_organization||'SAP Follow-Up Plan'}
function followUpTestDone(t){return !!t?.completed_at||/complete|completed|final_result|closed/i.test(String(t?.status||''))}
function followUpNextDate(tests){const a=tests.filter(t=>!followUpTestDone(t)&&t.scheduled_for).sort((a,b)=>String(a.scheduled_for).localeCompare(String(b.scheduled_for)));return a[0]?.scheduled_for||null}
async function loadFollowUpTesting(){
 renderBase({title:'Follow-Up Testing',copy:'Manage SAP-prescribed DOT follow-up testing plans and observed follow-up tests created by C/TPAs, direct employers, and screenings4u administrators.',actions:'<a class="dot-btn primary" href="dot-follow-up-testing-new.html">New Follow-Up Plan</a>'});
 document.querySelector('.dot-page')?.classList.add('followup-admin-page');
 const d=await DOTApi.call('follow_up_testing');
 const plans=get(d,'follow_up_plans'),tests=get(d,'follow_up_tests'),employers=get(d,'employers'),employees=get(d,'employees'),orders=get(d,'testing_orders');
 const empMap=new Map(employers.map(x=>[String(x.id),x])),personMap=new Map(employees.map(x=>[String(x.id),x])),orderMap=new Map(orders.map(x=>[String(x.id),x]));
 const rows=plans.map(plan=>{const emp=empMap.get(String(plan.employer_id))||{},person=personMap.get(String(plan.employee_id))||{},src=followUpPlanSource(plan,emp),pt=tests.filter(t=>String(t.follow_up_plan_id)===String(plan.id)),done=pt.filter(followUpTestDone),next=followUpNextDate(pt);return{plan,emp,person,src,tests:pt,done,next}});
 const active=rows.filter(x=>/active|draft|paused/i.test(String(x.plan.status))).length,completed=rows.filter(x=>/completed|closed/i.test(String(x.plan.status))).length,ctpaN=rows.filter(x=>x.src.code==='ctpa').length,directN=rows.filter(x=>x.src.code==='direct').length,adminN=rows.filter(x=>x.src.code==='admin').length;
 const trs=rows.map(x=>`<tr data-followup-row data-search="${esc([rtdPersonName(x.person),rtdCompanyName(x.emp),followUpPlanName(x.plan),x.src.label,x.plan.status,x.plan.test_type].join(' ').toLowerCase())}" data-source="${x.src.code}" data-status="${esc(String(x.plan.status||'active').toLowerCase())}"><td><strong>${esc(rtdPersonName(x.person))}</strong></td><td><strong>${esc(rtdCompanyName(x.emp))}</strong></td><td>${esc(x.src.label)}</td><td><strong>${esc(followUpPlanName(x.plan))}</strong><small>${esc(String(x.plan.test_type||'drug').replaceAll('_',' / '))}</small></td><td><strong>${esc(x.done.length)} / ${esc(x.plan.total_tests_required||'SAP plan')}</strong><small>Minimum first 12 months: ${esc(x.plan.first_12_month_test_count||6)}</small></td><td>${x.next?fmtDate(x.next):'—'}</td><td>${badge(followUpStatusLabel(x.plan.status))}</td><td><a class="dot-btn small" href="dot-follow-up-testing-detail.html?id=${encodeURIComponent(x.plan.id)}">View</a></td></tr>`).join('');
 $('#dotPageBody').innerHTML=`${metrics([['Follow-Up Plans',rows.length,'SAP-prescribed plans'],['Active',active,'Plans still being administered'],['Completed',completed,'Plans completed or closed'],['C/TPA',ctpaN,'Created through C/TPA workflows'],['Direct Employer',directN,'Created through employer workflows'],['Admin',adminN,'Created by screenings4u staff']])}<div class="dot-card followup-directory"><div class="dot-card-head"><div><h2>Follow-Up Testing Workflow Directory</h2><p>Follow-up testing is separate from random testing. Each workflow follows the written SAP plan, uses unannounced testing, and every DOT follow-up test must be directly observed.</p></div><span id="followupCount">${rows.length} plan${rows.length===1?'':'s'}</span></div><div class="dot-card-body followup-filters"><input id="followupSearch" type="search" placeholder="Search donor, employer, SAP or status"><select id="followupSource"><option value="">All sources</option><option value="ctpa">C/TPA</option><option value="direct">Direct Employer</option><option value="admin">Admin</option></select><select id="followupStatus"><option value="">All statuses</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="closed">Closed</option></select></div><div class="dot-table-wrap"><table class="dot-table followup-plan-table"><thead><tr><th>Donor</th><th>Employer</th><th>Source</th><th>SAP Plan</th><th>Progress</th><th>Next Internal Test Date</th><th>Status</th><th>View</th></tr></thead><tbody>${trs||'<tr><td colspan="8"><div class="dot-empty">No follow-up testing plans have been created yet.</div></td></tr>'}</tbody></table></div></div>`;
 const filter=()=>{const q=($('#followupSearch').value||'').toLowerCase(),src=$('#followupSource').value,st=$('#followupStatus').value;let n=0;document.querySelectorAll('[data-followup-row]').forEach(tr=>{const ok=(!q||tr.dataset.search.includes(q))&&(!src||tr.dataset.source===src)&&(!st||tr.dataset.status===st);tr.hidden=!ok;if(ok)n++});$('#followupCount').textContent=`${n} plan${n===1?'':'s'}`};['followupSearch','followupSource','followupStatus'].forEach(id=>$('#'+id)?.addEventListener(id==='followupSearch'?'input':'change',filter));
}
async function loadFollowUpTestingNew(){
 renderBase({title:'Create Follow-Up Testing Plan',copy:'Enter the written SAP follow-up testing requirements for a DOT-covered employee. This is a standalone follow-up testing workflow, not a return-to-duty case.',actions:'<a class="dot-btn" href="dot-follow-up-testing.html">Back to Follow-Up Testing</a>'});
 document.querySelector('.dot-page')?.classList.add('followup-form-page');
 const d=await DOTApi.call('follow_up_testing'),employers=get(d,'employers'),employees=get(d,'employees'),programs=get(d,'programs');
 $('#dotPageBody').innerHTML=`<div class="dot-card followup-page-card"><div class="dot-card-head"><div><span class="dot-eyebrow">SAP FOLLOW-UP PLAN</span><h2>Follow-Up Testing Workflow Setup</h2><p>The SAP determines the number, frequency, duration, and whether testing is for drugs, alcohol, or both. The employer chooses the actual unannounced test dates.</p></div></div><form id="followupPlanForm" class="dot-card-body"><div class="dot-field-grid followup-plan-form"><div class="dot-field"><label>Employer</label><select id="followupEmployer" required><option value="">Select employer</option>${employers.map(e=>`<option value="${esc(e.id)}">${esc(rtdCompanyName(e))}${e.ctpa_id?' · C/TPA':' · Direct Employer'}</option>`).join('')}</select></div><div class="dot-field"><label>Employee / Donor</label><select id="followupEmployee" required><option value="">Select employer first</option></select></div><div class="dot-field"><label>DOT Program</label><select id="followupProgram" required><option value="">Select employer first</option></select></div><div class="dot-field"><label>Testing Required</label><select id="followupType"><option value="drug">Drug</option><option value="alcohol">Alcohol</option><option value="both">Drug and Alcohol</option></select></div><div class="dot-field"><label>SAP Name</label><input id="followupSapName" placeholder="Substance Abuse Professional"></div><div class="dot-field"><label>SAP Organization</label><input id="followupSapOrg" placeholder="SAP practice / organization"></div><div class="dot-field"><label>SAP Plan Received</label><input id="followupPlanReceived" type="date"></div><div class="dot-field"><label>Returned to Safety-Sensitive Duty</label><input id="followupReturnDate" type="date"></div><div class="dot-field"><label>Tests Required in First 12 Months</label><input id="followupFirstYear" type="number" min="6" step="1" value="6" required></div><div class="dot-field"><label>Total Follow-Up Period (Months)</label><input id="followupMonths" type="number" min="12" max="60" step="1" value="12" required></div><div class="dot-field"><label>Total Tests Required</label><input id="followupTotal" type="number" min="6" step="1" placeholder="Leave blank if SAP did not state a total"></div><div class="dot-field"><label>Workflow Status</label><select id="followupPlanStatus"><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option></select></div><div class="dot-field full"><label>SAP Testing Instructions</label><textarea id="followupInstructions" rows="7" placeholder="Enter the SAP-prescribed frequency and other instructions. Do not put actual future test dates in information visible to the employee."></textarea></div></div><div class="dot-help"><strong>DOT workflow rules:</strong> at least 6 unannounced follow-up tests are required in the first 12 months; the SAP may extend testing up to 60 months; the employee must not be given the follow-up testing schedule; and every follow-up drug test must be directly observed.</div><div class="rtd-page-actions"><a class="dot-btn" href="dot-follow-up-testing.html">Cancel</a><button class="dot-btn primary" type="submit" id="followupPlanSave">Create Follow-Up Plan</button></div></form></div>`;
 const sync=()=>{const eid=$('#followupEmployer').value;$('#followupEmployee').innerHTML='<option value="">Select employee</option>'+employees.filter(x=>String(x.employer_id)===String(eid)).map(p=>`<option value="${esc(p.id)}">${esc(rtdPersonName(p))}</option>`).join('');$('#followupProgram').innerHTML='<option value="">Select DOT program</option>'+programs.filter(x=>String(x.employer_id)===String(eid)).map(p=>`<option value="${esc(p.id)}">${esc(p.name||p.dot_agency||p.id)}</option>`).join('')};$('#followupEmployer').onchange=sync;
 $('#followupPlanForm').onsubmit=async e=>{e.preventDefault();const btn=$('#followupPlanSave');btn.disabled=true;btn.textContent='Creating…';try{const r=await DOTApi.call('create_follow_up_plan',{plan:{employer_id:$('#followupEmployer').value,employee_id:$('#followupEmployee').value,program_id:$('#followupProgram').value,source:'admin',sap_name:$('#followupSapName').value.trim(),sap_organization:$('#followupSapOrg').value.trim(),sap_plan_received_date:$('#followupPlanReceived').value||null,safety_sensitive_return_date:$('#followupReturnDate').value||null,test_type:$('#followupType').value,first_12_month_test_count:Number($('#followupFirstYear').value),total_plan_months:Number($('#followupMonths').value),total_tests_required:$('#followupTotal').value?Number($('#followupTotal').value):null,instructions:$('#followupInstructions').value.trim(),status:$('#followupPlanStatus').value}});window.DOTRouter?.navigate('dot-follow-up-testing-detail.html?id='+encodeURIComponent(r.plan?.id||''))||void 0}catch(err){message(err.message||'Unable to create follow-up testing plan.','error');btn.disabled=false;btn.textContent='Create Follow-Up Plan'}};
}
async function loadFollowUpTestingDetail(){
 const id=new URLSearchParams(location.search).get('id')||'';
 renderBase({title:'Follow-Up Testing Workflow',copy:'Administer the SAP-prescribed follow-up testing plan and create unannounced directly observed test orders.',actions:'<a class="dot-btn" href="dot-follow-up-testing.html">Back to Follow-Up Testing</a>'});
 document.querySelector('.dot-page')?.classList.add('followup-detail-page');
 if(!id){$('#dotPageBody').innerHTML='<div class="dot-card"><div class="dot-empty">Select a follow-up testing plan.</div></div>';return}
 const d=await DOTApi.call('follow_up_testing'),plans=get(d,'follow_up_plans'),tests=get(d,'follow_up_tests'),employers=get(d,'employers'),employees=get(d,'employees'),orders=get(d,'testing_orders');
 const plan=plans.find(x=>String(x.id)===String(id));if(!plan){$('#dotPageBody').innerHTML='<div class="dot-card"><div class="dot-empty">Follow-up testing plan not found.</div></div>';return}
 const emp=employers.find(x=>String(x.id)===String(plan.employer_id))||{},person=employees.find(x=>String(x.id)===String(plan.employee_id))||{},src=followUpPlanSource(plan,emp),linked=tests.filter(x=>String(x.follow_up_plan_id)===String(plan.id)),orderMap=new Map(orders.map(x=>[String(x.id),x]));
 const linkedOrderIds=new Set(linked.map(x=>String(x.testing_order_id||'')).filter(Boolean));
 const portalOrders=orders.filter(o=>String(o.employer_id)===String(plan.employer_id)&&String(o.employee_id)===String(plan.employee_id)&&String(o.reason||'').toLowerCase()==='follow_up'&&!linkedOrderIds.has(String(o.id)));
 const merged=[...linked.map(t=>({kind:'linked',t,o:orderMap.get(String(t.testing_order_id||''))||{}})),...portalOrders.map((o,i)=>({kind:'portal',t:{sequence_number:linked.length+i+1,test_type:o.test_type,scheduled_for:o.collection_deadline,completed_at:o.completed_at,status:o.status,direct_observation:String(o.collection_type||'').toLowerCase().includes('observation')||o.metadata?.direct_observation===true},o}))];
 const done=merged.filter(x=>followUpTestDone(x.t)).length,required=plan.total_tests_required||plan.first_12_month_test_count||6;
 const testRows=merged.sort((a,b)=>Number(a.t.sequence_number||0)-Number(b.t.sequence_number||0)).map(x=>{const t=x.t,o=x.o||{},observed=t.direct_observation!==false;return`<tr><td>${esc(t.sequence_number||'—')}</td><td>${esc(String(t.test_type||plan.test_type||'drug').replaceAll('_',' / '))}</td><td><strong>${observed?'Yes':'Needs Review'}</strong><small>${observed?'Direct observation required': 'Verify collection method'}</small></td><td>${t.scheduled_for?fmtDate(t.scheduled_for):fmtDate(t.required_by)}</td><td>${badge(followUpStatusLabel(t.status))}</td><td>${t.completed_at?fmtDate(t.completed_at):'—'}</td><td>${o.id?`<a class="dot-btn small" href="dot-record.html?module=testing&id=${encodeURIComponent(o.id)}">View Order</a>`:'—'}</td></tr>`}).join('');
 $('#dotPageBody').innerHTML=`<div class="followup-detail-head"><div><span class="dot-eyebrow">SAP FOLLOW-UP TESTING PLAN</span><h2>${esc(rtdPersonName(person))}</h2><p>${esc(rtdCompanyName(emp))} · ${esc(src.label)}</p></div>${badge(followUpStatusLabel(plan.status))}</div><div class="followup-detail-metrics"><div><span>SAP</span><strong>${esc(followUpPlanName(plan))}</strong></div><div><span>First 12 Months</span><strong>${esc(plan.first_12_month_test_count||6)} tests minimum</strong></div><div><span>Plan Duration</span><strong>${esc(plan.total_plan_months||12)} months</strong></div><div><span>Progress</span><strong>${esc(done)} / ${esc(required)}</strong></div></div><div class="dot-card followup-plan-summary"><div class="dot-card-head"><div><h2>SAP Testing Instructions</h2><p>The SAP sets the number, frequency, duration, and drug/alcohol scope. Actual dates are chosen by the employer and must remain unannounced to the employee.</p></div></div><div class="dot-card-body"><div class="followup-summary-grid"><div><span>Testing</span><strong>${esc(String(plan.test_type||'drug').replaceAll('_',' / '))}</strong></div><div><span>SAP Plan Received</span><strong>${fmtDate(plan.sap_plan_received_date)}</strong></div><div><span>Safety-Sensitive Return Date</span><strong>${fmtDate(plan.safety_sensitive_return_date)}</strong></div><div><span>Source</span><strong>${esc(src.label)}</strong></div></div><div class="dot-help followup-instructions">${esc(plan.instructions||'No additional SAP instructions were entered.')}</div></div></div><div class="dot-card"><div class="dot-card-head"><div><h2>Follow-Up Test Workflow</h2><p>Every follow-up test created here is a DOT follow-up test, is marked unannounced, and is sent to Testing Orders as a directly observed collection.</p></div><span>${merged.length} test${merged.length===1?'':'s'}</span></div><div class="dot-table-wrap"><table class="dot-table followup-test-table"><thead><tr><th>#</th><th>Type</th><th>Observed</th><th>Internal Test Date</th><th>Status</th><th>Completed</th><th>Order</th></tr></thead><tbody>${testRows||'<tr><td colspan="7"><div class="dot-empty compact">No follow-up tests have been ordered for this plan yet.</div></td></tr>'}</tbody></table></div></div><div class="dot-card followup-order-card"><div class="dot-card-head"><div><h2>Create Next Unannounced Follow-Up Test</h2><p>This date is internal. Do not give the employee advance notice or a copy of the follow-up schedule.</p></div></div><form id="followupOrderForm" class="dot-card-body"><div class="dot-field-grid followup-order-grid"><div class="dot-field"><label>Internal Test Date / Time</label><input id="followupScheduled" type="datetime-local" required></div><div class="dot-field"><label>Test Type</label><select id="followupOrderType"><option value="drug" ${plan.test_type==='drug'?'selected':''}>Drug</option><option value="alcohol" ${plan.test_type==='alcohol'?'selected':''}>Alcohol</option><option value="both" ${plan.test_type==='both'?'selected':''}>Drug and Alcohol</option></select></div><div class="dot-field"><label>Collection Method</label><input value="Direct Observation — Required" readonly></div><div class="dot-field"><label>Reason</label><input value="DOT Follow-Up" readonly></div></div><div class="rtd-page-actions"><button class="dot-btn primary" id="followupOrderSave" type="submit">Create Testing Order</button></div></form></div>`;
 $('#followupOrderForm').onsubmit=async e=>{e.preventDefault();const btn=$('#followupOrderSave');btn.disabled=true;btn.textContent='Creating…';try{await DOTApi.call('create_follow_up_test',{follow_up:{follow_up_plan_id:plan.id,program_id:plan.program_id,scheduled_for:$('#followupScheduled').value,test_type:$('#followupOrderType').value}});window.DOTRouter?.refresh()}catch(err){message(err.message||'Unable to create follow-up test.','error');btn.disabled=false;btn.textContent='Create Testing Order'}};
}

async function loadClearinghouse(){
 renderBase({title:'FMCSA Clearinghouse',copy:'Internal readiness tracking for C/TPAs and DOT employers. Track registration, designation, query plan status, annual query dates, and account identifiers.',actions:''});
 const d=await DOTApi.call('clearinghouse');
 const tracking=get(d,'clearinghouse_tracking','clearinghouse'),ctpas=get(d,'ctpas'),employers=get(d,'employers');
 const byOrg=new Map(tracking.map(x=>[String(x.organization_id||''),x]));
 const rows=[];
 for(const c of ctpas){const t=byOrg.get(String(c.organization_id||''))||{};rows.push({kind:'ctpa',id:c.id,name:c.legal_name||c.name||c.company_code||'C/TPA',sub:'C/TPA',t})}
 for(const e of employers){const t=byOrg.get(String(e.organization_id||''))||{};rows.push({kind:'employer',id:e.id,name:e.legal_name||e.dba_name||'Employer',sub:e.ctpa_id?'C/TPA Sponsored Employer':'Direct Employer',t})}
 const registered=rows.filter(x=>x.t.registered===true).length;
 const designated=rows.filter(x=>x.kind==='employer'&&x.t.ctpa_designated===true).length;
 const attention=rows.filter(x=>x.t.registration_status&&!['registered','complete','completed'].includes(String(x.t.registration_status).toLowerCase())).length;
 const bodyRows=rows.map(x=>'<tr data-clearing-row data-type="'+esc(x.kind)+'" data-search="'+esc([x.name,x.sub,x.t.registration_status,x.t.clearinghouse_account_identifier,x.t.query_plan_status].join(' ').toLowerCase())+'"><td><strong>'+esc(x.name)+'</strong><small>'+esc(x.sub)+'</small></td><td>'+badge(x.t.registration_status||(x.t.registered?'registered':'not started'))+'</td><td>'+esc(x.t.clearinghouse_account_identifier||'—')+'</td><td>'+(x.kind==='employer'?(x.t.ctpa_designated?'Yes':'No'):'—')+'</td><td>'+esc(x.kind==='employer'?(x.t.query_plan_status||'unknown'):'Not required')+'</td><td>'+fmtDate(x.t.annual_query_due_date)+'</td></tr>').join('');
 $('#dotPageBody').innerHTML=metrics([['Tracked Accounts',rows.length,'C/TPAs and DOT employers'],['Registered',registered,'Clearinghouse registration confirmed'],['C/TPA Designated',designated,'Employer designation recorded'],['Needs Attention',attention,'Incomplete or pending setup']])+'<div class="dot-card"><div class="dot-card-head"><div><h2>Clearinghouse Readiness</h2><p>Internal readiness tracking only. Do not store Clearinghouse passwords or credentials here.</p></div><span id="clearingCount">'+rows.length+' accounts</span></div><div class="dot-card-body"><div class="dot-filter-row"><input id="clearingSearch" type="search" placeholder="Search company, type, identifier or status"><select id="clearingType"><option value="">All account types</option><option value="ctpa">C/TPA</option><option value="employer">Employer</option></select></div></div><div class="dot-table-wrap"><table class="dot-table"><thead><tr><th>Account</th><th>Registration</th><th>Identifier</th><th>C/TPA Designated</th><th>Query Plan</th><th>Annual Query Due</th></tr></thead><tbody>'+(bodyRows||'<tr><td colspan="6"><div class="dot-empty">No DOT Clearinghouse accounts found.</div></td></tr>')+'</tbody></table></div></div>';
 const filter=()=>{const q=($('#clearingSearch')?.value||'').toLowerCase(),ty=$('#clearingType')?.value||'';let n=0;document.querySelectorAll('[data-clearing-row]').forEach(tr=>{const ok=(!q||tr.dataset.search.includes(q))&&(!ty||tr.dataset.type===ty);tr.hidden=!ok;if(ok)n++});if($('#clearingCount'))$('#clearingCount').textContent=n+' account'+(n===1?'':'s')};
 $('#clearingSearch')?.addEventListener('input',filter);$('#clearingType')?.addEventListener('change',filter);
}
async function load(){if(page==='dot-ctpas.html')return loadCtpas();if(page==='dot-orders.html')return loadOrders();if(page==='dot-recent-orders.html')return loadRecentOrders();if(page==='dot-recent-subscriptions.html')return loadRecentSubscriptions();if(page==='dot-programs.html')return loadPrograms();if(page==='dot-pools.html')return loadPools();if(page==='dot-random-selections.html')return loadSelections();if(page==='dot-testing-orders.html')return loadTestingOrders();if(page==='dot-results.html')return loadResults();if(page==='dot-compliance.html')return loadCompliance();if(page==='dot-clearinghouse.html')return loadClearinghouse();if(page==='dot-return-to-duty.html')return loadReturnToDuty();if(page==='dot-return-to-duty-new.html')return loadReturnToDutyNew();if(page==='dot-return-to-duty-detail.html')return loadReturnToDutyDetail();if(page==='dot-follow-up-testing.html')return loadFollowUpTesting();if(page==='dot-follow-up-testing-new.html')return loadFollowUpTestingNew();if(page==='dot-follow-up-testing-detail.html')return loadFollowUpTestingDetail();if(listPages[page])return loadList(listPages[page]);if(page==='dot-dashboard.html')return loadManagementHome();if(page==='dot-website.html')return loadWebsite();if(page==='dot-portal-control.html')return loadPortalControl();if(page==='dot-agencies.html')return loadAgencies();if(page==='dot-integrations.html')return loadIntegrations();if(page==='dot-settings.html')return loadSettings();renderBase({title:'DOT Management',copy:'Standalone DOT management workspace.'});$('#dotPageBody').innerHTML='<div class="dot-card"><div class="dot-empty">This DOT module is ready for its dedicated controller.</div></div>'}
async function start(){const state=await window.DOTAuth.requireAuth();if(!state)return;window.DOTShell.render(state);await load()}
window.addEventListener('DOMContentLoaded',()=>start().catch(showError),{once:true});
})();
