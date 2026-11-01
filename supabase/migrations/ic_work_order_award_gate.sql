-- IC work-order state expansion. Run during coordinated admin/IC backend deployment.
alter table public.testing_work_order_assignments drop constraint if exists testing_work_order_assignments_status_check;
alter table public.testing_work_order_assignments add constraint testing_work_order_assignments_status_check check (status in ('pending','accepted','declined','expired','cancelled','pending_admin_review','awarded','denied','closed_not_selected','completed'));
create unique index if not exists one_awarded_ic_per_work_order on public.testing_work_order_assignments(work_order_id) where status='awarded';
-- Only authenticated management backend service role may execute award transition.
create or replace function public.ic_award_work_order(p_work_order_id uuid,p_assignment_id uuid,p_admin_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_collector uuid; v_existing uuid;
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Not authorized'; end if;
  perform 1 from public.testing_work_orders where id=p_work_order_id and status not in ('completed','cancelled') for update;
  if not found then raise exception 'Work order not available'; end if;
  select collector_id into v_collector from public.testing_work_order_assignments
   where id=p_assignment_id and work_order_id=p_work_order_id and status='pending_admin_review' for update;
  if v_collector is null then raise exception 'Contractor has not passed review'; end if;
  select id into v_existing from public.testing_work_order_assignments where work_order_id=p_work_order_id and status='awarded' limit 1;
  if v_existing is not null then raise exception 'Work order already awarded'; end if;
  update public.testing_work_order_assignments set status='awarded',updated_at=now() where id=p_assignment_id;
  update public.testing_work_order_assignments set status='closed_not_selected',updated_at=now()
    where work_order_id=p_work_order_id and id<>p_assignment_id and status in ('pending','pending_admin_review');
  update public.testing_work_orders set assigned_collector_id=v_collector,status='scheduled',accepted_at=now(),updated_by=p_admin_user_id,updated_at=now() where id=p_work_order_id;
  insert into public.testing_work_order_events(work_order_id,event_type,actor_type,actor_user_id,collector_id,notes)
    values(p_work_order_id,'collector_awarded','staff',p_admin_user_id,v_collector,'Exclusive IC award after management review');
  return jsonb_build_object('work_order_id',p_work_order_id,'assignment_id',p_assignment_id,'collector_id',v_collector);
end $$;
revoke all on function public.ic_award_work_order(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.ic_award_work_order(uuid,uuid,uuid) to service_role;
