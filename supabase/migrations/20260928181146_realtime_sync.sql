-- Keep devices in sync (#17): publish changes to the app's tables through
-- Supabase Realtime. The app listens and refetches what changed.
--
-- Realtime applies row-level security to inserts and updates, so each
-- subscriber only receives their own rows. Deletes only carry primary keys.
alter publication supabase_realtime
  add table public.projects, public.ideas, public.tasks, public.task_events,
    public.reward_ledger;
