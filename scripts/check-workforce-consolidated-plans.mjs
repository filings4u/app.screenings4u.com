import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const base=path.dirname(fileURLToPath(import.meta.url));
const file=path.resolve(base,'../config/workforce-consolidation-plan-audit.json');
const doc=JSON.parse(readFileSync(file,'utf8'));
let failures=0;
const assert=(condition,message)=>{
  if(!condition){console.error('FAIL:',message);failures++;}
  else console.log('PASS:',message);
};
assert(doc.status==='STAGED_NOT_LIVE','Catalog is an audit, not a live entitlement update');
assert(doc.pricingChanges===false&&doc.customerGrants===false,'No customer grant or price migration is implied');
assert(doc.trainingExcluded===true,'Training is excluded');
for(const [persona,details] of Object.entries(doc.personas)){
  const plans=details.tiers;
  const tiers=['essential','professional','enterprise'];
  for(const tier of tiers){
    const features=plans[tier]||[];
    assert(features.length>0,persona+' '+tier+' includes source-backed features');
    assert(features.length===new Set(features).size,persona+' '+tier+' has no duplicate feature codes');
  }
  for(let i=0;i<tiers.length-1;i++){
    const lower=plans[tiers[i]]||[],higher=new Set(plans[tiers[i+1]]||[]);
    assert(lower.every(feature=>higher.has(feature)),persona+' '+tiers[i+1]+' retains every '+tiers[i]+' feature');
  }
  assert(!Object.values(plans).flat().includes('lab_account'),'Lab Account purchase remains a separate add-on for '+persona);
}
assert(doc.lab_account_addon.not_auto_granted===true,'Lab add-on is never auto-granted from a higher software plan');
assert(doc.personas.employer.destination==='employer.screenings4u.com','Employer destination is consolidated');
assert(doc.personas.ctpa.destination==='ctpa.screenings4u.com','C/TPA destination is consolidated');
if(failures){console.error(failures+' plan audit checks failed');process.exitCode=1;}
else console.log('All staged consolidated plan audit checks passed');
