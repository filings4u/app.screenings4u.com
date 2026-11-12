# Workforce portal consolidation roadmap

Status: migration-branch working plan; **no live domain, subscription, billing, or delete operation**.

## Product architecture

1. workforce.screenings4u.com — Workforce marketing, plan comparison, add-on checkout; prices remain supplied by the authoritative catalog.
2. workforceapps.screenings4u.com — single Workforce login and entitled portal selector.
3. app.screenings4u.com — authoritative Workforce administrative portal for sites, customers, subscription entitlements, laboratory onboarding, testing workstreams and fulfillment oversight.
4. testing-portal.screenings4u.com — screenings4u.com testing operations source; sends authorized drug/alcohol testing information into Workforce management. It is not the final management UI for Workforce.
5. ctpa.screenings4u.com — **one** C/TPA interface with DOT and NON-DOT modes and purchased Lab Account capabilities.
6. employer.screenings4u.com — **one** Employer interface with DOT and NON-DOT modes and optional purchased Lab Account capabilities; source repository is employer-non-dot.screenings4u.com until domain migration is verified.
7. owner-operator.screenings4u.com — **one** Owner-Operator interface with DOT and NON-DOT features appropriate to the account.
8. independent-contractor.screenings4u.com — contractor-specific portal retained until separately inventoried. No unsupported assumption of three subscription tiers for contractors.
9. customers.screenings4u.com — retail drug and alcohol testing customers, separate from Workforce software subscriptions.
10. screenings4u.com — screenings4u public marketing. Former House Lab Account plan page to be replaced by navigation to Workforce only after new checkout is functional.

## Exactly three standard subscription tiers per Workforce software customer type

| Persona | Essential | Professional | Enterprise |
|---|---|---|---|
| C/TPA | Existing DOT / NON-DOT core tools, programs and orders | Advanced results and reports | Full configured C/TPA tools and integrations |
| Employer | Own employee testing and programs | Advanced results and reporting | Full configured employer administration and integrations |
| Owner-Operator | Basic Compliance (existing code owner_operator_essential) | Consortium + Drug Test (existing owner_operator_plus) | Complete Compliance (existing owner_operator_complete) |

Independent Contractor is an operational role, not automatically a fourth three-tier subscription. Retain its current permissions until inventory confirms commercial plans.

## Feature policy

- Build to highest plan first. A feature existing in code does not grant access.
- Reuse existing feature_catalog, workforce_feature_catalog, plan_features and workforce_plan_features. The snapshot config/workforce-consolidation-plan-audit.json records current flags and candidate combined benefits.
- DOT and NON-DOT remain separate regulatory business surfaces and data sets, even though the customer sees one portal and tier.
- Lab Account is a company-level, separately purchased **one-time** add-on for lab numbers, direct lab ordering, physical supplies and shipment tracking. It does not charge again for ordinary testing, programs, pools, documents, or reporting already included in the tier.
- Sensitive MRO reports, CCFs, billing and staff-only actions require backend checks for current subscription + company + role + specific resource.
- Changes to feature membership, tier pricing, and subscription IDs require an intentional checkout/webhook migration and an approved access regression suite. Never mass-update paid subscriptions based on a static JSON audit.
- Existing paid Lab Account customers must be grandfathered or reconciled before a portal retirement; pending company grants do not authorize access.

## Source repository consolidation inventory

| Destination | Sources inspected / migration candidates |
|---|---|
| C/TPA | ctpa.screenings4u.com, ctpa-non-dot.screenings4u.com, lab-account.screenings4u.com, ctpa-employee-dot.screenings4u.com, ctpa-employee-non-dot.screenings4u.com, ctpa-driver-dot.screenings4u.com, ctpa-driver-non-dot.screenings4u.com, ctpa-employer-dot.screenings4u.com, ctpa-employer-non-dot.screenings4u.com |
| Employer | employer-non-dot.screenings4u.com, fmcsa-employer-dot.screenings4u.com, faa-employer-dot.screenings4u.com, fra-employer-dot.screenings4u.com, fta-employer-dot.screenings4u.com, phmsa-employer-dot.screenings4u.com, uscg-employer-dot.screenings4u.com, plus DOT agency employee sources as appropriate |
| Owner-Operator | owner-operator.screenings4u.com, fmcsa-driver-dot.screenings4u.com and related driver workflows, after role-by-role review |
| Workforce management | app.screenings4u.com, migration of Workforce-specific staff tools currently exposed through testing-portal.screenings4u.com; preserve screenings4u testing operations integration |
| Workforce marketing and authentication | workforce.screenings4u.com, workforceapps.screenings4u.com |
| Screens4u retail / administrative | screenings4u.com, customers.screenings4u.com, testing-portal.screenings4u.com, enterprise.screenings4u.com (ownership to be reviewed before changing) |
| Other candidates to audit | dot.screenings4u.com, fmcsa-employee-dot.screenings4u.com, faa-employee-dot.screenings4u.com, fra-employee-dot.screenings4u.com, fta-employee-dot.screenings4u.com, phmsa-employee-dot.screenings4u.com, uscg-employee-dot.screenings4u.com, independent-contractor.screenings4u.com |

