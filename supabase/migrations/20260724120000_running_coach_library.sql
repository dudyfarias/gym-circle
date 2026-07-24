-- Sprint D1 — Running Coach Library.
-- Prepared for review only. Do not apply without a dedicated release gate.
--
-- Additive schema for the running coach library:
-- - reusable official session templates (owner-aware, publishable);
-- - normalized template steps mirroring public.workout_plan_steps;
-- - multi-week programs (week x order -> template) with faceted discovery;
-- - per-user enrollment state and idempotent session completion.
-- Client mutations of user state go through the ownership-safe RPCs below.

-- 1) Session templates -------------------------------------------------------
create table if not exists public.running_session_template (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_user_id uuid references auth.users(id) on delete cascade,
  origin text not null default 'official',
  visibility text not null default 'public',
  title text not null,
  description text,
  estimated_duration_s integer,
  estimated_distance_m numeric,
  primary_step_type text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint running_session_template_origin_check
    check (origin in ('official', 'professional', 'imported', 'ai')),
  constraint running_session_template_visibility_check
    check (visibility in ('public', 'assigned', 'private')),
  constraint running_session_template_owner_origin_check
    check ((origin = 'official') = (owner_user_id is null)),
  constraint running_session_template_title_check
    check (char_length(btrim(title)) between 1 and 120)
);

create index if not exists running_session_template_owner_idx
  on public.running_session_template (owner_user_id);

alter table public.running_session_template enable row level security;

drop policy if exists running_session_template_read
  on public.running_session_template;
create policy running_session_template_read
  on public.running_session_template for select
  to authenticated
  using (
    (origin = 'official' and is_published)
    or owner_user_id = (select auth.uid())
  );

revoke all on public.running_session_template from public, anon, authenticated;
grant select on public.running_session_template to authenticated;
grant all on public.running_session_template to service_role;

-- 2) Session template steps (mirror of public.workout_plan_steps) ------------
create table if not exists public.running_session_template_step (
  id uuid primary key default gen_random_uuid(),
  session_template_id uuid not null
    references public.running_session_template(id) on delete cascade,
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
  constraint running_session_template_step_plan_position_key
    unique (session_template_id, position) deferrable initially deferred,
  constraint running_session_template_step_position_check
    check (position between 0 and 9999),
  constraint running_session_template_step_type_check
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
  constraint running_session_template_step_title_check
    check (char_length(btrim(title)) between 1 and 120),
  constraint running_session_template_step_repetitions_check
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
  constraint running_session_template_step_target_basis_check
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
  constraint running_session_template_step_measurements_check
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
  constraint running_session_template_step_target_check
    check (
      distance_m is not null
      or (distance_min_m is not null and distance_max_m is not null)
      or duration_s is not null
      or (duration_min_s is not null and duration_max_s is not null)
      or target_basis = 'free'
      or step_type in ('free', 'drill')
    ),
  constraint running_session_template_step_zone_effort_check
    check (
      (heart_rate_zone is null or heart_rate_zone between 1 and 5)
      and (target_effort is null or target_effort between 1 and 10)
    ),
  constraint running_session_template_step_recovery_type_check
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
  constraint running_session_template_step_recovery_check
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
  constraint running_session_template_step_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists running_session_template_step_plan_position_idx
  on public.running_session_template_step (session_template_id, position);

alter table public.running_session_template_step enable row level security;

drop policy if exists running_session_template_step_read
  on public.running_session_template_step;
create policy running_session_template_step_read
  on public.running_session_template_step for select
  to authenticated
  using (
    exists (
      select 1
      from public.running_session_template template
      where template.id = session_template_id
        and (
          (template.origin = 'official' and template.is_published)
          or template.owner_user_id = (select auth.uid())
        )
    )
  );

revoke all on public.running_session_template_step
  from public, anon, authenticated;
grant select on public.running_session_template_step to authenticated;
grant all on public.running_session_template_step to service_role;

-- 3) Programs ----------------------------------------------------------------
create table if not exists public.running_program (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_user_id uuid references auth.users(id) on delete cascade,
  origin text not null default 'official',
  visibility text not null default 'public',
  title text not null,
  description text,
  level text,
  goal text,
  weeks integer not null,
  sessions_per_week integer not null,
  time_bucket integer,
  suggested_spacing text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint running_program_origin_check
    check (origin in ('official', 'professional', 'imported', 'ai')),
  constraint running_program_visibility_check
    check (visibility in ('public', 'assigned', 'private')),
  constraint running_program_owner_origin_check
    check ((origin = 'official') = (owner_user_id is null)),
  constraint running_program_title_check
    check (char_length(btrim(title)) between 1 and 120),
  constraint running_program_level_check
    check (
      level is null
      or level in ('starting', 'beginner', 'intermediate', 'advanced')
    ),
  constraint running_program_goal_check
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
  constraint running_program_weeks_check
    check (weeks between 1 and 52),
  constraint running_program_sessions_per_week_check
    check (sessions_per_week between 1 and 14),
  constraint running_program_time_bucket_check
    check (time_bucket is null or time_bucket in (20, 30, 45, 60, 90))
);

