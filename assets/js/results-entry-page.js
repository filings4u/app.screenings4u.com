(async () => {
  'use strict';
  const authState = await window.DOTAuth.requireAuth();
  if (!authState) return;
  window.DOTShell.render(authState);
  const mount = document.getElementById('dotPageMount');
  if (!mount) throw Error('Page container is missing');
  const $ = id => document.getElementById(id);
  const parameters = new URLSearchParams(location.search);
  const source = parameters.get('source') === 'dot' ? 'dot' : 'nondot';
  const backend = source === 'dot' ? 'management-dot-mro-results' : 'management-nondot-mro-results';
  const base = 'https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/';
  const supabase = window.dotSupabase;
  if (!supabase) throw Error('Management sign-in is unavailable');
  const call = async (name, payload) => {
    const request = async (token) => {
      const response = await fetch(base + name, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          apikey: 'sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC',
          authorization: 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => ({}));
      return {response, body};
    };
    let {data:{session},error:sessionError} = await supabase.auth.getSession();
    if(sessionError || !session) throw Error('Your management session has expired. Please sign in again.');
    let result = await request(session.access_token);
    if(result.response.status === 401) {
      const refreshed = await supabase.auth.refreshSession();
      if(refreshed.error || !refreshed.data.session) {
        throw Error('Your management session has expired. Please sign in again.');
      }
      result = await request(refreshed.data.session.access_token);
    }
    if(!result.response.ok || result.body.error)
      throw Error(result.body.error || 'Request failed (' + result.response.status + ')');
    return result.body;
  };
  const api = payload => call(backend, payload);
  const documents = payload => call('management-mro-documents', {
    ...payload, source, employer_id: $('employer').value
  });
  mount.innerHTML = `<div class="dot-page results-editor re-redesign">
  <header class="re-hero"><div><span class="dot-eyebrow">RESULTS MANAGEMENT / ${source==='dot'?'DOT':'NON-DOT'}</span><h1>MRO Results Workspace</h1><p>Create donor-specific results, attach official reports, and review before publishing.</p></div><a class="re-back" href="/results-management.html">← All Results</a></header>
  <div class="re-workflow-strip" aria-label="Results processing stages"><div><b>1</b><span>Choose employer</span></div><div><b>2</b><span>Verify donor</span></div><div><b>3</b><span>Attach MRO PDF</span></div><div><b>4</b><span>Review & publish</span></div></div><div id="resultsFeedback" class="re-feedback" role="status" aria-live="polite">Loading employer records…</div>
  <section class="re-panel re-employer"><div class="re-section-title"><span class="re-step">01</span><div><h2>Select employer</h2><p>All results and documents are restricted to this employer.</p></div></div><div class="re-fields"><label class="re-wide">Employer<select id="employer"><option value="">Choose employer</option></select></label></div></section>
  <div class="re-workspace">
   <section class="re-panel re-donor"><div class="re-section-title"><span class="re-step">02</span><div><h2>Donor information</h2><p>One donor and one official MRO PDF per record.</p></div></div>
    <div class="re-fields"><label class="re-wide">Existing employee (optional)<select id="employeeSelect"><option value="">Choose employee</option></select></label><label>First name *<input id="firstName" autocomplete="off"></label><label>Middle initial<input id="middleInitial" maxlength="1"></label><label>Last name *<input id="lastName" autocomplete="off"></label><label>Date of birth *<input type="date" id="birthdate"></label><label>CDL number<input id="cdlNumber"></label><label>State ID number<input id="stateIdNumber"></label><label>Test date *<input type="date" id="testDate"></label><label>Test result<select id="mroResult"><option value="">Pending MRO</option><option>Negative</option><option>Positive</option></select></label><label>Workflow stage<select id="workflowStage"><option>Ordered</option><option>Processing</option><option>At Lab</option><option>MRO Confirmation</option></select></label></div>
    <div class="re-upload-panel"><div class="re-section-title"><span class="re-step">03</span><div><h2>Donor's official MRO PDF</h2><p>Verify the donor name on the PDF before attaching it. Maximum 10 MB.</p></div></div><label class="re-wide">Choose PDF for this donor<input id="pdf" type="file" accept=".pdf,application/pdf"></label><div id="selectedDocument" class="re-document-info">No PDF selected.</div></div>
    <div id="employeeHistory" hidden></div><div class="re-actions"><button id="add" type="button">Add donor to review</button><button id="downloadTemplate" type="button" class="re-secondary">Download CSV template</button><label class="re-upload">Import donors CSV/XLSX<input id="sheet" type="file" accept=".xlsx,.xls,.csv"></label></div>
   </section>
   <section class="re-panel re-review"><div class="re-review-highlight"><strong>Submission review</strong><span>Results are not sent until you choose Publish.</span></div><div class="re-section-title"><span class="re-step">04</span><div><h2>Review before sending</h2><p>Every donor must have an individual PDF. No results are delivered until you confirm publishing.</p></div></div><p id="donorCount" class="re-counter">0 donors ready for review</p><div id="rows" class="re-donor-review-list" aria-label="Donors awaiting publication"></div>
   <div class="re-bottom"><div class="re-submit"><button id="saveDraft" type="button" class="re-secondary">Save draft</button><button id="publish" type="button">Publish donor results</button></div></div>
   </section>
  </div>
  <section class="re-panel re-published"><div class="re-section-title"><span class="re-step">05</span><div><h2>Saved drafts</h2><p>Resume unfinished submissions before publishing.</p></div></div><div id="draftList" role="region" aria-label="Saved donor drafts"></div><div class="re-records-link"><a id="viewMroRecords" href="/mro-records.html?source=${source}&amp;employer_id=${encodeURIComponent(parameters.get('employer_id')||'')}">View published MRO records →</a></div></section>
  <div hidden><span id="publishedCount"></span><table><tbody id="publishedRows"></tbody></table></div>
 </div>`;
  const feedback = (message, kind = 'info') => {
    const el = $('resultsFeedback');
    el.textContent = message;
    el.dataset.kind = kind;
    if (kind !== 'info') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const emailStatus = value => ({
    sent: 'Accepted by email provider; delivery not confirmed',
    failed: 'Email request failed',
    no_email: 'No email notification sent'
  })[value] || 'Email status unavailable';
  const validDob = (dob, test) => /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    /^\d{4}-\d{2}-\d{2}$/.test(test) && dob >= '1900-01-01' &&
    dob < test && test <= new Date().toISOString().slice(0, 10);
  $('birthdate').max = $('testDate').max = new Date().toISOString().slice(0, 10);
  let employees = [];let rows = [], previewURL = null, editingIndex = -1, publishedRecords = [], activeDraftId = null, activeDocument = null; const donorFiles = new Map();
  const donorKey = r => [String(r.cdl_number||r.state_id_number||r.identity_number||'').trim().toUpperCase(),String(r.test_date||'')].join('|');
  const sameDonor = (a,b) => donorKey(a) === donorKey(b);
  const setEditor = (r,index) => {
    editingIndex=index;$('employeeSelect').value=r.employee_id||'';
    for(const [field,key] of [['firstName','first_name'],['middleInitial','middle_initial'],['lastName','last_name'],['birthdate','birthdate'],['cdlNumber','cdl_number'],['stateIdNumber','state_id_number'],['testDate','test_date'],['mroResult','result']]) $(field).value=r[key]||'';
    $('pdf').value=''; $('selectedDocument').textContent=r.document_name ? 'Attached: '+r.document_name : 'Select this donor’s official MRO PDF';
    $('add').textContent='Update Donor';
    feedback('Editing donor details. Click Update Donor to save changes in the list.');
    $('firstName').focus();
  };
  const clearEditor = () => {
    editingIndex=-1;$('add').textContent='Add Donor';
    for(const id of ['firstName','middleInitial','lastName','birthdate','cdlNumber','stateIdNumber']) $(id).value='';
    $('mroResult').value=''; $('pdf').value=''; $('selectedDocument').textContent='No PDF selected.';
  };
  const cell = (tr, value = '') => {
    const td = document.createElement('td');
    td.textContent = value == null || value === '' ? '—' : String(value);
    tr.append(td); return td;
  };
  const select = (values, current, emptyLabel = null) => {
    const el = document.createElement('select');
    for (const v of values) el.add(new Option(v || emptyLabel || 'Select', v));
    el.value = current || ''; return el;
  };
  const render = () => {
    const body=$('rows');body.replaceChildren();
    $('donorCount').textContent=rows.length+' donor(s) ready for review';
    if(!rows.length){const empty=document.createElement('div');empty.className='re-review-empty';empty.textContent='No donors added yet. Complete the donor information and attach an MRO PDF to begin.';body.append(empty);return}
    rows.forEach((r,i)=>{
      const card=document.createElement('article');card.className='re-review-donor';
      const top=document.createElement('div');top.className='re-review-donor-top';
      const identity=document.createElement('div');const heading=document.createElement('h3');heading.textContent=[r.first_name,r.middle_initial,r.last_name].filter(Boolean).join(' ');
      const details=document.createElement('p');details.textContent='Test date: '+(r.test_date||'—')+' • ID: '+(r.cdl_number||r.state_id_number||'—')+' • DOB: '+(r.birthdate||'—');
      identity.append(heading,details);const actions=document.createElement('div');actions.className='re-review-donor-actions';
      const edit=document.createElement('button');edit.type='button';edit.className='re-secondary';edit.textContent='Edit donor';edit.onclick=()=>{setEditor(r,i);$('firstName').scrollIntoView({behavior:'smooth',block:'center'})};
      const remove=document.createElement('button');remove.type='button';remove.className='re-secondary';remove.textContent='Remove';remove.onclick=()=>{donorFiles.delete(r);rows.splice(i,1);render();feedback('Donor removed from review list.')};
      actions.append(edit,remove);top.append(identity,actions);
      const lower=document.createElement('div');lower.className='re-review-donor-bottom';
      const pdf=document.createElement('div');pdf.className='re-review-pdf';const status=document.createElement('strong');status.textContent=r.document_name?'MRO PDF attached':'MRO PDF missing';const filename=document.createElement('span');filename.textContent=r.document_name||'Select a PDF by editing this donor';pdf.append(status,filename);
      const resultBox=document.createElement('label');resultBox.textContent='Test result';const result=select(['','Negative','Positive'],r.result,'Pending MRO');result.onchange=()=>{r.result=result.value||null};resultBox.append(result);lower.append(pdf,resultBox);card.append(top,lower);body.append(card);
    });
  };
  $('add').onclick = () => {
    const r = {
      first_name: $('firstName').value.trim(),middle_initial: $('middleInitial').value.trim(),
      last_name: $('lastName').value.trim(),birthdate: $('birthdate').value,
      cdl_number: $('cdlNumber').value.trim(),state_id_number: $('stateIdNumber').value.trim(),
      test_date: $('testDate').value,result: $('mroResult').value || null,employee_id:$('employeeSelect').value||null
    };
    if (!r.first_name || !r.last_name || !validDob(r.birthdate, r.test_date) || (!r.cdl_number && !r.state_id_number)) {
      feedback('Complete first and last names, birthdate, test date, and CDL or State ID.', 'error');return;
    }
    if(rows.some((x,i)=>i!==editingIndex&&sameDonor(x,r))){feedback('This donor and test date are already in the unsaved list. Edit the existing donor instead.','error');return}
    if(publishedRecords.some(x=>sameDonor(x,r))){feedback('This donor and test date already have a published record. Edit the published record instead.','error');return}
    if (rows.length >= 200 && editingIndex === -1) {feedback('Maximum 200 donors per submission.', 'error');return}
    const editing=editingIndex>=0;
    const file=$('pdf').files[0];
    const previous=editing?rows[editingIndex]:null;
    if(!file&&!previous?.document_path&&!donorFiles.has(previous)){feedback('Select the official MRO PDF for this donor before adding.', 'error');return}
    if(previous){r.document_path=previous.document_path||'';r.document_name=previous.document_name||'';const oldFile=donorFiles.get(previous);if(oldFile)donorFiles.set(r,oldFile);donorFiles.delete(previous)}
    if(file){r.document_path='';r.document_name=file.name;donorFiles.set(r,file)}
    if(editing)rows[editingIndex]=r;else rows.push(r);
    render();clearEditor();feedback(editing?'Donor updated in the unsaved list.':'Donor added to the unsaved list.', 'success');
  };
  $('pdf').onchange = () => {
    if (previewURL) URL.revokeObjectURL(previewURL);
    const file = $('pdf').files[0],target = $('selectedDocument');target.replaceChildren();
    if (!file) {target.textContent = 'No PDF selected.';return}
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10485760) {
      $('pdf').value='';target.textContent='No valid PDF selected.';feedback('Official MRO document must be a PDF, maximum 10 MB.', 'error');return;
    }
    previewURL = URL.createObjectURL(file);
    const link = document.createElement('a');link.href = previewURL;link.target = '_blank';link.rel = 'noopener';
    link.textContent = 'Preview selected PDF: ' + file.name;
    target.append(link, ' — selected locally; upload occurs on Save.');
  };
  $('downloadTemplate').onclick = () => {
    const columns = ['First Name *','Middle Initial','Last Name *','Birthdate *','CDL Number','State ID Number','Test Date *'];
    const file = new Blob([columns.join(',') + '\r\n'], {type:'text/csv'});
    const url = URL.createObjectURL(file),link = document.createElement('a');
    link.href=url;link.download='donor-results-template.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    feedback('Spreadsheet template download started.', 'success');
  };
  $('sheet').onchange = async () => {
    try {
      const file = $('sheet').files[0];if (!file) return;
      if (!window.XLSX) throw Error('Spreadsheet importer unavailable');
      const wb = XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const items = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
      const date = v => v instanceof Date ? v.toISOString().slice(0,10) : String(v||'').slice(0,10);
      const imported = items.map(x=>({
        first_name:String(x['First Name *']||x['First Name']||'').trim(),
        middle_initial:String(x['Middle Initial']||'').trim(),
        last_name:String(x['Last Name *']||x['Last Name']||'').trim(),
        birthdate:date(x['Birthdate *']||x['Birthdate']),
        cdl_number:String(x['CDL Number']||'').trim(),state_id_number:String(x['State ID Number']||'').trim(),
        test_date:date(x['Test Date *']||x['Test Date']),result:null
      }));
      if (!imported.length || rows.length+imported.length > 200 || imported.some(x=>!x.first_name||!x.last_name||!validDob(x.birthdate,x.test_date)||(!x.cdl_number&&!x.state_id_number))) throw Error('Spreadsheet has invalid donor data or exceeds 200 donors');
      const keys=[...rows,...imported].map(donorKey);
      if(new Set(keys).size!==keys.length)throw Error('Spreadsheet contains duplicate donors for the same test date.');
      if(imported.some(r=>publishedRecords.some(p=>sameDonor(p,r))))throw Error('One or more donors have already been published for this test date. Edit their published results instead.');
      rows.push(...imported);render();feedback(`${imported.length} donors imported into unsaved list.`, 'success');
    } catch(e) {feedback(e.message,'error')}
  };
  const upload = async (file) => {
    if (!file) throw Error('Donor PDF missing');
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 10485760) throw Error('PDF required, max 10MB');
    feedback('Uploading official MRO PDF…');
    const data = await api({action:'prepare',employer_id:$('employer').value,filename:file.name});
    if (!data.path || !data.upload_url) throw Error('Upload URL not provided');
    const response = await fetch(data.upload_url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});
    if (!response.ok) throw Error('MRO PDF upload failed');
    return {document_path:data.path,document_name:file.name};
  };
  const uploadDonorDocuments = async () => {
    for(const row of rows){
      const file=donorFiles.get(row);
      if(file){const saved=await upload(file);row.document_path=saved.document_path;row.document_name=saved.document_name;donorFiles.delete(row)}
      if(!row.document_path)throw Error('Each donor must have an individual MRO PDF: '+row.first_name+' '+row.last_name);
    }
    if(new Set(rows.map(r=>r.document_path)).size!==rows.length)throw Error('MRO PDF is assigned to more than one donor.');
  };
  async function loadPublished() {
    const employer_id = $('employer').value;if (!employer_id) return;
    const [response, metadata] = await Promise.all([
      api({action:'published',employer_id}),
      documents({action:'list'}).catch(e=>({records:[],metadata_error:e.message}))
    ]);
    const meta = new Map((metadata.records||[]).map(x=>[x.id,x]));
    const published = response.records||[],body=$('publishedRows');publishedRecords=published;body.replaceChildren();
    $('publishedCount').textContent=published.length+' published donors';
    for (const r of published) {
      const m=meta.get(r.id)||{},tr=document.createElement('tr');
      const name=[r.first_name,r.middle_initial,r.last_name].filter(Boolean).join(' ')||r.donor_name||'Donor';
      cell(tr,name);cell(tr,r.birthdate);cell(tr,r.cdl_number||r.state_id_number||r.identity_number);cell(tr,r.test_date);
      const result=select(['','Negative','Positive'],r.result,'Pending MRO');cell(tr,'').replaceChildren(result);
      const stage=select(['Ordered','Processing','At Lab','MRO Confirmation'],r.workflow_stage||'Ordered');cell(tr,'').replaceChildren(stage);
      const docCell=cell(tr,'');
      if (m.has_document || r.document_path) {
        const button=document.createElement('button');button.type='button';button.textContent='View';button.className='re-secondary';
        button.onclick=async()=>{
          // Open on the direct click to avoid popup blockers; never render confidential PDF into public HTML.
          const viewer=window.open('about:blank','_blank');button.disabled=true;
          try {const v=await documents({action:'view',id:r.id});if(!v.url)throw Error('PDF link unavailable');
            if(viewer)viewer.location.replace(v.url);else feedback('Enable pop-ups to open the PDF.','error');
          }catch(e){if(viewer)viewer.close();feedback(e.message,'error')}
          finally{button.disabled=false}
        };
        docCell.replaceChildren(button,document.createTextNode(' '+(m.document_name||r.document_name||'')));
      } else docCell.textContent=r.document_name ? `${r.document_name} (document link unavailable)` : 'No attached document';
      const save=document.createElement('button');save.type='button';save.textContent='Save Changes';
      save.onclick=async()=>{save.disabled=true;try{
        const update=await api({action:'update_published',employer_id,id:r.id,changes:{result:result.value||null,workflow_stage:stage.value}});
        if(!update.ok)throw Error('Save not confirmed');feedback(`Changes saved for ${name}.`, 'success');
      }catch(e){feedback(e.message,'error')}finally{save.disabled=false}};
      const actions=cell(tr,'');const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:8px;flex-wrap:wrap;align-items:center';
      const remove=document.createElement('button');remove.type='button';remove.textContent='Delete';remove.className='re-delete-result';remove.style.cssText='background:#b42318;border:1px solid #b42318;border-radius:7px;color:#fff;font-weight:700;padding:8px 12px;cursor:pointer';
      remove.onclick=async()=>{const confirmed=await window.DOTDialog.confirm('Permanently delete the published result for '+name+'? This cannot be undone.',{title:'Delete Published Result',confirmText:'Delete Result',cancelText:'Cancel',danger:true});if(!confirmed)return;remove.disabled=true;save.disabled=true;try{const deleted=await api({action:'delete_published',employer_id,id:r.id,confirm_delete:true});if(!deleted.ok)throw Error('Deletion was not confirmed');await loadPublished();feedback('Deleted published result for '+name+'.','success')}catch(e){feedback(e.message||String(e),'error');remove.disabled=false;save.disabled=false}};
      const replace=document.createElement('button');replace.type='button';replace.textContent='Replace MRO PDF';replace.className='re-secondary';
      replace.onclick=async()=>{
        if(!await window.DOTDialog.confirm('Replace the official MRO PDF for '+name+' (test date '+r.test_date+')? Verify the corrected document matches this donor.',{title:'Confirm donor PDF replacement',confirmText:'Select corrected PDF'}))return;
        const picker=document.createElement('input');picker.type='file';picker.accept='.pdf,application/pdf';picker.style.display='none';document.body.append(picker);
        picker.onchange=async()=>{const file=picker.files[0];picker.remove();if(!file)return;replace.disabled=true;try{
          if(!file.name.toLowerCase().endsWith('.pdf')||file.size>10485760)throw Error('Select a PDF under 10 MB');
          const prepared=await api({action:'prepare',employer_id:$('employer').value,filename:file.name});
          if(!prepared.path||!prepared.upload_url)throw Error('PDF upload unavailable');
          const uploaded=await fetch(prepared.upload_url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});
          if(!uploaded.ok)throw Error('PDF upload failed');
          const changed=await documents({action:'replace',id:r.id,confirm_donor_id:r.id,confirm_donor_name:name,confirm_test_date:r.test_date,document_path:prepared.path,document_name:file.name});
          if(!changed.ok)throw Error('Replacement not confirmed');
          await loadPublished();feedback('Corrected MRO PDF saved for '+name+'. Verify the employer portal before sending a notification.','success');
        }catch(e){feedback(e.message,'error')}finally{replace.disabled=false}};
        picker.click();
      };
      buttons.append(replace);
      buttons.append(save,remove);actions.append(buttons);body.append(tr);
    }
    if(metadata.metadata_error) feedback('Results loaded. Document/status service unavailable: '+metadata.metadata_error,'error');
  }
  async function offerNotification(ids,employer_id){
    if(!ids?.length){feedback('Results published. No result IDs returned for email notification.','error');return false}
    if(!await window.DOTDialog.confirm('Results are saved in the customer portal. Send the employer an email notification now?',{title:'Send customer notification',confirmText:'Send Email'})){
      feedback('Results published to portal. Email notification was not sent.','success');return false;
    }
    try{const response=await api({action:'send_notification',employer_id,ids});
      if(!response.ok)throw Error('Email request not confirmed');
      feedback('Results published. Email accepted by provider; delivery not confirmed.','success');return true;
    }catch(e){feedback('Results published to portal, but email was not sent: '+e.message,'error');return false}
  }
  async function loadDrafts(){
    const employer_id=$('employer').value,container=$('draftList');container.replaceChildren();
    if(!employer_id)return;
    const response=await api({action:'drafts',employer_id});
    const drafts=response.drafts||[];
    if(!drafts.length){container.textContent='No saved drafts.';return}
    for(const draft of drafts){
      const row=document.createElement('div');row.className='re-draft-row';
      const info=document.createElement('span');info.textContent=(draft.records?.length||0)+' donor(s) • '+(draft.records||[]).filter(x=>!!x.document_path).length+' attached PDF(s) • Saved draft';
      const edit=document.createElement('button');edit.type='button';edit.textContent='Load & Edit';
      edit.onclick=()=>{activeDraftId=draft.id;activeDocument=null;donorFiles.clear();$('pdf').value='';$('selectedDocument').textContent='No PDF selected.';rows=(draft.records||[]).map(x=>({...x}));render();$('workflowStage').value=draft.workflow_stage||'Ordered';feedback('Draft loaded. Edit donor information, then Save Draft or Publish.','success');window.scrollTo({top:0,behavior:'smooth'})};
      const send=document.createElement('button');send.type='button';send.textContent='Publish & Email';
      send.onclick=async()=>{if((draft.records||[]).some(r=>!r.document_path)||new Set((draft.records||[]).map(r=>r.document_path)).size!==(draft.records||[]).length){feedback('Legacy draft uses shared or missing MRO PDFs. Load and attach a separate PDF to each donor before publishing.','error');return}if(!await window.DOTDialog.confirm('Publish this saved draft and request an email notification?',{title:'Publish saved donor results',confirmText:'Publish & Notify'}))return;send.disabled=true;try{
        await loadPublished();if((draft.records||[]).some(r=>publishedRecords.some(p=>sameDonor(r,p))))throw Error('One or more donor test results are already published. No duplicate results or emails were created.');
        const result=await api({action:'push_draft',employer_id,draft_id:draft.id});
        if(!result.ok)throw Error('Publish was not confirmed');
        activeDraftId=null;activeDocument=null;rows=[];render();await loadPublished();
        feedback((result.count||0)+' donor(s) published to customer portal.','success');const delivered=await offerNotification(result.ids,employer_id);
        if(delivered){const cleared=await api({action:'delete_draft',employer_id,draft_id:draft.id});if(!cleared.ok)throw Error('Notification sent, but draft cleanup failed.');feedback('Notification accepted; completed draft removed.','success')}
        else feedback('Results published. Draft retained until notification is sent or you delete it.');
        await loadDrafts();
      }catch(e){feedback(e.message,'error')}finally{send.disabled=false}};
      const remove=document.createElement('button');remove.type='button';remove.textContent='Delete Draft';remove.className='re-secondary';remove.onclick=async()=>{if(!await window.DOTDialog.confirm('Permanently delete this saved draft? This cannot be undone.',{title:'Delete Draft',confirmText:'Delete Draft',cancelText:'Cancel',danger:true}))return;remove.disabled=true;try{const result=await api({action:'delete_draft',employer_id,draft_id:draft.id});if(!result.ok)throw Error('Draft deletion was not confirmed');if(activeDraftId===draft.id){activeDraftId=null;activeDocument=null;rows=[];render()}await loadDrafts();feedback('Draft deleted. No notification was sent.','success')}catch(e){feedback(e.message,'error');remove.disabled=false}};
      row.append(info,edit,send,remove);container.append(row)
    }
  }
  $('employer').onchange=()=>{ $('viewMroRecords').href='/mro-records.html?source='+encodeURIComponent(source)+'&employer_id='+encodeURIComponent($('employer').value);donorFiles.clear();$('pdf').value='';$('selectedDocument').textContent='No PDF selected.';rows=[];employees=[];activeDraftId=null;editingIndex=-1;render();$('employeeHistory').hidden=true;Promise.all([loadPublished(),loadDrafts(),loadEmployees()]).catch(e=>feedback(e.message,'error'))};
  $('saveDraft').onclick=async()=>{const button=$('saveDraft');button.disabled=true;
    try{if(!$('employer').value||!rows.length)throw Error('Choose employer and add donors');
      await uploadDonorDocuments();const result=await api({action:'save_draft',employer_id:$('employer').value,rows,draft_id:activeDraftId||undefined,workflow_stage:$('workflowStage').value});
      if(!result.ok)throw Error('Draft save not confirmed');activeDraftId=null;activeDocument=null;rows=[];render();await loadDrafts();feedback('Draft saved successfully. No customer notification was sent.','success');
    }catch(e){feedback(e.message,'error')}finally{button.disabled=false}
  };
  $('publish').onclick=async()=>{
    if(!await window.DOTDialog.confirm('Publish these donor results to the customer portal and request an email notification?',{title:'Publish donor results',confirmText:'Publish & Notify'}))return;
    const button=$('publish');button.disabled=true;
    try{if(!$('employer').value||!rows.length)throw Error('Choose employer and add donors');
      await loadPublished();
      if(rows.some(r=>publishedRecords.some(p=>sameDonor(r,p))))throw Error('Donor/test date already published. Edit the existing record; no new email was sent.');
      await uploadDonorDocuments();feedback('Publishing individually assigned donor results…');
      const result=await api({action:'publish',employer_id:$('employer').value,rows,workflow_stage:$('workflowStage').value});
      if(!result.ok)throw Error('Publishing was not confirmed');
      rows=[];donorFiles.clear();activeDraftId=null;activeDocument=null;render();$('pdf').value='';$('selectedDocument').textContent='No PDF selected.';
      await loadPublished();await loadDrafts();feedback(`${result.count||0} donor results published to the portal. Each MRO PDF is assigned to its donor.`, 'success');await offerNotification(result.ids,$('employer').value);
    }catch(e){feedback(e.message,'error')}finally{button.disabled=false}
  };
