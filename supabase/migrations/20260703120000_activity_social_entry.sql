-- Rastreio de treino — atividade como ENTRADA SOCIAL do feed (modelo Eduardo):
-- check-in(treino) ↔ post ↔ carrossel, tudo mutável. Um treino encerrado sem
-- foto aparece no feed como entrada (tipo check-in) com as MESMAS infos de um
-- post (legenda, local, tags); ao ganhar foto vira post (source_activity_id) e
-- a entrada some do feed (volta se o post for apagado). Espelha o desenho do
-- editor unificado de check-ins (20260702165552).

-- 1) Campos de apresentação de post na activity
alter table public.activities
  add column if not exists caption text,
  add column if not exists workout_types text[],
  add column if not exists gym_id uuid references public.gyms(id) on delete set null,
  add column if not exists location_source text not null default 'none',
  add column if not exists location_name text,
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_google_maps_url text;

-- 2) Feed: entradas de atividade (mirror de get_home_checkins)
drop function if exists public.get_home_activities(integer);

create function public.get_home_activities(
  p_limit integer default 30
)
returns table (
  id uuid,
  user_id uuid,
  activity_type text,
  mode text,
  origin text,
  source_app text,
  elapsed_s integer,
  avg_hr integer,
  max_hr integer,
  active_calories numeric,
  total_calories numeric,
  workout_date date,
  created_at timestamptz,
  caption text,
  workout_types text[],
  gym_id uuid,
  gym_name text,
  location_name text,
  location_latitude double precision,
  location_longitude double precision,
  location_google_maps_url text,
  username text,
  display_name text,
  avatar_url text,
  author_current_streak integer,
  author_best_streak integer,
  author_badge_active boolean,
  is_following_author boolean,
  visibility text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  )
  select
    a.id,
    a.user_id,
    a.activity_type,
    a.mode,
    a.origin,
    a.source_app,
    a.elapsed_s,
    a.avg_hr,
    a.max_hr,
    a.active_calories,
    a.total_calories,
    a.workout_date,
    a.created_at,
    a.caption,
    a.workout_types,
    a.gym_id,
    g.name as gym_name,
    a.location_name,
    a.location_latitude,
    a.location_longitude,
    a.location_google_maps_url,
    pr.username::text,
    pr.display_name,
    pr.avatar_url,
    us.current_streak as author_current_streak,
    us.best_streak as author_best_streak,
    us.badge_is_active_today as author_badge_active,
    exists (
      select 1
        from public.follows f
       where f.follower_id = (select user_id from viewer)
         and f.following_id = a.user_id
         and f.status = 'accepted'
    ) as is_following_author,
    case
      when a.user_id = (select user_id from viewer) then 'owner'
      else 'following'
    end as visibility
  from public.activities a
  join viewer v on v.user_id is not null
  join public.profiles pr on pr.user_id = a.user_id
  left join public.gyms g on g.id = a.gym_id
  left join public.user_stats_live us on us.user_id = a.user_id
  where not exists (
      select 1 from public.posts promoted
       where promoted.source_activity_id = a.id
    )
    and private.can_view_profile_posts(a.user_id)
    and pr.account_status = 'active'
    and pr.deleted_at is null
    and not exists (
      select 1
        from public.post_mutes mute_row
       where mute_row.user_id = v.user_id
         and mute_row.muted_user_id = a.user_id
    )
    and not exists (
      select 1
        from public.user_blocks blocked
       where (blocked.blocker_id = v.user_id and blocked.blocked_id = a.user_id)
          or (blocked.blocker_id = a.user_id and blocked.blocked_id = v.user_id)
    )
    and (
      a.user_id = v.user_id
      or exists (
        select 1
          from public.follows f
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

-- 3) RLS de leitura: o feed (invoker) precisa ler activities de quem o viewer
-- segue — espelha a visibilidade de posts (dono OU can_view_profile_posts).
drop policy if exists activities_select_own on public.activities;
create policy activities_select_visible on public.activities
  for select using (
    (select auth.uid()) = user_id
    or private.can_view_profile_posts(user_id)
  );
