-- Sprint B — Running Workout Data Model.
-- Prepared for review only. Do not apply without a dedicated release gate.
--
-- Hybrid model:
-- - strength keeps workout_plans.exercises unchanged;
-- - structured running plans use workout_plans metadata + normalized steps.

alter table public.workout_plans
  add column if not exists sport_type text not null default 'strength',
  add column if not exists level text,
  add column if not exists goal text,
  add column if not exists description text,
  add column if not exists estimated_duration_s integer,
  add column if not exists estimated_distance_m numeric,
  add column if not exists source text not null default 'manual',
  add column if not exists source_metadata jsonb not null default '{}'::jsonb,
  add column if not exists structure_revision integer not null default 0;

alter table public.workout_plans
  drop constraint if exists workout_plans_sport_type_check,
  drop constraint if exists workout_plans_level_check,
  drop constraint if exists workout_plans_goal_check,
  drop constraint if exists workout_plans_source_check,
  drop constraint if exists workout_plans_estimates_check,
  drop constraint if exists workout_plans_source_metadata_check,
  drop constraint if exists workout_plans_structure_revision_check;

alter table public.workout_plans
  add constraint workout_plans_sport_type_check
    check (sport_type ~ '^[a-z][a-z0-9-]{0,63}$'),
  add constraint workout_plans_level_check
    check (
      level is null
      or level in ('starting', 'beginner', 'intermediate', 'advanced')
    ),
  add constraint workout_plans_goal_check
    check (
      goal is null
      or goal in (
        'start_running',
        'first_5k',
        'improve_5k',
        'first_10k',
        'improve_10k',
        'half_marathon',
        'marathon',
        'conditioning',
        'general'
      )
    ),
  add constraint workout_plans_source_check
    check (
      source in ('manual', 'text', 'image', 'pdf', 'professional', 'ai')
    ),
  add constraint workout_plans_estimates_check
    check (
      (estimated_duration_s is null or estimated_duration_s >= 0)
      and (estimated_distance_m is null or estimated_distance_m >= 0)
    ),
  add constraint workout_plans_source_metadata_check
    check (jsonb_typeof(source_metadata) = 'object'),
  add constraint workout_plans_structure_revision_check
    check (structure_revision >= 0);

-- Saved plans are authenticated/private. RLS does not protect TRUNCATE, so
-- remove legacy broad grants that are unnecessary for the client.
revoke all on table public.workout_plans from anon;
revoke truncate, references, trigger on table public.workout_plans
  from authenticated;

create index if not exists workout_plans_user_sport_updated_idx
  on public.workout_plans (user_id, sport_type, updated_at desc);

-- Existing authenticated CRUD remains available for strength, but structured
-- metadata must go through the ownership-safe RPCs below. SECURITY DEFINER
-- statements run as the function owner, so this blocks only direct client
-- attempts to forge sport/source/revision metadata.
create or replace function private.guard_running_plan_client_writes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.sport_type <> 'strength'
       or new.level is not null
       or new.goal is not null
       or new.description is not null
       or new.estimated_duration_s is not null
       or new.estimated_distance_m is not null
       or new.source <> 'manual'
       or new.source_metadata <> '{}'::jsonb
       or new.structure_revision <> 0 then
      raise exception 'running_plan_rpc_required' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.sport_type is distinct from old.sport_type
     or new.level is distinct from old.level
     or new.goal is distinct from old.goal
     or new.description is distinct from old.description
     or new.estimated_duration_s is distinct from old.estimated_duration_s
     or new.estimated_distance_m is distinct from old.estimated_distance_m
     or new.source is distinct from old.source
     or new.source_metadata is distinct from old.source_metadata
     or new.structure_revision is distinct from old.structure_revision then
    raise exception 'running_plan_rpc_required' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_running_plan_client_writes()
  from public, anon, authenticated;

drop trigger if exists workout_plans_guard_running_client_writes
  on public.workout_plans;
create trigger workout_plans_guard_running_client_writes
before insert or update on public.workout_plans
for each row execute function private.guard_running_plan_client_writes();

