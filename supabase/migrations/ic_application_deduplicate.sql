-- Old applications remain for audit, not as separate active applicants.
alter table public.collector_network_submissions drop constraint if exists collector_network_submissions_status_check;
alter table public.collector_network_submissions add constraint collector_network_submissions_status_check
 check (status in ('new','reviewing','contacted','approved','declined','rejected','inactive','superseded'));
create table if not exists public.ic_application_supersessions (
 id uuid primary key default gen_random_uuid(),
 old_application_id uuid not null references public.collector_network_submissions(id),
 current_application_id uuid not null references public.collector_network_submissions(id),
 match_reason text not null,
 superseded_at timestamptz not null default now(),
 unique(old_application_id)
);
alter table public.ic_application_supersessions enable row level security;
revoke all on public.ic_application_supersessions from anon,authenticated;
-- For duplicate active applications with the same normalized email, newest submission wins.
with ranked as (
 select id,email,first_value(id) over (partition by lower(trim(email)) order by created_at desc,id desc) as newest_id,
 row_number() over (partition by lower(trim(email)) order by created_at desc,id desc) as rn
 from public.collector_network_submissions
 where email is not null and trim(email)<>'' and status in ('new','reviewing','contacted')
), archived as (
 update public.collector_network_submissions c set status='superseded', updated_at=now()
 from ranked r where c.id=r.id and r.rn>1
 returning c.id
)
insert into public.ic_application_supersessions(old_application_id,current_application_id,match_reason)
select r.id,r.newest_id,'same_normalized_email' from ranked r join archived a on a.id=r.id
on conflict (old_application_id) do nothing;
