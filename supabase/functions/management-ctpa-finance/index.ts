import {createClient} from "npm:@supabase/supabase-js@2";
const valid=x=>typeof x==="string"&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(x);
const txt=(x,n=180)=>String(x??"").trim().slice(0,n);
const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+"T12:00:00Z"));
Deno.serve(async req=>{
 const headers={"Access-Control-Allow-Origin":"https://app.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
 const reply=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers});
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return reply({error:"POST required"},405);
 try{
 const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
 if(!url||!anon||!secret)return reply({error:"Workforce management finance unavailable"},503);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 const {data:{user},error}=await auth.auth.getUser(token);if(error||!user?.id||!user.email_confirmed_at)return reply({error:"Sign-in required"},401);
 const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 const [profile,roles,access]=await Promise.all([
  db.from("staff_profiles").select("employment_status").eq("user_id",user.id).maybeSingle(),
  db.from("staff_role_assignments").select("id").eq("user_id",user.id).eq("active",true).limit(1),
  db.from("staff_business_access").select("access_level,assigned_customers_only").eq("user_id",user.id).in("business_unit_code",["workforce","dot"]).eq("active",true).limit(10)
 ]);
 if(profile.error||roles.error||access.error)throw profile.error||roles.error||access.error;
 const permissions=(access.data||[]).filter(x=>!x.assigned_customers_only);
 if(profile.data?.employment_status!=="active"||!roles.data?.length||!permissions.length)return reply({error:"Workforce management authorization required"},403);
 const canWrite=permissions.some(x=>["admin","manager","editor"].includes(txt(x.access_level,30).toLowerCase()));
 const body=await req.json().catch(()=>({})),action=txt(body.action,35),context=body.operating_context==="nondot"?"nondot":"dot",tenant=body.tenant_id;
 if(action==="organizations"){
  const r=await db.from("workforce_unified_records").select("tenant_id,data").eq("kind","organization").is("archived_at",null).limit(1000);
  if(r.error)throw r.error;
  return reply({ok:true,organizations:(r.data||[]).map(x=>({id:x.tenant_id,name:txt(x.data?.name||x.data?.legal_name||"C/TPA",150)})),can_write:canWrite});
 }
 if(!valid(tenant))return reply({error:"Select a C/TPA organization"},400);
 const org=await db.from("workforce_unified_records").select("id,data").eq("tenant_id",tenant).eq("kind","organization").is("archived_at",null).maybeSingle();
 if(org.error)throw org.error;if(!org.data)return reply({error:"C/TPA organization not found"},404);
 if(action==="list"){
  const [bills,settlements]=await Promise.all([
   db.from("workforce_ctpa_workforce_bills").select("*").eq("tenant_id",tenant).eq("operating_context",context).order("created_at",{ascending:false}).limit(500),
   db.from("workforce_ctpa_settlements").select("*").eq("tenant_id",tenant).eq("operating_context",context).order("created_at",{ascending:false}).limit(500)
  ]);
  if(bills.error||settlements.error)throw bills.error||settlements.error;
  return reply({ok:true,bills:bills.data||[],settlements:settlements.data||[],can_write:canWrite});
 }
 if(!canWrite)return reply({error:"Insufficient permissions to create or publish financial records"},403);
 const money=(x)=>{const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=10000000&&Math.abs(n*100-Math.round(n*100))<1e-6?Math.round(n*100):null};
 if(action==="create_bill"||action==="create_settlement"){
  if(!Array.isArray(body.items)||body.items.length<1||body.items.length>35)return reply({error:"Supply 1 to 35 itemized services"},400);
  let subtotal=0;const items=[];
  for(const raw of body.items){
   const description=txt(raw.description,240),amount=money(raw.amount);
   if(!description||amount===null)return reply({error:"Each service requires a description and valid dollar amount"},400);
   subtotal+=amount;items.push({description,amount:amount/100});
  }
  if(subtotal>1000000000)return reply({error:"Amount exceeds maximum"},400);
  const number=txt(body.number,90).toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]{3,89}$/.test(number))return reply({error:"Use a unique reference number (letters, numbers, dashes)"},400);
  if(action==="create_bill"){
   if(!date(body.issued_at)||!date(body.due_at)||body.due_at<body.issued_at)return reply({error:"Choose valid invoice dates"},400);
   const tax=money(body.tax||0),discount=money(body.discount||0);
   if(tax===null||discount===null||discount>subtotal)return reply({error:"Invalid tax or discount"},400);
   const total=subtotal+tax-discount;
   const payload={tenant_id:tenant,operating_context:context,invoice_number:number,title:txt(body.title,150)||"Workforce Invoice",issued_at:body.issued_at+"T12:00:00Z",due_at:body.due_at+"T12:00:00Z",recipient_name:txt(org.data.data?.name||org.data.data?.legal_name||"C/TPA"),items,subtotal:subtotal/100,tax:tax/100,discount:discount/100,total:total/100,amount_paid:0,currency:"usd",status:"draft",notes:txt(body.notes,1500),created_by:user.id};
   const result=await db.from("workforce_ctpa_workforce_bills").insert(payload).select("id").single();
   if(result.error){if(result.error.code==="23505")return reply({error:"An invoice with this number already exists"},409);throw result.error}
   return reply({ok:true,id:result.data.id});
  }
  if(!date(body.period_start)||!date(body.period_end)||body.period_end<body.period_start)return reply({error:"Choose a valid settlement period"},400);
  const adjustment=Number(body.adjustments||0);if(!Number.isFinite(adjustment)||Math.abs(adjustment*100-Math.round(adjustment*100))>1e-6||Math.abs(adjustment)>10000000)return reply({error:"Invalid adjustment"},400);
  const net=subtotal+Math.round(adjustment*100);if(net<0)return reply({error:"Settlement cannot be negative"},400);
  const result=await db.from("workforce_ctpa_settlements").insert({tenant_id:tenant,operating_context:context,settlement_number:number,period_start:body.period_start,period_end:body.period_end,status:"pending",items,gross:subtotal/100,adjustments:adjustment,net:net/100,notes:txt(body.notes,1500),created_by:user.id}).select("id").single();
  if(result.error){if(result.error.code==="23505")return reply({error:"Settlement number already exists"},409);throw result.error}
  return reply({ok:true,id:result.data.id});
 }
 if(!valid(body.id))return reply({error:"Select a record"},400);
 if(action==="publish_bill"){
  const result=await db.from("workforce_ctpa_workforce_bills").update({status:"open",published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",body.id).eq("tenant_id",tenant).eq("operating_context",context).eq("status","draft").select("id").maybeSingle();
  if(result.error)throw result.error;if(!result.data)return reply({error:"Invoice is not a draft or has changed"},409);return reply({ok:true});
 }
 if(action==="void_bill"){
  const invoice=await db.from("workforce_ctpa_workforce_bills").select("payment_intent_id,status,amount_paid").eq("id",body.id).eq("tenant_id",tenant).eq("operating_context",context).maybeSingle();
  if(invoice.error)throw invoice.error;
  if(!invoice.data||invoice.data.status==="paid"||Number(invoice.data.amount_paid)>0||invoice.data.payment_intent_id)return reply({error:"Invoice has payment activity; cannot void through this action"},409);
  const result=await db.from("workforce_ctpa_workforce_bills").update({status:"void",updated_at:new Date().toISOString()}).eq("id",body.id).eq("tenant_id",tenant).eq("operating_context",context).in("status",["draft","open"]).select("id").maybeSingle();
  if(result.error)throw result.error;if(!result.data)return reply({error:"Invoice changed"},409);return reply({ok:true});
 }
 if(action==="mark_settlement_paid"){
  const reference=txt(body.payment_reference,150),method=txt(body.payment_method,90);
  if(!reference||!method||!date(body.paid_at))return reply({error:"Payment date, method and actual remittance reference are required"},400);
  const result=await db.from("workforce_ctpa_settlements").update({status:"paid",paid_at:body.paid_at+"T12:00:00Z",payment_method:method,payment_reference:reference}).eq("id",body.id).eq("tenant_id",tenant).eq("operating_context",context).eq("status","pending").select("id").maybeSingle();
  if(result.error)throw result.error;if(!result.data)return reply({error:"Settlement is not pending"},409);return reply({ok:true});
 }
 return reply({error:"Unknown management finance operation"},400);
 }catch(err){console.error("management-ctpa-finance",err);return reply({error:"Unable to manage Workforce financial records"},500)}
});