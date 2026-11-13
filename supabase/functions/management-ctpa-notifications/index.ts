import {createClient} from "npm:@supabase/supabase-js@2";
const valid=x=>typeof x==="string"&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(x);
const cut=(x,n=180)=>String(x??"").trim().slice(0,n);
Deno.serve(async req=>{
 const h={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const reply=(v,s=200)=>new Response(JSON.stringify(v),{headers:h,status:s});
 if(req.method==="OPTIONS")return new Response(null,{headers:h,status:204});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!key)return reply({error:"Management notifications unavailable"},503);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const {data:{user},error}=await auth.auth.getUser(token);if(error||!user?.id||!user.email_confirmed_at)return reply({error:"Workforce staff sign in required"},401);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const [profile,roles,access]=await Promise.all([
  db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
  db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
  db.from("staff_business_access").select("access_level,assigned_customers_only,business_unit_code").eq("user_id",user.id).eq("active",true).in("business_unit_code",["workforce","dot"]).limit(30)
 ]);
 if(profile.error||roles.error||access.error)throw profile.error||roles.error||access.error;
 const permissions=(access.data||[]).filter(x=>!x.assigned_customers_only);
 if(profile.data?.employment_status!=="active"||!roles.data?.length||!permissions.length)return reply({error:"Authorized Workforce staff access required"},403);
 const write=permissions.some(x=>["admin","manager","editor"].includes(cut(x.access_level,30).toLowerCase()));
 const body=await req.json().catch(()=>({})),action=cut(body.action,30),tenant=body.tenant_id;
 if(action==="organizations"){
  const r=await db.from("workforce_unified_records").select("tenant_id,data").eq("kind","organization").is("archived_at",null).limit(1000);
  if(r.error)throw r.error;return reply({ok:true,can_write:write,organizations:(r.data||[]).map(x=>({id:x.tenant_id,name:cut(x.data?.name||x.data?.legal_name||"C/TPA",160)}))});
 }
 if(!valid(tenant))return reply({error:"Choose C/TPA organization"},400);
 const org=await db.from("workforce_unified_records").select("id").eq("tenant_id",tenant).eq("kind","organization").is("archived_at",null).maybeSingle();
 if(org.error)throw org.error;if(!org.data)return reply({error:"C/TPA organization not found"},404);
 const notices=db.from("workforce_ctpa_platform_notices");
 if(action==="list"){
  const [n,r]=await Promise.all([
   notices.select("id,tenant_id,operating_context,category,title,body,reply_enabled,status,published_at,created_at").eq("tenant_id",tenant).order("created_at",{ascending:false}).limit(300),
   db.from("workforce_ctpa_notice_support_replies").select("id,notice_id,subject,message,status,user_id,submitted_at").eq("tenant_id",tenant).order("submitted_at",{ascending:false}).limit(300)
  ]);
  if(n.error||r.error)throw n.error||r.error;
  return reply({ok:true,can_write:write,notices:n.data||[],replies:r.data||[]});
 }
 if(!write)return reply({error:"Management editing permissions required"},403);
 if(action==="create"){
  const title=cut(body.title,180),message=cut(body.body,8000),context=["dot","nondot","shared"].includes(body.operating_context)?body.operating_context:"shared",category=["general","billing","testing","compliance","account","service","urgent"].includes(body.category)?body.category:"general";
  if(!title||!message)return reply({error:"Title and full notification message are required"},400);
  const insert=await notices.insert({tenant_id:tenant,title,body:message,operating_context:context,category,reply_enabled:body.reply_enabled===true,status:"draft",created_by:user.id}).select("id").single();
  if(insert.error)throw insert.error;return reply({ok:true,id:insert.data.id});
 }
 if(!valid(body.id))return reply({error:"Choose a valid record"},400);
 if(action==="publish"){
  const q=await notices.update({status:"published",published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("tenant_id",tenant).eq("id",body.id).eq("status","draft").select("id").maybeSingle();
  if(q.error)throw q.error;if(!q.data)return reply({error:"Only draft notifications can be published"},409);
  return reply({ok:true});
 }
 if(action==="archive"){
  const q=await notices.update({status:"archived",updated_at:new Date().toISOString()}).eq("tenant_id",tenant).eq("id",body.id).eq("status","published").select("id").maybeSingle();
  if(q.error)throw q.error;if(!q.data)return reply({error:"Only published notifications can be archived"},409);
  return reply({ok:true});
 }
 if(action==="reply_status"){
  const status=["open","in_progress","resolved","closed"].includes(body.status)?body.status:"";
  if(!status)return reply({error:"Invalid support reply status"},400);
  const q=await db.from("workforce_ctpa_notice_support_replies").update({status,responded_at:status==="resolved"||status==="closed"?new Date().toISOString():null}).eq("tenant_id",tenant).eq("id",body.id).select("id").maybeSingle();
  if(q.error)throw q.error;if(!q.data)return reply({error:"Reply not found"},404);
  return reply({ok:true});
 }
 return reply({error:"Unknown management notification action"},400);
 }catch(e){console.error("[Management notifications]",e);return reply({error:"Unable to manage Workforce notifications"},500)}
});