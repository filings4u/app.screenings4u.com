-- Workforce Lab Account company-grant reconciliation (read only).
-- This query must never activate, revoke, or alter entitlements.
-- Run against the connected screenings4u Enterprise database.
-- The output deliberately excludes customer names, emails, donor details and test results.
with grant_checks as (
 select
  e.id as grant_id,
  e.organization_id,
  e.ctpa_id,
  e.source_order_id,
  e.status as grant_status,
  e.grant_source,
  ord.payment_status::text as payment_status,
  (ord.paid_at is not null) as payment_timestamp_recorded,
  c.status as ctpa_status,
  (c.organization_id=e.organization_id) as ctpa_organization_matches,
  exists(
   select 1 from public.organization_memberships m
   where m.user_id=e.linked_customer_user_id
     and m.organization_id=e.organization_id and m.status='active'
  ) as purchaser_is_active_company_member,
  count(i.id) as matching_intake_count,
  count(i.id) filter (
   where i.status='completed' and i.account_status='active'
  ) as active_completed_intake_count,
  count(i.id) filter (
   where i.customer_user_id=e.linked_customer_user_id
  ) as purchaser_intake_match_count
 from public.workforce_lab_company_entitlements e
 left join public.orders ord on ord.id=e.source_order_id
 left join public.ctpas c on c.id=e.ctpa_id
 left join public.lab_account_intakes i on i.order_id=e.source_order_id
 where e.entitlement_code='lab_account'
 group by e.id,e.organization_id,e.ctpa_id,e.source_order_id,
  e.status,e.grant_source,ord.payment_status,ord.paid_at,
  c.status,c.organization_id,e.linked_customer_user_id
)
select
 grant_id,organization_id,ctpa_id,source_order_id,grant_status,grant_source,
 payment_status,ctpa_status,matching_intake_count,active_completed_intake_count,
 case
  when grant_status='active' then 'already_active_verify_periodically'
  when grant_status<>'pending' then 'not_pending_no_activation'
  when source_order_id is null or payment_status<>'paid' then 'hold_purchase_unverified'
  when ctpa_status is distinct from 'active' or
       ctpa_organization_matches is distinct from true then 'hold_ctpa_mismatch'
  when purchaser_is_active_company_member is distinct from true then 'hold_membership_missing'
  when matching_intake_count<>1 or purchaser_intake_match_count<>1 then 'hold_intake_mapping_ambiguous'
  when active_completed_intake_count<>1 then 'hold_lab_onboarding_incomplete'
  else 'candidate_for_manual_review'
 end as review_state
from grant_checks
order by review_state,grant_id;