create index if not exists running_program_published_facets_idx
  on public.running_program (is_published, level, goal);

create index if not exists running_program_owner_idx
  on public.running_program (owner_user_id);

alter table public.running_program enable row level security;

drop policy if exists running_program_read on public.running_program;
create policy running_program_read
  on public.running_program for select
  to authenticated
  using (
    (origin = 'official' and is_published)
    or owner_user_id = (select auth.uid())
  );

revoke all on public.running_program from public, anon, authenticated;
grant select on public.running_program to authenticated;
grant all on public.running_program to service_role;

-- 4) Program sessions (week x order -> template) -----------------------------
create table if not exists public.running_program_session (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null
    references public.running_program(id) on delete cascade,
  week_index integer not null,
  order_in_week integer not null,
  session_template_id uuid not null
    references public.running_session_template(id),
  notes text,
  constraint running_program_session_week_check
    check (week_index between 1 and 52),
  constraint running_program_session_order_check
    check (order_in_week between 1 and 14),
  constraint running_program_session_slot_key
    unique (program_id, week_index, order_in_week)
);

-- Reads on (program_id, week_index, order_in_week) are served by the composite
-- unique constraint's btree, so no separate index is needed here. The
-- session_template_id FK still needs its own covering index.
create index if not exists running_program_session_template_idx
  on public.running_program_session (session_template_id);

alter table public.running_program_session enable row level security;

drop policy if exists running_program_session_read
  on public.running_program_session;
create policy running_program_session_read
  on public.running_program_session for select
  to authenticated
  using (
    exists (
      select 1
      from public.running_program program
      where program.id = program_id
        and (
          (program.origin = 'official' and program.is_published)
          or program.owner_user_id = (select auth.uid())
        )
    )
  );

revoke all on public.running_program_session from public, anon, authenticated;
grant select on public.running_program_session to authenticated;
grant all on public.running_program_session to service_role;

-- 5) Enrollment (per-user program state) -------------------------------------
create table if not exists public.running_program_enrollment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.running_program(id),
  status text not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint running_program_enrollment_status_check
    check (status in ('active', 'completed', 'abandoned'))
);

-- At most one active enrollment per user.
create unique index if not exists running_program_enrollment_one_active_idx
  on public.running_program_enrollment (user_id)
  where status = 'active';

-- The partial-active unique index above only covers active rows; all-status
-- owner reads and the program FK still need plain covering indexes.
create index if not exists running_program_enrollment_user_idx
  on public.running_program_enrollment (user_id);

create index if not exists running_program_enrollment_program_idx
  on public.running_program_enrollment (program_id);

alter table public.running_program_enrollment enable row level security;

-- Read is direct; writes flow through the ownership-safe RPCs below.
drop policy if exists running_program_enrollment_owner_select
  on public.running_program_enrollment;
create policy running_program_enrollment_owner_select
  on public.running_program_enrollment for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists running_program_enrollment_owner_insert
  on public.running_program_enrollment;
create policy running_program_enrollment_owner_insert
  on public.running_program_enrollment for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists running_program_enrollment_owner_update
  on public.running_program_enrollment;
create policy running_program_enrollment_owner_update
  on public.running_program_enrollment for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.running_program_enrollment
  from public, anon, authenticated;
grant select on public.running_program_enrollment to authenticated;
grant all on public.running_program_enrollment to service_role;

-- 6) Session completion ------------------------------------------------------
create table if not exists public.running_program_session_completion (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.running_program_enrollment(id) on delete cascade,
  program_session_id uuid not null
    references public.running_program_session(id),
  activity_id uuid not null
    references public.activities(id) on delete cascade,
  completed_at timestamptz not null default now(),
  constraint running_program_session_completion_key
    unique (enrollment_id, program_session_id)
);

-- enrollment_id is the leading column of the composite unique above, so only
-- the remaining foreign keys need their own covering indexes.
create index if not exists running_program_session_completion_session_idx
  on public.running_program_session_completion (program_session_id);

create index if not exists running_program_session_completion_activity_idx
  on public.running_program_session_completion (activity_id);

alter table public.running_program_session_completion enable row level security;

-- Owner scope is derived from the parent enrollment; writes go through the RPC.
drop policy if exists running_program_session_completion_owner_select
  on public.running_program_session_completion;
