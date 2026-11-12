import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clean=(v:any)=>String(v??"").trim();
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:H});
 if(req.method!=="POST")return J({error:"Method not allowed."},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!svc)return J({error:"Checkout configuration unavailable."},500);
  const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
  const b=await req.json().catch(()=>({})),action=clean(b.action||"get"),id=clean(b.id),token=clean(b.token);
  if(!id||!token)return J({error:"Invoice id and token are required."},400);
  const iq=await db.from("invoices").select("*").eq("id",id).eq("public_token",token).is("public_token_revoked_at",null).maybeSingle();
  if(iq.error)throw iq.error;if(!iq.data)return J({error:"This invoice link is invalid or has been revoked."},404);
  const invoice=iq.data;
  const itemsQ=await db.from("invoice_items").select("*").eq("invoice_id",id).order("created_at");
  if(itemsQ.error)throw itemsQ.error;
  const full={...invoice,items:itemsQ.data||[]};
  if(action==="send_email"){
    if(String(invoice.status)!=="open"&&String(invoice.status)!=="sent")return J({error:"Invoice must be open before sending."},409);
    if(invoice.sent_at)return J({ok:true,already_sent:true});
    if(!invoice.customer_email)return J({error:"Invoice customer email is missing."},400);
    const key=Deno.env.get("RESEND_API_KEY")||"";
    if(!key)return J({error:"Email provider is not configured."},503);
    const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,(k:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[k]||k));
    const paymentUrl="https://ctpa.screenings4u.com/pay-invoice.html?id="+encodeURIComponent(id)+"&token="+encodeURIComponent(token);
    const money=(v:any)=>Number(v||0).toLocaleString("en-US",{style:"currency",currency:"USD"});
    const lines=(itemsQ.data||[]).map((x:any)=>'<tr><td style="padding:12px;border-bottom:1px solid #dce6f1">'+esc(x.description)+'</td><td style="padding:12px;text-align:center;border-bottom:1px solid #dce6f1">'+esc(x.quantity)+'</td><td style="padding:12px;text-align:right;border-bottom:1px solid #dce6f1">'+money(x.line_total)+'</td></tr>').join("");
    const html='<div style="background:#f1f5fa;padding:30px 15px;font-family:Arial,sans-serif;color:#01122f"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #d5e1ed;border-radius:13px;overflow:hidden"><div style="background:#01122f;padding:24px"><img width="210" alt="Workforce" src="https://workforce.screenings4u.com/images/logo2.png"></div><div style="padding:27px"><p style="color:#bb8500;font-size:11px;letter-spacing:1px;font-weight:bold">WORKFORCE BILLING</p><h1 style="margin:5px 0;font-size:26px">Your invoice is ready</h1><p>Hello '+esc(invoice.customer_name||"Customer")+',</p><p>Your request for testing supplies has been converted into a payable Workforce invoice. We will review the shipping arrangements after payment.</p><p><b>Invoice:</b> '+esc(invoice.invoice_number)+'<br><b>Due:</b> '+esc(invoice.due_date||"On receipt")+'</p><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#edf3fa"><th style="text-align:left;padding:12px">Description</th><th>Qty</th><th style="text-align:right;padding:12px">Total</th></tr></thead><tbody>'+lines+'</tbody></table><p style="text-align:right;font-size:22px;font-weight:bold">Amount due: '+money(invoice.amount_due)+'</p><p style="font-size:12px;color:#58718c">'+esc(invoice.terms||"")+'</p><p style="margin:27px 0"><a href="'+paymentUrl+'" style="background:#fdc102;color:#01122f;border-radius:8px;padding:14px 24px;text-decoration:none;font-weight:bold">View and Pay Invoice</a></p><p style="font-size:12px;color:#657c96">If you have questions, reply to Workforce through your customer portal.</p></div></div></div>';
    const subject="Workforce Invoice "+invoice.invoice_number+" — "+money(invoice.amount_due);
    let result:any={},status="failed",issue:string|null=null;
    try{
      const res=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"workforce-supply-invoice-"+id},body:JSON.stringify({from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"Workforce <notifications@screenings4u.com>",to:[invoice.customer_email],subject,html})});
      result=await res.json().catch(()=>({}));status=res.ok?"sent":"failed";if(!res.ok)issue=String(result.message||"Email provider returned "+res.status);
    }catch(e){issue=String(e)}
    const audit=await db.from("testing_email_events").insert({event_type:"workforce_supply_invoice",related_entity_type:"invoice",related_entity_id:id,recipient_email:invoice.customer_email,subject,provider:"resend",provider_message_id:result.id||null,status,error_message:issue,sent_at:status==="sent"?new Date().toISOString():null,metadata:{source:"lab_account_supplies",invoice_number:invoice.invoice_number}});
    if(audit.error)console.error("Invoice send audit",audit.error);
    if(status!=="sent"){console.error("Workforce invoice email failed",issue);return J({error:"Invoice email could not be sent."},502)}
    const u=await db.from("invoices").update({sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).is("sent_at",null);
    if(u.error)console.error("Invoice status update",u.error);
    return J({ok:true,sent:true,invoice_number:invoice.invoice_number});
  }
  if(action==="get"){
    const patch:any={last_viewed_at:new Date().toISOString(),view_count:Number(invoice.view_count||0)+1};
    if(!invoice.first_viewed_at)patch.first_viewed_at=new Date().toISOString();
    await db.from("invoices").update(patch).eq("id",id);
    return J({invoice:{...full,...patch}});
  }
  if(action==="status"){
    return J({invoice:full});
  }
  if(action==="create_payment"){
    const due=Number(invoice.amount_due||0);
    if(due<=0||String(invoice.status)==="paid")return J({error:"This invoice is already paid."},409);
    if(["void","uncollectible"].includes(String(invoice.status)))return J({error:"This invoice is not payable."},409);
    const stripeKey=Deno.env.get("STRIPE_SECRET_KEY")||"",publishable=Deno.env.get("STRIPE_PUBLISHABLE_KEY")||"";
    if(!stripeKey||!publishable)return J({error:"Secure payment is not configured."},500);
    const stripe=new Stripe(stripeKey,{apiVersion:"2025-08-27.basil"});
    let pi:any=null;
    if(invoice.stripe_payment_intent_id){
      try{pi=await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id)}catch(_){}
    }
    if(!pi||["canceled","succeeded"].includes(String(pi.status))){
      pi=await stripe.paymentIntents.create({
        amount:Math.max(1,Math.round(due*100)),currency:String(invoice.currency||"USD").toLowerCase(),
        automatic_payment_methods:{enabled:true},receipt_email:invoice.customer_email||undefined,
        description:`Invoice ${invoice.invoice_number}`,
        metadata:{invoice_id:id,invoice_number:String(invoice.invoice_number||""),business:String(invoice.issuer_entity_code||invoice.metadata?.entity_code||"screenings4u"),source:"invoice_checkout"}
      });
      const uq=await db.from("invoices").update({stripe_payment_intent_id:pi.id,status:String(invoice.status)==="draft"?"open":invoice.status,updated_at:new Date().toISOString()}).eq("id",id);
      if(uq.error)throw uq.error;
      if(invoice.order_id){
        const oq=await db.from("orders").update({stripe_payment_intent_id:pi.id,payment_reference:pi.id,payment_provider:"stripe",payment_status:"pending",updated_at:new Date().toISOString()}).eq("id",invoice.order_id);
        if(oq.error)throw oq.error;
      }
    }
    return J({clientSecret:pi.client_secret,publishableKey:publishable,payment_intent_id:pi.id});
  }
  return J({error:"Unsupported invoice checkout action."},400);
 }catch(e){console.error("invoice-checkout-actions",e);return J({error:e instanceof Error?e.message:String(e)},500)}
});