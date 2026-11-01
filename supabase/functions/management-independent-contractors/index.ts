import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:H});
Deno.serve(async(req)=>{
if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return J({error:"POST required"},405);
try{
const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
const auth=createClient(url,anon,{auth:{persistSession:false}}),db=createClient(url,svc,{auth:{persistSession:false}});
const u=await auth.auth.getUser(token);if(u.error||!u.data.user)return J({error:"Sign in required"},401);
const uid=u.data.user.id;
const [staff,roles,access]=await Promise.all([db.from("staff_profiles").select("employment_status").eq("user_id",uid).maybeSingle(),db.from("staff_role_assignments").select("role_code").eq("user_id",uid).eq("active",true).limit(1),db.from("staff_business_access").select("access_level").eq("user_id",uid).eq("active",true)]);
if(staff.error||roles.error||access.error)throw staff.error||roles.error||access.error;
if(staff.data?.employment_status!=="active"||(!roles.data?.length&&!(access.data||[]).some((r:any)=>["admin","owner","manager","full"].includes(String(r.access_level||"").toLowerCase()))))return J({error:"Management permission required"},403);
const b=await req.json().catch(()=>({})),action=String(b.action||"list");
const fields="id,full_name,email,phone,company_name,website,city,state,zip_code,service_areas,collector_type,certifications,years_experience,message,status,availability_status,capabilities,rate_card,internal_notes,last_contacted_at,approved_at,created_at,updated_at";
if(action==="list"){const q=await db.from("collector_network_submissions").select(fields).order("created_at",{ascending:false}).limit(1000);if(q.error)throw q.error;return J({contractors:q.data||[]});}
if(action==="detail"){const q=await db.from("collector_network_submissions").select(fields).eq("id",String(b.id||"")).maybeSingle();if(q.error)throw q.error;return J({contractor:q.data});}
if(action==="deny"){
 const id=String(b.id||""),reason=String(b.reason||"").trim();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!reason)return J({error:"A denial reason is required"},400);
 const existing=await db.from("collector_network_submissions").select("id,email,status").eq("id",id).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)return J({error:"Application not found"},404);
 if(existing.data.status==="approved")return J({error:"Approved collectors must be deactivated separately"},409);
 if(existing.data.status==="rejected")return J({error:"Application is already denied. Use Restore."},409);
 const now=new Date().toISOString();
 const denied=await db.from("ic_application_denials").insert({email:String(existing.data.email).toLowerCase(),applicant_id:id,denial_reason:reason,denied_by:uid,denied_at:now});if(denied.error)throw denied.error;
 const update=await db.from("collector_network_submissions").update({status:"rejected",internal_notes:reason,updated_at:now}).eq("id",id);if(update.error)throw update.error;
 return J({ok:true,status:"rejected"});
}
if(action==="restore"){
 const id=String(b.id||""),reason=String(b.reason||"").trim();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!reason)return J({error:"Restoration reason required"},400);
 const existing=await db.from("collector_network_submissions").select("id,email,status").eq("id",id).maybeSingle();if(existing.error)throw existing.error;if(!existing.data||existing.data.status!=="rejected")return J({error:"Only denied applications can be restored"},409);
 const now=new Date().toISOString();const log=await db.from("ic_application_denials").update({restored_at:now,restored_by:uid,restoration_reason:reason}).eq("applicant_id",id).is("restored_at",null);if(log.error)throw log.error;
 const update=await db.from("collector_network_submissions").update({status:"reviewing",updated_at:now}).eq("id",id);if(update.error)throw update.error;
 return J({ok:true,status:"reviewing"});
}
if(action==="update"){
const id=String(b.id||"");if(!/^[a-f0-9-]{36}$/i.test(id))return J({error:"Invalid contractor"},400);
const v=b.changes||{},keys=["full_name","email","phone","company_name","website","city","state","zip_code","service_areas","collector_type","certifications","years_experience","message","status","availability_status","internal_notes","capabilities","rate_card"],patch:any={};
for(const k of keys)if(Object.prototype.hasOwnProperty.call(v,k))patch[k]=v[k];
if(patch.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.email)))return J({error:"Invalid email"},400);
if(patch.status&&!["new","reviewing","approved","inactive","rejected"].includes(patch.status))return J({error:"Invalid status"},400);
if(!Object.keys(patch).length)return J({error:"No changes"},400);\nconst original=await db.from("collector_network_submissions").select("status,email").eq("id",id).maybeSingle();if(original.error)throw original.error;if(!original.data)return J({error:"Applicant not found"},404);if(original.data.status==="rejected")return J({error:"Denied application locked; use Restore"},423);if(patch.status==="rejected")return J({error:"Use Deny with a reason to preserve the denial record"},400);
if(patch.status==="approved"){const denied=await db.from("ic_application_denials").select("id").eq("email",String(original.data.email).toLowerCase()).is("restored_at",null).limit(1);if(denied.error)throw denied.error;if(denied.data?.length)return J({error:"Application denied; restore before approval"},423);patch.approved_at=new Date().toISOString();patch.approved_by=uid}
patch.updated_at=new Date().toISOString();
const q=await db.from("collector_network_submissions").update(patch).eq("id",id).select(fields).single();if(q.error)throw q.error;return J({contractor:q.data});}
if(action==="create"){
const v=b.contractor||{},name=String(v.full_name||"").trim(),email=String(v.email||"").trim().toLowerCase();if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return J({error:"Name and email required"},400);
const block=await db.from("ic_application_denials").select("id").eq("email",email).is("restored_at",null).limit(1);if(block.error)throw block.error;if(block.data?.length)return J({error:"Application denied. Contact management for restoration."},403);\nconst found=await db.from("collector_network_submissions").select("id").ilike("email",email).limit(1);if(found.error)throw found.error;if(found.data?.length)return J({error:"Contractor email already exists"},409);
const row:any={full_name:name,email,status:"new",availability_status:"available",capabilities:{},rate_card:{}};
for(const k of ["company_name","phone","website","city","state","zip_code","collector_type","service_areas","certifications","years_experience","internal_notes"])if(v[k]!=null)row[k]=String(v[k]);
const q=await db.from("collector_network_submissions").insert(row).select(fields).single();if(q.error)throw q.error;return J({contractor:q.data});}
return J({error:"Invalid action"},400);
}catch(e){console.error("Independent contractor management",e);return J({error:e instanceof Error?e.message:"Server error"},500)}
});