(()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=v=>DOTShell.escape(v);
const get=(d,...keys)=>{for(const k of keys)if(Array.isArray(d?.[k]))return d[k];return[]};
const norm=v=>String(v||'').trim().toLowerCase();
const stamp=x=>Math.max(Date.parse(x?.updated_at||0)||0,Date.parse(x?.created_at||0)||0);
const metric=(label,value,note='')=>`<article class="dot-metric"><span>${esc(label)}</span><strong>${esc(String(value??0))}</strong><small>${esc(note)}</small></article>`;
const pill=(v,cls='')=>`<span class="dot-status-pill ${cls||(/active|enrolled|enabled/i.test(v||'')?'ok':/inactive|archived|cancel/i.test(v||'')?'bad':'warn')}">${esc(String(v||'—').replaceAll('_',' '))}</span>`;

function shell(){
 $('#dotPageMount').innerHTML=`<section class="dot-page owner-directory-page">
   <header class="dot-page-head">
     <div>
       <span class="dot-eyebrow">WORKFORCE MANAGEMENT</span>
       <h1>Owner-Operators</h1>
       <p>Manage FMCSA owner-operators as complete customer records, including their employer identity, C/TPA relationship, consortium participation, driver capacity, and DOT registration.</p>
     </div>
     <div class="dot-actions">
       <a class="dot-btn" href="dot-employers.html">Employer Directory</a>
       <a class="dot-btn" href="dot-pools.html">Consortiums</a>
       <button class="dot-btn" type="button" id="refreshOwners">Refresh</button>
     </div>
   </header>
   <div id="ownerStatus"></div>
   <div id="ownerBody"><div class="dot-card"><div class="dot-empty"><div class="dot-instant-placeholder" aria-hidden="true"></div></div></div></div>
 </section>`;
}
function notice(msg,error=false){
 $('#ownerStatus').innerHTML=`<div class="dot-banner ${error?'warning':''}"><div><strong>${error?'Action needs attention':'Owner-operator update'}</strong><span>${esc(msg)}</span></div></div>`;
}

function keyFor(x){
 const email=norm(x.email);
 if(email) return 'email:'+email;
 const dot=norm(x.dot_number);
 if(dot) return 'dot:'+dot;
 return 'id:'+x.id;
}
function chooseCanonical(list){
 return list.slice().sort((a,b)=>{
   const aa=norm(a.status)==='active'?1:0,ba=norm(b.status)==='active'?1:0;
   if(aa!==ba)return ba-aa;
   const ac=norm(a.consortium_status)==='active'?1:0,bc=norm(b.consortium_status)==='active'?1:0;
   if(ac!==bc)return bc-ac;
   return stamp(b)-stamp(a);
 })[0];
}
function groupOwners(all){
 const map=new Map();
 for(const x of all){
   const k=keyFor(x);
   if(!map.has(k))map.set(k,[]);
   map.get(k).push(x);
 }
 return [...map.values()].map(records=>({canonical:chooseCanonical(records),records}));
}

function render({owners,employers,ctpas,pools}){
 const empMap=new Map(employers.map(x=>[x.id,x]));
 const ctpaMap=new Map(ctpas.map(x=>[x.id,x]));
 const groups=groupOwners(owners).map(g=>{
   const x=g.canonical;
   const emp=empMap.get(x.employer_id)||null;
   const ctpa=emp?.ctpa_id?ctpaMap.get(emp.ctpa_id)||null:null;
   const poolMatches=pools.filter(p=>p.employer_id===x.employer_id|| (emp?.ctpa_id && p.ctpa_id===emp.ctpa_id && norm(p.status)==='active'));
   const directPool=poolMatches.find(p=>p.employer_id===x.employer_id&&norm(p.status)==='active')||poolMatches[0]||null;
   const type=emp?.ctpa_id?'ctpa':'direct';
   return {...g,emp,ctpa,pool:directPool,type};
 });

 const ownerNameCounts=new Map();
 groups.forEach(g=>{const x=g.canonical,k=norm(x.legal_name||x.dba_name);if(k)ownerNameCounts.set(k,(ownerNameCounts.get(k)||0)+1)});
 const ownerDisplayName=x=>{const base=x.legal_name||x.dba_name||'Owner-Operator',k=norm(base);return (ownerNameCounts.get(k)||0)>1&&x.state?`${base} (${String(x.state).toUpperCase()})`:base};

 const active=groups.filter(g=>norm(g.canonical.status)==='active').length;
 const ctpaManaged=groups.filter(g=>g.type==='ctpa').length;
 const enrolled=groups.filter(g=>norm(g.canonical.consortium_status)==='active'||g.pool).length;
 const duplicates=groups.filter(g=>g.records.length>1).length;

 $('#ownerBody').innerHTML=`
  <div class="dot-metrics">
    ${metric('Owner-Operators',groups.length,'Unique customer identities')}
    ${metric('Active Accounts',active,'Currently active owner-operators')}
    ${metric('Consortium / Pool',enrolled,'Accounts with Consortium participation')}
    ${metric('Duplicate Groups',duplicates,duplicates?'Multiple records share one identity':'No duplicate identities')}
  </div>

  <div class="owner-quick-grid">
    <a class="owner-quick-card" href="dot-employers.html"><span>▧</span><div><strong>Employer Records</strong><small>Each owner-operator also has an employer-side company record.</small></div></a>
    <a class="owner-quick-card" href="dot-pools.html"><span>◎</span><div><strong>Consortiums</strong><small>Manage FMCSA random Consortium participation and ownership.</small></div></a>
    <a class="owner-quick-card" href="dot-drivers.html"><span>♙</span><div><strong>Driver Records</strong><small>Manage the owner as a safety-sensitive driver when applicable.</small></div></a>
    <a class="owner-quick-card" href="dot-testing-orders.html"><span>▤</span><div><strong>Testing Orders</strong><small>Manage drug and alcohol testing activity for covered owner-operators.</small></div></a>
  </div>

  <div class="dot-card">
    <div class="dot-card-head">
      <div><h2>Owner-Operator Directory</h2><p>Duplicate records are grouped by email first, then USDOT number, so one owner-operator appears as one customer workspace.</p></div>
      <span class="owner-count" id="ownerCount">${groups.length} owner-operators</span>
    </div>
    <div class="dot-card-body owner-toolbar">
      <div class="owner-filter-grid">
        <div class="dot-field"><label for="ownerSearch">Search owner-operators</label><input id="ownerSearch" type="search" placeholder="Company, email, USDOT, MC, owner ID"></div>
        <div class="dot-field"><label for="ownerType">Relationship</label><select id="ownerType"><option value="">All relationships</option><option value="ctpa">C/TPA managed</option><option value="direct">Direct owner-operator</option></select></div>
        <div class="dot-field"><label for="ownerPool">Consortium / Pool</label><select id="ownerPool"><option value="">All Consortium states</option><option value="enrolled">Enrolled / assigned</option><option value="not_enrolled">Not enrolled</option></select></div>
        <div class="dot-field"><label for="ownerStatusFilter">Status</label><select id="ownerStatusFilter"><option value="">All statuses</option>${[...new Set(groups.map(g=>g.canonical.status).filter(Boolean))].sort().map(x=>`<option value="${esc(x)}">${esc(String(x).replaceAll('_',' '))}</option>`).join('')}</select></div>
        <div class="dot-field"><label for="ownerRecords">Records</label><select id="ownerRecords"><option value="">All records</option><option value="single">Single record</option><option value="duplicate">Duplicate groups</option></select></div>
        <button class="dot-btn" type="button" id="clearOwnerFilters">Clear</button>
      </div>
    </div>
    <div id="ownerTable"></div>
  </div>`;

 const draw=()=>{
   const q=norm($('#ownerSearch').value),type=$('#ownerType').value,pool=$('#ownerPool').value,status=$('#ownerStatusFilter').value,records=$('#ownerRecords').value;
   const filtered=groups.filter(g=>{
     const x=g.canonical;
     const hay=[x.legal_name,x.dba_name,x.email,x.phone,x.dot_number,x.mc_number,x.id,x.employer_id,g.emp?.legal_name,g.emp?.primary_contact_email,g.ctpa?.legal_name,g.ctpa?.support_email,g.pool?.name].join(' ').toLowerCase();
     const enrolled=norm(x.consortium_status)==='active'||!!g.pool;
     return (!q||hay.includes(q))&&(!type||g.type===type)&&(!pool||(pool==='enrolled'?enrolled:!enrolled))&&(!status||x.status===status)&&(!records||(records==='duplicate'?g.records.length>1:g.records.length===1));
   });
   $('#ownerCount').textContent=`${filtered.length} of ${groups.length} owner-operators`;
   $('#ownerTable').innerHTML=`<div class="dot-table-wrap"><table class="dot-table owner-table">
     <thead><tr><th>Owner-Operator</th><th>Relationship</th><th>USDOT / MC</th><th>Consortium / Pool</th><th>Driver Capacity</th><th>Records</th><th>Status</th><th>Management</th></tr></thead>
     <tbody>${filtered.map(g=>{
       const x=g.canonical;
       const relation=g.type==='ctpa'?`<span class="owner-type ctpa">C/TPA Managed</span><small>${esc(g.ctpa?.legal_name||g.ctpa?.support_email||g.emp?.ctpa_id||'C/TPA')}</small>`:`<span class="owner-type direct">Direct</span><small>Independent owner-operator</small>`;
       const poolName=g.pool?.name||null;
       return `<tr>
         <td><strong>${esc(ownerDisplayName(x))}</strong><small>${esc(x.email||x.id)}</small></td>
         <td>${relation}</td>
         <td><strong>${esc(x.dot_number||'—')}</strong><small>${esc(x.mc_number?`MC ${x.mc_number}`:'')}</small></td>
         <td>${poolName?`<strong>${esc(poolName)}</strong><small>${esc(g.pool.dot_agency||'FMCSA')} · ${pill(g.pool.status)}</small>`:pill(x.consortium_status||'not_enrolled',norm(x.consortium_status)==='active'?'ok':'warn')}</td>
         <td><strong>${x.owner_is_driver?'Owner is driver':'Company only'}</strong><small>${esc(`${x.cdl_driver_count??0} CDL driver(s) · ${x.vehicle_count??0} vehicle(s)`)}</small></td>
         <td>${g.records.length>1?`<span class="owner-duplicate">${g.records.length} linked records</span>`:'<span class="owner-single">1 record</span>'}</td>
         <td>${pill(x.status)}</td>
         <td><div class="owner-actions"><a class="dot-btn small primary" href="dot-owner-operator-detail.html?id=${encodeURIComponent(x.id)}">Manage Portal</a><a class="dot-btn small" href="dot-record.html?module=owner_operators&id=${encodeURIComponent(x.id)}">Raw Record</a>${g.emp?`<a class="dot-btn small" href="dot-record.html?module=employers&id=${encodeURIComponent(g.emp.id)}">Employer</a>`:''}${g.ctpa?`<a class="dot-btn small" href="dot-ctpa-detail.html?id=${encodeURIComponent(g.ctpa.id)}">C/TPA</a>`:''}</div></td>
       </tr>`;
     }).join('')||'<tr><td colspan="8"><div class="dot-empty">No owner-operators match these filters.</div></td></tr>'}</tbody>
   </table></div>`;
 };
 ['ownerSearch','ownerType','ownerPool','ownerStatusFilter','ownerRecords'].forEach(id=>$('#'+id).addEventListener(id==='ownerSearch'?'input':'change',draw));
 $('#clearOwnerFilters').onclick=()=>{$('#ownerSearch').value='';$('#ownerType').value='';$('#ownerPool').value='';$('#ownerStatusFilter').value='';$('#ownerRecords').value='';draw()};
 draw();
}

async function load(){
 $('#ownerStatus').innerHTML='';
 const settled=await Promise.allSettled([
   DOTApi.call('owner_operators'),
   DOTApi.call('employers'),
   DOTApi.call('ctpas'),
   DOTApi.call('pools')
 ]);
 if(settled[0].status!=='fulfilled')throw settled[0].reason||new Error('Unable to load owner-operators.');
 const odata=settled[0].value;
 const edata=settled[1].status==='fulfilled'?settled[1].value:{};
 const cdata=settled[2].status==='fulfilled'?settled[2].value:{};
 const pdata=settled[3].status==='fulfilled'?settled[3].value:{};
 if(settled.slice(1).some(x=>x.status!=='fulfilled'))notice('Owner-operators loaded, but one or more relationship sources may be incomplete.',true);
 render({owners:get(odata,'owner_operators'),employers:get(edata,'employers'),ctpas:get(cdata,'ctpas'),pools:get(pdata,'pools')});
}
async function start(){
 const state=await DOTAuth.requireAuth();if(!state)return;
 DOTShell.render(state);shell();
 $('#refreshOwners').onclick=()=>load().catch(e=>notice(e.message,true));
 await load();
}
addEventListener('DOMContentLoaded',()=>start().catch(e=>{console.error(e);if($('#ownerStatus'))notice(e?.message||String(e),true)}),{once:true});
})();