import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const J=(x:any,n=200)=>new Response(JSON.stringify(x),{status:n,headers:H});
const str=(x:any)=>String(x??"").trim();
const esc=(x:any)=>str(x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:H});if(req.method!=="POST")return J({error:"Method not allowed"},405);
try{const url=Deno.env.get("SUPABASE_URL")||"",pub=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,""),auth=createClient(url,pub,{auth:{persistSession:false}}),db=createClient(url,svc,{auth:{persistSession:false}});
const {data:{user},error}=await auth.auth.getUser(token);if(error||!user)return J({error:"Authentication required"},401);
const requestBody=await req.json().catch(()=>({}));if(String(requestBody.action||"")==="my_orders"){
 const email=String(user.email||"").trim().toLowerCase();
 if(!email||!user.email_confirmed_at)return J({error:"Verified email required"},403);
 const q=await db.from("testing_work_orders").select("id,work_order_number,work_order_title,status,business_surface,requested_date,site_name,city,state,total,currency,sent_at").ilike("contact_email",email).in("status",["sent","accepted","scheduled","in_progress","completed"]).order("sent_at",{ascending:false}).limit(150);
 if(q.error)throw q.error;
 return J({work_orders:q.data||[]});
}
if(String(requestBody.action||"")==="my_order"){
 const email=String(user.email||"").trim().toLowerCase(),id=String(requestBody.id||"");
 if(!email||!user.email_confirmed_at)return J({error:"Verified email required"},403);
 const q=await db.from("testing_work_orders").select("id,work_order_number,work_order_title,status,business_surface,contact_name,company_name,site_name,address_line_1,city,state,postal_code,requested_date,requested_start_time,timezone,special_instructions,terms_and_conditions,subtotal,travel_fee,other_fees,total,currency").eq("id",id).ilike("contact_email",email).in("status",["sent","accepted","scheduled","in_progress","completed"]).maybeSingle();
 if(q.error)throw q.error;if(!q.data)return J({error:"Work order not found"},404);
 const items=await db.from("testing_work_order_services").select("service_name,service_description,quantity,unit_price,line_total").eq("work_order_id",id).order("sort_order");if(items.error)throw items.error;
 return J({work_order:q.data,services:items.data||[]});
}
if(["staff_my_orders","staff_work_order","staff_progress_save","staff_progress_upload_url","staff_progress_attach"].includes(String(requestBody.action||""))){
 const active=await db.from("staff_profiles").select("user_id").eq("user_id",user.id).eq("employment_status","active").maybeSingle();
 if(active.error)throw active.error;if(!active.data)return J({error:"Active staff access required"},403);
 const assigned=await db.from("testing_work_orders").select("id,work_order_number,work_order_title,status,company_name,contact_name,contact_phone,contact_email,site_name,address_line_1,city,state,postal_code,requested_date,requested_start_time,requested_end_time,donor_count,work_order_type,special_instructions,terms_and_conditions,metadata").contains("metadata",{assigned_staff_user_id:user.id}).order("created_at",{ascending:false}).limit(200);
 if(assigned.error)throw assigned.error;
 const visible=(assigned.data||[]).filter((x:any)=>!x.metadata?.management_deleted_at);
 const safe=(w:any)=>({id:w.id,work_order_number:w.work_order_number,work_order_title:w.work_order_title,status:w.status,company_name:w.company_name,contact_name:w.contact_name,contact_phone:w.contact_phone,site_name:w.site_name,address_line_1:w.address_line_1,city:w.city,state:w.state,postal_code:w.postal_code,requested_date:w.requested_date,requested_start_time:w.requested_start_time,requested_end_time:w.requested_end_time,donor_count:w.donor_count,work_order_type:w.work_order_type,special_instructions:w.special_instructions,terms_and_conditions:w.terms_and_conditions,operational_details:w.metadata?.operational_details||{},progress:w.metadata?.staff_progress||{}});
 if(requestBody.action==="staff_my_orders")return J({work_orders:visible.map(safe)});
 const id=str(requestBody.id),w=visible.find((x:any)=>x.id===id);if(!w)return J({error:"Work order not assigned to you"},403);
 if(requestBody.action==="staff_work_order"){
  const items=await db.from("testing_work_order_services").select("service_name,service_description,quantity").eq("work_order_id",id).order("sort_order");if(items.error)throw items.error;
  return J({work_order:safe(w),services:items.data||[]});
 }
 if(["completed","cancelled"].includes(w.status))return J({error:"Work order is finalized"},409);
 if(requestBody.action==="staff_progress_upload_url"){
  const mime=str(requestBody.mime);if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(mime))return J({error:"Unsupported upload type"},400);
  const ext=mime==="application/pdf"?"pdf":mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
  const path="staff-completion/"+id+"/"+user.id+"/"+crypto.randomUUID()+"."+ext;
  const t=await db.storage.from("testing-private-documents").createSignedUploadUrl(path);if(t.error)throw t.error;return J({bucket:"testing-private-documents",path,token:t.data.token});
 }
 const progress={...(w.metadata?.staff_progress||{})},now=new Date().toISOString();
 if(requestBody.action==="staff_progress_attach"){
  const path=str(requestBody.path);
  if(!path.startsWith("staff-completion/"+id+"/"+user.id+"/"))return J({error:"Invalid document path"},400);
  const file=path.split("/").pop();const files=await db.storage.from("testing-private-documents").list("staff-completion/"+id+"/"+user.id,{limit:100});if(files.error)throw files.error;
  if(!files.data?.some((x:any)=>x.name===file))return J({error:"Document not found"},404);
  progress.documents=[...(Array.isArray(progress.documents)?progress.documents:[]),{path,uploaded_at:now}].slice(-30);
 }else{
  const step=str(requestBody.step),note=str(requestBody.note).slice(0,3000);
  if(!["accept","start","note","submit"].includes(step))return J({error:"Invalid step"},400);
  if(step==="accept")progress.accepted_at=progress.accepted_at||now;
  if(step==="start"){if(!progress.accepted_at)return J({error:"Accept assignment first"},409);progress.started_at=progress.started_at||now;}
  if(step==="note"){if(!note)return J({error:"Note required"},400);progress.notes=[...(Array.isArray(progress.notes)?progress.notes:[]),{text:note,at:now}].slice(-100);}
  if(step==="submit"){if(!progress.started_at)return J({error:"Start the job first"},409);progress.submitted_at=now;progress.review_status="pending";progress.completion_notes=note;}
 }
 progress.updated_at=now;
 const staffUpdates:any={metadata:{...(w.metadata||{}),staff_progress:progress},updated_at:now};if(requestBody.step==="start")staffUpdates.status="in_progress";const up=await db.from("testing_work_orders").update(staffUpdates).eq("id",id);
 if(up.error)throw up.error;
 await db.from("testing_work_order_events").insert({work_order_id:id,event_type:"staff_"+(requestBody.step||"document_uploaded"),actor_user_id:user.id,notes:"Staff work order progress saved"}).then(({error}:any)=>{if(error)console.error("staff work order event",error)});
 return J({ok:true,progress});
}
const [staff,roles]=await Promise.all([db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1)]);
if(staff.error||roles.error||staff.data?.employment_status!=="active"||!roles.data?.length)return J({error:"Staff access required"},403);
const b=requestBody,action=str(b.action||"list");
if(action==="list"){let all:any[]=[];for(let from=0;from<100000;from+=1000){const page=await db.from("testing_work_orders").select("*").order("created_at",{ascending:false}).range(from,from+999);if(page.error)throw page.error;all.push(...(page.data||[]));if((page.data||[]).length<1000)break;}const d=await db.from("management_work_order_deliveries").select("*").order("created_at",{ascending:false}).limit(500);if(d.error)throw d.error;return J({work_orders:all.filter((w:any)=>!w.metadata?.management_deleted_at),deliveries:d.data||[]});}
if(action==="assignees"){
 const [ic,staffList]=await Promise.all([db.from("collector_network_submissions").select("id,full_name,email,city,state,zip_code,service_areas,certifications,availability_status,collector_type").eq("status","approved").order("full_name").limit(500),db.from("staff_profiles").select("user_id,employee_number,job_title").eq("employment_status","active").limit(500)]);
 if(ic.error||staffList.error)throw ic.error||staffList.error;
 const staffNames=await Promise.all((staffList.data||[]).map(async(x:any)=>{const u=await db.auth.admin.getUserById(x.user_id);return {id:x.user_id,name:String(u.data?.user?.user_metadata?.full_name||u.data?.user?.email||x.employee_number||x.user_id),email:u.data?.user?.email||"",job_title:x.job_title}}));
 return J({contractors:ic.data||[],staff:staffNames});
}
if(action==="ic_invite_many"){
 const id=str(b.id),collectorIds=[...new Set((Array.isArray(b.collector_ids)?b.collector_ids:[]).map(str))];
 if(!/^[0-9a-f-]{36}$/i.test(id)||!collectorIds.length||collectorIds.length>30||collectorIds.some(x=>!/^[0-9a-f-]{36}$/i.test(x)))return J({error:"Select 1–30 valid collectors"},400);
 const job=await db.from("testing_work_orders").select("id,work_order_number,work_order_title,status").eq("id",id).maybeSingle();if(job.error)throw job.error;if(!job.data||!["draft","ready_to_assign","sent"].includes(job.data.status))return J({error:"Save a dispatch-ready work order first"},409);
 const people=await db.from("collector_network_submissions").select("id,full_name,email,status").in("id",collectorIds);if(people.error)throw people.error;if((people.data||[]).length!==collectorIds.length||(people.data||[]).some((x:any)=>x.status!=="approved"||!x.email))return J({error:"Every invited collector must have an approved profile and email"},409);
 const results:any[]=[];
 for(const person of people.data||[]){
  const existing=await db.from("testing_work_order_assignments").select("id,status").eq("work_order_id",id).eq("collector_id",person.id).in("status",["pending","pending_admin_review","awarded"]).limit(1);if(existing.error)throw existing.error;if(existing.data?.length){results.push({collector_id:person.id,status:"already_invited"});continue}
  const token=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(crypto.randomUUID()+crypto.randomUUID())))).map(x=>x.toString(16).padStart(2,"0")).join("");
  const added=await db.from("testing_work_order_assignments").insert({work_order_id:id,collector_id:person.id,status:"pending",response_token_hash:token,sent_to_email:person.email,sent_at:new Date().toISOString()}).select("id").single();if(added.error)throw added.error;
  const key=Deno.env.get("RESEND_API_KEY")||"";let delivery="unavailable";
  if(key){const link="https://independent-contractor.screenings4u.com/work-orders.html?assignment="+encodeURIComponent(added.data.id);
   const html='<div style="font-family:Arial,sans-serif;background:#f3f6fa;padding:28px"><div style="max-width:600px;margin:auto;background:white;border-radius:12px;padding:26px;border-top:5px solid #f07822"><img alt="screenings4u" src="https://independent-contractor.screenings4u.com/images/logo.png" width="190"><h2>New Work Order Available for Review</h2><p>'+esc(job.data.work_order_number)+' — '+esc(job.data.work_order_title)+'</p><p>This is an invitation to review; acceptance does not guarantee award.</p><a style="background:#24548d;color:white;padding:14px 18px;text-decoration:none;border-radius:8px;display:inline-block" href="'+link+'">Review Work Order</a></div></div>';
   try{const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("RESEND_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[person.email],subject:"screenings4u Work Order "+job.data.work_order_number,html})});delivery=response.ok?"sent":"failed"}catch{delivery="failed"}
  }
  await db.from("testing_work_order_events").insert({work_order_id:id,event_type:"ic_invited",actor_type:"admin",actor_user_id:user.id,collector_id:person.id,notes:"Invitation created: "+delivery});
  results.push({collector_id:person.id,assignment_id:added.data.id,delivery});
 }
 await db.from("testing_work_orders").update({status:"sent",sent_at:new Date().toISOString(),updated_by:user.id}).eq("id",id).in("status",["draft","ready_to_assign","sent"]);
 return J({ok:true,results});
}
if(action==="ic_review_queue"){
 const q=await db.from("testing_work_order_assignments").select("id,work_order_id,collector_id,status,responded_at,metadata,offered_amount").in("status",["pending_admin_review","awarded","denied"]).order("responded_at",{ascending:false}).limit(250);if(q.error)throw q.error;
 const ids=[...new Set((q.data||[]).map((x:any)=>x.work_order_id))],collectorIds=[...new Set((q.data||[]).map((x:any)=>x.collector_id))];
 const [jobs,people]=await Promise.all([ids.length?db.from("testing_work_orders").select("id,work_order_number,work_order_title,company_name,requested_date,requested_start_time,city,state").in("id",ids):Promise.resolve({data:[],error:null}),collectorIds.length?db.from("collector_network_submissions").select("id,full_name,email,city,state").in("id",collectorIds):Promise.resolve({data:[],error:null})]);
 if(jobs.error||people.error)throw jobs.error||people.error;
 return J({candidates:(q.data||[]).map((x:any)=>({...x,job:(jobs.data||[]).find((y:any)=>y.id===x.work_order_id),collector:(people.data||[]).find((y:any)=>y.id===x.collector_id)}))});
}
if(action==="ic_award"||action==="ic_deny"){
 const aid=str(b.assignment_id);if(!/^[0-9a-f-]{36}$/i.test(aid))return J({error:"Invalid assignment"},400);
 const a=await db.from("testing_work_order_assignments").select("id,work_order_id,collector_id,status,metadata").eq("id",aid).maybeSingle();
 if(a.error)throw a.error;if(!a.data||a.data.status!=="pending_admin_review")return J({error:"Contractor not ready for admin review"},409);
 if(action==="ic_deny"){
  const result=await db.from("testing_work_order_assignments").update({status:"denied",updated_at:new Date().toISOString()}).eq("id",aid).eq("status","pending_admin_review").select("id").maybeSingle();if(result.error)throw result.error;if(!result.data)return J({error:"Review changed"},409);
  await db.from("testing_work_order_events").insert({work_order_id:a.data.work_order_id,event_type:"collector_denied",actor_type:"admin",actor_user_id:user.id,collector_id:a.data.collector_id,notes:str(b.reason).slice(0,1000)});
  return J({ok:true});
 }
 const collector=await db.from("collector_network_submissions").select("email,status").eq("id",a.data.collector_id).maybeSingle();if(collector.error)throw collector.error;if(!collector.data||collector.data.status!=="approved")return J({error:"Collector profile is not approved"},409);
 const profiles=await db.from("user_profiles").select("id").ilike("email",collector.data.email).limit(10);if(profiles.error)throw profiles.error;
 const today=new Date().toISOString().slice(0,10);let insured=false;
 for(const prof of profiles.data||[]){
  const docs=await db.from("ic_portal_documents").select("id,document_type,status,expires_on").eq("contractor_user_id",prof.id).in("status",["verified","approved"]).limit(100);if(docs.error)throw docs.error;
  if((docs.data||[]).some((d:any)=>/professional.?liability/i.test(d.document_type||"")&&d.expires_on&&d.expires_on>=today)){insured=true;break}
 }
 if(!insured)return J({error:"Valid verified Professional Liability insurance must be on file before award"},409);
 const won=await db.rpc("ic_award_work_order",{p_work_order_id:a.data.work_order_id,p_assignment_id:aid,p_admin_user_id:user.id});if(won.error)return J({error:won.error.message||"Could not award work order"},409);
 const key=Deno.env.get("RESEND_API_KEY")||"";if(key){const link="https://independent-contractor.screenings4u.com/work-orders.html?assignment="+encodeURIComponent(aid);const html='<div style="font:15px Arial;background:#f3f6fa;padding:25px"><div style="max-width:570px;margin:auto;background:#fff;padding:25px;border-top:5px solid #ef7627"><img alt="screenings4u" width="180" src="https://independent-contractor.screenings4u.com/images/logo.png"><h2>Your Work Order Has Been Awarded</h2><p>You have been officially selected for this work order. Review the work order and start only when ready.</p><a href="'+link+'" style="display:inline-block;background:#23558a;color:white;padding:12px 18px;border-radius:8px;text-decoration:none">View Approved Work Order</a></div></div>';try{await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from:Deno.env.get("RESEND_FROM_EMAIL")||"screenings4u <notifications@screenings4u.com>",to:[collector.data.email],subject:"screenings4u Work Order Awarded",html})})}catch(e){console.error("Award email failed",e)}}
 return J({ok:true,award:won.data});
}
if(action==="assign"){
 const id=str(b.id),kind=str(b.kind),assignee=str(b.assignee_id);
 if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[0-9a-f-]{36}$/i.test(assignee)||!["ic","staff"].includes(kind))return J({error:"Invalid assignment"},400);
 const order=await db.from("testing_work_orders").select("id,status,metadata").eq("id",id).maybeSingle();if(order.error)throw order.error;if(!order.data||order.data.metadata?.management_deleted_at)return J({error:"Work order not found"},404);
 if(["completed","cancelled"].includes(order.data.status))return J({error:"Cannot assign finalized work order"},409);
 if(kind==="ic")return J({error:"ICs must be invited for management review through Collector Search. Direct award is disabled."},409);
{
  const person=await db.from("staff_profiles").select("user_id").eq("user_id",assignee).eq("employment_status","active").maybeSingle();if(person.error)throw person.error;if(!person.data)return J({error:"Active staff member not found"},404);
  const priorStaff=str(order.data.metadata?.assigned_staff_user_id);const md={...(order.data.metadata||{}),assigned_staff_user_id:assignee,assigned_staff_at:new Date().toISOString(),staff_progress:priorStaff===assignee?(order.data.metadata?.staff_progress||{}):{}};
  const upd=await db.from("testing_work_orders").update({metadata:md,updated_by:user.id}).eq("id",id);if(upd.error)throw upd.error;
 }
 if(kind==="staff"){const notice=await db.from("notifications").insert({recipient_user_id:assignee,channel:"in_app",status:"sent",subject:"New Staff Work Order",body:"A work order has been assigned to you. View the details and complete your tasks in your staff work-order portal.",sent_at:new Date().toISOString(),metadata:{work_order_id:id,link:"https://app.screenings4u.com/staff-work-order.html",notification_type:"staff_work_order"}});if(notice.error)console.error("Staff work order notification",notice.error);}
 await db.from("testing_work_order_events").insert({work_order_id:id,event_type:"assignment_created",actor_user_id:user.id,notes:"Assigned to "+kind+" "+assignee});
 return J({ok:true});
}
if(action==="delete"){
 const id=str(b.id);if(!/^[0-9a-f-]{36}$/i.test(id))return J({error:"Invalid work order"},400);
 const existing=await db.from("testing_work_orders").select("id,metadata,status").eq("id",id).maybeSingle();
 if(existing.error)throw existing.error;if(!existing.data)return J({error:"Work order not found"},404);
 if(existing.data.metadata?.management_deleted_at)return J({ok:true});
 const metadata={...(existing.data.metadata||{}),management_deleted_at:new Date().toISOString(),management_deleted_by:user.id};
 const saved=await db.from("testing_work_orders").update({metadata,updated_by:user.id,updated_at:new Date().toISOString()}).eq("id",id);
 if(saved.error)throw saved.error;
 await db.from("testing_work_order_events").insert({work_order_id:id,event_type:"management_deleted",actor_user_id:user.id,notes:"Removed from management work order list (audit record retained)"});
 return J({ok:true});
}
if(action==="save"){const v=b.work_order||{},id=str(v.id),title=str(v.work_order_title),email=str(v.contact_email).toLowerCase();if(!title||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return J({error:"Title and valid email required"},400);
const surface=str(v.business_surface);if(!["dot","workforce"].includes(surface))return J({error:"Choose DOT or NON-DOT"},400);
const items=Array.isArray(v.services)?v.services.slice(0,60):[];
const services=items.map((x:any,i:number)=>({service_name:str(x.service_name),service_description:str(x.service_description),quantity:Math.max(0,Number(x.quantity)||1),unit_price:Math.max(0,Number(x.unit_price)||0),sort_order:i})).filter((x:any)=>x.service_name);
const subtotal=services.reduce((sum:number,x:any)=>sum+x.quantity*x.unit_price,0),travel=Math.max(0,Number(v.travel_fee)||0),fees=Math.max(0,Number(v.other_fees)||0);
const row:any={work_order_title:title,business_surface:surface,work_order_type:str(v.work_order_type||"general_service"),contact_email:email,contact_name:str(v.contact_name),contact_phone:str(v.contact_phone),company_name:str(v.company_name),organization_id:str(v.organization_id)||null,site_name:str(v.site_name),address_line_1:str(v.address_line_1)||"To be confirmed",city:str(v.city)||"To be confirmed",state:str(v.state)||"N/A",postal_code:str(v.postal_code),requested_date:v.requested_date||null,requested_start_time:v.requested_start_time||null,requested_end_time:v.requested_end_time||null,timezone:str(v.timezone||"America/Chicago"),special_instructions:str(v.special_instructions),terms_and_conditions:str(v.terms_and_conditions),internal_notes:str(v.internal_notes),testing_purpose:str(v.testing_purpose),donor_count:Math.max(1,Number(v.donor_count)||1),travel_fee:travel,other_fees:fees,subtotal,total:subtotal+travel+fees,updated_by:user.id,updated_at:new Date().toISOString(),metadata:{...(id?((await db.from("testing_work_orders").select("metadata").eq("id",id).maybeSingle()).data?.metadata||{}):{}),...((v.operational_details&&typeof v.operational_details==="object")?{operational_details:v.operational_details}:{})}};
if(row.organization_id){const org=await db.from("organizations").select("id").eq("id",row.organization_id).maybeSingle();if(org.error||!org.data)return J({error:"Organization not found"},400);}
const prior=id?await db.from("testing_work_orders").select("status").eq("id",id).maybeSingle():null;if(prior?.error)throw prior.error;if(id&&!prior?.data)return J({error:"Work order not found"},404);
if(id&&["accepted","completed","cancelled"].includes(prior.data.status))return J({error:"Cannot edit a finalized work order"},409);
const result=id?await db.from("testing_work_orders").update(row).eq("id",id).select("*").single():await db.from("testing_work_orders").insert({...row,created_by:user.id,status:"draft"}).select("*").single();if(result.error)throw result.error;
const order=result.data;
const del=await db.from("testing_work_order_services").delete().eq("work_order_id",order.id);if(del.error)throw del.error;
if(services.length){const sr=await db.from("testing_work_order_services").insert(services.map((x:any)=>({...x,work_order_id:order.id,line_total:x.quantity*x.unit_price})));if(sr.error)throw sr.error;}
await db.from("testing_work_order_events").insert({work_order_id:order.id,event_type:id?"updated":"created",actor_user_id:user.id,notes:"Managed from IC work orders"});
return J({work_order:order});}
if(action==="photo_upload"){const id=str(b.id),filename=str(b.filename),mime=str(b.mime);if(!/^[0-9a-f-]{36}$/i.test(id)||!/^image\/(jpeg|png|webp)$/.test(mime))return J({error:"Valid work order and JPEG, PNG or WebP required"},400);const found=await db.from("testing_work_orders").select("id,status").eq("id",id).maybeSingle();if(found.error)throw found.error;if(!found.data)return J({error:"Work order not found"},404);if(!["draft","ready_to_assign","sent"].includes(found.data.status))return J({error:"Work order no longer editable"},409);const ext=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";const path="work-orders/"+id+"/references/"+crypto.randomUUID()+"."+ext;const sign=await db.storage.from("testing-private-documents").createSignedUploadUrl(path);if(sign.error)throw sign.error;return J({path,token:sign.data.token,bucket:"testing-private-documents"})}
if(action==="photo_attach"){const id=str(b.id),path=str(b.path);if(!/^[0-9a-f-]{36}$/i.test(id)||!path.startsWith("work-orders/"+id+"/references/"))return J({error:"Invalid photo"},400);const row=await db.from("testing_work_orders").select("metadata,status").eq("id",id).maybeSingle();if(row.error)throw row.error;if(!row.data||!["draft","ready_to_assign","sent"].includes(row.data.status))return J({error:"Work order cannot be edited"},409);const photos=Array.isArray(row.data.metadata?.reference_photos)?row.data.metadata.reference_photos:[];if(photos.length>=20)return J({error:"Maximum 20 reference photos"},400);const next={...(row.data.metadata||{}),reference_photos:[...photos,{path,added_at:new Date().toISOString()}]};const up=await db.from("testing_work_orders").update({metadata:next}).eq("id",id);if(up.error)throw up.error;return J({ok:true})}
if(action==="photo_view"){const id=str(b.id),path=str(b.path);if(!path.startsWith("work-orders/"+id+"/references/"))return J({error:"Invalid file"},400);const order=await db.from("testing_work_orders").select("metadata").eq("id",id).maybeSingle();if(order.error)throw order.error;if(!order.data?.metadata?.reference_photos?.some((x:any)=>x.path===path))return J({error:"Attachment not found"},404);const signed=await db.storage.from("testing-private-documents").createSignedUrl(path,120);if(signed.error)throw signed.error;return J({url:signed.data.signedUrl})}
if(action==="staff_review_decision"){
 const id=str(b.id),decision=str(b.decision),note=str(b.note).slice(0,2000);
 if(!["approve","corrections"].includes(decision))return J({error:"Invalid decision"},400);
 if(decision==="corrections"&&!note)return J({error:"Correction instructions required"},400);
 const q=await db.from("testing_work_orders").select("metadata,status").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)return J({error:"Work order not found"},404);
 const prev=q.data.metadata?.staff_progress||{};if(!prev.submitted_at)return J({error:"Staff member has not submitted work"},409);
 const next={...prev,review_status:decision==="approve"?"approved":"corrections_required",review_note:note,reviewed_by:user.id,reviewed_at:new Date().toISOString()};
 const up=await db.from("testing_work_orders").update({metadata:{...q.data.metadata,staff_progress:next},status:decision==="approve"?"completed":"in_progress",completed_at:decision==="approve"?new Date().toISOString():null,updated_by:user.id}).eq("id",id);if(up.error)throw up.error;
 await db.from("testing_work_order_events").insert({work_order_id:id,event_type:"staff_review_"+decision,actor_user_id:user.id,notes:note||"Staff completion approved"});
 return J({ok:true,review_status:next.review_status});
}
if(action==="staff_review_document"){
 const id=str(b.id),path=str(b.path);const q=await db.from("testing_work_orders").select("metadata").eq("id",id).maybeSingle();if(q.error)throw q.error;
 if(!q.data?.metadata?.staff_progress?.documents?.some((x:any)=>x.path===path))return J({error:"Document unavailable"},404);
 const signed=await db.storage.from("testing-private-documents").createSignedUrl(path,60);if(signed.error)throw signed.error;return J({url:signed.data.signedUrl});
}
if(action==="ic_review_list"){const id=str(b.id);const a=await db.from("testing_work_order_assignments").select("id,status").eq("work_order_id",id);if(a.error)throw a.error;const ids=(a.data||[]).map((x:any)=>x.id);const q=ids.length?await db.from("ic_assignment_progress").select("assignment_id,details").in("assignment_id",ids):{data:[],error:null};if(q.error)throw q.error;return J({reviews:(a.data||[]).map((x:any)=>({...x,progress:(q.data||[]).find((y:any)=>y.assignment_id===x.id)||null}))})}
if(action==="ic_review_decision"){const aid=str(b.assignment_id),decision=str(b.decision);if(!["approve","corrections"].includes(decision))return J({error:"Invalid decision"},400);const a=await db.from("testing_work_order_assignments").select("id").eq("id",aid).eq("work_order_id",str(b.id)).maybeSingle();if(a.error)throw a.error;if(!a.data)return J({error:"Assignment not found"},404);const q=await db.from("ic_assignment_progress").select("details").eq("assignment_id",aid).maybeSingle();if(q.error)throw q.error;if(!q.data?.details?.submitted_for_review_at)return J({error:"Not submitted for review"},409);const note=str(b.note).slice(0,2000);if(decision==="corrections"&&!note)return J({error:"Correction notes required"},400);const details={...q.data.details,review_status:decision==="approve"?"approved":"corrections_required",review_note:note,reviewed_by:user.id,reviewed_at:new Date().toISOString(),payment_hold:true};const r=await db.from("ic_assignment_progress").update({details,updated_at:new Date().toISOString()}).eq("assignment_id",aid);if(r.error)throw r.error;if(decision==="approve"){const updated=await db.from("testing_work_orders").update({status:"completed",completed_at:new Date().toISOString(),updated_by:user.id}).eq("id",str(b.id));if(updated.error)throw updated.error;}return J({ok:true,review_status:details.review_status})}
if(action==="ic_review_document"){const aid=str(b.assignment_id),kind=str(b.kind);if(!["donor_id","mro_copy2"].includes(kind))return J({error:"Invalid document type"},400);const a=await db.from("testing_work_order_assignments").select("id").eq("id",aid).eq("work_order_id",str(b.id)).maybeSingle();if(a.error)throw a.error;if(!a.data)return J({error:"Assignment not found"},404);const q=await db.from("ic_assignment_progress").select("details").eq("assignment_id",aid).maybeSingle();if(q.error)throw q.error;const path=q.data?.details?.[kind+"_path"];if(!path||!path.startsWith("ic-completion/"+aid+"/"+kind+"/"))return J({error:"Document not found"},404);const s=await db.storage.from("testing-private-documents").createSignedUrl(path,60);if(s.error)throw s.error;return J({url:s.data.signedUrl})}
if(action==="detail"){const id=str(b.id);const [wo,services,deliveries,events]=await Promise.all([db.from("testing_work_orders").select("*").eq("id",id).single(),db.from("testing_work_order_services").select("*").eq("work_order_id",id).order("sort_order"),db.from("management_work_order_deliveries").select("*").eq("work_order_id",id).order("created_at",{ascending:false}),db.from("testing_work_order_events").select("*").eq("work_order_id",id).order("created_at",{ascending:false})]);for(const x of [wo,services,deliveries,events])if(x.error)throw x.error;return J({work_order:wo.data,services:services.data||[],deliveries:deliveries.data||[],events:events.data||[]});}
if(action==="send"){
const id=str(b.id),q=await db.from("testing_work_orders").select("*").eq("id",id).single();if(q.error)throw q.error;const w=q.data;
if(!["draft","ready_to_assign","sent"].includes(w.status))return J({error:"Cannot send an order in this status"},409);
const services=await db.from("testing_work_order_services").select("*").eq("work_order_id",id).order("sort_order");if(services.error)throw services.error;
const email=str(w.contact_email).toLowerCase(),key=Deno.env.get("RESEND_API_KEY")||"";if(!key)return J({error:"RESEND_API_KEY not configured. No email sent."},503);
const from=Deno.env.get("RESEND_FROM_EMAIL")||Deno.env.get("EMAIL_FROM")||"screenings4u <notifications@screenings4u.com>";
const subject="screenings4u Work Order "+w.work_order_number+" — "+w.work_order_title;
const accountUsers=await db.from("user_profiles").select("id,email").ilike("email",email).limit(10);
if(accountUsers.error)throw accountUsers.error;
let portalRecipient:string|null=null;
for(const profile of accountUsers.data||[]){
 const [membership,wfm]=await Promise.all([
 db.from("organization_memberships").select("id").eq("user_id",profile.id).eq("status","active").limit(1),
 db.from("workforce_memberships").select("id").eq("user_id",profile.id).eq("status","active").limit(1)
 ]);
 if(membership.error||wfm.error)throw membership.error||wfm.error;
 if(membership.data?.length||wfm.data?.length){portalRecipient=profile.id;break}
}
const inboxUrl="https://portal.screenings4u.com/work-orders.html";
const lines=(services.data||[]).map((x:any)=>'<tr><td style="padding:10px;border-bottom:1px solid #e4e9f0">'+esc(x.service_name)+'</td><td>'+esc(x.quantity)+'</td><td>$'+Number(x.line_total).toFixed(2)+'</td></tr>').join("");
const html='<div style="background:#f4f7fb;padding:28px;font-family:Arial,sans-serif;color:#17365f"><div style="max-width:680px;margin:auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#325aa3;padding:25px;color:white;font-size:22px;font-weight:bold">screenings4u | Work Order</div><div style="padding:28px"><p>Hello '+esc(w.contact_name||"Customer")+ ',</p><p>Your work order is ready for review.</p><h2>'+esc(w.work_order_title)+'</h2><p><strong>Work order:</strong> '+esc(w.work_order_number)+'</p><p><strong>Business:</strong> '+esc(w.business_surface==="dot"?"DOT":"NON-DOT")+'</p><p><strong>Site:</strong> '+esc([w.site_name,w.address_line_1,w.city,w.state].filter(Boolean).join(", "))+'</p><p><strong>Requested date:</strong> '+esc(w.requested_date||"To be confirmed")+'</p><table style="width:100%"><tr><th align="left">Service</th><th>Qty</th><th>Amount</th></tr>'+lines+'</table><h3>Total: $'+Number(w.total||0).toFixed(2)+'</h3><p>'+esc(w.special_instructions||"")+'</p><p style="color:#667085">For any questions or changes, contact screenings4u. If you have a screenings4u portal, open your Work Orders inbox to review this order. <a href="'+inboxUrl+'" style="display:inline-block;margin:12px 0;padding:13px 20px;background:#ff6b00;color:white;text-decoration:none;border-radius:8px">View My Work Orders</a></p></div><div style="background:#ff6b00;height:6px"></div></div></div>';
const log=await db.from("management_work_order_deliveries").insert({work_order_id:id,recipient_email:email,delivery_channel:"email",delivery_status:"processing"}).select("id").single();if(log.error)throw log.error;
const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({from,to:[email],subject,html})});const replyData=await sent.json().catch(()=>({}));
await db.from("management_work_order_deliveries").update({delivery_status:sent.ok?"sent":"failed",provider_message_id:replyData.id||null,error_message:sent.ok?null:String(replyData.message||sent.status),sent_at:sent.ok?new Date().toISOString():null}).eq("id",log.data.id);
if(!sent.ok)return J({error:"Email delivery failed: "+str(replyData.message||sent.status)},502);
await db.from("testing_work_orders").update({status:"sent",sent_at:new Date().toISOString()}).eq("id",id);
if(portalRecipient){
 const nr=await db.from("notifications").insert({recipient_user_id:portalRecipient,channel:"in_app",status:"sent",subject:"New work order: "+w.work_order_number,body:"A new work order is ready to review in My Work Orders.",sent_at:new Date().toISOString(),metadata:{work_order_id:id,work_order_number:w.work_order_number,link:"https://portal.screenings4u.com/work-orders.html",notification_type:"work_order"}});
 if(nr.error)console.error("work_order_portal_notice",nr.error);
 const dr=await db.from("management_work_order_deliveries").insert({work_order_id:id,recipient_email:email,recipient_user_id:portalRecipient,portal_code:"central_work_orders",delivery_channel:"portal",delivery_status:nr.error?"failed":"sent",error_message:nr.error?String(nr.error.message):null,sent_at:nr.error?null:new Date().toISOString()});
 if(dr.error)console.error("work_order_delivery_notice",dr.error);
}
await db.from("testing_work_order_events").insert({work_order_id:id,event_type:"sent",actor_user_id:user.id,notes:"Branded work order emailed to "+email});
return J({ok:true,delivery_id:log.data.id,provider_message_id:replyData.id,portal_notification:portalRecipient?"attempted":"not_applicable"});}
return J({error:"Unsupported action"},400);
}catch(e){console.error("global-work-orders",e);return J({error:e instanceof Error?e.message:"Work order request failed"},500)}
});