**Scope exclusion:** training.screenings4u.com, lms.screenings4u.com, training-portal.screenings4u.com. Do not move them into Workforce management as part of this project.

## Repository retirement protocol

1. Inventory exact URLs, customer entitlements, database tables, Edge Functions, and document storage for each source repo.
2. Build the replacement feature in its destination portal and bind to the original authoritative data. Never import legacy navigation shell, duplicate CSS, or another tenant's records.
3. Confirm server-side entitlement, same-company resource scoping and team role checks for all read/write/download actions.
4. Authenticate and exercise all customer and staff workflows in DOT and NON-DOT including expired subscription, wrong tenant, missing add-on, and revoked membership.
5. Update login selector, email links, and customer bookmarks to the new route only after test sign-off.
6. Retain original domain as rollback/redirect while auditing traffic and failures. Archive rather than delete code until database and customer record validation pass.
7. Only then decommission the old repository with a documented rollback and archive decision. Do not delete or redirect now.

## Work performed so far

- C/TPA Lab Services page, a read-only company-scoped backend, and staged verified Lab Account entitlement rows are on migration branches.
- Central C/TPA page and role guards are staged. Employer Enterprise text-based navigation detection was replaced with explicit verified feature code checks in its migration branch.
- The existing workforce-ctpa-unified-entitlements endpoint already compares DOT and NON-DOT tiers; it is the starting point for unified tier evaluation, not proof that all NON-DOT customer workflows were migrated.
- This inventory and the plan audit do not alter the live purchase catalog.

## Remaining critical build

- Complete unified subscription provisioning across DOT and NON-DOT records; verify authoritative organization mapping and expired/revoked access.
- Complete NON-DOT C/TPA employer, worker, program, selection, ordering and result workflows inside ctpa.screenings4u.com.
- Extend C/TPA Lab Services to secure test orders, supplies, CCFs, released results, documents, invoices and account messaging.
- Complete Employer DOT source migration into the employer-non-dot-based portal, then change the domain only after QA.
- Build the equivalent Owner-Operator surface integration.
- Consolidate Workforce staff/testing administration into app.screenings4u.com while preserving the testing-portal feed.
- Reconcile one unmatched legacy paid Lab Account intake and verify two pending matches before grants are activated.
- Plan and price increased benefits without accidentally including disabled features in the live checkout.


## November 11 implementation checkpoint
- The source-backed `config/workforce-consolidation-plan-audit.json` records enabled DOT and NON-DOT feature codes at each current tier without creating extra subscriptions. Candidate merged counts are C/TPA 13/17/34, Employer 12/21/29, Owner-Operator 6/9/11.
- `scripts/check-workforce-consolidated-plans.mjs` provides a tier-inheritance, duplicate-code, training-exclusion and Lab add-on separation audit.
- New `workforce-ctpa-combined-access` Supabase function (v3) has been deployed for staged clients. It verifies the authenticated DOT workspace, subscription, organization and company membership, then independently checks existing NON-DOT portal membership, portal access, user revocation and paid subscription. Its output contains **separate** DOT and NON-DOT feature-code arrays; it is not an automatic combined grant.
- The function honors account-specific enabled/disabled overrides for both surfaces. No aggregate union is exported as a usable permission.
- The C/TPA migration branch's `workforce-context.js` now verifies actual per-surface feature codes through the new function before showing included tools. Its live counterpart on `main` remains unchanged.
- NON-DOT operations are not yet unified at the data/write API level, and a DOT-only customer does not automatically gain NON-DOT read/write access. Provisioning one approved subscription across regulatory contexts is a separate planned step.
- No production subscriptions, payment prices, existing customer records, or source repository redirects were changed by these staging commits.

