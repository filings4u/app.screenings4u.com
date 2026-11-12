const HEAD={"Access-Control-Allow-Origin":"https://ctpa.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:HEAD});
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const modules:Record<string,{endpoint:string,permission:string}>={
 people:{endpoint:"nondot-workforce-ctpa-programs",permission:"employee_management"},
 programs:{endpoint:"nondot-workforce-ctpa-programs",permission:"programs"},
 pools:{endpoint:"nondot-workforce-ctpa-pools",permission:"consortium_pools"},
 testing:{endpoint:"nondot-workforce-ctpa-testing",permission:"testing_orders"},
 results:{endpoint:"nondot-workforce-ctpa-results",permission:"results_summary"}
};
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:HEAD});
 if(req.method!=="POST")return send({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
  if(!url||!anon)return send({error:"Service configuration unavailable"},503);
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return send({error:"Sign-in required"},401);
  const body=await req.json().catch(()=>({}));
  const ctpaId=body.ctpa_id,subscriptionId=body.subscription_id,section=String(body.section||"programs");
  if(!uuid(ctpaId)||!uuid(subscriptionId)||!modules[section])return send({error:"Invalid workspace or module"},400);
  // DOT users use the existing independently verified dual-surface boundary.
  // NON-DOT-only users must hold the selected NON-DOT workspace and subscription;
  // never invent a DOT membership to enter this consolidated hostname.
  const onlyNondot=body.operating_context==="nondot";
  let context:any,organizationId="";
  if(onlyNondot){
   const check=await fetch(url+"/functions/v1/workforce-ctpa-unified-workspaces",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},
    body:JSON.stringify({}),cache:"no-store"
   });
   const data=await check.json().catch(()=>({}));
   if(!check.ok)return send({error:"Your selected C/TPA workspace is not available"},403);
   const selected=(data.workspaces||[]).find((w:any)=>w.operating_context==="nondot"&&w.ctpa_id===ctpaId&&w.subscription_id===subscriptionId);
   if(!selected)return send({error:"NON-DOT workspace and subscription do not belong to the signed-in user"},403);
   organizationId=selected.organization_id;
   // A legacy plan's enabled features and account-specific feature revocations
   // determine access. This is independent of the account's DOT purchases.
   const {createClient}=await import("npm:@supabase/supabase-js@2");
   const db=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
   const sub=await db.from("workforce_subscriptions").select("id,plan_id").eq("id",subscriptionId).eq("ctpa_id",ctpaId).in("status",["active","trial","trialing"]).maybeSingle();
   if(sub.error||!sub.data)return send({error:"An active NON-DOT C/TPA subscription is required"},403);
   // Legacy NON-DOT action services use the most recent active subscription.
   // Until their authorization is upgraded, do not let an older purchased plan
   // authorize writes that the source workflow would execute under a newer one.
   if(body.action&&body.action!=="workspace"){
    const latest=await db.from("workforce_subscriptions").select("id")
     .eq("ctpa_id",ctpaId).in("status",["active","trial","trialing"])
     .order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(latest.error)throw latest.error;
    if(latest.data?.id!==subscriptionId)
     return send({error:"Select your current NON-DOT subscription to manage records"},403);
   }
   const [flags,overrides]=await Promise.all([
    db.from("workforce_plan_features").select("feature_id,enabled,workforce_feature_catalog(code,active)").eq("plan_id",sub.data.plan_id),
    db.from("workforce_account_feature_overrides").select("feature_id,enabled").eq("ctpa_id",ctpaId).eq("subscription_id",subscriptionId)
   ]);
   if(flags.error||overrides.error)throw flags.error||overrides.error;
   const o=new Map((overrides.data||[]).map((r:any)=>[r.feature_id,r.enabled]));
   const features=(flags.data||[]).filter((r:any)=>r.workforce_feature_catalog?.active!==false&&r.workforce_feature_catalog?.code&&(o.has(r.feature_id)?o.get(r.feature_id)===true:r.enabled===true)).map((r:any)=>String(r.workforce_feature_catalog.code));
   context={available:true,ctpa_id:ctpaId,plan_code:selected.plan_code,feature_codes:features};
  }else{
   const guard=await fetch(url+"/functions/v1/workforce-ctpa-combined-access",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},
    body:JSON.stringify({ctpa_id:ctpaId,subscription_id:subscriptionId}),cache:"no-store"
   });
   const access=await guard.json().catch(()=>({}));
   if(!guard.ok||access.authorized!==true)return send({error:"Your C/TPA subscription does not authorize this workspace"},403);
   context=access.operating_contexts?.nondot;
   organizationId=access.ownership?.organization_id||"";
  }
  const rule=modules[section];
  if(context?.available!==true||!Array.isArray(context.feature_codes)||!context.feature_codes.includes(rule.permission))
   return send({error:"This NON-DOT feature is not included in your active subscription"},403);
  const requestedAction=String(body.action||"workspace");
  // The initial write migration supports only customer-owned employee and
  // company-policy program creation. DOT-origin visits are strictly read-only.
  const mutations:Record<string,{section:string,permission:string}>={
   save_employee:{section:"people",permission:"employee_management"},
   save_program:{section:"programs",permission:"programs"}
  };
  const mutation=mutations[requestedAction];
  if(requestedAction!=="workspace"&&!mutation)return send({error:"Operation not supported"},400);
  if(mutation){
   if(body.operating_context!=="nondot"||mutation.section!==section||!context.feature_codes.includes(mutation.permission))
    return send({error:"Only an authorized NON-DOT workspace may manage this feature"},403);
   const {createClient}=await import("npm:@supabase/supabase-js@2");
   const db=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
   const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:{user},error:authError}=await auth.auth.getUser(token);
   if(authError||!user)return send({error:"Authenticated account required"},401);
   const member=await db.from("workforce_memberships").select("id,is_primary,status")
    .eq("user_id",user.id).eq("organization_id",organizationId).eq("status","active").eq("is_primary",true).limit(1);
   const personal=await db.from("workforce_portal_user_access").select("enabled")
    .eq("organization_id",organizationId).eq("user_id",user.id).eq("portal_code","ctpa_workforce").maybeSingle();
   if(member.error||personal.error)throw member.error||personal.error;
   if(!member.data?.length||personal.data?.enabled===false)
    return send({error:"Only the authorized primary account manager can create these records"},403);
   const v=requestedAction==="save_employee"?body.employee:body.program;
   if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length>12)
    return send({error:"Invalid record"},400);
   if(!uuid(v.employer_id))return send({error:"Choose a valid employer"},400);
   const employer=await db.from("workforce_employers").select("id").eq("id",v.employer_id)
    .eq("ctpa_id",ctpaId).eq("workforce_classification","NON_DOT").is("archived_at",null).maybeSingle();
   if(employer.error)throw employer.error;
   if(!employer.data)return send({error:"Employer does not belong to this NON-DOT C/TPA workspace"},403);
   const clean=(x:unknown,max=120)=>String(x||"").trim().slice(0,max);
   let value:Record<string,unknown>;
   if(requestedAction==="save_employee"){
    if(!clean(v.first_name)||!clean(v.last_name))return send({error:"First and last name are required"},400);
    value={employer_id:v.employer_id,first_name:clean(v.first_name),last_name:clean(v.last_name),
     employee_number:clean(v.employee_number,40),workforce_worker_type:"employee",employment_status:"active"};
   }else{
    if(!clean(v.name))return send({error:"Program name is required"},400);
    value={employer_id:v.employer_id,name:clean(v.name),status:"active"};
   }
   const saved=await fetch(url+"/functions/v1/nondot-workforce-ctpa-programs",{
    method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},
    body:JSON.stringify({action:requestedAction,ctpa_id:ctpaId,[requestedAction==="save_employee"?"employee":"program"]:value}),cache:"no-store"
   });
   const result=await saved.json().catch(()=>({}));
   if(!saved.ok||result.ok!==true)return send({error:result.error||"Unable to save this NON-DOT record"},saved.status||502);
   return send({ok:true,saved:true,section,action:requestedAction});
  }
  const response=await fetch(url+"/functions/v1/"+rule.endpoint,{
   method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},
   body:JSON.stringify({action:"workspace",ctpa_id:context.ctpa_id||undefined}),cache:"no-store"
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error||data.ok===false)return send({error:data.error||"Unable to load NON-DOT workspace"},response.status||502);
  // Defend against a mismatched legacy-workspace resolution. Records must belong
  // to the selected Workforce organization verified above.
  if(!uuid(context.ctpa_id)||!data.ctpa||String(data.ctpa.id)!==String(context.ctpa_id)||String(data.ctpa.organization_id)!==String(organizationId))
   return send({error:"The NON-DOT workspace does not belong to this organization"},403);
  // Return only fields rendered by the read-only migration UI. In particular,
  // do not expose full donor, CCF, MRO, medical or billing records to the browser.
  const company=(data.employers||[]).slice(0,250).map((x:any)=>({id:x.id,legal_name:x.legal_name}));
  const payload=section==="people"?{
    employers:company,
    employees:(data.employees||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,first_name:x.first_name,last_name:x.last_name,employment_status:x.employment_status,status:x.status}))
   }:section==="programs"?{
    employers:company,
    programs:(data.programs||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,name:x.name,program_name:x.program_name,status:x.status}))
   }:section==="pools"?{
    pools:(data.pools||[]).slice(0,250).map((x:any)=>({id:x.id,name:x.name,pool_name:x.pool_name,status:x.status})),
    memberships:(data.pool_memberships||data.memberships||[]).slice(0,500).map((x:any)=>({id:x.id,pool_id:x.pool_id}))
   }:section==="testing"?{
    employers:company,
    orders:(data.testing_orders||data.orders||[]).slice(0,250).map((x:any)=>({id:x.id,order_number:x.order_number,employer_id:x.employer_id,created_at:x.created_at,status:x.status}))
   }:{
    reports:(data.result_reports||data.reports||data.results||[]).slice(0,250).map((x:any)=>({id:x.id,report_number:x.report_number,order_number:x.order_number,status:x.status,report_status:x.report_status,result_status:x.result_status,updated_at:x.updated_at,released_at:x.released_at}))
   };
  return send({ok:true,section,context:"nondot",plan_code:context.plan_code,read_only:body.operating_context!=="nondot",can_manage:body.operating_context==="nondot"&&Boolean(await (async()=>{const {createClient}=await import("npm:@supabase/supabase-js@2");const a=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});const {data:{user}}=await a.auth.getUser(token);if(!user)return false;const db=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});const m=await db.from("workforce_memberships").select("id").eq("user_id",user.id).eq("organization_id",organizationId).eq("status","active").eq("is_primary",true).limit(1);const o=await db.from("workforce_portal_user_access").select("enabled").eq("organization_id",organizationId).eq("user_id",user.id).eq("portal_code","ctpa_workforce").maybeSingle();return !m.error&&!o.error&&!!m.data?.length&&o.data?.enabled!==false;})()),available_sections:Object.entries(modules).filter(([,rule])=>context.feature_codes.includes(rule.permission)).map(([id])=>id),data:payload});
 }catch(err){console.error("workforce-ctpa-nondot-workspace",err);return send({error:"Unable to access NON-DOT module"},500)}
});