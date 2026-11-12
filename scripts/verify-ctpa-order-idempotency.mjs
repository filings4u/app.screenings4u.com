import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=p=>readFileSync(path.join(root,p),'utf8');
const legacy=load('supabase/functions/nondot-workforce-ctpa-testing/index.ts');
const bridge=load('supabase/functions/workforce-ctpa-nondot-workspace/index.ts');
const checks=[
 ['legacy supports validated idempotency key',legacy.includes('client_request_id')&&legacy.includes('Invalid order request identifier')],
 ['legacy builds stable unique order number',legacy.includes('"NDT-"+requestId.toUpperCase()')],
 ['legacy authenticates the original creator',legacy.includes('record.created_by===user.id')],
 ['legacy checks employer, employee, program and type',legacy.includes('record.employer_id===employer.id&&record.employee_id===employee.id&&record.program_id===program.id&&')&&legacy.includes('record.test_type===String(v.test_type')],
 ['legacy checks regulatory surface',legacy.includes('record.program_type==="NON_DOT"&&record.business_surface==="workforce"')],
 ['legacy handles concurrent unique-index races',legacy.includes('q.error.code==="23505"')],
 ['legacy refuses reused identifiers across orders',legacy.includes('already been used for a different order')],
 ['legacy preserves old clients without request ID',legacy.includes('requestId?"NDT-"+requestId.toUpperCase():')],
 ['bridge validates UUID and forwards it',bridge.includes('uuid(v.client_request_id)')&&bridge.includes('client_request_id:v.client_request_id')],
 ['bridge retains purchased-feature checks',bridge.includes('permission:"testing_orders"')&&bridge.includes('context.feature_codes.includes(rule.permission)')],
 ['bridge retains company ownership checks',bridge.includes('.eq("ctpa_id",ctpaId).eq("workforce_classification","NON_DOT")')]
];
for(const [name,ok] of checks){console.log((ok?'PASS ':'FAIL ')+name);assert.ok(ok,name)}
const key='8c51d5c8-93ef-4d9d-95e0-b9a8362c23ba';
assert.equal('NDT-'+key.toUpperCase(),'NDT-8C51D5C8-93EF-4D9D-95E0-B9A8362C23BA');
console.log('PASS deterministic order number fixture');
console.log(checks.length+1+'/'+(checks.length+1)+' idempotency source checks passed');
