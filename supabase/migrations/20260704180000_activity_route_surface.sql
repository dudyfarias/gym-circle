-- Rastreio de treino — Fase 2 (GPS outdoor).
-- get_home_activities passa a expor as métricas de rota já existentes na
-- tabela (distance_m, moving_s, elevation_gain_m, route) pros cards
-- desenharem distância/ritmo/altimetria + mini-mapa (polyline).
-- route: jsonb [[lat, lng], ...] (downsample feito no app; só pro sketch).

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
  distance_m numeric,
  moving_s integer,
  elevation_gain_m numeric,
  route jsonb,
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
    a.distance_m,
    a.moving_s,
    a.elevation_gain_m,
    a.route,
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
