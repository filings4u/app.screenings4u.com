# IC Work Order Redesign — Implementation Contract

## Scope
Admin application: `app.screenings4u.com`. Contractor application: `independent-contractor.screenings4u.com`. The `workforce.screenings4u.com` marketing website is excluded. Retire the legacy Global Work Orders interface and endpoint after the new code reaches production; retain existing work-order, service, assignment, progress, and audit rows.

## Required dispatch sequence
1. Admin receives phone/email request for mobile, onsite, post-accident or other testing.
2. Select existing customer or create customer; search available collectors by city/ZIP, service radius, credentials, availability and insurance.
3. Support multi-select from collector search cards, including Create Work Order action; allow editing selected recipients in the form.
4. Full work order document with customer, site/contact/address, dates/timezone, service type/purpose, donors, service lines, rates/fees, supplies, specimen/collection method, safety, onsite instructions, documentation, terms, attachments, and internal-only notes. Prefer dropdowns, autocomplete and paste-friendly fields; support save draft and preview.
5. On Send, create one independent invitation per selected IC; branded email links to authenticated IC work-orders list with target assignment query. No invitation may set the parent work order's awarded collector.
6. IC list shows all own invitations with newest/unread indicator. Offer detail shows complete permitted work order, with Accept and Decline.
7. Accept opens mandatory supplies yes/no, ETA datetime with timezone, terms checkbox, working phone yes/no, transport yes/no, professional liability insurance yes/no. Insurance "No" opens link to insurance page. Validate insurance on server before awarding and before starting, not just the checkbox.
8. Decline locks that invitation with explanation that another opportunity may follow.
9. Accept saves immutable snapshot of checklist and terms version, transitions only the invitation to `pending_admin_review` and locks further IC responses; message: "Accepting this work order does not mean you will be granted this work order. We consider prior work order history, performance, error-free completion, customer complaints, and other factors."
10. Branded admin email and dashboard review queue show accepted contractor, ETA, compliance and history. Admin Approve or Deny, with recorded actor and reason.
11. Award must be atomic and exclusive: one work-order winner; all other pending/review invitations close without disclosing other contractors' details. Branded award email links to the approved portal work order.
12. Approved page allows Start only for the awarded IC and valid insurance. Server records `started_at` once; UI elapsed timer derives from server timestamp and survives refresh/closing browser.
13. Existing IC site flow retains location check-in, uniform selfie, pretest start, donor ID secure upload, incidents, finish time, custody copies, departure, scan confirmation, submit for admin review and corrections/payment review. Distinguish elapsed work-order time from collection-specific timestamps.
14. Preserve work-order events and audit trail, branded email delivery statuses, idempotency, role checks and per-collector authorization; protect donor PII and uploaded files.

## State model
Invitation: draft → sent/pending → declined | pending_admin_review → approved/awarded | denied | closed_not_selected.
Parent order: draft → dispatched → awarded → in_progress → submitted_for_review → completed (plus cancelled). One awarded collector maximum.

## Existing compatibility warning
The original `global-work-orders` function was copied to `ic-work-order-management` solely to detach the old name. Its old `assign` action still immediately sets `assigned_collector_id`; the IC workspace still transitions accept directly to `accepted`. These MUST be replaced together before enabling multi-IC award. Do not deploy the new frontend as a finished workflow yet.

## Cutover checklist
- Ship and test updated admin, IC and backend together.
- Ensure old Global Work Orders navigation and scripts are gone.
- Verify emails/redirect, approvals, race condition, invalid insurance, timer, refusal, and existing completed jobs.
- Only then retire old live `global-work-orders` endpoint. Do not delete `testing_work_orders`, `testing_work_order_assignments`, `testing_work_order_services`, or audit records.
