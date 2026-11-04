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

  const ctpaLookup=async(ctpaId:string)=>{
    if(!/^[0-9a-f-]{36}$/i.test(ctpaId))return null;
    const result=await db.from("ctpas").select("id,tenant_id,organization_id").eq("id",ctpaId).maybeSingle();
    if(result.error)throw result.error;
    return result.data;
  };
  const makeRow=(item:any,c:any,existing:any=null)=>{
    const lab=val(item.lab_name),number=val(item.account_code),notes=val(item.notes);
    const type=val(item.account_type||"dot").toLowerCase().replace(/\s+/g,"_");
    if(!lab||!number||lab.length>180||number.length>120||notes.length>2000||!type||type.length>80||!/^[a-z0-9_-]+$/.test(type))throw Error("Laboratory, account number, and valid type are required (maximum laboratory 180, number 120 characters).");
    const cfg=existing?.config&&typeof existing.config==="object"?existing.config:{};
    const nums=cfg.account_numbers&&typeof cfg.account_numbers==="object"?cfg.account_numbers:{};
    return {ctpa_id:c.id,tenant_id:c.tenant_id,lab_name:lab,account_code:number,status:val(item.status)==="inactive"?"inactive":"active",is_primary:item.is_primary===true,notes,
      config:{...cfg,account_type:type,account_numbers:{...nums,[type]:number}},updated_at:new Date().toISOString()};
  };
  const notifyAssigned=async(ctpaId:string,orgId:string|null)=>{
    if(!orgId)return "missing_organization";
    const org=await db.from("organizations").select("legal_name,primary_email").eq("id",orgId).maybeSingle();
    if(org.error)throw org.error;
    const to=val(org.data?.primary_email);
    if(!to)return "missing_email";
    const previous=await db.from("testing_email_events").select("id").eq("event_type","ctpa_lab_account_ready").eq("related_entity_id",ctpaId).eq("recipient_email",to).eq("status","sent").limit(1);
    if(previous.error)throw previous.error;
    if(previous.data?.length)return "already_sent";
    const key=Deno.env.get("RESEND_API_KEY")||"";
    const subject="Your Screenings4U laboratory accounts are ready";
    const html='<div style="background:#f4f7fb;padding:28px;font-family:Arial,sans-serif;color:#17365f"><div style="max-width:620px;margin:auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #dce5f0"><div style="padding:24px;background:#24467f"><img width="190" src="https://screenings4u.com/images/logo.webp" alt="Screenings4U"></div><div style="padding:26px"><h1>Your lab accounts are set up</h1><p>Hello '+val(org.data?.legal_name).replace(/[&<>"]/g,"")+', your laboratory account numbers have been assigned by our team.</p><p>Sign in to your authorized Screenings4U workspace to view laboratory account details, available supplies, and testing resources.</p><a href="https://lab-account.screenings4u.com/dashboard.html" style="display:inline-block;padding:14px 20px;border-radius:9px;background:#f36b00;color:white;text-decoration:none;font-weight:bold">Open your portal</a><p style="color:#64748b;font-size:12px">If you need help, contact support@screenings4u.com.</p></div></div></div>';
    let status="failed",providerId=null,errorText="";
    if(!key)errorText="RESEND_API_KEY not configured";
    else try{
      const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("SCREENINGS4U_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[to],subject,html})});
      const data=await response.json().catch(()=>({}));
      if(response.ok){status="sent";providerId=data.id||null;}else errorText=String(data.message||"Email provider error").slice(0,300);
    }catch(e){errorText=e instanceof Error?e.message:"Email error"}
    const record=await db.from("testing_email_events").insert({event_type:"ctpa_lab_account_ready",related_entity_type:"ctpa",related_entity_id:ctpaId,recipient_email:to,subject,status,provider:"resend",provider_message_id:providerId,error_message:errorText||null,sent_at:status==="sent"?new Date().toISOString():null,metadata:{source:"lab-account-management"}});
    if(record.error)console.error("lab setup email audit",record.error.code);
    return status;
  };
  if(action==="list"){
    const [ct,ac,org]=await Promise.all([
      db.from("ctpas").select("id,tenant_id,organization_id,status").order("created_at",{ascending:false}).limit(2000),
      db.from("ctpa_portal_lab_accounts").select("id,ctpa_id,tenant_id,organization_id,company_code,lab_name,laboratory_name,account_code,is_primary,status,notes,config,created_at,updated_at").order("created_at",{ascending:false}).limit(5000),
      db.from("organizations").select("id,legal_name,dba_name").limit(3000)
    ]);
    if(ct.error||ac.error||org.error)throw ct.error||ac.error||org.error;
    return send({ctpas:ct.data||[],accounts:ac.data||[],organizations:org.data||[]});
  }
  if(action==="notify_setup"){
    const c=await ctpaLookup(val(body.ctpa_id));
    if(!c)return send({error:"Choose a valid C/TPA"},400);
    const ctpaStatus=await db.from("ctpas").select("status").eq("id",c.id).maybeSingle();
    if(ctpaStatus.error)throw ctpaStatus.error;
    if(ctpaStatus.data?.status!=="active")return send({error:"Activate the C/TPA after intake review and account assignment before sending the ready notice."},409);
    const q=await db.from("ctpa_lab_accounts").select("id",{head:true,count:"exact"}).eq("ctpa_id",c.id).eq("status","active");
    if(q.error)throw q.error;
    if(!q.count)return send({error:"Assign at least one active laboratory account number before sending setup notice"},409);
    const status=await notifyAssigned(c.id,c.organization_id);
    return send({ok:true,notification_status:status});
  }
  if(action==="save"||action==="save_many"){
    const ctpaId=val(body.ctpa_id),c=await ctpaLookup(ctpaId);
    if(!c)return send({error:"Choose a valid C/TPA."},400);
    const before=await db.from("ctpa_lab_accounts").select("id",{count:"exact",head:true}).eq("ctpa_id",c.id);if(before.error)throw before.error;
    if(action==="save_many"){
      const items=body.accounts;
      if(!Array.isArray(items)||!items.length||items.length>100)return send({error:"Provide 1–100 account numbers per save. Additional batches are supported."},400);
      const rows=items.map((x:any)=>({...makeRow(x,c),created_by:user.id}));
      if(rows.filter((x:any)=>x.is_primary).length>1)return send({error:"Only one account can be marked primary per batch."},400);
      if(rows.some((x:any)=>x.is_primary)){const reset=await db.from("ctpa_lab_accounts").update({is_primary:false}).eq("ctpa_id",c.id);if(reset.error)throw reset.error;}
      const saved=await db.from("ctpa_lab_accounts").insert(rows).select("id");
      if(saved.error)throw saved.error;
      const notice="awaiting_activation_and_staff_setup_notice";
      return send({ok:true,notice,count:saved.data?.length||0,ids:(saved.data||[]).map((x:any)=>x.id)});
    }
    const id=val(body.id);let existing:any=null;
    if(id){
      if(!/^[0-9a-f-]{36}$/i.test(id))return send({error:"Invalid assignment ID"},400);
      const ex=await db.from("ctpa_lab_accounts").select("id,ctpa_id,config").eq("id",id).maybeSingle();
      if(ex.error)throw ex.error;
      if(!ex.data||ex.data.ctpa_id!==c.id)return send({error:"Assignment does not belong to this C/TPA"},404);
      existing=ex.data;
    }
    const row=makeRow(body,c,existing);
    if(row.is_primary){const reset=await db.from("ctpa_lab_accounts").update({is_primary:false}).eq("ctpa_id",c.id);if(reset.error)throw reset.error;}
    const saved=id?
      await db.from("ctpa_lab_accounts").update(row).eq("id",id).eq("ctpa_id",c.id).select("id").single():
      await db.from("ctpa_lab_accounts").insert({...row,created_by:user.id}).select("id").single();
    if(saved.error)throw saved.error;
    const notice="awaiting_activation_and_staff_setup_notice";
    return send({ok:true,id:saved.data.id,notice});
  }
  return send({error:"Unsupported action"},400);
 }catch(e){console.error("lab-account-management",e);return send({error:"Lab account request could not be completed"},500)}
});