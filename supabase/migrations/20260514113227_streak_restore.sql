-- Gym Circle — Streak Restore
-- Adds Duolingo-like streak protection without changing the activity source
-- of truth. Real workouts remain in user_activity_days; restored days live in
-- streak_restored_days and are only used for streak continuity.

alter table public.user_stats
  add column if not exists streak_restores_available integer not null default 3,
  add column if not exists last_streak_restore_used_at timestamptz,
  add column if not exists last_streak_restore_earned_at timestamptz,
  add column if not exists streak_restore_deadline_at timestamptz,
  add column if not exists streak_restore_missed_date date,
  add column if not exists streak_restore_status text;

do $$
begin
  alter table public.user_stats
    add constraint user_stats_streak_restores_available_check
    check (streak_restores_available between 0 and 3);
exception
  when duplicate_object then null;
end;
$$;

alter table public.user_stats
  drop constraint if exists user_stats_streak_restore_status_check;

alter table public.user_stats
  add constraint user_stats_streak_restore_status_check
  check (streak_restore_status is null or streak_restore_status in ('available', 'expired'));

insert into public.user_stats (user_id, streak_restores_available)
select u.id, 3
  from auth.users u
on conflict (user_id) do update
  set streak_restores_available = case
        when not exists (
          select 1
            from public.streak_restore_events e
           where e.user_id = excluded.user_id
             and e.type = 'initial'
        ) then 3
        else public.user_stats.streak_restores_available
      end,
      updated_at = now();

create table if not exists public.streak_restore_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null check (type in ('initial', 'earned', 'used', 'expired', 'admin')),
  amount        integer not null,
  reason        text,
  related_week  date,
  created_at    timestamptz not null default now()
);

create index if not exists streak_restore_events_user_created_idx
  on public.streak_restore_events (user_id, created_at desc);

create index if not exists streak_restore_events_user_type_week_idx
  on public.streak_restore_events (user_id, type, related_week)
  where related_week is not null;

create unique index if not exists streak_restore_events_one_initial_idx
  on public.streak_restore_events (user_id)
  where type = 'initial';

create unique index if not exists streak_restore_events_one_earned_per_week_idx
  on public.streak_restore_events (user_id, related_week)
  where type = 'earned' and related_week is not null;

create table if not exists public.streak_restored_days (
  user_id           uuid not null references auth.users(id) on delete cascade,
  restored_date     date not null,
  restore_event_id  uuid not null references public.streak_restore_events(id) on delete restrict,
  created_at        timestamptz not null default now(),
  primary key (user_id, restored_date)
);

create index if not exists streak_restored_days_user_date_idx
  on public.streak_restored_days (user_id, restored_date desc);

alter table public.streak_restore_events enable row level security;
alter table public.streak_restored_days enable row level security;

drop policy if exists "streak_restore_events_select_own_admin" on public.streak_restore_events;
create policy "streak_restore_events_select_own_admin"
  on public.streak_restore_events for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "streak_restored_days_select_own_admin" on public.streak_restored_days;
create policy "streak_restored_days_select_own_admin"
  on public.streak_restored_days for select to authenticated
  using (user_id = (select auth.uid()));

grant select on public.streak_restore_events to authenticated;
grant select on public.streak_restored_days to authenticated;

insert into public.streak_restore_events (user_id, type, amount, reason)
select us.user_id, 'initial', 3, 'initial grant'
  from public.user_stats us
 where not exists (
   select 1
     from public.streak_restore_events e
    where e.user_id = us.user_id
      and e.type = 'initial'
 );

alter table public.analytics_events
  drop constraint if exists analytics_events_event_name_check;

alter table public.analytics_events
  add constraint analytics_events_event_name_check
    check (
      event_name in (
        'signup_completed',
        'profile_completed',
        'first_post_created',
        'post_created',
        'streak_lit',
        'follow_created',
        'like_created',
        'comment_created',
        'story_created',
        'message_sent',
        'conversation_opened',
        'checkin_created',
        'day_1_retention',
        'app_opened',
        'streak_restore_used',
        'streak_restore_earned',
        'streak_restore_expired',
        'streak_lost',
        'streak_saved'
      )
    );

