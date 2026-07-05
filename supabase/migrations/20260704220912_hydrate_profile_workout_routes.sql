-- Posts abertos pelo grid do perfil precisam conservar o vínculo completo
-- com activities. Antes só get_home_feed retornava estas colunas; ao abrir
-- o mesmo post via get_profile_posts, as métricas e a rota desapareciam.

drop function if exists public.get_profile_posts(uuid, timestamptz, integer);

create function public.get_profile_posts(
  p_user_id uuid,
  p_cursor_created_at timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  user_id uuid,
  image_url text,
  thumbnail_url text,
  poster_url text,
  media_width integer,
  media_height integer,
  media_duration_seconds numeric,
  blur_data_url text,
  media_type text,
  caption text,
  gym_id uuid,
  workout_type text,
  workout_types text[],
  workout_date date,
  created_at timestamptz,
  location_source text,
  location_name text,
  location_latitude double precision,
  location_longitude double precision,
  location_google_maps_url text,
  likes_count integer,
  comments_count integer,
  username text,
  display_name text,
  avatar_url text,
  author_current_streak integer,
  author_best_streak integer,
  author_badge_active boolean,
  liked_by_me boolean,
  is_following_author boolean,
  visibility text,
  workout_activity_type text,
  workout_elapsed_s integer,
  workout_moving_s integer,
  workout_distance_m numeric,
  workout_elevation_gain_m numeric,
  workout_avg_hr integer,
  workout_active_calories numeric,
  workout_total_calories numeric,
  workout_route jsonb,
  workout_started_at timestamptz,
  workout_ended_at timestamptz
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
    p.id,
    p.user_id,
    p.image_url,
    p.thumbnail_url,
    p.poster_url,
    p.media_width,
    p.media_height,
    p.media_duration_seconds,
    p.blur_data_url,
    p.media_type,
    p.caption,
    p.gym_id,
    p.workout_type,
    p.workout_types,
    p.workout_date,
    p.created_at,
    p.location_source,
    coalesce(p.location_name, g.name) as location_name,
    p.location_latitude,
    p.location_longitude,
    p.location_google_maps_url,
    coalesce(pl.likes_count, 0) as likes_count,
    coalesce(pc.comments_count, 0) as comments_count,
    pr.username::text,
    pr.display_name,
    pr.avatar_url,
    us.current_streak as author_current_streak,
    us.best_streak as author_best_streak,
    us.badge_is_active_today as author_badge_active,
    exists (
      select 1
        from public.post_likes my_like
       where my_like.post_id = p.id
         and my_like.user_id = (select user_id from viewer)
    ) as liked_by_me,
    exists (
      select 1
        from public.follows f
       where f.follower_id = (select user_id from viewer)
         and f.following_id = p.user_id
         and f.status = 'accepted'
    ) as is_following_author,
    case
      when p.user_id = p_user_id then 'author_profile'
      else 'tagged_profile'
    end as visibility,
    a.activity_type as workout_activity_type,
    a.elapsed_s as workout_elapsed_s,
    a.moving_s as workout_moving_s,
    a.distance_m as workout_distance_m,
    a.elevation_gain_m as workout_elevation_gain_m,
    a.avg_hr as workout_avg_hr,
    a.active_calories as workout_active_calories,
    a.total_calories as workout_total_calories,
    a.route as workout_route,
    a.started_at as workout_started_at,
    a.ended_at as workout_ended_at
  from public.posts p
  join viewer v on v.user_id is not null
  join public.profiles target_profile on target_profile.user_id = p_user_id
  join public.profiles pr on pr.user_id = p.user_id
  left join public.gyms g on g.id = p.gym_id
  left join public.user_stats_live us on us.user_id = p.user_id
  left join public.activities a on a.id = p.source_activity_id
  left join lateral (
    select count(*)::integer as likes_count
      from public.post_likes like_row
     where like_row.post_id = p.id
  ) pl on true
  left join lateral (
    select count(*)::integer as comments_count
      from public.post_comments comment_row
     where comment_row.post_id = p.id
  ) pc on true
  where private.can_view_profile_posts(p_user_id)
    and private.can_view_profile_posts(p.user_id)
    and target_profile.account_status = 'active'
    and target_profile.deleted_at is null
    and pr.account_status = 'active'
    and pr.deleted_at is null
    and (
      p.user_id = p_user_id
      or exists (
        select 1
          from public.post_participants pp
         where pp.post_id = p.id
           and pp.tagged_user_id = p_user_id
           and pp.status = 'accepted'
      )
    )
    and (p_cursor_created_at is null or p.created_at < p_cursor_created_at)
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

revoke all on function public.get_profile_posts(uuid, timestamptz, integer)
  from public, anon;
grant execute on function public.get_profile_posts(uuid, timestamptz, integer)
  to authenticated;

comment on function public.get_profile_posts(uuid, timestamptz, integer)
  is 'Posts do perfil com mídia, métricas sociais e detalhes da activity/rota de origem.';
