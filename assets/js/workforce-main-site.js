(()=>{
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const apiUrl="https://elpbnytpciqnbexiaebp.supabase.co/functions/v1/workforce-main-site-admin";
let rows=[],active=null;
async function api(action,extra={}){
 const {data,error}=await dotSupabase.auth.getSession();if(error||!data.session?.access_token)throw Error("Staff sign-in required");
 const r=await fetch(apiUrl,{method:"POST",headers:{"Content-Type":"application/json","apikey":DOT_PORTAL_CONFIG.supabaseAnonKey,"Authorization":"Bearer "+data.session.access_token},body:JSON.stringify({action,...extra}),cache:"no-store"});
 const d=await r.json().catch(()=>({}));if(!r.ok||d.error)throw Error(d.error||"Unable to load website management");return d;
}
function renderPage(row){
 active=row;
 $("#wfSiteEditorTitle").textContent=row.page_title||"Select a page";
 $("#wfMainPage").value=row.path||"/";$("#wfMainTitle").value=row.page_title||"";
 $("#wfMainDesc").value=row.meta_description||"";$("#wfMainKeywords").value=(row.seo_keywords||[]).join(", ");
 $("#wfMainCanonical").value=row.canonical_url||"https://workforce.screenings4u.com"+(row.path||"/");
 $("#wfMainStatus").value=row.status||"draft";$("#wfMainIndex").checked=row.robots_index!==false;
 $("#wfMainSaveStatus").textContent="";
 $("[data-wf-site-preview]").href="https://workforce.screenings4u.com"+row.path;
 document.querySelectorAll("[data-wf-page-id]").forEach(b=>b.classList.toggle("selected",b.dataset.wfPageId===row.id));
}
function renderList(){
 const list=$("#wfSitePages"),q=($("#wfSiteSearch")?.value||"").toLowerCase();
 const items=rows.filter(x=>(x.path+" "+x.page_title).toLowerCase().includes(q));
 list.innerHTML=items.map(x=>'<button type="button" class="wf-site-row" data-wf-page-id="'+esc(x.id)+'"><span><strong>'+esc(x.page_title)+'</strong><small>'+esc(x.path)+'</small></span><em>'+esc(x.status)+'</em></button>').join("")||'<p>No matching pages.</p>';
 list.querySelectorAll("[data-wf-page-id]").forEach(b=>b.onclick=()=>renderPage(rows.find(x=>x.id===b.dataset.wfPageId)));
}
async function load(selectPath){
 const d=await api("list");rows=d.pages||[];renderList();
 const selected=rows.find(x=>x.path===selectPath)||rows.find(x=>x.id===active?.id)||rows[0];if(selected)renderPage(selected);
 $("#wfSiteCount").textContent=rows.length+" pages";
}
async function save(e){
 e.preventDefault();if(!active)return;
 const b=$("#wfSaveMainSite"),status=$("#wfMainSaveStatus");b.disabled=true;status.textContent="Saving changes…";
 const page={path:active.path,page_title:$("#wfMainTitle").value.trim(),meta_description:$("#wfMainDesc").value.trim(),seo_keywords:$("#wfMainKeywords").value.split(",").map(v=>v.trim()).filter(Boolean),canonical_url:$("#wfMainCanonical").value.trim(),status:$("#wfMainStatus").value,robots_index:$("#wfMainIndex").checked};
 try{
  const r=await api("save",{page});status.textContent="Saved in Workforce main-site management.";await load(r.page.path);
 }catch(error){status.textContent=error.message||"Unable to save"}finally{b.disabled=false}
}
async function main(){
 const host=$("#dotPageMount");
 host.innerHTML='<section class="nd-page wf-main-site-page"><header class="nd-page-head"><div><span class="nd-eyebrow">WORKFORCE BY SCREENINGS4U · MAIN WEBSITE</span><h1>Main Website Pages & SEO</h1><p>Edit metadata for workforce.screenings4u.com without changing the existing NON-DOT website or customer portal records.</p></div><a class="nd-btn primary" href="https://workforce.screenings4u.com" target="_blank" rel="noopener noreferrer">Open Website</a></header><div class="wf-site-layout"><section class="nd-card wf-site-side"><div class="wf-site-list-header"><h2>Website Pages</h2><span id="wfSiteCount"></span></div><input type="search" id="wfSiteSearch" placeholder="Search pages…" aria-label="Search website pages"><div id="wfSitePages">Loading pages…</div></section><section class="nd-card wf-site-form"><div class="wf-site-form-head"><div><span class="nd-eyebrow">PAGE METADATA</span><h2 id="wfSiteEditorTitle">Select a page</h2></div><a data-wf-site-preview class="nd-btn" href="https://workforce.screenings4u.com" target="_blank" rel="noopener noreferrer">View Page</a></div><form id="wfSiteForm"><label>URL Path<input id="wfMainPage" readonly></label><label>Page Title<input id="wfMainTitle" required maxlength="220"></label><label>SEO Meta Description<textarea id="wfMainDesc" rows="4" maxlength="400" placeholder="Describe the page for search results"></textarea></label><label>SEO Keywords, comma-separated<input id="wfMainKeywords" placeholder="workforce, compliance, testing"></label><label>Canonical URL<input id="wfMainCanonical" required type="url"></label><div class="wf-site-form-controls"><label>Status<select id="wfMainStatus"><option value="published">Published</option><option value="draft">Draft metadata</option><option value="archived">Archived metadata</option></select></label><label class="wf-site-check"><input type="checkbox" id="wfMainIndex"> Allow search indexing</label></div><p class="wf-site-help">These settings sync to the main website’s client-side metadata layer. For guaranteed search-crawler indexing and new HTML page publication, deploy the corresponding static page or server-rendered metadata. This screen does not alter subscriptions, payment products, or private portal documents.</p><div class="wf-site-form-footer"><span id="wfMainSaveStatus" role="status"></span><button type="submit" id="wfSaveMainSite" class="nd-btn primary">Save Changes</button></div></form></section></div></section>';
 const css=document.createElement("style");css.textContent='.wf-site-layout{display:grid;grid-template-columns:minmax(255px,.8fr) minmax(0,1.8fr);gap:18px}.wf-site-side,.wf-site-form{padding:18px}.wf-site-list-header,.wf-site-form-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px}.wf-site-list-header h2,.wf-site-form-head h2{margin:0;font-size:17px;color:#01122f}.wf-site-list-header span{font-size:11px;color:#668}.wf-site-side input[type=search]{width:100%;min-height:41px;padding:8px 10px;border:1px solid #cdd8e4;border-radius:9px;margin:0 0 12px}.wf-site-row{width:100%;display:flex;justify-content:space-between;align-items:center;gap:9px;padding:11px;border:1px solid #dee8f0;border-radius:8px;margin:6px 0;background:#fff;text-align:left;cursor:pointer}.wf-site-row.selected{background:#fff9df;border-color:#fdc102}.wf-site-row span{display:grid;min-width:0;gap:4px}.wf-site-row strong{font-size:12px;color:#01122f;white-space:normal}.wf-site-row small{font-size:11px;color:#647a91}.wf-site-row em{font-size:10px;font-style:normal;color:#65788d}.wf-site-form form{display:grid;gap:14px}.wf-site-form form>label,.wf-site-form-controls>label{display:grid;gap:6px;font-size:12px;font-weight:800;color:#23405f}.wf-site-form input:not([type=checkbox]),.wf-site-form select,.wf-site-form textarea{width:100%;padding:10px 12px;min-height:42px;font:inherit;font-weight:400;border:1px solid #ccd8e6;border-radius:8px;background:#fff;color:#01122f}.wf-site-form-controls{display:flex;flex-wrap:wrap;align-items:center;gap:20px}.wf-site-check{display:flex!important;align-items:center;gap:9px}.wf-site-check input{width:17px;height:17px;accent-color:#01122f}.wf-site-help{font-size:12px;line-height:1.6;color:#61758c;background:#f5f8fc;border:1px solid #dee6f0;padding:12px;border-radius:9px}.wf-site-form-footer{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #e2e9f1;padding-top:16px}.wf-site-form-footer span{font-size:12px;color:#2c6d42}@media(max-width:880px){.wf-site-layout{grid-template-columns:1fr}.wf-site-side{max-height:400px;overflow:auto}}';document.head.append(css);
 $("#wfSiteSearch").addEventListener("input",renderList);
 $("#wfSiteForm").addEventListener("submit",save);
 await load();
}
document.addEventListener("DOMContentLoaded",async()=>{try{const state=await DOTAuth.requireAuth();if(!state)return;DOTShell.render(state);await main()}catch(error){const el=$("#dotPageMount");if(el)el.textContent=error.message||"Unable to load management screen"}},{once:true});
})();