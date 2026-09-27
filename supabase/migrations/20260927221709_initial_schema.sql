-- Momentum Coach: initial schema for the weekend MVP (#6).
--
-- Every table is owned by a user (user_id defaults to the signed-in user) and
-- protected by row-level security so each person only ever sees their own rows.
-- task_events and reward_ledger are append-only history: no updates or deletes.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.energy_level as enum ('low', 'medium', 'high');

-- active: counts toward the 3-project limit. paused: on hold, still visible.
-- finished: reached its definition of done. archived: hidden.
create type public.project_status as enum ('active', 'paused', 'finished', 'archived');

create type public.task_status as enum ('open', 'done');

create type public.task_event_kind as enum ('completed', 'skipped', 'deferred');

create type public.reward_reason as enum ('task_completed', 'game_time', 'adjustment');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  why text check (char_length(why) <= 1000),
  definition_of_done text check (char_length(definition_of_done) <= 1000),
  status public.project_status not null default 'active',
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_id_status_idx on public.projects (user_id, status);

create trigger projects_set_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- At most 3 active projects per user. The limit is a core feature: it stops
-- "starting something else" from quietly piling up unfinished work.
create function public.enforce_active_project_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    -- Serialize concurrent activations for the same user.
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    if (
      select count(*) from public.projects
      where user_id = new.user_id and status = 'active' and id <> new.id
    ) >= 3 then
      raise exception 'You already have 3 active projects'
        using errcode = 'P0001',
              hint = 'Pause or finish one first, or park this idea for later.';
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_active_limit
before insert or update of status on public.projects
for each row execute function public.enforce_active_project_limit();

-- ---------------------------------------------------------------------------
-- Ideas (parking lot)
-- ---------------------------------------------------------------------------

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  notes text check (char_length(notes) <= 2000),
  promoted_project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ideas_user_id_idx on public.ideas (user_id);

create trigger ideas_set_updated_at
before update on public.ideas
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tasks (project next actions and standalone chores/obligations)
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  estimated_minutes integer not null default 25 check (estimated_minutes between 1 and 600),
  energy public.energy_level not null default 'medium',
  importance smallint not null default 2 check (importance between 1 and 3),
  due_date date,
  -- An easier version to offer when the full task feels like too much (#13).
  smaller_version text check (char_length(smaller_version) <= 200),
  status public.task_status not null default 'open',
  deferred_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_user_id_status_idx on public.tasks (user_id, status);
create index tasks_project_id_idx on public.tasks (project_id);

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Task events (append-only history of what happened to recommendations)
-- ---------------------------------------------------------------------------

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  kind public.task_event_kind not null,
  -- The check-in the recommendation was made for, so later milestones can learn
  -- which tasks get done at which times and energy levels.
  available_minutes integer check (available_minutes between 1 and 1440),
  energy public.energy_level,
  created_at timestamptz not null default now()
);

create index task_events_user_id_created_at_idx on public.task_events (user_id, created_at desc);
create index task_events_task_id_idx on public.task_events (task_id);

-- ---------------------------------------------------------------------------
-- Reward ledger (game-time credits, in minutes; append-only)
-- ---------------------------------------------------------------------------

create table public.reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  minutes integer not null check (minutes <> 0 and minutes between -1440 and 1440),
  reason public.reward_reason not null,
  task_id uuid references public.tasks (id) on delete set null,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index reward_ledger_user_id_idx on public.reward_ledger (user_id);

-- Credits never go negative: spending more than the balance is rejected.
create function public.enforce_non_negative_rewards()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.minutes < 0 then
    perform pg_advisory_xact_lock(hashtextextended('rewards:' || new.user_id::text, 0));
    if coalesce((select sum(minutes) from public.reward_ledger where user_id = new.user_id), 0)
       + new.minutes < 0 then
      raise exception 'Not enough game-time credits'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger reward_ledger_non_negative
before insert on public.reward_ledger
for each row execute function public.enforce_non_negative_rewards();

create view public.reward_balances
with (security_invoker = true)
as
select user_id, sum(minutes)::integer as minutes
from public.reward_ledger
group by user_id;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- (select auth.uid()) is evaluated once per statement instead of once per row.
-- Insert/update checks also verify that any referenced project or task belongs
-- to the same user; foreign keys alone would accept another user's ids.

alter table public.projects enable row level security;
alter table public.ideas enable row level security;
alter table public.tasks enable row level security;
alter table public.task_events enable row level security;
alter table public.reward_ledger enable row level security;

-- projects
create policy "Users read own projects" on public.projects
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own projects" on public.projects
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users update own projects" on public.projects
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users delete own projects" on public.projects
  for delete to authenticated using (user_id = (select auth.uid()));

-- ideas
create policy "Users read own ideas" on public.ideas
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own ideas" on public.ideas
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (promoted_project_id is null or exists (
      select 1 from public.projects p
      where p.id = promoted_project_id and p.user_id = (select auth.uid())
    ))
  );
create policy "Users update own ideas" on public.ideas
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (promoted_project_id is null or exists (
      select 1 from public.projects p
      where p.id = promoted_project_id and p.user_id = (select auth.uid())
    ))
  );
create policy "Users delete own ideas" on public.ideas
  for delete to authenticated using (user_id = (select auth.uid()));

-- tasks
create policy "Users read own tasks" on public.tasks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users create own tasks" on public.tasks
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    ))
  );
create policy "Users update own tasks" on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p
      where p.id = project_id and p.user_id = (select auth.uid())
    ))
  );
create policy "Users delete own tasks" on public.tasks
  for delete to authenticated using (user_id = (select auth.uid()));

-- task_events (append-only)
create policy "Users read own task events" on public.task_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users log own task events" on public.task_events
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = (select auth.uid())
    )
  );

-- reward_ledger (append-only)
create policy "Users read own rewards" on public.reward_ledger
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users add own rewards" on public.reward_ledger
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (task_id is null or exists (
      select 1 from public.tasks t
      where t.id = task_id and t.user_id = (select auth.uid())
    ))
  );

-- History tables are append-only for app users, and anon gets nothing at all.
-- TRUNCATE bypasses row-level security, so no app role may use it.
revoke update, delete on public.task_events, public.reward_ledger from authenticated;
revoke truncate on public.projects, public.ideas, public.tasks, public.task_events,
  public.reward_ledger from authenticated;
revoke all on public.projects, public.ideas, public.tasks, public.task_events,
  public.reward_ledger, public.reward_balances from anon;
