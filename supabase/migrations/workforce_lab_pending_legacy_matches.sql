-- Idempotent, non-granting migration staging query.
-- Only creates PENDING entitlement mappings; no new customer access is enabled.
-- A purchaser must have a paid order, exactly one active C/TPA organization membership,
-- and a matching primary organizational email. Ambiguous and unmatched accounts are excluded.
with candidates as (
 select distinct
  i.id as intake_id,i.customer_user_id,i.order_id,c.id as ctpa_id,o.id as organization_id
 from public.lab_account_intakes i
 join public.orders ord on ord.id=i.order_id and ord.payment_status::text='paid'
 join public.organization_memberships m on m.user_id=i.customer_user_id and m.status='active'
 join public.organizations o on o.id=m.organization_id
 join public.ctpas c on c.organization_id=o.id and c.status='active'
 where lower(trim(o.primary_email))=lower(trim(i.customer_email))
), valid_candidates as (
 select *,
  count(*) over(partition by intake_id) as intake_matches,
  count(*) over(partition by ctpa_id) as company_intakes
 from candidates
)
insert into public.workforce_lab_company_entitlements
 (organization_id,ctpa_id,linked_customer_user_id,source_order_id,grant_source,status,notes)
select organization_id,ctpa_id,customer_user_id,order_id,'legacy_migration','pending',
 'Pending review: legacy Lab Account purchase and organization membership matched; not customer-accessible'
from valid_candidates c
where intake_matches=1 and company_intakes=1
and not exists (
 select 1 from public.workforce_lab_company_entitlements e
 where e.ctpa_id=c.ctpa_id and e.entitlement_code='lab_account'
 and e.status in ('pending','active')
)
on conflict do nothing;