## C/TPA NON-DOT workspace implementation checkpoint
- Added a read-only NON-DOT workspace inside the C/TPA portal using its existing shell, shared CSS and navigation.
- Implemented five modules: Employees, Programs, Random Pools, Testing Orders and restricted Results inventory, reusing original NON-DOT backend services.
- Deployed workforce-ctpa-nondot-workspace v3: per-request independent NON-DOT subscription, feature, exact C/TPA identity and organization authorization. No cross-workspace data substitution.
- Deployed workforce-ctpa-combined-access v4: provides the verified NON-DOT C/TPA ID and per-surface feature grants, without granting NON-DOT access solely because a DOT subscription exists.
- New route hides unpurchased modules, never caches NON-DOT page payload in local browser page storage, and links from the DOT/NON-DOT feature selector.
- C/TPA migration-branch HTML pages now load the consolidated shared JS and CSS assets.
- Customer edits, testing order writes, random-selection execution, CCF downloads, result delivery, payment provisioning, and auth QA remain outstanding.

### Critical cutover blocker — NON-DOT-only customers
The current ctpa.screenings4u.com portal still authenticates using the DOT C/TPA workspace. A NON-DOT-only customer cannot use that login as-is. Before disabling ctpa-non-dot.screenings4u.com, create a unified C/TPA session and workspace selector in Workforce management that accepts verified DOT-only, NON-DOT-only and combined memberships, scopes data by business surface, and grants only purchased subscription features. Do not force existing NON-DOT customers to buy DOT subscriptions.

No source repos have been deleted or redirected, and no production plan or customer entitlement was altered in this checkpoint.

### Unified C/TPA workspace discovery staged
- New read-only Supabase Edge Function `workforce-ctpa-unified-workspaces` v1 can discover **both** DOT-only and NON-DOT-only C/TPA subscriptions for a verified signed-in user.
- DOT workspaces are checked against active organization memberships, enabled portal access, active `subscriptions`, active tier plans and the authoritative `ctpa_dot_session_context` RPC.
- NON-DOT workspaces are checked against active workforce memberships, the correct `workforce_ctpas` organization, enabled portal access, explicit per-user revocation and active `workforce_subscriptions` with approved tier plans.
- The service returns distinct per-surface workspace/subscription entries, never a merged role or blanket permission. It creates no account, subscription, payment, or data record.
- This is the backend prerequisite for unified selector/login. **The current C/TPA UI still needs to consume this service and support NON-DOT-only sessions; do not cut over users or redirect the legacy portal yet.**

### WorkforceApps single-selector rollout preparation — November 11
- Inspected the existing WorkforceApps selector, login and portal-session-handoff. Reuse its one-time magic-link-code exchange and centralized purchased workspace cards; do not build new login UI.
- The staged `portal-session-handoff` function in app.screenings4u.com now maps `ctpa_workforce` to the canonical `ctpa.screenings4u.com/auth-handoff.html` and requires exact NON-DOT membership and subscription selection. The production v96 handoff is **unchanged** until cutover.
- The staged WorkforceApps selector expects the canonical C/TPA handoff hostname for both DOT and NON-DOT.
- The staged C/TPA receiver redeems the existing one-time code, independently checks the matched NON-DOT membership/subscription/plan and enters `nondot-workspace.html` rather than a DOT page.
- `workspace.html` in the C/TPA migration branch now delegates directly to the existing WorkforceApps selector. An incomplete handoff returns there as well; there is no second C/TPA-specific workspace chooser for migrated users.
- The NON-DOT session guard bypasses cached authorization and restricts NON-DOT-only sessions to the authorized NON-DOT workspace. Other DOT pages remain protected by the DOT subscription guard.
- New `scripts/verify-unified-ctpa-handoff.mjs` in the C/TPA branch checks SSO surface isolation and redirect invariants without requiring customer credentials.
- Cutover remains blocked on end-to-end authenticated staging tests for C/TPA DOT-only, NON-DOT-only, combined, multi-organization, expired, revoked, and replayed handoff tokens. Do not merge, deploy the staged central handoff, or retire the old NON-DOT portal until those tests pass.