async function loadEmployees(){employees=[];const pick=$('employeeSelect');pick.replaceChildren(new Option('Choose existing employee',''));if(!$('employer').value)return;const data=await api({action:'employees',employer_id:$('employer').value});employees=data.employees||[];for(const e of employees)pick.add(new Option([e.first_name,e.middle_name,e.last_name].filter(Boolean).join(' '),e.id));const target=parameters.get('employee_id');if(target&&employees.some(e=>e.id===target)){pick.value=target;pick.dispatchEvent(new Event('change'));}}
$('employeeSelect').onchange=()=>{const e=employees.find(x=>x.id===$('employeeSelect').value);if(!e)return;$('firstName').value=e.first_name||'';$('middleInitial').value=(e.middle_name||'').slice(0,1);$('lastName').value=e.last_name||'';$('birthdate').value=e.date_of_birth||'';};
  render();
  try {
    const response=await api({action:'employers'});
    for(const employer of response.employers||[]){const opt=new Option(employer.legal_name+' — '+(employer.primary_contact_email||'No contact email'),employer.id);$('employer').add(opt)}
    const selected=parameters.get('employer_id');
    if(selected&&[...$('employer').options].some(x=>x.value===selected)){$('employer').value=selected;$('employer').disabled=true}
    if($('employer').value)await Promise.all([loadPublished(),loadDrafts(),loadEmployees()]);
    feedback('Ready to enter donor results. Published records are available on the separate MRO Records page.');
  }catch(e){feedback(e.message,'error')}
})().catch(error=>{const mount=document.getElementById('dotPageMount');if(mount)mount.textContent=error.message||String(error)});
