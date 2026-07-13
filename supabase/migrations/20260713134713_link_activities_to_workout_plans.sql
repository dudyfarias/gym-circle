-- Sprint A: vincula a execucao ao treino salvo sem perder o estado historico.
-- O FK e deliberadamente nullable: treinos livres/importados e activities
-- legadas continuam validos. Os snapshots sobrevivem a edicao/exclusao do
-- workout_plan e representam o que o usuario iniciou naquela sessao.

alter table public.workout_plans
  add column if not exists plan_version integer not null default 1,
  add column if not exists is_favorite boolean not null default false;

alter table public.workout_plans
  drop constraint if exists workout_plans_plan_version_check;
alter table public.workout_plans
  add constraint workout_plans_plan_version_check
  check (plan_version >= 1);

create or replace function private.guard_workout_plan_version()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.name is distinct from old.name
     or new.exercises is distinct from old.exercises then
    new.plan_version := old.plan_version + 1;
    new.updated_at := now();
  else
    -- plan_version e derivada do conteudo, nao de input do cliente.
    new.plan_version := old.plan_version;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_workout_plan_version()
  from public, anon, authenticated;

drop trigger if exists workout_plans_guard_version on public.workout_plans;
create trigger workout_plans_guard_version
  before update on public.workout_plans
  for each row
  execute function private.guard_workout_plan_version();

alter table public.activities
  add column if not exists workout_plan_id uuid
    references public.workout_plans(id) on delete set null,
  add column if not exists workout_plan_name_snapshot text,
  add column if not exists workout_plan_exercises_snapshot jsonb,
  add column if not exists workout_plan_version_snapshot integer,
  add column if not exists workout_plan_started_from text;

alter table public.activities
  drop constraint if exists activities_workout_plan_snapshot_array_check;
alter table public.activities
  add constraint activities_workout_plan_snapshot_array_check
  check (
    workout_plan_exercises_snapshot is null
    or jsonb_typeof(workout_plan_exercises_snapshot) = 'array'
  );

alter table public.activities
  drop constraint if exists activities_workout_plan_version_snapshot_check;
alter table public.activities
  add constraint activities_workout_plan_version_snapshot_check
  check (
    workout_plan_version_snapshot is null
    or workout_plan_version_snapshot >= 1
  );

alter table public.activities
  drop constraint if exists activities_workout_plan_started_from_check;
alter table public.activities
  add constraint activities_workout_plan_started_from_check
  check (
    workout_plan_started_from is null
    or workout_plan_started_from in (
      'saved_plan',
      'free',
      'suggested',
      'duplicate',
      'imported'
    )
  );

create index if not exists activities_user_plan_started_idx
  on public.activities (user_id, workout_plan_id, started_at desc)
  where workout_plan_id is not null;

create index if not exists workout_plans_user_favorite_updated_idx
  on public.workout_plans (user_id, is_favorite desc, updated_at desc);

create or replace function private.validate_activity_workout_plan()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_plan public.workout_plans%rowtype;
begin
  if new.workout_plan_id is null then
    if new.workout_plan_started_from is null then
      new.workout_plan_started_from :=
        case when new.origin = 'imported' then 'imported' else 'free' end;
    end if;
    return new;
  end if;

  select *
    into v_plan
    from public.workout_plans
   where id = new.workout_plan_id;

  if not found then
    -- O plano pode ter sido apagado enquanto uma sessao offline estava ativa.
    -- Com snapshot completo, preservamos o treino sem FK em vez de perder a
    -- finalizacao. Nenhum dado do plano ausente e consultado/exposto.
    if new.workout_plan_name_snapshot is not null
       and new.workout_plan_exercises_snapshot is not null
       and jsonb_typeof(new.workout_plan_exercises_snapshot) = 'array' then
      new.workout_plan_id := null;
      new.workout_plan_started_from :=
        coalesce(new.workout_plan_started_from, 'saved_plan');
      return new;
    end if;
    raise exception 'workout_plan_not_owned_by_activity_user'
      using errcode = '23514';
  end if;

  if v_plan.user_id is distinct from new.user_id then
    raise exception 'workout_plan_not_owned_by_activity_user'
      using errcode = '23514';
  end if;

  new.workout_plan_started_from :=
    coalesce(new.workout_plan_started_from, 'saved_plan');
  new.workout_plan_name_snapshot :=
    coalesce(nullif(btrim(new.workout_plan_name_snapshot), ''), v_plan.name);
  new.workout_plan_exercises_snapshot := case
    when new.workout_plan_exercises_snapshot is null
      or new.workout_plan_exercises_snapshot = 'null'::jsonb
      then v_plan.exercises
    else new.workout_plan_exercises_snapshot
  end;
  new.workout_plan_version_snapshot :=
    coalesce(new.workout_plan_version_snapshot, v_plan.plan_version);

  if new.workout_plan_version_snapshot > v_plan.plan_version then
    raise exception 'workout_plan_snapshot_version_is_in_the_future'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_activity_workout_plan()
  from public, anon, authenticated;

