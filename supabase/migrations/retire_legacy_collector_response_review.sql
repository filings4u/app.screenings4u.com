-- Retire only the legacy public token-based collector response entry points.
-- Apply after the authenticated IC portal and management award workflow are deployed and tested.
-- Existing work-order records, assignments, services and audit history are retained.
revoke execute on function public.testing_collector_work_order_respond(text,text,text) from public, anon, authenticated;
-- The exact function signature must be verified before executing this migration.
-- Drop the legacy RPCs after checking pg_proc argument types and all callers.
