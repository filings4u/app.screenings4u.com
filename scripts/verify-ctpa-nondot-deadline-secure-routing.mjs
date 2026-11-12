import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFileSync(path.join(root,file),'utf8');
const bridge=read('supabase/functions/workforce-ctpa-nondot-workspace/index.ts');
const testing=read('supabase/functions/workforce-ctpa-secure-testing/index.ts');
const start=bridge.indexOf('if(requestedAction==="update_test_deadline"){');
const end=bridge.indexOf('if(requestedAction==="add_pool_member"',start);
assert.ok(start!==-1&&end>start,'deadline bridge action is present');
const route=bridge.slice(start,end);
const checks=[
 ['valid UTC input',route.includes('collection_deadline!=="string"')&&route.includes('new Date(v.collection_deadline)')],
 ['future deadline',route.includes('deadline.getTime()<=now')],
 ['366-day upper bound',route.includes('deadline.getTime()>now+366*24*60*60*1000')],
 ['uses secure endpoint',route.includes('"/functions/v1/workforce-ctpa-secure-testing"')],
 ['passes selected tenant and subscription',route.includes('ctpa_id:ctpaId')&&route.includes('subscription_id:subscriptionId')],
 ['passes only deadline change',route.includes('order:{collection_deadline:deadline.toISOString()}')],
 ['checks returned order identity',route.includes('result.order?.id!==v.id')],
 ['no direct order database write in bridge',!route.includes('db.from("workforce_testing_orders")')],
 ['secure endpoint checks primary manager',testing.includes('membership.is_primary')],
 ['secure endpoint checks testing entitlement',testing.includes('"update_order":"testing_orders"')],
 ['secure endpoint checks all fulfillment timestamps',testing.includes('!o.assigned_at&&!o.notified_at&&')&&testing.includes('!o.scheduled_at&&!o.collected_at&&!o.completed_at')],
 ['secure endpoint conditions the database update',testing.includes('.is("assigned_at",null).is("notified_at",null).is("scheduled_at",null)')&&testing.includes('.is("collected_at",null).is("completed_at",null)')],
 ['secure endpoint isolates regulatory surface',testing.includes('.eq("business_surface","workforce").eq("program_type","NON_DOT")')]
];
for(const [label,pass] of checks){
 console.log(`${pass?'PASS':'FAIL'} ${label}`);
 assert.ok(pass,label);
}
console.log(`${checks.length}/${checks.length} NON-DOT deadline source routing checks passed`);
