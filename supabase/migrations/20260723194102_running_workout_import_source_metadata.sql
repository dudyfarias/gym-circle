-- Preserve reviewed import provenance for new structured running plans.
-- Existing plans keep immutable source/source_metadata during later edits.
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
  v_source text := coalesce(nullif(btrim(p_plan ->> 'source'), ''), 'manual');
  v_source_metadata jsonb :=
    case
      when jsonb_typeof(p_plan -> 'source_metadata') = 'object'
        then p_plan -> 'source_metadata'
      else '{}'::jsonb
    end;
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
  if v_source not in ('manual', 'text', 'image', 'pdf') then
    raise exception 'invalid_running_plan_source' using errcode = '22023';
  end if;
  if octet_length(v_source_metadata::text) > 65536 then
    raise exception 'running_plan_source_metadata_too_large'
      using errcode = '22023';
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
      v_source,
      v_source_metadata
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