create or replace function private.gc_today()
returns date
language sql
stable
set search_path = pg_temp
as $$
  select (now() at time zone 'America/Sao_Paulo')::date;
$$;

create or replace function private.gc_deadline_for_missed_date(p_missed_date date)
returns timestamptz
language sql
stable
set search_path = pg_temp
as $$
  select ((p_missed_date + 2)::timestamp at time zone 'America/Sao_Paulo');
$$;

create or replace function private.has_streak_day(p_user_id uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.user_activity_days uad
     where uad.user_id = p_user_id
       and uad.has_photo = true
       and uad.activity_date = p_date
  )
  or exists (
    select 1
      from public.streak_restored_days srd
     where srd.user_id = p_user_id
       and srd.restored_date = p_date
  );
$$;

revoke all on function private.has_streak_day(uuid, date) from public;

create or replace function private.count_streak_ending_at(p_user_id uuid, p_anchor date)
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_day date := p_anchor;
begin
  loop
    if private.has_streak_day(p_user_id, v_day) then
      v_count := v_count + 1;
      v_day := v_day - 1;
    else
      exit;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function private.count_streak_ending_at(uuid, date) from public;

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
  v_today                date := private.gc_today();
  v_anchor               date;
  v_current_streak       integer := 0;
  v_best_streak          integer := 0;
  v_run                  integer := 0;
  v_prev                 date;
  v_day                  date;
  v_workouts_month       integer := 0;
  v_active_days_year     integer := 0;
  v_last_active          date;
  v_real_activity_today  boolean := false;
  v_restore_used_today   boolean := false;
  v_badge_today          boolean := false;
begin
  v_prev := null;
  for v_day in
    select day_key
      from (
        select distinct activity_date as day_key
          from public.user_activity_days
         where user_id = p_user_id
           and has_photo = true
        union
        select restored_date as day_key
          from public.streak_restored_days
         where user_id = p_user_id
      ) days
     order by day_key asc
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
   where user_id = p_user_id
     and has_photo = true;

  v_real_activity_today := exists (
    select 1
      from public.user_activity_days
     where user_id = p_user_id
       and has_photo = true
       and activity_date = v_today
  );

  v_restore_used_today := exists (
    select 1
      from public.streak_restored_days srd
     where srd.user_id = p_user_id
       and srd.restored_date = v_today - 1
       and (srd.created_at at time zone 'America/Sao_Paulo')::date = v_today
  );

  v_badge_today := v_real_activity_today or v_restore_used_today;
  v_anchor := case when v_real_activity_today then v_today else v_today - 1 end;
  v_current_streak := private.count_streak_ending_at(p_user_id, v_anchor);

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

