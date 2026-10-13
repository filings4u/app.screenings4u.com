# screenings4u — Global Customer Identity, Tracking and Lifecycle Standard

Status: Architecture specification (not yet a production database migration)
Owner: Central management / all DOT, NON-DOT, training and enterprise portals
Date: 2026-10-13

## Core invariant
One canonical authenticated person (auth.users.id) per verified email; one profile for that person; 0..N organization memberships, purchases, subscriptions, portal entitlements, tickets and activity records. Do NOT merge different legal organizations or subscriptions just because the same email manages them. Identity is distinct from accounts. Do not attempt to merge auth.users automatically based on an unverified email address.

## Identifiers (preserve all)
- **Global customer ID**: immutable UUID tied to canonical auth user (existing auth.users.id may serve as the underlying identity key); expose safe display ID separately.
- **Global account tracking number**: immutable unique human-readable identifier for *each account relationship*, e.g. a customer's specific organization/workspace account. Must be server-generated, unique, unguessable enough not to confer access; links to organization_id, owner user_id and optional tenant. Never reuse upon revocation.
- **Purchase/order tracking number**: unique reference for every purchase, whether the source is public checkout, staff-created order, renewal or adjustment. Record source as public_checkout, staff_admin, portal, migration, etc. Admin-created purchases should use the same order ledger and a separate source field, not a competing numbering namespace that obscures reporting.
- **Subscription ID / display reference**: stable per purchased recurring subscription; track renewals, replacements, invoice/payment references. A single global account can contain multiple subscription IDs.
- **Portal entitlement ID**: immutable UUID per user + account + portal + subscription (nullable when a non-purchased entitlement is justified). Exact entitlement row is the access-control unit, NOT email, hostname or portal_code alone.
- **Support ticket number**: unique reference for each inquiry; one ticket can link multiple account, order, subscription, or portal references through a ticket-reference junction table, with one primary account when known. Never use an order tracking number as the support ticket ID.
- **External references**: retain Stripe payment/subscription IDs, legacy order IDs, training enrollment IDs and partner/lab references with typed namespace and source-system labels. Never silently replace legacy IDs.

## Proposed normalized data model
1. global_customer_profiles(customer_id UUID PK, auth_user_id UUID UNIQUE, display_name, canonical_email, contact metadata, created_at, updated_at)
2. global_customer_accounts(account_id UUID PK, global_tracking_number TEXT UNIQUE NOT NULL, organization_id UUID nullable, tenant_id UUID nullable, status, created_at, updated_at, closed_at). One row per distinct account relationship; *not* one row per email.
3. global_customer_account_memberships(id UUID PK, customer_id, account_id, role, status, created_at, updated_at), unique(customer_id,account_id) for current membership.
4. global_customer_orders(id UUID PK, account_id, source_system, source_type, source_order_id, purchase_tracking_number TEXT UNIQUE, placed_by_user_id, placed_by_staff_id, created_at, status, metadata), with typed mappings to pre-existing orders/order_items. No destructive copying of payment records.
5. global_customer_subscriptions(id UUID PK, account_id, source_system, source_subscription_id, plan_id, status, started_at, ended_at, renewal metadata), with unique(source_system,source_subscription_id).
6. global_portal_entitlements(id UUID PK, customer_id, account_id, portal_code, subscription_ref nullable, permission_level, status enum/granted/revoked/suspended, grant_source, granted_at, revoked_at, granted_by, revoked_by, updated_at). Set unique rules according to whether multiple active subscriptions may coexist for same portal. Index on customer_id/account_id/portal_code/status. A revocation targets an exact entitlement ID.
7. global_customer_reference_links(id UUID PK, customer_id, account_id nullable, reference_type, source_system, reference_value, source_record_id nullable, created_at); search across all references with scoped authorization. Avoid globally unique reference_value without reference_type + source_system.
8. global_customer_support_tickets / global_support_ticket_links: map existing workforce_support_tickets, dot_support_tickets, support_tickets, screenings4udotcom_support_tickets rather than deleting/replacing those tables; link tickets to account, entitlement, order and subscription references, and keep messages/attachments in their source.
9. global_customer_lifecycle_events(id UUID PK, customer_id, account_id nullable, entitlement_id nullable, event_type, source_system, source_record_id, actor_id, occurred_at, change_summary JSONB, correlation_id), append-only audit log (subject to applicable privacy/data retention controls). Avoid storing credentials, tokens or raw payment details.

All tables require planned foreign keys, RLS/service authorization, indexes and uniqueness checks before production. Use server-generated IDs and transactions to prevent orphaned entitlements. Mask sensitive data in UI and logs.

