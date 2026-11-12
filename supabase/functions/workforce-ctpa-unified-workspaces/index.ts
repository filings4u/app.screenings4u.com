import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://ctpa.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const res=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const ACTIVE=["active","trial","trialing"];
const TIERS=["essential","professional","enterprise"];
const isUUID=(x:unknown)=>typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});
 if(req.method!=="POST")return res({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!key)return res({error:"Service configuration unavailable"},503);
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return res({error:"Authentication required"},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:e}=await auth.auth.getUser(token);
  if(e||!user?.id||!user.email_confirmed_at)return res({error:"Verified authentication required"},401);
  const b=await req.json().catch(()=>({}));
  if(b.organization_id&&!isUUID(b.organization_id))return res({error:"Invalid organization"},400);
  const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const [dotMembers,nonMembers]=await Promise.all([
   db.from("organization_memberships").select("organization_id,membership_role,is_primary")
     .eq("user_id",user.id).eq("status","active").limit(100),
   db.from("workforce_memberships").select("organization_id,role_id,is_primary")
     .eq("user_id",user.id).eq("status","active").limit(100)
  ]);
  if(dotMembers.error||nonMembers.error)throw dotMembers.error||nonMembers.error;
  const matches=(id:string)=>!b.organization_id||id===b.organization_id;
  const workspaces:any[]=[];
  for(const m of dotMembers.data||[]){
   if(!matches(m.organization_id))continue;
   const [ctpas,portal]=await Promise.all([
    db.from("ctpas").select("id,organization_id").eq("organization_id",m.organization_id).eq("status","active").limit(10),
    db.from("organization_portal_access").select("enabled").eq("organization_id",m.organization_id).eq("portal_code","ctpa_dot").eq("enabled",true).limit(1)
   ]);
   if(ctpas.error||portal.error)throw ctpas.error||portal.error;
   if(!portal.data?.length)continue;
   for(const ctpa of ctpas.data||[]){
    const subs=await db.from("subscriptions").select("id,plan_id,status").eq("ctpa_id",ctpa.id).in("status",ACTIVE).limit(40);
    if(subs.error)throw subs.error;
    if(!subs.data?.length)continue;
    const plans=await db.from("plans").select("id,code,name,active").in("id",subs.data.map((s:any)=>s.plan_id)).eq("active",true).eq("audience","ctpa");
    if(plans.error)throw plans.error;
    for(const subscription of subs.data){
     const plan=(plans.data||[]).find((p:any)=>p.id===subscription.plan_id),tier=String(plan?.code||"").replace(/^dot_ctpa_/,"");
     if(!TIERS.includes(tier)||plan?.code!=="dot_ctpa_"+tier)continue;
     // Verify the actual selected subscription and membership through the authoritative C/TPA RPC.
     const check=await db.rpc("ctpa_dot_session_context",{p_user_id:user.id,p_ctpa_id:ctpa.id,p_subscription_id:subscription.id});
     if(check.error)throw check.error;
     if(!check.data?.membership||check.data?.portal_access?.enabled!==true||
        check.data?.subscription?.id!==subscription.id||check.data?.ctpa?.id!==ctpa.id)continue;
     workspaces.push({operating_context:"dot",organization_id:ctpa.organization_id,ctpa_id:ctpa.id,subscription_id:subscription.id,plan_code:plan.code,plan_name:plan.name,tier,role:String(m.membership_role||""),is_primary:m.is_primary===true});
    }
   }
  }
  for(const m of nonMembers.data||[]){
   if(!matches(m.organization_id))continue;
   const [ctpas,portal,userAccess]=await Promise.all([
    db.from("workforce_ctpas").select("id,organization_id").eq("organization_id",m.organization_id).eq("status","active").limit(10),
    db.from("workforce_portal_access").select("enabled").eq("organization_id",m.organization_id).eq("portal_code","ctpa_workforce").eq("enabled",true).limit(1),
    db.from("workforce_portal_user_access").select("enabled").eq("organization_id",m.organization_id).eq("portal_code","ctpa_workforce").eq("user_id",user.id).maybeSingle()
   ]);
   for(const x of [ctpas,portal,userAccess])if(x.error)throw x.error;
   if(userAccess.data?.enabled===false||(!portal.data?.length&&userAccess.data?.enabled!==true))continue;
   for(const ctpa of ctpas.data||[]){
    const subs=await db.from("workforce_subscriptions").select("id,plan_id,status").eq("ctpa_id",ctpa.id).in("status",ACTIVE).limit(40);
    if(subs.error)throw subs.error;
    if(!subs.data?.length)continue;
    const plans=await db.from("workforce_plans").select("id,code,name,active").in("id",subs.data.map((s:any)=>s.plan_id)).eq("active",true).eq("audience","ctpa");
    if(plans.error)throw plans.error;
    for(const subscription of subs.data){
     const plan=(plans.data||[]).find((p:any)=>p.id===subscription.plan_id),tier=String(plan?.code||"").replace(/^workforce_ctpa_/,"");
     if(!TIERS.includes(tier)||plan?.code!=="workforce_ctpa_"+tier)continue;
     workspaces.push({operating_context:"nondot",organization_id:ctpa.organization_id,ctpa_id:ctpa.id,subscription_id:subscription.id,plan_code:plan.code,plan_name:plan.name,tier,role_id:m.role_id,is_primary:m.is_primary===true});
    }
   }
  }
  workspaces.sort((a,b)=>String(a.organization_id).localeCompare(String(b.organization_id))||
   String(a.operating_context).localeCompare(String(b.operating_context))||
   TIERS.indexOf(b.tier)-TIERS.indexOf(a.tier));
  return res({has_access:workspaces.length>0,workspaces,notice:"Workspace discovery only. Each feature API must independently validate its selected surface, subscription, role and company."});
 }catch(e){console.error("workforce-ctpa-unified-workspaces",e);return res({error:"Unable to discover authorized C/TPA workspaces"},500)}
});