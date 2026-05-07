-- Backend hardening: media consistency, private-post visibility and live streak dates.

grant usage on schema private to anon, authenticated;

-- ---------------------------------------------------------------------
-- Media/post consistency
-- ---------------------------------------------------------------------
alter table public.posts
  alter column image_url set not null,
  alter column workout_type drop not null,
  alter column media_type set default 'image',
  alter column location_source set default 'none',
  alter column workout_date set default ((now() at time zone 'America/Sao_Paulo')::date);

alter table public.posts
  drop constraint if exists posts_image_url_check,
  drop constraint if exists posts_workout_type_check,
  drop constraint if exists posts_media_type_check,
  drop constraint if exists posts_location_source_check;

alter table public.posts
  add constraint posts_image_url_check
    check (length(trim(image_url)) > 0),
  add constraint posts_workout_type_check
    check (workout_type is null or length(trim(workout_type)) > 0),
  add constraint posts_media_type_check
    check (media_type in ('image', 'video')),
  add constraint posts_location_source_check
    check (location_source in ('none', 'gym', 'current', 'custom'));

alter table public.stories
  alter column media_type set default 'image';

alter table public.stories
  drop constraint if exists stories_media_url_check,
  drop constraint if exists stories_media_type_check;

alter table public.stories
  add constraint stories_media_url_check
    check (length(trim(media_url)) > 0),
  add constraint stories_media_type_check
    check (media_type in ('image', 'video'));

alter table public.direct_messages
  drop constraint if exists direct_messages_media_type_check;

alter table public.direct_messages
  add constraint direct_messages_media_type_check
    check (media_type is null or media_type in ('image', 'video'));

alter table public.checkins
  alter column checkin_date set default ((now() at time zone 'America/Sao_Paulo')::date);

-- ---------------------------------------------------------------------
-- Private profile visibility
-- ---------------------------------------------------------------------
create or replace function private.can_view_profile_posts(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.profiles p
      where p.user_id = p_owner_id
        and coalesce(p.is_private, false) = false
    )
    or (select auth.uid()) = p_owner_id
    or exists (
      select 1
      from public.follows f
      where f.follower_id = (select auth.uid())
        and f.following_id = p_owner_id
        and f.status = 'accepted'
    );
$$;

revoke all on function private.can_view_profile_posts(uuid) from public;
grant execute on function private.can_view_profile_posts(uuid) to anon, authenticated;

drop policy if exists "posts_select_all" on public.posts;
drop policy if exists "posts_select_visible" on public.posts;

create policy "posts_select_visible"
  on public.posts for select to anon, authenticated
  using (private.can_view_profile_posts(user_id));

drop policy if exists "stories_select_active" on public.stories;
drop policy if exists "stories_select_visible" on public.stories;

create policy "stories_select_visible"
  on public.stories for select to anon, authenticated
  using (
    ((expires_at > now()) and private.can_view_profile_posts(user_id))
    or (select auth.uid()) = user_id
  );

drop policy if exists "post_comments_select_all" on public.post_comments;
drop policy if exists "post_comments_select_visible" on public.post_comments;

create policy "post_comments_select_visible"
  on public.post_comments for select to anon, authenticated
  using (
    exists (
      select 1
      from public.posts p
      where p.id = post_id
        and private.can_view_profile_posts(p.user_id)
    )
  );

drop policy if exists "user_activity_days_select_all" on public.user_activity_days;
drop policy if exists "uad_select_all" on public.user_activity_days;
drop policy if exists "user_activity_days_select_visible" on public.user_activity_days;

create policy "user_activity_days_select_visible"
  on public.user_activity_days for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or private.can_view_profile_posts(user_id)
  );

