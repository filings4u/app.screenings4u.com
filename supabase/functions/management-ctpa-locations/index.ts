import {createClient} from "npm:@supabase/supabase-js@2";
const id=x=>typeof x==="string"&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(x);
Deno.serve(async req=>{
 const h={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json","Cache-Control":"no-store"};
 const reply=(v,s=200)=>new Response(JSON.stringify(v),{headers:h,status:s});
 if(req.method==="OPTIONS")return new Response(null,{headers:h,status:204});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!key)return reply({error:"Workforce locations unavailable"},503);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const {data:{user},error}=await auth.auth.getUser(token);if(error||!user?.id||!user.email_confirmed_at)return reply({error:"Sign-in required"},401);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const [profile,roles,access]=await Promise.all([
 db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
 db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
 db.from("staff_business_access").select("access_level,assigned_customers_only").eq("user_id",user.id).eq("active",true).limit(30)
 ]);
 if(profile.error||roles.error||access.error)throw profile.error||roles.error||access.error;
 if(profile.data?.employment_status!=="active"||!roles.data?.length||!(access.data||[]).some(x=>!x.assigned_customers_only))return reply({error:"Authorized Workforce staff access required"},403);
 const body=await req.json().catch(()=>({})),action=body.action;
 if(action==="organizations"){
  const r=await db.from("workforce_unified_records").select("tenant_id,data").eq("kind","organization").is("archived_at",null).limit(1000);if(r.error)throw r.error;
  return reply({ok:true,organizations:(r.data||[]).map(x=>({id:x.tenant_id,name:String(x.data?.name||"C/TPA").slice(0,160)}))});
 }
 if(action!=="list"||!id(body.tenant_id))return reply({error:"Choose an organization"},400);
 const org=await db.from("workforce_unified_records").select("id").eq("kind","organization").eq("tenant_id",body.tenant_id).is("archived_at",null).maybeSingle();
 if(org.error)throw org.error;if(!org.data)return reply({error:"Organization not found"},404);
 const locations=await db.from("workforce_ctpa_business_locations").select("id,name,business_name,address_line1,address_line2,city,state,postal_code,country,phone,email,location_type,is_primary,status,updated_at").eq("tenant_id",body.tenant_id).order("is_primary",{ascending:false}).order("name").limit(500);
 if(locations.error)throw locations.error;
 return reply({ok:true,locations:locations.data||[],read_only:true});
 }catch(e){console.error("[Workforce locations admin]",e);return reply({error:"Unable to retrieve C/TPA locations"},500)}
});