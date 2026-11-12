import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=pathName=>readFileSync(path.join(root,pathName),'utf8');
const service=read('supabase/functions/workforce-ctpa-secure-testing/index.ts');
const bridge=read('supabase/functions/workforce-ctpa-nondot-workspace/index.ts');

const checks=[
 ['active non-DOT subscription and selected company',service.includes('verifiedPlan.data.code')&&service.includes('body.ctpa_id')],
 ['primary manager required for updates',service.includes('membership.is_primary')],
 ['explicit testing_orders entitlement',service.includes('"archive_order":"testing_orders"')],
 ['strict ownership and business surface',service.includes('employers.some((e:any)=>e.id===o.employer_id)')&&service.includes('o.program_type==="NON_DOT"&&o.business_surface==="workforce"')],
 ['only created orders are cancellable',service.includes('o.status==="created"')],
 ['blocks assignment, notification, schedule and collection',service.includes('!o.assigned_at&&!o.notified_at&&')&&service.includes('!o.scheduled_at&&!o.collected_at&&!o.completed_at')],
 ['cancellation conditional on created status at write time',service.includes('.update({status:"cancelled",updated_at:now()})')&&service.includes('.eq("id",id).eq("employer_id",existing.employer_id).eq("status","created")')],
 ['cancellation does not alter billing fields',!service.includes('.update({status:"cancelled",amount')],
 ['bridge registers the correct action and feature',bridge.includes('cancel_test_order:{section:"testing",permission:"testing_orders"}')],
 ['bridge validates the selected order ID',bridge.includes('if(!uuid(id))return send({error:"Choose an existing NON-DOT order"},400)')],
 ['bridge forwards to secure testing service',bridge.includes('action:"archive_order",ctpa_id:ctpaId,subscription_id:subscriptionId,testing_order_id:id')],
 ['bridge checks the returned cancellation status',bridge.includes('result.order?.status!=="cancelled"')],
 ['no direct result release in bridge',!bridge.includes('action:"release_result"')]
];
for(const [label,passed] of checks){
 console.log(`${passed?'PASS':'FAIL'} ${label}`);
 assert.ok(passed,label);
}
console.log(`${checks.length}/${checks.length} NON-DOT order lifecycle source checks passed`);
