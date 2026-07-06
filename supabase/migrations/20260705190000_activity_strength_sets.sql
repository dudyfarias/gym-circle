-- Séries/reps na musculação (P2). Cada série = { reps, weight_kg }.
-- Guardado na activity (jsonb), exposto no feed de atividades e no feed de
-- posts promovidos (join por source_activity_id). Decode por nome no cliente,
-- então a coluna nova é aditiva/retrocompatível.

alter table public.activities
  add column if not exists strength_sets jsonb;

comment on column public.activities.strength_sets is
  'Séries de musculação: [{"reps": int, "weight_kg": numeric|null}, ...]. null p/ treinos de rota/cronômetro.';

-- get_home_activities: entrada de atividade (treino sem foto). Muda só o
-- retorno (+strength_sets) → precisa DROP antes (42P13).
drop function if exists public.get_home_activities(integer);
create function public.get_home_activities(p_limit integer default 30)
returns table(id uuid, user_id uuid, activity_type text, mode text, origin text, source_app text, started_at timestamp with time zone, ended_at timestamp with time zone, elapsed_s integer, avg_hr integer, max_hr integer, active_calories numeric, total_calories numeric, distance_m numeric, moving_s integer, elevation_gain_m numeric, route jsonb, strength_sets jsonb, workout_date date, created_at timestamp with time zone, caption text, workout_types text[], gym_id uuid, gym_name text, location_name text, location_latitude double precision, location_longitude double precision, location_google_maps_url text, username text, display_name text, avatar_url text, author_current_streak integer, author_best_streak integer, author_badge_active boolean, is_following_author boolean, visibility text)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
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
    a.started_at,
    a.ended_at,
    a.elapsed_s,
    a.avg_hr,
    a.max_hr,
    a.active_calories,
    a.total_calories,
    a.distance_m,
    a.moving_s,
    a.elevation_gain_m,
    a.route,
    a.strength_sets,
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
$function$;

grant execute on function public.get_home_activities(integer) to authenticated;

-- get_home_feed: post promovido (workout vem do join com activities).
drop function if exists public.get_home_feed(timestamp with time zone, integer);
create function public.get_home_feed(p_cursor_created_at timestamp with time zone default null::timestamp with time zone, p_limit integer default 30)
returns table(id uuid, user_id uuid, image_url text, thumbnail_url text, poster_url text, media_width integer, media_height integer, media_duration_seconds numeric, blur_data_url text, media_type text, caption text, gym_id uuid, workout_type text, workout_date date, created_at timestamp with time zone, location_source text, location_name text, location_latitude double precision, location_longitude double precision, location_google_maps_url text, likes_count integer, comments_count integer, comment_previews jsonb, liked_by_preview jsonb, username text, display_name text, avatar_url text, author_current_streak integer, author_best_streak integer, author_badge_active boolean, liked_by_me boolean, is_following_author boolean, visibility text, workout_activity_type text, workout_elapsed_s integer, workout_moving_s integer, workout_distance_m numeric, workout_elevation_gain_m numeric, workout_avg_hr integer, workout_active_calories numeric, workout_total_calories numeric, workout_route jsonb, workout_strength_sets jsonb, workout_started_at timestamp with time zone, workout_ended_at timestamp with time zone)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
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
    p.workout_date,
    p.created_at,
    p.location_source,
    coalesce(p.location_name, g.name) as location_name,
    p.location_latitude,
    p.location_longitude,
    p.location_google_maps_url,
    coalesce(pl.likes_count, 0) as likes_count,
    coalesce(pc.comments_count, 0) as comments_count,
    coalesce(cprev.comment_previews, '[]'::jsonb) as comment_previews,
    coalesce(lprev.liked_by_preview, '[]'::jsonb) as liked_by_preview,
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
      when p.user_id = (select user_id from viewer) then 'owner'
      when exists (
        select 1
          from public.follows f
         where f.follower_id = (select user_id from viewer)
           and f.following_id = p.user_id
           and f.status = 'accepted'
      ) then 'following'
      when exists (
        select 1
          from public.post_participants pp
         where pp.post_id = p.id
           and pp.status = 'accepted'
           and pp.tagged_user_id = (select user_id from viewer)
      ) then 'tagged'
      else 'participant_follow'
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
    a.strength_sets as workout_strength_sets,
    a.started_at as workout_started_at,
    a.ended_at as workout_ended_at
  from public.posts p
  join viewer v on v.user_id is not null
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
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', cm.id,
          'user_id', cm.user_id,
          'username', cm.username,
          'display_name', cm.display_name,
          'body', cm.body,
          'created_at', cm.created_at
        ) order by cm.created_at asc
      ),
      '[]'::jsonb
    ) as comment_previews
    from (
      select c.id, c.user_id, c.body, c.created_at,
             cpr.username::text as username, cpr.display_name
        from public.post_comments c
        join public.profiles cpr on cpr.user_id = c.user_id
       where c.post_id = p.id
         and c.parent_comment_id is null
         and cpr.account_status = 'active'
         and cpr.deleted_at is null
       order by c.created_at desc
       limit 2
    ) cm
  ) cprev on true
  left join lateral (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', lkr.user_id,
          'username', lkr.username,
          'display_name', lkr.display_name,
          'avatar_url', lkr.avatar_url
        ) order by lkr.created_at desc
      ),
      '[]'::jsonb
    ) as liked_by_preview
    from (
      select l.user_id, l.created_at,
             lpr.username::text as username, lpr.display_name, lpr.avatar_url
        from public.post_likes l
        join public.profiles lpr on lpr.user_id = l.user_id
       where l.post_id = p.id
         and lpr.account_status = 'active'
         and lpr.deleted_at is null
       order by l.created_at desc
       limit 3
    ) lkr
  ) lprev on true
  where private.can_view_profile_posts(p.user_id)
    and pr.account_status = 'active'
    and pr.deleted_at is null
    and not exists (
      select 1
        from public.post_mutes mute_row
       where mute_row.user_id = v.user_id
         and mute_row.muted_user_id = p.user_id
    )
    and not exists (
      select 1
        from public.user_blocks blocked
       where (blocked.blocker_id = v.user_id and blocked.blocked_id = p.user_id)
          or (blocked.blocker_id = p.user_id and blocked.blocked_id = v.user_id)
    )
    and (
      p.user_id = v.user_id
      or exists (
        select 1
          from public.follows f
         where f.follower_id = v.user_id
           and f.following_id = p.user_id
           and f.status = 'accepted'
      )
      or exists (
        select 1
          from public.post_participants pp
         where pp.post_id = p.id
           and pp.status = 'accepted'
           and (
             pp.tagged_user_id = v.user_id
             or exists (
               select 1
                 from public.follows f2
                where f2.follower_id = v.user_id
                  and f2.following_id = pp.tagged_user_id
                  and f2.status = 'accepted'
             )
           )
      )
    )
    and (p_cursor_created_at is null or p.created_at < p_cursor_created_at)
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$function$;

grant execute on function public.get_home_feed(timestamp with time zone, integer) to authenticated;
