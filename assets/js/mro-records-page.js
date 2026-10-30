(async()=>{'use strict';
const authState=await window.DOTAuth.requireAuth();if(!authState)return;
window.DOTShell.render(authState);
const mount=document.getElementById('dotPageMount');if(!mount)throw Error('Page container missing');
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),source=params.get('source')==='dot'?'dot':'nondot';
const backend=source==='dot'?'management-dot-mro-results':'management-nondot-mro-results';
const base='https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/';
const call=async(name,payload)=>{
 const client=window.dotSupabase;if(!client)throw Error('Management sign-in unavailable');
 const send=async token=>{const response=await fetch(base+name,{method:'POST',headers:{'content-type':'application/json',apikey:'sb_publishable_xVI6Mjkk1bNVMGHZCPuK6w_8FSHKdkC',authorization:'Bearer '+token},body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));return {response,body}};
 const session=await client.auth.getSession();if(!session.data.session)throw Error('Please sign in again');
 let result=await send(session.data.session.access_token);
 if(result.response.status===401){const refresh=await client.auth.refreshSession();if(refresh.error||!refresh.data.session)throw Error('Please sign in again');result=await send(refresh.data.session.access_token)}
 if(!result.response.ok||result.body.error)throw Error(result.body.error||'Request failed');return result.body;
};
const api=payload=>call(backend,payload);
const documents=payload=>call('management-mro-documents',{...payload,source,employer_id:$('employer').value});
mount.innerHTML=`<div class="dot-page results-editor re-redesign re-records-page">
<header class="re-hero"><div><span class="dot-eyebrow">RESULTS MANAGEMENT / ${source==='dot'?'DOT':'NON-DOT'}</span><h1>MRO Records</h1><p>Review published donor records, open official documents, and correct individual results.</p></div><a class="re-back" id="backToEntry" href="/results-entry.html">+ Enter new results</a></header>
<div id="resultsFeedback" class="re-feedback" role="status" aria-live="polite">Loading published records…</div>
<section class="re-panel"><div class="re-section-title"><span class="re-step">01</span><div><h2>Select employer</h2><p>Only this employer's published results will appear.</p></div></div><div class="re-fields"><label class="re-wide">Employer<select id="employer"><option value="">Choose employer</option></select></label></div></section>
<section class="re-panel re-published" style="margin-top:20px"><div class="re-section-title"><span class="re-step">02</span><div><h2>Published MRO records</h2><p id="publishedCount">Loading…</p><p>Review, replace a donor's MRO PDF, or update their testing status. Do not create duplicate results.</p></div></div>
<div class="mro-record-tools"><label>Search records<input id="recordSearch" type="search" placeholder="Donor name or identification number"></label><span id="recordCount"></span></div><div id="publishedRows" class="mro-record-list"></div><section id="recordDetail" class="mro-detail" hidden aria-label="Selected MRO record"></section></section></div>`;
const feedback=(message,kind='info')=>{const e=$('resultsFeedback');e.textContent=message;e.dataset.kind=kind;if(kind==='error')e.scrollIntoView({block:'start',behavior:'smooth'})};
const cell=(tr,value='')=>{const td=document.createElement('td');td.textContent=value==null||value===''?'—':String(value);tr.append(td);return td};
const select=(values,current,emptyLabel=null)=>{const e=document.createElement('select');for(const v of values)e.add(new Option(v||emptyLabel||'Select',v));e.value=current||'';return e};
let publishedRecords=[];
  let recordMeta=new Map();
  const donorName=r=>[r.first_name,r.middle_initial,r.last_name].filter(Boolean).join(' ')||r.donor_name||'Donor';
  const makeButton=(label,click,secondary=true)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(secondary)b.className='re-secondary';b.onclick=click;return b};
  const field=(label,value)=>{const d=document.createElement('div');d.className='mro-data-field';const l=document.createElement('small');l.textContent=label;const v=document.createElement('strong');v.textContent=value||'—';d.append(l,v);return d};
  const showRecord=(r)=>{
    const m=recordMeta.get(r.id)||{},pane=$('recordDetail');pane.hidden=false;pane.replaceChildren();
    const heading=document.createElement('div');heading.className='mro-detail-header';const title=document.createElement('div');const h=document.createElement('h3');h.textContent=donorName(r);const sub=document.createElement('p');sub.textContent='Test date: '+(r.test_date||'—')+' • Confirm the donor before changing a record.';title.append(h,sub);
    heading.append(title,makeButton('Close',()=>{pane.hidden=true;pane.replaceChildren()}));pane.append(heading);
    const fields=document.createElement('div');fields.className='mro-data-grid';fields.append(field('Date of birth',r.birthdate),field('CDL / State ID',r.cdl_number||r.state_id_number||r.identity_number),field('Test date',r.test_date));pane.append(fields);
    const editor=document.createElement('div');editor.className='mro-detail-edit';
    const resultLabel=document.createElement('label');resultLabel.textContent='Test result';const result=select(['','Negative','Positive'],r.result,'Pending MRO');resultLabel.append(result);
    const stageLabel=document.createElement('label');stageLabel.textContent='Workflow stage';const stage=select(['Ordered','Processing','At Lab','MRO Confirmation'],r.workflow_stage||'Ordered');stageLabel.append(stage);
    editor.append(resultLabel,stageLabel);pane.append(editor);
    const doc=document.createElement('div');doc.className='mro-document-row';const docTitle=document.createElement('div');const docHead=document.createElement('strong');docHead.textContent='Official MRO document';const filename=document.createElement('p');filename.textContent=m.document_name||r.document_name||'No document attached';docTitle.append(docHead,filename);doc.append(docTitle);
    if(m.has_document){doc.append(makeButton('View PDF',async()=>{const viewer=window.open('about:blank','_blank');try{const res=await documents({action:'view',id:r.id});if(!res.url)throw Error('PDF unavailable');if(viewer)viewer.location.replace(res.url);else throw Error('Enable pop-ups to view this PDF')}catch(e){if(viewer)viewer.close();feedback(e.message,'error')}}))}
    const replace=makeButton('Replace PDF',async()=>{if(!await window.DOTDialog.confirm('Replace the official MRO PDF for '+donorName(r)+'? Verify that the document belongs to this donor and test date.',{title:'Verify donor PDF',confirmText:'Choose PDF'}))return;const picker=document.createElement('input');picker.type='file';picker.accept='.pdf,application/pdf';picker.hidden=true;document.body.append(picker);picker.onchange=async()=>{const file=picker.files[0];picker.remove();if(!file)return;replace.disabled=true;try{if(!file.name.toLowerCase().endsWith('.pdf')||file.size>10485760)throw Error('Select a PDF under 10 MB');const prepared=await api({action:'prepare',employer_id:$('employer').value,filename:file.name});if(!prepared.upload_url||!prepared.path)throw Error('Upload unavailable');const uploaded=await fetch(prepared.upload_url,{method:'PUT',headers:{'Content-Type':'application/pdf'},body:file});if(!uploaded.ok)throw Error('MRO PDF upload failed');const change=await documents({action:'replace',id:r.id,confirm_donor_id:r.id,confirm_donor_name:donorName(r),confirm_test_date:r.test_date,document_path:prepared.path,document_name:file.name});if(!change.ok)throw Error('PDF replacement not confirmed');await loadPublished();feedback('Corrected PDF saved for '+donorName(r)+'.','success')}catch(e){feedback(e.message,'error')}finally{replace.disabled=false}};picker.click()});doc.append(replace);pane.append(doc);
    const actions=document.createElement('div');actions.className='mro-detail-actions';const save=makeButton('Save result changes',async()=>{save.disabled=true;try{const u=await api({action:'update_published',employer_id:$('employer').value,id:r.id,changes:{result:result.value||null,workflow_stage:stage.value}});if(!u.ok)throw Error('Save not confirmed');await loadPublished();feedback('Changes saved for '+donorName(r)+'.','success')}catch(e){feedback(e.message,'error')}finally{save.disabled=false}},false);
    const remove=makeButton('Delete record',async()=>{if(!await window.DOTDialog.confirm('Permanently delete the published record for '+donorName(r)+'? This cannot be undone.',{title:'Delete published result',confirmText:'Delete result',danger:true}))return;remove.disabled=true;try{const d=await api({action:'delete_published',employer_id:$('employer').value,id:r.id,confirm_delete:true});if(!d.ok)throw Error('Deletion not confirmed');await loadPublished();feedback('Record deleted.','success')}catch(e){feedback(e.message,'error');remove.disabled=false}});remove.className='mro-danger';actions.append(save,remove);pane.append(actions);pane.scrollIntoView({block:'nearest',behavior:'smooth'});
  };
  const renderRecords=()=>{
    const q=($('recordSearch').value||'').trim().toLowerCase();
    const items=publishedRecords.filter(r=>[donorName(r),r.cdl_number,r.state_id_number,r.identity_number,r.test_date].some(v=>String(v||'').toLowerCase().includes(q)));
    const body=$('publishedRows');body.replaceChildren();$('recordCount').textContent=items.length+' shown';
    if(!items.length){const empty=document.createElement('p');empty.className='mro-empty';empty.textContent='No matching records.';body.append(empty);return}
    for(const r of items){const item=document.createElement('article');item.className='mro-record-item';const left=document.createElement('div');left.className='mro-record-main';const h=document.createElement('h3');h.textContent=donorName(r);const sub=document.createElement('p');sub.textContent='Tested '+(r.test_date||'—')+' • '+(r.cdl_number||r.state_id_number||r.identity_number||'No ID');left.append(h,sub);
      const badges=document.createElement('div');badges.className='mro-record-status';const result=document.createElement('span');result.textContent=r.result||'Pending MRO';const stage=document.createElement('small');stage.textContent=r.workflow_stage||'Ordered';badges.append(result,stage);
      const documentInfo=recordMeta.get(r.id)||{};
      const documentArea=document.createElement('div');documentArea.className='mro-record-document';
      const documentLabel=document.createElement('strong');documentLabel.textContent='MRO document';
      const documentName=document.createElement('span');documentName.textContent=documentInfo.document_name||r.document_name||'No PDF attached';
      documentArea.append(documentLabel,documentName);
      if(documentInfo.has_document){
        const view=makeButton('View PDF',async()=>{
          const viewer=window.open('about:blank','_blank');
          try{const response=await documents({action:'view',id:r.id});if(!response.url)throw Error('Document unavailable');if(viewer)viewer.location.replace(response.url);else throw Error('Allow pop-ups to view PDF')}
          catch(e){if(viewer)viewer.close();feedback(e.message,'error')}
        });
        documentArea.append(view);
      }
      const actions=document.createElement('div');actions.className='mro-record-actions';actions.append(makeButton('View / Edit',()=>showRecord(r)));
      item.append(left,badges,documentArea,actions);body.append(item)}
  };
  async function loadPublished(){
    const employer_id=$('employer').value;if(!employer_id)return;
    const [results,metadata]=await Promise.all([api({action:'published',employer_id}),documents({action:'list'})]);
    recordMeta=new Map((metadata.records||[]).map(x=>[x.id,x]));publishedRecords=results.records||[];
    $('publishedCount').textContent=publishedRecords.length+' published donor records';$('recordDetail').hidden=true;$('recordDetail').replaceChildren();renderRecords();feedback('Records loaded. Choose a donor to view or edit.','info');
  }
  $('recordSearch').oninput=renderRecords;

$('employer').onchange=()=>{const e=$('employer').value;$('backToEntry').href='/results-entry.html?source='+encodeURIComponent(source)+'&employer_id='+encodeURIComponent(e);if(e)loadPublished().catch(err=>feedback(err.message,'error'));else{$('recordDetail').hidden=true;$('publishedRows').replaceChildren();$('publishedCount').textContent='Choose an employer'}};
try{const response=await api({action:'employers'});for(const employer of response.employers||[])$('employer').add(new Option(employer.legal_name,employer.id));
const selected=params.get('employer_id');if(selected&&[...$('employer').options].some(x=>x.value===selected))$('employer').value=selected;
$('employer').dispatchEvent(new Event('change'));}catch(e){feedback(e.message,'error')}
})().catch(e=>{const m=document.getElementById('dotPageMount');if(m)m.textContent=e.message||String(e)});