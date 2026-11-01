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
const fields="id,full_name,email,phone,company_name,website,city,state,zip_code,service_areas,collector_type,certifications,years_experience,message,status,availability_status,capabilities,rate_card,internal_notes,last_contacted_at,approved_at,created_at,updated_at,application_details";
if(action==="list"){const q=await db.from("collector_network_submissions").select(fields).order("created_at",{ascending:false}).limit(1000);if(q.error)throw q.error;return J({contractors:q.data||[]});}
if(action==="denied_list"){
 const denied=await db.from("collector_network_submissions").select(fields).eq("status","rejected").order("updated_at",{ascending:false}).limit(1000);if(denied.error)throw denied.error;
 const entries=await db.from("ic_application_denials").select("applicant_id,email,denial_reason,denied_at,restored_at").order("denied_at",{ascending:false}).limit(5000);if(entries.error)throw entries.error;
 return J({contractors:(denied.data||[]).map((r:any)=>{const matches=(entries.data||[]).filter((d:any)=>d.applicant_id===r.id||String(d.email).toLowerCase()===String(r.email).toLowerCase());return {...r,denial:matches.find((d:any)=>!d.restored_at)||matches[0]||null,denial_count:matches.length}})});
}
if(action==="detail"){const q=await db.from("collector_network_submissions").select(fields).eq("id",String(b.id||"")).maybeSingle();if(q.error)throw q.error;
if(patch.status==="approved"){
 const applicantEmail=String(q.data.email||"").toLowerCase();
 const submitted=await db.from("ic_agreement_submissions").select("id,user_id").eq("email",applicantEmail).order("created_at",{ascending:false}).limit(1);
 if(submitted.error)throw submitted.error;
 let account=submitted.data?.[0]?.user_id;
 if(!account){const page=await db.auth.admin.listUsers({page:1,perPage:1000});if(page.error)throw page.error;const known=page.data.users.find((x:any)=>x.email?.toLowerCase()===applicantEmail);if(known)account=known.id;
 else {const created=await db.auth.admin.createUser({email:applicantEmail,email_confirm:false,user_metadata:{full_name:q.data.full_name,account_type:"independent_contractor"}});if(created.error)throw created.error;account=created.data.user?.id;}}
 if(account){
  const grant=await db.from("ic_portal_access").upsert({user_id:account,enabled:true,source:"approved_application"},{onConflict:"user_id"});if(grant.error)throw grant.error;
  const invitation=await db.auth.admin.generateLink({type:"magiclink",email:applicantEmail,options:{redirectTo:"https://independent-contractor.screenings4u.com/dashboard.html"}});
  if(invitation.error)throw invitation.error;
  const link=invitation.data?.properties?.action_link||"";
  const key=Deno.env.get("RESEND_API_KEY")||"";
  if(key&&link){const safe=(v:any)=>String(v??"").replace(/[&<>"]/g,(ch:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[ch]!));
   const mail=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("RESEND_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[applicantEmail],subject:"screenings4u IC Network — Application Approved",html:'<div style="font:15px Arial;background:#f3f6fa;padding:24px"><div style="max-width:580px;background:white;margin:auto;padding:25px;border-top:5px solid #ff7100"><img alt="screenings4u" width="180" src="https://independent-contractor.screenings4u.com/images/logo.png"><h2>Your Independent Contractor application is approved</h2><p>Your portal is now ready. Use the secure invitation below to activate your access.</p><a style="display:inline-block;padding:13px 18px;background:#24548c;color:white;text-decoration:none;border-radius:8px" href="'+safe(link)+'">Activate IC Portal</a></div></div>'})});if(!mail.ok)console.error("Approval invitation delivery",mail.status)}
 }
}
return J({contractor:q.data});}
if(action==="revoke_approved"){
 const id=String(b.id||""),reason=String(b.reason||"").trim();
 if(!/^[a-f0-9-]{36}$/i.test(id)||reason.length<3)return J({error:"A reason of at least 3 characters is required"},400);
 const applicant=await db.from("collector_network_submissions").select("id,email,status").eq("id",id).maybeSingle();
 if(applicant.error)throw applicant.error;
 if(!applicant.data||applicant.data.status!=="approved")return J({error:"Only an approved contractor can be revoked here"},409);
 const email=String(applicant.data.email||"").trim().toLowerCase();
 if(!email)return J({error:"Missing contractor email"},400);
 const active=await db.from("ic_application_denials").select("id").eq("email",email).is("restored_at",null).limit(1);
 if(active.error)throw active.error;if(active.data?.length)return J({error:"Active denial already exists"},409);
 const users=await db.from("ic_agreement_submissions").select("user_id").ilike("email",email).limit(100);if(users.error)throw users.error;
 const authUsers=await db.auth.admin.listUsers({page:1,perPage:1000});if(authUsers.error)throw authUsers.error;
 const known=authUsers.data.users.find((u:any)=>u.email?.trim().toLowerCase()===email);
 const ids=[...new Set([...(users.data||[]).map((x:any)=>x.user_id),known?.id].filter(Boolean))];
 const now=new Date().toISOString();
 const log=await db.from("ic_application_denials").insert({email,applicant_id:id,denial_reason:reason,denied_by:uid,denied_at:now});if(log.error)throw log.error;
 const revoked=await db.from("collector_network_submissions").update({status:"rejected",internal_notes:reason,availability_status:"inactive",updated_at:now}).eq("id",id).eq("status","approved").select("id").maybeSingle();if(revoked.error)throw revoked.error;
 if(!revoked.data)return J({error:"Applicant state changed; contact admin to review recorded denial"},409);
 for(const userId of ids){const disabled=await db.from("ic_portal_access").update({enabled:false}).eq("user_id",userId);if(disabled.error)throw disabled.error;}
 return J({ok:true,status:"rejected",revoked_user_count:ids.length});
}
if(action==="deny"){
 const id=String(b.id||""),reason=String(b.reason||"").trim();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!reason)return J({error:"A denial reason is required"},400);
 const existing=await db.from("collector_network_submissions").select("id,email,status").eq("id",id).maybeSingle();if(existing.error)throw existing.error;if(!existing.data)return J({error:"Application not found"},404);
 if(existing.data.status==="approved")return J({error:"Approved collectors must be deactivated separately"},409);
 if(existing.data.status==="rejected")return J({error:"Application is already denied. Use Restore."},409);
 const now=new Date().toISOString();
 const linked=await db.from("ic_agreement_submissions").select("user_id").eq("email",String(existing.data.email).toLowerCase()).limit(10);if(linked.error)throw linked.error;
 for(const record of linked.data||[]){if(record.user_id){const revoked=await db.from("ic_portal_access").update({enabled:false}).eq("user_id",record.user_id);if(revoked.error)throw revoked.error;}}
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
if(action==="change_approved_email"){
 const id=String(b.id||""),email=String(b.email||"").trim().toLowerCase();
 if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return J({error:"Valid contractor and email required"},400);
 if(email.endsWith("@screenings4u.com"))return J({error:"Internal staff emails cannot be IC accounts"},403);
 const existing=await db.from("collector_network_submissions").select("id,email,full_name,status").eq("id",id).single();if(existing.error)throw existing.error;
 if(existing.data.status!=="approved")return J({error:"Only approved IC email changes can use this action"},409);
 const oldEmail=String(existing.data.email||"").toLowerCase();
 if(oldEmail===email)return J({error:"Email is unchanged"},400);
 const duplicates=await db.from("collector_network_submissions").select("id").ilike("email",email).neq("id",id).neq("status","superseded").limit(1);if(duplicates.error)throw duplicates.error;if(duplicates.data?.length)return J({error:"This email belongs to another contractor"},409);
 const denied=await db.from("ic_application_denials").select("id").eq("email",email).is("restored_at",null).limit(1);if(denied.error)throw denied.error;if(denied.data?.length)return J({error:"New email is blocked by a prior denial"},403);
 const users=await db.auth.admin.listUsers({page:1,perPage:1000});if(users.error)throw users.error;
 const oldAccount=users.data.users.find((u:any)=>u.email?.trim().toLowerCase()===oldEmail);
 const other=users.data.users.find((u:any)=>u.email?.trim().toLowerCase()===email);
 if(other&&other.id!==oldAccount?.id)return J({error:"That address already has an account. Contact management to verify ownership."},409);
 if(!oldAccount)return J({error:"No linked portal account found. Use the approval invitation process instead."},409);
 const staff=await db.from("staff_profiles").select("user_id").eq("user_id",oldAccount.id).maybeSingle();if(staff.error)throw staff.error;if(staff.data)return J({error:"This is a staff account and cannot be converted to an IC. Revoke the IC profile."},403);
 const updated=await db.auth.admin.updateUserById(oldAccount.id,{email,email_confirm:false});if(updated.error)throw updated.error;
 const profile=await db.from("collector_network_submissions").update({email,updated_at:new Date().toISOString()}).eq("id",id).eq("email",existing.data.email).select(fields).maybeSingle();
 if(profile.error||!profile.data){await db.auth.admin.updateUserById(oldAccount.id,{email:oldEmail});return J({error:"Unable to synchronize contractor record; account email rollback attempted"},409)}
 const invitation=await db.auth.admin.generateLink({type:"magiclink",email,options:{redirectTo:"https://independent-contractor.screenings4u.com/dashboard.html"}});
 if(invitation.error)return J({contractor:profile.data,invitation_status:"failed",error:"Email updated but invitation could not be generated. Contact support."},502);
 const link=invitation.data?.properties?.action_link||"",key=Deno.env.get("RESEND_API_KEY");let delivery="not_configured";
 if(key&&link){try{const x=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("RESEND_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[email],subject:"screenings4u — Updated IC Portal Email",html:'<div style="font-family:Arial;background:#f3f6fa;padding:25px"><div style="background:white;padding:26px;max-width:580px;margin:auto;border-top:5px solid #ff7100"><h2>Update your IC portal sign-in</h2><p>Your screenings4u contractor account email has been updated.</p><a style="background:#24548c;color:white;padding:13px 18px;display:inline-block;border-radius:8px" href="'+link+'">Activate Updated Email</a></div></div>'})});delivery=x.ok?"sent":"failed"}catch{delivery="failed"}}
 return J({contractor:profile.data,invitation_status:delivery});
}
if(action==="update"){
const id=String(b.id||"");if(!/^[a-f0-9-]{36}$/i.test(id))return J({error:"Invalid contractor"},400);
const v=b.changes||{},keys=["full_name","email","phone","company_name","website","city","state","zip_code","service_areas","collector_type","certifications","years_experience","message","status","availability_status","internal_notes","capabilities","rate_card","application_details"],patch:any={};
for(const k of keys)if(Object.prototype.hasOwnProperty.call(v,k))patch[k]=v[k];
if(patch.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(patch.email)))return J({error:"Invalid email"},400);
if(patch.email&&String(patch.email).trim().toLowerCase().endsWith("@screenings4u.com"))return J({error:"screenings4u.com staff email addresses cannot be Independent Contractors"},403);
if(patch.status&&!["new","reviewing","approved","inactive","rejected"].includes(patch.status))return J({error:"Invalid status"},400);
if(patch.application_details&&(typeof patch.application_details!=="object"||Array.isArray(patch.application_details)||JSON.stringify(patch.application_details).length>30000))return J({error:"Invalid application details"},400);
if(!Object.keys(patch).length)return J({error:"No changes"},400);
const original=await db.from("collector_network_submissions").select("status,email").eq("id",id).maybeSingle();if(original.error)throw original.error;if(!original.data)return J({error:"Applicant not found"},404);if(String(patch.email||original.data.email).trim().toLowerCase().endsWith("@screenings4u.com"))return J({error:"screenings4u.com addresses cannot hold IC contractor status. Revoke this profile from the IC Directory."},403);if(original.data.status==="rejected")return J({error:"Denied application locked; use Restore"},423);if(patch.status==="rejected")return J({error:"Use Deny with a reason to preserve the denial record"},400);
if(patch.status==="approved"){const denied=await db.from("ic_application_denials").select("id").eq("email",String(original.data.email).toLowerCase()).is("restored_at",null).limit(1);if(denied.error)throw denied.error;if(denied.data?.length)return J({error:"Application denied; restore before approval"},423);patch.approved_at=new Date().toISOString();patch.approved_by=uid}
patch.updated_at=new Date().toISOString();
const q=await db.from("collector_network_submissions").update(patch).eq("id",id).select(fields).single();if(q.error)throw q.error;return J({contractor:q.data});}
if(action==="create"){
const v=b.contractor||{},name=String(v.full_name||"").trim(),email=String(v.email||"").trim().toLowerCase();if(!name||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return J({error:"Name and email required"},400);
const block=await db.from("ic_application_denials").select("id").eq("email",email).is("restored_at",null).limit(1);if(block.error)throw block.error;if(block.data?.length)return J({error:"Application denied. Contact management for restoration."},403);
if(email.endsWith("@screenings4u.com"))return J({error:"Internal screenings4u.com addresses are not eligible for contractor applications"},403);
const found=await db.from("collector_network_submissions").select("id").ilike("email",email).limit(1);if(found.error)throw found.error;if(found.data?.length)return J({error:"Contractor email already exists"},409);
const row:any={full_name:name,email,status:"new",availability_status:"available",capabilities:{},rate_card:{}};
for(const k of ["company_name","phone","website","city","state","zip_code","collector_type","service_areas","certifications","years_experience","internal_notes"])if(v[k]!=null)row[k]=String(v[k]);
if(v.application_details&&typeof v.application_details==="object")row.application_details=v.application_details;
const q=await db.from("collector_network_submissions").insert(row).select(fields).single();if(q.error)throw q.error;return J({contractor:q.data});}
return J({error:"Invalid action"},400);
}catch(e){console.error("Independent contractor management",e);return J({error:e instanceof Error?e.message:"Server error"},500)}
});