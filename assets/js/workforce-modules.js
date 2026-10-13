/* screenings4u DOT Management Portal — zero-refresh client router */
(()=>{
'use strict';
const SKIP=new Set(['dot-login.html','dot-reset-password.html','global-checkout.html','index.html']);
const COMMON=/\/(dot-config|dot-auth|dot-api|dot-inventory|dot-shell|dot-router)\.js(?:\?|$)/i;
let navigating=false, seq=0, progressTimer=null;
const DOCS=new Map(), SNAP=new Map();
const loadedCss=new Set([...document.querySelectorAll('link[rel="stylesheet"]')].map(x=>new URL(x.href,location.href).pathname));
function snapKey(k){return 's4u-dot-snap-v7:'+k}
function snapGet(k){if(SNAP.has(k))return SNAP.get(k);try{const v=sessionStorage.getItem(snapKey(k));if(v){SNAP.set(k,v);return v}}catch{}return null}
function snapSet(k,v){if(!v)return;SNAP.set(k,v);try{if(v.length<600000)sessionStorage.setItem(snapKey(k),v)}catch{}}
function pageOf(u){return u.pathname.split('/').pop()||'dot-dashboard.html'}
function eligible(u){
 // NON-DOT pages bind their modules and shell to location at script evaluation time.
 // Keep navigation into, out of, and within that workspace as document loads.
 const current=pageOf(new URL(location.href));
 const target=pageOf(u);
 if(current.startsWith('workforce-')||target.startsWith('workforce-'))return false;
 return u.origin===location.origin&&/\.html$/i.test(u.pathname)&&!SKIP.has(target);
}
function progress(on){let n=document.getElementById('dotRouteProgress');if(on){clearTimeout(progressTimer);progressTimer=setTimeout(()=>{if(!n){n=document.createElement('div');n.id='dotRouteProgress';n.setAttribute('aria-hidden','true');document.body.appendChild(n)}requestAnimationFrame(()=>n.classList.add('active'));document.body.classList.add('dot-route-loading')},180)}else{clearTimeout(progressTimer);progressTimer=null;n?.classList.remove('active');document.body.classList.remove('dot-route-loading')}}
function addStyles(doc){for(const l of doc.querySelectorAll('link[rel="stylesheet"][href]')){const u=new URL(l.getAttribute('href'),location.href),k=u.pathname;if(loadedCss.has(k))continue;loadedCss.add(k);const x=document.createElement('link');x.rel='stylesheet';x.href=u.href;document.head.appendChild(x)}}
function targetScripts(doc){return [...doc.querySelectorAll('script[src]')].map(s=>new URL(s.getAttribute('src'),location.href)).filter(u=>u.origin===location.origin&&!COMMON.test(u.pathname)&&!/supabase-js/i.test(u.href))}
function runScript(u,navId){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=u.href;s.async=false;s.dataset.dotSpa='1';s.dataset.dotNav=String(navId);s.onload=()=>{s.remove();resolve()};s.onerror=()=>{s.remove();reject(new Error('Unable to load '+u.pathname.split('/').pop()))};document.body.appendChild(s)})}
async function fetchDoc(u){const k=u.pathname+u.search;if(DOCS.has(k))return DOCS.get(k);const job=(async()=>{const r=await fetch(u.href,{credentials:'same-origin',cache:'default',headers:{'X-DOT-Soft-Navigation':'1'}});if(!r.ok)throw new Error('Unable to open '+pageOf(u)+'.');return new DOMParser().parseFromString(await r.text(),'text/html')})();DOCS.set(k,job);try{return await job}catch(e){DOCS.delete(k);throw e}}
async function navigate(href,opts={}){
 const u=new URL(href,location.href);if(!eligible(u)){location.href=u.href;return}
 if(navigating&&u.href===location.href)return;
 const currentKey=location.pathname+location.search,targetKey=u.pathname+u.search,mount=document.getElementById('dotPageMount');
 if(mount&&mount.innerHTML.trim())snapSet(currentKey,mount.innerHTML);
 const navId=++seq;navigating=true;progress(true);
 try{
   if(opts.replace)history.replaceState({dotSpa:true},'',u.href);else if(!opts.pop)history.pushState({dotSpa:true},'',u.href);
   document.body.classList.remove('dot-menu-open');
   document.querySelectorAll('.dot-nav a').forEach(a=>a.classList.toggle('active',(a.getAttribute('href')||'').split('?')[0]===pageOf(u)));
   const cached=snapGet(targetKey);if(cached&&mount)mount.innerHTML=cached;
   const doc=await fetchDoc(u);addStyles(doc);
   document.title=doc.title||document.title;
   document.documentElement.classList.remove('dot-auth-pending');
   const scripts=targetScripts(doc);
   for(const s of scripts)await runScript(s,navId);
   window.dispatchEvent(new Event('DOMContentLoaded'));
   scrollTo({top:0,left:0,behavior:'instant'});
   const after=document.getElementById('dotPageMount');if(after&&after.innerHTML.trim())snapSet(targetKey,after.innerHTML);
 }catch(e){console.error('[DOT Router]',e);location.href=u.href;return}
 finally{navigating=false;progress(false)}
}
async function refresh(){return navigate(location.href,{replace:true})}
function prefetch(href){try{const u=new URL(href,location.href);if(!eligible(u))return;fetchDoc(u).catch(()=>{})}catch{}}
document.addEventListener('click',e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target.closest?.('a[href]');if(!a||a.target||a.hasAttribute('download'))return;const href=a.getAttribute('href');if(!href||href.startsWith('#')||href.startsWith('javascript:'))return;const u=new URL(href,location.href);if(!eligible(u))return;e.preventDefault();navigate(u.href)},true);
document.addEventListener('pointerover',e=>{const a=e.target.closest?.('a[href]');if(a)prefetch(a.href)},{passive:true,capture:true});
addEventListener('popstate',()=>navigate(location.href,{replace:true,pop:true}));
if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('dot-sw.js?v=20261001-1048',{scope:'./'}).catch(()=>{}),{once:true})}
window.DOTRouter=Object.freeze({navigate,refresh,prefetch});
})();
