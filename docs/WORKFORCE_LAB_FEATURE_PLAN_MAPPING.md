# Workforce laboratory features: C/TPA and Employer tier design
Date: 2026-11-11
Status: proposal staged for migration; **not a live plan, checkout, or entitlement change**.

## Architecture
- Build one complete, reusable Workforce feature inventory with Enterprise capabilities present in the code.
- The purchased **subscription** decides which features are enabled (Essential, Professional, Enterprise).
- A separate company-level **Lab Account one-time add-on** activates laboratory account numbers, lab ordering privileges, supply/shipment workflows and Lab-specific management tools.
- Never grant a lower tier's user access to a higher tier's tools just because the code is present.
- Do not sell a customer consortium, employee management, ordinary testing orders, basic result visibility, or document storage twice when their existing subscription already includes them.
- `app.screenings4u.com` owns Workforce plan catalog, pricing, customer provisioning and company entitlements.
- `testing-portal.screenings4u.com` provides authorized testing operations information to Workforce management; it is not the primary Workforce management UI.
- `ctpa.screenings4u.com` and the future `employer.screenings4u.com` are customer interfaces to that managed data.
- Preserve legacy paid Lab Account customers without forcing repurchase.
- Training, LMS, and training portal are out of scope.

## Proposed placement of the existing Lab Account feature catalog

| Lab Account feature | C/TPA subscription placement | Employer subscription placement | Extra conditions |
|---|---|---|---|
| Testing orders and status tracking | Essential+ (existing testing_orders) | Essential+ (existing testing_orders) | Lab-direct ordering additionally requires company Lab add-on |
| Customer-managed consortium programs | Essential+ (existing consortium_pools) | Own-workforce random pool from Essential+ (existing random_pool) | Do not expose C/TPA client pools to Employer |
| Consortium participant management | Essential+ | Employee/pool participants Essential+ | Existing respective ownership model |
| Consortium selection calendar | Essential+ (existing random_selections) | Essential+ (existing random_selections) | Keep official execution/report permissions separate |
| Consortium participation PDF | Essential+ as customer-maintained record | Essential+ own workforce record | Never claim this is an official C/TPA regulatory certificate |
| Private client/employee directory | Essential+ (existing employer_management) | Essential+ (existing employee_management) | Employer accesses only its own employees |
| Account compliance document library | Essential+ (existing documents) | Essential+ (existing documents) | Per-organization and role document policies |
| Released CCF document archive | Basic released records: Essential+; advanced access: Professional+ | Basic released records: Essential+; advanced access: Professional+ | Only released records, with authorization; Lab-specific archive requires Lab add-on |
| Released MRO reports | Result summary: Essential+; sensitive/full reports: Professional+ | Result summary: Essential+; sensitive/full reports: Professional+ | Maintain MRO release restrictions and role checks |
| Testing activity reporting | Standard reports: Essential+; advanced analytics: Professional+ | Standard reports: Essential+; advanced analytics: Professional+ | Existing standard_reports/advanced_reports flags |
| Secure result delivery requests | Professional+ where customer_portal_delivery is enabled | Employer internal result delivery through existing result features | External distribution is **not** automatically included in Employer plans; separate approval required |
| Branded client document templates | General docs Essential+; branded templates Enterprise | General docs Essential+; branded templates Enterprise | Respect existing white_label/branded_documents catalog flags |
| Audit preparation records inventory PDF | Enterprise (audit_history) | Enterprise (audit_history) | Report is an inventory, not a regulatory audit |
| FMCSA Clearinghouse setup checklist | Enterprise, where clearinghouse_tools is enabled | Do not enable automatically; Employer Enterprise clearinghouse_tools currently disabled | Checklist is not FMCSA registration |
| Lab Account dashboard | Available with active Lab add-on | Available with active Lab add-on | Company-level verified one-time purchase |
| DOT and NON-DOT laboratory accounts | Available with active Lab add-on | Available with active Lab add-on | Assigned lab numbers must belong to company |
| Supply ordering and carrier shipment tracking | Available with active Lab add-on | Available with active Lab add-on | Own physical supply orders only |
| Supply reorder alerts | Available with active Lab add-on | Available with active Lab add-on | Only supply records linked to company |

## Actual catalog checks (not inferred from plan names)
- C/TPA Essential includes employer management, employees, programs, pools, random selections, testing orders, results summary, standard reports, documents and client invoicing.
- C/TPA Professional adds advanced reports, sensitive results, collection sites and customer portal delivery.
- C/TPA Enterprise adds integration, team users, white label, audit history, clearinghouse tools and more; **client_payments is explicitly disabled even for Enterprise**.
- Employer Essential includes employee management, programs, random pool, random selections, testing orders, results summary, documents and standard reports.
- Employer Professional adds advanced reports, collection sites, sensitive results, role support and related controls.
- Employer Enterprise adds audit history, integrations, locations, white label, and more; **clearinghouse_tools is explicitly disabled in the currently checked DOT Employer Enterprise catalog**.
- Inspect the NON-DOT Employer workspace's actual entitlement context before changing that portal; its current navigation sometimes detects Enterprise through a text search over serialized context, which should be replaced by explicit verified feature codes.

## Implementation gates
1. Inventory and complete Enterprise-capable modules in C/TPA, preserving existing features.
2. Introduce explicit server-verified feature and role guards for each page and API. Browser navigation visibility is never security.
3. Build the shared company Lab add-on provisioning service in Workforce management, triggered only by verified paid checkout or reviewed legacy grant.
4. Reuse Lab-specific backend services for C/TPA and Employer rather than cloning customer records or shell code.
5. Keep ordinary C/TPA subscription features accessible according to the existing catalog even without Lab add-on.
6. Reconcile the remaining unmatched legacy Lab Account purchase manually.
7. Test Essential/Professional/Enterprise and add-on on/off, including team roles and cross-organization data denial.
8. Change published pricing/features only after approved tier mapping and verified end-to-end access checks.

No production pricing or existing subscription rows were modified by this document.
