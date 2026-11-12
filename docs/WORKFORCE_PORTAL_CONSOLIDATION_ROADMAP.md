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