create table if not exists public.workout_plan_steps (
  id uuid primary key default gen_random_uuid(),
  workout_plan_id uuid not null
    references public.workout_plans(id) on delete cascade,
  position integer not null,
  step_type text not null,
  title text not null,
  instructions text,
  repetitions integer not null default 1,
  repetitions_min integer,
  repetitions_max integer,
  target_basis text not null,
  distance_m numeric,
  distance_min_m numeric,
  distance_max_m numeric,
  duration_s integer,
  duration_min_s integer,
  duration_max_s integer,
  pace_min_s_per_km integer,
  pace_max_s_per_km integer,
  heart_rate_zone smallint,
  recovery_type text not null default 'none',
  recovery_duration_s integer,
  recovery_distance_m numeric,
  target_effort numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_plan_steps_plan_position_key
    unique (workout_plan_id, position) deferrable initially deferred,
  constraint workout_plan_steps_position_check
    check (position between 0 and 9999),
  constraint workout_plan_steps_type_check
    check (
      step_type in (
        'warmup',
        'easy',
        'steady',
        'recovery',
        'interval',
        'tempo',
        'threshold',
        'progression',
        'long_run',
        'walk',
        'cooldown',
        'drill',
        'hill',
        'free'
      )
    ),
  constraint workout_plan_steps_title_check
    check (char_length(btrim(title)) between 1 and 120),
  constraint workout_plan_steps_repetitions_check
    check (
      repetitions between 1 and 1000
      and (
        (repetitions_min is null and repetitions_max is null)
        or (
          repetitions_min between 1 and 1000
          and repetitions_max between repetitions_min and 1000
          and repetitions between repetitions_min and repetitions_max
        )
      )
    ),
  constraint workout_plan_steps_target_basis_check
    check (
      target_basis in (
        'distance',
        'duration',
        'pace',
        'heart_rate',
        'effort',
        'free'
      )
    ),
  constraint workout_plan_steps_measurements_check
    check (
      (distance_m is null or distance_m > 0)
      and (
        (distance_min_m is null and distance_max_m is null)
        or (
          distance_m is null
          and distance_min_m > 0
          and distance_max_m >= distance_min_m
        )
      )
      and (duration_s is null or duration_s > 0)
      and (
        (duration_min_s is null and duration_max_s is null)
        or (
          duration_s is null
          and duration_min_s > 0
          and duration_max_s >= duration_min_s
        )
      )
      and (pace_min_s_per_km is null or pace_min_s_per_km > 0)
      and (pace_max_s_per_km is null or pace_max_s_per_km > 0)
      and (
        pace_min_s_per_km is null
        or pace_max_s_per_km is null
        or pace_min_s_per_km <= pace_max_s_per_km
      )
    ),
  constraint workout_plan_steps_target_check
    check (
      distance_m is not null
      or (distance_min_m is not null and distance_max_m is not null)
      or duration_s is not null
      or (duration_min_s is not null and duration_max_s is not null)
      or target_basis = 'free'
      or step_type in ('free', 'drill')
    ),
  constraint workout_plan_steps_zone_effort_check
    check (
      (heart_rate_zone is null or heart_rate_zone between 1 and 5)
      and (target_effort is null or target_effort between 1 and 10)
    ),
  constraint workout_plan_steps_recovery_type_check
    check (
      recovery_type in (
        'none',
        'standing',
        'walking',
        'easy_jog',
        'distance',
        'duration'
      )
    ),
  constraint workout_plan_steps_recovery_check
    check (
      (
        recovery_type = 'none'
        and recovery_duration_s is null
        and recovery_distance_m is null
      )
      or (
        repetitions > 1
        and recovery_type = 'distance'
        and recovery_distance_m > 0
        and recovery_duration_s is null
      )
      or (
        repetitions > 1
        and recovery_type in ('standing', 'walking', 'easy_jog', 'duration')
        and recovery_duration_s > 0
        and recovery_distance_m is null
      )
    ),
  constraint workout_plan_steps_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists workout_plan_steps_plan_position_idx
  on public.workout_plan_steps (workout_plan_id, position);

alter table public.workout_plan_steps enable row level security;

drop policy if exists workout_plan_steps_owner_select
  on public.workout_plan_steps;
create policy workout_plan_steps_owner_select
  on public.workout_plan_steps for select
  to authenticated
  using (
    exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
    )
  );

