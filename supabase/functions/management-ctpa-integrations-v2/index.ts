import {createClient} from "npm:@supabase/supabase-js@2";
const uuid=x=>typeof x==="string"&&/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(x);
const clean=(x,n=2000)=>String(x??"").trim().slice(0,n);
Deno.serve(async req=>{
 const headers={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json","Cache-Control":"no-store"};
 const send=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return send({error:"POST required"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!service)return send({error:"Integration management unavailable"},503);
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,""),auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error:authError}=await auth.auth.getUser(token);
 if(authError||!user?.id||!user.email_confirmed_at)return send({error:"Staff login required"},401);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const [profile,roles,access]=await Promise.all([
 db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
 db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
 db.from("staff_business_access").select("access_level,assigned_customers_only").eq("user_id",user.id).eq("active",true).in("business_unit_code",["dot","workforce"]).limit(20)
 ]);
 if(profile.error||roles.error||access.error)throw profile.error||roles.error||access.error;
 if(profile.data?.employment_status!=="active"||!roles.data?.length||!access.data?.some(x=>!x.assigned_customers_only))return send({error:"Authorized Workforce staff required"},403);
 const canEdit=access.data.some(x=>!x.assigned_customers_only&&["admin","manager","editor"].includes(clean(x.access_level,25).toLowerCase()));
 const b=await req.json().catch(()=>({})),action=clean(b.action,30);
 if(action==="list"){
  const [requests,catalog,orgs]=await Promise.all([
   db.from("workforce_ctpa_integration_requests_v2").select("id,tenant_id,catalog_id,status,request_notes,admin_notes,reviewed_at,connected_at,created_at,updated_at").order("created_at",{ascending:false}).limit(350),
   db.from("integration_catalog").select("id,name,provider,category,code").limit(150),
   db.from("workforce_unified_records").select("tenant_id,data").eq("kind","organization").is("archived_at",null).limit(500)
  ]);
  if(requests.error||catalog.error||orgs.error)throw requests.error||catalog.error||orgs.error;
  return send({ok:true,requests:requests.data||[],catalog:catalog.data||[],organizations:(orgs.data||[]).map(x=>({id:x.tenant_id,name:clean(x.data?.name||x.data?.legal_name||"C/TPA",180)})),can_edit:canEdit});
 }
 if(!canEdit)return send({error:"Management approval permission required"},403);
 if(!uuid(b.id))return send({error:"Choose a request"},400);
 const record=await db.from("workforce_ctpa_integration_requests_v2").select("*").eq("id",b.id).maybeSingle();
 if(record.error)throw record.error;if(!record.data)return send({error:"Integration request not found"},404);
 const prior=record.data.status,notes=clean(b.notes,2000);
 if(action==="update"){
  const next=clean(b.status,32),allowed={
   requested:["under_review","rejected"],under_review:["approved","rejected"],
   approved:["configuration","rejected"],configuration:["connected","rejected"],
   connected:["disabled"],rejected:[],disabled:[]
  };
  if(!allowed[prior]?.includes(next))return send({error:"Invalid approval workflow transition"},409);
  const payload={status:next,admin_notes:notes,updated_at:new Date().toISOString()};
  if(next==="approved"){payload.reviewed_by=user.id;payload.reviewed_at=new Date().toISOString()}
  if(next==="connected"){
   const verified=await db.from("ctpa_integration_connections").select("id,status,last_test_status,last_tested_at,connected_at").eq("tenant_id",record.data.tenant_id).eq("integration_id",record.data.catalog_id).eq("status","connected").order("connected_at",{ascending:false}).limit(1);
   if(verified.error)throw verified.error;
   const connection=verified.data?.[0];
   if(!connection||!["success","passed","ok"].includes(clean(connection.last_test_status,30).toLowerCase())||!connection.last_tested_at)
    return send({error:"Workforce must configure and successfully test the provider connection before marking it connected."},409);
   payload.configured_by=user.id;payload.connected_at=new Date().toISOString();
  }
  const result=await db.from("workforce_ctpa_integration_requests_v2").update(payload).eq("id",record.data.id).eq("status",prior).select("id").maybeSingle();
  if(result.error)throw result.error;if(!result.data)return send({error:"Request changed. Refresh before updating."},409);
  const log=await db.from("workforce_ctpa_integration_activity_v2").insert({request_id:record.data.id,actor_id:user.id,previous_status:prior,next_status:next,note:notes});
  if(log.error)console.error("Integration audit log",log.error);
  return send({ok:true,status:next});
 }
 return send({error:"Unknown management action"},400);
 }catch(e){console.error("[Workforce integration approvals]",e);return send({error:"Unable to update integration"},500)}
});