### NON-DOT write migration — employee and program creation (staged)
- The consolidated C/TPA NON-DOT workspace now offers responsive forms to **create employees and company-policy programs** for authorized primary account managers.
- An authenticated request to `workforce-ctpa-nondot-workspace` (v8, JWT verification active) first verifies the selected NON-DOT subscription and enabled feature; it requires explicit NON-DOT operating context, an active primary Workforce organization membership, no personal portal revocation, and an Employer record owned by the exact selected NON-DOT C/TPA.
- Writes are allowlisted to `save_employee` and `save_program`, with accepted fields whitelisted before delegating to the original Workforce NON-DOT program service. The source service also checks employer/CTPA ownership.
- These initial write calls only accept the **latest active subscription**, matching the existing legacy service's subscription selection. Other subscriptions must not create records until legacy action APIs support selected subscription IDs.
- The interface hides creation forms unless the backend declares `can_manage=true`; UI state is not an authorization boundary. Non-primary users remain read-only.
- DOT-origin C/TPA sessions remain read-only on the NON-DOT workspace during this transition. A NON-DOT-only verified handoff uses its independent membership.
- All other NON-DOT actions—testing orders, random draws, result release, updates/deletions, supply management, document delivery—remain out of scope until individually authorized and migrated.
- C/TPA migration-branch HTML, JS and CSS are versioned to load the new form code. `scripts/verify-nondot-write-migration.mjs` stages regression checks. UI syntax and backend authorization source checks passed. No authenticated browser submission was run; do not merge to production solely on source checks.

### NON-DOT draft pools and testing orders — next staged build
- Consolidated C/TPA NON-DOT workspace now supports owner-verified **draft random-pool creation**, constrained to the selected NON-DOT employer and company-policy program. Creating a pool does not execute a random selection.
- Consolidated NON-DOT testing-order creation now uses a company-scoped employer, employee, and NON-DOT program selector and supports drug/alcohol order types. Backend rechecks all three record relationships independently of the UI.
- `workforce-ctpa-nondot-workspace` v10 is deployed with JWT verification and explicit feature permission checks (`consortium_pools`, `testing_orders`), active current subscription, primary membership, no explicit personal revocation, and resource ownership.
- Current C/TPA migration branch loads these forms through `assets/js/nondot-workspace.js` and the existing shared portal router and styling. No production C/TPA web branch or central WorkforceApps handoff was updated.
- `scripts/verify-nondot-write-migration.mjs` now includes static checks for employer-scoped pool choices and testing-order routing. These source checks and JS syntax are not substitutes for authenticated creation-flow tests.
- **Security prerequisite for cutover:** the legacy `nondot-workforce-ctpa-programs`, `nondot-workforce-ctpa-pools`, and `nondot-workforce-ctpa-testing` functions contain their own authorization logic, some of which does not duplicate the new tier, role, or per-user revocation checks. Harden original source endpoints (or prevent direct mutations) before allowing users to rely on the new role restrictions. The wrapper by itself does not eliminate a possible direct legacy-endpoint path.
- **Functional prerequisites:** test payment/billing implications of the original testing-order create action, prevent accidental duplicate submissions, then integrate order status, fulfillment and completed CCFs through Workforce management. Do not claim physical lab orders are transmitted or paid merely by creating the NON-DOT order record.
- **Remaining:** pool membership assignments, pool activation and random draw scheduling, employee/program edits, test-order modifications, result delivery, laboratory management, full three-tier integration, and authenticated cross-tenant regression QA.

