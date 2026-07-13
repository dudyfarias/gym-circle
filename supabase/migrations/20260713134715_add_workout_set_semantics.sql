-- Sprint B: contrato semantico aditivo para activities.strength_sets.
-- Mantemos JSONB como fonte no curto prazo para nao criar dual-write com os
-- leitores atuais. O trigger normaliza payloads novos e o check rejeita dados
-- incoerentes antes que contaminem volume, PRs ou graficos.

create or replace function private.normalize_activity_strength_sets(
  p_sets jsonb,
  p_started_from_plan boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb := '[]'::jsonb;
  v_set jsonb;
  v_ordinal bigint;
  v_weight numeric;
  v_assisted_weight numeric;
  v_bodyweight numeric;
  v_planned_weight numeric;
  v_load_type text;
  v_status text;
  v_origin text;
  v_has_result boolean;
begin
  if p_sets is null or p_sets = 'null'::jsonb then
    return null;
  end if;
  if jsonb_typeof(p_sets) <> 'array' then
    raise exception 'strength_sets_must_be_an_array' using errcode = '23514';
  end if;

  for v_set, v_ordinal in
    select value, ordinality
      from jsonb_array_elements(p_sets) with ordinality
  loop
    if jsonb_typeof(v_set) <> 'object' then
      raise exception 'strength_set_must_be_an_object' using errcode = '23514';
    end if;

    v_weight := case
      when jsonb_typeof(v_set -> 'weight_kg') = 'number'
        then (v_set ->> 'weight_kg')::numeric
      else null
    end;
    v_assisted_weight := case
      when jsonb_typeof(v_set -> 'assisted_weight_kg') = 'number'
        then (v_set ->> 'assisted_weight_kg')::numeric
      else null
    end;
    v_bodyweight := case
      when jsonb_typeof(v_set -> 'bodyweight_kg_snapshot') = 'number'
        then (v_set ->> 'bodyweight_kg_snapshot')::numeric
      else null
    end;
    v_planned_weight := case
      when jsonb_typeof(v_set -> 'planned_weight_kg') = 'number'
        then (v_set ->> 'planned_weight_kg')::numeric
      else null
    end;

    if v_weight is not null and v_weight <= 0 then
      v_weight := null;
    end if;
    if v_assisted_weight is not null and v_assisted_weight <= 0 then
      v_assisted_weight := null;
    end if;
    if v_bodyweight is not null and v_bodyweight <= 0 then
      v_bodyweight := null;
    end if;
    if v_planned_weight is not null and v_planned_weight <= 0 then
      v_planned_weight := null;
    end if;

    v_has_result :=
      (jsonb_typeof(v_set -> 'reps') = 'number'
       and (v_set ->> 'reps')::numeric > 0)
      or
      (jsonb_typeof(v_set -> 'duration_seconds') = 'number'
       and (v_set ->> 'duration_seconds')::numeric > 0);

    v_origin := nullif(btrim(v_set ->> 'set_origin'), '');
    if v_origin is null then
      v_origin := case when p_started_from_plan then 'planned' else 'added' end;
    end if;
    if v_origin not in ('planned', 'added') then
      raise exception 'invalid_strength_set_origin' using errcode = '23514';
    end if;

    v_status := nullif(btrim(v_set ->> 'set_status'), '');
    if v_status is null then
      v_status := case
        when v_has_result and v_origin = 'added' then 'added'
        when v_has_result then 'completed'
        else 'planned'
      end;
    end if;
    if v_status not in ('planned', 'completed', 'skipped', 'added') then
      raise exception 'invalid_strength_set_status' using errcode = '23514';
    end if;
    if v_status in ('completed', 'added') and not v_has_result then
      raise exception 'completed_strength_set_requires_a_result'
        using errcode = '23514';
    end if;
    if v_status in ('planned', 'skipped') and v_has_result then
      raise exception 'incomplete_strength_set_cannot_have_actual_result'
        using errcode = '23514';
    end if;
    if v_status = 'added' and v_origin <> 'added' then
      raise exception 'added_strength_set_requires_added_origin'
        using errcode = '23514';
    end if;

    v_load_type := nullif(btrim(v_set ->> 'load_type'), '');
    if v_load_type is null then
      v_load_type := case
        when v_assisted_weight is not null then 'assisted'
        when v_weight is not null or v_planned_weight is not null then 'external'
        else 'not_provided'
      end;
    end if;
    if v_load_type not in ('external', 'bodyweight', 'assisted', 'not_provided') then
      raise exception 'invalid_strength_set_load_type' using errcode = '23514';
    end if;
    if v_status in ('completed', 'added')
       and v_load_type = 'external' and v_weight is null then
      raise exception 'external_load_requires_positive_weight'
        using errcode = '23514';
    end if;
    if v_status in ('completed', 'added')
       and v_load_type = 'assisted' and v_assisted_weight is null then
      raise exception 'assisted_load_requires_positive_assistance'
        using errcode = '23514';
    end if;
    if v_load_type in ('bodyweight', 'not_provided')
       and (v_weight is not null or v_assisted_weight is not null) then
      raise exception 'load_type_weight_mismatch' using errcode = '23514';
    end if;
    if v_load_type = 'external' and v_assisted_weight is not null then
      raise exception 'external_load_cannot_have_assistance'
        using errcode = '23514';
    end if;
    if v_load_type = 'assisted' and v_weight is not null then
      raise exception 'assisted_load_cannot_have_external_weight'
        using errcode = '23514';
    end if;
    if v_load_type <> 'bodyweight' and v_bodyweight is not null then
      raise exception 'bodyweight_snapshot_requires_bodyweight_load_type'
        using errcode = '23514';
    end if;

    v_set := v_set || jsonb_build_object(
      'set_id', coalesce(nullif(btrim(v_set ->> 'set_id'), ''), gen_random_uuid()::text),
      'set_index', coalesce(
        case when jsonb_typeof(v_set -> 'set_index') = 'number'
          then greatest(1, (v_set ->> 'set_index')::integer) end,
        v_ordinal::integer
      ),
      'set_status', v_status,
      'set_origin', v_origin,
      'load_type', v_load_type,
      'weight_kg', v_weight,
      'assisted_weight_kg', v_assisted_weight,
      'bodyweight_kg_snapshot', v_bodyweight,
      'planned_weight_kg', v_planned_weight
    );

    v_result := v_result || jsonb_build_array(v_set);
  end loop;

  return v_result;
end;
$$;

create or replace function private.activity_strength_set_is_valid(v_set jsonb)
returns boolean
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_load_type text;
  v_status text;
  v_origin text;
  v_has_result boolean;
begin
  if jsonb_typeof(v_set) <> 'object'
     or nullif(btrim(v_set ->> 'set_id'), '') is null then
    return false;
  end if;

  v_load_type := v_set ->> 'load_type';
  v_status := v_set ->> 'set_status';
  v_origin := v_set ->> 'set_origin';
  if v_load_type not in ('external', 'bodyweight', 'assisted', 'not_provided')
     or v_status not in ('planned', 'completed', 'skipped', 'added')
     or v_origin not in ('planned', 'added') then
    return false;
  end if;

  v_has_result :=
    (jsonb_typeof(v_set -> 'reps') = 'number'
     and (v_set ->> 'reps')::numeric > 0)
    or
    (jsonb_typeof(v_set -> 'duration_seconds') = 'number'
     and (v_set ->> 'duration_seconds')::numeric > 0);

  if v_status in ('completed', 'added') and not v_has_result then
    return false;
  end if;
  if v_status in ('planned', 'skipped') and v_has_result then
    return false;
  end if;
  if v_status = 'added' and v_origin <> 'added' then
    return false;
  end if;

  if v_set ? 'reps' and jsonb_typeof(v_set -> 'reps') <> 'null' and not (
    jsonb_typeof(v_set -> 'reps') = 'number'
    and (v_set ->> 'reps')::numeric >= 0
    and trunc((v_set ->> 'reps')::numeric) = (v_set ->> 'reps')::numeric
  ) then return false; end if;
  if v_set ? 'duration_seconds'
     and jsonb_typeof(v_set -> 'duration_seconds') <> 'null' and not (
    jsonb_typeof(v_set -> 'duration_seconds') = 'number'
    and (v_set ->> 'duration_seconds')::numeric >= 0
    and trunc((v_set ->> 'duration_seconds')::numeric)
        = (v_set ->> 'duration_seconds')::numeric
  ) then return false; end if;

  if v_load_type = 'external' then
    if not coalesce(jsonb_typeof(v_set -> 'assisted_weight_kg') = 'null', true)
      then return false; end if;
    if v_status in ('completed', 'added') and not (
      jsonb_typeof(v_set -> 'weight_kg') = 'number'
      and (v_set ->> 'weight_kg')::numeric > 0
    ) then return false; end if;
    if v_status in ('planned', 'skipped') and not (
      coalesce(jsonb_typeof(v_set -> 'weight_kg') = 'null', true)
      or (
        jsonb_typeof(v_set -> 'weight_kg') = 'number'
        and (v_set ->> 'weight_kg')::numeric > 0
      )
    ) then return false; end if;
  end if;
  if v_load_type = 'assisted' then
    if not coalesce(jsonb_typeof(v_set -> 'weight_kg') = 'null', true)
      then return false; end if;
    if v_status in ('completed', 'added') and not (
      jsonb_typeof(v_set -> 'assisted_weight_kg') = 'number'
      and (v_set ->> 'assisted_weight_kg')::numeric > 0
    ) then return false; end if;
    if v_status in ('planned', 'skipped') and not (
      coalesce(jsonb_typeof(v_set -> 'assisted_weight_kg') = 'null', true)
      or (
        jsonb_typeof(v_set -> 'assisted_weight_kg') = 'number'
        and (v_set ->> 'assisted_weight_kg')::numeric > 0
      )
    ) then return false; end if;
  end if;
  if v_load_type in ('bodyweight', 'not_provided') and not (
    coalesce(jsonb_typeof(v_set -> 'weight_kg') = 'null', true)
    and coalesce(jsonb_typeof(v_set -> 'assisted_weight_kg') = 'null', true)
  ) then return false; end if;

  if v_set ? 'bodyweight_kg_snapshot'
     and jsonb_typeof(v_set -> 'bodyweight_kg_snapshot') <> 'null' and not (
    v_load_type = 'bodyweight'
    and jsonb_typeof(v_set -> 'bodyweight_kg_snapshot') = 'number'
    and (v_set ->> 'bodyweight_kg_snapshot')::numeric > 0
  ) then return false; end if;
  if v_set ? 'planned_weight_kg'
     and jsonb_typeof(v_set -> 'planned_weight_kg') <> 'null' and not (
    v_load_type = 'external'
    and jsonb_typeof(v_set -> 'planned_weight_kg') = 'number'
    and (v_set ->> 'planned_weight_kg')::numeric > 0
  ) then return false; end if;

  if v_set ? 'planned_reps_min'
     and jsonb_typeof(v_set -> 'planned_reps_min') <> 'null' and not (
    jsonb_typeof(v_set -> 'planned_reps_min') = 'number'
    and (v_set ->> 'planned_reps_min')::numeric > 0
    and trunc((v_set ->> 'planned_reps_min')::numeric)
        = (v_set ->> 'planned_reps_min')::numeric
  ) then return false; end if;
  if v_set ? 'planned_reps_max'
     and jsonb_typeof(v_set -> 'planned_reps_max') <> 'null' and not (
    jsonb_typeof(v_set -> 'planned_reps_max') = 'number'
    and (v_set ->> 'planned_reps_max')::numeric > 0
    and trunc((v_set ->> 'planned_reps_max')::numeric)
        = (v_set ->> 'planned_reps_max')::numeric
  ) then return false; end if;
  if jsonb_typeof(v_set -> 'planned_reps_min') = 'number'
     and jsonb_typeof(v_set -> 'planned_reps_max') = 'number'
     and (v_set ->> 'planned_reps_max')::numeric
         < (v_set ->> 'planned_reps_min')::numeric
    then return false; end if;
  if v_set ? 'planned_duration_seconds'
     and jsonb_typeof(v_set -> 'planned_duration_seconds') <> 'null' and not (
    jsonb_typeof(v_set -> 'planned_duration_seconds') = 'number'
    and (v_set ->> 'planned_duration_seconds')::numeric > 0
    and trunc((v_set ->> 'planned_duration_seconds')::numeric)
        = (v_set ->> 'planned_duration_seconds')::numeric
  ) then return false; end if;

  if v_set ? 'planned_set_index'
     and jsonb_typeof(v_set -> 'planned_set_index') <> 'null' and not (
    jsonb_typeof(v_set -> 'planned_set_index') = 'number'
    and (v_set ->> 'planned_set_index')::numeric > 0
    and trunc((v_set ->> 'planned_set_index')::numeric)
        = (v_set ->> 'planned_set_index')::numeric
  ) then return false; end if;
  if v_set ? 'actual_set_index'
     and jsonb_typeof(v_set -> 'actual_set_index') <> 'null' and not (
    jsonb_typeof(v_set -> 'actual_set_index') = 'number'
    and (v_set ->> 'actual_set_index')::numeric > 0
    and trunc((v_set ->> 'actual_set_index')::numeric)
        = (v_set ->> 'actual_set_index')::numeric
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
    if not private.activity_strength_set_is_valid(v_set) then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.normalize_activity_strength_sets_trigger()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.strength_sets := private.normalize_activity_strength_sets(
    new.strength_sets,
    new.workout_plan_id is not null
  );
  return new;
end;
$$;

revoke all on function private.normalize_activity_strength_sets(jsonb, boolean)
  from public, anon, authenticated;
revoke all on function private.activity_strength_set_is_valid(jsonb)
  from public, anon, authenticated;
revoke all on function private.activity_strength_sets_are_valid(jsonb)
  from public, anon, authenticated;
revoke all on function private.normalize_activity_strength_sets_trigger()
  from public, anon, authenticated;

drop trigger if exists activities_normalize_strength_sets on public.activities;
create trigger activities_normalize_strength_sets
  before insert or update of strength_sets, workout_plan_id
  on public.activities
  for each row
  execute function private.normalize_activity_strength_sets_trigger();

-- Backfill pequeno e deterministico: nao inventa carga. 0/negativo vira null;
-- sets com resultado viram added/completed sem inventar que eram planejados.
update public.activities
   set strength_sets = private.normalize_activity_strength_sets(
     strength_sets,
     false
   )
 where strength_sets is not null;

alter table public.activities
  drop constraint if exists activities_strength_sets_semantics_check;
alter table public.activities
  add constraint activities_strength_sets_semantics_check
  check (private.activity_strength_sets_are_valid(strength_sets));

comment on column public.activities.strength_sets is
  'JSONB versionado por set: set_id/index/status/origin, target e carga semantica. weight_kg 0 nunca representa carga informada.';

-- Diagnostico apos aplicar em preview:
-- select set_item ->> 'load_type', count(*)
-- from public.activities a
-- cross join lateral jsonb_array_elements(coalesce(a.strength_sets, '[]')) set_item
-- group by 1 order by 1;
