import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2";
const headers={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const J=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers});
const tableFor=(v:string)=>v==="dot"?"subscriptions":v==="nondot"?"workforce_subscriptions":null;
const safeDate=(n:any)=>typeof n==="number"&&n>0?new Date(n*1000).toISOString():null;
async function stripe(secret:string,path:string,method="GET",params?:URLSearchParams,key?:string){
 const h:Record<string,string>={Authorization:"Bearer "+secret};
 if(params)h["Content-Type"]="application/x-www-form-urlencoded";
 if(key)h["Idempotency-Key"]=key;
 const r=await fetch("https://api.stripe.com/v1/"+path,{method,headers:h,body:params?.toString()});
 const json=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(json.error?.message||"Stripe request failed");
 return json;
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers});
 if(req.method!=="POST")return J({error:"POST required"},405);
 try{
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return J({error:"Staff sign-in required"},401);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=createClient(url,anon,{auth:{persistSession:false}}),db=createClient(url,service,{auth:{persistSession:false}});
 const u=await auth.auth.getUser(token);if(u.error||!u.data.user)return J({error:"Invalid staff session"},401);
 const uid=u.data.user.id;
 const profile=await db.from("staff_profiles").select("employment_status").eq("user_id",uid).maybeSingle();
 if(profile.error)throw profile.error;if(profile.data?.employment_status!=="active")return J({error:"Active staff membership required"},403);
 const roles=await db.from("staff_role_assignments").select("role_code").eq("user_id",uid).eq("active",true);
 if(roles.error)throw roles.error;
 const codes=(roles.data||[]).map((x:any)=>x.role_code);
 if(!codes.length)return J({error:"Finance management permission required"},403);
 const perm=await db.from("staff_role_permissions").select("permission_key").in("role_code",codes).eq("allowed",true).eq("permission_key","finance.all.manage").limit(1);
 if(perm.error)throw perm.error;
 if(!perm.data?.length)return J({error:"Finance management permission required"},403);
 const body=await req.json().catch(()=>({}));
 const workspace=String(body.workspace||"");const table=tableFor(workspace);
 if(!table)return J({error:"Valid DOT or NON-DOT workspace required"},400);
 const access=await db.from("staff_business_access").select("id").eq("user_id",uid).eq("active",true).eq("business_unit_code",workspace==="dot"?"dot":"workforce").limit(1);
 if(access.error)throw access.error;if(!access.data?.length)return J({error:"Workspace staff access required"},403);
 const action=String(body.action||"preview");
 if(action==="plans"){const plansTable=workspace==="dot"?"plans":"workforce_plans";const q=await db.from(plansTable).select("id,name,monthly_price").eq("active",true).order("name");if(q.error)throw q.error;return J({ok:true,plans:q.data||[]})}
 if(action==="list"){
   const page=Math.max(0,Math.min(10000,Math.floor(Number(body.page)||0)));
   const pageSize=50;
   const countQuery=await db.from(table).select("id",{count:"exact",head:true});
   if(countQuery.error)throw countQuery.error;
   const found=await db.from(table).select("id,tenant_id,employer_id,plan_id,status,created_at,renewal_date,billing_frequency,stripe_subscription_id,stripe_current_period_end,cancel_at_period_end").order("created_at",{ascending:false}).range(page*pageSize,page*pageSize+pageSize-1);
   if(found.error)throw found.error;
   const planTable=workspace==="dot"?"plans":"workforce_plans";
   const plans=await db.from(planTable).select("id,name,monthly_price");
   if(plans.error)throw plans.error;
   const byPlan=new Map((plans.data||[]).map((p:any)=>[p.id,p]));
   return J({ok:true,records:(found.data||[]).map((r:any)=>({...r,plan_name:byPlan.get(r.plan_id)?.name||"Unassigned plan",monthly_price:byPlan.get(r.plan_id)?.monthly_price??null})),total:countQuery.count||0,page,page_size:pageSize});
 }
 const id=String(body.subscription_id||"");
 if(!/^[a-f0-9-]{36}$/i.test(id))return J({error:"Valid subscription ID required"},400);
 const local=await db.from(table).select("*").eq("id",id).maybeSingle();
 if(local.error)throw local.error;if(!local.data)return J({error:"Subscription not found"},404);
 const rec=local.data;
 const action=String(body.action||"preview");
 if(!rec.stripe_subscription_id)return J({error:"This subscription is not linked to Stripe. Billing changes are blocked to avoid creating a second subscription.",code:"STRIPE_NOT_LINKED"},409);
 const secret=Deno.env.get("STRIPE_SECRET_KEY");
 if(!secret)return J({error:"Stripe integration secret is not configured"},503);
 const stripeSub=await stripe(secret,"subscriptions/"+encodeURIComponent(rec.stripe_subscription_id));
 if(stripeSub.id!==rec.stripe_subscription_id)return J({error:"Stripe subscription mismatch"},409);
 if(rec.stripe_customer_id&&stripeSub.customer!==rec.stripe_customer_id)return J({error:"Stripe customer mismatch"},409);
 const summary=(s:any)=>({id:s.id,status:s.status,cancel_at_period_end:!!s.cancel_at_period_end,current_period_end:safeDate(s.current_period_end||s.items?.data?.[0]?.current_period_end),items:(s.items?.data||[]).map((x:any)=>({id:x.id,price_id:x.price?.id,amount:x.price?.unit_amount,currency:x.price?.currency,interval:x.price?.recurring?.interval}))});
 if(action==="preview")return J({local:{id:rec.id,status:rec.status,plan_id:rec.plan_id,renewal_date:rec.renewal_date},stripe:summary(stripeSub)});
 if(!["cancel_at_period_end","resume","change_plan"].includes(action))return J({error:"Unsupported action. Renewal-date adjustments must use an approved Stripe billing schedule; no local-only billing-date change is allowed."},400);
 if(!["active","trialing","past_due"].includes(stripeSub.status))return J({error:"Subscription cannot be modified in its current Stripe status"},409);
 const operationId=String(body.operation_id||"");
 if(!/^[a-f0-9-]{36}$/i.test(operationId))return J({error:"Stable UUID operation_id required to protect against retries"},400);
 const params=new URLSearchParams();
 let newPlan:any=null,newPrice:any=null;
 if(action==="cancel_at_period_end")params.set("cancel_at_period_end","true");
 if(action==="resume")params.set("cancel_at_period_end","false");
 if(action==="change_plan"){
  const planId=String(body.plan_id||"");
  if(!/^[a-f0-9-]{36}$/i.test(planId))return J({error:"Valid plan ID required"},400);
  const plans=workspace==="dot"?"plans":"workforce_plans";
  const plan=await db.from(plans).select("*").eq("id",planId).eq("active",true).maybeSingle();
  if(plan.error)throw plan.error;if(!plan.data)return J({error:"Active destination plan not found"},404);
  newPlan=plan.data;
  const item=stripeSub.items?.data||[];
  if(item.length!==1||!item[0]?.price?.recurring)return J({error:"Complex Stripe subscriptions require manual review"},409);
  const newPriceId=String(body.stripe_price_id||"");
  if(!/^price_[a-zA-Z0-9]+$/.test(newPriceId))return J({error:"Stripe price ID required"},400);
  newPrice=await stripe(secret,"prices/"+encodeURIComponent(newPriceId));
  const old=item[0].price;
  if(!newPrice.active||!newPrice.recurring||newPrice.recurring.interval!=="month"||newPrice.recurring.interval_count!==1||old.recurring.interval!=="month"||old.recurring.interval_count!==1)return J({error:"Only monthly-to-monthly plan changes are supported without an immediate charge"},409);
  if(newPrice.currency!==old.currency||newPrice.unit_amount!==Math.round(Number(newPlan.monthly_price)*100))return J({error:"Stripe price does not match selected plan amount/currency"},409);
  params.set("items[0][id]",item[0].id);
  params.set("items[0][price]",newPrice.id);
  params.set("proration_behavior","none");
  params.set("billing_cycle_anchor","unchanged");
  params.set("payment_behavior","error_if_incomplete");
 }
 const updated=await stripe(secret,"subscriptions/"+encodeURIComponent(stripeSub.id),"POST",params,"portal-subscription-"+id+"-"+action+"-"+operationId);
 const fields:any={cancel_at_period_end:!!updated.cancel_at_period_end,stripe_current_period_end:safeDate(updated.current_period_end||updated.items?.data?.[0]?.current_period_end)};
 if(action==="change_plan"){fields.plan_id=newPlan.id;fields.stripe_price_id=newPrice.id;}
 const saved=await db.from(table).update(fields).eq("id",id).eq("stripe_subscription_id",updated.id).select("id").maybeSingle();
 if(saved.error)return J({error:"Stripe updated, but local sync failed. Reconcile from Stripe before retrying.",code:"RECONCILIATION_REQUIRED",stripe:summary(updated)},502);
 return J({ok:true,action,stripe:summary(updated),local_updated:!!saved.data});
 }catch(e){return J({error:e instanceof Error?e.message:String(e)},500)}
});