import { createClient } from "npm:@supabase/supabase-js@2";

const headers={
 "Access-Control-Allow-Origin":"https://employer.screenings4u.com",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Content-Type":"application/json",
 "Cache-Control":"no-store"
};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const ACTIVE=["active","trial","trialing"];
const TIERS=["essential","professional","enterprise"];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const bool=(value:unknown)=>value===true;
const valid=(value:unknown)=>typeof value==="string"&&UUID.test(value);

type Workspace={
 operating_context:"dot"|"nondot";
 organization_id:string;
 employer_id:string;
 subscription_id:string;
 plan_code:string;
 plan_name:string;
 tier:string;
 portal_code:string;
 is_primary:boolean;
 feature_codes:string[];
};

Deno.serve(async (request:Request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(request.method!=="POST")return reply({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"";
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!service)return reply({error:"Service unavailable"},503);
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return reply({error:"Sign-in required"},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authenticationError}=await auth.auth.getUser(token);
  if(authenticationError||!user?.id||!user.email_confirmed_at)
   return reply({error:"Verified account required"},401);
  const requestBody=await request.json().catch(()=>({}));
  const organizationFilter=requestBody.organization_id;
  if(organizationFilter!==undefined&&!valid(organizationFilter))
   return reply({error:"Invalid organization"},400);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const workspaces:Workspace[]=[];

  // These are distinct purchased surfaces. Never convert a NON-DOT grant into
  // DOT access or merge features across independent subscriptions.
  const surfaces=[
   {type:"dot" as const,members:"organization_memberships",companies:"employers",
    access:"organization_portal_access",userAccess:null,
    subscriptions:"subscriptions",plans:"plans",planFlags:"plan_features",
    featureCatalog:"feature_catalog",overrides:"account_feature_overrides",
    prefix:"dot_employer_",portal:"employer_dot"},
   {type:"nondot" as const,members:"workforce_memberships",companies:"workforce_employers",
    access:"workforce_portal_access",userAccess:"workforce_portal_user_access",
    subscriptions:"workforce_subscriptions",plans:"workforce_plans",planFlags:"workforce_plan_features",
    featureCatalog:"workforce_feature_catalog",overrides:"workforce_account_feature_overrides",
    prefix:"workforce_employer_",portal:"employer_workforce"}
  ];
  for(const surface of surfaces){
   const members=await db.from(surface.members).select("organization_id,is_primary")
    .eq("user_id",user.id).eq("status","active").limit(100);
   if(members.error)throw members.error;
   for(const member of members.data||[]){
    const organizationId=String(member.organization_id||"");
    if(!valid(organizationId)||(organizationFilter&&organizationId!==organizationFilter))continue;
    const [portal,personal,companies]=await Promise.all([
     db.from(surface.access).select("enabled").eq("organization_id",organizationId)
      .eq("portal_code",surface.portal).eq("enabled",true).limit(1),
     surface.userAccess?db.from(surface.userAccess).select("enabled")
      .eq("organization_id",organizationId).eq("user_id",user.id)
      .eq("portal_code",surface.portal).maybeSingle():Promise.resolve({data:null,error:null}),
     db.from(surface.companies).select("id,organization_id,legal_name")
      .eq("organization_id",organizationId).is("archived_at",null).limit(30)
    ]);
    if(portal.error||personal.error||companies.error)
     throw portal.error||personal.error||companies.error;
    if(!portal.data?.length||personal.data?.enabled===false)continue;
    for(const company of companies.data||[]){
     if(company.organization_id!==organizationId)continue;
     const subs=await db.from(surface.subscriptions).select("id,plan_id,status")
      .eq("employer_id",company.id).in("status",ACTIVE)
      .order("created_at",{ascending:false}).limit(30);
     if(subs.error)throw subs.error;
     const ids=[...new Set((subs.data||[]).map((s:any)=>s.plan_id).filter(valid))];
     if(!ids.length)continue;
     const plans=await db.from(surface.plans).select("id,code,name,active")
      .in("id",ids).eq("active",true).eq("audience","employer");
     if(plans.error)throw plans.error;
     for(const sub of subs.data||[]){
      const plan=(plans.data||[]).find((p:any)=>p.id===sub.plan_id);
      if(!plan)continue;
      const tier=String(plan.code||"").replace(surface.prefix,"");
      if(!TIERS.includes(tier)||plan.code!==surface.prefix+tier)continue;
      const features=await db.from(surface.planFlags)
       .select("feature_id,enabled,"+surface.featureCatalog+"(code,active)")
       .eq("plan_id",sub.plan_id);
      const overrides=await db.from(surface.overrides).select("feature_id,enabled")
       .eq("employer_id",company.id).eq("subscription_id",sub.id);
      if(features.error||overrides.error)throw features.error||overrides.error;
      const byId=new Map((overrides.data||[]).map((r:any)=>[r.feature_id,r.enabled]));
      const codes=(features.data||[]).filter((r:any)=>{
       const catalog=r[surface.featureCatalog];
       return catalog?.code&&catalog.active!==false&&
        (byId.has(r.feature_id)?bool(byId.get(r.feature_id)):bool(r.enabled));
      }).map((r:any)=>String(r[surface.featureCatalog].code));
      workspaces.push({
       operating_context:surface.type,organization_id:organizationId,
       employer_id:company.id,subscription_id:sub.id,plan_code:plan.code,
       plan_name:String(plan.name||"Employer "+tier),tier,
       portal_code:surface.portal,is_primary:member.is_primary===true,
       feature_codes:[...new Set(codes)].sort()
      });
     }
    }
   }
  }
  workspaces.sort((a,b)=>a.organization_id.localeCompare(b.organization_id)||
   a.operating_context.localeCompare(b.operating_context)||
   TIERS.indexOf(b.tier)-TIERS.indexOf(a.tier));
  return reply({ok:true,has_access:workspaces.length>0,workspaces,
   notice:"Discovery only. Every DOT/NON-DOT operation must independently validate its exact subscription, feature, role and employer."});
 }catch(error){
  console.error("workforce-employer-unified-workspaces",error);
  return reply({error:"Unable to retrieve Employer workspaces"},500);
 }
});
