-- Sprint 0: sessao isolada/idempotente e activity privada ate existir post.

alter table public.activities
  add column if not exists client_session_id uuid,
  add column if not exists publication_state text;

-- Preserva o comportamento historico. Somente activities novas nascem privadas.
update public.activities
set publication_state = 'shared'
where publication_state is null;

alter table public.activities
  alter column publication_state set default 'private',
  alter column publication_state set not null;

alter table public.activities
  drop constraint if exists activities_publication_state_check;
alter table public.activities
  add constraint activities_publication_state_check
  check (publication_state in ('private', 'composing', 'shared'));

create unique index if not exists activities_user_client_session_unique_idx
  on public.activities (user_id, client_session_id)
  where client_session_id is not null;

comment on column public.activities.client_session_id is
  'ID estavel gerado no inicio da sessao; torna a finalizacao idempotente.';
comment on column public.activities.publication_state is
  'private ate o treino ser vinculado a um post; shared preserva entradas sociais legadas.';

-- Followers so podem ler a activity bruta quando ela foi explicitamente
-- compartilhada. O dono continua vendo todo o historico privado.
drop policy if exists activities_select_visible on public.activities;
drop policy if exists activities_select_own on public.activities;
create policy activities_select_visible on public.activities
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    or (
      publication_state = 'shared'
      and private.can_view_profile_posts(user_id)
    )
  );

drop policy if exists activities_insert_own on public.activities;
create policy activities_insert_own on public.activities
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and publication_state = 'private'
  );

-- publication_state e derivado da existencia do post, nunca de um valor
-- arbitrario enviado pelo cliente.
create or replace function private.guard_activity_publication_state()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if new.publication_state = 'shared'
     and not exists (
       select 1 from public.posts post
        where post.source_activity_id = new.id
     ) then
    raise exception 'activity_requires_post_to_be_shared' using errcode = '23514';
  end if;

  if new.publication_state <> 'shared'
     and exists (
       select 1 from public.posts post
        where post.source_activity_id = new.id
     ) then
    raise exception 'published_activity_must_be_shared' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_activity_publication_state()
  from public, anon, authenticated;

drop trigger if exists activities_guard_publication_state on public.activities;
create trigger activities_guard_publication_state
  before update of publication_state
  on public.activities
  for each row
  when (old.publication_state is distinct from new.publication_state)
  execute function private.guard_activity_publication_state();

-- Uma tentativa repetida com o mesmo client_session_id devolve a activity
-- existente. O payload e mapeado explicitamente para evitar mass assignment.
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

  select *
    into v_activity
    from public.activities
   where user_id = v_user_id
     and client_session_id = p_client_session_id;
  if found then
    return v_activity;
  end if;

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
    workout_date
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
    )
  )
  on conflict (user_id, client_session_id)
    where client_session_id is not null
    do nothing
  returning * into v_activity;

  if v_activity.id is null then
    select *
      into v_activity
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

-- O post e a entidade social. Criar/vincular marca shared; remover o ultimo
-- post volta a activity para private sem apagar o historico do treino.
create or replace function private.sync_activity_publication_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.activities activity
       set publication_state = 'private'
     where activity.id = old.source_activity_id
       and old.source_activity_id is not null
       and not exists (
         select 1
           from public.posts remaining
          where remaining.source_activity_id = old.source_activity_id
       );
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.source_activity_id is not null
     and old.source_activity_id is distinct from new.source_activity_id then
    update public.activities activity
       set publication_state = 'private'
     where activity.id = old.source_activity_id
       and not exists (
         select 1
           from public.posts remaining
          where remaining.source_activity_id = old.source_activity_id
       );
  end if;

  if new.source_activity_id is not null then
    update public.activities
       set publication_state = 'shared'
     where id = new.source_activity_id;
  end if;

  return new;
end;
$$;

revoke all on function private.sync_activity_publication_state()
  from public, anon, authenticated;

