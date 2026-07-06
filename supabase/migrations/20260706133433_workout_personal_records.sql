-- Recordes pessoais derivados de atividades.
--
-- Guardamos uma "tentativa" por atividade/métrica. O melhor resultado é
-- calculado pelos RPCs; assim o histórico continua disponível e apagar uma
-- atividade também remove o resultado correspondente.

create table if not exists public.personal_record_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  metric_key text not null check (
    metric_key in ('strength_weight', 'run_5k_time', 'run_10k_time')
  ),
  exercise_key text not null default '',
  exercise_name text,
  value numeric not null check (value > 0),
  unit text not null check (unit in ('kg', 'seconds')),
  reps integer check (reps is null or reps > 0),
  is_estimated boolean not null default false,
  achieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (activity_id, metric_key, exercise_key)
);

comment on table public.personal_record_results is
  'Resultados por atividade usados para calcular recordes pessoais e rankings entre amigos.';
comment on column public.personal_record_results.is_estimated is
  'true quando o tempo de 5/10 km foi projetado pelo ritmo médio porque o treino ultrapassou a distância-alvo.';

create index if not exists personal_record_results_user_metric_best_idx
  on public.personal_record_results (user_id, metric_key, exercise_key, value);
create index if not exists personal_record_results_activity_idx
  on public.personal_record_results (activity_id);

alter table public.personal_record_results enable row level security;

revoke all on table public.personal_record_results from public, anon;
grant select on table public.personal_record_results to authenticated;

drop policy if exists personal_record_results_visible on public.personal_record_results;
create policy personal_record_results_visible
  on public.personal_record_results
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles p
      where p.user_id = personal_record_results.user_id
        and p.account_status = 'active'
        and p.deleted_at is null
        and (
          not p.is_private
          or exists (
            select 1
            from public.follows f
            where f.follower_id = (select auth.uid())
              and f.following_id = personal_record_results.user_id
              and f.status = 'accepted'
          )
        )
    )
  );