-- Write policies document the ownership contract. Table write grants remain
-- revoked; mutations are atomic through the reviewed RPCs below.
drop policy if exists workout_plan_steps_owner_insert
  on public.workout_plan_steps;
create policy workout_plan_steps_owner_insert
  on public.workout_plan_steps for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
        and plan.sport_type = 'run'
    )
  );

drop policy if exists workout_plan_steps_owner_update
  on public.workout_plan_steps;
create policy workout_plan_steps_owner_update
  on public.workout_plan_steps for update
  to authenticated
  using (
    exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
        and plan.sport_type = 'run'
    )
  )
  with check (
    exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
        and plan.sport_type = 'run'
    )
  );

drop policy if exists workout_plan_steps_owner_delete
  on public.workout_plan_steps;
create policy workout_plan_steps_owner_delete
  on public.workout_plan_steps for delete
  to authenticated
  using (
    exists (
      select 1
      from public.workout_plans plan
      where plan.id = workout_plan_id
        and plan.user_id = (select auth.uid())
        and plan.sport_type = 'run'
    )
  );

revoke all on public.workout_plan_steps from public, anon, authenticated;
grant select on public.workout_plan_steps to authenticated;
grant all on public.workout_plan_steps to service_role;

-- Existing strength plans remain versioned by name/exercises. Running metadata
-- and the structure revision participate in the same monotonic plan version.
create or replace function private.guard_workout_plan_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.name is distinct from old.name
     or new.exercises is distinct from old.exercises
     or new.sport_type is distinct from old.sport_type
     or new.level is distinct from old.level
     or new.goal is distinct from old.goal
     or new.description is distinct from old.description
     or new.estimated_duration_s is distinct from old.estimated_duration_s
     or new.estimated_distance_m is distinct from old.estimated_distance_m
     or new.source is distinct from old.source
     or new.source_metadata is distinct from old.source_metadata
     or new.structure_revision is distinct from old.structure_revision then
    new.plan_version := old.plan_version + 1;
    new.updated_at := now();
  else
    new.plan_version := old.plan_version;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_workout_plan_version()
  from public, anon, authenticated;

