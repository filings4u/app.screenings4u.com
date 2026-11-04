import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"https://lab-account.screenings4u.com","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS","Content-Type":"application/json","Cache-Control":"no-store"};
const reply=(x:unknown,s=200)=>new Response(JSON.stringify(x),{headers:H,status:s});
Deno.serve(async req=>{
if(req.method==="OPTIONS")return new Response(null,{status:204,headers:H});if(req.method!=="POST")return reply({error:"Method not allowed"},405);
try{
const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:{user},error}=await auth.auth.getUser(token);
if(error||!user?.email_confirmed_at)return reply({error:"Verified sign in required"},401);
const entitlement=await fetch(url+"/functions/v1/lab-account-entitlement",{method:"POST",headers:{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},body:"{}"});
const grant=await entitlement.json().catch(()=>({}));
if(!entitlement.ok||grant.authorized!==true)return reply({error:"Lab Account access required"},403);
const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
const b=await req.json().catch(()=>({}));const action=String(b.action||"workspace");
const list=async()=>{
const [catalog,orders,inventory]=await Promise.all([
db.from("ic_portal_supply_items").select("id,sku,name,description,unit").eq("active",true).order("name"),
db.from("ic_portal_supply_orders").select("id,status,carrier,tracking_number,created_at,ic_portal_supply_order_lines(item_id,quantity)").eq("contractor_user_id",user.id).order("created_at",{ascending:false}).limit(100),
db.from("ic_portal_supply_inventory").select("item_id,quantity_on_hand,reorder_level").eq("contractor_user_id",user.id)
]);if(catalog.error||orders.error||inventory.error)throw catalog.error||orders.error||inventory.error;
const [owned,emailed]=await Promise.all([
 db.from("lab_account_intakes").select("id").eq("customer_user_id",user.id),
 user.email?db.from("lab_account_intakes").select("id").ilike("customer_email",user.email):Promise.resolve({data:[],error:null})
]);
if(owned.error||emailed.error)throw owned.error||emailed.error;
const ids=[...new Set([...(owned.data||[]),...(emailed.data||[])].map((x:any)=>x.id))];
let houseShipments:any[]=[];
if(ids.length){const sh=await db.from("house_lab_supply_shipments").select("id,intake_id,carrier,tracking_number,tracking_url,status,items_description,created_at,updated_at").in("intake_id",ids).order("created_at",{ascending:false}).limit(200);if(sh.error)throw sh.error;houseShipments=sh.data||[];}
return {supplies:catalog.data||[],orders:orders.data||[],inventory:inventory.data||[],houseShipments};
};
if(action==="workspace")return reply(await list());
if(action==="confirm_house_delivery"){
 if(grant.plan==="lab-account-workflow-test-1")return reply({error:"Test plans cannot receive physical shipments"},403);
 const shipmentId=String(b.id||"");
 if(!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(shipmentId))return reply({error:"Valid shipment required"},400);
 const shipment=await db.from("house_lab_supply_shipments").select("id,intake_id,status,notes").eq("id",shipmentId).maybeSingle();
 if(shipment.error)throw shipment.error;
 if(!shipment.data)return reply({error:"Shipment not found"},404);
 const purchase=await db.from("lab_account_intakes").select("id,customer_user_id,customer_email,service_sku").eq("id",shipment.data.intake_id).maybeSingle();
 if(purchase.error)throw purchase.error;
 const own=purchase.data&&(purchase.data.customer_user_id===user.id||String(purchase.data.customer_email||"").toLowerCase()===String(user.email||"").toLowerCase());
 if(!own||purchase.data.service_sku==="lab-account-workflow-test-1")return reply({error:"Shipment does not belong to your lab account"},403);
 if(shipment.data.status!=="shipped")return reply({error:"Only shipped supply orders can be confirmed received"},409);
 const now=new Date().toISOString(),oldNotes=String(shipment.data.notes||"").slice(0,3000);
 const updated=await db.from("house_lab_supply_shipments").update({
   status:"delivered",updated_at:now,
   notes:oldNotes+(oldNotes?"\n":"")+"Customer confirmed physical delivery via Lab Account portal at "+now
 }).eq("id",shipmentId).eq("intake_id",purchase.data.id).eq("status","shipped").select("id,status,updated_at").maybeSingle();
 if(updated.error)throw updated.error;
 if(!updated.data)return reply({error:"Shipment status changed before confirmation"},409);
 return reply({ok:true,shipment:updated.data});
}

if(grant.plan==="lab-account-workflow-test-1"&&["create","cancel"].includes(action))return reply({error:"The $1 workflow test does not include physical supply requests."},403);
if(action==="create"){
const lines=Array.isArray(b.lines)?b.lines:[];if(!lines.length||lines.length>40)return reply({error:"Select supply quantities"},400);
const uniq=new Set<string>();for(const l of lines){if(!/^[0-9a-f-]{36}$/i.test(String(l.item_id))||!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>1000||uniq.has(l.item_id))return reply({error:"Invalid supply quantities"},400);uniq.add(l.item_id)}
const active=await db.from("ic_portal_supply_items").select("id").in("id",[...uniq]).eq("active",true);if(active.error)throw active.error;if(active.data?.length!==uniq.size)return reply({error:"Supply item unavailable"},409);
const addr=b.shipping_address||{};for(const field of ["recipient","line1","city","state","postal_code"]){if(typeof addr[field]!=="string"||!addr[field].trim()||addr[field].length>180)return reply({error:"Complete the shipping address"},400)}
if(!/^[A-Za-z]{2}$/.test(addr.state)||!/^[0-9]{5}(-[0-9]{4})?$/.test(addr.postal_code)||String(b.notes||"").length>1000)return reply({error:"Invalid address or notes"},400);
const insert=await db.from("ic_portal_supply_orders").insert({contractor_user_id:user.id,status:"requested",shipping_address:{recipient:addr.recipient.trim(),line1:addr.line1.trim(),line2:String(addr.line2||"").slice(0,180),city:addr.city.trim(),state:addr.state.toUpperCase(),postal_code:addr.postal_code},notes:String(b.notes||"").trim()}).select("id").single();if(insert.error)throw insert.error;
const rows=await db.from("ic_portal_supply_order_lines").insert(lines.map((l:any)=>({order_id:insert.data.id,item_id:l.item_id,quantity:l.quantity})));if(rows.error){await db.from("ic_portal_supply_orders").delete().eq("id",insert.data.id).eq("contractor_user_id",user.id);throw rows.error}
return reply({ok:true,id:insert.data.id});
}
if(action==="cancel"){
const id=String(b.id||"");if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Invalid order"},400);
const q=await db.from("ic_portal_supply_orders").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",id).eq("contractor_user_id",user.id).eq("status","requested").select("id").maybeSingle();if(q.error)throw q.error;if(!q.data)return reply({error:"Order cannot be cancelled"},409);return reply({ok:true});
}
return reply({error:"Unsupported action"},400);
}catch(e){console.error("lab-account-supplies",e);return reply({error:"Supply operation unavailable"},500)}
});