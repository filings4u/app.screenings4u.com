import { createClient } from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-client-info,apikey,authorization","Access-Control-Allow-Methods":"POST,OPTIONS"};
const R=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clean=(v:any)=>String(v??"").trim();
const low=(v:any)=>clean(v).toLowerCase();
const poBox=(v:any)=>/\bP(?:OST)?\.?\s*O(?:FFICE)?\.?\s*BOX\b|\bP\.?\s*O\.?\s*BOX\b|\bPOBOX\b/i.test(clean(v));
const uid=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
async function sendEmail(to:string,subject:string,html:string){
 const key=Deno.env.get("RESEND_API_KEY")||"";if(!key||!to)return {sent:false,reason:key?"missing_recipient":"email_not_configured"};
 const from=Deno.env.get("RESEND_FROM_EMAIL")||Deno.env.get("EMAIL_FROM")||"screenings4u <notifications@screenings4u.com>";
 try{
  const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject,html})});
  const body=await r.json().catch(()=>({}));if(!r.ok)return {sent:false,reason:body?.message||`email_http_${r.status}`};return {sent:true,id:body?.id||null};
 }catch(e){return {sent:false,reason:e instanceof Error?e.message:String(e)}}
}
function allFields(sections:any[]){return sections.flatMap(s=>Array.isArray(s?.fields)?s.fields:[])}
function validateField(f:any,v:any){
 const value=Array.isArray(v)?v.map(clean).filter(Boolean):clean(v);
 if(f.type==="checkbox"&&f.required&&!["true","on","1","yes"].includes(String(value).toLowerCase()))return `${f.label||f.name} is required.`;
 if(f.required && ((Array.isArray(value)&&!value.length)||(!Array.isArray(value)&&!value)))return `${f.label||f.name} is required.`;
 if(!value)return null;
 if(f.type==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)))return `${f.label||f.name} must be a valid email address.`;
 if(f.type==="url"){try{new URL(String(value))}catch{return `${f.label||f.name} must be a valid URL.`}}
 if(f.no_po_box&&poBox(value))return `${f.label||f.name} cannot be a P.O. Box.`;
 if(f.minlength!=null&&String(value).length<Number(f.minlength))return `${f.label||f.name} is too short.`;
 if(f.maxlength!=null&&String(value).length>Number(f.maxlength))return `${f.label||f.name} is too long.`;
 if(f.pattern){try{if(!(new RegExp(f.pattern)).test(String(value)))return `${f.label||f.name} is invalid.`}catch{}}
 if(["number","range"].includes(f.type)){const n=Number(value);if(!Number.isFinite(n))return `${f.label||f.name} must be a number.`;if(f.min!=null&&n<Number(f.min))return `${f.label||f.name} is below the minimum.`;if(f.max!=null&&n>Number(f.max))return `${f.label||f.name} is above the maximum.`}
 if(Array.isArray(f.options)&&f.options.length&&["select","radio"].includes(f.type)){const allowed=new Set(f.options.map((x:any)=>clean(x.value??x.label)));if(!allowed.has(String(value)))return `${f.label||f.name} has an invalid selection.`}
 if(Array.isArray(f.options)&&f.options.length&&f.type==="checkbox_group"){const allowed=new Set(f.options.map((x:any)=>clean(x.value??x.label)));for(const x of Array.isArray(value)?value:[value])if(!allowed.has(String(x)))return `${f.label||f.name} contains an invalid selection.`}
 return null;
}
Deno.serve(async(req)=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return R({error:"Method not allowed."},405);try{
 const body=await req.json().catch(()=>({})),formKey=clean(body.formKey),slug=clean(body.slug),payload=body.payload&&typeof body.payload==="object"?body.payload:{};
 if(!formKey&&!slug)return R({error:"Form identifier is required."},400);
 if(clean(body.websiteTrap))return R({error:"Unable to submit this form."},400);
 const started=Number(body.formStartedAt||0);if(started&&Date.now()-started<1200)return R({error:"Please review the form before submitting."},400);
 const url=Deno.env.get("SUPABASE_URL")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
 let fq=db.from("standalone_forms").select("*").eq("status","published");fq=formKey?fq.eq("form_key",formKey):fq.eq("slug",slug);
 const fr=await fq.maybeSingle();if(fr.error)throw fr.error;if(!fr.data)return R({error:"This form is unavailable."},404);const form=fr.data;
 const fields=allFields(Array.isArray(form.sections)?form.sections:[]);
 for(const f of fields){if(f.type==="file")continue;const err=validateField(f,payload[f.name]);if(err)return R({error:err,field:f.name},400)}
 const settings=form.settings||{};const secret=Deno.env.get("TURNSTILE_SECRET_KEY")||Deno.env.get("CLOUDFLARE_TURNSTILE_SECRET")||"";
 if(secret&&settings.require_turnstile!==false){
   const token=clean(body.turnstileToken);if(!token)return R({error:"Security verification is required."},400);
   const fd=new FormData();fd.append("secret",secret);fd.append("response",token);const ip=req.headers.get("cf-connecting-ip");if(ip)fd.append("remoteip",ip);
   const vr=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:fd});const v=await vr.json().catch(()=>({}));if(!v.success)return R({error:"Security verification failed. Please try again."},400);
 }
 const map=settings.contact_mapping||{};
 const first=clean(payload[map.first_name_field]||payload.first_name||payload.primary_contact_first_name);
 const last=clean(payload[map.last_name_field]||payload.last_name||payload.primary_contact_last_name);
 const email=low(payload[map.email_field]||payload.email||payload.primary_contact_email);
 const phone=clean(payload[map.phone_field]||payload.phone||payload.primary_contact_phone);
 let customerUserId=null,organizationId=null,testingEmployerId=null,relatedOrderId=null,labIntake:any=null,labToken="";
 if(form.form_key==="lab_account_intake"){
   labToken=clean(body.intakeToken);
   if(!labToken){try{const source=new URL(clean(body.sourceUrl));labToken=clean(source.searchParams.get("token")||source.searchParams.get("intake_token"));if(!labToken&&source.hash){const hp=new URLSearchParams(source.hash.replace(/^#/,""));labToken=clean(hp.get("token")||hp.get("intake_token"))}}catch{}}
   let li:any={data:null,error:null};
   if(labToken){
     li=await db.from("lab_account_intakes").select("*").eq("token",labToken).maybeSingle();
   }else if(email){
     li=await db.from("lab_account_intakes").select("*").ilike("customer_email",email).neq("status","completed").order("created_at",{ascending:false}).limit(1).maybeSingle();
     if(!li.error&&!li.data){
       const oq=await db.from("orders").select("id,order_number,user_id,customer_email,metadata,status,payment_status").ilike("customer_email",email).eq("payment_status","paid").order("created_at",{ascending:false}).limit(50);if(oq.error)throw oq.error;
       for(const order of oq.data||[]){
         const iq=await db.from("order_items").select("metadata,services(sku,slug,name)").eq("order_id",order.id);if(iq.error)throw iq.error;
         const hasLab=(iq.data||[]).some((it:any)=>{const s:any=it.services||{};const sku=low(it.metadata?.service_sku||s.sku||s.slug||"");return sku==="lab-account"||sku==="lab_account"||low(s.name)==="lab account"});
         if(!hasLab)continue;
         const token=crypto.randomUUID(),row={id:crypto.randomUUID(),token,order_id:order.id,order_number:order.order_number,customer_user_id:order.user_id||null,customer_email:email,service_sku:"lab-account",workforce_dot_plan_code:order.metadata?.plan_code||null,status:"pending",intake_data:{},created_at:now(),updated_at:now()};
         const ins=await db.from("lab_account_intakes").upsert(row,{onConflict:"order_id"}).select("*").single();if(ins.error)throw ins.error;li={data:ins.data,error:null};break;
       }
     }
   }
   if(li.error)throw li.error;
   if(!li.data)return R({error:"No paid lab account purchase could be matched to this intake. Use the same email address used for the lab account order."},404);
   labIntake=li.data;labToken=clean(li.data.token);
   relatedOrderId=li.data.order_id||null;customerUserId=li.data.customer_user_id||null;
   if(li.data.customer_email&&email&&low(li.data.customer_email)!==email)return R({error:"The email on this intake does not match the purchased lab account."},400);
 }
 if(email){
   const p=await db.from("user_profiles").select("id").ilike("email",email).limit(1).maybeSingle();if(p.error)throw p.error;if(p.data)customerUserId=p.data.id;
   if(customerUserId){const m=await db.from("organization_memberships").select("organization_id").eq("user_id",customerUserId).eq("status","active").order("is_primary",{ascending:false}).limit(1).maybeSingle();if(m.error)throw m.error;if(m.data)organizationId=m.data.organization_id}
   if(!organizationId){const o=await db.from("organizations").select("id").ilike("primary_email",email).limit(1).maybeSingle();if(o.error)throw o.error;if(o.data)organizationId=o.data.id}
 }
 if(organizationId&&form.business_unit_code==="testing"){const te=await db.from("testing_employers").select("id").eq("organization_id",organizationId).maybeSingle();if(te.error)throw te.error;if(te.data)testingEmployerId=te.data.id}
 const orderField=clean(settings.order_id_field||"order_id"),requestedOrder=clean(payload[orderField]);if(requestedOrder){const oq=await db.from("orders").select("id").eq("id",requestedOrder).maybeSingle();if(oq.error)throw oq.error;if(oq.data)relatedOrderId=oq.data.id}
 if(["lab_account_intake","lab_account_intake_standalone"].includes(form.form_key)){
   if(!email&&!customerUserId)return R({error:"A verified customer email is required for a lab account application."},400);
   const activeStatuses=["submitted","reviewing","completed"];
   let existing:any={data:null,error:null};
   if(customerUserId){existing=await db.from("standalone_form_submissions").select("id").in("form_key",["lab_account_intake","lab_account_intake_standalone"]).in("status",activeStatuses).eq("customer_user_id",customerUserId).limit(1).maybeSingle();if(existing.error)throw existing.error;}
   if(!existing.data&&email){existing=await db.from("standalone_form_submissions").select("id").in("form_key",["lab_account_intake","lab_account_intake_standalone"]).in("status",activeStatuses).ilike("submitter_email",email).limit(1).maybeSingle();if(existing.error)throw existing.error;}
   if(existing.data)return R({error:"A lab account intake already exists for this customer. Please use the existing intake for future purchases rather than submitting a duplicate."},409);
 }
 const id=uid(),prefix=form.form_key==="lab_account_intake"?"INT":"FORM",num=`${prefix}-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${id.slice(0,8).toUpperCase()}`;
 const insert=await db.from("standalone_form_submissions").insert({
   id,submission_number:num,form_id:form.id,form_key:form.form_key,form_version:String(form.version||1),form_title:form.title,
   business_unit_code:form.business_unit_code,status:"submitted",source_url:clean(body.sourceUrl)||null,payload,
   submitter_name:[first,last].filter(Boolean).join(" ")||null,submitter_email:email||null,submitter_phone:phone||null,
   customer_user_id:customerUserId,organization_id:organizationId,testing_employer_id:testingEmployerId,related_order_id:relatedOrderId,
   metadata:{turnstile_verified:!!secret&&settings.require_turnstile!==false,source:"standalone_form_builder",slug:form.slug},created_at:now(),updated_at:now()
 }).select("id,submission_number").single();if(insert.error){if(insert.error.code==='23505'&&['lab_account_intake','lab_account_intake_standalone'].includes(form.form_key))return R({error:'An open lab account application already exists for this customer. Please manage the existing application instead.'},409);throw insert.error;}
 if(form.form_key==="lab_account_intake"&&labIntake){
   const lu=await db.from("lab_account_intakes").update({status:"submitted",intake_data:payload,submitted_at:now(),updated_at:now(),customer_user_id:customerUserId||labIntake.customer_user_id,customer_email:email||labIntake.customer_email}).eq("id",labIntake.id);if(lu.error)throw lu.error;
 }
 if(["lab_account_intake_standalone","lab_account_intake"].includes(form.form_key)&&email){
   try{
     const existing=await db.from("collector_network_submissions").select("id").ilike("email",email).neq("status","superseded").limit(1);
     if(existing.error)throw existing.error;
     if(!existing.data?.length){
       const joined=await db.from("collector_network_submissions").insert({
         full_name:[first,last].filter(Boolean).join(" ")||clean(payload.contact_name)||clean(payload.legal_business_name)||email,
         email,phone:phone||null,company_name:clean(payload.legal_business_name||payload.business_name)||null,
         status:"new",availability_status:"inactive",
         internal_notes:"House Lab Account intake referral. Certification and collector credentials require verification before approval.",
         application_details:{source:"house_lab_account_intake",intake_submission_id:id,certification_verified:false,referral_only:true}
       });
       if(joined.error)throw joined.error;
     }
   }catch(e){console.error("Lab intake collector referral failed",e instanceof Error?e.message:"unknown")}
 }
 const isLabIntake=["lab_account_intake_standalone","lab_account_intake"].includes(form.form_key);
 const emailEscape=(x:any)=>clean(x).replace(/[&<>"']/g,(c:string)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]||c));
 const branded=(heading:string,intro:string,detail:string,buttonLabel:string,buttonUrl:string)=>'<div style="margin:0;padding:32px 15px;background:#f2f6fb;font-family:Arial,sans-serif;color:#183a61"><table role="presentation" style="width:100%;max-width:620px;margin:auto;border-collapse:separate;border-spacing:0;background:#fff;border:1px solid #dbe5ef;border-radius:14px"><tr><td style="padding:24px 30px;background:#12345b"><img src="https://elpbnytpciqnbexiaebp.supabase.co/storage/v1/object/public/enterprise_branding/workforce2.png" alt="Workforce | screenings4u" width="260" style="display:block;max-width:100%;height:auto"></td></tr><tr><td style="padding:30px"><div style="font-size:12px;font-weight:800;letter-spacing:1px;color:#ea6900">WORKFORCE | SCREENINGS4U</div><h1 style="font-size:25px;line-height:1.3;color:#12345b">'+heading+'</h1><p style="font-size:15px;line-height:1.6">'+intro+'</p><p style="font-size:14px;line-height:1.6">'+detail+'</p><p style="margin:25px 0"><a href="'+buttonUrl+'" style="display:inline-block;background:#f36b00;color:white;text-decoration:none;padding:13px 18px;border-radius:8px;font-size:14px;font-weight:bold">'+buttonLabel+'</a></p></td></tr><tr><td style="padding:16px 30px;background:#f7f9fc;color:#61758b;font-size:12px">Workforce | screenings4u · Lab Account</td></tr></table></div>';
 const reference=emailEscape(num),sender=emailEscape([first,last].filter(Boolean).join(" ")||"Customer"),business=emailEscape(payload.legal_business_name||"");
 const adminHtml=branded("New Lab Account Intake","A new Lab Account intake has been submitted.",'<strong>Submission:</strong> '+reference+'<br><strong>Business:</strong> '+business+'<br><strong>Submitted by:</strong> '+sender+'<br><strong>Email:</strong> '+emailEscape(email),"Review Intake","https://enterprise.screenings4u.com/");
 const customerHtml=branded("Lab Account Intake Received","Thank you. We received your Lab Account intake and will review the information provided.",'<strong>Submission:</strong> '+reference+'<br><strong>Business:</strong> '+business+'<br>Keep this submission number for your records.',"Continue to Dashboard","https://lab-account.screenings4u.com/dashboard.html");
 const notices=[];
 for(const to of form.notification_emails||[]){
   const result=isLabIntake?await sendEmail(to,"Workforce | screenings4u — New Lab Account Intake "+num,adminHtml):await sendEmail(to,`New form submission: ${form.title}`,`<div style="font-family:Arial,sans-serif;color:#102a52"><h2>New ${form.title} submission</h2><p><strong>Submission:</strong> ${num}</p><p><strong>Submitted by:</strong> ${[first,last].filter(Boolean).join(" ")||"Anonymous"}</p><p><strong>Email:</strong> ${email||"—"}</p><p>Open Forms Management in screenings4u Enterprise to review the complete submission.</p></div>`);notices.push({to,...result});
 }
 if(isLabIntake&&email){const confirmation=await sendEmail(email,"Workforce | screenings4u — Lab Account Intake Confirmation "+num,customerHtml);notices.push({to:email,type:"customer_confirmation",...confirmation});}
 return R({ok:true,submissionId:insert.data.id,submissionNumber:insert.data.submission_number,labIntakeId:labIntake?.id||null,orderId:relatedOrderId||null,successMessage:form.success_message,portalUrl:customerUserId?"https://customers.screenings4u.com/":null,requiresFileUpload:fields.some((f:any)=>f.type==="file"),notificationResults:notices});
}catch(e){console.error("public-form-submit",e);return R({error:e instanceof Error?e.message:String(e)},500)}});