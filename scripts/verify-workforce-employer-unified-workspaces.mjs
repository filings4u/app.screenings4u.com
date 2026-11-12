import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=readFileSync(path.join(root,'supabase/functions/workforce-employer-unified-workspaces/index.ts'),'utf8');

const checks=[
 ['verified user JWT', 'await auth.auth.getUser(token)'],
 ['DOT membership isolated', 'members:"organization_memberships"'],
 ['NON-DOT membership isolated', 'members:"workforce_memberships"'],
 ['DOT employer and subscription tables', 'companies:"employers"'],
 ['NON-DOT employer and subscription tables', 'companies:"workforce_employers"'],
 ['DOT portal permission', 'portal:"employer_dot"'],
 ['NON-DOT portal permission', 'portal:"employer_workforce"'],
 ['employee-specific NON-DOT revocation', 'personal.data?.enabled===false'],
 ['active subscriptions only', '.in("status",ACTIVE)'],
 ['employer plan audience', '.eq("audience","employer")'],
 ['exact tier code checked', 'plan.code!==surface.prefix+tier'],
 ['company organization filter', '.eq("organization_id",organizationId).is("archived_at",null)'],
 ['subscription belongs to selected company', '.eq("employer_id",company.id)'],
 ['DOT feature overrides isolated', 'overrides:"account_feature_overrides"'],
 ['NON-DOT feature overrides isolated', 'overrides:"workforce_account_feature_overrides"'],
 ['disabled purchased flags remain disabled', 'byId.has(r.feature_id)?bool(byId.get(r.feature_id)):bool(r.enabled)'],
 ['separate scopes in response', 'operating_context:surface.type'],
 ['no service role key in response', 'feature_codes:[...new Set(codes)].sort()']
];
for(const [name,needle] of checks){
 const ok=code.includes(needle);
 console.log((ok?'PASS ':'FAIL ')+name);
 assert.ok(ok,name);
}
const noUnion=!code.includes('new Set([...dotCodes,...nondotCodes])');
assert.ok(noUnion,'DOT and NON-DOT entitlements must not be unioned');
console.log('PASS No synthetic combined feature set');
console.log((checks.length+1)+'/'+(checks.length+1)+' Employer workspace source checks passed');
