import { createClient } from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const ACTIVE=["active","trial","trialing"]; const now=()=>new Date().toISOString();
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{status:200,headers:H});
 if(req.method!=="POST")return J({error:"Method not allowed."},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim(); if(!token)return J({error:"Authentication required."},401);
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:ud,error:ue}=await auth.auth.getUser(token); const user=ud?.user;if(ue||!user)return J({error:"Authentication required."},401);
  const body=await req.json().catch(()=>({})); const action=String(body.action||"workspace");
  const mq=await db.from("workforce_memberships").select("*").eq("user_id",user.id).eq("status","active"); if(mq.error)throw mq.error;
  let membership:any=null,ctpa:any=null;
  for(const m of mq.data||[]){let q=db.from("workforce_ctpas").select("*").eq("organization_id",m.organization_id).eq("status","active");if(body.ctpa_id)q=q.eq("id",body.ctpa_id);const r=await q.maybeSingle();if(r.error)throw r.error;if(r.data){membership=m;ctpa=r.data;break;}}
  if(!membership||!ctpa)return J({error:"Active Workforce NON DOT C/TPA membership was not found."},403);
  const pa=await db.from("workforce_portal_access").select("id").eq("organization_id",ctpa.organization_id).eq("portal_code","ctpa_workforce").eq("enabled",true).maybeSingle();if(pa.error)throw pa.error;if(!pa.data)return J({error:"Workforce NON DOT portal access is not enabled."},403);
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
 const requiredByAction:Record<string,string>={"save_employee":"employee_management","archive_employee":"employee_management","save_program":"programs","delete_program":"programs","archive_program":"programs"};
 const mutating=Object.prototype.hasOwnProperty.call(requiredByAction,action);
 const required=requiredByAction[action];
 if(action!=="workspace"&&!mutating)return J({error:"Unsupported NON-DOT operation."},400);
 if(mutating){
  if(!membership.is_primary)return J({error:"Only primary C/TPA account managers may change these NON-DOT records."},403);
  if(!enabled.has(required))return J({error:"This operation is not included in your purchased plan."},403);
 }else if(!["employee_management","programs"].every(feature=>enabled.has(feature))){
  return J({error:"Your subscription does not include this NON-DOT workspace."},403);
 }

  const eq=await db.from("workforce_employers").select("*").eq("ctpa_id",ctpa.id).eq("workforce_classification","NON_DOT").is("archived_at",null).order("legal_name");if(eq.error)throw eq.error;
  const employers=eq.data||[], employerIds=employers.map((e:any)=>e.id);
  const loadEmployees=async()=>{if(!employerIds.length)return[];const q=await db.from("workforce_employees").select("*").in("employer_id",employerIds).eq("business_surface","workforce").is("archived_at",null).order("created_at",{ascending:false});if(q.error)throw q.error;return q.data||[]};
  const loadPrograms=async()=>{if(!employerIds.length)return[];const q=await db.from("workforce_programs").select("*").in("employer_id",employerIds).eq("program_type","NON_DOT").eq("business_surface","workforce").is("archived_at",null).order("created_at",{ascending:false});if(q.error)throw q.error;return q.data||[]};
  if(action==="save_employee"){
    const v=body.employee||{}, employer=employers.find((e:any)=>String(e.id)===String(v.employer_id));
    if(!employer)return J({error:"Choose a managed Employer for this person."},400);
    const first=String(v.first_name||"").trim(),last=String(v.last_name||"").trim();if(!first||!last)return J({error:"First name and last name are required."},400);
    const workerType=["employee","driver","staff","contractor"].includes(String(v.workforce_worker_type))?String(v.workforce_worker_type):"employee";
    const status=["invited","pending_enrollment","active","suspended","leave","inactive","terminated","compliance_hold"].includes(String(v.employment_status))?String(v.employment_status):"active";
    const row:any={tenant_id:employer.tenant_id,employer_id:employer.id,first_name:first,middle_name:String(v.middle_name||"").trim()||null,last_name:last,employee_number:String(v.employee_number||"").trim()||null,job_title:String(v.job_title||"").trim()||null,email:String(v.email||"").trim().toLowerCase()||null,mobile:String(v.mobile||"").trim()||null,date_of_birth:v.date_of_birth||null,workforce_worker_type:workerType,employment_status:status,safety_sensitive:v.safety_sensitive===true||String(v.safety_sensitive)==="true",dot_covered:false,dot_agency:null,cdl_number:null,cdl_state:null,dot_position_id:null,business_surface:"workforce",archived_at:null,updated_at:now()};
    let q:any;if(v.id)q=await db.from("workforce_employees").update(row).eq("id",v.id).in("employer_id",employerIds).select("*").maybeSingle();else q=await db.from("workforce_employees").insert(row).select("*").single();
    if(q.error)throw q.error;if(!q.data)return J({error:"Person was not found in this C/TPA account."},404);
    return J({ok:true,employee:q.data,person:q.data,employees:await loadEmployees(),employers,programs:await loadPrograms()});
  }
  if(action==="archive_employee"){
    const id=String(body.employee_id||body.id||"");if(!id)return J({error:"Person ID is required."},400);
    const q=await db.from("workforce_employees").update({employment_status:"inactive",archived_at:now(),updated_at:now()}).eq("id",id).in("employer_id",employerIds).select("*").maybeSingle();if(q.error)throw q.error;if(!q.data)return J({error:"Person not found."},404);
    return J({ok:true,employee:q.data,employees:await loadEmployees()});
  }
  if(action==="save_program"){
    const v=body.program||{},employer=employers.find((e:any)=>String(e.id)===String(v.employer_id));if(!employer)return J({error:"Choose a managed Employer for this program."},400);
    const name=String(v.name||"").trim();if(!name)return J({error:"Program name is required."},400);
    const row:any={tenant_id:employer.tenant_id,employer_id:employer.id,name,program_type:"NON_DOT",regulatory_authority:"COMPANY_POLICY",dot_agency:null,testing_panel:String(v.testing_panel||"").trim()||null,testing_method:String(v.testing_method||"").trim()||null,drug_random_rate:v.drug_random_rate===""||v.drug_random_rate==null?null:Number(v.drug_random_rate),alcohol_random_rate:v.alcohol_random_rate===""||v.alcohol_random_rate==null?null:Number(v.alcohol_random_rate),testing_frequency:String(v.testing_frequency||"").trim()||null,effective_date:String(v.effective_date||new Date().toISOString().slice(0,10)),status:String(v.status||"active"),regulatory_category:"company_policy",agency_configuration:{},business_surface:"workforce",archived_at:null,updated_at:now()};
    let q:any;if(v.id)q=await db.from("workforce_programs").update(row).eq("id",v.id).in("employer_id",employerIds).select("*").maybeSingle();else q=await db.from("workforce_programs").insert(row).select("*").single();
    if(q.error)throw q.error;if(!q.data)return J({error:"Program not found."},404);return J({ok:true,program:q.data,employers,employees:await loadEmployees(),programs:await loadPrograms()});
  }
  if(action==="delete_program"||action==="archive_program"){
    const id=String(body.program_id||body.id||"");const q=await db.from("workforce_programs").update({status:"archived",archived_at:now(),updated_at:now()}).eq("id",id).in("employer_id",employerIds).select("*").maybeSingle();if(q.error)throw q.error;if(!q.data)return J({error:"Program not found."},404);return J({ok:true,program:q.data,programs:await loadPrograms()});
  }
  return J({ok:true,has_access:true,portal_code:"ctpa_workforce",portal_name:"Workforce NON DOT",ctpa,membership,subscription:sq.data,employers,employees:await loadEmployees(),programs:await loadPrograms(),can_manage_programs:true});
 }catch(e){console.error("nondot-workforce-ctpa-programs",e);return J({error:e instanceof Error?e.message:String(e)},500)}
});