import {createClient} from "npm:@supabase/supabase-js@2";
const uuid=(v:unknown)=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const str=(v:unknown,n=160)=>String(v??"").trim().slice(0,n);
const rateValue=(v:unknown)=>v==null||v===""?null:Number(v);
Deno.serve(async req=>{
 const headers={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{headers,status});
 if(req.method==="OPTIONS")return new Response(null,{headers,status:204});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  if(!url||!anon||!secret)return reply({error:"Service rates not configured"},503);
  const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await auth.auth.getUser(token);
  if(authError||!user?.id||!user.email_confirmed_at)return reply({error:"Sign-in required"},401);
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const [profile,roles,access]=await Promise.all([
   db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
   db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
   db.from("staff_business_access").select("access_level,assigned_customers_only").eq("user_id",user.id).eq("business_unit_code","testing").eq("active",true).maybeSingle()
  ]);
  if(profile.error||roles.error||access.error)throw profile.error||roles.error||access.error;
  if(profile.data?.employment_status!=="active"||!roles.data?.length||!access.data||access.data.assigned_customers_only)return reply({error:"Workforce pricing management access denied"},403);
  const canManage=["admin","manager","editor"].includes(str(access.data.access_level,40).toLowerCase());
  const body=await req.json().catch(()=>({}));
  const action=str(body.action,36);
  if(action==="organizations"){
   const results=await db.from("workforce_unified_records").select("tenant_id,data").eq("kind","organization").is("archived_at",null).limit(1000);
   if(results.error)throw results.error;
   return reply({ok:true,organizations:(results.data||[]).map((o:any)=>({id:o.tenant_id,name:str(o.data?.name||"C/TPA")}))});
  }
  if(action==="list"){
   const tenant=body.tenant_id,context=body.operating_context==="nondot"?"nondot":"dot";
   const catalog=db.from("workforce_ctpa_provider_services").select("*").in("operating_context",[context,"both"]).order("category").order("name").limit(1000);
   if(tenant&&!uuid(tenant))return reply({error:"Invalid C/TPA"},400);
   const [services,overrides]=await Promise.all([catalog,tenant?db.from("workforce_ctpa_provider_rates").select("service_id,rate,status,notes,updated_at").eq("tenant_id",tenant).limit(1000):Promise.resolve({data:[],error:null})]);
   if(services.error||overrides.error)throw services.error||overrides.error;
   const custom=new Map((overrides.data||[]).map((r:any)=>[r.service_id,r]));
   return reply({ok:true,services:(services.data||[]).map((s:any)=>({...s,override:custom.get(s.id)||null})),can_manage:canManage});
  }
  if(!canManage)return reply({error:"You do not have permission to modify provider compensation"},403);
  if(action==="create_service"||action==="update_service"){
   const name=str(body.name,160),code=str(body.service_code,80).toLowerCase(),category=str(body.category,100),description=str(body.description,900),unit=str(body.unit,80)||"per service",context=str(body.operating_context,12),status=str(body.status,20);
   const amount=rateValue(body.default_rate);
   if(!name||!category||!/^[a-z][a-z0-9-]{2,79}$/.test(code)||!["dot","nondot","both"].includes(context)||!["draft","published","inactive"].includes(status))return reply({error:"Valid name, code, category, context and status required"},400);
   if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>100000||Math.round(amount*100)!==amount*100))return reply({error:"Invalid default rate"},400);
   if(status==="published"&&amount===null)return reply({error:"Enter an approved default rate before publishing"},400);
   const values={name,service_code:code,category,description,unit,operating_context:context,status,default_rate:amount,updated_by:user.id,updated_at:new Date().toISOString()};
   if(action==="create_service"){
    const out=await db.from("workforce_ctpa_provider_services").insert({...values,created_by:user.id}).select("id").single();
    if(out.error){if(out.error.code==="23505")return reply({error:"Service code already exists"},409);throw out.error}
    return reply({ok:true,id:out.data.id});
   }
   if(!uuid(body.id))return reply({error:"Select service"},400);
   const out=await db.from("workforce_ctpa_provider_services").update(values).eq("id",body.id).select("id").maybeSingle();
   if(out.error)throw out.error;
   if(!out.data)return reply({error:"Service not found"},404);
   return reply({ok:true,id:out.data.id});
  }
  if(action==="set_rate"){
   if(!uuid(body.tenant_id)||!uuid(body.service_id))return reply({error:"Choose a C/TPA and service"},400);
   const tenant=await db.from("workforce_unified_records").select("id").eq("kind","organization").eq("tenant_id",body.tenant_id).is("archived_at",null).maybeSingle();
   if(tenant.error)throw tenant.error;
   if(!tenant.data)return reply({error:"C/TPA organization not found"},404);
   const service=await db.from("workforce_ctpa_provider_services").select("id").eq("id",body.service_id).maybeSingle();
   if(service.error)throw service.error;
   if(!service.data)return reply({error:"Service not found"},404);
   const status=str(body.status,20),amount=rateValue(body.rate);
   if(!["inherit","published","hidden"].includes(status))return reply({error:"Invalid rate status"},400);
   if(status==="published"&&(amount===null||!Number.isFinite(amount)||amount<0||amount>100000||Math.round(amount*100)!==amount*100))return reply({error:"Valid contracted rate required"},400);
   const out=await db.from("workforce_ctpa_provider_rates").upsert({tenant_id:body.tenant_id,service_id:body.service_id,rate:status==="published"?amount:null,status,notes:str(body.notes,500),updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"tenant_id,service_id"}).select("id").single();
   if(out.error)throw out.error;
   return reply({ok:true,id:out.data.id});
  }
  return reply({error:"Unknown pricing action"},400);
 }catch(error){console.error("management-ctpa-provider-rates",error);return reply({error:"Unable to manage C/TPA compensation rates"},500)}
});