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
  if(payload.action==="invoices"){
    const q=await db.from("invoices").select("id,invoice_number,order_id,customer_name,customer_email,status,issue_date,due_date,total,amount_due,currency,created_at,sent_at,metadata").order("created_at",{ascending:false}).limit(500);
    if(q.error)throw q.error;
    const rows=(q.data||[]).filter((x:any)=>x.metadata?.purpose==="supply_kit"||x.metadata?.brand==="Workforce"||x.metadata?.channel==="workforce");
    return J({ok:true,invoices:rows});
  }
  if(payload.action==="invoice_detail"){
    const invoiceId=String(payload.id||"");
    if(!/^[0-9a-f-]{36}$/i.test(invoiceId))return J({error:"Invalid invoice reference."},400);
    const invoice=await db.from("invoices").select("id,invoice_number,order_id,customer_name,customer_email,status,issue_date,due_date,subtotal,tax,total,amount_due,currency,created_at,sent_at,terms,notes,metadata").eq("id",invoiceId).maybeSingle();
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