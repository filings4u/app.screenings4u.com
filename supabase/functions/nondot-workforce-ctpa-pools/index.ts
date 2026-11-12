import { createClient } from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const ACTIVE=["active","trial","trialing"];
const now=()=>new Date().toISOString();
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{status:200,headers:H});
 if(req.method!=="POST")return J({error:"Method not allowed."},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();if(!token)return J({error:"Authentication required."},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:ud,error:ue}=await auth.auth.getUser(token);const user=ud?.user;if(ue||!user)return J({error:"Authentication required."},401);
  const body=await req.json().catch(()=>({})),action=String(body.action||"workspace");
  const mq=await db.from("workforce_memberships").select("*").eq("user_id",user.id).eq("status","active");if(mq.error)throw mq.error;
  let membership:any=null,ctpa:any=null;
  for(const m of mq.data||[]){let q=db.from("workforce_ctpas").select("*").eq("organization_id",m.organization_id).eq("status","active");if(body.ctpa_id)q=q.eq("id",body.ctpa_id);const r=await q.maybeSingle();if(r.error)throw r.error;if(r.data){membership=m;ctpa=r.data;break;}}
  if(!membership||!ctpa)return J({error:"Active Workforce NON DOT C/TPA account was not found."},403);
  const pa=await db.from("workforce_portal_access").select("id").eq("organization_id",ctpa.organization_id).eq("portal_code","ctpa_workforce").eq("enabled",true).maybeSingle();if(pa.error)throw pa.error;if(!pa.data)return J({error:"C/TPA portal access is not enabled."},403);
  const sq=await db.from("workforce_subscriptions").select("*").eq("ctpa_id",ctpa.id).in("status",ACTIVE).order("created_at",{ascending:false}).limit(1).maybeSingle();if(sq.error)throw sq.error;if(!sq.data)return J({error:"An active Workforce NON DOT C/TPA subscription is required."},403);

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
 const requiredByAction:Record<string,string>={"save_pool":"consortium_pools","save_membership":"consortium_pools","remove_membership":"consortium_pools","archive_pool":"consortium_pools"};
 const mutating=Object.prototype.hasOwnProperty.call(requiredByAction,action);
 const required=requiredByAction[action];
 if(action!=="workspace"&&!mutating)return J({error:"Unsupported NON-DOT operation."},400);
 if(mutating){
  if(!membership.is_primary)return J({error:"Only primary C/TPA account managers may change these NON-DOT records."},403);
  if(!enabled.has(required))return J({error:"This operation is not included in your purchased plan."},403);
 }else if(!["consortium_pools"].every(feature=>enabled.has(feature))){
  return J({error:"Your subscription does not include this NON-DOT workspace."},403);
 }

  const employersQ=await db.from("workforce_employers").select("*").eq("ctpa_id",ctpa.id).eq("workforce_classification","NON_DOT").is("archived_at",null).order("legal_name");if(employersQ.error)throw employersQ.error;const employers=employersQ.data||[],eids=employers.map((e:any)=>e.id);
  let programs:any[]=[],employees:any[]=[];
  if(eids.length){const [pq,eq]=await Promise.all([db.from("workforce_programs").select("*").in("employer_id",eids).eq("program_type","NON_DOT").eq("business_surface","workforce").is("archived_at",null).order("name"),db.from("workforce_employees").select("*").in("employer_id",eids).eq("business_surface","workforce").is("archived_at",null).order("last_name")]);if(pq.error)throw pq.error;if(eq.error)throw eq.error;programs=pq.data||[];employees=eq.data||[];}
  const load=async()=>{const poolsQ=await db.from("workforce_random_pools").select("*").eq("ctpa_id",ctpa.id).eq("program_type","NON_DOT").eq("business_surface","workforce").is("archived_at",null).order("created_at",{ascending:false});if(poolsQ.error)throw poolsQ.error;const pools=poolsQ.data||[];let members:any[]=[];const pids=pools.map((p:any)=>p.id);if(pids.length){const q=await db.from("workforce_pool_memberships").select("*").in("pool_id",pids).eq("business_surface","workforce").order("created_at",{ascending:false});if(q.error)throw q.error;members=q.data||[];}return {pools,members};};
  if(action==="save_pool"){
   const v=body.pool||{};let program=programs.find((p:any)=>String(p.id)===String(v.program_id));
   if(!program&&v.id){const old=await db.from("workforce_random_pools").select("*").eq("id",v.id).eq("ctpa_id",ctpa.id).eq("business_surface","workforce").maybeSingle();if(old.error)throw old.error;if(old.data)program=programs.find((p:any)=>String(p.id)===String(old.data.program_id));}
   if(!program)return J({error:"Select a NON-DOT Program before creating the Pool."},400);
   const employer=employers.find((e:any)=>String(e.id)===String(v.employer_id||program.employer_id));if(!employer)return J({error:"Select a managed Employer."},400);
   const name=String(v.name||program.name||"").trim();if(!name)return J({error:"Pool name is required."},400);
   const rawType=String(v.pool_type||"employer").toLowerCase();const poolType=rawType==="consortium"?"consortium":"employer";
   const row:any={tenant_id:employer.tenant_id,ctpa_id:ctpa.id,employer_id:poolType==="employer"?employer.id:null,program_id:program.id,name,pool_type:poolType,program_type:"NON_DOT",dot_agency:null,effective_date:v.effective_date||program.effective_date||new Date().toISOString().slice(0,10),drug_testing_rate:v.drug_testing_rate===""||v.drug_testing_rate==null?(program.drug_random_rate??null):Number(v.drug_testing_rate),alcohol_testing_rate:v.alcohol_testing_rate===""||v.alcohol_testing_rate==null?(program.alcohol_random_rate??0):Number(v.alcohol_testing_rate),selection_schedule:String(v.selection_schedule||program.testing_frequency||"quarterly"),status:["draft","active","suspended","inactive","archived"].includes(String(v.status))?String(v.status):"active",created_by:user.id,business_surface:"workforce",updated_at:now()};
   let q:any;if(v.id)q=await db.from("workforce_random_pools").update(row).eq("id",v.id).eq("ctpa_id",ctpa.id).eq("business_surface","workforce").select("*").maybeSingle();else q=await db.from("workforce_random_pools").insert(row).select("*").single();if(q.error)throw q.error;if(!q.data)return J({error:"Pool was not found."},404);return J({ok:true,pool:q.data});
  }
  if(action==="save_membership"){
   const v=body.membership||{};const {pools}=await load();const pool=pools.find((p:any)=>String(p.id)===String(v.pool_id));if(!pool)return J({error:"Pool was not found in this C/TPA account."},404);
   const employee=employees.find((e:any)=>String(e.id)===String(v.employee_id));if(!employee)return J({error:"Person was not found in this C/TPA account."},404);
   if(pool.pool_type==="employer"&&pool.employer_id&&String(employee.employer_id)!==String(pool.employer_id))return J({error:"This person belongs to a different Employer than this Pool."},400);
   const current=await db.from("workforce_pool_memberships").select("*").eq("pool_id",pool.id).eq("employee_id",employee.id).is("removed_at",null).maybeSingle();if(current.error)throw current.error;
   const row:any={tenant_id:pool.tenant_id,pool_id:pool.id,employee_id:employee.id,employee_program_id:v.employee_program_id||null,effective_date:v.effective_date||new Date().toISOString().slice(0,10),eligibility_status:["pending","eligible","ineligible","removed"].includes(String(v.eligibility_status))?String(v.eligibility_status):"eligible",ineligible_reason:v.ineligible_reason||null,removed_at:null,removal_reason:null,business_surface:"workforce",updated_at:now()};
   let q:any;if(current.data)q=await db.from("workforce_pool_memberships").update(row).eq("id",current.data.id).select("*").single();else q=await db.from("workforce_pool_memberships").insert(row).select("*").single();if(q.error)throw q.error;return J({ok:true,membership:q.data});
  }
  if(action==="remove_membership"){
   const id=String(body.pool_membership_id||body.membership_id||"");if(!id)return J({error:"Pool membership ID is required."},400);const {pools}=await load();const pids=pools.map((p:any)=>p.id);if(!pids.length)return J({error:"Pool membership was not found."},404);
   const existing=await db.from("workforce_pool_memberships").select("*").eq("id",id).in("pool_id",pids).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)return J({error:"Pool membership was not found."},404);
   const q=await db.from("workforce_pool_memberships").update({eligibility_status:"removed",removed_at:now(),removal_reason:String(body.removal_reason||"Removed from pool").trim(),updated_at:now()}).eq("id",id).select("*").single();if(q.error)throw q.error;return J({ok:true,membership:q.data});
  }
  if(action==="archive_pool"){
   const q=await db.from("workforce_random_pools").update({status:"archived",archived_at:now(),updated_at:now()}).eq("id",body.pool_id).eq("ctpa_id",ctpa.id).eq("business_surface","workforce").select("id").maybeSingle();if(q.error)throw q.error;if(!q.data)return J({error:"Pool was not found."},404);return J({ok:true,id:q.data.id});
  }
  const {pools,members}=await load();return J({ok:true,ctpa,membership,subscription:sq.data,employers,employees,programs,pools,pool_memberships:members,memberships:members,ui_options:{selection_schedules:["monthly","quarterly","semiannual","annual"],pool_statuses:["draft","active","inactive"]}});
 }catch(e){console.error("nondot-workforce-ctpa-pools",e);return J({error:e instanceof Error?e.message:String(e)},500)}
});