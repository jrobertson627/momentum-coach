-- Cover the remaining foreign keys so cascades and joins don't scan the table
-- (flagged by the Supabase performance advisor).
create index ideas_promoted_project_id_idx on public.ideas (promoted_project_id);
create index reward_ledger_task_id_idx on public.reward_ledger (task_id);
