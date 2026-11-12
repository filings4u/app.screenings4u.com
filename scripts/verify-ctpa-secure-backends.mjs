import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=slug=>readFileSync(path.join(root,'supabase/functions',slug,'index.ts'),'utf8');
const names=['nondot-workforce-ctpa-programs','nondot-workforce-ctpa-pools','nondot-workforce-ctpa-testing'];
const hardened=['workforce-ctpa-secure-programs','workforce-ctpa-secure-pools','workforce-ctpa-secure-testing'];
const bridge=source('workforce-ctpa-nondot-workspace');
const combined=source('workforce-ctpa-combined-access');
const summaries=source('workforce-ctpa-secure-result-summaries');
const results=[];
const test=(label,ok)=>{results.push([label,Boolean(ok)]);console.log((ok?'PASS ':'FAIL ')+label);};
for(let i=0;i<names.length;i++){
 const slug=names[i],code=source(slug);
 for(const term of ['workforce_portal_user_access','workforce_portal_access','workforce_account_feature_overrides','workforce_plan_features','verifiedPlan.data.code','membership.is_primary','enabled.has(required)','body.ctpa_id'])
  test(slug+': '+term,code.includes(term));
 test(slug+': denies unsupported actions',code.includes('action!=="workspace"&&!mutating'));
 test(slug+': no secret in browser',!code.includes('NEXT_PUBLIC_SERVICE_ROLE'));
 test('Bridge uses hardened '+hardened[i],bridge.includes('endpoint:"'+hardened[i]+'"')||bridge.includes('?"'+hardened[i]+'"'));
}
test('Bridge securely routes NON-DOT results',bridge.includes('endpoint:"workforce-ctpa-secure-result-summaries"'));
test('Bridge does not use original program service',!bridge.includes('endpoint:"nondot-workforce-ctpa-programs"'));
test('Bridge does not use original pool service',!bridge.includes('endpoint:"nondot-workforce-ctpa-pools"'));
test('Bridge does not use original testing service',!bridge.includes('endpoint:"nondot-workforce-ctpa-testing"'));
test('Combined context has verified NON-DOT subscription',combined.includes('subscription_id:nondotSubscriptionId'));
test('Bridge passes selected NON-DOT subscription',bridge.includes('subscription_id:onlyNondot?subscriptionId:context.subscription_id'));
test('Results feature required',summaries.includes('"results_summary"'));
test('Result reports cannot be downloaded here',summaries.includes('if(action!=="workspace")'));
test('No result delivery capability in secure endpoint',summaries.includes('can_deliver:false'));
test('Reports scoped to employers of selected C/TPA',summaries.includes('.eq("ctpa_id",ctpaId).eq("workforce_classification","NON_DOT")'));
test('Reports returned as short summaries only',summaries.includes('report_number:r.report_number,status:r.report_status'));
const failed=results.filter(([,ok])=>!ok);
console.log(results.length-failed.length+'/'+results.length+' source checks passed');
if(failed.length)process.exitCode=1;