-- ---------------------------------------------------------------------
-- São Paulo streak clock + live stats view
-- ---------------------------------------------------------------------
create or replace function private.calc_user_stats(p_user_id uuid)
returns table (
  current_streak         integer,
  best_streak            integer,
  workouts_this_month    integer,
  active_days_this_year  integer,
  last_active_date       date,
  badge_is_active_today  boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today              date := (now() at time zone 'America/Sao_Paulo')::date;
  v_anchor             date;
  v_current_streak     integer := 0;
  v_best_streak        integer := 0;
  v_run                integer := 0;
  v_prev               date;
  v_day                date;
  v_workouts_month     integer := 0;
  v_active_days_year   integer := 0;
  v_last_active        date;
  v_badge_today        boolean := false;
begin
  v_prev := null;
  for v_day in
    select distinct activity_date
      from public.user_activity_days
     where user_id = p_user_id and has_photo = true
     order by activity_date asc
  loop
    if v_prev is not null and v_day = v_prev + 1 then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    if v_run > v_best_streak then
      v_best_streak := v_run;
    end if;
    v_prev := v_day;
  end loop;

  select max(activity_date) into v_last_active
    from public.user_activity_days
   where user_id = p_user_id and has_photo = true;

  v_badge_today := exists (
    select 1
      from public.user_activity_days
     where user_id = p_user_id
       and has_photo = true
       and activity_date = v_today
  );

  if v_badge_today then
    v_anchor := v_today;
  else
    v_anchor := v_today - 1;
  end if;

  v_day := v_anchor;
  loop
    if exists (
      select 1
        from public.user_activity_days
       where user_id = p_user_id
         and has_photo = true
         and activity_date = v_day
    ) then
      v_current_streak := v_current_streak + 1;
      v_day := v_day - 1;
    else
      exit;
    end if;
  end loop;

  select count(distinct activity_date) into v_workouts_month
    from public.user_activity_days
   where user_id = p_user_id
     and has_photo = true
     and activity_date >= date_trunc('month', v_today)::date
     and activity_date <  (date_trunc('month', v_today) + interval '1 month')::date;

  select count(distinct activity_date) into v_active_days_year
    from public.user_activity_days
   where user_id = p_user_id
     and has_photo = true
     and activity_date >= date_trunc('year', v_today)::date
     and activity_date <  (date_trunc('year', v_today) + interval '1 year')::date;

  return query
  select
    v_current_streak,
    greatest(v_best_streak, v_current_streak),
    v_workouts_month,
    v_active_days_year,
    v_last_active,
    v_badge_today;
end;
$$;

revoke all on function private.calc_user_stats(uuid) from public;
grant execute on function private.calc_user_stats(uuid) to anon, authenticated;

create or replace function private.on_story_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_date date := (new.created_at at time zone 'America/Sao_Paulo')::date;
begin
  insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
  values (new.user_id, v_activity_date, 'story', new.id, length(trim(new.media_url)) > 0)
  on conflict (user_id, activity_date, source_type, source_id) do nothing;
  perform private.recalculate_user_stats(new.user_id);
  return new;
end;
$$;

drop view if exists public.feed_posts;
drop view if exists public.user_stats_live;

create view public.user_stats_live
with (security_invoker = true)
as
  select
    us.user_id,
    live.current_streak,
    live.best_streak,
    live.workouts_this_month,
    live.active_days_this_year,
    live.last_active_date,
    live.badge_is_active_today,
    now() as updated_at
  from public.user_stats us
  cross join lateral private.calc_user_stats(us.user_id) live;

grant select on public.user_stats_live to anon, authenticated;

create view public.feed_posts
with (security_invoker = true)
as
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
    private.count_post_likes(p.id) as likes_count,
    coalesce(c.comments_count, 0) as comments_count,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    us.current_streak             as author_current_streak,
    us.best_streak                as author_best_streak,
    us.badge_is_active_today      as author_badge_active
  from public.posts p
  join public.profiles pr on pr.user_id = p.user_id
  left join public.gyms g on g.id = p.gym_id
  left join public.user_stats_live us on us.user_id = p.user_id
  left join lateral (
    select count(*)::int as comments_count
    from public.post_comments pc
    where pc.post_id = p.id
  ) c on true;

grant select on public.feed_posts to anon, authenticated;
