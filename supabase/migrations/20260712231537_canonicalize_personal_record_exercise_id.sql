-- Canonicaliza recordes de musculacao pelo catalogo sem remover a chave textual
-- legada. A coluna antiga continua sendo retornada pelos RPCs para preservar os
-- contratos atuais do web/Capacitor e os recordes de exercicios personalizados.

alter table public.personal_record_results
  add column if not exists exercise_id uuid
    references public.workout_exercise_catalog(id) on delete set null;

comment on column public.personal_record_results.exercise_id is
  'Identidade canonica opcional do exercicio. exercise_key permanece como fallback para dados legados ou personalizados.';

create index if not exists personal_record_results_user_metric_exercise_best_idx
  on public.personal_record_results (
    user_id,
    metric_key,
    exercise_id,
    value
  )
  where exercise_id is not null;

create index if not exists personal_record_results_exercise_history_idx
  on public.personal_record_results (
    user_id,
    exercise_id,
    achieved_at desc
  )
  where exercise_id is not null;

-- Backfill conservador: associa somente quando o set que originou o recorde
-- ainda possui um exercise_id valido, o nome normalizado e a mesma carga.
-- Linhas ambiguas ou exercicios personalizados permanecem com exercise_id null.
with canonical_matches as (
  select
    pr.id as record_id,
    matched.exercise_id
  from public.personal_record_results pr
  join public.activities activity
    on activity.id = pr.activity_id
   and activity.user_id = pr.user_id
  cross join lateral (
    select catalog.id as exercise_id
    from jsonb_array_elements(
      case
        when jsonb_typeof(activity.strength_sets) = 'array'
          then activity.strength_sets
        else '[]'::jsonb
      end
    ) item
    join public.workout_exercise_catalog catalog
      on catalog.id::text = nullif(trim(item ->> 'exercise_id'), '')
    where lower(trim(item ->> 'exercise')) = pr.exercise_key
      and (item ->> 'weight_kg') ~ '^[0-9]+([.][0-9]+)?$'
      and (item ->> 'weight_kg')::numeric = pr.value
      and (
        pr.reps is null
        or (
          (item ->> 'reps') ~ '^[0-9]+$'
          and (item ->> 'reps')::integer = pr.reps
        )
      )
    order by catalog.id
    limit 1
  ) matched
  where pr.metric_key = 'strength_weight'
    and pr.exercise_id is null
)
update public.personal_record_results pr
set exercise_id = canonical_matches.exercise_id
from canonical_matches
where pr.id = canonical_matches.record_id;

-- Mantem a captura futura canonica. O DISTINCT usa exercise_id quando existe e
-- recorre ao nome normalizado para exercicios ainda fora do catalogo.
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
      exercise_id,
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
      candidate.exercise_id,
      candidate.exercise_name,
      candidate.weight_kg,
      'kg',
      candidate.reps,
      false,
      v_activity.ended_at
    from (
      select distinct on (
        coalesce(catalog.id::text, lower(trim(item ->> 'exercise')))
      )
        lower(trim(item ->> 'exercise')) as exercise_key,
        catalog.id as exercise_id,
        trim(item ->> 'exercise') as exercise_name,
        (item ->> 'weight_kg')::numeric as weight_kg,
        (item ->> 'reps')::integer as reps
      from jsonb_array_elements(v_activity.strength_sets) item
      left join public.workout_exercise_catalog catalog
        on catalog.id::text = nullif(trim(item ->> 'exercise_id'), '')
      where nullif(trim(item ->> 'exercise'), '') is not null
        and (item ->> 'weight_kg') ~ '^[0-9]+([.][0-9]+)?$'
        and (item ->> 'weight_kg')::numeric > 0
        and (item ->> 'reps') ~ '^[0-9]+$'
        and (item ->> 'reps')::integer > 0
      order by
        coalesce(catalog.id::text, lower(trim(item ->> 'exercise'))),
        (item ->> 'weight_kg')::numeric desc,
        (item ->> 'reps')::integer desc
    ) candidate
    on conflict (activity_id, metric_key, exercise_key) do update
      set exercise_id = excluded.exercise_id,
          exercise_name = excluded.exercise_name,
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

