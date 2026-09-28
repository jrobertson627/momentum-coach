-- Acting on a recommendation (#14): complete, skip or defer a task, and log
-- the event with the check-in it happened in, all in one transaction.
--
-- security invoker: runs as the signed-in user, so row-level security still
-- decides which tasks they can act on. Someone else's task looks "not found".

create function public.act_on_task(
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
  result public.tasks;
begin
  if p_kind = 'completed' then
    update public.tasks
      set status = 'done', completed_at = now(), deferred_until = null
      where id = p_task_id and status = 'open'
      returning * into result;
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

  return result;
end;
$$;

revoke execute on function public.act_on_task from public, anon;
grant execute on function public.act_on_task to authenticated, service_role;
