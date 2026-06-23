-- Gym Circle — story viewer likes_count (paridade web: dono vê "N curtidas")
-- Additive: get_story_viewer_items passa a devolver likes_count (count de
-- story_likes). Return type muda → DROP + CREATE.

drop function if exists public.get_story_viewer_items(uuid);

create function public.get_story_viewer_items(
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
  likes_count integer,
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
    coalesce(slc.likes_count, 0) as likes_count,
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
  left join lateral (
    select count(*)::integer as likes_count
      from public.story_likes sl2
     where sl2.story_id = s.id
  ) slc on true
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

revoke all on function public.get_story_viewer_items(uuid) from public, anon;
grant execute on function public.get_story_viewer_items(uuid) to authenticated;

comment on function public.get_story_viewer_items(uuid)
  is 'Sprint D + likes_count: active stories for a selected author, with like count (owner sees it).';