## Resolution rules
- Email locates a canonical person, never determines the entitlement by itself.
- A user's account tracking number resolves exactly one account. A purchase tracking number resolves exactly one order, which links to the account and optionally a subscription.
- If staff search by email, show the person once, then all related accounts and associated subscriptions/entitlements. If staff search by tracking/reference, resolve the exact typed record and open the same customer profile focused on the matching row.
- Role scopes must distinguish staff access, customer membership and effective portal entitlement.
- No account/portal access based only on email match, customer profile, organization existence, or an expired subscription.
- Revoked entitlement is removed from central selector for that specific account/subscription and blocked by handoff and protected APIs. Existing portal UI must get a revocation signal or periodically recheck its *exact* entitlement; terminate that portal session without destroying access to unrelated accounts. New rows must not resurrect previously revoked entitlements.
- Selector cards are keyed by entitlement_id or account_id + portal_code + subscription_id; multiple subscriptions can produce multiple legitimate cards. Avoid duplicate cards for the same exact entitlement.
- Prefer server-pushed invalidation; fallback polling checks authorization state but NEVER reloads/redraws the page on unchanged data or errors. Fail closed for protected operations, distinguish transient outage from explicit revoke.

## Management portal: Global Customer 360
Customer search accepts email, name, customer ID, global account tracking, order tracking, subscription/reference ID, portal hostname/code and ticket number. Search results deduplicate by customer_id.

Customer profile header: verified identity, customer ID, primary email, contacts, account count, active portal/subscription count, latest activity and staff ownership.

Tabs / embedded panels:
- Overview and chronological lifecycle feed, including date/time, actor, change source and linked records (purchase, grant, renewal, support, suspension, revoke)
- **Accounts**: one row per account tracking number with organization, portal(s), plan(s), membership, start/end, order(s), subscription(s), status
- **Access**: one row per portal entitlement with portal name, account tracking number, organization, subscription, permission level, grant/revoke/suspend control and audit reason
- **Purchases & Billing**: checkout vs admin purchase clearly labeled, purchase tracking, orders, invoices, payment/renewal history, refunds, disputes
- **Support**: all linked tickets, messages, attachments, caller verification, communications, SLA, priority, resolutions and reassignment
- **Documents**: scoped agreements and downloadable artifacts
- **Audit History**: immutable security and administration activity
- Cross-links to native source management screens for specialized operations.

For phone/email requests: verify caller identity/authority before disclosing or modifying accounts. Search using any ID/email; show potentially matching accounts; confirm *which tracking number/account* the issue relates to; open a ticket attached to precise account, order, subscription and portal entitlement links. Keep ticket visible both on the global customer profile and in the specialized portal management screen.

## Global rollout plan (no direct legacy record rewrites)
Phase 1: inventory existing IDs and source-of-truth tables; identify duplicates and conflicts; add schema, indexes, foreign keys, RLS, server-side identifier generator, migration/backfill mapping and audit events on a staging project.
Phase 2: backfill read-only identity-to-account-to-order/subscription links; validate counts/uniqueness by source. Preserve every original ID and original organization boundary.
Phase 3: deploy customer-360 read API and management profile/tables; search by all identifiers; verify least-privilege visibility.
Phase 4: migrate new purchase/admin provisioning paths to mint account/order references; attach new subscriptions to accounts; no duplicate auth users.
Phase 5: update central selector, handoff and each portal authorization/API to use exact entitlement IDs; add revocation event handling and non-disruptive session enforcement.
Phase 6: unify support intake and ticket reference links across DOT/NON-DOT/main website. Run regression tests for 1 user/100 accounts, one portal/three subscriptions, partial revocations, renewals, inactive membership, old open session, concurrent edits, and support lookup.
Phase 7: roll out globally to each management portal using same customer-360 component/API, with platform-specific tabs only when needed. Audit deploy versions and ownership.

## Current production discovery (2026-10-13)
- Supabase already has auth.users, user_profiles, organizations, workforce_memberships, workforce_portal_user_access and workforce_portal_access.
- orders.tracking_number exists; subscriptions.order_reference and workforce_subscriptions.order_reference exist; workforce enrollment documents have tracking_number. These are NOT yet a unified global account tracking identifier.
- Existing support tables include dot_support_tickets, workforce_support_tickets, screenings4udotcom_support_tickets and support_tickets. Preserve their histories.
- Existing C/TPA NON-DOT entitlement edits currently use user + organization + portal, not exact subscription scope. This must change only after backfill and enforcement are validated.
- This document is a **design contract**, not evidence that schema, UI, API, access controls or multi-portal migration have been implemented.
