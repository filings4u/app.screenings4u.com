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
<div class="re-table"><table><thead><tr><th>Donor</th><th>Birthdate</th><th>CDL / State ID</th><th>Test date</th><th>Result</th><th>Workflow</th><th>MRO PDF</th><th>Actions</th></tr></thead><tbody id="publishedRows"></tbody></table></div></section></div>`;
const feedback=(message,kind='info')=>{const e=$('resultsFeedback');e.textContent=message;e.dataset.kind=kind;if(kind==='error')e.scrollIntoView({block:'start',behavior:'smooth'})};
const cell=(tr,value='')=>{const td=document.createElement('td');td.textContent=value==null||value===''?'—':String(value);tr.append(td);return td};
const select=(values,current,emptyLabel=null)=>{const e=document.createElement('select');for(const v of values)e.add(new Option(v||emptyLabel||'Select',v));e.value=current||'';return e};
let publishedRecords=[];
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

$('employer').onchange=()=>{const e=$('employer').value;$('backToEntry').href='/results-entry.html?source='+encodeURIComponent(source)+'&employer_id='+encodeURIComponent(e);if(e)loadPublished().catch(err=>feedback(err.message,'error'));else{$('publishedRows').replaceChildren();$('publishedCount').textContent='Choose an employer'}};
try{const response=await api({action:'employers'});for(const employer of response.employers||[])$('employer').add(new Option(employer.legal_name,employer.id));
const selected=params.get('employer_id');if(selected&&[...$('employer').options].some(x=>x.value===selected))$('employer').value=selected;
$('employer').dispatchEvent(new Event('change'));}catch(e){feedback(e.message,'error')}
})().catch(e=>{const m=document.getElementById('dotPageMount');if(m)m.textContent=e.message||String(e)});