-- Mesma assinatura e mesmas colunas de retorno. Apenas o agrupamento interno
-- usa exercise_id quando disponivel, evitando separar aliases do mesmo exercicio.
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
        partition by
          pr.metric_key,
          case
            when pr.metric_key = 'strength_weight'
              then coalesce(pr.exercise_id::text, pr.exercise_key)
            else pr.exercise_key
          end
        order by
          case when pr.metric_key = 'strength_weight' then pr.value end desc,
          case when pr.metric_key <> 'strength_weight' then pr.value end asc,
          pr.achieved_at asc
      ) as position
    from public.personal_record_results pr
    join requested r on r.user_id = pr.user_id
  )
  select
    ranked.id,
    ranked.user_id,
    ranked.activity_id,
    ranked.metric_key,
    ranked.exercise_key,
    ranked.exercise_name,
    ranked.value,
    ranked.unit,
    ranked.reps,
    ranked.is_estimated,
    ranked.achieved_at
  from ranked
  where ranked.position = 1
  order by
    case ranked.metric_key
      when 'run_5k_time' then 1
      when 'run_10k_time' then 2
      else 3
    end,
    ranked.exercise_name nulls last;
$$;

revoke all on function public.get_personal_records(uuid) from public, anon;
grant execute on function public.get_personal_records(uuid) to authenticated;

-- Contrato opt-in para clientes novos. A RPC legada permanece intacta para
-- binarios antigos, enquanto a v2 expoe a identidade canonica ao web/Capacitor.
create or replace function public.get_personal_records_v2(
  p_user_id uuid default null
)
returns table (
  record_id uuid,
  user_id uuid,
  activity_id uuid,
  metric_key text,
  exercise_key text,
  exercise_id uuid,
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
        partition by
          pr.metric_key,
          case
            when pr.metric_key = 'strength_weight'
              then coalesce(pr.exercise_id::text, pr.exercise_key)
            else pr.exercise_key
          end
        order by
          case when pr.metric_key = 'strength_weight' then pr.value end desc,
          case when pr.metric_key <> 'strength_weight' then pr.value end asc,
          pr.achieved_at asc
      ) as position
    from public.personal_record_results pr
    join requested r on r.user_id = pr.user_id
  )
  select
    ranked.id,
    ranked.user_id,
    ranked.activity_id,
    ranked.metric_key,
    ranked.exercise_key,
    ranked.exercise_id,
    ranked.exercise_name,
    ranked.value,
    ranked.unit,
    ranked.reps,
    ranked.is_estimated,
    ranked.achieved_at
  from ranked
  where ranked.position = 1
  order by
    case ranked.metric_key
      when 'run_5k_time' then 1
      when 'run_10k_time' then 2
      else 3
    end,
    ranked.exercise_name nulls last;
$$;

revoke all on function public.get_personal_records_v2(uuid)
  from public, anon;
grant execute on function public.get_personal_records_v2(uuid)
  to authenticated;

-- Aceita a exercise_key textual existente e tambem um UUID canonico em texto.
-- Quando a chave textual resolve para um exercise_id, o ranking agrega aliases.
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
  target as (
    select coalesce(
      (
        select catalog.id
        from public.workout_exercise_catalog catalog
        where catalog.id::text = coalesce(p_exercise_key, '')
        limit 1
      ),
      (
        select pr.exercise_id
        from public.personal_record_results pr
        join members m on m.user_id = pr.user_id
        where pr.metric_key = p_metric_key
          and pr.exercise_key = coalesce(p_exercise_key, '')
          and pr.exercise_id is not null
        order by
          (pr.user_id = (select user_id from viewer)) desc,
          pr.achieved_at desc
        limit 1
      )
    ) as exercise_id
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
    cross join target
    where pr.metric_key = p_metric_key
      and (
        (target.exercise_id is not null and pr.exercise_id = target.exercise_id)
        or (
          target.exercise_id is null
          and pr.exercise_key = coalesce(p_exercise_key, '')
        )
      )
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

-- Riscos deliberadamente preservados:
-- 1. exercicios personalizados/legados sem ID continuam somente por exercise_key;
-- 2. nenhum resultado existente e apagado ou recalculado nesta migration;
-- 3. as policies e grants da tabela nao mudam: exercise_id segue a RLS da linha.
--
-- SQL de validacao manual (nao executado pela migration):
-- select count(*) filter (where exercise_id is not null) as canonical,
--        count(*) filter (where exercise_id is null) as legacy
-- from public.personal_record_results
-- where metric_key = 'strength_weight';
--
-- select user_id, exercise_id, count(*)
-- from public.personal_record_results
-- where exercise_id is not null
-- group by user_id, exercise_id
-- having count(*) > 1
-- order by count(*) desc;
--
-- select * from public.get_personal_records(auth.uid());
-- select grantee, privilege_type
-- from information_schema.routine_privileges
-- where routine_schema = 'public'
--   and routine_name in ('get_personal_records', 'get_personal_record_leaderboard');
