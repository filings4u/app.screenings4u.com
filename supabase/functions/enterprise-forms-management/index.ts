import { createClient } from "npm:@supabase/supabase-js@2";

const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Access-Control-Allow-Methods":"POST,OPTIONS"};
const J=(b:any,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...H,"Content-Type":"application/json","Cache-Control":"no-store"}});
const clean=(v:any)=>String(v??"").trim();
const low=(v:any)=>clean(v).toLowerCase();
const now=()=>new Date().toISOString();
const uid=()=>crypto.randomUUID();
const slugify=(v:any)=>low(v).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);

async function staffGate(db:any,userId:string){
  const p=await db.from("staff_profiles").select("employment_status").eq("user_id",userId).maybeSingle();
  if(p.error)throw p.error;
  if(!p.data||p.data.employment_status!=="active")return false;
  const r=await db.from("staff_role_assignments").select("id").eq("user_id",userId).eq("active",true).limit(1);
  if(r.error)throw r.error;
  return !!r.data?.length;
}
function normalizedSections(input:any){
  if(!Array.isArray(input))return [];
  return input.map((s:any,si:number)=>({
    id:clean(s?.id)||`section-${si+1}`,
    title:clean(s?.title)||`Section ${si+1}`,
    description:clean(s?.description)||"",
    copy_from_section:clean(s?.copy_from_section)||null,
    copy_label:clean(s?.copy_label)||null,
    fields:Array.isArray(s?.fields)?s.fields.map((f:any,fi:number)=>({
      id:clean(f?.id)||uid(),
      name:slugify(f?.name||f?.label||`field-${si+1}-${fi+1}`).replaceAll("-","_"),
      label:clean(f?.label)||`Field ${fi+1}`,
      type:clean(f?.type||"text"),
      required:!!f?.required,
      width:["full","half","third"].includes(clean(f?.width))?clean(f.width):"half",
      placeholder:clean(f?.placeholder)||"",
      help:clean(f?.help)||"",
      default_value:f?.default_value??"",
      options:Array.isArray(f?.options)?f.options.map((x:any)=>typeof x==="string"?{label:x,value:x}:{label:clean(x?.label||x?.value),value:clean(x?.value||x?.label)}).filter((x:any)=>x.label):[],
      no_po_box:!!f?.no_po_box,
      min:f?.min??null,max:f?.max??null,minlength:f?.minlength??null,maxlength:f?.maxlength??null,
      pattern:clean(f?.pattern)||"",
      accept:clean(f?.accept)||"",
      multiple:!!f?.multiple,
      copy_from:clean(f?.copy_from)||null,
      metadata:f?.metadata&&typeof f.metadata==="object"?f.metadata:{}
    })).filter((f:any)=>f.name&&f.label):[]
  })).filter((s:any)=>s.title);
}
function formSnapshot(row:any){return {
  form_key:row.form_key,slug:row.slug,name:row.name,title:row.title,eyebrow:row.eyebrow,description:row.description,
  business_unit_code:row.business_unit_code,status:row.status,version:row.version,branding:row.branding,sections:row.sections,
  settings:row.settings,success_message:row.success_message,notification_emails:row.notification_emails,published_at:row.published_at
}}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return J({error:"Method not allowed."},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
    const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
    const db=createClient(url,svc,{auth:{persistSession:false,autoRefreshToken:false}});
    const au=await auth.auth.getUser(token);const user=au.data?.user;
    if(au.error||!user||!(await staffGate(db,user.id)))return J({error:"Active screenings4u staff access is required."},403);
    const body=await req.json().catch(()=>({}));const action=clean(body.action||"list_forms");

    if(action==="list_forms"){
      const fq=await db.from("standalone_forms").select("*").order("updated_at",{ascending:false});if(fq.error)throw fq.error;
      const sq=await db.from("standalone_form_submissions").select("form_id,status,submitted_at");if(sq.error)throw sq.error;
      const stats=new Map();
      for(const s of sq.data||[]){const k=s.form_id||"__none";if(!stats.has(k))stats.set(k,{submissions:0,new_submissions:0,last_submission_at:null});const x=stats.get(k);x.submissions++;if(s.status==="submitted")x.new_submissions++;if(!x.last_submission_at||String(s.submitted_at)>x.last_submission_at)x.last_submission_at=s.submitted_at}
      return J({forms:(fq.data||[]).map((f:any)=>({...f,stats:stats.get(f.id)||{submissions:0,new_submissions:0,last_submission_at:null}}))});
    }

    if(action==="get_form"){
      const id=clean(body.id);const q=await db.from("standalone_forms").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)return J({error:"Form not found."},404);
      return J({form:q.data});
    }

    if(action==="save_form"){
      const p=body.form||{},id=clean(p.id)||null;
      const name=clean(p.name),title=clean(p.title)||name;if(!name||!title)return J({error:"Form name and public title are required."},400);
      const business=["enterprise","testing","training","workforce","dot","finance"].includes(low(p.business_unit_code))?low(p.business_unit_code):"enterprise";
      const slug=slugify(p.slug||name);if(!slug)return J({error:"A valid form URL slug is required."},400);
      const formKey=slugify(p.form_key||slug).replaceAll("-","_");
      const status=["draft","published","paused","archived"].includes(low(p.status))?low(p.status):"draft";
      const emails=Array.isArray(p.notification_emails)?[...new Set(p.notification_emails.map((x:any)=>low(x)).filter((x:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)))]:[];
      const branding=p.branding&&typeof p.branding==="object"?p.branding:{};
      const settings=p.settings&&typeof p.settings==="object"?p.settings:{};
      const sections=normalizedSections(p.sections);
      let existing:any=null;
      if(id){const eq=await db.from("standalone_forms").select("*").eq("id",id).maybeSingle();if(eq.error)throw eq.error;if(!eq.data)return J({error:"Form not found."},404);existing=eq.data}
      const nextVersion=existing?Number(existing.version||1)+1:1;
      const row:any={
        form_key:formKey,slug,name,title,eyebrow:clean(p.eyebrow)||null,description:clean(p.description)||null,
        business_unit_code:business,status,version:nextVersion,branding,sections,settings,
        success_message:clean(p.success_message)||"Thank you. Your form has been submitted.",
        notification_emails:emails,updated_by:user.id,updated_at:now()
      };
      if(status==="published"&&!existing?.published_at)row.published_at=now();
      if(existing){
        const vq=await db.from("standalone_form_versions").upsert({id:uid(),form_id:existing.id,version:Number(existing.version||1),snapshot:formSnapshot(existing),created_by:user.id,created_at:now()},{onConflict:"form_id,version",ignoreDuplicates:true});if(vq.error)throw vq.error;
        const uq=await db.from("standalone_forms").update(row).eq("id",existing.id).select("*").single();if(uq.error)throw uq.error;return J({form:uq.data});
      }
      const iq=await db.from("standalone_forms").insert({id:uid(),...row,created_by:user.id,created_at:now()}).select("*").single();if(iq.error)throw iq.error;return J({form:iq.data});
    }

    if(action==="set_status"){
      const id=clean(body.id),status=low(body.status);
      if(!["draft","published","paused","archived"].includes(status))return J({error:"Invalid form status."},400);
      const patch:any={status,updated_by:user.id,updated_at:now()};if(status==="published")patch.published_at=now();
      const q=await db.from("standalone_forms").update(patch).eq("id",id).select("*").single();if(q.error)throw q.error;return J({form:q.data});
    }

    if(action==="duplicate_form"){
      const id=clean(body.id);const q=await db.from("standalone_forms").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)return J({error:"Form not found."},404);
      const base=q.data;const newSlug=slugify((base.slug||"form")+"-copy-"+uid().slice(0,6));const row={...formSnapshot(base),form_key:newSlug.replaceAll("-","_"),slug:newSlug,name:base.name+" Copy",title:base.title+" Copy",status:"draft",version:1,published_at:null};
      const iq=await db.from("standalone_forms").insert({id:uid(),...row,created_by:user.id,updated_by:user.id,created_at:now(),updated_at:now()}).select("*").single();if(iq.error)throw iq.error;return J({form:iq.data});
    }

    if(action==="set_lab_account_status"){
      const id=clean(body.id),accountStatus=low(body.account_status);
      if(!/^[0-9a-f-]{36}$/i.test(id)||!["pending","active"].includes(accountStatus))return J({error:"Choose Pending or Active for a valid lab account."},400);
      const permit=await db.from("staff_business_access").select("id").eq("user_id",user.id).eq("business_unit_code","testing").eq("active",true).limit(1);
      if(permit.error)throw permit.error;
      if(!permit.data?.length)return J({error:"Testing Management access required."},403);
      if(accountStatus==="active"){
        const purchase=await db.from("lab_account_intakes").select("id,order_id,customer_email,service_sku").eq("id",id).maybeSingle();
        if(purchase.error)throw purchase.error;
        if(!purchase.data)return J({error:"Purchase not found"},404);
        if(purchase.data.service_sku==="lab-account-workflow-test-1")return J({error:"The $1 test plan cannot activate a production laboratory account."},409);
        const paid=await db.from("orders").select("payment_status").eq("id",purchase.data.order_id).maybeSingle();
        if(paid.error)throw paid.error;
        if(paid.data?.payment_status!=="paid")return J({error:"Payment must be confirmed before activation."},409);
        const form=await db.from("standalone_form_submissions").select("id").in("form_key",["lab_account_intake","lab_account_intake_standalone"]).ilike("submitter_email",purchase.data.customer_email).eq("status","completed").limit(1);
        if(form.error)throw form.error;
        if(!form.data?.length)return J({error:"Complete the customer intake review before activation."},409);
        const org=await db.from("organizations").select("id").ilike("primary_email",purchase.data.customer_email).neq("status","archived").limit(2);
        if(org.error)throw org.error;
        if(org.data?.length!==1)return J({error:"Link and verify the customer's single C/TPA organization before activation."},409);
        const ctpa=await db.from("ctpas").select("id").eq("organization_id",org.data[0].id).maybeSingle();
        if(ctpa.error)throw ctpa.error;
        if(!ctpa.data)return J({error:"Provision the customer's C/TPA account before activation."},409);
        const numbers=await db.from("ctpa_lab_accounts").select("id",{head:true,count:"exact"}).eq("ctpa_id",ctpa.data.id).eq("status","active");
        if(numbers.error)throw numbers.error;
        if(!numbers.count)return J({error:"Assign at least one active laboratory account number before activation."},409);
      }
      const q=await db.from("lab_account_intakes").update({account_status:accountStatus,updated_at:now()}).eq("id",id).select("id,order_number,account_status,status").maybeSingle();
      if(q.error)throw q.error;
      if(!q.data)return J({error:"Lab account purchase not found."},404);
      return J({ok:true,purchase:q.data});
    }
    if(["get_lab_purchase","edit_lab_purchase","archive_lab_purchase"].includes(action)){
      const purchaseId=clean(body.id);
      const q=await db.from("lab_account_intakes").select("*").eq("id",purchaseId).maybeSingle();
      if(q.error)throw q.error;if(!q.data)return J({error:"Lab Account intake not found."},404);
      const permit=await db.from("staff_business_access").select("id").eq("user_id",user.id).eq("business_unit_code","testing").eq("active",true).limit(1);
      if(permit.error)throw permit.error;if(!permit.data?.length)return J({error:"Testing Management access required."},403);
      if(action==="get_lab_purchase")return J({purchase:q.data});
      if(action==="archive_lab_purchase"){const update=await db.from("lab_account_intakes").update({status:"archived",updated_at:now()}).eq("id",purchaseId);if(update.error)throw update.error;return J({ok:true});}
      const patch=body.payload,original=q.data.intake_data&&typeof q.data.intake_data==="object"?q.data.intake_data:{};
      if(!patch||typeof patch!=="object"||Array.isArray(patch))return J({error:"Invalid intake fields."},400);
      const next={...original};for(const [k,v]of Object.entries(patch)){if(!Object.prototype.hasOwnProperty.call(original,k)||typeof v!=="string"||v.length>3000)return J({error:"Invalid intake field."},400);next[k]=v;}
      const update=await db.from("lab_account_intakes").update({intake_data:next,updated_at:now()}).eq("id",purchaseId);if(update.error)throw update.error;return J({ok:true});
    }
    if(action==="lab_account_purchases"){
      const q=await db.from("lab_account_intakes").select("id,order_id,order_number,customer_email,status,account_status,intake_data,created_at,submitted_at").order("created_at",{ascending:false}).limit(500);
      if(q.error)throw q.error;return J({purchases:q.data||[]});
    }
    if(action==="submissions"){
      const id=clean(body.form_id);let q=db.from("standalone_form_submissions").select("*").order("submitted_at",{ascending:false}).limit(1000);if(id)q=q.eq("form_id",id);
      const r=await q;if(r.error)throw r.error;return J({submissions:r.data||[]});
    }

    if(action==="get_submission"){
      const id=clean(body.id);const q=await db.from("standalone_form_submissions").select("*").eq("id",id).maybeSingle();if(q.error)throw q.error;if(!q.data)return J({error:"Submission not found."},404);
      const fq=await db.from("standalone_form_submission_files").select("*").eq("submission_id",id).order("created_at");if(fq.error)throw fq.error;
      const files=[];for(const f of fq.data||[]){let url=null;try{const s=await db.storage.from(f.storage_bucket).createSignedUrl(f.storage_path,300);if(!s.error)url=s.data.signedUrl}catch{}files.push({...f,url})}
      return J({submission:q.data,files});
    }

    if(action==="edit_submission_payload"){
      const id=clean(body.id),submitted=body.payload;
      if(!/^[0-9a-f-]{36}$/i.test(id)||!submitted||typeof submitted!=="object"||Array.isArray(submitted))return J({error:"Invalid intake request."},400);
      const rec=await db.from("standalone_form_submissions").select("id,form_key,payload,metadata").eq("id",id).maybeSingle();
      if(rec.error)throw rec.error;
      if(!rec.data||!["lab_account_intake_standalone","lab_account_intake"].includes(rec.data.form_key))return J({error:"Lab Account intake not found."},404);
      const access=await db.from("staff_business_access").select("id").eq("user_id",user.id).eq("business_unit_code","testing").eq("active",true).limit(1);
      if(access.error)throw access.error;
      if(!access.data?.length)return J({error:"Testing Management access required."},403);
      const previous=rec.data.payload&&typeof rec.data.payload==="object"?rec.data.payload:{};
      const next={...previous};
      for(const [key,value] of Object.entries(submitted)){
        if(!Object.prototype.hasOwnProperty.call(previous,key)||typeof value!=="string"||value.length>3000)return J({error:"Invalid intake field: "+key},400);
        next[key]=value;
      }
      const updated=await db.from("standalone_form_submissions").update({payload:next,updated_at:now(),metadata:{...(rec.data.metadata||{}),management_edited_by:user.id,management_edited_at:now()}}).eq("id",id).select("id,updated_at").single();
      if(updated.error)throw updated.error;
      return J({ok:true,submission:updated.data});
    }

    if(action==="update_submission"){
      const id=clean(body.id),status=low(body.status);
      if(!["submitted","reviewing","completed","archived"].includes(status))return J({error:"Invalid submission status."},400);
      const patch:any={status,updated_at:now()};
      if(status==="reviewing"){patch.reviewed_by=user.id;patch.reviewed_at=now()}
      if(status==="completed")patch.completed_at=now();
      const q=await db.from("standalone_form_submissions").update(patch).eq("id",id).select("*").single();if(q.error)throw q.error;return J({submission:q.data});
    }

    return J({error:"Unsupported forms action."},400);
  }catch(e){console.error("enterprise-forms-management",e);return J({error:e instanceof Error?e.message:String(e)},500)}
});