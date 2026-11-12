import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const get = (file) => readFileSync(path.join(root, file), 'utf8');
const workspace = get('supabase/functions/workforce-ctpa-nondot-workspace/index.ts');
const original = get('supabase/functions/nondot-workforce-ctpa-programs/index.ts');
const required = [
  ['NON-DOT selected workspace', 'w.operating_context==="nondot"&&w.ctpa_id===ctpaId&&w.subscription_id===subscriptionId'],
  ['active subscription', '.in("status",["active","trial","trialing"])'],
  ['feature entitlement', 'context.feature_codes.includes(rule.permission)'],
  ['primary membership', '.eq("is_primary",true)'],
  ['personal access check', '.eq("portal_code","ctpa_workforce")'],
  ['NON-DOT employer ownership', '.eq("workforce_classification","NON_DOT")'],
  ['NON-DOT employee surface', '.eq("business_surface","workforce")'],
  ['employee update allowlist', 'employee_number:clean(v.employee_number).slice(0,40)'],
  ['optional employee number length', 'v.employee_number.length>40'],
  ['required employee names', '!changes.first_name||!changes.last_name'],
  ['read payload includes employee number', 'employee_number:x.employee_number'],
];
let failures = 0;
for (const [label, needle] of required) {
  const passed = workspace.includes(needle);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) failures++;
}
const sourceReadable = original.includes('db.from("workforce_employees").select("*")');
console.log(`${sourceReadable ? 'PASS' : 'FAIL'} Legacy NON-DOT employee read includes employee number`);
if (!sourceReadable) failures++;
console.log(`${required.length + 1 - failures}/${required.length + 1} checks passed`);
if (failures) process.exitCode = 1;
