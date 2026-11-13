import {createClient} from "npm:@supabase/supabase-js@2";
const uuid=x=>typeof x==="string"&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(x);
const clean=(x,n=250)=>String(x??"").trim().slice(0,n);
const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x+"T12:00:00Z"));
const time=x=>typeof x==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(x);
Deno.serve(async req=>{
 const h={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const send=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:h});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h});if(req.method!=="POST")return send({error:"POST only"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")||"",pub=Deno.env.get("SUPABASE_ANON_KEY")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!pub||!secret)return send({error:"Scheduling service unavailable"},503);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await auth.auth.getUser(token);
 if(error||!user?.id||!user.email_confirmed_at)return send({error:"Workforce staff login required"},401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const [profile,roles,access]=await Promise.all([
 db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
 db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
 db.from("staff_business_access").select("access_level,assigned_customers_only").eq("user_id",user.id).eq("active",true).in("business_unit_code",["dot","workforce"]).limit(30)
 ]);
 if(profile.error||roles.error||access.error)throw profile.error||roles.error||access.error;
 if(profile.data?.employment_status!=="active"||!roles.data?.length||!access.data?.some(x=>!x.assigned_customers_only))return send({error:"Authorized Workforce staff required"},403);
 const edit=access.data.some(x=>!x.assigned_customers_only&&["admin","manager","editor"].includes(clean(x.access_level,30).toLowerCase()));
 const b=await req.json().catch(()=>({})),action=clean(b.action,30);
 if(action==="dashboard"){
  const [settings,blocks,requests]=await Promise.all([
   db.from("ctpa_demo_schedule_settings").select("*").eq("settings_key","global").maybeSingle(),
   db.from("ctpa_demo_availability_blocks").select("id,block_date,all_day,start_time,end_time,reason,active").eq("active",true).order("block_date",{ascending:true}).limit(400),
   db.from("ctpa_demo_requests").select("id,tenant_id,requested_date,requested_time,timezone,duration_minutes,status,demo_topic,company_name,contact_first_name,contact_last_name,contact_email,contact_phone,customer_notes,meeting_url,meeting_provider,created_at").order("created_at",{ascending:false}).limit(250)
  ]);
  if(settings.error||blocks.error||requests.error)throw settings.error||blocks.error||requests.error;
  return send({ok:true,can_edit:edit,settings:settings.data,blocks:blocks.data||[],requests:requests.data||[]});
 }
 if(!edit)return send({error:"Demo schedule editing permission required"},403);
 if(action==="settings"){
  const weekdays=Array.isArray(b.weekdays)?[...new Set(b.weekdays.map(Number))].filter(x=>Number.isInteger(x)&&x>=0&&x<=6).sort():[];
  const start=clean(b.start_time,5),end=clean(b.end_time,5),slot=Number(b.slot_minutes),duration=Number(b.duration_minutes);
  if(!weekdays.length||!time(start)||!time(end)||end<=start||!Number.isInteger(slot)||slot<15||slot>240||!Number.isInteger(duration)||duration<15||duration>240)return send({error:"Provide valid business days, opening hours, slot interval and duration"},400);
  if((Number(end.slice(0,2))*60+Number(end.slice(3)))-(Number(start.slice(0,2))*60+Number(start.slice(3)))<duration)return send({error:"The hours must accommodate a full demo session"},400);
  const u=await db.from("ctpa_demo_schedule_settings").update({weekdays,start_time:start,end_time:end,slot_minutes:slot,duration_minutes:duration,active:b.active===true,updated_by:user.id,updated_at:new Date().toISOString()}).eq("settings_key","global").select("id").maybeSingle();
  if(u.error)throw u.error;if(!u.data)return send({error:"Scheduling settings record not found"},404);return send({ok:true});
 }
 if(action==="block"){
  const d=clean(b.block_date,10),start=clean(b.start_time,5),end=clean(b.end_time,5),all=b.all_day===true;
  if(!day(d)||(!all&&(!time(start)||!time(end)||end<=start)))return send({error:"Choose a valid blocked date and time range"},400);
  const r=await db.from("ctpa_demo_availability_blocks").insert({block_date:d,all_day:all,start_time:all?null:start,end_time:all?null:end,reason:clean(b.reason,300),created_by:user.id,active:true}).select("id").single();
  if(r.error)throw r.error;return send({ok:true,id:r.data.id});
 }
 if(action==="unblock"){
  if(!uuid(b.id))return send({error:"Choose a blocked date"},400);
  const r=await db.from("ctpa_demo_availability_blocks").update({active:false,updated_at:new Date().toISOString()}).eq("id",b.id).eq("active",true).select("id").maybeSingle();
  if(r.error)throw r.error;if(!r.data)return send({error:"Blocked time not found"},404);return send({ok:true});
 }
 if(action==="request_status"){
  if(!uuid(b.id))return send({error:"Choose a demo request"},400);
  const status=clean(b.status,20);
  if(!["requested","confirmed","cancelled","completed"].includes(status))return send({error:"Invalid request status"},400);
  const existing=await db.from("ctpa_demo_requests").select("id,status").eq("id",b.id).maybeSingle();
  if(existing.error)throw existing.error;if(!existing.data)return send({error:"Demo request not found"},404);
  if(existing.data.status==="completed"||existing.data.status==="cancelled")return send({error:"Completed and cancelled requests cannot be reopened"},409);
  const meeting=clean(b.meeting_url,500);
  if(meeting&&(!/^https:\/\/[^ ]+$/i.test(meeting)))return send({error:"Meeting URL must use HTTPS"},400);
  const update={status,updated_at:new Date().toISOString(),...(meeting?{meeting_url:meeting,meeting_provider:"Workforce meeting"}:{}),...(status==="confirmed"?{confirmed_at:new Date().toISOString()}:{}) ,...(status==="cancelled"?{cancelled_at:new Date().toISOString()}:{})};
  const r=await db.from("ctpa_demo_requests").update(update).eq("id",b.id).select("id").single();
  if(r.error)throw r.error;return send({ok:true});
 }
 return send({error:"Unknown demo management operation"},400);
 }catch(e){console.error("[Workforce demo management]",e);return send({error:"Unable to manage demo schedule"},500)}
});