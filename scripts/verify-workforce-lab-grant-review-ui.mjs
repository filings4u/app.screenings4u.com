import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(path.join(root,p),'utf8');
const html=read('workforce-lab-grant-review.html');
const js=read('assets/js/workforce-lab-grant-review.js');
const nav=read('assets/js/dot-shell.js');
const overview=read('assets/js/lab-overview.js');
const server=read('supabase/functions/workforce-lab-grant-approval/index.ts');
const checks=[
 ['dedicated HTML CSS JS',html.includes('workforce-lab-grant-review.css')&&html.includes('workforce-lab-grant-review.js')],
 ['existing shared shell',html.includes('dot-shell.js')&&js.includes('DOTShell.render(state)')],
 ['shared authentication',js.includes('DOTAuth.requireAuth()')],
 ['authorized approval endpoint',js.includes("'workforce-lab-grant-approval'")],
 ['loads actual grants',js.includes("invoke('list')")],
 ['reviews actual grant',js.includes("invoke('review',{grant_id:id})")],
 ['approval enabled only after eligible pending review',js.includes("data.ready===true&&data.status==='pending'")],
 ['requires exact phrase',js.includes("event.target.value!==approvalPhrase")&&js.includes("confirmation:approvalPhrase")],
 ['no native confirmation alert',!js.includes('window.confirm')],
 ['prevents concurrent button actions',js.includes('if(busy||!selected||!approvedReady)return;')],
 ['backend still authorizes staff',server.includes('.eq("permission_key","customers.assign")')],
 ['backend uses pending-only update',server.includes('.eq("entitlement_code","lab_account").eq("status","pending")')],
 ['existing management navigation',nav.includes("['Lab Grant Review','workforce-lab-grant-review.html'")],
 ['existing lab overview entry',overview.includes('href="workforce-lab-grant-review.html"')],
 ['no example customer records',!js.includes('exampleGrant')]
];
for(const [label,pass] of checks){console.log(`${pass?'PASS':'FAIL'} ${label}`);assert.ok(pass,label)}
console.log(`${checks.length}/${checks.length} review UI source checks passed. Live authentication and approval integration testing required.`);