create or replace function private.rebuild_activity_personal_records(
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_activity public.activities%rowtype;
  v_duration_s integer;
begin
  select *
    into v_activity
    from public.activities
   where id = p_activity_id;

  if not found then
    return;
  end if;

  delete from public.personal_record_results
   where activity_id = p_activity_id;

  if v_activity.activity_type = 'strength'
     and jsonb_typeof(v_activity.strength_sets) = 'array' then
    insert into public.personal_record_results (
      user_id,
      activity_id,
      metric_key,
      exercise_key,
      exercise_name,
      value,
      unit,
      reps,
      is_estimated,
      achieved_at
    )
    select
      v_activity.user_id,
      v_activity.id,
      'strength_weight',
      candidate.exercise_key,
      candidate.exercise_name,
      candidate.weight_kg,
      'kg',
      candidate.reps,
      false,
      v_activity.ended_at
    from (
      select distinct on (lower(trim(item ->> 'exercise')))
        lower(trim(item ->> 'exercise')) as exercise_key,
        trim(item ->> 'exercise') as exercise_name,
        (item ->> 'weight_kg')::numeric as weight_kg,
        (item ->> 'reps')::integer as reps
      from jsonb_array_elements(v_activity.strength_sets) item
      where nullif(trim(item ->> 'exercise'), '') is not null
        and (item ->> 'weight_kg') ~ '^[0-9]+([.][0-9]+)?$'
        and (item ->> 'weight_kg')::numeric > 0
        and (item ->> 'reps') ~ '^[0-9]+$'
        and (item ->> 'reps')::integer > 0
      order by
        lower(trim(item ->> 'exercise')),
        (item ->> 'weight_kg')::numeric desc,
        (item ->> 'reps')::integer desc
    ) candidate
    on conflict (activity_id, metric_key, exercise_key) do update
      set exercise_name = excluded.exercise_name,
          value = excluded.value,
          reps = excluded.reps,
          achieved_at = excluded.achieved_at;
  end if;

  v_duration_s := coalesce(v_activity.moving_s, v_activity.elapsed_s);

  if v_activity.activity_type = 'run'
     and coalesce(v_activity.distance_m, 0) >= 4900
     and v_duration_s > 0 then
    insert into public.personal_record_results (
      user_id,
      activity_id,
      metric_key,
      exercise_key,
      exercise_name,
      value,
      unit,
      reps,
      is_estimated,
      achieved_at
    )
    values (
      v_activity.user_id,
      v_activity.id,
      'run_5k_time',
      '',
      null,
      round((v_duration_s::numeric * 5000) / v_activity.distance_m, 2),
      'seconds',
      null,
      abs(v_activity.distance_m - 5000) > 100,
      v_activity.ended_at
    )
    on conflict (activity_id, metric_key, exercise_key) do update
      set value = excluded.value,
          is_estimated = excluded.is_estimated,
          achieved_at = excluded.achieved_at;
  end if;

  if v_activity.activity_type = 'run'
     and coalesce(v_activity.distance_m, 0) >= 9800
     and v_duration_s > 0 then
    insert into public.personal_record_results (
      user_id,
      activity_id,
      metric_key,
      exercise_key,
      exercise_name,
      value,
      unit,
      reps,
      is_estimated,
      achieved_at
    )
    values (
      v_activity.user_id,
      v_activity.id,
      'run_10k_time',
      '',
      null,
      round((v_duration_s::numeric * 10000) / v_activity.distance_m, 2),
      'seconds',
      null,
      abs(v_activity.distance_m - 10000) > 200,
      v_activity.ended_at
    )
    on conflict (activity_id, metric_key, exercise_key) do update
      set value = excluded.value,
          is_estimated = excluded.is_estimated,
          achieved_at = excluded.achieved_at;
  end if;
end;
$$;

revoke all on function private.rebuild_activity_personal_records(uuid)
  from public, anon, authenticated;

create or replace function private.capture_activity_personal_records()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.rebuild_activity_personal_records(new.id);
  return new;
end;
$$;

revoke all on function private.capture_activity_personal_records()
  from public, anon, authenticated;

drop trigger if exists activities_capture_personal_records
  on public.activities;
create trigger activities_capture_personal_records
  after insert or update of
    activity_type,
    strength_sets,
    distance_m,
    moving_s,
    elapsed_s,
    ended_at
  on public.activities
  for each row
  execute function private.capture_activity_personal_records();

-- Backfill das atividades já existentes.
select private.rebuild_activity_personal_records(id)
  from public.activities
 where activity_type in ('strength', 'run');

create or replace function public.get_personal_records(
  p_user_id uuid default null
)
returns table (
  record_id uuid,
  user_id uuid,
  activity_id uuid,
  metric_key text,
  exercise_key text,
  exercise_name text,
  value numeric,
  unit text,
  reps integer,
  is_estimated boolean,
  achieved_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with requested as (
    select coalesce(p_user_id, auth.uid()) as user_id
  ),
  ranked as (
    select
      pr.*,
      row_number() over (
        partition by pr.metric_key, pr.exercise_key
        order by
          case when pr.metric_key = 'strength_weight' then pr.value end desc,
          case when pr.metric_key <> 'strength_weight' then pr.value end asc,
          pr.achieved_at asc
      ) as position
    from public.personal_record_results pr
    join requested r on r.user_id = pr.user_id
  )
  select
    id,
    ranked.user_id,
    activity_id,
    metric_key,
    exercise_key,
    exercise_name,
    value,
    unit,
    reps,
    is_estimated,
    achieved_at
  from ranked
  where position = 1
  order by
    case metric_key
      when 'run_5k_time' then 1
      when 'run_10k_time' then 2
      else 3
    end,
    exercise_name nulls last;
$$;

revoke all on function public.get_personal_records(uuid) from public, anon;
grant execute on function public.get_personal_records(uuid) to authenticated;

create or replace function public.get_personal_record_leaderboard(
  p_metric_key text,
  p_exercise_key text default '',
  p_limit integer default 20
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  value numeric,
  unit text,
  reps integer,
  is_estimated boolean,
  achieved_at timestamptz,
  rank integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  members as (
    select user_id
      from viewer
     where user_id is not null
    union
    select f.following_id
      from viewer v
      join public.follows f
        on f.follower_id = v.user_id
       and f.status = 'accepted'
  ),
  best as (
    select distinct on (pr.user_id)
      pr.user_id,
      pr.value,
      pr.unit,
      pr.reps,
      pr.is_estimated,
      pr.achieved_at
    from public.personal_record_results pr
    join members m on m.user_id = pr.user_id
    where pr.metric_key = p_metric_key
      and pr.exercise_key = coalesce(p_exercise_key, '')
    order by
      pr.user_id,
      case when p_metric_key = 'strength_weight' then pr.value end desc,
      case when p_metric_key <> 'strength_weight' then pr.value end asc,
      pr.achieved_at asc
  )
  select
    b.user_id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    b.value,
    b.unit,
    b.reps,
    b.is_estimated,
    b.achieved_at,
    rank() over (
      order by
        case when p_metric_key = 'strength_weight' then b.value end desc,
        case when p_metric_key <> 'strength_weight' then b.value end asc,
        b.achieved_at asc
    )::integer as rank
  from best b
  join public.profiles p on p.user_id = b.user_id
  where p.account_status = 'active'
    and p.deleted_at is null
  order by rank, p.display_name
  limit greatest(1, least(p_limit, 100));
$$;

revoke all on function public.get_personal_record_leaderboard(text, text, integer)
  from public, anon;
grant execute on function public.get_personal_record_leaderboard(text, text, integer)
  to authenticated;
