import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(path.join(root,'supabase/functions/workforce-lab-grant-approval/index.ts'),'utf8');
const checks=[
 ['signed-in user must be verified',source.includes('client.auth.getUser(jwt)')&&source.includes('user.email_confirmed_at')],
 ['active staff required',source.includes('staff_profiles')&&source.includes('employment_status!=="active"')],
 ['testing business access required',source.includes('.eq("business_unit_code","testing").eq("active",true)')],
 ['active time-bounded role required',source.includes('r.starts_at')&&source.includes('r.ends_at')],
 ['active role catalog required',source.includes('staff_roles')&&source.includes('.eq("active",true)')],
 ['company assignment permission required',source.includes('.eq("permission_key","customers.assign").eq("allowed",true)')],
 ['no self approval',source.includes('e.linked_customer_user_id===user.id')],
 ['requires paid order',source.includes('order.data?.payment_status!=="paid"')],
 ['requires C/TPA company match',source.includes('ctpa.data.organization_id!==e.organization_id')],
 ['requires active purchaser membership',source.includes('.eq("organization_id",e.organization_id).eq("status","active")')],
 ['requires unique purchaser intake',source.includes('intake.data?.length!==1')&&source.includes('customer_user_id!==e.linked_customer_user_id')],
 ['requires complete and active lab onboarding',source.includes('intake.data[0].status!=="completed"')&&source.includes('intake.data[0].account_status!=="active"')],
 ['requires active lab number',source.includes('ctpa_lab_accounts')&&source.includes('.eq("status","active").limit(1)')],
 ['rejects duplicate active grants',source.includes('C/TPA already has an active Lab Account grant')],
 ['review action cannot activate',source.includes('if(action==="review")return reply({ok:true')],
 ['explicit confirmation required',source.includes('ACTIVATE LAB ACCOUNT')],
 ['state transition only from pending',source.includes('.eq("entitlement_code","lab_account").eq("status","pending")')],
 ['optimistic version checks',source.includes('.eq("updated_at",e.updated_at)')],
 ['writes approval identity and timestamp',source.includes('approved_by:user.id,activated_at:timestamp')],
 ['only safe actions offered',source.includes('["list","review","approve"]')],
 ['never emails customer automatically',!source.includes('RESEND_API_KEY')]
];
for(const [label,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${label}`);assert.ok(pass,label)}
console.log(`${checks.length}/${checks.length} Lab Account approval source assertions passed; deploy and authenticated tests still required`);
