-- Streak functions
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
  v_today              date := (now() at time zone 'utc')::date;
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
    if v_prev is not null and v_day = v_prev + interval '1 day' then
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
    select 1 from public.user_activity_days
     where user_id = p_user_id and has_photo = true and activity_date = v_today
  );

  if v_badge_today then v_anchor := v_today; else v_anchor := v_today - interval '1 day'; end if;

  v_day := v_anchor;
  loop
    if exists (
      select 1 from public.user_activity_days
       where user_id = p_user_id and has_photo = true and activity_date = v_day
    ) then
      v_current_streak := v_current_streak + 1;
      v_day := v_day - interval '1 day';
    else
      exit;
    end if;
  end loop;

  select count(distinct activity_date) into v_workouts_month
    from public.user_activity_days
   where user_id = p_user_id and has_photo = true
     and activity_date >= date_trunc('month', v_today)::date
     and activity_date <  (date_trunc('month', v_today) + interval '1 month')::date;

  select count(distinct activity_date) into v_active_days_year
    from public.user_activity_days
   where user_id = p_user_id and has_photo = true
     and activity_date >= date_trunc('year', v_today)::date
     and activity_date <  (date_trunc('year', v_today) + interval '1 year')::date;

  return query
  select v_current_streak, greatest(v_best_streak, v_current_streak),
         v_workouts_month, v_active_days_year, v_last_active, v_badge_today;
end;
$$;

create or replace function private.recalculate_user_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_stats record;
begin
  select * into v_stats from private.calc_user_stats(p_user_id);
  insert into public.user_stats (
    user_id, current_streak, best_streak, workouts_this_month,
    active_days_this_year, last_active_date, badge_is_active_today, updated_at
  ) values (
    p_user_id, v_stats.current_streak, v_stats.best_streak, v_stats.workouts_this_month,
    v_stats.active_days_this_year, v_stats.last_active_date, v_stats.badge_is_active_today, now()
  )
  on conflict (user_id) do update set
    current_streak        = excluded.current_streak,
    best_streak           = excluded.best_streak,
    workouts_this_month   = excluded.workouts_this_month,
    active_days_this_year = excluded.active_days_this_year,
    last_active_date      = excluded.last_active_date,
    badge_is_active_today = excluded.badge_is_active_today,
    updated_at            = now();
end;
$$;

create or replace function public.refresh_my_stats()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'auth.uid() is null';
  end if;
  perform private.recalculate_user_stats(auth.uid());
end;
$$;

revoke all on function public.refresh_my_stats() from public, anon;
grant execute on function public.refresh_my_stats() to authenticated;

-- Triggers
create or replace function private.on_post_inserted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
  values (new.user_id, new.workout_date, 'post', new.id, length(trim(new.image_url)) > 0)
  on conflict (user_id, activity_date, source_type, source_id) do nothing;
  perform private.recalculate_user_stats(new.user_id);
  return new;
end; $$;

create or replace function private.on_post_deleted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.user_activity_days where source_type = 'post' and source_id = old.id;
  perform private.recalculate_user_stats(old.user_id);
  return old;
end; $$;

drop trigger if exists posts_after_insert on public.posts;
create trigger posts_after_insert after insert on public.posts for each row execute function private.on_post_inserted();
drop trigger if exists posts_after_delete on public.posts;
create trigger posts_after_delete after delete on public.posts for each row execute function private.on_post_deleted();

create or replace function private.on_story_inserted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_activity_date date := (new.created_at at time zone 'utc')::date;
begin
  insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
  values (new.user_id, v_activity_date, 'story', new.id, length(trim(new.media_url)) > 0)
  on conflict (user_id, activity_date, source_type, source_id) do nothing;
  perform private.recalculate_user_stats(new.user_id);
  return new;
end; $$;

create or replace function private.on_story_deleted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.user_activity_days where source_type = 'story' and source_id = old.id;
  perform private.recalculate_user_stats(old.user_id);
  return old;
end; $$;

drop trigger if exists stories_after_insert on public.stories;
create trigger stories_after_insert after insert on public.stories for each row execute function private.on_story_inserted();
drop trigger if exists stories_after_delete on public.stories;
create trigger stories_after_delete after delete on public.stories for each row execute function private.on_story_deleted();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_username text; v_display text; v_base text; v_attempt integer := 0;
begin
  v_base := lower(coalesce(
    new.raw_user_meta_data->>'username',
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ));
  v_base := regexp_replace(v_base, '[^a-z0-9_.]', '', 'g');
  if length(v_base) < 3 then v_base := 'user_' || substr(new.id::text, 1, 6); end if;
  v_username := substr(v_base, 1, 32);

  while exists (select 1 from public.profiles where username = v_username) and v_attempt < 20 loop
    v_attempt := v_attempt + 1;
    v_username := substr(v_base, 1, 28) || '_' || substr(md5(random()::text), 1, 3);
  end loop;

  v_display := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'name',
    initcap(replace(v_base, '_', ' '))
  );

  insert into public.profiles (user_id, username, display_name, avatar_url)
  values (new.id, v_username, v_display, new.raw_user_meta_data->>'avatar_url')
  on conflict (user_id) do nothing;

  insert into public.user_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();;
