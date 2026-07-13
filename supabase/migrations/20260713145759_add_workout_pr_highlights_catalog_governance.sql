-- Sprint D/G: snapshots imutaveis de recordes conquistados por activity e
-- governanca editorial do catalogo comunitario. Tudo aditivo e retrocompativel.

create table if not exists public.activity_record_highlights (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_key text not null check (
    metric_key in ('strength_weight', 'run_5k_time', 'run_10k_time')
  ),
  exercise_key text not null default '',
  exercise_id uuid references public.workout_exercise_catalog(id) on delete set null,
  exercise_name text,
  value numeric not null check (value > 0),
  unit text not null check (unit in ('kg', 'seconds')),
  reps integer check (reps is null or reps > 0),
  is_estimated boolean not null default false,
  achieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (activity_id, metric_key, exercise_key)
);

create index if not exists activity_record_highlights_user_recent_idx
  on public.activity_record_highlights (user_id, achieved_at desc);
create index if not exists activity_record_highlights_activity_idx
  on public.activity_record_highlights (activity_id);

alter table public.activity_record_highlights enable row level security;
revoke all on table public.activity_record_highlights from public, anon;
grant select on table public.activity_record_highlights to authenticated;

drop policy if exists activity_record_highlights_visible
  on public.activity_record_highlights;
create policy activity_record_highlights_visible
  on public.activity_record_highlights
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.profiles profile
      where profile.user_id = activity_record_highlights.user_id
        and profile.account_status = 'active'
        and profile.deleted_at is null
        and (
          not profile.is_private
          or exists (
            select 1 from public.follows follow
            where follow.follower_id = (select auth.uid())
              and follow.following_id = activity_record_highlights.user_id
              and follow.status = 'accepted'
          )
        )
        and not exists (
          select 1
          from public.user_blocks blocked
          where (
            blocked.blocker_id = (select auth.uid())
            and blocked.blocked_id = activity_record_highlights.user_id
          ) or (
            blocked.blocker_id = activity_record_highlights.user_id
            and blocked.blocked_id = (select auth.uid())
          )
        )
    )
  );

create or replace function private.capture_activity_record_highlights(
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  delete from public.activity_record_highlights
   where activity_id = p_activity_id;

  insert into public.activity_record_highlights (
    activity_id, user_id, metric_key, exercise_key, exercise_id,
    exercise_name, value, unit, reps, is_estimated, achieved_at
  )
  select
    current_result.activity_id,
    current_result.user_id,
    current_result.metric_key,
    current_result.exercise_key,
    current_result.exercise_id,
    current_result.exercise_name,
    current_result.value,
    current_result.unit,
    current_result.reps,
    current_result.is_estimated,
    current_result.achieved_at
  from public.personal_record_results current_result
  where current_result.activity_id = p_activity_id
    and not exists (
      select 1
      from public.personal_record_results previous_result
      where previous_result.user_id = current_result.user_id
        and previous_result.metric_key = current_result.metric_key
        and coalesce(previous_result.exercise_id::text, previous_result.exercise_key)
            = coalesce(current_result.exercise_id::text, current_result.exercise_key)
        and previous_result.achieved_at < current_result.achieved_at
        and (
          (current_result.unit = 'seconds'
            and previous_result.value <= current_result.value)
          or
          (current_result.unit <> 'seconds'
            and previous_result.value >= current_result.value)
        )
    )
  on conflict (activity_id, metric_key, exercise_key) do update
    set exercise_id = excluded.exercise_id,
        exercise_name = excluded.exercise_name,
        value = excluded.value,
        unit = excluded.unit,
        reps = excluded.reps,
        is_estimated = excluded.is_estimated,
        achieved_at = excluded.achieved_at;
end;
$$;

revoke all on function private.capture_activity_record_highlights(uuid)
  from public, anon, authenticated;

-- Mantem o pipeline existente e captura o snapshot depois que os resultados
-- derivados da activity foram reconstruidos.
create or replace function private.capture_activity_personal_records()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
begin
  perform private.rebuild_activity_personal_records(new.id);
  perform private.capture_activity_record_highlights(new.id);
  return new;
end;
$$;

revoke all on function private.capture_activity_personal_records()
  from public, anon, authenticated;

-- Backfill cronologico: o destaque representa se aquele resultado era recorde
-- no instante em que aconteceu, mesmo que tenha sido superado depois.
insert into public.activity_record_highlights (
  activity_id, user_id, metric_key, exercise_key, exercise_id,
  exercise_name, value, unit, reps, is_estimated, achieved_at
)
select
  current_result.activity_id,
  current_result.user_id,
  current_result.metric_key,
  current_result.exercise_key,
  current_result.exercise_id,
  current_result.exercise_name,
  current_result.value,
  current_result.unit,
  current_result.reps,
  current_result.is_estimated,
  current_result.achieved_at
from public.personal_record_results current_result
where not exists (
  select 1
  from public.personal_record_results previous_result
  where previous_result.user_id = current_result.user_id
    and previous_result.metric_key = current_result.metric_key
    and coalesce(previous_result.exercise_id::text, previous_result.exercise_key)
        = coalesce(current_result.exercise_id::text, current_result.exercise_key)
    and previous_result.achieved_at < current_result.achieved_at
    and (
      (current_result.unit = 'seconds' and previous_result.value <= current_result.value)
      or
      (current_result.unit <> 'seconds' and previous_result.value >= current_result.value)
    )
)
on conflict (activity_id, metric_key, exercise_key) do nothing;

create or replace function public.get_activity_record_highlights(
  p_activity_id uuid
)
returns table (
  highlight_id uuid,
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
  select
    highlight.id,
    highlight.activity_id,
    highlight.metric_key,
    highlight.exercise_key,
    highlight.exercise_id,
    highlight.exercise_name,
    highlight.value,
    highlight.unit,
    highlight.reps,
    highlight.is_estimated,
    highlight.achieved_at
  from public.activity_record_highlights highlight
  where highlight.activity_id = p_activity_id
  order by highlight.metric_key, highlight.exercise_name nulls last;
$$;

revoke all on function public.get_activity_record_highlights(uuid)
  from public, anon;
grant execute on function public.get_activity_record_highlights(uuid)
  to authenticated;

create or replace function public.get_post_workout_record_highlights(
  p_post_ids uuid[]
)
returns table (post_id uuid, highlights jsonb)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    post.id,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', highlight.id,
          'metric_key', highlight.metric_key,
          'exercise_id', highlight.exercise_id,
          'exercise_name', highlight.exercise_name,
          'value', highlight.value,
          'unit', highlight.unit,
          'reps', highlight.reps,
          'is_estimated', highlight.is_estimated,
          'achieved_at', highlight.achieved_at
        ) order by highlight.metric_key, highlight.exercise_name
      ) filter (where highlight.id is not null),
      '[]'::jsonb
    )
  from public.posts post
  left join public.activity_record_highlights highlight
    on highlight.activity_id = post.source_activity_id
  where post.id = any(coalesce(p_post_ids, '{}'::uuid[]))
  group by post.id;