### NON-DOT legacy endpoint hardening — isolated deployment checkpoint
- Discovered that the original NON-DOT program/employee, pool and testing functions did not consistently check purchased feature flags, account-specific overrides, active C/TPA plans, user-level access revocation, or primary-account-manager permissions on direct mutations.
- Staged hardened source for all three under `supabase/functions/nondot-workforce-ctpa-{programs,pools,testing}/index.ts` in the app migration branch. Legacy production endpoint code remains unchanged because replacing it without verifying old clients might break customer access.
- Deployed **new separately named** JWT-protected functions: `workforce-ctpa-secure-programs` v1, `workforce-ctpa-secure-pools` v1, `workforce-ctpa-secure-testing` v1.
- Deployed `workforce-ctpa-secure-result-summaries` v1. It verifies the precise NON-DOT C/TPA workspace, active subscription, primary organization membership, portal and user-level access, feature grants and overrides; it returns only summary metadata, not full MRO documents, download links or delivery actions.
- The consolidated `workforce-ctpa-nondot-workspace` v12 now invokes the hardened services, including secure result summaries. The combined `workforce-ctpa-combined-access` v5 now passes the **actual current NON-DOT subscription ID** separately from DOT, and the wrapper uses that ID for both surfaces' NON-DOT reads.
- Introduced `scripts/verify-ctpa-secure-backends.mjs` to detect regressions in the new service boundaries and authorization-source checks. Independent inspection passed 35/35 static policy checks.
- Original `nondot-workforce-ctpa-results` still exists and can receive direct download/delivery requests. It must be hardened or disabled only after all legacy consumers are migrated, and after explicit release/recipient authorization is verified.
- None of these changes copy customer data, alter payments or subscription entitlements, replace existing legacy functions, redirect source repos or merge the browser migration branch into production.
- **Cutover remains blocked** until authenticated positive/negative backend tests, source endpoint direct-access audits, and order/result business workflow tests are completed.


## November 12 — NON-DOT draft pool editing (migration branch only)
- Implemented `update_pool` in `workforce-ctpa-nondot-workspace` source. It requires a verified NON-DOT subscription, enabled `consortium_pools` feature, and active primary C/TPA membership with portal access.
- Only an existing employer-owned, NON-DOT, `workforce`-surface, **draft** pool for the verified C/TPA can be renamed. The employer must also be an active NON-DOT company under that C/TPA. Requests cannot change the program, employer, policy, selection schedule, pool classification or status.
- Added draft-pool editing forms to `ctpa.screenings4u.com` with the corresponding `app.js` action allowlist and a refreshed script version.
- GitHub source consistency checks passed for the action registration, UI handler and backend constraints; this is **not** an authenticated integration test.
- **Not deployed or released:** Deploy the revised Edge Function in the appropriate preproduction environment, run authentication, same-company/wrong-company, read-only role, revoked and expired subscription, live/draft pool, and browser UI tests before release. Do not switch the central selector handoff or retire any repo during this checkpoint.


## November 12 — NON-DOT employee-number edit integration
- Continued the already-approved C/TPA consolidation on the existing migration branches. No new portal, separate login, subscription, or CSS shell was introduced.
- The secure NON-DOT workspace now includes `employee_number` in its sanitized employee list, validates an optional number of at most 40 characters, and permits it in the narrowly scoped `update_employee` allowlist. Required first/last names remain required even when the employee number is blank.
- The consolidated C/TPA Employees view shows the number and its existing edit form can change or clear it. The page version was refreshed to avoid stale JavaScript.
- Verified that the original NON-DOT employee service reads this column and that the update remains restricted to an authorized current NON-DOT subscription, enabled employee feature, active primary membership, personal portal access, employer ownership and `business_surface=workforce`. These are source-level checks, not a substitute for live policy tests.
- Added `scripts/verify-ctpa-nondot-employee-edit.mjs` for future regression checks. A separate current-turn source comparison passed 16/16 checks and browser module syntax parsing.
- **Release gate unchanged:** Edge Function revision is staged in GitHub, not deployed by this checkpoint. Authenticated create/edit/read tests (including blank numbers, unauthorized users, revoked subscriptions, alternate companies, and production billing/order regressions) must pass before switching the WorkforceApps handoff or retiring a legacy portal.


