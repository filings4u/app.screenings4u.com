import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
Deno.serve(async(request)=>{
 if(request.method==="OPTIONS")return new Response(null,{headers});
 if(request.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return json({error:"Authentication required"},401);
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const result=await auth.auth.getUser(token);
  const user=result.data.user;
  if(result.error||!user)return json({error:"Authentication required"},401);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const [staff,roles,access]=await Promise.all([
    db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
    db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
    db.from("staff_business_access").select("id").eq("user_id",user.id).eq("active",true).eq("business_unit_code","testing").limit(1)
  ]);
  if(staff.error||roles.error||access.error)throw staff.error||roles.error||access.error;
  if(staff.data?.employment_status!=="active"||!roles.data?.length||!access.data?.length)return json({error:"Testing management authorization required"},403);
  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"status");
  const intakeId=String(body.intake_id||"");
  if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(intakeId))return json({error:"Valid purchase intake ID required"},400);
  const purchase=await db.from("lab_account_intakes").select("id,order_id,customer_email,status,account_status").eq("id",intakeId).maybeSingle();
  if(purchase.error)throw purchase.error;
  if(!purchase.data)return json({error:"Purchase not found"},404);
  const paid=await db.from("orders").select("payment_status").eq("id",purchase.data.order_id).maybeSingle();
  if(paid.error)throw paid.error;
  if(paid.data?.payment_status!=="paid")return json({error:"Purchase payment not confirmed"},409);
  if(action==="provision"){
    const call=await db.rpc("s4u_provision_house_lab_ctpa",{p_intake_id:intakeId});
    if(call.error)return json({error:"Could not link C/TPA: "+call.error.message},409);
    return json({ok:true,ctpa:call.data});
  }
  if(action!=="status")return json({error:"Unsupported action"},400);
  const org=await db.from("organizations").select("id,legal_name,primary_email").ilike("primary_email",purchase.data.customer_email.trim()).neq("status","archived").limit(3);
  if(org.error)throw org.error;
  if((org.data||[]).length>1)return json({error:"Duplicate matching organizations require review"},409);
  if(!org.data?.length)return json({ok:true,ctpa:null,purchase:purchase.data});
  const ctpa=await db.from("ctpas").select("id,organization_id,tenant_id,status,company_code").eq("organization_id",org.data[0].id).maybeSingle();
  if(ctpa.error)throw ctpa.error;
  const [forms,accounts,ships,bills,collectors,emails]=await Promise.all([
   db.from("standalone_form_submissions").select("id,status").in("form_key",["lab_account_intake","lab_account_intake_standalone"]).ilike("submitter_email",purchase.data.customer_email).order("created_at",{ascending:false}).limit(5),
   ctpa.data?db.from("ctpa_lab_accounts").select("id,status").eq("ctpa_id",ctpa.data.id):Promise.resolve({data:[],error:null}),
   db.from("house_lab_supply_shipments").select("id,status,tracking_url,notification_sent_at").eq("intake_id",intakeId),
   db.from("invoices").select("id,status,sent_at").eq("order_id",purchase.data.order_id),
   db.from("collector_network_submissions").select("id,status").ilike("email",purchase.data.customer_email).neq("status","superseded").limit(5),
   db.from("testing_email_events").select("event_type,status").ilike("recipient_email",purchase.data.customer_email).limit(100)
  ]);
  for(const result of [forms,accounts,ships,bills,collectors,emails])if(result.error)throw result.error;
  const stages={
    payment_verified:true,
    intake_submitted:(forms.data||[]).some(x=>["submitted","reviewing","completed"].includes(x.status)),
    intake_completed:(forms.data||[]).some(x=>x.status==="completed"),
    ctpa_linked:!!ctpa.data,
    assigned_lab_numbers:(accounts.data||[]).length,
    active_lab_numbers:(accounts.data||[]).filter(x=>x.status==="active").length,
    account_status:purchase.data.account_status,
    shipments:(ships.data||[]).length,
    shipped:(ships.data||[]).filter(x=>["shipped","delivered"].includes(x.status)).length,
    delivered:(ships.data||[]).filter(x=>x.status==="delivered").length,
    shipment_notices:(ships.data||[]).filter(x=>x.notification_sent_at).length,
    collector_referrals:(collectors.data||[]).length,
    invoices:(bills.data||[]).length,
    sent_invoices:(bills.data||[]).filter(x=>x.sent_at).length,
    audited_customer_emails:(emails.data||[]).filter(x=>x.status==="sent").length
  };
  return json({ok:true,ctpa:ctpa.data||null,organization:org.data[0],purchase:purchase.data,stages});
 }catch(error){console.error("house lab ctpa provision",error);return json({error:"C/TPA management request failed"},500)}
});