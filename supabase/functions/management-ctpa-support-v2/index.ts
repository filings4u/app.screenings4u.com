import {createClient} from "npm:@supabase/supabase-js@2";
const id=x=>typeof x==="string"&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(x);
const cut=(x,n=8000)=>String(x??"").trim().slice(0,n);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
Deno.serve(async req=>{
const headers={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json","Cache-Control":"no-store"};
const respond=(data,s=200)=>new Response(JSON.stringify(data),{status:s,headers});
if(req.method==="OPTIONS")return new Response(null,{status:204,headers});if(req.method!=="POST")return respond({error:"POST required"},405);
try{
const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
const {data:{user},error}=await client.auth.getUser(token);
if(error||!user?.id||!user.email_confirmed_at)return respond({error:"Workforce staff sign-in required"},401);
const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const [profile,roles,access]=await Promise.all([
 db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
 db.from("staff_role_assignments").select("id,role_code").eq("user_id",user.id).eq("active",true).limit(20),
 db.from("staff_business_access").select("access_level,assigned_customers_only,business_unit_code").eq("user_id",user.id).eq("active",true).in("business_unit_code",["workforce","dot"]).limit(30)
]);
if(profile.error||roles.error||access.error)throw profile.error||roles.error||access.error;
if(profile.data?.employment_status!=="active"||!roles.data?.length||!access.data?.length)return respond({error:"Active Workforce staff authorization required"},403);
const body=await req.json().catch(()=>({})),action=cut(body.action,30);
const write=access.data.some(x=>["admin","manager","editor"].includes(cut(x.access_level,40).toLowerCase()));
const tickets=db.from("workforce_ctpa_support_tickets_v2"),messages=db.from("workforce_ctpa_support_messages_v2");
const ping=async()=>{
 const r=await db.from("workforce_admin_presence_v2").upsert({user_id:user.id,heartbeat_at:new Date().toISOString()},{onConflict:"user_id"});
 if(r.error)throw r.error;
};
if(action==="heartbeat"){await ping();return respond({ok:true,online:true})}
if(action==="offline"){
 const r=await db.from("workforce_admin_presence_v2").delete().eq("user_id",user.id);if(r.error)throw r.error;return respond({ok:true});
}
if(action==="organizations"){
 const r=await db.from("workforce_unified_records").select("tenant_id,data").eq("kind","organization").is("archived_at",null).limit(1000);
 if(r.error)throw r.error;return respond({ok:true,organizations:(r.data||[]).map(x=>({id:x.tenant_id,name:cut(x.data?.name||x.data?.legal_name||"C/TPA",180)})),can_write:write});
}
if(!id(body.tenant_id))return respond({error:"Choose C/TPA organization"},400);
const org=await db.from("workforce_unified_records").select("id").eq("kind","organization").eq("tenant_id",body.tenant_id).is("archived_at",null).maybeSingle();
if(org.error)throw org.error;if(!org.data)return respond({error:"Organization not found"},404);
if(action==="list"){
 await ping();
 const r=await tickets.select("id,subject,category,priority,status,operating_context,source_notice_id,created_at,last_message_at").eq("tenant_id",body.tenant_id).order("last_message_at",{ascending:false}).limit(250);
 if(r.error)throw r.error;return respond({ok:true,tickets:r.data||[],can_write:write});
}
if(!id(body.ticket_id))return respond({error:"Choose a valid ticket"},400);
const record=await tickets.select("id,tenant_id,subject,status").eq("tenant_id",body.tenant_id).eq("id",body.ticket_id).maybeSingle();
if(record.error)throw record.error;if(!record.data)return respond({error:"Ticket not found"},404);
if(action==="history"){
 await ping();
 const r=await messages.select("id,body,sender_id,sender_type,created_at").eq("ticket_id",record.data.id).order("created_at",{ascending:true}).limit(350);
 if(r.error)throw r.error;return respond({ok:true,ticket:record.data,messages:r.data||[]});
}
if(!write)return respond({error:"Staff support edit permission required"},403);
if(action==="status"){
 const status=["open","in_progress","waiting_for_customer","resolved","closed"].includes(body.status)?body.status:null;
 if(!status)return respond({error:"Invalid support ticket status"},400);
 const r=await tickets.update({status,updated_at:new Date().toISOString()}).eq("id",record.data.id).eq("tenant_id",body.tenant_id);if(r.error)throw r.error;return respond({ok:true});
}
if(action!=="send")return respond({error:"Unknown action"},400);
if(record.data.status==="closed")return respond({error:"Closed tickets cannot receive messages"},409);
const message=cut(body.message);if(!message)return respond({error:"Enter a response"},400);
const msg=await messages.insert({ticket_id:record.data.id,sender_id:user.id,sender_type:"staff",body:message}).select("id").single();
if(msg.error)throw msg.error;
const r=await tickets.update({status:"waiting_for_customer",last_message_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",record.data.id);if(r.error)throw r.error;
const memberships=await db.from("workforce_unified_records").select("data").eq("tenant_id",body.tenant_id).eq("kind","membership").eq("data->>status","active").is("archived_at",null).limit(100);
if(memberships.error)throw memberships.error;
let delivered=0;
for(const member of memberships.data||[]){
 const targetId=member.data?.user_id;if(!id(targetId))continue;
 const u=await db.auth.admin.getUserById(targetId),to=cut(u.data?.user?.email,240).toLowerCase();
 if(!to||targetId===user.id)continue;
 const dedupe="support:"+msg.data.id+":ctpa:"+targetId;
 const tracked=await db.from("workforce_mail_delivery_v2").upsert({dedupe_key:dedupe,kind:"support",recipient:to,subject:record.data.subject,status:"pending"},{onConflict:"dedupe_key",ignoreDuplicates:true}).select("id").maybeSingle();
 if(tracked.error)throw tracked.error;if(!tracked.data)continue;
 const emailKey=Deno.env.get("RESEND_API_KEY"),from=Deno.env.get("WORKFORCE_EMAIL_FROM")||"Workforce <notifications@screenings4u.com>";
 if(!emailKey)continue;
 try{
  const result=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+emailKey,"Content-Type":"application/json","Idempotency-Key":dedupe},body:JSON.stringify({from,to:[to],subject:"Workforce Support Update: "+record.data.subject,html:'<div style="padding:22px;background:#01122F;color:white;font-size:22px;font-weight:bold">Workforce</div><div style="font-family:Arial,sans-serif;padding:24px"><h2>New response from Workforce</h2><p>Your support ticket has a new message.</p><p><a href="https://ctpa.screenings4u.com/unified.html?page=support">View Support</a></p></div>'})});
  const json=await result.json().catch(()=>({}));
  await db.from("workforce_mail_delivery_v2").update({status:result.ok?"sent":"failed",attempt_count:1,provider_message_id:json.id||null,last_error:result.ok?null:cut(json.message||"Email rejected",300),updated_at:new Date().toISOString()}).eq("id",tracked.data.id);
  if(result.ok)delivered++;
 }catch(e){console.error("Workforce support response email",e)}
}
return respond({ok:true,emails_sent:delivered});
}catch(e){console.error("Management CTPA support",e);return respond({error:"Unable to manage support tickets"},500)}
});