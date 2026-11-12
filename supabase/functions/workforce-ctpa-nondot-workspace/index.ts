const HEAD={"Access-Control-Allow-Origin":"https://ctpa.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:HEAD});
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const modules:Record<string,{endpoint:string,permission:string}>={
 people:{endpoint:"workforce-ctpa-secure-programs",permission:"employee_management"},
 programs:{endpoint:"workforce-ctpa-secure-programs",permission:"programs"},
 pools:{endpoint:"workforce-ctpa-secure-pools",permission:"consortium_pools"},
 testing:{endpoint:"workforce-ctpa-secure-testing",permission:"testing_orders"},
 results:{endpoint:"workforce-ctpa-secure-result-summaries",permission:"results_summary"}
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
   save_program:{section:"programs",permission:"programs"},
   save_pool:{section:"pools",permission:"consortium_pools"},
   create_test_order:{section:"testing",permission:"testing_orders"},
   update_test_deadline:{section:"testing",permission:"testing_orders"},
   update_employee:{section:"people",permission:"employee_management"},
   update_program:{section:"programs",permission:"programs"},
   update_pool:{section:"pools",permission:"consortium_pools"},
   add_pool_member:{section:"pools",permission:"consortium_pools"},
   remove_pool_member:{section:"pools",permission:"consortium_pools"}
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

   // Whitelisted updates only: do not reset existing DOT, demographic or medical fields.
   if(requestedAction==="update_employee"||requestedAction==="update_program"){
    const updatingEmployee=requestedAction==="update_employee";
    const v=updatingEmployee?body.employee:body.program;
    if(!v||typeof v!=="object"||Array.isArray(v)||!uuid(v.id)||!uuid(v.employer_id))
     return send({error:"Choose an existing company record"},400);
    const employer=await db.from("workforce_employers").select("id").eq("id",v.employer_id)
     .eq("ctpa_id",ctpaId).eq("workforce_classification","NON_DOT").is("archived_at",null).maybeSingle();
    if(employer.error)throw employer.error;
    if(!employer.data)return send({error:"Employer is outside this C/TPA"},403);
    const target=updatingEmployee?"workforce_employees":"workforce_programs";
    let lookup=db.from(target).select("id").eq("id",v.id).eq("employer_id",v.employer_id)
     .eq("business_surface","workforce").is("archived_at",null);
    if(!updatingEmployee)lookup=lookup.eq("program_type","NON_DOT");
    const original=await lookup.maybeSingle();
    if(original.error)throw original.error;
    if(!original.data)return send({error:"Record is not part of this NON-DOT employer"},403);
    if(updatingEmployee&&v.employee_number!==undefined&&
       (typeof v.employee_number!=="string"||v.employee_number.length>40))
     return send({error:"Employee number must be at most 40 characters"},400);
    const clean=(x:unknown)=>String(x||"").trim().slice(0,120);
    const changes=updatingEmployee?{first_name:clean(v.first_name),last_name:clean(v.last_name),employee_number:clean(v.employee_number).slice(0,40)}:{name:clean(v.name)};
    if(updatingEmployee?(!changes.first_name||!changes.last_name):!changes.name)return send({error:"A name is required"},400);
    let update=db.from(target).update({...changes,updated_at:new Date().toISOString()}).eq("id",v.id)
      .eq("employer_id",v.employer_id).eq("business_surface","workforce").is("archived_at",null);
    if(!updatingEmployee)update=update.eq("program_type","NON_DOT");
    const saved=await update.select("id").maybeSingle();
    if(saved.error)throw saved.error;
    if(!saved.data)return send({error:"Record is not available"},404);
    return send({ok:true,saved:true,section,action:requestedAction});
   }
   // A manager may rename their own draft NON-DOT employer pool, but cannot
   // change its employer, program, selection policy, regulatory surface or status.
   if(requestedAction==="update_pool"){
    const v=body.pool;
    if(!v||typeof v!=="object"||Array.isArray(v)||!uuid(v.id))return send({error:"Select an existing NON-DOT pool"},400);
    if(typeof v.name!=="string"||!v.name.trim()||v.name.trim().length>120)
     return send({error:"Enter a pool name of 1 to 120 characters"},400);
    const pool=await db.from("workforce_random_pools").select("id,status,employer_id")
     .eq("id",v.id).eq("ctpa_id",ctpaId).eq("business_surface","workforce")
     .eq("program_type","NON_DOT").eq("pool_type","employer").is("archived_at",null).maybeSingle();
    if(pool.error)throw pool.error;
    if(!pool.data||pool.data.status!=="draft"||!uuid(pool.data.employer_id))
     return send({error:"Only a draft NON-DOT employer pool can be renamed"},403);
    const employer=await db.from("workforce_employers").select("id")
     .eq("id",pool.data.employer_id).eq("ctpa_id",ctpaId)
     .eq("workforce_classification","NON_DOT").is("archived_at",null).maybeSingle();
    if(employer.error)throw employer.error;
    if(!employer.data)return send({error:"Pool employer is outside this C/TPA"},403);
    const updated=await db.from("workforce_random_pools")
     .update({name:v.name.trim(),updated_at:new Date().toISOString()})
     .eq("id",v.id).eq("ctpa_id",ctpaId).eq("employer_id",employer.data.id)
     .eq("business_surface","workforce").eq("program_type","NON_DOT")
     .eq("pool_type","employer").eq("status","draft").is("archived_at",null)
     .select("id").maybeSingle();
    if(updated.error)throw updated.error;
    if(!updated.data)return send({error:"Draft pool was changed or is unavailable"},409);
    return send({ok:true,saved:true,section,action:requestedAction});
   }
   // Only adjust an unfulfilled NON-DOT order's collection deadline.
   // Billing, fulfillment, results and all other order fields are intentionally untouched.
   if(requestedAction==="update_test_deadline"){
    const v=body.test;
    if(!v||typeof v!=="object"||Array.isArray(v)||!uuid(v.id))
     return send({error:"Choose an existing NON-DOT order"},400);
    if(typeof v.collection_deadline!=="string"||
       !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(v.collection_deadline))
     return send({error:"A valid UTC collection deadline is required"},400);
    const deadline=new Date(v.collection_deadline),now=Date.now();
    if(!Number.isFinite(deadline.getTime())||deadline.getTime()<=now||
       deadline.getTime()>now+366*24*60*60*1000)
     return send({error:"Collection deadline must be in the next 366 days"},400);
    const order=await db.from("workforce_testing_orders")
     .select("id,employer_id,status").eq("id",v.id)
     .eq("program_type","NON_DOT").eq("business_surface","workforce")
     .eq("status","created").maybeSingle();
    if(order.error)throw order.error;
    if(!order.data||!uuid(order.data.employer_id))
     return send({error:"Only newly created NON-DOT orders may be edited"},403);
    const employer=await db.from("workforce_employers").select("id")
     .eq("id",order.data.employer_id).eq("ctpa_id",ctpaId)
     .eq("workforce_classification","NON_DOT").is("archived_at",null).maybeSingle();
    if(employer.error)throw employer.error;
    if(!employer.data)return send({error:"Order employer is outside this C/TPA"},403);
    const update=await db.from("workforce_testing_orders")
     .update({collection_deadline:deadline.toISOString(),updated_at:new Date().toISOString()})
     .eq("id",v.id).eq("employer_id",employer.data.id).eq("status","created")
     .eq("program_type","NON_DOT").eq("business_surface","workforce")
     .select("id").maybeSingle();
    if(update.error)throw update.error;
    if(!update.data)return send({error:"Order was changed or is no longer editable"},409);
    return send({ok:true,saved:true,section,action:requestedAction});
   }
   if(requestedAction==="add_pool_member"||requestedAction==="remove_pool_member"){
    const v=body.membership||{};
    if(!uuid(v.pool_id)||!uuid(v.employee_id))return send({error:"Select a valid pool and employee"},400);
    const pool=await db.from("workforce_random_pools").select("id,employer_id,tenant_id,status")
     .eq("id",v.pool_id).eq("ctpa_id",ctpaId).eq("business_surface","workforce")
     .eq("program_type","NON_DOT").eq("pool_type","employer").is("archived_at",null).maybeSingle();
    if(pool.error)throw pool.error;
    if(!pool.data||!pool.data.employer_id||pool.data.status==="archived")
     return send({error:"An employer NON-DOT pool is required"},403);
    const emp=await db.from("workforce_employees").select("id").eq("id",v.employee_id)
     .eq("employer_id",pool.data.employer_id).eq("business_surface","workforce")
     .is("archived_at",null).maybeSingle();
    if(emp.error)throw emp.error;
    if(!emp.data)return send({error:"Employee does not belong to the pool employer"},403);
    const active=await db.from("workforce_pool_memberships").select("id")
     .eq("pool_id",v.pool_id).eq("employee_id",v.employee_id)
     .is("removed_at",null).maybeSingle();
    if(active.error)throw active.error;
    if(requestedAction==="remove_pool_member"){
     if(!active.data)return send({error:"Active membership not found"},404);
     const removed=await db.from("workforce_pool_memberships").update({
      eligibility_status:"removed",removed_at:new Date().toISOString(),
      removal_reason:"Removed by C/TPA account manager",updated_at:new Date().toISOString()
     }).eq("id",active.data.id).eq("pool_id",v.pool_id).select("id").maybeSingle();
     if(removed.error)throw removed.error;
     if(!removed.data)return send({error:"Membership not found"},404);
     return send({ok:true,saved:true,section,action:requestedAction});
    }
    if(active.data)return send({error:"Employee is already in this pool"},409);
    const created=await db.from("workforce_pool_memberships").insert({
     tenant_id:pool.data.tenant_id,pool_id:v.pool_id,employee_id:v.employee_id,
     eligibility_status:"eligible",business_surface:"workforce",
     effective_date:new Date().toISOString().slice(0,10),updated_at:new Date().toISOString()
    }).select("id").single();
    if(created.error)throw created.error;
    return send({ok:true,saved:true,section,action:requestedAction});
   }
   const v=requestedAction==="save_employee"?body.employee:requestedAction==="save_pool"?body.pool:requestedAction==="create_test_order"?body.test:body.program;
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
   }else if(requestedAction==="create_test_order"){
    if(!uuid(v.employee_id)||!uuid(v.program_id))return send({error:"Select an employee and NON-DOT testing program"},400);
    const [employee,program]=await Promise.all([
     db.from("workforce_employees").select("id").eq("id",v.employee_id).eq("employer_id",v.employer_id)
      .eq("business_surface","workforce").is("archived_at",null).maybeSingle(),
     db.from("workforce_programs").select("id").eq("id",v.program_id).eq("employer_id",v.employer_id)
      .eq("program_type","NON_DOT").eq("business_surface","workforce").is("archived_at",null).maybeSingle()
    ]);
    if(employee.error||program.error)throw employee.error||program.error;
    if(!employee.data||!program.data)return send({error:"Employee and NON-DOT program must belong to the selected employer"},403);
    if(!uuid(v.client_request_id))return send({error:"A unique order request identifier is required"},400);
    const types=new Set(["drug","alcohol"]);
    if(!types.has(String(v.test_type)))return send({error:"Choose a supported testing type"},400);
    value={employer_id:v.employer_id,employee_id:v.employee_id,program_id:v.program_id,
      test_type:v.test_type,reason:"other",client_request_id:v.client_request_id};
   }else if(requestedAction==="save_pool"){
    if(!uuid(v.program_id)||!clean(v.name))return send({error:"A valid NON-DOT program and pool name are required"},400);
    const program=await db.from("workforce_programs").select("id,employer_id").eq("id",v.program_id)
     .eq("employer_id",v.employer_id).eq("program_type","NON_DOT").eq("business_surface","workforce").is("archived_at",null).maybeSingle();
    if(program.error)throw program.error;
    if(!program.data)return send({error:"NON-DOT program must belong to the selected employer"},403);
    value={employer_id:v.employer_id,program_id:v.program_id,name:clean(v.name),pool_type:"employer",status:"draft",selection_schedule:"quarterly"};
   }else{
    if(!clean(v.name))return send({error:"Program name is required"},400);
    value={employer_id:v.employer_id,name:clean(v.name),status:"active"};
   }
   const saved=await fetch(url+"/functions/v1/"+(requestedAction==="save_pool"?"workforce-ctpa-secure-pools":requestedAction==="create_test_order"?"workforce-ctpa-secure-testing":"workforce-ctpa-secure-programs"),{
    method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},
    body:JSON.stringify({action:requestedAction==="create_test_order"?"create":requestedAction,
      ctpa_id:ctpaId,subscription_id:subscriptionId,[requestedAction==="save_employee"?"employee":requestedAction==="save_pool"?"pool":requestedAction==="create_test_order"?"test":"program"]:value}),cache:"no-store"
   });
   const result=await saved.json().catch(()=>({}));
   if(!saved.ok||result.ok!==true)return send({error:result.error||"Unable to save this NON-DOT record"},saved.status||502);
   return send({ok:true,saved:true,section,action:requestedAction});
  }
  const response=await fetch(url+"/functions/v1/"+rule.endpoint,{
   method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},
   body:JSON.stringify({action:"workspace",ctpa_id:context.ctpa_id||undefined,subscription_id:onlyNondot?subscriptionId:context.subscription_id}),cache:"no-store"
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
    employees:(data.employees||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,first_name:x.first_name,last_name:x.last_name,employee_number:x.employee_number,employment_status:x.employment_status,status:x.status}))
   }:section==="programs"?{
    employers:company,
    programs:(data.programs||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,name:x.name,program_name:x.program_name,status:x.status}))
   }:section==="pools"?{
    pools:(data.pools||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,pool_type:x.pool_type,name:x.name,pool_name:x.pool_name,status:x.status})),
    employees:(data.employees||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,first_name:x.first_name,last_name:x.last_name})),
    employers:company,
    programs:(data.programs||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,name:x.name})),
    memberships:(data.pool_memberships||data.memberships||[]).slice(0,500).filter((x:any)=>!x.removed_at).map((x:any)=>({id:x.id,pool_id:x.pool_id,employee_id:x.employee_id}))
   }:section==="testing"?{
    employers:company,
    employees:(data.employees||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,first_name:x.first_name,last_name:x.last_name})),
    programs:(data.programs||[]).slice(0,250).map((x:any)=>({id:x.id,employer_id:x.employer_id,name:x.name})),
    orders:(data.testing_orders||data.orders||[]).slice(0,250).map((x:any)=>({id:x.id,order_number:x.order_number,employer_id:x.employer_id,created_at:x.created_at,collection_deadline:x.collection_deadline,status:x.status}))
   }:{
    reports:(data.result_reports||data.reports||data.results||[]).slice(0,250).map((x:any)=>({id:x.id,report_number:x.report_number,order_number:x.order_number,status:x.status,report_status:x.report_status,result_status:x.result_status,updated_at:x.updated_at,released_at:x.released_at}))
   };
  let canManage=false;
  if(body.operating_context==="nondot"&&["people","programs","pools","testing"].includes(section)){
   const {createClient}=await import("npm:@supabase/supabase-js@2");
   const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
   const {data:{user},error:authError}=await auth.auth.getUser(token);
   if(!authError&&user){
    const db=createClient(url,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
    const [member,personal]=await Promise.all([
     db.from("workforce_memberships").select("id").eq("user_id",user.id)
       .eq("organization_id",organizationId).eq("status","active").eq("is_primary",true).limit(1),
     db.from("workforce_portal_user_access").select("enabled").eq("organization_id",organizationId)
       .eq("user_id",user.id).eq("portal_code","ctpa_workforce").maybeSingle()
    ]);
    if(member.error||personal.error)throw member.error||personal.error;
    canManage=!!member.data?.length&&personal.data?.enabled!==false;
   }
  }
  return send({ok:true,section,context:"nondot",plan_code:context.plan_code,read_only:!canManage,
   can_manage:canManage,available_sections:Object.entries(modules)
    .filter(([,rule])=>context.feature_codes.includes(rule.permission)).map(([id])=>id),
   data:payload});
 }catch(err){console.error("workforce-ctpa-nondot-workspace",err);return send({error:"Unable to access NON-DOT module"},500)}
});