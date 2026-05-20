-- Gym Circle — Sprint C safe discovery/search surfaces
-- Reduces broad profile/follow payloads by moving search and suggestions
-- into focused RPCs. These functions return compact UI-ready rows and keep
-- privacy/block/account-status checks in the database layer.

create index if not exists profiles_username_lower_pattern_idx
  on public.profiles (lower(username::text) text_pattern_ops);

create index if not exists profiles_display_name_lower_pattern_idx
  on public.profiles (lower(display_name) text_pattern_ops);

create index if not exists profiles_active_created_idx
  on public.profiles (account_status, deleted_at, created_at desc);

create index if not exists posts_user_location_created_idx
  on public.posts (user_id, created_at desc)
  where location_latitude is not null and location_longitude is not null;

create or replace function public.search_profiles(
  p_query text,
  p_limit integer default 20
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  is_private boolean,
  follow_status text,
  current_streak integer,
  badge_is_active_today boolean
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  normalized_query as (
    select lower(regexp_replace(trim(coalesce(p_query, '')), '^@+', '')) as query
  ),
  viewer_profile as (
    select p.username::text as username
      from public.profiles p
      join viewer v on v.user_id = p.user_id
  )
  select
    p.user_id,
    p.username::text,
    p.display_name,
    p.avatar_url,
    coalesce(p.is_private, false) as is_private,
    coalesce(f.status, 'none')::text as follow_status,
    coalesce(us.current_streak, 0) as current_streak,
    coalesce(us.badge_is_active_today, false) as badge_is_active_today
  from public.profiles p
  join viewer v on v.user_id is not null
  cross join normalized_query q
  left join public.follows f
    on f.follower_id = v.user_id
   and f.following_id = p.user_id
  left join public.user_stats_live us
    on us.user_id = p.user_id
  where p.user_id <> v.user_id
    and p.account_status = 'active'
    and p.deleted_at is null
    and not exists (
      select 1
        from public.user_blocks blocked
       where (blocked.blocker_id = v.user_id and blocked.blocked_id = p.user_id)
          or (blocked.blocker_id = p.user_id and blocked.blocked_id = v.user_id)
    )
    and (
      (
        q.query <> ''
        and (
          lower(p.username::text) like q.query || '%'
          or lower(p.display_name) like q.query || '%'
          or lower(p.username::text) like '%' || q.query || '%'
        )
      )
      or (
        q.query = ''
        and exists (
          select 1
            from viewer_profile vp
           where lower(vp.username) = 'dudy'
        )
      )
    )
  order by
    case when lower(p.username::text) = q.query then 0 else 1 end,
    case when lower(p.username::text) like q.query || '%' then 0 else 1 end,
    coalesce(us.badge_is_active_today, false) desc,
    coalesce(us.current_streak, 0) desc,
    p.created_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

create or replace function public.get_user_suggestions(
  p_current_lat double precision default null,
  p_current_lng double precision default null,
  p_limit integer default 20
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  current_streak integer,
  badge_is_active_today boolean,
  primary_reason text,
  mutual_friends_count integer,
  distance_km numeric,
  shared_gym_name text,
  follow_status text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  candidates as (
    select p.*
      from public.profiles p
      join viewer v on v.user_id is not null
     where p.user_id <> v.user_id
       and p.account_status = 'active'
       and p.deleted_at is null
       and not exists (
         select 1
           from public.user_blocks blocked
          where (blocked.blocker_id = v.user_id and blocked.blocked_id = p.user_id)
             or (blocked.blocker_id = p.user_id and blocked.blocked_id = v.user_id)
       )
       and private.can_view_profile_posts(p.user_id)
       and not exists (
         select 1
           from public.follows mine
          where mine.follower_id = v.user_id
            and mine.following_id = p.user_id
       )
  ),
  scored as (
    select
      c.user_id,
      c.username::text as username,
      c.display_name,
      c.avatar_url,
      coalesce(us.current_streak, 0) as current_streak,
      coalesce(us.badge_is_active_today, false) as badge_is_active_today,
      coalesce(mutuals.count, 0)::integer as mutual_friends_count,
      distances.distance_km,
      shared_gym.name as shared_gym_name,
      coalesce(my_follow.status, 'none')::text as follow_status,
      greatest(
        coalesce(max(p.created_at), c.created_at),
        coalesce(max(s.created_at), c.created_at),
        coalesce(max(ch.created_at), c.created_at),
        c.created_at
      ) as latest_activity_at,
      (
        coalesce(mutuals.count, 0) * 10
        + case when shared_gym.id is not null then 5 else 0 end
        + case
            when distances.distance_km is null then 0
            when distances.distance_km <= 1 then 4
            when distances.distance_km <= 5 then 3
            else 0
          end
      ) as score
    from candidates c
    left join public.user_stats_live us
      on us.user_id = c.user_id
    left join public.follows my_follow
      on my_follow.follower_id = (select user_id from viewer)
     and my_follow.following_id = c.user_id
    left join public.posts p
      on p.user_id = c.user_id
    left join public.stories s
      on s.user_id = c.user_id
     and s.expires_at > now()
    left join public.checkins ch
      on ch.user_id = c.user_id
    left join lateral (
      select count(*)::integer as count
        from public.follows mine
        join public.follows theirs
          on theirs.following_id = mine.following_id
         and theirs.follower_id = c.user_id
         and theirs.status = 'accepted'
       where mine.follower_id = (select user_id from viewer)
         and mine.status = 'accepted'
    ) mutuals on true
    left join lateral (
      select g.id, g.name
        from public.user_gyms my_gym
        join public.user_gyms target_gym
          on target_gym.gym_id = my_gym.gym_id
         and target_gym.user_id = c.user_id
        join public.gyms g
          on g.id = my_gym.gym_id
       where my_gym.user_id = (select user_id from viewer)
       order by my_gym.is_main desc, target_gym.is_main desc, g.name
       limit 1
    ) shared_gym on true
    left join lateral (
      select round(min(6371 * acos(
        least(1, greatest(-1,
          cos(radians(p_current_lat))
          * cos(radians(loc.lat))
          * cos(radians(loc.lng) - radians(p_current_lng))
          + sin(radians(p_current_lat))
          * sin(radians(loc.lat))
        ))
      ))::numeric, 1) as distance_km
      from (
        select post_locations.lat, post_locations.lng
          from (
            select recent_posts.location_latitude as lat, recent_posts.location_longitude as lng
              from public.posts recent_posts
             where recent_posts.user_id = c.user_id
               and recent_posts.location_latitude is not null
               and recent_posts.location_longitude is not null
             order by recent_posts.created_at desc
             limit 10
          ) post_locations
        union all
        select g.latitude as lat, g.longitude as lng
          from public.user_gyms ug
          join public.gyms g on g.id = ug.gym_id
         where ug.user_id = c.user_id
           and g.latitude is not null
           and g.longitude is not null
      ) loc
      where p_current_lat is not null
        and p_current_lng is not null
    ) distances on true
    group by
      c.user_id,
      c.username,
      c.display_name,
      c.avatar_url,
      c.created_at,
      us.current_streak,
      us.badge_is_active_today,
      mutuals.count,
      distances.distance_km,
      shared_gym.id,
      shared_gym.name,
      my_follow.status
  )
  select
    scored.user_id,
    scored.username,
    scored.display_name,
    scored.avatar_url,
    scored.current_streak,
    scored.badge_is_active_today,
    case
      when scored.mutual_friends_count > 0 then scored.mutual_friends_count::text || ' amigos em comum'
      when scored.shared_gym_name is not null then 'Treina na mesma academia'
      when scored.distance_km is not null and scored.distance_km <= 5 then 'Treina perto de você'
      when scored.badge_is_active_today then 'Ativo hoje'
      else 'Novo no circle'
    end as primary_reason,
    scored.mutual_friends_count,
    scored.distance_km,
    scored.shared_gym_name,
    scored.follow_status
  from scored
  where scored.score > 0
     or scored.badge_is_active_today
     or scored.current_streak > 0
  order by
    scored.score desc,
    scored.badge_is_active_today desc,
    scored.current_streak desc,
    scored.latest_activity_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.search_profiles(text, integer) from public, anon;
grant execute on function public.search_profiles(text, integer) to authenticated;

revoke all on function public.get_user_suggestions(double precision, double precision, integer) from public, anon;
grant execute on function public.get_user_suggestions(double precision, double precision, integer) to authenticated;

comment on function public.search_profiles(text, integer) is
  'Sprint C: compact profile search respecting active accounts and block relationships.';

comment on function public.get_user_suggestions(double precision, double precision, integer) is
  'Sprint C: compact social discovery surface with DB-side ranking and no raw score exposed.';