drop trigger if exists posts_sync_activity_publication_state_upsert on public.posts;
drop trigger if exists posts_sync_activity_publication_state_delete on public.posts;
drop trigger if exists posts_sync_activity_publication_state on public.posts;
create trigger posts_sync_activity_publication_state_upsert
  after insert or update of source_activity_id
  on public.posts
  for each row
  execute function private.sync_activity_publication_state();
create trigger posts_sync_activity_publication_state_delete
  after delete
  on public.posts
  for each row
  execute function private.sync_activity_publication_state();

-- Mantem a assinatura da RPC e apenas exclui activities privadas do feed,
-- inclusive para o proprio dono. O historico privado usa activities direto.
create or replace function public.get_home_activities(p_limit integer default 30)
returns table(id uuid, user_id uuid, activity_type text, mode text, origin text, source_app text, started_at timestamp with time zone, ended_at timestamp with time zone, elapsed_s integer, avg_hr integer, max_hr integer, active_calories numeric, total_calories numeric, distance_m numeric, moving_s integer, elevation_gain_m numeric, route jsonb, strength_sets jsonb, workout_date date, created_at timestamp with time zone, caption text, workout_types text[], gym_id uuid, gym_name text, location_name text, location_latitude double precision, location_longitude double precision, location_google_maps_url text, username text, display_name text, avatar_url text, author_current_streak integer, author_best_streak integer, author_badge_active boolean, is_following_author boolean, visibility text)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  )
  select
    a.id, a.user_id, a.activity_type, a.mode, a.origin, a.source_app,
    a.started_at, a.ended_at, a.elapsed_s, a.avg_hr, a.max_hr,
    a.active_calories, a.total_calories, a.distance_m, a.moving_s,
    a.elevation_gain_m, a.route, a.strength_sets, a.workout_date, a.created_at,
    a.caption, a.workout_types, a.gym_id, g.name as gym_name, a.location_name,
    a.location_latitude, a.location_longitude, a.location_google_maps_url,
    pr.username::text, pr.display_name, pr.avatar_url,
    us.current_streak as author_current_streak,
    us.best_streak as author_best_streak,
    us.badge_is_active_today as author_badge_active,
    exists (
      select 1 from public.follows f
       where f.follower_id = (select user_id from viewer)
         and f.following_id = a.user_id
         and f.status = 'accepted'
    ) as is_following_author,
    case when a.user_id = (select user_id from viewer)
      then 'owner' else 'following' end as visibility
  from public.activities a
  join viewer v on v.user_id is not null
  join public.profiles pr on pr.user_id = a.user_id
  left join public.gyms g on g.id = a.gym_id
  left join public.user_stats_live us on us.user_id = a.user_id
  where a.publication_state = 'shared'
    and not exists (
      select 1 from public.posts promoted
       where promoted.source_activity_id = a.id
    )
    and private.can_view_profile_posts(a.user_id)
    and pr.account_status = 'active'
    and pr.deleted_at is null
    and not exists (
      select 1 from public.post_mutes mute_row
       where mute_row.user_id = v.user_id
         and mute_row.muted_user_id = a.user_id
    )
    and not exists (
      select 1 from public.user_blocks blocked
       where (blocked.blocker_id = v.user_id and blocked.blocked_id = a.user_id)
          or (blocked.blocker_id = a.user_id and blocked.blocked_id = v.user_id)
    )
    and (
      a.user_id = v.user_id
      or exists (
        select 1 from public.follows f
         where f.follower_id = v.user_id
           and f.following_id = a.user_id
           and f.status = 'accepted'
      )
    )
  order by a.created_at desc, a.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

revoke all on function public.get_home_activities(integer) from public, anon;
grant execute on function public.get_home_activities(integer) to authenticated;

-- Validacao manual apos aplicar em preview:
-- select publication_state, count(*) from public.activities group by 1;
-- select user_id, client_session_id, count(*) from public.activities
--  where client_session_id is not null group by 1,2 having count(*) > 1;
-- select a.id from public.activities a join public.posts p
--   on p.source_activity_id = a.id where a.publication_state <> 'shared';
