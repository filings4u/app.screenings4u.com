import {createClient} from "npm:@supabase/supabase-js@2";

const H={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:H});
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);

Deno.serve(async(request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(request.method!=="POST")return reply({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!key)return reply({error:"Management service unavailable"},503);
  const jwt=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!jwt)return reply({error:"Authentication required"},401);
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await client.auth.getUser(jwt);
  if(authError||!user||!user.email_confirmed_at)return reply({error:"Verified management sign-in required"},401);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const [profile,roles,testingAccess]=await Promise.all([
   db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
   db.from("staff_role_assignments").select("role_code,starts_at,ends_at").eq("user_id",user.id).eq("active",true),
   db.from("staff_business_access").select("id").eq("user_id",user.id).eq("business_unit_code","testing").eq("active",true).limit(1)
  ]);
  if(profile.error||roles.error||testingAccess.error)throw profile.error||roles.error||testingAccess.error;
  if(profile.data?.employment_status!=="active"||!testingAccess.data?.length)
   return reply({error:"Testing management authorization required"},403);
  const now=Date.now(),assigned=(roles.data||[]).filter((r:any)=>
   (!r.starts_at||Date.parse(r.starts_at)<=now)&&(!r.ends_at||Date.parse(r.ends_at)>now)
  ).map((r:any)=>r.role_code);
  if(!assigned.length)return reply({error:"Active management role required"},403);
  const activeRoles=await db.from("staff_roles").select("code")
   .in("code",assigned).eq("active",true);
  if(activeRoles.error)throw activeRoles.error;
  const roleCodes=(activeRoles.data||[]).map((r:any)=>r.code);
  if(!roleCodes.length)return reply({error:"Management role is inactive"},403);
  const permission=await db.from("staff_role_permissions").select("role_code")
   .in("role_code",roleCodes).eq("permission_key","customers.assign").eq("allowed",true).limit(1);
  if(permission.error)throw permission.error;
  if(!permission.data?.length)return reply({error:"Company assignment approval permission required"},403);

  const body=await request.json().catch(()=>({}));
  const action=String(body.action||"list");
  if(!["list","review","approve"].includes(action))return reply({error:"Unsupported action"},400);
  const load=async(id:string)=>{
   const q=await db.from("workforce_lab_company_entitlements")
    .select("id,organization_id,ctpa_id,linked_customer_user_id,source_order_id,entitlement_code,status,grant_source,approved_by,activated_at,updated_at")
    .eq("id",id).eq("entitlement_code","lab_account").maybeSingle();
   if(q.error)throw q.error;
   return q.data;
  };
  const readiness=async(e:any)=>{
   const reasons:string[]=[];
   if(e.status!=="pending")reasons.push("Grant is not pending");
   if(!uuid(e.source_order_id)||!uuid(e.ctpa_id)||!uuid(e.organization_id)||!uuid(e.linked_customer_user_id))
    reasons.push("Required company and purchase identifiers are missing");
   if(reasons.length)return {ready:false,reasons};
   const [order,ctpa,org,member,intake,labs,other]=await Promise.all([
    db.from("orders").select("id,payment_status").eq("id",e.source_order_id).maybeSingle(),
    db.from("ctpas").select("id,status,organization_id").eq("id",e.ctpa_id).maybeSingle(),
    db.from("organizations").select("id,status").eq("id",e.organization_id).maybeSingle(),
    db.from("organization_memberships").select("id").eq("user_id",e.linked_customer_user_id).eq("organization_id",e.organization_id).eq("status","active").limit(2),
    db.from("lab_account_intakes").select("id,customer_user_id,status,account_status").eq("order_id",e.source_order_id).limit(3),
    db.from("ctpa_lab_accounts").select("id").eq("ctpa_id",e.ctpa_id).eq("status","active").limit(1),
    db.from("workforce_lab_company_entitlements").select("id").eq("ctpa_id",e.ctpa_id).eq("entitlement_code","lab_account").eq("status","active").limit(2)
   ]);
   for(const r of [order,ctpa,org,member,intake,labs,other])if(r.error)throw r.error;
   if(order.data?.payment_status!=="paid")reasons.push("Paid order not verified");
   if(ctpa.data?.status!=="active"||ctpa.data.organization_id!==e.organization_id)
    reasons.push("C/TPA does not match the active company");
   if(!org.data||org.data.status==="archived")reasons.push("Company is unavailable");
   if(member.data?.length!==1)reasons.push("Purchaser's active organization membership is not unique");
   if(intake.data?.length!==1||intake.data[0].customer_user_id!==e.linked_customer_user_id)
    reasons.push("Lab purchase intake ownership is missing or ambiguous");
   if(intake.data?.length===1&&(intake.data[0].status!=="completed"||intake.data[0].account_status!=="active"))
    reasons.push("Laboratory onboarding has not been activated");
   if(!labs.data?.length)reasons.push("No active laboratory account is assigned");
   if(other.data?.length)reasons.push("C/TPA already has an active Lab Account grant");
   return {ready:reasons.length===0,reasons};
  };

  if(action==="list"){
   const q=await db.from("workforce_lab_company_entitlements")
    .select("id,organization_id,ctpa_id,status,grant_source,updated_at")
    .eq("entitlement_code","lab_account").order("created_at",{ascending:false}).limit(100);
   if(q.error)throw q.error;
   return reply({ok:true,grants:q.data||[]});
  }
  if(!uuid(body.grant_id))return reply({error:"Select a valid Lab Account grant"},400);
  const e=await load(body.grant_id);
  if(!e)return reply({error:"Grant not found"},404);
  if(action==="approve"&&e.linked_customer_user_id===user.id)
   return reply({error:"Staff may not approve their own Lab Account grant"},403);
  const check=await readiness(e);
  if(action==="review")return reply({ok:true,grant_id:e.id,status:e.status,...check});
  if(body.confirmation!=="ACTIVATE LAB ACCOUNT")
   return reply({error:"Explicit ACTIVATE LAB ACCOUNT confirmation required"},400);
  if(!check.ready)return reply({error:"Grant has unresolved verification requirements",reasons:check.reasons},409);
  // Optimistic lock: another staff action cannot activate an already-changed grant.
  const timestamp=new Date().toISOString();
  const update=await db.from("workforce_lab_company_entitlements")
   .update({status:"active",approved_by:user.id,activated_at:timestamp,updated_at:timestamp})
   .eq("id",e.id).eq("organization_id",e.organization_id).eq("ctpa_id",e.ctpa_id)
   .eq("source_order_id",e.source_order_id).eq("linked_customer_user_id",e.linked_customer_user_id)
   .eq("entitlement_code","lab_account").eq("status","pending")
   .eq("updated_at",e.updated_at).select("id,status,approved_by,activated_at").maybeSingle();
  if(update.error)throw update.error;
  if(!update.data)return reply({error:"Grant changed before approval. Review again."},409);
  return reply({ok:true,grant:update.data});
 }catch(error){
  console.error("workforce-lab-grant-approval",error);
  return reply({error:"Unable to process Lab Account grant"},500);
 }
});