## November 12 — NON-DOT testing order collection deadline editor
- Continued the approved single-login C/TPA consolidation branch without changing customer subscriptions, checkout, billing, source portals or production routing.
- Added a restricted `update_test_deadline` mutation to `workforce-ctpa-nondot-workspace`. Only a current, verified NON-DOT C/TPA primary account manager with the purchased `testing_orders` feature can request it.
- The service retrieves the existing order and verifies the order is still `created`, belongs to a non-archived NON-DOT employer owned by the selected C/TPA, and has `program_type=NON_DOT` and `business_surface=workforce`. The update atomically rechecks `created` status, employer ID and the regulatory fields.
- The only business field updated is `collection_deadline`; it must be a valid UTC timestamp in the future and no more than 366 days out. No result, CCF, selection, billing, or order-fulfillment state is changed.
- Existing C/TPA testing UI shows the deadline and adds a local-time editor for orders in `created` state. The existing authorized mutation router allows the new action and page script versions have been refreshed.
- 17/17 source wiring and security assertions plus browser JavaScript parse succeeded. Database metadata was verified read-only: `workforce_testing_orders.collection_deadline` is a nullable timestamp with time zone.
- **Release gate:** Code is on GitHub migration branches only. Before deploying, verify tests for genuine NON-DOT manager, read-only user, revoked access, wrong company, DOT-only subscription, expired plan, non-created order, date boundaries, concurrent status change, DST/local-time conversion, and legacy testing-order effects. The central handoff and legacy repos must not be retired before authenticated end-to-end sign-off.


## November 12 — secured NON-DOT order retry and deployable service sources
- Implemented stable UUID-based request identifiers for the consolidated NON-DOT testing order form. The first submission keeps its identifier for retries; changing the form creates a new identifier.
- The backend derives a stable `NDT-<UUID>` order number and relies on the **existing** unique `workforce_testing_orders.order_number` database constraint (verified read-only from the connected enterprise database). Same-ID retries return the existing order only after verifying `created_by`, employer, employee, program, test type, NON-DOT program classification, and Workforce business surface. Concurrent insert collisions are resolved through PostgreSQL unique error `23505`; mismatching identities return 409.
- The new `workforce-ctpa-nondot-workspace` bridge requires a valid request UUID and forwards it to `workforce-ctpa-secure-testing`.
- Versioned all three separately named secure source endpoints under `supabase/functions/workforce-ctpa-secure-{programs,pools,testing}/index.ts`, which previously existed as deployed function names without corresponding migration-branch source files. The secure testing source now includes the retry implementation.
- Added `scripts/verify-ctpa-order-idempotency.mjs`. Verified 15/15 current-turn source wiring checks and browser JS syntax. The checks are not equivalent to actual duplicate-order or payment integration tests.
- **Still required before release:** build/deploy these secure endpoints into an isolated test environment, run authenticated same-request and concurrent duplicate trials, check cross-tenant denial, employee/program/employer mismatch, revoked subscriptions, and confirm no billing/fulfillment side effects. The central handoff remains on the current production destination until all cutover gates pass.
- No production functions were deployed, no plan prices or subscription rows changed, and no repository or domain was deleted or redirected.


## November 12 — C/TPA NON-DOT pre-fulfillment order cancellation
- Added a manager-only `cancel_test_order` action through the existing C/TPA NON-DOT workspace, using the existing WorkforceApps handoff and portal navigation; no new login, portal shell, or separate customer data source.
- The action verifies the selected active NON-DOT subscription, `testing_orders` feature, primary manager, user-level portal access and matching C/TPA. It delegates to the separately named, verified `workforce-ctpa-secure-testing` endpoint.
- Hardened the secure testing source `archive_order` to allow `created` orders only when assignment, notification, scheduling, collection and completion timestamps are all null. It also verifies the employer belongs to the authorized C/TPA and the order is `NON_DOT` / `workforce`, then conditionally updates only `status=cancelled` and `updated_at`. Failed concurrent state changes return 409.
- Hardened the dedicated secure testing `update_order` action to forbid updates after fulfillment and to accept only a validated UTC collection deadline within 366 days; it no longer changes the collection site through that action. The historical live legacy endpoint is untouched.
- The existing NON-DOT Testing Orders page now renders cancel controls only for eligible unfulfilled orders, with the established `S4UDialog.confirm` Workforce-branded confirmation, explicit no-refund/no-invoice-cancellation wording, disabled buttons during requests and displayed errors. Its script URL is refreshed.
- Source verification passed 16/16 checks; browser JavaScript syntax check passed. Added `scripts/verify-ctpa-nondot-order-lifecycle.mjs` for repeatable source checks.
- **Deployment remains separate from GitHub commits.** Before releasing, run authenticated positive/negative company and feature tests; simulate an order changing state concurrently; validate interaction with existing paid orders, downstream testing tickets and staff processing; verify returned order status; test mobile portal and legacy route. Do not merge to production or redirect original login until those gates pass.
