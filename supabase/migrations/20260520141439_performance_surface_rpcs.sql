-- Gym Circle — Sprint B performance surfaces
-- RPCs scoped per surface so the client stops fetching broad views/tables
-- and filtering heavy JSON in the iPhone WebView.

create index if not exists posts_created_at_id_idx
  on public.posts (created_at desc, id desc);

create index if not exists stories_expires_created_id_idx
  on public.stories (expires_at, created_at desc, id desc);

create index if not exists follows_follower_status_following_idx
  on public.follows (follower_id, status, following_id);

create index if not exists follows_following_status_follower_idx
  on public.follows (following_id, status, follower_id);

create index if not exists post_mutes_user_muted_idx
  on public.post_mutes (user_id, muted_user_id);

create index if not exists story_mutes_user_muted_idx
  on public.story_mutes (user_id, muted_user_id);

create index if not exists user_blocks_blocker_blocked_idx
  on public.user_blocks (blocker_id, blocked_id);

create index if not exists direct_messages_conversation_created_desc_idx
  on public.direct_messages (conversation_id, created_at desc, id desc);

create index if not exists conversation_participants_user_deleted_idx
  on public.conversation_participants (user_id, deleted_at, conversation_id);

create index if not exists notifications_user_kind_created_idx
  on public.notifications (user_id, kind, created_at desc);

create or replace function public.get_home_feed(
  p_cursor_created_at timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  user_id uuid,
  image_url text,
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

create or replace function public.get_profile_posts(
  p_user_id uuid,
  p_cursor_created_at timestamptz default null,
  p_limit integer default 30
)
returns table (
  id uuid,
  user_id uuid,
  image_url text,
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

create or replace function public.get_story_tray(
  p_limit integer default 40
)
returns table (
  id uuid,
  user_id uuid,
  media_url text,
  media_type text,
  gym_id uuid,
  workout_type text,
  expires_at timestamptz,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_url text,
  author_current_streak integer,
  author_badge_active boolean,
  has_unseen boolean,
  latest_story_at timestamptz
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
  )
  select
    s.id,
    s.user_id,
    s.media_url,
    s.media_type,
    s.gym_id,
    s.workout_type,
    s.expires_at,
    s.created_at,
    pr.username::text,
    pr.display_name,
    pr.avatar_url,
    us.current_streak as author_current_streak,
    us.badge_is_active_today as author_badge_active,
    not exists (
      select 1
        from public.story_views sv
       where sv.story_id = s.id
         and sv.user_id = (select user_id from viewer)
    ) as has_unseen,
    max(s.created_at) over (partition by s.user_id) as latest_story_at
  from visible_stories s
  join public.profiles pr on pr.user_id = s.user_id
  left join public.user_stats_live us on us.user_id = s.user_id
  order by
    case
      when not exists (
        select 1
          from public.story_views sv
         where sv.story_id = s.id
           and sv.user_id = (select user_id from viewer)
      ) then 0 else 1
    end,
    max(s.created_at) over (partition by s.user_id) desc,
    s.created_at asc
  limit least(greatest(coalesce(p_limit, 40), 1), 80);
$$;

create or replace function public.get_conversation_summaries()
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

create or replace function public.get_conversation_messages(
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
revoke all on function public.get_story_tray(integer) from public, anon;
revoke all on function public.get_conversation_summaries() from public, anon;
revoke all on function public.get_conversation_messages(uuid, timestamptz, integer) from public, anon;

grant execute on function public.get_home_feed(timestamptz, integer) to authenticated;
grant execute on function public.get_profile_posts(uuid, timestamptz, integer) to authenticated;
grant execute on function public.get_story_tray(integer) to authenticated;
grant execute on function public.get_conversation_summaries() to authenticated;
grant execute on function public.get_conversation_messages(uuid, timestamptz, integer) to authenticated;

comment on function public.get_home_feed(timestamptz, integer)
  is 'Sprint B: home feed mínimo, já filtrado por follows/mutes/bloqueios/privacidade.';
comment on function public.get_profile_posts(uuid, timestamptz, integer)
  is 'Sprint B: posts de perfil sob demanda com paginação e privacidade no banco.';
comment on function public.get_story_tray(integer)
  is 'Sprint B: tray de stories mínimo, agrupável por autor e com estado visto/não visto.';
comment on function public.get_conversation_summaries()
  is 'Sprint B: lista de conversas sem histórico completo.';
comment on function public.get_conversation_messages(uuid, timestamptz, integer)
  is 'Sprint B: mensagens paginadas apenas da conversa aberta.';
