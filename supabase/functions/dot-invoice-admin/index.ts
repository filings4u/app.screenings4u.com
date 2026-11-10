
import { createClient } from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const S=(v:any)=>String(v??"").trim(), N=()=>new Date().toISOString();
const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
async function perms(db:any,uid:string){const p=await db.from("staff_profiles").select("employment_status").eq("user_id",uid).maybeSingle();if(p.error)throw p.error;if(p.data?.employment_status!=="active")return new Set<string>();const r=await db.from("staff_role_assignments").select("role_code").eq("user_id",uid).eq("active",true);if(r.error)throw r.error;const roles=(r.data||[]).map((x:any)=>x.role_code);if(!roles.length)return new Set<string>();const q=await db.from("staff_role_permissions").select("permission_key").in("role_code",roles).eq("allowed",true);if(q.error)throw q.error;return new Set((q.data||[]).map((x:any)=>x.permission_key))}
async function customer(db:any,type:string,id:string){
 if(type==="ctpa"){const q=await db.from("ctpas").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("C/TPA not found.");const o=await db.from("organizations").select("*").eq("id",q.data.organization_id).maybeSingle();if(o.error)throw o.error;return {type,id,tenant_id:q.data.tenant_id,ctpa_id:q.data.id,employer_id:null,owner_operator_id:null,name:o.data?.dba_name||o.data?.legal_name||q.data.company_code||"C/TPA",email:o.data?.primary_email||q.data.support_email||null,record:q.data,organization:o.data||null}}
 if(type==="employer"){const q=await db.from("employers").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data||q.data.workforce_classification!=="DOT")throw new Error("Direct Employer not found.");return {type,id,tenant_id:q.data.tenant_id,ctpa_id:null,employer_id:q.data.id,owner_operator_id:null,name:q.data.dba_name||q.data.legal_name,email:q.data.billing_contact_email||q.data.primary_contact_email||null,record:q.data}}
 if(type==="owner_operator"){const q=await db.from("owner_operators").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)throw new Error("Owner-Operator not found.");return {type,id,tenant_id:q.data.tenant_id,ctpa_id:null,employer_id:q.data.employer_id,owner_operator_id:q.data.id,name:q.data.dba_name||q.data.legal_name,email:q.data.email||null,record:q.data}}
 throw new Error("Invalid invoice customer type.");
}
function domain(type:string){return type==="ctpa"?"https://ctpa-dot.screenings4u.com":type==="owner_operator"?"https://owner-operator.screenings4u.com":"https://employer-fmcsa-dot.screenings4u.com"}
function paymentUrl(type:string,id:string){return domain(type)+"/global-checkout.html?mode=invoice&invoice_id="+encodeURIComponent(id)}
function billingUrl(type:string){return domain(type)+"/billing.html"}
function invoiceNum(){const d=new Date(),ymd=d.toISOString().slice(0,10).replaceAll("-","");return "DOT-INV-"+ymd+"-"+crypto.randomUUID().slice(0,6).toUpperCase()}
async function emit(db:any,inv:any,type:string,detail:string,uid:string,meta:any={}){await db.from("dot_invoice_events").insert({id:crypto.randomUUID(),invoice_id:inv.id,tenant_id:inv.tenant_id,event_type:type,detail,metadata:meta,actor_user_id:uid,created_at:N()})}
async function emailInvoice(inv:any,items:any[],cust:any){
 const key=Deno.env.get("RESEND_API_KEY")||""; if(!key)throw new Error("Invoice email delivery is not configured.");
 const from=Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"Workforce DOT | screenings4u <notifications@screenings4u.com>";
 const pay=inv.payment_url||paymentUrl(inv.customer_type,inv.id), view=inv.view_url||billingUrl(inv.customer_type);
 const money=(v:any)=>new Intl.NumberFormat("en-US",{style:"currency",currency:String(inv.currency||"USD").toUpperCase()}).format(Number(v||0));
 const rows=items.map((x:any)=>'<tr><td style="padding:10px;border-bottom:1px solid #e3e9f1">'+esc(x.description)+'</td><td style="padding:10px;border-bottom:1px solid #e3e9f1;text-align:center">'+esc(x.quantity)+'</td><td style="padding:10px;border-bottom:1px solid #e3e9f1;text-align:right">'+money(x.unit_amount)+'</td><td style="padding:10px;border-bottom:1px solid #e3e9f1;text-align:right">'+money(x.amount)+'</td></tr>').join("");
 const html='<!doctype html><html><body style="margin:0;background:#eef3f8;font-family:Arial,sans-serif;color:#183653"><table width="100%"><tr><td align="center" style="padding:28px 16px"><table width="640" style="width:100%;max-width:640px;background:#fff;border:1px solid #dbe4ef;border-radius:12px;overflow:hidden"><tr><td style="background:#102f55;padding:22px 28px"><img src="https://elpbnytpciqnbexiaebp.supabase.co/storage/v1/object/public/enterprise_branding/workforce-dot2.png" width="210" alt="Workforce DOT | screenings4u"></td></tr><tr><td style="padding:28px"><div style="font-size:12px;font-weight:bold;color:#f97300;letter-spacing:.08em">WORKFORCE DOT INVOICE</div><h1 style="color:#102f55;margin:8px 0 4px">'+esc(inv.invoice_title||inv.invoice_number)+'</h1><p style="margin:0 0 20px;color:#6b7f93">Invoice '+esc(inv.invoice_number)+' for '+esc(cust.name)+'</p><table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #e3e9f1"><tr style="background:#f6f8fb"><th align="left" style="padding:10px">Description</th><th style="padding:10px">Qty</th><th align="right" style="padding:10px">Rate</th><th align="right" style="padding:10px">Amount</th></tr>'+rows+'</table><table width="100%" style="margin-top:18px"><tr><td></td><td width="240"><table width="100%"><tr><td style="padding:5px">Subtotal</td><td align="right">'+money(inv.subtotal)+'</td></tr><tr><td style="padding:5px">Tax</td><td align="right">'+money(inv.tax)+'</td></tr><tr><td style="padding:5px">Credits</td><td align="right">-'+money(inv.credits)+'</td></tr><tr><td style="padding:8px 5px;font-weight:bold;border-top:2px solid #102f55">Balance Due</td><td align="right" style="font-weight:bold;border-top:2px solid #102f55">'+money(inv.amount_due)+'</td></tr></table></td></tr></table><p style="margin:24px 0 10px"><a href="'+esc(pay)+'" style="display:inline-block;background:#f97300;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-weight:bold">Pay Invoice</a></p><p style="font-size:12px;color:#6d7f92;margin-top:22px">This invoice was issued by Workforce DOT | screenings4u. No account or sign-in is needed. Select Pay Invoice to pay securely.</p></td></tr></table></td></tr></table></body></html>';
 const rr=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[inv.recipient_email],subject:"Workforce DOT invoice "+inv.invoice_number,html,reply_to:["support@screenings4u.com"]})});
 const body=await rr.json().catch(()=>({})); if(!rr.ok||!body.id)throw new Error(body?.message||"Invoice email delivery failed."); return body.id;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H}); if(req.method!=="POST")return J({error:"Method not allowed."},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return J({error:"Authentication required."},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
  const u=await auth.auth.getUser(token); if(u.error||!u.data.user)return J({error:"Authentication required."},401); const uid=u.data.user.id;
  const p=await perms(db,uid); if(!p.has("dot.view")&&!p.has("dot.manage"))return J({error:"DOT staff access is required."},403);
  const b=await req.json().catch(()=>({})),action=S(b.action||"list");
  if(action==="list"){
    const [iq,itemQ,ctpaQ,empQ,ownerQ,orgQ]=await Promise.all([
      db.from("dot_invoices").select("*").order("created_at",{ascending:false}).limit(2000),
      db.from("dot_invoice_items").select("*").order("created_at"),
      db.from("ctpas").select("*").neq("status","inactive"),
      db.from("employers").select("*").eq("workforce_classification","DOT").is("archived_at",null),
      db.from("owner_operators").select("*").is("archived_at",null),
      db.from("organizations").select("id,legal_name,dba_name,primary_email")
    ]); for(const q of [iq,itemQ,ctpaQ,empQ,ownerQ,orgQ])if(q.error)throw q.error;
    const orgs=new Map((orgQ.data||[]).map((x:any)=>[x.id,x]));
    const ctpas=(ctpaQ.data||[]).map((x:any)=>({...x,organization:orgs.get(x.organization_id)||null}));
    const direct=(empQ.data||[]).filter((x:any)=>!x.ctpa_id);
    const owners=ownerQ.data||[];
    const items=itemQ.data||[];
    const customerName=(i:any)=>i.customer_type==="ctpa"?(ctpas.find((x:any)=>x.id===i.ctpa_id)?.organization?.dba_name||ctpas.find((x:any)=>x.id===i.ctpa_id)?.organization?.legal_name||"C/TPA"):i.customer_type==="owner_operator"?(owners.find((x:any)=>x.id===i.owner_operator_id)?.dba_name||owners.find((x:any)=>x.id===i.owner_operator_id)?.legal_name||"Owner-Operator"):(direct.find((x:any)=>x.id===i.employer_id)?.dba_name||direct.find((x:any)=>x.id===i.employer_id)?.legal_name||"Direct Employer");
    return J({invoices:(iq.data||[]).map((i:any)=>({...i,customer_name:customerName(i),invoice_items:items.filter((x:any)=>x.invoice_id===i.id),can_pay:["open","past_due"].includes(String(i.status))&&Number(i.amount_due||0)>0})),ctpas,direct_employers:direct,owner_operators:owners});
  }
  if(action==="get"){
    const id=S(b.id); if(!id)return J({error:"Invoice id is required."},400);
    const iq=await db.from("dot_invoices").select("*").eq("id",id).maybeSingle(); if(iq.error)throw iq.error;if(!iq.data)return J({error:"Invoice not found."},404);
    const [itemsQ,eventsQ,payQ]=await Promise.all([db.from("dot_invoice_items").select("*").eq("invoice_id",id).order("created_at"),db.from("dot_invoice_events").select("*").eq("invoice_id",id).order("created_at",{ascending:false}),db.from("dot_payments").select("*").eq("invoice_id",id).order("created_at",{ascending:false})]);for(const q of [itemsQ,eventsQ,payQ])if(q.error)throw q.error;
    const cust=await customer(db,iq.data.customer_type,iq.data.customer_type==="ctpa"?iq.data.ctpa_id:iq.data.customer_type==="owner_operator"?iq.data.owner_operator_id:iq.data.employer_id);
    return J({invoice:{...iq.data,customer_name:cust.name,invoice_items:itemsQ.data||[],can_pay:["open","past_due"].includes(String(iq.data.status))&&Number(iq.data.amount_due||0)>0},customer:cust,events:eventsQ.data||[],payments:payQ.data||[]});
  }
  if(["save","push","void","mark_paid"].includes(action)&&!p.has("dot.manage"))return J({error:"DOT management permission is required."},403);
  if(action==="save"){
    const x=b.invoice||{},type=S(x.customer_type),cid=S(x.customer_id); if(!type||!cid)return J({error:"Customer type and customer are required."},400);
    const cust=await customer(db,type,cid),items=Array.isArray(x.items)?x.items.filter((z:any)=>S(z.description)&&Number(z.quantity)>0):[]; if(!items.length)return J({error:"Add at least one invoice line item."},400);
    const subtotal=items.reduce((n:number,z:any)=>n+Number(z.quantity||0)*Number(z.unit_amount||0),0),tax=Math.max(0,Number(x.tax||0)),credits=Math.max(0,Number(x.credits||0)),total=Math.max(0,subtotal+tax-credits),now=N(),id=S(x.id)||crypto.randomUUID();
    let old:any=null;if(x.id){const q=await db.from("dot_invoices").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;old=q.data;if(!old)return J({error:"Invoice not found."},404)}
    if(old&&(Number(old.amount_paid||0)>0||old.sent_at||["paid","void","refunded","uncollectible"].includes(String(old.status))))return J({error:"Paid, sent, or voided invoices are locked. Create a corrected invoice instead."},409);
    const paid=Number(old?.amount_paid||0),row:any={id,tenant_id:cust.tenant_id,customer_type:type,ctpa_id:cust.ctpa_id,employer_id:cust.employer_id,owner_operator_id:cust.owner_operator_id,invoice_number:old?.invoice_number||invoiceNum(),invoice_title:S(x.invoice_title)||"screenings4u DOT Invoice",currency:S(x.currency||old?.currency||"USD").toUpperCase(),subtotal,tax,credits,total,amount_paid:paid,amount_due:Math.max(0,total-paid),status:old?.status||"draft",due_at:x.due_at||null,notes:S(x.notes)||null,internal_memo:S(x.internal_memo)||null,recipient_name:S(x.recipient_name)||cust.name,recipient_email:S(x.recipient_email)||cust.email||null,purchase_order:S(x.purchase_order)||null,service_period_start:x.service_period_start||null,service_period_end:x.service_period_end||null,payment_terms:S(x.payment_terms)||"Due on receipt",terms_text:S(x.terms_text)||null,metadata:{...(old?.metadata||{}),customer_id:cid,source:"dot_management"},updated_at:now};
    let q:any;if(old){q=await db.from("dot_invoices").update(row).eq("id",id).select("*").single()}else q=await db.from("dot_invoices").insert({...row,created_by:uid,created_at:now}).select("*").single();if(q.error)throw q.error;
    const del=await db.from("dot_invoice_items").delete().eq("invoice_id",id);if(del.error)throw del.error;
    const rows=items.map((z:any)=>({id:crypto.randomUUID(),invoice_id:id,tenant_id:cust.tenant_id,item_type:"service",description:S(z.description),quantity:Number(z.quantity),unit_amount:Number(z.unit_amount),amount:Number(z.quantity)*Number(z.unit_amount),testing_order_id:z.testing_order_id||null,created_at:now}));
    const ins=await db.from("dot_invoice_items").insert(rows);if(ins.error)throw ins.error;await emit(db,q.data,old?"updated":"created",old?"Invoice updated":"Invoice created",uid,{customer_type:type});
    return J({invoice:{...q.data,customer_name:cust.name,invoice_items:rows},customer:cust});
  }
  if(action==="push"){
    const id=S(b.id||b.invoice_id),iq=await db.from("dot_invoices").select("*").eq("id",id).maybeSingle();if(iq.error)throw iq.error;if(!iq.data)return J({error:"Invoice not found."},404);
    const inv=iq.data,cust=await customer(db,inv.customer_type,inv.customer_type==="ctpa"?inv.ctpa_id:inv.customer_type==="owner_operator"?inv.owner_operator_id:inv.employer_id); if(!inv.recipient_email&&!cust.email)return J({error:"A billing email is required before this invoice can be sent."},400);
    const itemsQ=await db.from("dot_invoice_items").select("*").eq("invoice_id",id).order("created_at");if(itemsQ.error)throw itemsQ.error;
    const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
    const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));const tokenHash=Array.from(new Uint8Array(digest)).map((n:number)=>n.toString(16).padStart(2,"0")).join("");
    const linkWrite=await db.from("dot_invoice_guest_links").upsert({invoice_id:id,token_hash:tokenHash,revoked_at:null},{onConflict:"invoice_id"});if(linkWrite.error)throw linkWrite.error;
    const now=N(),pay="https://app.screenings4u.com/global-checkout.html?token="+encodeURIComponent(token),view=billingUrl(inv.customer_type),uq=await db.from("dot_invoices").update({status:inv.status==="draft"?"open":inv.status,issued_at:inv.issued_at||now,sent_at:now,pushed_at:now,pushed_by:uid,payment_url:pay,view_url:view,recipient_email:inv.recipient_email||cust.email,updated_at:now}).eq("id",id).select("*").single();if(uq.error)throw uq.error;
    let email_id=null,email_error=null;try{email_id=await emailInvoice(uq.data,itemsQ.data||[],cust)}catch(e){email_error=e instanceof Error?e.message:String(e)}
    if(email_error){await db.from("dot_invoices").update({sent_at:null,pushed_at:null,updated_at:N()}).eq("id",id)}
    await emit(db,uq.data,"pushed",email_error?"Invoice pushed to portal; email delivery needs attention.":"Invoice pushed to portal and emailed.",uid,{email_id,email_error});
    return J({invoice:{...uq.data,invoice_items:itemsQ.data||[]},email_id,email_error,payment_url:pay,portal_url:view});
  }
  if(action==="prepare_payment"){
    const id=S(b.id||b.invoice_id),iq=await db.from("dot_invoices").select("*").eq("id",id).maybeSingle();if(iq.error)throw iq.error;if(!iq.data)return J({error:"Invoice not found."},404);
    const inv=iq.data,due=Number(inv.amount_due||0);if(due<=0||String(inv.status)==="paid")return J({error:"This invoice is already paid."},409);if(["void","cancelled","uncollectible"].includes(String(inv.status)))return J({error:"This invoice is not payable."},409);
    const stripeKey=Deno.env.get("STRIPE_SECRET_KEY")||"",publishable=Deno.env.get("STRIPE_PUBLISHABLE_KEY")||"";if(!stripeKey||!publishable)return J({error:"Secure payment is not configured."},503);
    const Stripe=(await import("npm:stripe@18.5.0")).default;const stripe=new Stripe(stripeKey,{apiVersion:"2025-08-27.basil"});
    let pi:any=null;if(inv.stripe_payment_intent_id){try{pi=await stripe.paymentIntents.retrieve(inv.stripe_payment_intent_id)}catch(_){}}
    if(!pi||["canceled","succeeded"].includes(String(pi.status))){
      pi=await stripe.paymentIntents.create({amount:Math.max(1,Math.round(due*100)),currency:String(inv.currency||"USD").toLowerCase(),automatic_payment_methods:{enabled:true},receipt_email:inv.recipient_email||undefined,description:`Workforce DOT invoice ${inv.invoice_number||id}`,metadata:{purpose:"dot_invoice",dot_invoice_id:id,customer_type:String(inv.customer_type||""),ctpa_id:inv.ctpa_id||"",employer_id:inv.employer_id||"",owner_operator_id:inv.owner_operator_id||"",tenant_id:inv.tenant_id||"",source:"dot_management_phone_payment"}})
    }
    const now=N(),uq=await db.from("dot_invoices").update({stripe_payment_intent_id:pi.id,stripe_payment_intent_amount:Math.round(due*100),stripe_payment_intent_updated_at:now,updated_at:now}).eq("id",id).select("*").single();if(uq.error)throw uq.error;
    await emit(db,uq.data,"payment_started","Secure Stripe payment started from DOT management.",uid,{payment_intent_id:pi.id,amount:due});
    return J({invoice:uq.data,client_secret:pi.client_secret,publishable_key:publishable,payment_intent_id:pi.id,amount:due,currency:inv.currency||"USD"});
  }
  if(action==="confirm_payment"){
    const id=S(b.id||b.invoice_id),piId=S(b.payment_intent_id);if(!id||!piId)return J({error:"Invoice and payment intent are required."},400);
    const iq=await db.from("dot_invoices").select("*").eq("id",id).maybeSingle();if(iq.error)throw iq.error;if(!iq.data)return J({error:"Invoice not found."},404);const inv=iq.data;
    const stripeKey=Deno.env.get("STRIPE_SECRET_KEY")||"";if(!stripeKey)return J({error:"Secure payment is not configured."},503);const Stripe=(await import("npm:stripe@18.5.0")).default;const stripe=new Stripe(stripeKey,{apiVersion:"2025-08-27.basil"}),pi=await stripe.paymentIntents.retrieve(piId);
    if(pi.status!=="succeeded")return J({error:"Payment has not completed yet.",payment_status:pi.status},409);
    if(S(inv.stripe_payment_intent_id)!==pi.id||S(pi.metadata?.dot_invoice_id)!==id||S(pi.metadata?.tenant_id)!==S(inv.tenant_id))return J({error:"Payment does not belong to this invoice."},409);
    if(String(pi.currency||"").toUpperCase()!==String(inv.currency||"USD").toUpperCase()||Number(pi.amount_received||0)!==Math.round(Number(inv.stripe_payment_intent_amount||0)))return J({error:"Payment amount or currency mismatch."},409);
    const existing=await db.from("dot_payments").select("id,invoice_id").eq("external_payment_id",pi.id).maybeSingle();
    if(existing.error)throw existing.error;
    if(existing.data){if(S(existing.data.invoice_id)!==id)return J({error:"Payment is already assigned to another invoice."},409);return J({invoice:inv,payment:existing.data,already_recorded:true});}

    const now=N(),paid=Math.min(Number(inv.amount_due||0),Number(pi.amount_received||pi.amount||0)/100),newPaid=Math.min(Number(inv.total||0),Number(inv.amount_paid||0)+paid),due=Math.max(0,Number(inv.total||0)-newPaid),status=due<=0?"paid":"open";
    const uq=await db.from("dot_invoices").update({amount_paid:newPaid,amount_due:due,status,paid_at:status==="paid"?now:inv.paid_at,updated_at:now}).eq("id",id).select("*").single();if(uq.error)throw uq.error;
    const pq=await db.from("dot_payments").insert({id:crypto.randomUUID(),tenant_id:inv.tenant_id,ctpa_id:inv.ctpa_id||null,employer_id:inv.employer_id||null,invoice_id:id,external_payment_id:pi.id,payment_method:"stripe",amount:paid,currency:String(inv.currency||"USD").toUpperCase(),status:"succeeded",paid_at:now,created_at:now,metadata:{source:"dot_management_phone_payment",owner_operator_id:inv.owner_operator_id||null,recorded_by:uid}}).select("*").single();if(pq.error)throw pq.error;
    await emit(db,uq.data,"payment_received","Stripe payment received through DOT management.",uid,{payment_intent_id:pi.id,amount:paid,dot_payment_id:pq.data.id});
    if(status==="paid"){try{const nr=await fetch(url+"/functions/v1/dot-invoice-payment-notify",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+svc,apikey:svc},body:JSON.stringify({invoice_id:id,payment_id:pq.data.id})});if(!nr.ok)console.error("DOT invoice admin notification failed",nr.status,await nr.text())}catch(e){console.error("DOT invoice admin notification failed",e)}}
    return J({invoice:uq.data,payment:pq.data});
  }
  if(action==="void"){
    const id=S(b.id||b.invoice_id);const old=await db.from("dot_invoices").select("status,amount_paid,paid_at,stripe_payment_intent_id").eq("id",id).maybeSingle();if(old.error)throw old.error;if(!old.data||["paid","void","refunded"].includes(String(old.data.status))||Number(old.data.amount_paid||0)>0||old.data.paid_at||old.data.stripe_payment_intent_id)return J({error:"Paid or previously voided invoices cannot be voided."},409);
    const q=await db.from("dot_invoices").update({status:"void",voided_at:N(),void_reason:S(b.reason)||"Voided by DOT management",amount_due:0,updated_at:N()}).eq("id",id).in("status",["draft","open","past_due","sent"]).eq("amount_paid",0).select("*").single();if(q.error)throw q.error;await emit(db,q.data,"voided",q.data.void_reason,uid);return J({invoice:q.data});
  }
  if(action==="mark_paid"){
    const id=S(b.id||b.invoice_id),iq=await db.from("dot_invoices").select("*").eq("id",id).maybeSingle();if(iq.error)throw iq.error;if(!iq.data)return J({error:"Invoice not found."},404);const inv=iq.data,now=N(),amount=Number(b.amount||inv.amount_due||0),newPaid=Math.min(Number(inv.total||0),Number(inv.amount_paid||0)+amount),due=Math.max(0,Number(inv.total||0)-newPaid),status=due<=0?"paid":"open";
    const q=await db.from("dot_invoices").update({amount_paid:newPaid,amount_due:due,status,paid_at:status==="paid"?now:inv.paid_at,updated_at:now}).eq("id",id).select("*").single();if(q.error)throw q.error;
    const pay=await db.from("dot_payments").insert({id:crypto.randomUUID(),tenant_id:inv.tenant_id,ctpa_id:inv.ctpa_id||null,employer_id:inv.employer_id||null,invoice_id:id,payment_method:"manual",amount,currency:inv.currency||"USD",status:"succeeded",paid_at:now,created_at:now,metadata:{source:"dot_management",recorded_by:uid}});if(pay.error)throw pay.error;await emit(db,q.data,"payment_recorded","Manual payment recorded",uid,{amount});return J({invoice:q.data});
  }
  return J({error:"Unsupported invoice action."},400);
 }catch(e){console.error("dot-invoice-admin",e);return J({error:e instanceof Error?e.message:String(e)},500)}
});