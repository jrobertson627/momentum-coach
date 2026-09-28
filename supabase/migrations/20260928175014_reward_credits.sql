-- Game-time credits (#15), and first steps as progress.
--
-- act_on_task now also:
--   * completed:  awards credits in the same transaction
--                 (1 minute per 2 minutes of estimated effort, at least 1)
--   * progressed: the task's smaller version is done; it's cleared and the
--                 task stays open. Earns credits for a 10-minute step.
-- The rate mirrors src/lib/rewards.ts (REWARD_RATE, SMALLER_STEP_MINUTES).
--
-- Spending needs no function: the app inserts a negative 'game_time' row and
-- the existing trigger rejects anything that would take the balance below 0.

create or replace function public.act_on_task(
  p_task_id uuid,
  p_kind public.task_event_kind,
  p_available_minutes integer default null,
  p_energy public.energy_level default null,
  p_deferred_until timestamptz default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reward_rate constant numeric := 0.5;
  smaller_step_minutes constant integer := 10;
  result public.tasks;
  earned integer;
begin
  if p_kind = 'completed' then
    update public.tasks
      set status = 'done', completed_at = now(), deferred_until = null
      where id = p_task_id and status = 'open'
      returning * into result;
    earned := greatest(1, ceil(result.estimated_minutes * reward_rate));
  elsif p_kind = 'progressed' then
    update public.tasks
      set smaller_version = null, deferred_until = null
      where id = p_task_id and status = 'open'
      returning * into result;
    earned := greatest(1, ceil(smaller_step_minutes * reward_rate));
  elsif p_kind = 'deferred' then
    if p_deferred_until is null or p_deferred_until <= now() then
      raise exception 'Choose a time in the future' using errcode = '22023';
    end if;
    update public.tasks
      set deferred_until = p_deferred_until
      where id = p_task_id and status = 'open'
      returning * into result;
  else
    select * into result
      from public.tasks
      where id = p_task_id and status = 'open';
  end if;

  if result.id is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  insert into public.task_events (task_id, kind, available_minutes, energy)
    values (p_task_id, p_kind, p_available_minutes, p_energy);

  if earned is not null then
    insert into public.reward_ledger (minutes, reason, task_id)
      values (earned, 'task_completed', p_task_id);
  end if;

  return result;
end;
$$;
