import { createClient } from "npm:@supabase/supabase-js@2";
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const reply=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...CORS,"Content-Type":"application/json","Cache-Control":"no-store"}});
const enc=new TextEncoder();
const toB64=(a:Uint8Array)=>btoa(String.fromCharCode(...a));
const fromB64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const hex=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))).map(b=>b.toString(16).padStart(2,"0")).join("");
async function key(){
  const secret=Deno.env.get("PORTAL_HANDOFF_SECRET")||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const raw=await crypto.subtle.digest("SHA-256",enc.encode(secret));
  return crypto.subtle.importKey("raw",raw,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}
async function encrypt(payload:any){
  const iv=crypto.getRandomValues(new Uint8Array(12)); const k=await key();
  const out=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},k,enc.encode(JSON.stringify(payload))));
  return {ciphertext:toB64(out),iv:toB64(iv)};
}
async function decrypt(ciphertext:string,iv:string){
  const k=await key(); const raw=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromB64(iv)},k,fromB64(ciphertext));
  return JSON.parse(new TextDecoder().decode(raw));
}
function portalFor(surface:string,requested:string){
  const p=String(requested||"").toLowerCase();
  if(surface==="dot") return p||"ctpa_dot";
  if(surface==="workforce") return p||"ctpa_workforce";
  if(surface==="lab")return p==="lab_account"?"lab_account":"";
  return "";
}
function redirectTarget(surface:string,portal:string){
  const map:Record<string,string>={
    lab_account:"https://lab-account.screenings4u.com/auth-handoff.html",
    ctpa_dot:"https://ctpa.screenings4u.com/auth-handoff.html",
    ctpa_employer_dot:"https://ctpa-employer-dot.screenings4u.com/auth-handoff.html",
    ctpa_employee_dot:"https://ctpa-employee-dot.screenings4u.com/auth-handoff.html",
    ctpa_driver_dot:"https://ctpa-driver-dot.screenings4u.com/auth-handoff.html",
    independent_contractor:"https://independent-contractor.screenings4u.com/auth-handoff.html",
    ctpa_contractor_dot:"https://independent-contractor.screenings4u.com/auth-handoff.html",
    direct_contractor_dot:"https://independent-contractor.screenings4u.com/auth-handoff.html",
    employer_dot:"https://fmcsa-employer-dot.screenings4u.com/auth-handoff.html",
    driver_dot:"https://fmcsa-driver-dot.screenings4u.com/auth-handoff.html",
    employee_dot:"https://fmcsa-employee-dot.screenings4u.com/auth-handoff.html",
    owner_operator:"https://owner-operator.screenings4u.com/auth-handoff.html",
    fmcsa_dot:"https://fmcsa-dot.screenings4u.com/auth-handoff.html",
    faa_dot:"https://faa-dot.screenings4u.com/auth-handoff.html",
    fra_dot:"https://fra-dot.screenings4u.com/auth-handoff.html",
    fta_dot:"https://fta-dot.screenings4u.com/auth-handoff.html",
    phmsa_dot:"https://phmsa-dot.screenings4u.com/auth-handoff.html",
    uscg_dot:"https://uscg-dot.screenings4u.com/auth-handoff.html",
    faa_employer_dot:"https://faa-employer-dot.screenings4u.com/auth-handoff.html",
    fra_employer_dot:"https://fra-employer-dot.screenings4u.com/auth-handoff.html",
    fta_employer_dot:"https://fta-employer-dot.screenings4u.com/auth-handoff.html",
    phmsa_employer_dot:"https://phmsa-employer-dot.screenings4u.com/auth-handoff.html",
    uscg_employer_dot:"https://uscg-employer-dot.screenings4u.com/auth-handoff.html",
    faa_employee_dot:"https://faa-employee-dot.screenings4u.com/auth-handoff.html",
    fra_employee_dot:"https://fra-employee-dot.screenings4u.com/auth-handoff.html",
    fta_employee_dot:"https://fta-employee-dot.screenings4u.com/auth-handoff.html",
    phmsa_employee_dot:"https://phmsa-employee-dot.screenings4u.com/auth-handoff.html",
    uscg_employee_dot:"https://uscg-employee-dot.screenings4u.com/auth-handoff.html",
    ctpa_workforce:"https://ctpa.screenings4u.com/auth-handoff.html",
    employer_workforce:"https://employer-non-dot.screenings4u.com/auth-handoff.html",
    employee_workforce:"https://employee-non-dot.screenings4u.com/auth-handoff.html",
    driver_workforce:"https://driver-non-dot.screenings4u.com/auth-handoff.html",
    ctpa_employer_workforce:"https://ctpa-employer-non-dot.screenings4u.com/auth-handoff.html",
    ctpa_employee_workforce:"https://ctpa-employee-non-dot.screenings4u.com/auth-handoff.html",
    ctpa_driver_workforce:"https://ctpa-driver-non-dot.screenings4u.com/auth-handoff.html"
  };
  return map[portal]||"";
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:CORS});
 if(req.method!=="POST")return reply({error:"Method not allowed."},405);
 try{
  const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json().catch(()=>({})); const action=String(body?.action||"create");
  if(action==="redeem"){
    const code=String(body?.code||"").trim(); if(!code)return reply({error:"Handoff code is required."},400);
    const codeHash=await hex(code);
    const q=await db.from("portal_handoff_sessions").select("*").eq("code_hash",codeHash).maybeSingle();
    if(q.error)throw q.error; if(!q.data)return reply({error:"This portal handoff is invalid or has already been used."},404);
    if(new Date(q.data.expires_at).getTime()<=Date.now()){await db.from("portal_handoff_sessions").delete().eq("code_hash",codeHash);return reply({error:"This portal handoff has expired."},410)}
    const d=await db.from("portal_handoff_sessions").delete().eq("code_hash",codeHash);if(d.error)throw d.error;
    const payload=await decrypt(q.data.ciphertext,q.data.iv);
    return reply({token_hash:payload.token_hash,target_surface:q.data.target_surface,target_portal:q.data.target_portal,next_path:q.data.next_path});
  }
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return reply({error:"Authentication required."},401);
  const {data:ud,error:ue}=await auth.auth.getUser(token);if(ue||!ud.user)return reply({error:"Authentication required."},401);
  const surface=String(body?.surface||body?.product_code||"").toLowerCase(); if(!["dot","workforce","lab"].includes(surface))return reply({error:"Invalid portal surface."},400);
  const portal=portalFor(surface,String(body?.portal_code||""));
  const next=String(body?.next||"/ctpa/dashboard.html"); let safeNext=next.startsWith("/")&&!next.startsWith("//")?next:"/ctpa/dashboard.html";
  let allowed=false;
  if(surface==="dot"){
    const ms=await db.from("organization_memberships").select("*").eq("user_id",ud.user.id).eq("status","active");if(ms.error)throw ms.error;
    for(const m of ms.data||[]){
      const pa=await db.from("organization_portal_access").select("*").eq("organization_id",m.organization_id).eq("portal_code",portal).eq("enabled",true).maybeSingle();
      if(pa.error)throw pa.error;if(pa.data){allowed=true;break}
    }
  } else {
    const ms=await db.from("workforce_memberships").select("organization_id").eq("user_id",ud.user.id).eq("status","active");
    if(ms.error)throw ms.error;
    const orgIds=(ms.data||[]).map((x:any)=>x.organization_id);
    if(orgIds.length){
      const [grants,overrides]=await Promise.all([
        db.from("workforce_portal_access").select("organization_id").in("organization_id",orgIds).eq("portal_code",portal).eq("enabled",true),
        db.from("workforce_portal_user_access").select("organization_id,enabled").in("organization_id",orgIds).eq("user_id",ud.user.id).eq("portal_code",portal)
      ]);
      if(grants.error||overrides.error)throw grants.error||overrides.error;
      const denied=new Set((overrides.data||[]).filter((x:any)=>x.enabled===false).map((x:any)=>x.organization_id));
      const granted=new Set((grants.data||[]).map((x:any)=>x.organization_id));
      allowed=orgIds.some((org:string)=>!denied.has(org)&&(granted.has(org)||(overrides.data||[]).some((x:any)=>x.organization_id===org&&x.enabled===true)));
    }
  }
  if(surface==="dot"&&portal==="independent_contractor"){const q=await db.from("ic_portal_access").select("enabled").eq("user_id",ud.user.id).eq("enabled",true).maybeSingle();if(q.error)throw q.error;allowed=!!q.data;if(allowed)safeNext="/dashboard.html";}
  if(surface==="dot"&&portal==="ctpa_employee_dot"){
    allowed=false;
    const employeeId=String(body?.employee_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(employeeId))return reply({error:"Select a valid sponsored employee account."},400);
    const employee=await db.from("employees").select("id,employer_id").eq("id",employeeId).eq("auth_user_id",ud.user.id).eq("employment_status","active").is("archived_at",null).maybeSingle();
    if(employee.error)throw employee.error;
    if(employee.data){
      const employer=await db.from("employers").select("id,organization_id,ctpa_id").eq("id",employee.data.employer_id).eq("status","active").maybeSingle();
      if(employer.error)throw employer.error;
      if(employer.data?.ctpa_id){
        const [grant,subscription]=await Promise.all([
          db.from("organization_portal_access").select("organization_id").eq("organization_id",employer.data.organization_id).eq("portal_code","ctpa_employer_dot").eq("enabled",true).limit(1),
          db.from("subscriptions").select("id,plans!inner(code,active)").eq("employer_id",employer.data.id).in("status",["active","trial","trialing"]).eq("plans.code","dot_employer_ctpa_sponsored").eq("plans.active",true).limit(1)
        ]);
        if(grant.error||subscription.error)throw grant.error||subscription.error;
        allowed=!!grant.data?.length&&!!subscription.data?.length;
      }
    }
    if(allowed)safeNext="/dashboard.html?employee_id="+encodeURIComponent(employeeId);
  }
  if(surface==="dot"&&(portal==="ctpa_contractor_dot"||portal==="direct_contractor_dot")){
    allowed=false;
    const requestedId=String(body?.assignment_id||"");
    const expectedType=portal==="ctpa_contractor_dot"?"dot_ctpa_contractor":"dot_employer_contractor";
    if(!/^[0-9a-f-]{36}$/i.test(requestedId))return reply({error:"Contractor assignment required"},400);
    const assignment=await db.from("account_type_assignments").select("id,ctpa_id,employer_id,account_types!inner(code)").eq("id",requestedId).eq("user_id",ud.user.id).eq("status","active").is("archived_at",null).eq("account_types.code",expectedType).maybeSingle();
    if(assignment.error)throw assignment.error;
    if(assignment.data?.ctpa_id&&portal==="ctpa_contractor_dot"){const check=await db.from("ctpas").select("id").eq("id",assignment.data.ctpa_id).eq("status","active").maybeSingle();if(check.error)throw check.error;allowed=!!check.data}
    if(assignment.data?.employer_id&&portal==="direct_contractor_dot"){const check=await db.from("employers").select("id").eq("id",assignment.data.employer_id).eq("status","active").maybeSingle();if(check.error)throw check.error;allowed=!!check.data}
    if(allowed)safeNext="/dashboard.html";
  }
  if(surface==="dot"&&portal==="ctpa_driver_dot"){
    allowed=false;
    const employeeId=String(body?.employee_id||"");
    if(!/^[0-9a-f-]{36}$/i.test(employeeId))return reply({error:"Select a valid sponsored driver account."},400);
    const assignments=await db.from("account_type_assignments").select("id,employee_id,ctpa_id,source,account_types!inner(code)").eq("user_id",ud.user.id).eq("employee_id",employeeId).eq("status","active").is("archived_at",null).eq("account_types.code","dot_ctpa_driver");
    if(assignments.error)throw assignments.error;
    const employee=await db.from("employees").select("id,employer_id,auth_user_id,cdl_number").eq("id",employeeId).eq("auth_user_id",ud.user.id).eq("employment_status","active").is("archived_at",null).maybeSingle();
    if(employee.error)throw employee.error;
    if(employee.data){
      const employer=await db.from("employers").select("id,ctpa_id").eq("id",employee.data.employer_id).eq("status","active").maybeSingle();
      if(employer.error)throw employer.error;
      if(employer.data?.ctpa_id){
        const ctpa=await db.from("ctpas").select("id").eq("id",employer.data.ctpa_id).eq("status","active").maybeSingle();
        if(ctpa.error)throw ctpa.error;
        allowed=!!ctpa.data&&(assignments.data||[]).some((a:any)=>a.ctpa_id===employer.data.ctpa_id&&(String(employee.data.cdl_number||"").trim()||a.source==="screenings4u_test_driver"));
      }
    }
    if(allowed)safeNext="/dashboard.html";
  }
  if(surface==="dot"&&portal==="employer_dot"&&body?.membership_id){
    const selected=String(body.membership_id);
    const m=await db.from("organization_memberships").select("id,organization_id").eq("user_id",ud.user.id).eq("status","active").eq("id",selected).maybeSingle();
    if(m.error)throw m.error;
    const grant=m.data?await db.from("organization_portal_access").select("id").eq("organization_id",m.data.organization_id).eq("portal_code","employer_dot").eq("enabled",true).limit(1):null;
    if(grant?.error)throw grant.error;
    allowed=!!m.data&&!!grant?.data?.length;
    if(allowed)safeNext="/dashboard.html?membership_id="+encodeURIComponent(selected);
  }
  if(surface==="dot"&&["faa_employer_dot","fra_employer_dot","fta_employer_dot","phmsa_employer_dot","uscg_employer_dot"].includes(portal)){
    const memberships=await db.from("organization_memberships").select("id,organization_id").eq("user_id",ud.user.id).eq("status","active");
    if(memberships.error)throw memberships.error;
    const authorized=[];
    for(const member of memberships.data||[]){
      const grant=await db.from("organization_portal_access").select("id").eq("organization_id",member.organization_id).eq("portal_code",portal).eq("enabled",true).limit(1);
      if(grant.error)throw grant.error;
      if(grant.data?.length)authorized.push(member);
    }
    const selected=String(body?.membership_id||"");
    const match=authorized.find(m=>m.id===selected)||(authorized.length===1?authorized[0]:null);
    allowed=!!match;
    if(match)safeNext="/dashboard.html?membership_id="+encodeURIComponent(match.id);
  }
  if(surface==="dot"&&["faa_employee_dot","fra_employee_dot","fta_employee_dot","phmsa_employee_dot","uscg_employee_dot","employee_dot","driver_dot"].includes(portal)){
    allowed=false;
    const employeeId=String(body?.employee_id||"");
    if(/^[0-9a-f-]{36}$/i.test(employeeId)){
      const grant=await db.from("dot_individual_portal_access").select("employee_id").eq("user_id",ud.user.id).eq("employee_id",employeeId).eq("portal_code",portal).eq("enabled",true).maybeSingle();
      if(grant.error)throw grant.error;
      const employee=grant.data?await db.from("employees").select("id").eq("id",employeeId).eq("auth_user_id",ud.user.id).eq("employment_status","active").is("archived_at",null).maybeSingle():null;
      if(employee?.error)throw employee.error;
      allowed=!!employee?.data;
      if(allowed)safeNext="/dashboard.html?employee_id="+encodeURIComponent(employeeId);
    }
  }
  if(surface==="workforce"&&portal==="ctpa_workforce"){
    const members=await db.from("workforce_memberships").select("id,organization_id").eq("user_id",ud.user.id).eq("status","active");
    if(members.error)throw members.error;
    const candidates=[];
    for(const m of members.data||[]){
      const grant=await db.from("workforce_portal_access").select("id").eq("organization_id",m.organization_id).eq("portal_code","ctpa_workforce").eq("enabled",true).limit(1);
      if(grant.error)throw grant.error;
      if(!grant.data?.length)continue;
      const ctpa=await db.from("workforce_ctpas").select("id").eq("organization_id",m.organization_id).eq("status","active").maybeSingle();
      if(ctpa.error)throw ctpa.error;
      if(!ctpa.data)continue;
      const subs=await db.from("workforce_subscriptions").select("id").eq("ctpa_id",ctpa.data.id).in("status",["active","trial","trialing"]).order("created_at",{ascending:false}).limit(20);
      if(subs.error)throw subs.error;
      for(const sub of subs.data||[])candidates.push({member:m,ctpa:ctpa.data,sub});
    }
    const requested=String(body?.membership_id||"");
    const requestedSub=String(body?.subscription_id||"");
    const selected=(requested&&requestedSub?candidates.find(x=>x.member.id===requested&&x.sub.id===requestedSub):null)||(!requested&&!requestedSub&&candidates.length===1?candidates[0]:null);
    allowed=!!selected;
    if(selected)safeNext="/dashboard.html?ctpa_id="+encodeURIComponent(selected.ctpa.id)+"&subscription_id="+encodeURIComponent(selected.sub.id)+"&membership_id="+encodeURIComponent(selected.member.id)+"&organization_id="+encodeURIComponent(selected.member.organization_id);
  }
  // Enforce per-user NON-DOT access at launch, not just in the selector.
  // A disabled individual assignment overrides an enabled organization assignment.
  if(surface==="workforce"){
    const membershipId=String(body?.membership_id||"");
    const memberships=await db.from("workforce_memberships").select("id,organization_id").eq("user_id",ud.user.id).eq("status","active");
    if(memberships.error)throw memberships.error;
    const active=memberships.data||[];
    const scoped=membershipId?active.filter(m=>m.id===membershipId):active;
    if(!scoped.length)return reply({error:"No active membership for this portal.",reason_code:"PORTAL_MEMBERSHIP_NOT_AUTHORIZED"},403);
    const orgIds=[...new Set(scoped.map(m=>m.organization_id))];
    const [personal,organization]=await Promise.all([
      db.from("workforce_portal_user_access").select("organization_id,enabled").eq("user_id",ud.user.id).eq("portal_code",portal).in("organization_id",orgIds),
      db.from("workforce_portal_access").select("organization_id,enabled").eq("portal_code",portal).in("organization_id",orgIds)
    ]);
    if(personal.error||organization.error)throw personal.error||organization.error;
    const permitted=orgIds.some(orgId=>{
      const own=(personal.data||[]).find(row=>row.organization_id===orgId);
      if(own)return own.enabled===true;
      return (organization.data||[]).some(row=>row.organization_id===orgId&&row.enabled===true);
    });
    // Keep additional account/subscription checks for C/TPA workforce portals.
    allowed=allowed&&permitted;
  }
  if(surface==="lab"&&portal==="lab_account"){
    const verification=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},body:"{}"});
    const result=await verification.json().catch(()=>({}));
    allowed=verification.ok&&result.authorized===true;
    if(allowed)safeNext="/dashboard.html";
  }
  if(!allowed){console.warn("PORTAL_HANDOFF_DENIED",JSON.stringify({user_id:ud.user.id,surface,portal_code:portal,membership_id:String(body?.membership_id||""),subscription_id:String(body?.subscription_id||""),employee_id:String(body?.employee_id||"")}));return reply({error:"This portal card does not match a currently authorized account or subscription. Refresh accounts and select the assigned workspace.",reason_code:"PORTAL_MEMBERSHIP_NOT_AUTHORIZED",portal_code:portal,surface,selected_membership:body?.membership_id?"provided":"missing"},403)}
  const generated=await db.auth.admin.generateLink({type:"magiclink",email:String(ud.user.email||"")});
  if(generated.error)throw generated.error;
  const tokenHash=String(generated.data?.properties?.hashed_token||"");
  if(!tokenHash)return reply({error:"Unable to create secure portal handoff."},500);
  const code=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
  const encrypted=await encrypt({token_hash:tokenHash});
  const codeHash=await hex(code);
  const ins=await db.from("portal_handoff_sessions").insert({code_hash:codeHash,user_id:ud.user.id,target_surface:surface,target_portal:portal,next_path:safeNext,ciphertext:encrypted.ciphertext,iv:encrypted.iv,expires_at:new Date(Date.now()+120000).toISOString()});
  if(ins.error)throw ins.error;
  const target=redirectTarget(surface,portal);
  if(!target){
    await db.from("portal_handoff_sessions").delete().eq("code_hash",codeHash);
    return reply({error:"No active portal host is configured for this portal.",portal_code:portal,surface},409);
  }
  const redirect_url=target+"?code="+encodeURIComponent(code);
  return reply({redirect_url});
 }catch(e){console.error("portal-session-handoff",e);return reply({error:e instanceof Error?e.message:String(e)},500)}
});