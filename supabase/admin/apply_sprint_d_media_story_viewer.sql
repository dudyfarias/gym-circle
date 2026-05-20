-- Gym Circle — Sprint D media metadata + lightweight story viewer surfaces
-- Safe, additive changes only:
-- - optional media metadata columns for future thumbnails/posters
-- - surface RPCs include metadata when present
-- - a new lightweight story tray RPC keeps legacy get_story_tray intact so
--   currently deployed clients do not break between migration and web deploy.

alter table public.posts
  add column if not exists thumbnail_url text,
  add column if not exists poster_url text,
  add column if not exists media_width integer,
  add column if not exists media_height integer,
  add column if not exists media_duration_seconds numeric,
  add column if not exists blur_data_url text;

alter table public.stories
  add column if not exists thumbnail_url text,
  add column if not exists poster_url text,
  add column if not exists media_width integer,
  add column if not exists media_height integer,
  add column if not exists media_duration_seconds numeric,
  add column if not exists blur_data_url text;

alter table public.direct_messages
  add column if not exists thumbnail_url text,
  add column if not exists poster_url text,
  add column if not exists media_width integer,
  add column if not exists media_height integer,
  add column if not exists media_duration_seconds numeric,
  add column if not exists blur_data_url text;

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
  where private.can_view_profile_posts(p.user_id)
    and pr.account_status = 'active'
    and pr.deleted_at is null
    and not exists (
      select 1
        from public.post_mutes mute_row
       where mute_row.user_id = v.user_id
         and mute_row.muted_user_id = p.user_id
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
    end as visibility
  from public.posts p
  join viewer v on v.user_id is not null
  join public.profiles target_profile on target_profile.user_id = p_user_id
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

create or replace function public.get_story_tray_lightweight(
  p_limit integer default 40
)
returns table (
  author_id uuid,
  username text,
  display_name text,
  avatar_url text,
  current_streak integer,
  badge_is_active_today boolean,
  has_unseen boolean,
  latest_story_at timestamptz,
  story_count integer,
  first_unseen_story_id uuid,
  first_story_id uuid
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  visible_stories as (
    select s.*
      from public.stories s
      join viewer v on v.user_id is not null
      join public.profiles pr on pr.user_id = s.user_id
     where s.expires_at > now()
       and private.can_view_profile_posts(s.user_id)
       and pr.account_status = 'active'
       and pr.deleted_at is null
       and not exists (
         select 1
           from public.user_blocks blocked
          where (blocked.blocker_id = v.user_id and blocked.blocked_id = s.user_id)
             or (blocked.blocker_id = s.user_id and blocked.blocked_id = v.user_id)
       )
       and not exists (
         select 1
           from public.story_mutes sm
          where sm.user_id = v.user_id
            and sm.muted_user_id = s.user_id
       )
       and (
         s.user_id = v.user_id
         or exists (
           select 1
             from public.follows f
            where f.follower_id = v.user_id
              and f.following_id = s.user_id
              and f.status = 'accepted'
         )
         or exists (
           select 1
             from public.story_participants sp
            where sp.story_id = s.id
              and sp.status = 'accepted'
              and sp.tagged_user_id = v.user_id
         )
       )
  ),
  grouped as (
    select
      vs.user_id as author_id,
      pr.username::text as username,
      pr.display_name,
      pr.avatar_url,
      coalesce(us.current_streak, 0) as current_streak,
      coalesce(us.badge_is_active_today, false) as badge_is_active_today,
      bool_or(not exists (
        select 1
          from public.story_views sv
         where sv.story_id = vs.id
           and sv.user_id = (select user_id from viewer)
      )) as has_unseen,
      max(vs.created_at) as latest_story_at,
      count(*)::integer as story_count,
      (array_agg(vs.id order by vs.created_at asc) filter (
        where not exists (
          select 1
            from public.story_views sv
           where sv.story_id = vs.id
             and sv.user_id = (select user_id from viewer)
        )
      ))[1] as first_unseen_story_id,
      (array_agg(vs.id order by vs.created_at asc))[1] as first_story_id
    from visible_stories vs
    join public.profiles pr on pr.user_id = vs.user_id
    left join public.user_stats_live us on us.user_id = vs.user_id
    group by
      vs.user_id,
      pr.username,
      pr.display_name,
      pr.avatar_url,
      us.current_streak,
      us.badge_is_active_today
  )
  select
    author_id,
    username,
    display_name,
    avatar_url,
    current_streak,
    badge_is_active_today,
    has_unseen,
    latest_story_at,
    story_count,
    first_unseen_story_id,
    first_story_id
  from grouped
  order by has_unseen desc, latest_story_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 80);
$$;

create or replace function public.get_story_viewer_items(
  p_author_id uuid
)
returns table (
  story_id uuid,
  user_id uuid,
  media_url text,
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
  location_name text,
  created_at timestamptz,
  expires_at timestamptz,
  viewer_has_liked boolean,
  viewer_has_seen boolean
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
    s.id as story_id,
    s.user_id,
    s.media_url,
    s.thumbnail_url,
    s.poster_url,
    s.media_width,
    s.media_height,
    s.media_duration_seconds,
    s.blur_data_url,
    s.media_type,
    null::text as caption,
    s.gym_id,
    s.workout_type,
    g.name as location_name,
    s.created_at,
    s.expires_at,
    exists (
      select 1
        from public.story_likes sl
       where sl.story_id = s.id
         and sl.user_id = (select user_id from viewer)
    ) as viewer_has_liked,
    exists (
      select 1
        from public.story_views sv
       where sv.story_id = s.id
         and sv.user_id = (select user_id from viewer)
    ) as viewer_has_seen
  from public.stories s
  join viewer v on v.user_id is not null
  join public.profiles pr on pr.user_id = s.user_id
  left join public.gyms g on g.id = s.gym_id
  where s.user_id = p_author_id
    and s.expires_at > now()
    and private.can_view_profile_posts(s.user_id)
    and pr.account_status = 'active'
    and pr.deleted_at is null
    and not exists (
      select 1
        from public.user_blocks blocked
       where (blocked.blocker_id = v.user_id and blocked.blocked_id = s.user_id)
          or (blocked.blocker_id = s.user_id and blocked.blocked_id = v.user_id)
    )
    and not exists (
      select 1
        from public.story_mutes sm
       where sm.user_id = v.user_id
         and sm.muted_user_id = s.user_id
    )
    and (
      s.user_id = v.user_id
      or exists (
        select 1
          from public.follows f
         where f.follower_id = v.user_id
           and f.following_id = s.user_id
           and f.status = 'accepted'
      )
      or exists (
        select 1
          from public.story_participants sp
         where sp.story_id = s.id
           and sp.status = 'accepted'
           and sp.tagged_user_id = v.user_id
      )
    )
  order by s.created_at asc, s.id asc;
$$;

drop function if exists public.get_conversation_summaries();

create function public.get_conversation_summaries()
returns table (
  conversation_id uuid,
  type text,
  name text,
  image_url text,
  last_message_at timestamptz,
  role text,
  last_read_at timestamptz,
  deleted_at timestamptz,
  unread_count integer,
  participants jsonb,
  last_message jsonb
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  mine as (
    select cp.*
      from public.conversation_participants cp
      join viewer v on cp.user_id = v.user_id
  )
  select
    c.id as conversation_id,
    c.type,
    c.name,
    c.image_url,
    c.last_message_at,
    mine.role,
    mine.last_read_at,
    mine.deleted_at,
    coalesce(unread.unread_count, 0) as unread_count,
    coalesce(participants.participants, '[]'::jsonb) as participants,
    last_message.last_message
  from mine
  join public.conversations c on c.id = mine.conversation_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'conversation_id', cp.conversation_id,
        'user_id', cp.user_id,
        'role', cp.role,
        'joined_at', cp.joined_at,
        'created_at', cp.created_at,
        'last_read_at', cp.last_read_at,
        'deleted_at', cp.deleted_at,
        'username', pr.username::text,
        'display_name', pr.display_name,
        'avatar_url', pr.avatar_url,
        'account_status', pr.account_status
      )
      order by cp.joined_at asc
    ) as participants
      from public.conversation_participants cp
      join public.profiles pr on pr.user_id = cp.user_id
     where cp.conversation_id = c.id
       and pr.account_status = 'active'
       and pr.deleted_at is null
  ) participants on true
  left join lateral (
    select count(*)::integer as unread_count
      from public.direct_messages dm
     where dm.conversation_id = c.id
       and dm.sender_id <> (select user_id from viewer)
       and (mine.last_read_at is null or dm.created_at > mine.last_read_at)
       and (mine.deleted_at is null or dm.created_at > mine.deleted_at)
  ) unread on true
  left join lateral (
    select jsonb_build_object(
      'id', dm.id,
      'conversation_id', dm.conversation_id,
      'sender_id', dm.sender_id,
      'receiver_id', dm.receiver_id,
      'body', dm.body,
      'media_url', dm.media_url,
      'thumbnail_url', dm.thumbnail_url,
      'poster_url', dm.poster_url,
      'media_width', dm.media_width,
      'media_height', dm.media_height,
      'media_duration_seconds', dm.media_duration_seconds,
      'blur_data_url', dm.blur_data_url,
      'media_type', dm.media_type,
      'story_id', dm.story_id,
      'reply_to_story', dm.reply_to_story,
      'story_preview_url', dm.story_preview_url,
      'created_at', dm.created_at,
      'read_at', dm.read_at
    ) as last_message
      from public.direct_messages dm
     where dm.conversation_id = c.id
       and (mine.deleted_at is null or dm.created_at > mine.deleted_at)
     order by dm.created_at desc, dm.id desc
     limit 1
  ) last_message on true
  where last_message.last_message is not null
     or c.type = 'group'
     or mine.deleted_at is null
  order by coalesce(c.last_message_at, c.created_at) desc;
