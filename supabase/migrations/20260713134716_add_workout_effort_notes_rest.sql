-- Sprint C: notas e contexto de esforco/descanso opcionais. RPE/RIR nunca sao
-- obrigatorios; ficam no set apenas quando o usuario abre controles avancados.

alter table public.activities
  add column if not exists workout_note text,
  add column if not exists workout_exercise_context jsonb not null default '[]'::jsonb;

alter table public.activities
  drop constraint if exists activities_workout_note_length_check;
alter table public.activities
  add constraint activities_workout_note_length_check
  check (workout_note is null or char_length(workout_note) <= 5000);

create or replace function private.workout_exercise_context_is_valid(p_context jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
begin
  if p_context is null or jsonb_typeof(p_context) <> 'array' then
    return false;
  end if;
  for v_item in select value from jsonb_array_elements(p_context)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      return false;
    end if;
    if nullif(btrim(v_item ->> 'exercise_id'), '') is null
       and nullif(btrim(v_item ->> 'exercise'), '') is null then
      return false;
    end if;
    if v_item ? 'note'
       and jsonb_typeof(v_item -> 'note') not in ('string', 'null') then
      return false;
    end if;
    if jsonb_typeof(v_item -> 'note') = 'string'
       and char_length(v_item ->> 'note') > 3000 then
      return false;
    end if;
    if v_item ? 'target_rest_s'
       and jsonb_typeof(v_item -> 'target_rest_s') <> 'null' and not (
      jsonb_typeof(v_item -> 'target_rest_s') = 'number'
      and (v_item ->> 'target_rest_s')::numeric between 0 and 3600
      and trunc((v_item ->> 'target_rest_s')::numeric)
          = (v_item ->> 'target_rest_s')::numeric
    ) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Complementa o validador base da Sprint B com campos avancados opcionais.
create or replace function private.activity_strength_set_effort_is_valid(v_set jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
begin
  if jsonb_typeof(v_set) <> 'object' then return false; end if;
  if v_set ? 'note'
     and jsonb_typeof(v_set -> 'note') not in ('string', 'null')
    then return false; end if;
  if jsonb_typeof(v_set -> 'note') = 'string'
     and char_length(v_set ->> 'note') > 2000
    then return false; end if;
  if v_set ? 'rpe'
     and jsonb_typeof(v_set -> 'rpe') <> 'null' and not (
    jsonb_typeof(v_set -> 'rpe') = 'number'
    and (v_set ->> 'rpe')::numeric between 1 and 10
  ) then return false; end if;
  if v_set ? 'rir'
     and jsonb_typeof(v_set -> 'rir') <> 'null' and not (
    jsonb_typeof(v_set -> 'rir') = 'number'
    and (v_set ->> 'rir')::numeric between 0 and 10
  ) then return false; end if;
  if v_set ? 'target_rest_s'
     and jsonb_typeof(v_set -> 'target_rest_s') <> 'null' and not (
    jsonb_typeof(v_set -> 'target_rest_s') = 'number'
    and (v_set ->> 'target_rest_s')::numeric between 0 and 3600
    and trunc((v_set ->> 'target_rest_s')::numeric)
        = (v_set ->> 'target_rest_s')::numeric
  ) then return false; end if;
  if v_set ? 'actual_rest_s'
     and jsonb_typeof(v_set -> 'actual_rest_s') <> 'null' and not (
    jsonb_typeof(v_set -> 'actual_rest_s') = 'number'
    and (v_set ->> 'actual_rest_s')::numeric between 0 and 7200
    and trunc((v_set ->> 'actual_rest_s')::numeric)
        = (v_set ->> 'actual_rest_s')::numeric
  ) then return false; end if;
  return true;
end;
$$;

create or replace function private.activity_strength_sets_are_valid(p_sets jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_set jsonb;
begin
  if p_sets is null or p_sets = 'null'::jsonb then return true; end if;
  if jsonb_typeof(p_sets) <> 'array' then return false; end if;
  for v_set in select value from jsonb_array_elements(p_sets)
  loop
    if not private.activity_strength_set_is_valid(v_set)
       or not private.activity_strength_set_effort_is_valid(v_set) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function private.workout_exercise_context_is_valid(jsonb)
  from public, anon, authenticated;
revoke all on function private.activity_strength_set_effort_is_valid(jsonb)
  from public, anon, authenticated;
revoke all on function private.activity_strength_sets_are_valid(jsonb)
  from public, anon, authenticated;

alter table public.activities
  drop constraint if exists activities_workout_exercise_context_check;
alter table public.activities
  add constraint activities_workout_exercise_context_check
  check (private.workout_exercise_context_is_valid(workout_exercise_context));

comment on column public.activities.workout_note is
  'Nota opcional da sessao inteira; nunca e exigida para finalizar.';
comment on column public.activities.workout_exercise_context is
  'Contexto opcional por exercicio: note e target_rest_s; detalhes por set permanecem em strength_sets.';

-- Versao final do RPC idempotente da Sprint 0, agora aceitando as fundacoes
-- A-C. Todos os campos continuam mapeados explicitamente (sem mass assignment).
create or replace function public.finalize_workout_activity(
  p_client_session_id uuid,
  p_payload jsonb
)
returns public.activities
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_activity public.activities%rowtype;
begin
  if v_user_id is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  if p_client_session_id is null then
    raise exception 'client_session_id_required' using errcode = '22023';
  end if;

  select * into v_activity
    from public.activities
   where user_id = v_user_id
     and client_session_id = p_client_session_id;
  if found then return v_activity; end if;

  insert into public.activities (
    user_id,
    client_session_id,
    publication_state,
    activity_type,
    mode,
    origin,
    source_app,
    started_at,
    ended_at,
    elapsed_s,
    moving_s,
    distance_m,
    elevation_gain_m,
    route,
    strength_sets,
    avg_hr,
    max_hr,
    active_calories,
    total_calories,
    workout_date,
    workout_plan_id,
    workout_plan_name_snapshot,
    workout_plan_exercises_snapshot,
    workout_plan_version_snapshot,
    workout_plan_started_from,
    workout_note,
    workout_exercise_context
  )
  values (
    v_user_id,
    p_client_session_id,
    'private',
    p_payload ->> 'activity_type',
    p_payload ->> 'mode',
    p_payload ->> 'origin',
    nullif(p_payload ->> 'source_app', ''),
    (p_payload ->> 'started_at')::timestamptz,
    (p_payload ->> 'ended_at')::timestamptz,
    greatest(0, coalesce((p_payload ->> 'elapsed_s')::integer, 0)),
    nullif(p_payload ->> 'moving_s', '')::integer,
    nullif(p_payload ->> 'distance_m', '')::numeric,
    nullif(p_payload ->> 'elevation_gain_m', '')::numeric,
    p_payload -> 'route',
    p_payload -> 'strength_sets',
    nullif(p_payload ->> 'avg_hr', '')::integer,
    nullif(p_payload ->> 'max_hr', '')::integer,
    nullif(p_payload ->> 'active_calories', '')::numeric,
    nullif(p_payload ->> 'total_calories', '')::numeric,
    coalesce(
      nullif(p_payload ->> 'workout_date', '')::date,
      ((p_payload ->> 'started_at')::timestamptz at time zone 'America/Sao_Paulo')::date
    ),
    nullif(p_payload ->> 'workout_plan_id', '')::uuid,
    nullif(p_payload ->> 'workout_plan_name_snapshot', ''),
    p_payload -> 'workout_plan_exercises_snapshot',
    nullif(p_payload ->> 'workout_plan_version_snapshot', '')::integer,
    nullif(p_payload ->> 'workout_plan_started_from', ''),
    nullif(p_payload ->> 'workout_note', ''),
    coalesce(
      nullif(p_payload -> 'workout_exercise_context', 'null'::jsonb),
      '[]'::jsonb
    )
  )
  on conflict (user_id, client_session_id)
    where client_session_id is not null
    do nothing
  returning * into v_activity;

  if v_activity.id is null then
    select * into v_activity
      from public.activities
     where user_id = v_user_id
       and client_session_id = p_client_session_id;
  end if;
  return v_activity;
end;
$$;

revoke all on function public.finalize_workout_activity(uuid, jsonb)
  from public, anon;
grant execute on function public.finalize_workout_activity(uuid, jsonb)
  to authenticated;

-- Campos opcionais suportados em cada strength_sets[] a partir daqui:
-- note, rpe (1..10), rir (0..10), target_rest_s e actual_rest_s.
