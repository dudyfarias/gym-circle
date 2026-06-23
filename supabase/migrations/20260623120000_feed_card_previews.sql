-- Gym Circle — Feed card previews (paridade nativa do card web)
-- Additive: estende get_home_feed com dois agregados jsonb por post:
--   - comment_previews: até 2 comentários top-level mais recentes ( asc p/ leitura)
--   - liked_by_preview: até 3 curtidas mais recentes (avatar/nome)
-- Clientes existentes (web) ignoram as colunas novas; nada quebra.
-- Return type muda → precisa DROP + CREATE.

drop function if exists public.get_home_feed(timestamptz, integer);

create function public.get_home_feed(
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
    end as visibility
  from public.posts p
  join viewer v on v.user_id is not null
  join public.profiles pr on pr.user_id = p.user_id
  left join public.gyms g on g.id = p.gym_id
  left join public.user_stats_live us on us.user_id = p.user_id
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
$$;

revoke all on function public.get_home_feed(timestamptz, integer) from public, anon;
grant execute on function public.get_home_feed(timestamptz, integer) to authenticated;

comment on function public.get_home_feed(timestamptz, integer)
  is 'Home feed minimal + thumbnail/poster metadata + comment_previews/liked_by_preview (card parity) + server-side block filter.';