$$;

drop function if exists public.get_conversation_messages(uuid, timestamptz, integer);

create function public.get_conversation_messages(
  p_conversation_id uuid,
  p_cursor_created_at timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  receiver_id uuid,
  body text,
  media_url text,
  thumbnail_url text,
  poster_url text,
  media_width integer,
  media_height integer,
  media_duration_seconds numeric,
  blur_data_url text,
  media_type text,
  story_id uuid,
  reply_to_story boolean,
  story_preview_url text,
  created_at timestamptz,
  read_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer_participant as (
    select cp.deleted_at
      from public.conversation_participants cp
     where cp.conversation_id = p_conversation_id
       and cp.user_id = auth.uid()
     limit 1
  ),
  page as (
    select
      dm.id,
      dm.conversation_id,
      dm.sender_id,
      dm.receiver_id,
      dm.body,
      dm.media_url,
      dm.thumbnail_url,
      dm.poster_url,
      dm.media_width,
      dm.media_height,
      dm.media_duration_seconds,
      dm.blur_data_url,
      dm.media_type,
      dm.story_id,
      dm.reply_to_story,
      dm.story_preview_url,
      dm.created_at,
      dm.read_at
    from public.direct_messages dm
    join viewer_participant vp on true
    where dm.conversation_id = p_conversation_id
      and (vp.deleted_at is null or dm.created_at > vp.deleted_at)
      and (p_cursor_created_at is null or dm.created_at < p_cursor_created_at)
    order by dm.created_at desc, dm.id desc
    limit least(greatest(coalesce(p_limit, 30), 1), 60)
  )
  select
    page.id,
    page.conversation_id,
    page.sender_id,
    page.receiver_id,
    page.body,
    page.media_url,
    page.thumbnail_url,
    page.poster_url,
    page.media_width,
    page.media_height,
    page.media_duration_seconds,
    page.blur_data_url,
    page.media_type,
    page.story_id,
    page.reply_to_story,
    page.story_preview_url,
    page.created_at,
    page.read_at
    from page
   order by page.created_at asc, page.id asc;
$$;

revoke all on function public.get_home_feed(timestamptz, integer) from public, anon;
revoke all on function public.get_profile_posts(uuid, timestamptz, integer) from public, anon;
revoke all on function public.get_story_tray_lightweight(integer) from public, anon;
revoke all on function public.get_story_viewer_items(uuid) from public, anon;
revoke all on function public.get_conversation_summaries() from public, anon;
revoke all on function public.get_conversation_messages(uuid, timestamptz, integer) from public, anon;

grant execute on function public.get_home_feed(timestamptz, integer) to authenticated;
grant execute on function public.get_profile_posts(uuid, timestamptz, integer) to authenticated;
grant execute on function public.get_story_tray_lightweight(integer) to authenticated;
grant execute on function public.get_story_viewer_items(uuid) to authenticated;
grant execute on function public.get_conversation_summaries() to authenticated;
grant execute on function public.get_conversation_messages(uuid, timestamptz, integer) to authenticated;

comment on function public.get_home_feed(timestamptz, integer)
  is 'Sprint D: home feed minimal with optional thumbnail/poster metadata.';
comment on function public.get_profile_posts(uuid, timestamptz, integer)
  is 'Sprint D: profile posts with optional thumbnail/poster metadata.';
comment on function public.get_story_tray_lightweight(integer)
  is 'Sprint D: story tray grouped by author without media payload; legacy get_story_tray kept for compatibility.';
comment on function public.get_story_viewer_items(uuid)
  is 'Sprint D: active stories for a selected author loaded on demand by StoryViewer.';
comment on function public.get_conversation_summaries()
  is 'Sprint D: conversation summaries with optional media preview metadata.';
comment on function public.get_conversation_messages(uuid, timestamptz, integer)
  is 'Sprint D: paginated conversation messages with optional media metadata.';
