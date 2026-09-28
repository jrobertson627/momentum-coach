-- A finished first step (a task's "smaller version") is progress, not
-- completion: the task stays open. Kept in its own migration because a new
-- enum value can't be used in the transaction that adds it.
alter type public.task_event_kind add value 'progressed';