create policy running_program_session_completion_owner_select
  on public.running_program_session_completion for select
  to authenticated
  using (
    exists (
      select 1
      from public.running_program_enrollment enrollment
      where enrollment.id = enrollment_id
        and enrollment.user_id = (select auth.uid())
    )
  );

revoke all on public.running_program_session_completion
  from public, anon, authenticated;
grant select on public.running_program_session_completion to authenticated;
grant all on public.running_program_session_completion to service_role;

-- 7) Enrollment lifecycle RPCs -----------------------------------------------
-- Client mutations run through SECURITY DEFINER functions that enforce
-- ownership and state invariants. The public wrappers stay SECURITY INVOKER.
create or replace function private.enroll_in_running_program(
  p_program_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_enrollment_id uuid;
begin
  if v_user_id is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.running_program
    where id = p_program_id
      and ((origin = 'official' and is_published) or owner_user_id = v_user_id)
  ) then
    raise exception 'program_not_available' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.running_program_enrollment
    where user_id = v_user_id
      and status = 'active'
  ) then
    raise exception 'already_enrolled' using errcode = '23505';
  end if;

  insert into public.running_program_enrollment (user_id, program_id, status)
  values (v_user_id, p_program_id, 'active')
  returning id into v_enrollment_id;

  return v_enrollment_id;
end;
$$;

revoke all on function private.enroll_in_running_program(uuid)
  from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.enroll_in_running_program(uuid)
  to authenticated;

create or replace function public.enroll_in_running_program(
  p_program_id uuid
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.enroll_in_running_program(p_program_id);
$$;

revoke all on function public.enroll_in_running_program(uuid)
  from public, anon, authenticated;
grant execute on function public.enroll_in_running_program(uuid)
  to authenticated;

create or replace function private.complete_program_session(
  p_enrollment_id uuid,
  p_program_session_id uuid,
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_program_id uuid;
  v_remaining integer;
begin
  if v_user_id is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  select program_id
    into v_program_id
    from public.running_program_enrollment
   where id = p_enrollment_id
     and user_id = v_user_id
     and status = 'active';
  if not found then
    raise exception 'enrollment_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.activities
    where id = p_activity_id
      and user_id = v_user_id
  ) then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.running_program_session
    where id = p_program_session_id
      and program_id = v_program_id
  ) then
    raise exception 'program_session_not_found' using errcode = 'P0002';
  end if;

  insert into public.running_program_session_completion (
    enrollment_id,
    program_session_id,
    activity_id
  )
  values (p_enrollment_id, p_program_session_id, p_activity_id)
  on conflict (enrollment_id, program_session_id) do nothing;

  select count(*)
    into v_remaining
    from public.running_program_session session
   where session.program_id = v_program_id
     and not exists (
       select 1
       from public.running_program_session_completion completion
       where completion.enrollment_id = p_enrollment_id
         and completion.program_session_id = session.id
     );

  if v_remaining = 0 then
    update public.running_program_enrollment
       set status = 'completed',
           completed_at = now()
     where id = p_enrollment_id
       and status = 'active';
  end if;
end;
$$;

revoke all on function private.complete_program_session(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.complete_program_session(uuid, uuid, uuid)
  to authenticated;

create or replace function public.complete_program_session(
  p_enrollment_id uuid,
  p_program_session_id uuid,
  p_activity_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.complete_program_session(
    p_enrollment_id,
    p_program_session_id,
    p_activity_id
  );
$$;

revoke all on function public.complete_program_session(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_program_session(uuid, uuid, uuid)
  to authenticated;

create or replace function private.abandon_running_program(
  p_enrollment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  update public.running_program_enrollment
     set status = 'abandoned'
   where id = p_enrollment_id
     and user_id = v_user_id;
  if not found then
    raise exception 'enrollment_not_found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function private.abandon_running_program(uuid)
  from public, anon, authenticated;
grant execute on function private.abandon_running_program(uuid)
  to authenticated;

create or replace function public.abandon_running_program(
  p_enrollment_id uuid
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.abandon_running_program(p_enrollment_id);
$$;

revoke all on function public.abandon_running_program(uuid)
  from public, anon, authenticated;
grant execute on function public.abandon_running_program(uuid)
  to authenticated;

comment on table public.running_session_template is
  'Reusable running session (owner-aware). Official published rows are the shared coach library; owner rows are private/assigned.';
comment on table public.running_session_template_step is
  'Ordered structured blocks for a running session template. Mirrors public.workout_plan_steps.';
comment on table public.running_program is
  'Multi-week running program with faceted discovery (level, goal, time bucket).';
comment on table public.running_program_session is
  'Program slot: maps week_index x order_in_week to a session template.';
comment on table public.running_program_enrollment is
  'Per-user program enrollment state; at most one active enrollment per user.';
comment on table public.running_program_session_completion is
  'Idempotent record that an enrolled user completed a program session via an activity.';
