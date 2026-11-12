import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://ctpa.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const active=["active","trial","trialing"];
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const bearer=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!url||!anon||!svc)return reply({error:"Service unavailable"},503);
  if(!bearer)return reply({error:"Authentication required"},401);
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await client.auth.getUser(bearer);
  if(authError||!user||!user.email_confirmed_at)return reply({error:"Verified sign-in required"},401);
  const body=await req.json().catch(()=>({}));
  const ctpaId=body.ctpa_id,subscriptionId=body.subscription_id,action=String(body.action||"workspace");
  if(!uuid(ctpaId)||!uuid(subscriptionId))return reply({error:"A selected C/TPA subscription is required"},400);
  // This endpoint deliberately does not provide delivery, download, or full-report actions.
  if(action!=="workspace")return reply({error:"Only summary access is supported"},403);
  const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
  const ctpa=await db.from("workforce_ctpas").select("id,organization_id,status").eq("id",ctpaId).eq("status","active").maybeSingle();
  if(ctpa.error)throw ctpa.error;
  if(!ctpa.data)return reply({error:"C/TPA not found"},403);
  const org=ctpa.data.organization_id;
  const [member,portal,userAccess,sub]=await Promise.all([
   db.from("workforce_memberships").select("id").eq("user_id",user.id).eq("organization_id",org).eq("status","active").limit(1),
   db.from("workforce_portal_access").select("enabled").eq("organization_id",org).eq("portal_code","ctpa_workforce").eq("enabled",true).limit(1),
   db.from("workforce_portal_user_access").select("enabled").eq("organization_id",org).eq("user_id",user.id).eq("portal_code","ctpa_workforce").maybeSingle(),
   db.from("workforce_subscriptions").select("id,plan_id,status").eq("ctpa_id",ctpaId).eq("id",subscriptionId).in("status",active).maybeSingle()
  ]);
  if(member.error||portal.error||userAccess.error||sub.error)throw member.error||portal.error||userAccess.error||sub.error;
  if(!member.data?.length||!portal.data?.length||userAccess.data?.enabled===false||!sub.data)
   return reply({error:"This C/TPA workspace or subscription is unavailable"},403);
  const [plan,flags,overrides]=await Promise.all([
   db.from("workforce_plans").select("id,code,active").eq("id",sub.data.plan_id).eq("audience","ctpa").eq("active",true).maybeSingle(),
   db.from("workforce_plan_features").select("feature_id,enabled,workforce_feature_catalog(code,active)").eq("plan_id",sub.data.plan_id),
   db.from("workforce_account_feature_overrides").select("feature_id,enabled").eq("ctpa_id",ctpaId).eq("subscription_id",subscriptionId)
  ]);
  if(plan.error||flags.error||overrides.error)throw plan.error||flags.error||overrides.error;
  if(!["workforce_ctpa_essential","workforce_ctpa_professional","workforce_ctpa_enterprise"].includes(String(plan.data?.code||"")))
   return reply({error:"C/TPA subscription tier unavailable"},403);
  const changes=new Map((overrides.data||[]).map((x:any)=>[x.feature_id,x.enabled]));
  const allowed=(flags.data||[]).some((x:any)=>x.workforce_feature_catalog?.code==="results_summary"&&
   x.workforce_feature_catalog?.active!==false&&(changes.has(x.feature_id)?changes.get(x.feature_id)===true:x.enabled===true));
  if(!allowed)return reply({error:"Your subscription does not include result summaries"},403);
  const e=await db.from("workforce_employers").select("id").eq("ctpa_id",ctpaId).eq("workforce_classification","NON_DOT").is("archived_at",null).limit(1000);
  if(e.error)throw e.error;
  const employerIds=(e.data||[]).map((x:any)=>x.id);
  let summaries:any[]=[];
  if(employerIds.length){
   const q=await db.from("workforce_test_result_reports")
    .select("id,report_number,report_status,updated_at,finalized_at,regulatory_mode")
    .in("employer_id",employerIds).eq("regulatory_mode","NON_DOT")
    .order("updated_at",{ascending:false}).limit(250);
   if(q.error)throw q.error;
   summaries=(q.data||[]).map((r:any)=>({
    id:r.id,report_number:r.report_number,status:r.report_status,
    updated_at:r.updated_at||r.finalized_at
   }));
  }
  return reply({ok:true,ctpa:{id:ctpaId,organization_id:org},reports:summaries,
   can_deliver:false,read_only:true});
 }catch(e){console.error("workforce-ctpa-secure-result-summaries",e);return reply({error:"Unable to load result summaries"},500)}
});