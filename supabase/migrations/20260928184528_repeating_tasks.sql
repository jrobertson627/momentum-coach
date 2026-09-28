-- Repeating tasks (#20).
--
-- tasks.repeat holds the pattern as JSON, e.g.
--   {"kind": "daily"}
--   {"kind": "weekdays", "days": [1, 3, 5]}          (0 = Sunday)
--   {"kind": "interval", "every": 2, "unit": "week"}
--   {"kind": "monthly", "day": 1}
-- The app works out the next date (src/lib/repeat.ts) and passes it to
-- act_on_task. There's no pile-up: a repeating task is one row that's hidden
-- until its next date after each completion.

create function public.is_valid_repeat(r jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(r) = 'object' and case r->>'kind'
    when 'daily' then true
    when 'weekdays' then
      jsonb_typeof(r->'days') = 'array'
      and jsonb_array_length(r->'days') between 1 and 7
      and not exists (
        select 1 from jsonb_array_elements(r->'days') as d
        where d::text !~ '^[0-6]$'
      )
    when 'interval' then
      (r->>'every') ~ '^[0-9]{1,3}$'
      and (r->>'every')::int between 1 and 365
      and r->>'unit' in ('day', 'week')
    when 'monthly' then
      (r->>'day') ~ '^[0-9]{1,2}$'
      and (r->>'day')::int between 1 and 31
    else false
  end
$$;

revoke execute on function public.is_valid_repeat from public, anon;
grant execute on function public.is_valid_repeat to authenticated, service_role;

alter table public.tasks
  add column repeat jsonb
  constraint tasks_repeat_valid check (repeat is null or public.is_valid_repeat(repeat));

-- act_on_task gains p_next_occurrence. A new parameter means a new signature,
-- so the old function is dropped rather than replaced.
drop function public.act_on_task(
  uuid, public.task_event_kind, integer, public.energy_level, timestamptz
);

create function public.act_on_task(
  p_task_id uuid,
  p_kind public.task_event_kind,
  p_available_minutes integer default null,
  p_energy public.energy_level default null,
  p_deferred_until timestamptz default null,
  p_next_occurrence timestamptz default null
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
  select * into result
    from public.tasks
    where id = p_task_id and status = 'open'
    for update;
  if result.id is null then
    raise exception 'Task not found' using errcode = 'P0002';
  end if;

  if p_kind = 'completed' then
    if result.repeat is not null then
      -- Repeating: stays open, comes back on its next date.
      if p_next_occurrence is null or p_next_occurrence <= now() then
        raise exception 'A repeating task needs its next date'
          using errcode = '22023';
      end if;
      update public.tasks
        set completed_at = now(), deferred_until = p_next_occurrence
        where id = p_task_id
        returning * into result;
    else
      update public.tasks
        set status = 'done', completed_at = now(), deferred_until = null
        where id = p_task_id
        returning * into result;
    end if;
    earned := greatest(1, ceil(result.estimated_minutes * reward_rate));
  elsif p_kind = 'progressed' then
    update public.tasks
      set smaller_version = null, deferred_until = null
      where id = p_task_id
      returning * into result;
    earned := greatest(1, ceil(smaller_step_minutes * reward_rate));
  elsif p_kind = 'deferred' then
    if p_deferred_until is null or p_deferred_until <= now() then
      raise exception 'Choose a time in the future' using errcode = '22023';
    end if;
    update public.tasks
      set deferred_until = p_deferred_until
      where id = p_task_id
      returning * into result;
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

revoke execute on function public.act_on_task from public, anon;
grant execute on function public.act_on_task to authenticated, service_role;