$$;

revoke all on function public.get_post_workout_record_highlights(uuid[])
  from public, anon;
grant execute on function public.get_post_workout_record_highlights(uuid[])
  to authenticated;

-- Catalogo: conteudo comunitario fica visivel ao autor ate aprovacao. URLs de
-- demonstracao passam a registrar proveniencia/licenca antes da curadoria.
alter table public.workout_exercise_catalog
  add column if not exists aliases_pt text[] not null default '{}',
  add column if not exists aliases_en text[] not null default '{}',
  add column if not exists common_mistakes_pt text[] not null default '{}',
  add column if not exists common_mistakes_en text[] not null default '{}',
  add column if not exists difficulty text,
  add column if not exists asset_license text,
  add column if not exists asset_source_url text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.workout_technique_catalog
  add column if not exists asset_license text,
  add column if not exists asset_source_url text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.workout_exercise_catalog
  drop constraint if exists workout_exercise_catalog_difficulty_check;
alter table public.workout_exercise_catalog
  add constraint workout_exercise_catalog_difficulty_check
  check (difficulty is null or difficulty in ('beginner', 'intermediate', 'advanced'));

alter table public.workout_exercise_catalog
  drop constraint if exists workout_exercise_catalog_asset_source_check;
alter table public.workout_exercise_catalog
  add constraint workout_exercise_catalog_asset_source_check
  check (asset_source_url is null or asset_source_url ~ '^https://');

drop policy if exists workout_exercise_catalog_read
  on public.workout_exercise_catalog;
create policy workout_exercise_catalog_read
  on public.workout_exercise_catalog for select
  to anon, authenticated
  using (
    status = 'approved'
    or (status = 'community' and created_by = (select auth.uid()))
  );

drop policy if exists workout_technique_catalog_read
  on public.workout_technique_catalog;
create policy workout_technique_catalog_read
  on public.workout_technique_catalog for select
  to anon, authenticated
  using (
    status = 'approved'
    or (status = 'community' and created_by = (select auth.uid()))
  );

comment on table public.activity_record_highlights is
  'Snapshot imutavel dos recordes que eram novos no momento da activity.';
comment on column public.workout_exercise_catalog.asset_license is
  'Licenca auditavel do video/thumbnail; null significa que nenhum asset deve ser publicado.';
