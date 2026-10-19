(()=>{'use strict';
const $=s=>document.querySelector(s), el=(t,txt)=>{const n=document.createElement(t);n.textContent=txt;return n};
const uuid=()=>crypto.randomUUID();
let operationId=null,preview=null;
async function request(body){
 const session=await window.dotSupabase.auth.getSession();
 const token=session.data?.session?.access_token;if(!token)throw Error('Staff sign-in required');
 const cfg=window.DOT_PORTAL_CONFIG;
 const r=await fetch(cfg.supabaseUrl+'/functions/v1/central-subscription-admin',{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.supabaseAnonKey,Authorization:'Bearer '+token},body:JSON.stringify(body)});
 const out=await r.json().catch(()=>({}));if(!r.ok||out.error)throw Error(out.error||'Request failed');return out;
}
function msg(t,bad=false){const x=$('#subscriptionFeedback');x.textContent=t;x.style.color=bad?'#a11f1f':'#24467f'}
async function start(){
 const user=await DOTAuth.requireAuth();if(!user)return;
 window.DOT_AUTH_STATE=user;DOTShell.render(user);
 $('#dotPageMount').innerHTML='<section class="dot-page" style="max-width:1100px;padding:30px"><header class="dot-page-head"><div><span class="dot-eyebrow">SHARED OPERATIONS / BILLING</span><h1>Subscription Management</h1><p>Read Stripe first. Changes only apply to existing Stripe-linked subscriptions and require finance management permission.</p></div></header><div class="dot-card"><div class="dot-card-body"><div class="dot-field-grid"><div class="dot-field"><label for="subWorkspace">Business workspace</label><select id="subWorkspace"><option value="dot">DOT</option><option value="nondot">NON-DOT</option></select></div><div class="dot-field"><label for="subId">Subscription record ID</label><input id="subId" placeholder="UUID from subscription record"></div></div><div class="dot-actions"><button class="dot-btn primary" id="subLookup">Load Stripe subscription</button></div><p id="subscriptionFeedback" role="status" aria-live="polite" style="margin-top:15px"></p></div></div><div id="subControls" style="margin-top:20px"></div></section>';
 const q=new URLSearchParams(location.search);$('#subWorkspace').value=q.get('workspace')==='workforce'?'nondot':(q.get('workspace')==='nondot'?'nondot':'dot');$('#subId').value=q.get('id')||'';
 $('#subLookup').onclick=load;
 if($('#subId').value)load();
}
async function load(){
 preview=null;operationId=null;$('#subControls').replaceChildren();msg('Retrieving current subscription…');
 try{preview=await request({action:'preview',workspace:$('#subWorkspace').value,subscription_id:$('#subId').value.trim()});const s=preview.stripe,l=preview.local;
 const node=$('#subControls');const card=el('section');card.className='dot-card';card.style.padding='22px';
 card.append(el('h2','Stripe subscription '+s.id),el('p','Stripe status: '+s.status+' | Local status: '+l.status),el('p','Cancel at period end: '+(s.cancel_at_period_end?'Yes':'No')),el('p','Current period ends: '+(s.current_period_end?new Date(s.current_period_end).toLocaleString():'Not available')));
 const controls=el('div');controls.className='dot-actions';controls.style.marginTop='20px';
 const cancel=el('button',s.cancel_at_period_end?'Restore automatic renewal':'Cancel at period end');cancel.className='dot-btn';cancel.type='button';
 cancel.onclick=()=>mutate(s.cancel_at_period_end?'resume':'cancel_at_period_end',{},'Confirm the Stripe subscription renewal setting change?');
 const plan=el('div');plan.style.cssText='margin-top:20px;display:grid;gap:10px;max-width:600px';
 plan.append(el('h3','Change monthly plan without prorations'));
 const planId=el('input');planId.placeholder='Active plan UUID';planId.setAttribute('aria-label','Destination plan ID');
 const priceId=el('input');priceId.placeholder='Matching Stripe price ID';priceId.setAttribute('aria-label','Stripe price ID');
 const update=el('button','Apply plan change at current billing cycle');update.className='dot-btn';update.type='button';
 update.onclick=()=>mutate('change_plan',{plan_id:planId.value.trim(),stripe_price_id:priceId.value.trim()},'Change this monthly subscription plan with no prorations? The next regular billing cycle will use the selected price.');
 plan.append(planId,priceId,update,el('p','Renewal-date editing is disabled until a Stripe billing-schedule workflow can be validated. Local-only date changes are not supported.'));
 controls.append(cancel);card.append(controls,plan);node.append(card);msg('Stripe subscription loaded. Review before changing.');
 }catch(e){msg(e.message,true)}
}
async function mutate(action,extra,question){
 if(!preview)return;
 if(!confirm(question))return;
 if(!operationId)operationId=uuid();
 msg('Submitting change to Stripe…');
 try{await request({action,workspace:$('#subWorkspace').value,subscription_id:$('#subId').value.trim(),operation_id:operationId,...extra});msg('Stripe update completed. Reloading synchronized status.');operationId=null;await load()}catch(e){msg(e.message+' If Stripe succeeded but local synchronization failed, reconcile before retrying.',true)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();