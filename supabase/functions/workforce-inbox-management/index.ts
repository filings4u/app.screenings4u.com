import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const J=(x:any,status=200)=>new Response(JSON.stringify(x),{status,headers:H});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return J({error:"Method not allowed"},405);
 try{
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return J({error:"Authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await auth.auth.getUser(token);if(result.error||!result.data.user)return J({error:"Authentication required"},401);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const id=result.data.user.id;
  const [staff,roles,access]=await Promise.all([
   db.from("staff_profiles").select("employment_status").eq("user_id",id).maybeSingle(),
   db.from("staff_role_assignments").select("role_code").eq("user_id",id).eq("active",true).limit(10),
   db.from("staff_business_access").select("business_unit_code").eq("user_id",id).eq("active",true).in("business_unit_code",["workforce","testing"]).limit(10)
  ]);
  if(staff.error||roles.error||access.error)throw staff.error||roles.error||access.error;
  if(staff.data?.employment_status!=="active"||!roles.data?.length||!access.data?.length)return J({error:"Workforce management access required"},403);
  const payload=await req.json().catch(()=>({}));

  if(["billing_save","billing_void","billing_send"].includes(payload.action)){
    const permsQ=await db.from("staff_role_permissions").select("permission_key").in("role_code",(roles.data||[]).map((x:any)=>x.role_code)).eq("allowed",true);
    if(permsQ.error)throw permsQ.error;
    if(!(permsQ.data||[]).some((x:any)=>["dot.manage","nondot.manage","billing.manage","invoices.manage","workforce.manage"].includes(x.permission_key)))return J({error:"Billing management permission required"},403);
    const invoiceId=String(payload.id||"");
    if(invoiceId&&!/^[0-9a-f-]{36}$/i.test(invoiceId))return J({error:"Invalid invoice ID"},400);
    const found=invoiceId?await db.from("invoices").select("*").eq("id",invoiceId).maybeSingle():{data:null,error:null};
    if(found.error)throw found.error;
    const inv=found.data;
    if(invoiceId&&!inv)return J({error:"Invoice not found"},404);
    if(payload.action==="billing_void"){
      if(!inv||!["draft","open","sent","past_due"].includes(inv.status)||Number(inv.amount_paid||0)>0)return J({error:"Only unpaid invoices may be voided"},409);
      const reason=String(payload.reason||"").trim();if(reason.length<5)return J({error:"Provide a void reason"},400);
      const now=new Date().toISOString();
      const r=await db.from("invoices").update({status:"void",amount_due:0,public_token_revoked_at:now,notes:[inv.notes||"","Voided: "+reason].join("\n"),updated_at:now,metadata:{...(inv.metadata||{}),void_reason:reason,voided_by:id,voided_at:now}}).eq("id",invoiceId).eq("amount_paid",0).in("status",["draft","open","sent","past_due"]).select("id,status").maybeSingle();
      if(r.error)throw r.error;if(!r.data)return J({error:"Invoice changed; refresh"},409);return J({ok:true,invoice:r.data});
    }
    if(payload.action==="billing_save"){
      if(inv&&(!["draft","open"].includes(inv.status)||inv.sent_at||Number(inv.amount_paid||0)>0||inv.stripe_payment_intent_id))return J({error:"Only unpaid unsent invoices may be edited"},409);
      const v=payload.invoice||{},name=String(v.customer_name||"").trim().slice(0,200),email=String(v.customer_email||"").trim().toLowerCase();
      if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return J({error:"Customer name and valid email required"},400);
      const items=Array.isArray(v.items)?v.items.map((x:any)=>({description:String(x.description||"").trim(),quantity:Number(x.quantity),unit_price:Number(x.unit_price)})):[];
      if(!items.length||items.length>30||items.some((x:any)=>!x.description||!Number.isFinite(x.quantity)||x.quantity<=0||!Number.isFinite(x.unit_price)||x.unit_price<0))return J({error:"Valid line items are required"},400);
      const round=(x:number)=>Math.round((x+Number.EPSILON)*100)/100;
      const subtotal=round(items.reduce((n:number,x:any)=>n+round(x.quantity*x.unit_price),0)),tax=Number(v.tax_total||0),discount=Number(v.discount_total||0);
      if(!Number.isFinite(tax)||!Number.isFinite(discount)||tax<0||discount<0||round(subtotal+tax-discount)<0)return J({error:"Invalid invoice totals"},400);
      const total=round(subtotal+tax-discount),now=new Date().toISOString(),id2=inv?.id||crypto.randomUUID();
      const row={customer_name:name,customer_email:email,subtotal,tax_total:round(tax),discount_total:round(discount),total,amount_due:total,due_date:v.due_date||null,terms:String(v.terms||"Due on receipt").slice(0,1500),notes:String(v.notes||"").slice(0,2500),issuer_legal_name:"Workforce",issuer_entity_code:"workforce",issuer_logo_path:"https://workforce.screenings4u.com/images/logo.png",issuer_brand_color:"#01122f",metadata:{...(inv?.metadata||{}),brand:"Workforce",channel:"workforce",created_via:"unified_billing"},updated_at:now};
      const saved=inv?await db.from("invoices").update(row).eq("id",id2).in("status",["draft","open"]).is("sent_at",null).select("id,invoice_number,status").single():await db.from("invoices").insert({id:id2,invoice_number:"WF-INV-"+now.slice(0,10).replaceAll("-","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase(),status:"draft",currency:"USD",issue_date:now.slice(0,10),amount_paid:0,created_by:id,...row}).select("id,invoice_number,status").single();
      if(saved.error)throw saved.error;
      const old=await db.from("invoice_items").delete().eq("invoice_id",id2);if(old.error)throw old.error;
      const ins=await db.from("invoice_items").insert(items.map((x:any)=>({invoice_id:id2,description:x.description.slice(0,500),quantity:x.quantity,unit_price:x.unit_price,line_total:round(x.quantity*x.unit_price)})));
      if(ins.error)throw ins.error;
      return J({ok:true,invoice:saved.data});
    }
    if(payload.action==="billing_send"){
      if(!inv||!["draft","open"].includes(inv.status)||inv.sent_at||Number(inv.amount_due||0)<=0||inv.metadata?.do_not_collect)return J({error:"Invoice cannot be sent"},409);
      if(!inv.public_token||inv.public_token_revoked_at)return J({error:"No valid secure payment link"},409);
      const key=Deno.env.get("RESEND_API_KEY");if(!key)return J({error:"Email service not configured"},503);
      const items=await db.from("invoice_items").select("description,quantity,line_total").eq("invoice_id",invoiceId);if(items.error)throw items.error;
      if(!items.data?.length)return J({error:"Invoice has no line items"},409);
      const esc=(v:any)=>String(v??"").replace(/[&<>"']/g,(k:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[k]||k));
      const money=(v:any)=>Number(v||0).toLocaleString("en-US",{style:"currency",currency:"USD"});
      const link="https://lab-account.screenings4u.com/pay-invoice.html?id="+encodeURIComponent(invoiceId)+"&token="+encodeURIComponent(inv.public_token);
      const lineHtml=items.data.map((x:any)=>"<tr><td style='padding:9px;border-bottom:1px solid #ddd'>"+esc(x.description)+"</td><td>"+esc(x.quantity)+"</td><td>"+money(x.line_total)+"</td></tr>").join("");
      const html="<div style='background:#f1f5fa;padding:30px;font-family:Arial;color:#01122f'><div style='max-width:620px;margin:auto;background:#fff;padding:25px;border-radius:12px'><img src='https://workforce.screenings4u.com/images/logo.png' alt='Workforce' width='200'><h1>Workforce invoice</h1><p>Hello "+esc(inv.customer_name)+", your invoice is ready to review.</p><p><b>"+esc(inv.invoice_number)+"</b></p><table style='width:100%'>"+lineHtml+"</table><h2>Balance due: "+money(inv.amount_due)+"</h2><a style='display:inline-block;background:#fdc102;padding:15px;color:#01122f;text-decoration:none;border-radius:8px' href='"+link+"'>View and Pay Invoice</a><p>"+esc(inv.terms||"")+"</p></div></div>";
      const email=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json","Idempotency-Key":"workforce-invoice-"+invoiceId},body:JSON.stringify({from:Deno.env.get("WORKFORCE_FROM_EMAIL")||Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"Workforce <notifications@screenings4u.com>",to:[inv.customer_email],subject:"Workforce Invoice "+inv.invoice_number+" — "+money(inv.amount_due),html})});
      const result=await email.json().catch(()=>({}));if(!email.ok)return J({error:"Email not accepted: "+String(result.message||email.status)},502);
      const now=new Date().toISOString();const updated=await db.from("invoices").update({status:"sent",sent_at:now,updated_at:now,metadata:{...(inv.metadata||{}),email_provider_id:result.id||null,sent_by:id}}).eq("id",invoiceId).is("sent_at",null);
      if(updated.error)console.error("Invoice email sent but status update failed",updated.error);
      return J({ok:true,sent:true,invoice_number:inv.invoice_number});
    }
  }
  if(payload.action==="invoices"){
    const q=await db.from("invoices").select("id,invoice_number,order_id,customer_name,customer_email,status,issue_date,due_date,total,amount_due,currency,created_at,sent_at,metadata").order("created_at",{ascending:false}).limit(500);
    if(q.error)throw q.error;
    const rows=(q.data||[]).filter((x:any)=>x.metadata?.purpose==="supply_kit"||x.metadata?.brand==="Workforce"||x.metadata?.channel==="workforce");
    return J({ok:true,invoices:rows});
  }
  if(payload.action==="invoice_detail"){
    const invoiceId=String(payload.id||"");
    if(!/^[0-9a-f-]{36}$/i.test(invoiceId))return J({error:"Invalid invoice reference."},400);
    const invoice=await db.from("invoices").select("id,invoice_number,order_id,customer_name,customer_email,status,issue_date,due_date,subtotal,tax_total,total,amount_due,currency,created_at,sent_at,terms,notes,metadata").eq("id",invoiceId).maybeSingle();
    if(invoice.error)throw invoice.error;
    if(!invoice.data||!(invoice.data.metadata?.purpose==="supply_kit"||invoice.data.metadata?.brand==="Workforce"||invoice.data.metadata?.channel==="workforce"))return J({error:"Workforce invoice not found."},404);
    const items=await db.from("invoice_items").select("id,description,quantity,unit_price,line_total").eq("invoice_id",invoiceId);
    if(items.error)throw items.error;
    return J({ok:true,invoice:invoice.data,items:items.data||[]});
  }
  if(payload.action==="ic_detail"){
   const rid=String(payload.id||"");if(!/^[0-9a-f-]{36}$/i.test(rid))return J({error:"Invalid request"},400);
   const q=await db.from("ic_contractor_records").select("id,user_id,section,title,details,status,created_at,updated_at").eq("id",rid).maybeSingle();
   if(q.error)throw q.error;if(!q.data)return J({error:"Request not found"},404);
   const profile=await db.auth.admin.getUserById(q.data.user_id);
   return J({ok:true,record:{...q.data,customer_email:profile.data?.user?.email||""}});
  }
  if(payload.action!=="list")return J({error:"Unsupported action"},400);
  const queries=await Promise.all([
   db.from("workforce_marketing_inquiries").select("id,created_at,first_name,last_name,email,inquiry_type,topic,status,company").order("created_at",{ascending:false}).limit(150),
   db.from("ic_contractor_records").select("id,user_id,section,title,status,created_at").order("created_at",{ascending:false}).limit(150),
   db.from("support_tickets").select("id,ticket_number,subject,requester_email,status,created_at").eq("source","lab_account_portal").order("created_at",{ascending:false}).limit(150),
   db.from("orders").select("id,order_number,customer_email,status,fulfillment_status,created_at,metadata").eq("metadata->>purpose","lab_account").order("created_at",{ascending:false}).limit(150),
   db.from("testing_cases").select("id,case_number,customer_email,status,created_at").eq("metadata->>source","lab_account_portal").order("created_at",{ascending:false}).limit(150),
   db.from("ic_portal_supply_orders").select("id,contractor_user_id,status,created_at").order("created_at",{ascending:false}).limit(150)
  ]);
  const names=["marketing","contractor","lab_support","lab_account_order","lab_testing_request","supply_order"];
  const rows:any[]=[];
  for(let i=0;i<queries.length;i++){
   if(queries[i].error){console.error("Management inbox source",names[i],queries[i].error);continue}
   for(const x of queries[i].data||[]){
    rows.push({
     id:x.id,source:names[i],reference:x.ticket_number||x.order_number||x.case_number||String(x.id).slice(0,8),
     subject:x.subject||x.title||x.topic||x.inquiry_type||(names[i]==="lab_account_order"?"Lab Account Purchase":names[i]==="supply_order"?"Supply Order":"Testing Request"),
     customer:x.email||x.requester_email||x.customer_email||[x.first_name,x.last_name].filter(Boolean).join(" ")||x.user_id||x.contractor_user_id||"",
     status:x.fulfillment_status==="pending"&&names[i]==="lab_account_order"?"fulfillment pending":x.status||"new",
     created_at:x.created_at,
     destination:names[i]==="supply_order"?"ic-supply-management.html":names[i]==="lab_account_order"?"house-lab-fulfillment.html":names[i]==="lab_testing_request"?"workforce-testing.html":names[i]==="contractor"?"workforce-ic-request.html":names[i]==="lab_support"?"workforce-lab-support.html":"workforce-website.html"
    });
   }
  }
  rows.sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
  return J({ok:true,rows:rows.slice(0,300),sources:names});
 }catch(e){console.error("Workforce Inbox",e);return J({error:"Management inbox could not be loaded"},500)}
});