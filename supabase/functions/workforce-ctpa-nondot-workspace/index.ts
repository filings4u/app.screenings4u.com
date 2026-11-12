const HEAD={"Access-Control-Allow-Origin":"https://ctpa.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:HEAD});
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const modules:Record<string,{endpoint:string,permission:string}>={
 people:{endpoint:"nondot-workforce-ctpa-programs",permission:"employee_management"},
 programs:{endpoint:"nondot-workforce-ctpa-programs",permission:"programs"},
 pools:{endpoint:"nondot-workforce-ctpa-pools",permission:"consortium_pools"},
 testing:{endpoint:"nondot-workforce-ctpa-testing",permission:"testing_orders"},
 results:{endpoint:"nondot-workforce-ctpa-results",permission:"results_sensitive"}
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
  const payload=section==="people"?{employers:data.employers||[],employees:data.employees||[]}:
   section==="programs"?{employers:data.employers||[],programs:data.programs||[]}:
   section==="pools"?{pools:data.pools||[],memberships:data.pool_memberships||data.memberships||[]}:
   section==="testing"?{orders:data.testing_orders||data.orders||[],employers:data.employers||[]}:
   {reports:data.result_reports||data.reports||data.results||[]};
  return send({ok:true,section,context:"nondot",plan_code:context.plan_code,read_only:true,available_sections:Object.entries(modules).filter(([,rule])=>context.feature_codes.includes(rule.permission)).map(([id])=>id),data:payload});
 }catch(err){console.error("workforce-ctpa-nondot-workspace",err);return send({error:"Unable to access NON-DOT module"},500)}
});