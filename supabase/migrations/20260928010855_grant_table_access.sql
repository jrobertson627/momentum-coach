-- Grant the API roles explicit access to the app tables.
--
-- This project's default privileges don't give anon/authenticated/service_role
-- read or write access to new tables, so the initial migration left signed-in
-- users with "permission denied". Row-level security still decides *which*
-- rows each user can touch; these grants only allow the table to be used.

-- Signed-in users: full access to their editable data...
grant select, insert, update, delete on public.projects, public.ideas, public.tasks
  to authenticated;

-- ...append-only access to history...
grant select, insert on public.task_events, public.reward_ledger to authenticated;

-- ...and read access to the balance view.
grant select on public.reward_balances to authenticated;

-- service_role (server-side only, bypasses RLS) keeps full access for admin
-- tasks and future backend jobs.
grant select, insert, update, delete on public.projects, public.ideas, public.tasks,
  public.task_events, public.reward_ledger to service_role;
grant select on public.reward_balances to service_role;

-- TRUNCATE bypasses row-level security; the defaults granted it on the view.
revoke truncate on public.reward_balances from authenticated;
