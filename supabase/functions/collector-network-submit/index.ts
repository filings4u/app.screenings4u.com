import { createClient } from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,apikey,authorization,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clean=(v:any)=>String(v??"").trim();
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return J({error:"Method not allowed."},405);try{
 const b=await req.json().catch(()=>({}));if(clean(b.website_trap))return J({error:"Unable to submit application."},400);if(!clean(b.full_name)||!clean(b.email))return J({error:"Name and email are required."},400);
 const secret=Deno.env.get("TURNSTILE_SECRET_KEY")||Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET")||"";if(secret&&b.turnstileToken){const fd=new FormData();fd.append("secret",secret);fd.append("response",clean(b.turnstileToken));const vr=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:fd});const x=await vr.json().catch(()=>({}));if(!x.success)return J({error:"Security verification failed."},400);}
 const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
 const email=clean(b.email).toLowerCase(),now=new Date().toISOString();
 const denial=await db.from("ic_application_denials").select("id").eq("email",email).is("restored_at",null).limit(1);if(denial.error)throw denial.error;if(denial.data?.length)return J({error:"Application is not eligible for resubmission. Contact management to request restoration."},403);
 const latest=await db.from("collector_network_submissions").select("*").ilike("email",email).neq("status","superseded").order("created_at",{ascending:false}).limit(1);if(latest.error)throw latest.error;
 const previous=latest.data?.[0];
 if(previous?.status==="approved")return J({success:true,message:"Your collector profile is already approved. Contact screenings4u management to make changes."});
 if(previous?.status==="rejected"||previous?.status==="declined")return J({error:"This application is not eligible for resubmission until restored."},403);
 const fields:any={full_name:clean(b.full_name),email,phone:clean(b.phone)||null,company_name:clean(b.company_name)||null,website:clean(b.website)||null,city:clean(b.city)||null,state:clean(b.state).toUpperCase()||null,zip_code:clean(b.zip_code)||null,service_areas:clean(b.service_areas)||null,collector_type:clean(b.collector_type)||null,certifications:clean(b.certifications)||null,years_experience:clean(b.years_experience)||null,message:clean(b.message)||null,updated_at:now};
 let id:string;
 if(previous){const history=await db.from("ic_application_submission_history").insert({application_id:previous.id,email,previous_data:previous,submitted_data:fields});if(history.error)throw history.error;
 const updated=await db.from("collector_network_submissions").update({...fields,status:"new"}).eq("id",previous.id).in("status",["new","reviewing","contacted","inactive"]).select("id").single();if(updated.error)throw updated.error;id=updated.data.id;
 }else{const q=await db.from("collector_network_submissions").insert({id:crypto.randomUUID(),...fields,status:"new",availability_status:"available",capabilities:{},rate_card:{},created_at:now}).select("id").single();if(q.error)throw q.error;id=q.data.id;}
 return J({success:true,id,message:"Thank you for your interest in the screenings4u Collector Network. Your information has been received."});
}catch(e){console.error("collector-network-submit",e);return J({error:e instanceof Error?e.message:String(e)},500)}});