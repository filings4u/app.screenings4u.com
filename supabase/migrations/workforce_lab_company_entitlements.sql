-- Workforce laboratory add-on ownership. No legacy customer records are modified.
-- Grants are provisioned by trusted Workforce management services after verified purchase
-- and explicitly associated with the C/TPA or Employer organization.
create table if not exists public.workforce_lab_company_entitlements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete restrict,
 ctpa_id uuid references public.ctpas(id) on delete restrict,
 linked_customer_user_id uuid references auth.users(id) on delete restrict,
 source_order_id uuid references public.orders(id) on delete restrict,
 entitlement_code text not null default 'lab_account',
 status text not null default 'pending' check (status in ('pending','active','suspended','revoked')),
 grant_source text not null check (grant_source in ('verified_purchase','legacy_migration','admin_adjustment')),
 approved_by uuid references auth.users(id),
 activated_at timestamptz,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint workforce_lab_entitlement_code check (entitlement_code='lab_account'),
 constraint workforce_lab_active_source check (status<>'active' or (source_order_id is not null or grant_source='admin_adjustment'))
);
create unique index if not exists workforce_lab_company_ctpa_unique on public.workforce_lab_company_entitlements(ctpa_id,entitlement_code) where ctpa_id is not null and status in ('pending','active');
create index if not exists workforce_lab_company_org_idx on public.workforce_lab_company_entitlements(organization_id,status);
alter table public.workforce_lab_company_entitlements enable row level security;
revoke all on public.workforce_lab_company_entitlements from anon,authenticated;
comment on table public.workforce_lab_company_entitlements is 'Company-scoped purchased Lab Account add-on; only trusted Workforce management can grant or change access.';
