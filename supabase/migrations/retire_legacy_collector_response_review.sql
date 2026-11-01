-- Retire the legacy public token-based collector response and view RPCs only after
-- the authenticated IC replacement has been fully deployed and tested.
-- Confirmed signatures against information_schema.parameters on 2026-11-01.
revoke all on function public.testing_collector_work_order_respond(text,text,text) from public,anon,authenticated;
revoke all on function public.testing_collector_work_order_view(text) from public,anon,authenticated;
-- Later, after a full dependency audit, DROP FUNCTION may replace these revocations.
-- Do not delete work orders, services, assignments, event history or documents.
