import { createClient } from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});const now=()=>new Date().toISOString();
Deno.serve(async(req:Request)=>{if(req.method==="OPTIONS")return new Response("ok",{status:200,headers:H});if(req.method!=="POST")return J({error:"Method not allowed."},405);try{const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");if(!token)return J({error:"Authentication required."},401);const auth=createClient(url,anon,{auth:{persistSession:false}}),db=createClient(url,svc,{auth:{persistSession:false}});const {data:ud}=await auth.auth.getUser(token);if(!ud.user)return J({error:"Authentication required."},401);const user=ud.user,body=await req.json().catch(()=>({})),action=String(body.action||"workspace");const mq=await db.from("workforce_memberships").select("*").eq("user_id",user.id).eq("status","active");if(mq.error)throw mq.error;let ctpa:any=null,membership:any=null;for(const m of mq.data||[]){let q=db.from("workforce_ctpas").select("*").eq("organization_id",m.organization_id).eq("status","active");if(body.ctpa_id)q=q.eq("id",body.ctpa_id);const r=await q.maybeSingle();if(r.error)throw r.error;if(r.data){ctpa=r.data;membership=m;break;}}if(!ctpa)return J({error:"Active Workforce NON DOT C/TPA account was not found."},403);

 // Unified Workforce security boundary. Must be enforced on the legacy URL too,
 // not only by a new portal wrapper.
 if(!body.ctpa_id||String(body.ctpa_id)!==String(ctpa.id))
  return J({error:"Select your authorized NON-DOT C/TPA workspace."},403);
 const [personal,portal,subscriptions]=await Promise.all([
  db.from("workforce_portal_user_access").select("enabled").eq("user_id",user.id)
   .eq("organization_id",ctpa.organization_id).eq("portal_code","ctpa_workforce").maybeSingle(),
  db.from("workforce_portal_access").select("enabled").eq("organization_id",ctpa.organization_id)
   .eq("portal_code","ctpa_workforce").eq("enabled",true).limit(1),
  db.from("workforce_subscriptions").select("id,plan_id,status").eq("ctpa_id",ctpa.id)
   .in("status",["active","trial","trialing"]).order("created_at",{ascending:false}).limit(1).maybeSingle()
 ]);
 if(personal.error||portal.error||subscriptions.error)throw personal.error||portal.error||subscriptions.error;
 if(personal.data?.enabled===false)return J({error:"Your Workforce C/TPA portal access has been revoked."},403);
 if(!portal.data?.length)return J({error:"Workforce C/TPA portal is disabled for this company."},403);
 if(!subscriptions.data)return J({error:"Active C/TPA subscription required."},403);
 const verifiedPlan=await db.from("workforce_plans").select("id,code,active,audience")
  .eq("id",subscriptions.data.plan_id).eq("active",true).eq("audience","ctpa").maybeSingle();
 if(verifiedPlan.error)throw verifiedPlan.error;
 if(!verifiedPlan.data||!["workforce_ctpa_essential","workforce_ctpa_professional","workforce_ctpa_enterprise"].includes(verifiedPlan.data.code))
  return J({error:"An active C/TPA subscription tier is required."},403);
 if(body.subscription_id&&String(body.subscription_id)!==String(subscriptions.data.id))
  return J({error:"The selected C/TPA subscription is not active for this workspace."},403);
 const [permissions,overrides]=await Promise.all([
  db.from("workforce_plan_features").select("feature_id,enabled,workforce_feature_catalog(code,active)")
   .eq("plan_id",subscriptions.data.plan_id),
  db.from("workforce_account_feature_overrides").select("feature_id,enabled")
   .eq("ctpa_id",ctpa.id).eq("subscription_id",subscriptions.data.id)
 ]);
 if(permissions.error||overrides.error)throw permissions.error||overrides.error;
 const changes=new Map((overrides.data||[]).map((v:any)=>[v.feature_id,v.enabled]));
 const enabled=new Set((permissions.data||[]).filter((v:any)=>v.workforce_feature_catalog?.active!==false&&
  v.workforce_feature_catalog?.code&&(changes.has(v.feature_id)?changes.get(v.feature_id)===true:v.enabled===true))
  .map((v:any)=>String(v.workforce_feature_catalog.code)));
 const requiredByAction:Record<string,string>={"create":"testing_orders","update_order":"testing_orders","archive_order":"testing_orders"};
 const mutating=Object.prototype.hasOwnProperty.call(requiredByAction,action);
 const required=requiredByAction[action];
 if(action!=="workspace"&&!mutating)return J({error:"Unsupported NON-DOT operation."},400);
 if(mutating){
  if(!membership.is_primary)return J({error:"Only primary C/TPA account managers may change these NON-DOT records."},403);
  if(!enabled.has(required))return J({error:"This operation is not included in your purchased plan."},403);
 }else if(!["testing_orders"].every(feature=>enabled.has(feature))){
  return J({error:"Your subscription does not include this NON-DOT workspace."},403);
 }

 const eq=await db.from("workforce_employers").select("*").eq("ctpa_id",ctpa.id).eq("workforce_classification","NON_DOT").is("archived_at",null);if(eq.error)throw eq.error;const employers=eq.data||[],eids=employers.map((e:any)=>e.id);let employees:any[]=[],programs:any[]=[],locations:any[]=[],orders:any[]=[];if(eids.length){const [a,b,c,d]=await Promise.all([db.from("workforce_employees").select("*").in("employer_id",eids).eq("business_surface","workforce").is("archived_at",null),db.from("workforce_programs").select("*").in("employer_id",eids).eq("program_type","NON_DOT").eq("business_surface","workforce").is("archived_at",null),db.from("workforce_locations").select("*").in("employer_id",eids).eq("business_surface","workforce"),db.from("workforce_testing_orders").select("*").in("employer_id",eids).eq("program_type","NON_DOT").eq("business_surface","workforce").order("created_at",{ascending:false})]);for(const q of [a,b,c,d])if(q.error)throw q.error;employees=a.data||[];programs=b.data||[];locations=c.data||[];orders=d.data||[];}
 const hydrate=(xs:any[])=>xs.map(o=>({...o,employees:employees.find(e=>e.id===o.employee_id)||null,programs:programs.find(p=>p.id===o.program_id)||null}));
 const catalogQ=await db.from("workforce_service_offerings").select("*").eq("active",true).eq("product_surface","workforce").contains("customer_types",["ctpa"]).order("sort_order");if(catalogQ.error)throw catalogQ.error;const services=(catalogQ.data||[]).filter((x:any)=>String(x?.metadata?.source_metadata?.testing_scope||"").toLowerCase()==="non_dot").map((x:any)=>({...x,service_code:x.sku,service_label:x.name,specimen_type:x.specimen}));
 if(action==="create"){const v=body.test||{},employer=employers.find(e=>String(e.id)===String(v.employer_id)),employee=employees.find(e=>String(e.id)===String(v.employee_id)),program=programs.find(p=>String(p.id)===String(v.program_id));if(!employer||!employee||String(employee.employer_id)!==String(employer.id))return J({error:"Choose a valid Employer and person."},400);if(!program||String(program.employer_id)!==String(employer.id))return J({error:"Choose a valid NON-DOT Program for this Employer."},400);// The caller may supply a stable UUID for retries. The existing globally unique
 // order_number constraint makes identical submissions converge to one order.
 // Old clients without a request ID retain their original unique-number behavior.
 const requestId=v.client_request_id;
 if(requestId!==undefined&&(typeof requestId!=="string"||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)))
  return J({error:"Invalid order request identifier."},400);
 const orderNumber=requestId?"NDT-"+requestId.toUpperCase():`NDT-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
 const matching=(record:any)=>record&&record.created_by===user.id&&
  record.employer_id===employer.id&&record.employee_id===employee.id&&record.program_id===program.id&&
  record.test_type===String(v.test_type||v.service_code||"drug")&&
  record.program_type==="NON_DOT"&&record.business_surface==="workforce";
 if(requestId){
  const existing=await db.from("workforce_testing_orders").select("*").eq("order_number",orderNumber).maybeSingle();
  if(existing.error)throw existing.error;
  if(existing.data)return matching(existing.data)?J({ok:true,order:existing.data,testing_order:existing.data,reused:true}):
   J({error:"This request identifier has already been used for a different order."},409);
 }const row:any={tenant_id:employer.tenant_id,employer_id:employer.id,employee_id:employee.id,program_id:program.id,pool_id:v.pool_id||null,selection_member_id:v.selection_member_id||null,order_number:orderNumber,reason:String(v.reason||"other"),test_type:String(v.test_type||v.service_code||"drug"),program_type:"NON_DOT",testing_panel:String(v.testing_panel||"").trim()||null,collection_type:String(v.collection_type||"").trim()||null,collection_deadline:v.collection_deadline||null,collection_site_id:v.collection_site_id||null,status:"created",created_by:user.id,business_surface:"workforce",updated_at:now()};const q=await db.from("workforce_testing_orders").insert(row).select("*").single();
 if(q.error){
  // Concurrent retries can race the initial lookup; the unique constraint
  // allows precisely one insert. Never return a different customer's order.
  if(requestId&&q.error.code==="23505"){
   const retry=await db.from("workforce_testing_orders").select("*").eq("order_number",orderNumber).maybeSingle();
   if(retry.error)throw retry.error;
   if(matching(retry.data))return J({ok:true,order:retry.data,testing_order:retry.data,reused:true});
   return J({error:"This request identifier is already in use."},409);
  }
  throw q.error;
 }
 return J({ok:true,order:q.data,testing_order:q.data,reused:false});}
 if(action==="update_order"){const id=String(body.testing_order_id||""),v=body.order||{};const existing=orders.find(o=>String(o.id)===id);if(!existing)return J({error:"Testing order not found."},404);if(!["created","assigned"].includes(String(existing.status)))return J({error:"This testing order can no longer be edited."},409);const q=await db.from("workforce_testing_orders").update({collection_deadline:v.collection_deadline||null,collection_site_id:v.collection_site_id||null,updated_at:now()}).eq("id",id).select("*").single();if(q.error)throw q.error;return J({ok:true,order:q.data});}
 if(action==="archive_order"){const id=String(body.testing_order_id||""),existing=orders.find(o=>String(o.id)===id);if(!existing)return J({error:"Testing order not found."},404);const q=await db.from("workforce_testing_orders").update({status:"cancelled",updated_at:now()}).eq("id",id).select("*").single();if(q.error)throw q.error;return J({ok:true,order:q.data});}
 return J({ok:true,ctpa,membership,employers,employees,programs,locations,sites:locations,orders:hydrate(orders),testing_orders:hydrate(orders),services,service_catalog:services,testing_requests:[],handoffs:[],can_manage:true});
}catch(e){console.error("nondot-workforce-ctpa-testing",e);return J({error:e instanceof Error?e.message:String(e)},500)}});