drop trigger if exists activities_validate_workout_plan on public.activities;
create trigger activities_validate_workout_plan
  before insert or update of
    user_id,
    origin,
    workout_plan_id,
    workout_plan_name_snapshot,
    workout_plan_exercises_snapshot,
    workout_plan_version_snapshot,
    workout_plan_started_from
  on public.activities
  for each row
  execute function private.validate_activity_workout_plan();

comment on column public.workout_plans.plan_version is
  'Versao monotona incrementada apenas quando nome/exercises mudam.';
comment on column public.workout_plans.is_favorite is
  'Preferencia owner-only usada para fixar treinos; nao e estatistica derivada.';
comment on column public.activities.workout_plan_id is
  'Treino salvo que originou a sessao; nullable para treino livre/importado.';
comment on column public.activities.workout_plan_name_snapshot is
  'Nome do treino salvo no momento em que a sessao foi iniciada.';
comment on column public.activities.workout_plan_exercises_snapshot is
  'Lista de exercicios planejada no inicio; preserva historico apos edicoes.';
comment on column public.activities.workout_plan_version_snapshot is
  'Versao de workout_plans usada para iniciar a sessao.';
comment on column public.activities.workout_plan_started_from is
  'Origem semantica: saved_plan/free/suggested/duplicate/imported.';

-- Nao existe backfill confiavel para ligar activities antigas a um plano.
-- Elas permanecem workout_plan_id null; inferencia por nome seria destrutiva.

-- Estatisticas sao calculadas de activities, evitando caches times_used,
-- last_used_at e average_duration_s que poderiam divergir. Uma unica agregacao
-- atende todos os cards do usuario, sem RPC por plano/N+1.
create or replace function public.get_my_workout_plan_stats()
returns table(
  workout_plan_id uuid,
  execution_count bigint,
  last_executed_at timestamptz,
  average_duration_s numeric,
  average_volume_kg numeric,
  max_volume_kg numeric,
  average_completion_rate numeric,
  completed_planned_sets bigint,
  planned_sets bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with activity_rollup as (
    select
      activity.id,
      activity.workout_plan_id,
      activity.ended_at,
      greatest(activity.elapsed_s, 0) as elapsed_s,
      coalesce(sum(
        case
          when coalesce(set_item ->> 'load_type', 'external') = 'external'
           and coalesce(set_item ->> 'set_status', 'completed')
               in ('completed', 'added')
           and (set_item ->> 'weight_kg') ~ '^[0-9]+([.][0-9]+)?$'
           and (set_item ->> 'weight_kg')::numeric > 0
           and (set_item ->> 'reps') ~ '^[0-9]+$'
           and (set_item ->> 'reps')::integer > 0
          then (set_item ->> 'weight_kg')::numeric
             * (set_item ->> 'reps')::integer
          else 0
        end
      ), 0)::numeric as volume_kg,
      count(*) filter (
        where set_item ->> 'set_origin' = 'planned'
      ) as planned_sets,
      count(*) filter (
        where set_item ->> 'set_origin' = 'planned'
          and set_item ->> 'set_status' = 'completed'
      ) as completed_planned_sets
    from public.activities activity
    left join lateral jsonb_array_elements(
      coalesce(activity.strength_sets, '[]'::jsonb)
    ) set_item on true
    where activity.user_id = (select auth.uid())
      and activity.workout_plan_id is not null
    group by
      activity.id,
      activity.workout_plan_id,
      activity.ended_at,
      activity.elapsed_s
  ), plan_rollup as (
    select
      rollup.workout_plan_id,
      count(*)::bigint as execution_count,
      max(rollup.ended_at) as last_executed_at,
      round(avg(rollup.elapsed_s)::numeric, 2) as average_duration_s,
      round(avg(rollup.volume_kg)::numeric, 2) as average_volume_kg,
      round(max(rollup.volume_kg)::numeric, 2) as max_volume_kg,
      round(avg(
        case when rollup.planned_sets > 0
          then rollup.completed_planned_sets::numeric / rollup.planned_sets
        end
      ), 4) as average_completion_rate,
      sum(rollup.completed_planned_sets)::bigint as completed_planned_sets,
      sum(rollup.planned_sets)::bigint as planned_sets
    from activity_rollup rollup
    group by rollup.workout_plan_id
  )
  select
    plan.id,
    coalesce(stats.execution_count, 0),
    stats.last_executed_at,
    stats.average_duration_s,
    stats.average_volume_kg,
    stats.max_volume_kg,
    stats.average_completion_rate,
    coalesce(stats.completed_planned_sets, 0),
    coalesce(stats.planned_sets, 0)
  from public.workout_plans plan
  left join plan_rollup stats on stats.workout_plan_id = plan.id
  where plan.user_id = (select auth.uid())
  order by plan.is_favorite desc, stats.last_executed_at desc nulls last,
           plan.updated_at desc;
$$;

revoke all on function public.get_my_workout_plan_stats()
  from public, anon;
grant execute on function public.get_my_workout_plan_stats()
  to authenticated;

comment on function public.get_my_workout_plan_stats() is
  'Stats owner-only derivadas em lote de activities ligadas; nao persiste contadores.';
