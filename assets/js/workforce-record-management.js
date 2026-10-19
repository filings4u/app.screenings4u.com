/* Workforce NON-DOT dedicated record management */
(()=>{
"use strict";
const $=s=>document.querySelector(s),esc=v=>DOTShell.escape(v),params=new URLSearchParams(location.search),module=params.get('module')||'',id=params.get('id')||'',isNew=params.get('mode')==='new'||!id;
const configs={
 ctpa:{title:'C/TPA',read:'ctpas',key:'ctpas',save:'save_ctpa',payload:'ctpa',back:'workforce-ctpas.html',fields:[['legal_name','Legal Name'],['dba_name','DBA Name'],['support_email','Support Email','email'],['support_phone','Support Phone'],['status','Status','select',['active','onboarding','inactive']]]},
 employer:{title:'Employer',read:'employers',key:'employers',save:'save_employer',payload:'employer',back:'workforce-employers.html',fields:[['legal_name','Legal Name'],['dba_name','DBA Name'],['ctpa_id','C/TPA ID'],['primary_contact_email','Primary Email','email'],['phone','Phone'],['status','Status','select',['active','onboarding','inactive']]]},
 person:{title:'Person',read:'people',key:'people',save:'save_employee',payload:'employee',back:'workforce-people.html',fields:[['employer_id','Employer ID'],['first_name','First Name'],['last_name','Last Name'],['email','Email','email'],['mobile','Mobile'],['job_title','Job Title'],['employment_status','Status','select',['active','pending_enrollment','inactive']]]},
 program:{title:'Program',read:'programs',key:'programs',save:'save_program',payload:'program',back:'workforce-programs.html',fields:[['employer_id','Employer ID'],['name','Program Name'],['status','Status','select',['active','inactive']]]},
 pool:{title:'Pool',read:'pools',key:'pools',save:'save_pool',payload:'pool',back:'workforce-pools.html',fields:[['name','Pool Name'],['employer_id','Employer ID'],['ctpa_id','C/TPA ID'],['selection_frequency','Selection Frequency'],['status','Status','select',['active','inactive']]]},
 selection:{title:'Random Selection',read:'selections',key:'selections',save:'update_selection',back:'workforce-selections.html',fields:[['status','Status','select',['draft','completed','locked','cancelled']],['selection_date','Selection Date','datetime-local']]},
 testing:{title:'Testing Order',read:'testing',key:'testing_orders',save:'update_test_order',back:'workforce-testing.html',fields:[['status','Status','select',['created','assigned','notified','scheduled','collected','completed','cancelled']],['testing_panel','Testing Panel'],['collection_type','Collection Type'],['collection_deadline','Collection Deadline','datetime-local']]},
 result:{title:'Test Result',read:'results',key:'test_results',save:'update_result',back:'workforce-results.html',fields:[['preliminary_status','Preliminary Status'],['mro_status','MRO Status'],['final_status','Final Status'],['notification_status','Notification Status'],['result_date','Result Date','datetime-local']]},
 compliance:{title:'Compliance Case',read:'compliance',key:'compliance_cases',save:'save_compliance_case',payload:'case',back:'workforce-compliance.html',fields:[['employer_id','Employer ID'],['case_number','Case Number'],['status','Status'],['priority','Priority'],['summary','Summary','textarea']]},
 service:{title:'Service',read:'services',key:'service_offerings',save:'save_service_offering',back:'workforce-services.html',fields:[['active','Status','select',['true','false']],['purchase_mode','Purchase Mode']]},
 billing:{title:'Subscription',read:'billing',key:'subscriptions',save:'update_subscription',back:'workforce-billing.html',fields:[['status','Status']]},
 notification:{title:'Notification',read:'notifications',key:'notifications',save:'update_notification',back:'workforce-notifications.html',fields:[['status','Status']]},
 integration:{title:'Integration',read:'integrations',key:'integrations',save:'save_integration',payload:'integration',back:'workforce-integrations.html',fields:[['name','Name'],['provider','Provider'],['integration_type','Integration Type'],['status','Status']]},
 support:{title:'Support Ticket',read:'support',key:'support_tickets',save:'update_support_ticket',back:'workforce-support.html',fields:[['status','Status'],['priority','Priority'],['reply','Staff Reply','textarea']]},
 staff:{title:'Staff Access',read:'staff',key:'staff_access',save:'set_staff_access',back:'workforce-staff.html',fields:[['user_id','User ID'],['access_level','Access Level','select',['view','standard','manager','admin']],['assigned_customers_only','Assigned Customers Only','select',['false','true']],['active','Active','select',['true','false']]]},
 setting:{title:'Setting',read:'settings',key:'settings',save:'save_setting',back:'workforce-settings.html',fields:[['key','Key'],['label','Label'],['category','Category'],['value_type','Value Type'],['value','Value','textarea'],['description','Description','textarea']]},
 document:{title:'Document',read:'documents',key:'documents',back:'workforce-documents.html',fields:[]},
 website_page:{title:'Website Page',siteKey:'pages',save:'save_website_page',payload:'page',back:'workforce-website.html',fields:[['title','Page Title'],['slug','Slug'],['path','URL Path'],['page_type','Page Type'],['status','Status','select',['draft','published','archived']],['content_html','Page Content / HTML','textarea'],['seo_title','SEO Title'],['seo_description','Meta Description','textarea'],['canonical_url','Canonical URL'],['noindex','Noindex','select',['false','true']]]},
 website_pricing:{title:'Website Pricing',siteKey:'pricing',save:'save_website_pricing',payload:'pricing',back:'workforce-website.html',fields:[['name','Name'],['code','Code'],['category','Category'],['description','Description','textarea'],['amount','Amount','number'],['billing_period','Billing Period'],['active','Active','select',['true','false']],['sort_order','Sort Order','number'],['cta_label','CTA Label'],['cta_url','CTA URL'],['features','Features (one per line)','textarea']]},
 website_redirect:{title:'Website Redirect',siteKey:'redirects',save:'save_website_redirect',payload:'redirect',back:'workforce-website.html',fields:[['source_path','Source Path'],['target_url','Destination URL'],['status_code','Redirect Type','select',['301','302','307','308']],['active','Active','select',['true','false']],['notes','Notes','textarea']]},
 website_seo:{title:'Website SEO',siteKey:'seo',save:'save_website_seo',payload:'seo',back:'workforce-website.html',fields:[['scope_type','Scope','select',['site','page']],['scope_key','Scope Key'],['title_template','Title / Template'],['meta_description','Meta Description','textarea'],['canonical_url','Canonical URL'],['robots_index','Index','select',['true','false']],['robots_follow','Follow','select',['true','false']],['og_title','Open Graph Title'],['og_description','Open Graph Description','textarea'],['og_image_url','Open Graph Image URL']]},
 blog:{title:'Blog Post',siteKey:'blog_posts',save:'save_blog_post',payload:'post',back:'workforce-website.html',fields:[['title','Title'],['slug','Slug'],['excerpt','Excerpt','textarea'],['content_html','Content HTML','textarea'],['author_name','Author'],['status','Status','select',['draft','published','archived']],['seo_title','SEO Title'],['seo_description','SEO Description','textarea'],['canonical_url','Canonical URL']]}
};
const c=configs[module];
const bool=v=>v===true||String(v)==='true';
const val=v=>v??'';
const dateVal=v=>v?String(v).slice(0,10):'';
const dt=v=>v?new Date(v).toLocaleString():'—';
const input=(f,row)=>{const [name,label,type='text',opts=[]]=f;let v=row?.[name]??'';if(module==='ctpa'&&name==='legal_name')v=row?.organizations?.legal_name||row?.legal_name||'';if(module==='ctpa'&&name==='dba_name')v=row?.organizations?.dba_name||'';if(module==='employer'&&name==='legal_name')v=row?.organizations?.legal_name||row?.legal_name||'';if(module==='employer'&&name==='dba_name')v=row?.organizations?.dba_name||'';if(name==='content_html'&&module==='website_page')v=row?.content_json?.html||'';if(type==='datetime-local'&&v)v=String(v).slice(0,16);if(type==='textarea')return `<div class="nd-field nd-field-wide"><label>${esc(label)}</label><textarea name="${name}" rows="8">${esc(v)}</textarea></div>`;if(type==='select')return `<div class="nd-field"><label>${esc(label)}</label><select name="${name}">${opts.map(o=>`<option value="${esc(o)}" ${String(v)===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;return `<div class="nd-field"><label>${esc(label)}</label><input name="${name}" type="${type}" value="${esc(v)}"></div>`};
const field=(name,label,value='',type='text',opts=[],wide=false,help='')=>{
 const cls='nd-field'+(wide?' nd-field-wide':'');
 if(type==='textarea')return `<div class="${cls}"><label>${esc(label)}</label><textarea name="${name}" rows="5">${esc(val(value))}</textarea>${help?`<small>${esc(help)}</small>`:''}</div>`;
 if(type==='select')return `<div class="${cls}"><label>${esc(label)}</label><select name="${name}">${opts.map(o=>{const ov=Array.isArray(o)?o[0]:o,ol=Array.isArray(o)?o[1]:o;return `<option value="${esc(ov)}" ${String(value??'')===String(ov)?'selected':''}>${esc(ol)}</option>`}).join('')}</select>${help?`<small>${esc(help)}</small>`:''}</div>`;
 return `<div class="${cls}"><label>${esc(label)}</label><input name="${name}" type="${type}" value="${esc(val(value))}">${help?`<small>${esc(help)}</small>`:''}</div>`;
};
const check=(name,label,checked=false,value='true',help='')=>`<label class="nd-check nd-customer-check"><input type="checkbox" name="${name}" value="${esc(value)}" ${checked?'checked':''}><span><strong>${esc(label)}</strong>${help?`<small>${esc(help)}</small>`:''}</span></label>`;
const message=(text,bad=false)=>{const n=$('#recordMessage');if(!n)return;n.className='nd-page-message '+(bad?'error':'success');n.innerHTML=`<strong>${bad?'Action failed':'Saved'}</strong><span>${esc(text)}</span>`;n.hidden=false;window.scrollTo({top:0,behavior:'smooth'})};

async function load(){
 if(!c){location.href='workforce-dashboard.html';return}
 if(module==='ctpa'||module==='employer'){
   const bundle=await WorkforceManagementApi.read('customer_record',{target_type:module,id:isNew?'':id});
   renderCustomer(bundle);return;
 }
 let row={};
 if(!isNew){if(module==='support'){const d=await WorkforceManagementApi.read('support_detail',{id});renderSupport(d);return}else if(c.siteKey){const d=await WorkforceManagementApi.read('website_management');row=(d[c.siteKey]||[]).find(x=>x.id===id)||{}}else{const d=await WorkforceManagementApi.read(c.read);row=(d[c.key]||[]).find(x=>x.id===id)||{}}}
 render(row)
}

function renderCustomer(bundle){
 const rec=bundle.record||{},org=bundle.organization||{},on=bundle.onboarding||{},sub=(bundle.subscriptions||[])[0]||{},access=bundle.portal_access||[],plans=bundle.plans||[],portals=bundle.portals||[],events=bundle.profile_events||[],payments=bundle.payments||[],members=bundle.memberships||[],users=bundle.users||[];
 const title=module==='ctpa'?'C/TPA':'Employer',back=module==='ctpa'?'workforce-ctpas.html':'workforce-employers.html';
 const selectedAccess=new Set(access.filter(x=>x.enabled).map(x=>x.portal_code));
 const portalMap=new Map(portals.map(p=>[p.metadata?.access_code,p]));
 const relevantCodes=module==='ctpa'?['ctpa_workforce','ctpa_employer_workforce','ctpa_employee_workforce','ctpa_driver_workforce']:(rec.ctpa_id||on?.metadata?.ctpa_id?['ctpa_employer_workforce','ctpa_employee_workforce','ctpa_driver_workforce']:['employer_workforce','employee_workforce']);
 const primaryEmail=on.contact_email||org.primary_email||rec.primary_contact_email||rec.support_email||'';
 const primaryPhone=on.contact_phone||org.phone||rec.phone||rec.support_phone||'';
 const planOpts=[['','No subscription selected'],...plans.map(p=>[p.id,`${p.name} — $${Number(p.monthly_price||0).toFixed(2)}/mo`])];
 const ctpaOpts=[['','Direct employer / no C/TPA'],...(bundle.parent_ctpas||[]).map(x=>[x.id,x.organization?.legal_name||x.organization?.dba_name||x.id])];
 const profileSource=org.profile_source||rec.profile_source||'legacy',revision=Number(org.profile_revision||rec.profile_revision||1);
 const syncText=isNew?'New management record':`${profileSource.replaceAll('_',' ')} · revision ${revision}`;
 const paymentTotal=payments.reduce((n,p)=>n+Number(p.amount||0),0);
 const activeMembers=members.filter(m=>m.status==='active').length;

 $('#dotPageMount').innerHTML=`<section class="nd-page nd-customer-record">
  <div class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE NON-DOT MANAGEMENT</span><h1>${isNew?'Create':'Manage'} ${title}</h1><p>Maintain the complete customer record used across NON-DOT management, billing, subscriptions, and customer portals.</p></div><div class="nd-actions"><a class="nd-btn" href="${back}">Back</a>${!isNew&&selectedAccess.size?`<a class="nd-btn" href="workforce-portal-detail.html?organization_id=${esc(rec.organization_id)}">Portal Access</a>`:''}<button class="nd-btn primary" type="submit" form="customerRecordForm">Save ${title}</button></div></div>
  <div id="recordMessage" class="nd-page-message" hidden></div>
  ${!isNew?`<div class="nd-account-hero"><div><span class="nd-status-dot active"></span><div><strong>${esc(org.legal_name||rec.legal_name||title)}</strong><small>${esc(syncText)} · last updated ${esc(dt(org.profile_source_updated_at||org.updated_at))}</small></div></div><div class="nd-inline-actions"><span class="nd-badge">${esc(rec.status||org.status||'active')}</span></div></div>`:''}
  <nav class="nd-account-nav" aria-label="Record sections"><a href="#business">Business</a><a href="#contacts">Contacts</a><a href="#address">Address</a><a href="#billing">Billing</a><a href="#subscription">Subscription</a><a href="#portals">Portal Access</a><a href="#onboarding">Onboarding</a>${!isNew?'<a href="#sync">Sync & Activity</a>':''}</nav>
  <form id="customerRecordForm">
    <input type="hidden" name="expected_revision" value="${esc(revision)}">
    <section id="business" class="nd-account-section"><div class="nd-section-heading"><div><span>01</span><h2>Business Details</h2><p>Legal and operational information shared throughout the NON-DOT system.</p></div></div><div class="nd-card"><div class="nd-card-body"><div class="nd-field-grid">
      ${field('legal_name','Legal Name',org.legal_name||rec.legal_name,'text',[],false,'Required. This is the primary organization name used throughout the portals.')}
      ${field('dba_name','DBA / Trade Name',org.dba_name||rec.dba_name)}
      ${field('ein','EIN',org.ein||rec.ein)}
      ${field('business_type','Business Type',on.business_type||rec.business_type)}
      ${field('website','Website',org.website||rec.website,'url')}
      ${field('organization_status','Organization Status',org.status||'active','select',[['active','Active'],['inactive','Inactive'],['suspended','Suspended']])}
      ${field('status',`${title} Status`,rec.status||'active','select',[['active','Active'],['onboarding','Onboarding'],['inactive','Inactive']])}
      ${module==='employer'?field('employee_count','Employee Count',rec.employee_count||0,'number'):''}
      ${module==='employer'?field('timezone','Timezone',rec.timezone||'America/Chicago'):''}
      ${module==='employer'?field('ctpa_id','Sponsored by C/TPA',rec.ctpa_id||'','select',ctpaOpts):''}
    </div>${module==='ctpa'?`<div class="nd-profile-flags">${check('white_label_enabled','White-label enabled',bool(rec.white_label_enabled),'true','Allow this C/TPA to use approved white-label portal settings.')}</div>`:''}</div></div></section>

    <section id="contacts" class="nd-account-section"><div class="nd-section-heading"><div><span>02</span><h2>Contacts</h2><p>Primary, support, HR, safety, and billing contacts used across workflows and notifications.</p></div></div><div class="nd-card"><div class="nd-card-body"><div class="nd-form-subhead">Primary Contact</div><div class="nd-field-grid">
      ${field('primary_contact_first_name','First Name',on.first_name||'')}${field('primary_contact_middle_initial','Middle Initial',on.middle_initial||'')}${field('primary_contact_last_name','Last Name',on.last_name||'')}
      ${field('primary_contact_email','Email',primaryEmail,'email')}${field('primary_contact_phone','Phone',primaryPhone,'tel')}
      ${module==='ctpa'?field('support_email','Support Email',rec.support_email||primaryEmail,'email'):''}${module==='ctpa'?field('support_phone','Support Phone',rec.support_phone||primaryPhone,'tel'):''}
    </div>${module==='employer'?`<div class="nd-form-subhead">Additional Contacts</div><div class="nd-field-grid">${field('safety_manager_name','Safety Manager',rec.safety_manager_name)}${field('safety_manager_email','Safety Manager Email',rec.safety_manager_email,'email')}${field('hr_contact_name','HR Contact',rec.hr_contact_name)}${field('hr_contact_email','HR Contact Email',rec.hr_contact_email,'email')}${field('billing_contact_name','Billing Contact Name',rec.billing_contact_name)}${field('billing_contact_email','Billing Contact Email',rec.billing_contact_email||on.billing_contact_email,'email')}</div>`:''}</div></div></section>

    <section id="address" class="nd-account-section"><div class="nd-section-heading"><div><span>03</span><h2>Business Address</h2><p>Primary business address used by the account and operational records.</p></div></div><div class="nd-card"><div class="nd-card-body"><div class="nd-field-grid">
      ${field('address_line1','Address Line 1',org.address_line1||rec.address_line1)}${field('address_line2','Address Line 2',org.address_line2||rec.address_line2)}${field('city','City',org.city||rec.city)}${field('state','State / Region',org.state_region||rec.state)}${field('postal_code','Postal Code',org.postal_code||rec.postal_code)}${field('country','Country',org.country||rec.country||'US')}
    </div></div></div></section>

    <section id="billing" class="nd-account-section"><div class="nd-section-heading"><div><span>04</span><h2>Billing Information</h2><p>Billing contact and remittance address. Subscription purchases remain the authoritative billing source when newer.</p></div></div><div class="nd-card"><div class="nd-card-body"><div class="nd-field-grid">
      ${field('billing_contact_email','Billing Email',on.billing_contact_email||rec.billing_contact_email||'','email')}${field('billing_contact_phone','Billing Phone',on.billing_contact_phone||rec.billing_phone||'','tel')}
    </div><div class="nd-profile-flags">${check('billing_same_as_company','Billing address is the same as company address',on.billing_same_as_company!==false,'true')}</div><div class="nd-form-subhead">Billing Address</div><div class="nd-field-grid">
      ${field('billing_address_line1','Billing Address Line 1',on.billing_address_line1||rec.billing_address_line1)}${field('billing_address_line2','Billing Address Line 2',on.billing_address_line2||rec.billing_address_line2)}${field('billing_city','Billing City',on.billing_city||rec.billing_city)}${field('billing_state','Billing State',on.billing_state||rec.billing_state)}${field('billing_postal_code','Billing Postal Code',on.billing_postal_code||rec.billing_postal_code)}${field('billing_country','Billing Country',on.billing_country||rec.billing_country||'US')}
    </div></div></div></section>

    <section id="subscription" class="nd-account-section"><div class="nd-section-heading"><div><span>05</span><h2>Subscription & Purchase</h2><p>Current plan and billing lifecycle. New customer purchases create newer subscription records and become the current plan.</p></div></div><div class="nd-grid"><div class="nd-card" style="grid-column:span 8"><div class="nd-card-body"><div class="nd-field-grid">
      ${field('plan_id','Plan',sub.plan_id||'','select',planOpts)}${field('subscription_status','Subscription Status',sub.status||'active','select',[['trial','Trial'],['active','Active'],['past_due','Past Due'],['suspended','Suspended'],['cancelled','Cancelled'],['expired','Expired']])}${field('billing_frequency','Billing Frequency',sub.billing_frequency||'monthly','select',[['monthly','Monthly'],['annual','Annual']])}${field('subscription_start_date','Start Date',dateVal(sub.start_date),'date')}${field('subscription_renewal_date','Renewal Date',dateVal(sub.renewal_date),'date')}${field('subscription_notes','Internal Subscription Notes',sub.notes||'','textarea',[],true)}
    </div></div></div><div class="nd-card third"><div class="nd-card-head"><div><h2>Billing Snapshot</h2><p>Read-only current activity.</p></div></div><div class="nd-card-body"><div class="nd-kpi-list"><div class="nd-kpi-row"><span>Payments</span><strong>${payments.length}</strong></div><div class="nd-kpi-row"><span>Recorded total</span><strong>$${paymentTotal.toFixed(2)}</strong></div><div class="nd-kpi-row"><span>Members</span><strong>${activeMembers}</strong></div><div class="nd-kpi-row"><span>Stripe subscription</span><strong>${sub.stripe_subscription_id?'Connected':'—'}</strong></div></div></div></div></div></section>

    <section id="portals" class="nd-account-section"><div class="nd-section-heading"><div><span>06</span><h2>Portal Access</h2><p>Grant the customer access to the NON-DOT portals that apply to this account.</p></div><a class="nd-btn small" href="workforce-portal-control.html">Open Portal Control</a></div><div class="nd-card"><div class="nd-card-body"><div class="nd-portal-access-grid">${relevantCodes.map(code=>{const p=portalMap.get(code);return check('portal_codes',p?.name||code,selectedAccess.has(code),code,p?.hostname||'NON-DOT portal')}).join('')}</div></div></div></section>

    <section id="onboarding" class="nd-account-section"><div class="nd-section-heading"><div><span>07</span><h2>Onboarding & Account State</h2><p>Track completion and required acknowledgements for the customer account.</p></div></div><div class="nd-card"><div class="nd-card-body"><div class="nd-profile-flags">${check('onboarding_completed','Onboarding completed',bool(on.completed))}${check('acknowledged_portal','Portal acknowledged',bool(on.acknowledged_portal))}${check('acknowledged_support','Support acknowledged',bool(on.acknowledged_support))}${check('acknowledged_billing','Billing acknowledged',bool(on.acknowledged_billing))}${check('acknowledged_subscription','Subscription acknowledged',bool(on.acknowledged_subscription))}</div><div class="nd-form-subhead">Management Notes</div>${field('management_notes','Internal Notes',on.metadata?.management_notes||'','textarea',[],true,'Internal management notes are not shown to customers.')}</div></div></section>

    ${!isNew?`<section id="sync" class="nd-account-section"><div class="nd-section-heading"><div><span>08</span><h2>Sync & Activity</h2><p>Source-of-truth history for management, portal, and purchase updates.</p></div></div><div class="nd-grid"><div class="nd-card half"><div class="nd-card-head"><div><h2>Current Source</h2><p>Newest accepted customer profile revision.</p></div></div><div class="nd-card-body"><div class="nd-detail-grid"><div><span>Current Source</span><strong>${esc(profileSource)}</strong></div><div><span>Revision</span><strong>${revision}</strong></div><div><span>Source Updated</span><strong>${esc(dt(org.profile_source_updated_at))}</strong></div><div><span>Last Management Update</span><strong>${esc(dt(org.last_management_update_at))}</strong></div><div><span>Last Portal Update</span><strong>${esc(dt(org.last_portal_update_at))}</strong></div><div><span>Last Purchase</span><strong>${esc(dt(org.last_purchase_at))}</strong></div></div></div></div><div class="nd-card half"><div class="nd-card-head"><div><h2>Recent Profile Activity</h2><p>Newest event wins when records are synchronized.</p></div></div><div class="nd-card-body">${events.length?events.slice(0,8).map(e=>`<div class="nd-audit-row"><div><strong>${esc(String(e.event_type||'update').replaceAll('_',' '))}</strong><small>${esc(e.source||'system')} · revision ${esc(e.changed_fields?.revision||'—')}</small></div><span>${esc(dt(e.source_updated_at))}</span></div>`).join(''):'<div class="nd-empty compact">No profile sync events yet.</div>'}</div></div></div></section>`:''}

    <div class="nd-form-actions nd-customer-savebar"><button class="nd-btn primary" type="submit">Save ${title}</button><a class="nd-btn" href="${back}">Cancel</a></div>
  </form>
 </section>`;

 $('#customerRecordForm').onsubmit=async e=>{
   e.preventDefault();
   const fd=new FormData(e.currentTarget),data=Object.fromEntries(fd.entries());
   data.portal_codes=fd.getAll('portal_codes');
   for(const key of ['white_label_enabled','billing_same_as_company','onboarding_completed','acknowledged_portal','acknowledged_support','acknowledged_billing','acknowledged_subscription'])data[key]=fd.has(key);
   data.expected_revision=Number(data.expected_revision||0);
   if(module==='employer')data.employee_count=Number(data.employee_count||0);
   try{
     const payload={};payload[module]={...data,...(!isNew?{id}:{})};
     const result=await WorkforceManagementApi.write(c.save,payload);
     const saved=result[module];
     message(`${title} record saved. Revision ${result.profile_revision||1} is now current.`);
     if(isNew&&saved?.id)setTimeout(()=>location.href=`workforce-record.html?module=${module}&id=${encodeURIComponent(saved.id)}`,450);
     else setTimeout(()=>load().catch(()=>{}),350);
   }catch(err){
     const msg=err?.message||'Unable to save customer record.';
     message(msg,true);
   }
 };
}

function renderSupport(bundle){
 const t=bundle.ticket||{},messages=bundle.messages||[],attachments=bundle.attachments||[],byMessage=new Map(),ticketFiles=[];
 for(const a of attachments){if(a.message_id){if(!byMessage.has(a.message_id))byMessage.set(a.message_id,[]);byMessage.get(a.message_id).push(a)}else ticketFiles.push(a)}
 const files=xs=>xs.length?`<div class="nd-support-files">${xs.map(a=>`<button class="nd-btn small" type="button" data-support-file="${esc(a.id)}">Open: ${esc(a.file_name||'Attachment')}</button>`).join('')}</div>`:'';
 $('#dotPageMount').innerHTML=`<section class="nd-page"><div class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE NON-DOT MANAGEMENT</span><h1>Support Ticket</h1><p>${esc(t.ticket_number||'Ticket')} · ${esc(t.subject||'')}</p></div><div class="nd-actions"><a class="nd-btn" href="workforce-support.html">Back</a></div></div><div id="recordMessage" class="nd-page-message" hidden></div><div class="nd-grid"><div class="nd-card" style="grid-column:span 8"><div class="nd-card-head"><div><h2>Conversation</h2><p>Employer and Workforce NON-DOT support messages.</p></div></div><div class="nd-card-body">${files(ticketFiles)}<div class="nd-support-thread">${messages.length?messages.map(m=>`<article class="nd-support-message ${m.sender_type==='staff'?'staff':'customer'}"><div><strong>${m.sender_type==='staff'?'Workforce NON-DOT Staff':'Employer'}</strong><small>${esc(dt(m.created_at))}</small></div><p>${esc(m.body||'')}</p>${files(byMessage.get(m.id)||[])}</article>`).join(''):`<article class="nd-support-message customer"><div><strong>Employer</strong><small>${esc(dt(t.created_at))}</small></div><p>${esc(t.message||'')}</p></article>`}</div></div></div><div class="nd-card third"><div class="nd-card-head"><div><h2>Ticket Controls</h2><p>Update status, priority, and reply.</p></div></div><div class="nd-card-body"><form id="supportManagementForm"><div class="nd-field-grid">${field('status','Status',t.status||'open','select',[['open','Open'],['in_progress','In Progress'],['waiting_customer','Waiting on Customer'],['resolved','Resolved'],['closed','Closed']])}${field('priority','Priority',t.priority||'normal','select',[['low','Low'],['normal','Normal'],['high','High'],['urgent','Urgent']])}${field('reply','Staff Reply','','textarea',[],true)}</div><div class="nd-form-actions"><button class="nd-btn primary" type="submit">Save / Send Reply</button></div></form></div></div></div></section>`;
 document.querySelectorAll('[data-support-file]').forEach(b=>b.onclick=async()=>{try{const d=await WorkforceManagementApi.write('support_attachment_url',{attachment_id:b.dataset.supportFile});window.open(d.url,'_blank','noopener,noreferrer')}catch(e){message(e.message,true)}});
 $('#supportManagementForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget).entries());try{await WorkforceManagementApi.write('update_support_ticket',{ticket_id:id,status:f.status,priority:f.priority});if(f.reply?.trim())await WorkforceManagementApi.write('support_reply',{ticket_id:id,message:f.reply.trim(),status:f.status});message('Support ticket updated.');setTimeout(()=>load(),300)}catch(err){message(err.message,true)}};
}

async function openSecureDocument(row){
 const d=await WorkforceManagementApi.write('document_signed_url',{document_id:id});
 if(!d?.url)throw Error('Secure file link unavailable.');
 const type=String(row.mime_type||'').toLowerCase();
 if(type==='text/html'||['.html','.htm'].some(ext=>String(row.file_name||'').toLowerCase().endsWith(ext))){
   const response=await fetch(d.url,{cache:'no-store'});
   if(!response.ok)throw Error('Unable to load the secure HTML document.');
   const html=await response.text();
   let overlay=document.getElementById('ndDocumentPreview');
   if(!overlay){
     overlay=document.createElement('div');overlay.id='ndDocumentPreview';
     overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(5,25,50,.75);padding:24px;display:flex;flex-direction:column;gap:10px';
     const toolbar=document.createElement('div');toolbar.style.cssText='background:#fff;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:12px';
     const title=document.createElement('strong');title.textContent=row.file_name||'Secure Document';
     const close=document.createElement('button');close.className='nd-btn';close.textContent='Close Preview';close.onclick=()=>overlay.remove();
     toolbar.append(title,close);
     const frame=document.createElement('iframe');frame.title='Secure document preview';frame.setAttribute('sandbox','');frame.setAttribute('referrerpolicy','no-referrer');frame.style.cssText='flex:1;width:100%;border:0;background:white;border-radius:10px';
     overlay.append(toolbar,frame);document.body.append(overlay);
   }
   overlay.querySelector('iframe').srcdoc=html;
   return;
 }
 window.open(d.url,'_blank','noopener');
}
function render(row){
 const actions=`<a class="nd-btn" href="${c.back}">Back</a>${module==='document'&&!isNew?'<button class="nd-btn primary" id="openDoc">Open Secure File</button><button class="nd-btn" id="archiveDoc">Archive Document</button>':''}`;
 $('#dotPageMount').innerHTML=`<section class="nd-page"><div class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE NON-DOT MANAGEMENT</span><h1>${isNew?'Create': 'Manage'} ${esc(c.title)}</h1><p>${isNew?'Create a new record.':'Review and manage this record.'}</p></div><div class="nd-actions">${actions}</div></div><div id="recordMessage" class="nd-page-message" hidden></div><div class="nd-card"><div class="nd-card-head"><div><h2>${esc(c.title)} Details</h2><p>${isNew?'Enter the required information.':'Record ID: '+esc(id)}</p></div></div><div class="nd-card-body">${module==='document'?`<div class="nd-detail-grid">${[['File Name',row.file_name],['Document Type',row.document_type],['Access Level',row.access_level],['Uploaded',row.uploaded_at],['File Type',row.mime_type],['Size (bytes)',row.size_bytes],['Document ID',row.id]].map(([k,v])=>`<div><span>${esc(k)}</span><strong>${esc(v??'—')}</strong></div>`).join('')}</div><p style="margin:20px 0 0;color:#52677f">Use Open Secure File to preview the approved document in a protected viewer. Archive Document removes it from active listings; it does not edit the original file.</p>`:`<form id="recordForm"><div class="nd-field-grid">${c.fields.map(f=>input(f,row)).join('')}</div><div class="nd-form-actions"><button class="nd-btn primary" type="submit">Save ${esc(c.title)}</button></div></form>`}</div></div></section>`;
 if(module==='document'){if($('#openDoc'))$('#openDoc').onclick=async()=>{try{await openSecureDocument(row)}catch(e){message(e.message,true)}};if($('#archiveDoc'))$('#archiveDoc').onclick=async()=>{try{await WorkforceManagementApi.write('archive_document',{document_id:id});message('Document archived.')}catch(e){message(e.message,true)}};return}
 if(module==='person'&&!isNew){const mount=document.querySelector('.nd-page');const section=document.createElement('section');section.className='nd-card';section.style.marginTop='20px';section.innerHTML='<div class="nd-card-head"><div><h2>Drug Testing History</h2><p>All test results linked to this employee</p></div></div><div class="nd-card-body" id="employeeTestHistory">Loading testing history…</div>';mount.append(section);(async()=>{try{const {data:{session}}=await dotSupabase.auth.getSession();if(!session)throw Error('Sign in required');const response=await fetch('https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/management-nondot-mro-results',{method:'POST',headers:{'content-type':'application/json',apikey:DOT_PORTAL_CONFIG.supabaseAnonKey,authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'employee_profile',employer_id:row.employer_id,employee_id:id})});const payload=await response.json();if(!response.ok)throw Error(payload.error||'Unable to load history');const host=document.getElementById('employeeTestHistory');host.replaceChildren();const tests=payload.tests||[];const note=document.createElement('p');note.textContent=tests.length+' linked testing records';host.append(note);const table=document.createElement('table');table.className='wf-table';const head=document.createElement('tr');for(const label of ['Type','Test date','Result','Workflow','MRO document']){const th=document.createElement('th');th.textContent=label;head.append(th)}table.append(head);for(const t of tests){const tr=document.createElement('tr');for(const value of [t.test_type,t.test_date,t.result||'Pending',t.workflow_stage||'—',t.document_name||'—']){const td=document.createElement('td');td.textContent=value;tr.append(td)}table.append(tr)}host.append(table);const a=document.createElement('a');a.className='nd-btn primary';a.textContent='Add Test Result';a.href='results-entry.html?source=nondot&employer_id='+encodeURIComponent(row.employer_id)+'&employee_id='+encodeURIComponent(id);host.append(a)}catch(e){document.getElementById('employeeTestHistory').textContent=e.message}})();}
 $('#recordForm').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.currentTarget).entries());for(const k of ['active','assigned_customers_only','noindex','robots_index','robots_follow'])if(k in f)f[k]=f[k]==='true';if(module==='website_pricing'&&f.features)f.features=f.features.split('\n').map(x=>x.trim()).filter(Boolean);try{let payload={};if(c.payload)payload[c.payload]={...f,...(!isNew?{id}:{})};else if(module==='selection')payload={selection_id:id,...f};else if(module==='testing')payload={testing_order_id:id,...f};else if(module==='result')payload={result_id:id,...f};else if(module==='service')payload={offering_id:id,active:f.active,purchase_mode:f.purchase_mode};else if(module==='billing')payload={subscription_id:id,status:f.status};else if(module==='notification')payload={notification_id:id,status:f.status};else if(module==='support'){payload={ticket_id:id,status:f.status,priority:f.priority};await WorkforceManagementApi.write(c.save,payload);if(f.reply?.trim())await WorkforceManagementApi.write('support_reply',{ticket_id:id,message:f.reply.trim(),status:f.status});message('Support ticket updated.');return}else if(module==='staff')payload=f;else payload=f;await WorkforceManagementApi.write(c.save,payload);message(`${c.title} saved successfully.`);if(isNew)setTimeout(()=>location.href=c.back,500)}catch(e){message(e.message,true)}};
}
document.addEventListener('DOMContentLoaded',async()=>{try{const auth=await DOTAuth.requireAuth();if(!auth)return;DOTShell.render(auth);await load()}catch(e){document.getElementById('dotPageMount').textContent=e.message||String(e)}},{once:true});
})();