create or replace function private.award_weekly_streak_restore(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := private.gc_today();
  v_week_start date := date_trunc('week', private.gc_today()::timestamp)::date;
  v_active_days integer := 0;
  v_available integer := 0;
  v_event_id uuid;
begin
  select coalesce(streak_restores_available, 3)
    into v_available
    from public.user_stats
   where user_id = p_user_id
   for update;

  if v_available is null then
    insert into public.user_stats (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;
    v_available := 3;
  end if;

  if v_available >= 3 then
    return;
  end if;

  if exists (
    select 1
      from public.streak_restore_events
     where user_id = p_user_id
       and type = 'earned'
       and related_week = v_week_start
  ) then
    return;
  end if;

  select count(distinct activity_date)
    into v_active_days
    from public.user_activity_days
   where user_id = p_user_id
     and has_photo = true
     and activity_date >= v_week_start
     and activity_date < v_week_start + 7;

  if v_active_days >= 6 then
    insert into public.streak_restore_events (user_id, type, amount, reason, related_week)
    values (p_user_id, 'earned', 1, '6 active days in one week', v_week_start)
    on conflict do nothing
    returning id into v_event_id;

    if v_event_id is null then
      return;
    end if;

    update public.user_stats
       set streak_restores_available = least(3, streak_restores_available + 1),
           last_streak_restore_earned_at = now(),
           updated_at = now()
     where user_id = p_user_id;

    insert into public.analytics_events (user_id, event_name, metadata, source)
    values (
      p_user_id,
      'streak_restore_earned',
      jsonb_build_object('related_week', v_week_start, 'active_days', v_active_days),
      'server'
    );
  end if;
end;
$$;

revoke all on function private.award_weekly_streak_restore(uuid) from public;

create or replace function private.sync_streak_restore_state(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date := private.gc_today();
  v_missed_date date := private.gc_today() - 1;
  v_deadline timestamptz := private.gc_deadline_for_missed_date(private.gc_today() - 1);
  v_stats public.user_stats;
  v_previous_streak integer := 0;
begin
  insert into public.user_stats (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  perform private.recalculate_user_stats(p_user_id);

  select *
    into v_stats
    from public.user_stats
   where user_id = p_user_id
   for update;

  if v_stats.streak_restore_status = 'available'
     and v_stats.streak_restore_deadline_at is not null
     and v_stats.streak_restore_deadline_at <= now() then
    insert into public.streak_restore_events (user_id, type, amount, reason)
    values (p_user_id, 'expired', 0, 'restore window expired');

    insert into public.analytics_events (user_id, event_name, metadata, source)
    values (
      p_user_id,
      'streak_restore_expired',
      jsonb_build_object('missed_date', v_stats.streak_restore_missed_date),
      'server'
    );

    update public.user_stats
       set streak_restore_status = 'expired',
           updated_at = now()
     where user_id = p_user_id;

    v_stats.streak_restore_status := 'expired';
  end if;

  perform private.award_weekly_streak_restore(p_user_id);

  select *
    into v_stats
    from public.user_stats
   where user_id = p_user_id
   for update;

  if v_stats.streak_restore_status = 'available'
     and v_stats.streak_restore_deadline_at > now() then
    return;
  end if;

  if v_stats.streak_restores_available <= 0 then
    return;
  end if;

  if private.has_streak_day(p_user_id, v_missed_date) then
    if v_stats.streak_restore_status is not null then
      update public.user_stats
         set streak_restore_status = null,
             streak_restore_deadline_at = null,
             streak_restore_missed_date = null,
             updated_at = now()
       where user_id = p_user_id;
    end if;
    return;
  end if;

  if exists (
    select 1
      from public.streak_restored_days
     where user_id = p_user_id
       and restored_date = v_missed_date - 1
  ) then
    return;
  end if;

  v_previous_streak := private.count_streak_ending_at(p_user_id, v_missed_date - 1);
  if v_previous_streak <= 0 then
    return;
  end if;

  if v_deadline <= now() then
    return;
  end if;

  update public.user_stats
     set streak_restore_status = 'available',
         streak_restore_deadline_at = v_deadline,
         streak_restore_missed_date = v_missed_date,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.analytics_events (user_id, event_name, metadata, source)
  select p_user_id,
         'streak_lost',
         jsonb_build_object('missed_date', v_missed_date, 'previous_streak', v_previous_streak),
         'server'
   where not exists (
     select 1
       from public.analytics_events
      where user_id = p_user_id
        and event_name = 'streak_lost'
        and metadata->>'missed_date' = v_missed_date::text
   );
end;
$$;

revoke all on function private.sync_streak_restore_state(uuid) from public;

create or replace function public.sync_my_streak_restores()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'auth.uid() is null';
  end if;

  perform private.sync_streak_restore_state(auth.uid());
end;
$$;

revoke all on function public.sync_my_streak_restores() from public, anon;
grant execute on function public.sync_my_streak_restores() to authenticated;

create or replace function public.use_streak_restore()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := private.gc_today();
  v_missed_date date := private.gc_today() - 1;
  v_stats public.user_stats;
  v_previous_streak integer := 0;
  v_event_id uuid;
begin
  if v_user_id is null then
    raise exception 'auth.uid() is null';
  end if;

  perform private.sync_streak_restore_state(v_user_id);

  select *
    into v_stats
    from public.user_stats
   where user_id = v_user_id
   for update;

  if v_stats.streak_restores_available <= 0 then
    raise exception 'no_streak_restores_available';
  end if;

  if v_stats.streak_restore_status <> 'available'
     or v_stats.streak_restore_missed_date is distinct from v_missed_date
     or v_stats.streak_restore_deadline_at is null
     or v_stats.streak_restore_deadline_at <= now() then
    raise exception 'streak_restore_not_available';
  end if;

  if private.has_streak_day(v_user_id, v_missed_date) then
    raise exception 'streak_restore_not_needed';
  end if;

  v_previous_streak := private.count_streak_ending_at(v_user_id, v_missed_date - 1);
  if v_previous_streak <= 0 then
    raise exception 'streak_restore_not_available';
  end if;

  if exists (
    select 1
      from public.streak_restored_days
     where user_id = v_user_id
       and restored_date = v_missed_date - 1
  ) then
    raise exception 'streak_restore_chain_blocked';
  end if;

  insert into public.streak_restore_events (user_id, type, amount, reason)
  values (v_user_id, 'used', -1, 'restored immediately previous missed day')
  returning id into v_event_id;

  insert into public.streak_restored_days (user_id, restored_date, restore_event_id)
  values (v_user_id, v_missed_date, v_event_id);

  update public.user_stats
     set streak_restores_available = greatest(0, streak_restores_available - 1),
         last_streak_restore_used_at = now(),
         streak_restore_deadline_at = null,
         streak_restore_missed_date = null,
         streak_restore_status = null,
         updated_at = now()
   where user_id = v_user_id;

  perform private.recalculate_user_stats(v_user_id);

  insert into public.analytics_events (user_id, event_name, metadata, source)
  values
    (
      v_user_id,
      'streak_restore_used',
      jsonb_build_object('restored_date', v_missed_date, 'previous_streak', v_previous_streak),
      'server'
    ),
    (
      v_user_id,
      'streak_saved',
      jsonb_build_object('restored_date', v_missed_date, 'saved_at', now()),
      'server'
    );
end;
$$;

revoke all on function public.use_streak_restore() from public, anon;
grant execute on function public.use_streak_restore() to authenticated;

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

  perform private.sync_streak_restore_state(auth.uid());
end;
$$;

revoke all on function public.refresh_my_stats() from public, anon;
grant execute on function public.refresh_my_stats() to authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text;
  v_display text;
  v_base text;
  v_attempt integer := 0;
begin
  v_base := lower(coalesce(
    new.raw_user_meta_data->>'username',
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ));
  v_base := regexp_replace(v_base, '[^a-z0-9_.]', '', 'g');
  if length(v_base) < 3 then
    v_base := 'user_' || substr(new.id::text, 1, 6);
  end if;
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

  insert into public.user_stats (user_id, streak_restores_available)
  values (new.id, 3)
  on conflict (user_id) do nothing;

  insert into public.streak_restore_events (user_id, type, amount, reason)
  values (new.id, 'initial', 3, 'initial grant')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

drop view if exists public.feed_posts;
drop view if exists public.user_stats_live;

create or replace function private.count_post_likes(p_post_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.post_likes
  where post_id = p_post_id;
$$;

revoke all on function private.count_post_likes(uuid) from public;
grant execute on function private.count_post_likes(uuid) to anon, authenticated;

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
    case when us.user_id = (select auth.uid()) then us.streak_restores_available else null end
      as streak_restores_available,
    case when us.user_id = (select auth.uid()) then us.last_streak_restore_used_at else null end
      as last_streak_restore_used_at,
    case when us.user_id = (select auth.uid()) then us.last_streak_restore_earned_at else null end
      as last_streak_restore_earned_at,
    case when us.user_id = (select auth.uid()) then us.streak_restore_deadline_at else null end
      as streak_restore_deadline_at,
    case when us.user_id = (select auth.uid()) then us.streak_restore_missed_date else null end
      as streak_restore_missed_date,
    case when us.user_id = (select auth.uid()) then us.streak_restore_status else null end
      as streak_restore_status,
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
