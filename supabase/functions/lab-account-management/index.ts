import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const send=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
const val=(x:any)=>String(x??"").trim();
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return send({error:"POST required"},405);
 try{
  const base=Deno.env.get("SUPABASE_URL")||"",pub=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  const auth=createClient(base,pub,{auth:{persistSession:false}}),db=createClient(base,svc,{auth:{persistSession:false}});
  const {data:ud,error:ue}=await auth.auth.getUser(token);if(ue||!ud.user)return send({error:"Authentication required"},401);
  const user=ud.user;
  const [staff,roles,access]=await Promise.all([
   db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
   db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
   db.from("staff_business_access").select("id").eq("user_id",user.id).eq("business_unit_code","testing").eq("active",true).limit(1)
  ]);
  if(staff.error||roles.error||access.error)throw staff.error||roles.error||access.error;
  if(staff.data?.employment_status!=="active"||!roles.data?.length||!access.data?.length)return send({error:"Testing management staff access required"},403);
  const body=await req.json().catch(()=>({})),action=val(body.action||"list");
  if(action==="list"){
   const [ct,ac,org]=await Promise.all([
    db.from("ctpas").select("id,tenant_id,organization_id,status").order("created_at",{ascending:false}).limit(2000),
    db.from("ctpa_portal_lab_accounts").select("id,ctpa_id,tenant_id,organization_id,company_code,lab_name,laboratory_name,account_code,is_primary,status,notes,created_at,updated_at").order("created_at",{ascending:false}).limit(2000),
    db.from("organizations").select("id,legal_name,dba_name").limit(3000)
   ]);
   if(ct.error||ac.error||org.error)throw ct.error||ac.error||org.error;
   return send({ctpas:ct.data||[],accounts:ac.data||[],organizations:org.data||[]});
  }
  if(action==="save"){
   const ctpaId=val(body.ctpa_id),lab=val(body.lab_name),number=val(body.account_code),notes=val(body.notes),id=val(body.id);
   if(!/^[0-9a-f-]{36}$/i.test(ctpaId)||!lab||!number||lab.length>180||number.length>120||notes.length>2000)return send({error:"Select a C/TPA and enter a valid laboratory and account number"},400);
   const c=await db.from("ctpas").select("id,tenant_id,organization_id").eq("id",ctpaId).maybeSingle();
   if(c.error)throw c.error;if(!c.data)return send({error:"C/TPA not found"},404);
   const row:any={ctpa_id:ctpaId,tenant_id:c.data.tenant_id,organization_id:c.data.organization_id,lab_name:lab,laboratory_name:lab,account_code:number,is_primary:body.is_primary===true,status:val(body.status)==="inactive"?"inactive":"active",notes,updated_at:new Date().toISOString()};
   if(id){const ex=await db.from("ctpa_lab_accounts").select("id,ctpa_id,config").eq("id",id).maybeSingle();if(ex.error)throw ex.error;if(!ex.data||ex.data.ctpa_id!==ctpaId)return send({error:"Account assignment not found for selected C/TPA"},404);const config=ex.data.config&&typeof ex.data.config==="object"?ex.data.config:{};row.config={...config,account_numbers:{...(config.account_numbers||{}),dot:number}};}else{row.config={account_numbers:{dot:number}};}
   if(row.is_primary){const other=await db.from("ctpa_lab_accounts").update({is_primary:false,updated_at:new Date().toISOString()}).eq("ctpa_id",ctpaId);if(other.error)throw other.error}
   const q=id?await db.from("ctpa_lab_accounts").update(row).eq("id",id).select("id").single():await db.from("ctpa_lab_accounts").insert({id:crypto.randomUUID(),...row,created_at:new Date().toISOString()}).select("id").single();
   if(q.error)throw q.error;
   return send({ok:true,id:q.data.id});
  }
  return send({error:"Unsupported action"},400);
 }catch(e){console.error("lab-account-management",e);return send({error:"Lab account request could not be completed"},500)}
});