create or replace function private.insert_running_plan_steps(
  p_plan_id uuid,
  p_steps jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.workout_plan_steps (
    workout_plan_id,
    position,
    step_type,
    title,
    instructions,
    repetitions,
    repetitions_min,
    repetitions_max,
    target_basis,
    distance_m,
    distance_min_m,
    distance_max_m,
    duration_s,
    duration_min_s,
    duration_max_s,
    pace_min_s_per_km,
    pace_max_s_per_km,
    heart_rate_zone,
    recovery_type,
    recovery_duration_s,
    recovery_distance_m,
    target_effort,
    metadata
  )
  select
    p_plan_id,
    ordinality::integer - 1,
    step ->> 'step_type',
    btrim(step ->> 'title'),
    nullif(btrim(step ->> 'instructions'), ''),
    coalesce(nullif(step ->> 'repetitions', '')::integer, 1),
    nullif(step ->> 'repetitions_min', '')::integer,
    nullif(step ->> 'repetitions_max', '')::integer,
    step ->> 'target_basis',
    nullif(step ->> 'distance_m', '')::numeric,
    nullif(step ->> 'distance_min_m', '')::numeric,
    nullif(step ->> 'distance_max_m', '')::numeric,
    nullif(step ->> 'duration_s', '')::integer,
    nullif(step ->> 'duration_min_s', '')::integer,
    nullif(step ->> 'duration_max_s', '')::integer,
    nullif(step ->> 'pace_min_s_per_km', '')::integer,
    nullif(step ->> 'pace_max_s_per_km', '')::integer,
    nullif(step ->> 'heart_rate_zone', '')::smallint,
    coalesce(nullif(step ->> 'recovery_type', ''), 'none'),
    nullif(step ->> 'recovery_duration_s', '')::integer,
    nullif(step ->> 'recovery_distance_m', '')::numeric,
    nullif(step ->> 'target_effort', '')::numeric,
    case
      when jsonb_typeof(step -> 'metadata') = 'object'
        then step -> 'metadata'
      else '{}'::jsonb
    end
  from jsonb_array_elements(p_steps) with ordinality as item(step, ordinality);
$$;

revoke all on function private.insert_running_plan_steps(uuid, jsonb)
  from public, anon, authenticated;

create or replace function private.save_running_workout_plan(
  p_plan_id uuid,
  p_plan jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_plan_id uuid := p_plan_id;
  v_existing public.workout_plans%rowtype;
  v_steps jsonb := p_plan -> 'steps';
begin
  if v_user_id is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_plan) <> 'object'
     or jsonb_typeof(v_steps) <> 'array'
     or jsonb_array_length(v_steps) = 0
     or nullif(btrim(p_plan ->> 'name'), '') is null then
    raise exception 'invalid_running_plan' using errcode = '22023';
  end if;

  if v_plan_id is null then
    insert into public.workout_plans (
      user_id,
      name,
      exercises,
      sport_type,
      level,
      goal,
      description,
      estimated_duration_s,
      estimated_distance_m,
      source,
      source_metadata
    )
    values (
      v_user_id,
      btrim(p_plan ->> 'name'),
      '[]'::jsonb,
      'run',
      p_plan ->> 'level',
      p_plan ->> 'goal',
      nullif(btrim(p_plan ->> 'description'), ''),
      nullif(p_plan ->> 'estimated_duration_s', '')::integer,
      nullif(p_plan ->> 'estimated_distance_m', '')::numeric,
      'manual',
      '{}'::jsonb
    )
    returning id into v_plan_id;
  else
    select *
      into v_existing
      from public.workout_plans
     where id = v_plan_id
       and user_id = v_user_id
       and sport_type = 'run'
     for update;
    if not found then
      raise exception 'running_plan_not_found' using errcode = 'P0002';
    end if;

    update public.workout_plans
       set name = btrim(p_plan ->> 'name'),
           level = p_plan ->> 'level',
           goal = p_plan ->> 'goal',
           description = nullif(btrim(p_plan ->> 'description'), ''),
           estimated_duration_s =
             nullif(p_plan ->> 'estimated_duration_s', '')::integer,
           estimated_distance_m =
             nullif(p_plan ->> 'estimated_distance_m', '')::numeric,
           structure_revision = structure_revision + 1
     where id = v_plan_id;

    delete from public.workout_plan_steps
     where workout_plan_id = v_plan_id;
  end if;

  perform private.insert_running_plan_steps(v_plan_id, v_steps);
  return v_plan_id;
end;
$$;

revoke all on function private.save_running_workout_plan(uuid, jsonb)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.save_running_workout_plan(uuid, jsonb)
  to authenticated;

create or replace function public.save_running_workout_plan(
  p_plan_id uuid,
  p_plan jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_running_workout_plan(p_plan_id, p_plan);
$$;

revoke all on function public.save_running_workout_plan(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.save_running_workout_plan(uuid, jsonb)
  to authenticated;

create or replace function private.duplicate_running_workout_plan(
  p_plan_id uuid,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source public.workout_plans%rowtype;
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  select *
    into v_source
    from public.workout_plans
   where id = p_plan_id
     and user_id = v_user_id
     and sport_type = 'run';
  if not found then
    raise exception 'running_plan_not_found' using errcode = 'P0002';
  end if;

  insert into public.workout_plans (
    user_id,
    name,
    exercises,
    sport_type,
    level,
    goal,
    description,
    estimated_duration_s,
    estimated_distance_m,
    source,
    source_metadata
  )
  values (
    v_user_id,
    coalesce(nullif(btrim(p_name), ''), v_source.name || ' (cópia)'),
    '[]'::jsonb,
    'run',
    v_source.level,
    v_source.goal,
    v_source.description,
    v_source.estimated_duration_s,
    v_source.estimated_distance_m,
    'manual',
    jsonb_build_object('duplicated_from', v_source.id)
  )
  returning id into v_new_id;

  insert into public.workout_plan_steps (
    workout_plan_id,
    position,
    step_type,
    title,
    instructions,
    repetitions,
    repetitions_min,
    repetitions_max,
    target_basis,
    distance_m,
    distance_min_m,
    distance_max_m,
    duration_s,
    duration_min_s,
    duration_max_s,
    pace_min_s_per_km,
    pace_max_s_per_km,
    heart_rate_zone,
    recovery_type,
    recovery_duration_s,
    recovery_distance_m,
    target_effort,
    metadata
  )
  select
    v_new_id,
    position,
    step_type,
    title,
    instructions,
    repetitions,
    repetitions_min,
    repetitions_max,
    target_basis,
    distance_m,
    distance_min_m,
    distance_max_m,
    duration_s,
    duration_min_s,
    duration_max_s,
    pace_min_s_per_km,
    pace_max_s_per_km,
    heart_rate_zone,
    recovery_type,
    recovery_duration_s,
    recovery_distance_m,
    target_effort,
    metadata
  from public.workout_plan_steps
  where workout_plan_id = v_source.id
  order by position;

  return v_new_id;
end;
$$;

revoke all on function private.duplicate_running_workout_plan(uuid, text)
  from public, anon, authenticated;
grant execute on function private.duplicate_running_workout_plan(uuid, text)
  to authenticated;

create or replace function public.duplicate_running_workout_plan(
  p_plan_id uuid,
  p_name text default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.duplicate_running_workout_plan(p_plan_id, p_name);
$$;

revoke all on function public.duplicate_running_workout_plan(uuid, text)
  from public, anon, authenticated;
grant execute on function public.duplicate_running_workout_plan(uuid, text)
  to authenticated;

create or replace function private.reorder_running_workout_plan_steps(
  p_plan_id uuid,
  p_step_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_step_count integer;
begin
  if v_user_id is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.workout_plans
    where id = p_plan_id and user_id = v_user_id and sport_type = 'run'
  ) then
    raise exception 'running_plan_not_found' using errcode = 'P0002';
  end if;

  select count(*) into v_step_count
  from public.workout_plan_steps
  where workout_plan_id = p_plan_id;

  if cardinality(p_step_ids) is distinct from v_step_count
     or (
       select count(distinct step_id)
       from unnest(p_step_ids) step_id
     ) is distinct from v_step_count
     or exists (
       select 1
       from unnest(p_step_ids) step_id
       where not exists (
         select 1 from public.workout_plan_steps step
         where step.id = step_id and step.workout_plan_id = p_plan_id
       )
     ) then
    raise exception 'invalid_running_step_order' using errcode = '22023';
  end if;

  update public.workout_plan_steps step
     set position = ordered.ordinality::integer - 1,
         updated_at = now()
    from unnest(p_step_ids) with ordinality as ordered(step_id, ordinality)
   where step.id = ordered.step_id
     and step.workout_plan_id = p_plan_id;

  update public.workout_plans
     set structure_revision = structure_revision + 1
   where id = p_plan_id;
end;
$$;

revoke all on function private.reorder_running_workout_plan_steps(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function private.reorder_running_workout_plan_steps(uuid, uuid[])
  to authenticated;

create or replace function public.reorder_running_workout_plan_steps(
  p_plan_id uuid,
  p_step_ids uuid[]
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.reorder_running_workout_plan_steps(p_plan_id, p_step_ids);
$$;

revoke all on function public.reorder_running_workout_plan_steps(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.reorder_running_workout_plan_steps(uuid, uuid[])
  to authenticated;

comment on table public.workout_plan_steps is
  'Ordered structured blocks for non-strength workout plans. Running is the first supported sport.';
comment on column public.workout_plans.sport_type is
  'Canonical sport catalog ID. Existing plans default to strength.';
comment on column public.workout_plans.source is
  'Origin class; authenticated manual editor creates manual plans only.';
