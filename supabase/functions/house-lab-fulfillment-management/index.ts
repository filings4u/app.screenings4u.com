import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const J=(d:any,s=200)=>new Response(JSON.stringify(d),{headers:H,status:s});
const V=(x:any)=>String(x??"").trim(), UUID=/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;
const esc=(s:any)=>V(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
const shell=(title:string,body:string)=>'<div style="background:#f2f6fb;padding:28px;font-family:Arial,sans-serif;color:#17365f"><div style="max-width:620px;margin:auto;border-radius:12px;overflow:hidden;background:white;border:1px solid #dce5f0"><div style="background:#24467f;padding:22px"><img src="https://elpbnytpciqnbexiaebp.supabase.co/storage/v1/object/public/enterprise_branding/workforce2.png" width="230" alt="Workforce | screenings4u"></div><div style="padding:26px"><h1>'+esc(title)+'</h1>'+body+'<p style="margin-top:28px;color:#65758d">Workforce | screenings4u · support@screenings4u.com</p></div></div></div>';
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers:H});
 if(req.method!=="POST")return J({error:"POST required"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const bearer=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(bearer);
 if(authError||!user)return J({error:"Authentication required"},401);
 const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
 const [staff,role,access]=await Promise.all([
 db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
 db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
 db.from("staff_business_access").select("id").eq("user_id",user.id).eq("business_unit_code","testing").eq("active",true).limit(1)
 ]);
 if(staff.error||role.error||access.error)throw staff.error||role.error||access.error;
 if(staff.data?.employment_status!=="active"||!role.data?.length||!access.data?.length)return J({error:"Testing management permission required"},403);
 const b=await req.json().catch(()=>({})),action=V(b.action||"list");
 const purchase=async(id:string)=>{
   if(!UUID.test(id))return null;
   const r=await db.from("lab_account_intakes").select("id,order_id,order_number,customer_email,customer_user_id,service_sku,status,account_status,created_at").eq("id",id).maybeSingle();
   if(r.error)throw r.error;return r.data;
 };
 const notify=async(kind:string,p:any,subject:string,html:string,relatedId:string)=>{
   const email=V(p.customer_email);if(!email)return {status:"missing_email"};
   const apiKey=Deno.env.get("RESEND_API_KEY")||"";
   if(!apiKey)return {status:"email_not_configured"};
   const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[email],subject,html})});
   const result=await response.json().catch(()=>({}));
   const status=response.ok?"sent":"failed";
   const audit=await db.from("testing_email_events").insert({event_type:kind,related_entity_type:"house_lab",related_entity_id:relatedId,recipient_email:email,subject,provider:"resend",provider_message_id:result.id||null,status,error_message:response.ok?null:V(result.message||"Provider rejected"),sent_at:response.ok?new Date().toISOString():null,created_by:user.id,metadata:{intake_id:p.id}});
   if(audit.error)console.error("Email audit:",audit.error.code);
   return {status};
 };
 if(action==="list"){
   const [a,sh,inv]=await Promise.all([
     db.from("lab_account_intakes").select("id,order_id,order_number,customer_email,service_sku,status,account_status,created_at").order("created_at",{ascending:false}).limit(500),
     db.from("house_lab_supply_shipments").select("id,intake_id,status,carrier,tracking_number,tracking_url,items_description,notes,created_at,updated_at,notification_sent_at").order("created_at",{ascending:false}).limit(1500),
     db.from("invoices").select("id,order_id,invoice_number,status,total,amount_due,sent_at,customer_email").order("created_at",{ascending:false}).limit(1500)
   ]);
   if(a.error||sh.error||inv.error)throw a.error||sh.error||inv.error;
   return J({purchases:a.data||[],shipments:sh.data||[],invoices:inv.data||[]});
 }
 const p=await purchase(V(b.intake_id));
 if(!p)return J({error:"House Lab Account intake not found"},404);
 if(action==="purchase"){
   const [s,i]=await Promise.all([
     db.from("house_lab_supply_shipments").select("*").eq("intake_id",p.id).order("created_at",{ascending:false}),
     db.from("invoices").select("id,invoice_number,status,total,amount_due,sent_at,created_at").eq("order_id",p.order_id)
   ]);
   if(s.error||i.error)throw s.error||i.error;return J({purchase:p,shipments:s.data||[],invoices:i.data||[]});
 }
 if(action==="save_shipment"&&p.service_sku==="lab-account-workflow-test-1")return J({error:"The $1 workflow test cannot create physical supply shipments. Use a production House Lab Account for real logistics."},409);
 if(action==="create_invoice"&&p.service_sku==="lab-account-workflow-test-1"){
   const amount=Number(b.unit_price);
   if(amount!==0||!/^TEST\b/i.test(V(b.description)))return J({error:"The $1 workflow test allows only $0 TEST-marked invoice drafts, never real testing charges."},409);
 }
 if(action==="save_shipment"){
   if(p.account_status!=="active"||p.status!=="completed")return J({error:"Review the intake, assign laboratory numbers and activate the C/TPA before ordering physical supplies."},409);
   const org=await db.from("organizations").select("id").ilike("primary_email",p.customer_email).neq("status","archived").limit(2);
   if(org.error)throw org.error;
   if(org.data?.length!==1)return J({error:"Verify the customer C/TPA organization before fulfilling supplies."},409);
   const ctpa=await db.from("ctpas").select("id,status").eq("organization_id",org.data[0].id).maybeSingle();
   if(ctpa.error)throw ctpa.error;
   if(ctpa.data?.status!=="active")return J({error:"Activate C/TPA operational access before shipping laboratory supplies."},409);
   const id=V(b.id),status=V(b.status||"preparing"),carrier=V(b.carrier||"Other"),number=V(b.tracking_number),trackingURL=V(b.tracking_url);
   if(!["preparing","ordered","shipped","delivered","cancelled"].includes(status)||carrier.length>80||number.length>160||V(b.items_description).length>2000||V(b.notes).length>2000)return J({error:"Invalid shipment details"},400);
   if(trackingURL&&(!/^https:\/\//i.test(trackingURL)||trackingURL.length>1000))return J({error:"Tracking URL must use HTTPS"},400);
   if(status==="shipped"&&(!number||!trackingURL))return J({error:"A tracking number and HTTPS tracking URL are required for shipped status"},400);
   let old:any=null;
   if(id){
     const o=await db.from("house_lab_supply_shipments").select("*").eq("id",id).eq("intake_id",p.id).maybeSingle();if(o.error)throw o.error;if(!o.data)return J({error:"Shipment not found"},404);old=o.data;
   }
   const payload={intake_id:p.id,status,carrier,tracking_number:number||null,tracking_url:trackingURL||null,items_description:V(b.items_description),notes:V(b.notes),updated_at:new Date().toISOString(),...(old?.tracking_number!==number?{notification_sent_at:null}:{})};
   const res=id?await db.from("house_lab_supply_shipments").update(payload).eq("id",id).eq("intake_id",p.id).select("*").single():await db.from("house_lab_supply_shipments").insert({...payload,created_by:user.id}).select("*").single();
   if(res.error)throw res.error;
   let emailStatus="not_required";
   if(status==="shipped"&&!res.data.notification_sent_at){
     const subject="Workforce | screenings4u — Your laboratory supplies have shipped — "+p.order_number;
     const html=shell("Your lab supplies are on the way",'<p>Your House Lab Account supplies for order <strong>'+esc(p.order_number)+'</strong> have shipped.</p><p>Carrier: <strong>'+esc(carrier)+'</strong><br>Tracking number: <strong>'+esc(number)+'</strong></p><p><a href="'+esc(trackingURL)+'" style="display:inline-block;background:#f36b00;color:white;text-decoration:none;border-radius:8px;padding:14px 20px">Track your shipment</a></p><p>Your tracking details are also available in your Lab Account portal.</p>');
     const result=await notify("house_lab_shipment_tracking",p,subject,html,res.data.id).catch(() => ({status:"failed"}));
     emailStatus=result.status;
     if(emailStatus==="sent"){const u=await db.from("house_lab_supply_shipments").update({notification_sent_at:new Date().toISOString()}).eq("id",res.data.id);if(u.error)throw u.error;}
   }
   return J({ok:true,shipment:res.data,email_status:emailStatus});
 }
 if(action==="create_invoice"){
   const description=V(b.description),quantity=Number(b.quantity),unitPrice=Number(b.unit_price);
   if(!description||description.length>1000||!Number.isInteger(quantity)||quantity<1||quantity>10000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>1000000)return J({error:"Valid description, quantity, and unit price are required"},400);
   const customerOrg=await db.from("organizations").select("id,legal_name").ilike("primary_email",p.customer_email).neq("status","archived").limit(2);
   if(customerOrg.error)throw customerOrg.error;
   if((customerOrg.data||[]).length!==1)return J({error:"Link the customer's unique C/TPA organization before creating an invoice."},409);
   const customerProfile=p.customer_user_id?await db.from("user_profiles").select("id").eq("id",p.customer_user_id).maybeSingle():{data:null,error:null};
   if(customerProfile.error)throw customerProfile.error;
   const total=Math.round(quantity*unitPrice*100)/100,invoiceId=crypto.randomUUID(),reference="HLA-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+invoiceId.slice(0,8).toUpperCase();
   const invoice=await db.from("invoices").insert({id:invoiceId,order_id:p.order_id,invoice_number:reference,status:"draft",employer_id:customerOrg.data[0].id,customer_user_id:customerProfile.data?.id||null,customer_email:p.customer_email,subtotal:total,total,amount_due:total,amount_paid:0,discount_total:0,tax_total:0,currency:"USD",customer_name:customerOrg.data[0].legal_name||p.customer_email,created_by:user.id,metadata:{source:"house_lab_account_management",intake_id:p.id}}).select("id,invoice_number,status,total").single();
   if(invoice.error)throw invoice.error;
   const item=await db.from("invoice_items").insert({invoice_id:invoiceId,description,quantity,unit_price:unitPrice,line_total:total});
   if(item.error){await db.from("invoices").delete().eq("id",invoiceId);throw item.error;}
   return J({ok:true,invoice:invoice.data});
 }
 if(action==="send_invoice"){
   const invoiceId=V(b.invoice_id);if(!UUID.test(invoiceId))return J({error:"Select an invoice"},400);
   const q=await db.from("invoices").select("id,invoice_number,status,total,sent_at").eq("id",invoiceId).eq("order_id",p.order_id).maybeSingle();
   if(q.error)throw q.error;if(!q.data)return J({error:"Invoice not found"},404);
   if(q.data.status==="paid"||q.data.status==="void")return J({error:"Invoice cannot be sent in its current state"},409);
   if(q.data.sent_at)return J({ok:true,already_sent:true});
   const subject=(p.service_sku==="lab-account-workflow-test-1"?"Workforce | screenings4u — TEST ONLY sample invoice — ":"Workforce | screenings4u — New invoice available — ")+q.data.invoice_number;
   const html=shell("New lab testing invoice",'<p>Your invoice <strong>'+esc(q.data.invoice_number)+'</strong> is ready to review in your secure portal.</p><p><strong>Amount:</strong> $'+Number(q.data.total||0).toFixed(2)+'</p><a href="'+esc("https://lab-account.screenings4u.com/invoice-view.html?id="+encodeURIComponent(invoiceId))+'" style="display:inline-block;background:#f36b00;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View invoice in your portal</a>');
   const response=await notify("house_lab_invoice_available",p,subject,html,invoiceId);
   if(response.status!=="sent")return J({error:"Invoice saved but email could not be sent: "+response.status},503);
   const update=await db.from("invoices").update({status:"sent",sent_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",invoiceId).eq("order_id",p.order_id);
   if(update.error)throw update.error;
   return J({ok:true,sent:true});
 }
 return J({error:"Unsupported management action"},400);
 }catch(e){console.error("house lab fulfillment",e);return J({error:"House lab management operation failed"},500)}
});