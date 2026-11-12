import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(path.join(root,'supabase/functions/workforce-ctpa-nondot-workspace/index.ts'),'utf8');
const start=source.indexOf('if(requestedAction==="add_pool_member"||requestedAction==="remove_pool_member"){');
const end=source.indexOf('const v=requestedAction==="save_employee"',start);
assert.ok(start>=0&&end>start,'membership actions exist');
const action=source.slice(start,end);
const checks=[
 ['valid identifiers',action.includes('!uuid(v.pool_id)||!uuid(v.employee_id)')],
 ['selected C/TPA owns NON-DOT pool',action.includes('.eq("id",v.pool_id).eq("ctpa_id",ctpaId)')],
 ['NON-DOT pool only',action.includes('.eq("program_type","NON_DOT").eq("pool_type","employer")')],
 ['Workforce pool only',action.includes('.eq("business_surface","workforce")')],
 ['employee belongs to pool employer',action.includes('.eq("employer_id",pool.data.employer_id)')],
 ['active membership lookup scoped to business surface',action.includes('.eq("business_surface","workforce").is("removed_at",null).maybeSingle()')],
 ['removal rechecks employee and surface',action.includes('.eq("employee_id",v.employee_id).eq("business_surface","workforce")')],
 ['removal atomically requires active membership',action.includes('.is("removed_at",null).select("id").maybeSingle()')],
 ['stale removal returns conflict',action.includes('Membership was already removed or changed"},409')],
 ['duplicate memberships rejected',action.includes('Employee is already in this pool"},409')],
 ['no selection draw execution',!action.includes('execute_random_selection')],
 ['feature permission for pool mutations',source.includes('add_pool_member:{section:"pools",permission:"consortium_pools"}')&&source.includes('remove_pool_member:{section:"pools",permission:"consortium_pools"}')],
 ['primary Workforce manager authorization',source.includes('.eq("is_primary",true)')&&source.includes('personal.data?.enabled===false')]
];
for(const [label,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${label}`);assert.ok(pass,label)}
console.log(`${checks.length}/${checks.length} NON-DOT pool membership guards verified (source checks only)`);
