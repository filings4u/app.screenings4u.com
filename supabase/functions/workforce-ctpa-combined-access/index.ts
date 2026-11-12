import {createClient} from "npm:@supabase/supabase-js@2";
const HEAD={"Access-Control-Allow-Origin":"https://ctpa.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:HEAD});
const validUUID=(s:unknown)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s||""));
const ACTIVE=["active","trial","trialing"];
const TIERS=["essential","professional","enterprise"];
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 if(req.method!=="POST")return send({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!service)return send({error:"Service configuration unavailable"},503);
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return send({error:"Authentication required"},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user?.id||!user.email_confirmed_at)return send({error:"Verified login required"},401);
  const body=await req.json().catch(()=>({}));
  const ctpaId=String(body.ctpa_id||""),subscriptionId=String(body.subscription_id||"");
  if(!validUUID(ctpaId)||!validUUID(subscriptionId))return send({error:"Select an authorized C/TPA workspace and subscription"},400);
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  // The active DOT workspace is the entry point; it must be verified with the existing
  // authoritative C/TPA session RPC instead of accepting client-provided org/tenant IDs.
  const verified=await db.rpc("ctpa_dot_session_context",{p_user_id:user.id,p_ctpa_id:ctpaId,p_subscription_id:subscriptionId});
  if(verified.error)throw verified.error;
  const c=verified.data||{},tier=String(c.plan?.code||"").replace(/^dot_ctpa_/,"");
  if(!c.ctpa||!c.organization?.id||!c.membership||!c.portal_access||c.portal_access.enabled!==true||
     c.ctpa.id!==ctpaId||c.subscription?.id!==subscriptionId||
     !TIERS.includes(tier)||c.plan?.active===false||(!c.unlimited_access&&!ACTIVE.includes(String(c.subscription?.status||""))))
    return send({authorized:false,reason:"Active authorized C/TPA subscription required"},403);
  const orgId=String(c.organization.id);
  const [actualDot,dotOverrides]=await Promise.all([
   db.from("plan_features").select("feature_id,enabled,feature_catalog(code,active)")
    .eq("plan_id",c.plan.id),
   db.from("account_feature_overrides").select("feature_id,enabled")
    .eq("ctpa_id",ctpaId).eq("subscription_id",subscriptionId)
  ]);
  if(actualDot.error||dotOverrides.error)throw actualDot.error||dotOverrides.error;
  const dotFlags=new Map((dotOverrides.data||[]).map((x:any)=>[x.feature_id,x.enabled]));
  const dotCodes=(actualDot.data||[]).filter((x:any)=>{
   if(!x.feature_catalog?.code||x.feature_catalog.active===false)return false;
   return dotFlags.has(x.feature_id)?dotFlags.get(x.feature_id)===true:x.enabled===true;
  }).map((x:any)=>String(x.feature_catalog.code));
  // The NON-DOT customer data is not automatically unlocked by the DOT tier alone.
  // Membership, portal access, non-revocation and active NON-DOT subscription must all hold.
  const [nonCtpa,nonMembership,nonAccess,nonUserAccess]=await Promise.all([
   db.from("workforce_ctpas").select("id,organization_id").eq("organization_id",orgId).eq("status","active").maybeSingle(),
   db.from("workforce_memberships").select("id,status").eq("organization_id",orgId).eq("user_id",user.id).eq("status","active").limit(1),
   db.from("workforce_portal_access").select("id,enabled").eq("organization_id",orgId).eq("portal_code","ctpa_workforce").eq("enabled",true).limit(1),
   db.from("workforce_portal_user_access").select("enabled").eq("organization_id",orgId).eq("portal_code","ctpa_workforce").eq("user_id",user.id).maybeSingle()
  ]);
  for(const x of [nonCtpa,nonMembership,nonAccess,nonUserAccess])if(x.error)throw x.error;
  const canNonDot=!!nonCtpa.data?.id&&!!nonMembership.data?.length&&!!nonAccess.data?.length&&nonUserAccess.data?.enabled!==false;
  let nondotPlan:null|string=null,nondotCodes:string[]=[];
  if(canNonDot){
   const subs=await db.from("workforce_subscriptions").select("id,plan_id,status")
    .eq("ctpa_id",nonCtpa.data!.id).in("status",ACTIVE).order("created_at",{ascending:false}).limit(20);
   if(subs.error)throw subs.error;
   if(subs.data?.length){
    const planIds=subs.data.map((x:any)=>x.plan_id);
    const plans=await db.from("workforce_plans").select("id,code,active")
     .in("id",planIds).eq("active",true).eq("audience","ctpa");
    if(plans.error)throw plans.error;
    const allowed=(plans.data||[]).filter((p:any)=>TIERS.some(t=>p.code==="workforce_ctpa_"+t));
    // Highest independently purchased tier; never synthesize a higher plan from DOT entitlements.
    allowed.sort((a:any,b:any)=>TIERS.indexOf(b.code.replace("workforce_ctpa_",""))-TIERS.indexOf(a.code.replace("workforce_ctpa_","")));
    const chosen=allowed[0];
    if(chosen){
     const associatedSub=(subs.data||[]).find((x:any)=>x.plan_id===chosen.id);
     if(!associatedSub)throw Error("NON-DOT subscription association unavailable");
     const [features,overrides]=await Promise.all([
      db.from("workforce_plan_features").select("feature_id,enabled,workforce_feature_catalog(code,active)").eq("plan_id",chosen.id),
      db.from("workforce_account_feature_overrides").select("feature_id,enabled")
       .eq("ctpa_id",nonCtpa.data!.id).eq("subscription_id",associatedSub.id)
     ]);
     if(features.error||overrides.error)throw features.error||overrides.error;
     const flags=new Map((overrides.data||[]).map((x:any)=>[x.feature_id,x.enabled]));
     nondotCodes=(features.data||[]).filter((x:any)=>{
      if(!x.workforce_feature_catalog?.code||x.workforce_feature_catalog.active===false)return false;
      return flags.has(x.feature_id)?flags.get(x.feature_id)===true:x.enabled===true;
     }).map((x:any)=>String(x.workforce_feature_catalog.code));
     nondotPlan=chosen.code;
    }
   }
  }
  const lab=await db.from("workforce_lab_company_entitlements")
   .select("id").eq("organization_id",orgId).eq("ctpa_id",ctpaId).eq("entitlement_code","lab_account").eq("status","active").limit(1);
  if(lab.error)throw lab.error;
  return send({
    authorized:true,
    portal:"ctpa",tier,
    plan:{code:String(c.plan.code),name:String(c.plan.name||"C/TPA "+tier)},
    operating_contexts:{
      dot:{available:true,plan_code:String(c.plan.code),feature_codes:[...new Set(dotCodes)].sort()},
      nondot:{available:!!nondotPlan,plan_code:nondotPlan,feature_codes:[...new Set(nondotCodes)].sort()}
    },
    company_addons:{lab_account:!!lab.data?.length},
    effective_feature_codes:[...new Set([...dotCodes,...nondotCodes])].sort(),
    ownership:{organization_id:orgId,ctpa_id:ctpaId},
    notices:[
     "DOT and NON-DOT remain separate record scopes; use the authorized business surface for every data operation.",
     "An add-on or frontend feature flag never replaces server checks for a specific customer record.",
     "Three-tier combined subscription provisioning is staged; existing purchased subscriptions are not modified by this read-only service."
    ]
  });
 }catch(e){console.error("workforce-ctpa-combined-access",e);return send({error:"Unable to verify combined C/TPA plan access"},500)}
});