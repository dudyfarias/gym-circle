-- Suggested posts for the home feed.
--
-- Product contract:
-- - public, active profiles only;
-- - newest post per suggested author;
-- - never older than 48 hours;
-- - excludes self, existing/pending follows, blocks and post mutes;
-- - read-only, RLS/invoker scoped and available only to authenticated users.

create or replace function public.get_suggested_feed_posts(
  p_limit integer default 12
)
returns table(
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
  workout_date date,
  created_at timestamptz,
  location_source text,
  location_name text,
  location_latitude double precision,
  location_longitude double precision,
  location_google_maps_url text,
  likes_count integer,
  comments_count integer,
  comment_previews jsonb,
  liked_by_preview jsonb,
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
  workout_strength_sets jsonb,
  workout_started_at timestamptz,
  workout_ended_at timestamptz
)
language sql
stable
set search_path to 'public', 'pg_temp'
as $function$
  with viewer as (
    select (select auth.uid()) as user_id
  ),
  eligible_posts as (
    select
      p.*,
      row_number() over (
        partition by p.user_id
        order by p.created_at desc, p.id desc
      ) as author_post_rank
    from public.posts p
    join viewer on viewer.user_id is not null
    join public.profiles pr on pr.user_id = p.user_id
    where p.created_at between now() - interval '48 hours' and now()
      and p.user_id <> viewer.user_id
      and coalesce(pr.is_private, false) = false
      and pr.account_status = 'active'
      and pr.deleted_at is null
      and private.can_view_profile_posts(p.user_id)
      and not exists (
        select 1
        from public.follows existing_follow
        where existing_follow.follower_id = viewer.user_id
          and existing_follow.following_id = p.user_id
      )
      and not exists (
        select 1
        from public.post_mutes mute_row
        where mute_row.user_id = viewer.user_id
          and mute_row.muted_user_id = p.user_id
      )
      and not exists (
        select 1
        from public.user_blocks blocked
        where (blocked.blocker_id = viewer.user_id and blocked.blocked_id = p.user_id)
           or (blocked.blocker_id = p.user_id and blocked.blocked_id = viewer.user_id)
      )
  ),
  latest_author_posts as (
    select eligible.*
    from eligible_posts eligible
    where eligible.author_post_rank = 1
  ),
  scored_posts as (
    select
      latest.*,
      (
        select count(*)::integer
        from public.follows viewer_follow
        join public.follows candidate_follow
          on candidate_follow.follower_id = viewer_follow.following_id
         and candidate_follow.following_id = latest.user_id
         and candidate_follow.status = 'accepted'
        where viewer_follow.follower_id = viewer.user_id
          and viewer_follow.status = 'accepted'
      ) as mutual_connections
    from latest_author_posts latest
    cross join viewer
  ),
  ranked_posts as (
    select scored.*
    from scored_posts scored
    order by
      scored.mutual_connections desc,
      scored.created_at desc,
      scored.id desc
    limit least(greatest(coalesce(p_limit, 12), 1), 24)
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
        and my_like.user_id = (select auth.uid())
    ) as liked_by_me,
    false as is_following_author,
    'suggested'::text as visibility,
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
  from ranked_posts p
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
      select
        c.id,
        c.user_id,
        c.body,
        c.created_at,
        cpr.username::text as username,
        cpr.display_name
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
      select
        likes.user_id,
        likes.created_at,
        liker.username::text as username,
        liker.display_name,
        liker.avatar_url
      from public.post_likes likes
      join public.profiles liker on liker.user_id = likes.user_id
      where likes.post_id = p.id
        and liker.account_status = 'active'
        and liker.deleted_at is null
      order by likes.created_at desc
      limit 3
    ) lkr
  ) lprev on true
  order by
    p.mutual_connections desc,
    p.created_at desc,
    p.id desc;
$function$;

revoke all on function public.get_suggested_feed_posts(integer) from public, anon;
grant execute on function public.get_suggested_feed_posts(integer) to authenticated;

comment on function public.get_suggested_feed_posts(integer) is
  'Recent posts (max 48h) from public non-followed profiles, ranked for home-feed discovery.';
