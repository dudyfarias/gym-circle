-- Ranking period hardening.
--
-- Product rule:
-- Achievement points are only valid in the period where the achievement was
-- first unlocked (`user_achievements.earned_at`). An achievement unlocked in
-- one week must not keep scoring in the next week just because it still exists
-- in the user's Hall of Fame.
--
-- Important:
-- - Do not use last_earned_at for ranking points.
-- - Do not use count for recurring weekly points.
-- - Keep points period-scoped with a half-open date window:
--   [period_start, period_end).

create or replace function public.get_circle_ranking(
  p_scope text default 'circle',
  p_period text default 'week',
  p_limit integer default 50
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  current_streak integer,
  badge_is_active_today boolean,
  workout_days integer,
  achievement_points integer,
  total_points integer,
  rank integer
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  with viewer as (select auth.uid() as uid),
  bounds as (
    select
      case lower(p_period)
        when 'week' then date_trunc('week', (now() at time zone 'America/Sao_Paulo'))::date
        when 'year' then date_trunc('year', (now() at time zone 'America/Sao_Paulo'))::date
        else date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date
      end as start_date,
      case lower(p_period)
        when 'week' then (date_trunc('week', (now() at time zone 'America/Sao_Paulo')) + interval '1 week')::date
        when 'year' then (date_trunc('year', (now() at time zone 'America/Sao_Paulo')) + interval '1 year')::date
        else (date_trunc('month', (now() at time zone 'America/Sao_Paulo')) + interval '1 month')::date
      end as end_date
  ),
  members as (
    select uid as user_id from viewer where uid is not null
    union
    select f.following_id
      from viewer v
      join public.follows f on f.follower_id = v.uid and f.status = 'accepted'
     where lower(p_scope) = 'circle'
    union
    select p.user_id
      from public.profiles p
     where lower(p_scope) = 'global'
       and p.account_status = 'active'
       and p.deleted_at is null
  ),
  activity as (
    select uad.user_id, uad.activity_date
      from public.user_activity_days uad
      join members m on m.user_id = uad.user_id
      cross join bounds b
     where uad.activity_date >= b.start_date
       and uad.activity_date < b.end_date
     group by uad.user_id, uad.activity_date
  ),
  wd as (
    select user_id, count(*)::int as workout_days from activity group by user_id
  ),
  wk as (
    select user_id, count(*)::int as full_weeks
      from (
        select user_id
          from activity
         group by user_id, date_trunc('week', activity_date)
        having count(*) >= 7
      ) z
     group by user_id
  ),
  mo as (
    select user_id, count(*)::int as full_months
      from (
        select user_id
          from activity
         group by user_id, date_trunc('month', activity_date)
        having count(*) >= extract(
          day from (date_trunc('month', min(activity_date)) + interval '1 month - 1 day')
        )::int
      ) z
     group by user_id
  ),
  ach as (
    select ua.user_id,
           sum(private.points_for_achievement(ua.achievement_id))::int as achievement_points
      from public.user_achievements ua
      join members m on m.user_id = ua.user_id
      cross join bounds b
     where (ua.earned_at at time zone 'America/Sao_Paulo')::date >= b.start_date
       and (ua.earned_at at time zone 'America/Sao_Paulo')::date < b.end_date
     group by ua.user_id
  ),
  scored as (
    select
      m.user_id,
      coalesce(wd.workout_days, 0) as workout_days,
      coalesce(ach.achievement_points, 0) as achievement_points,
      coalesce(wd.workout_days, 0) * 10
        + coalesce(wk.full_weeks, 0) * 20
        + coalesce(mo.full_months, 0) * 50
        + coalesce(ach.achievement_points, 0) as total_points
    from members m
    left join wd on wd.user_id = m.user_id
    left join wk on wk.user_id = m.user_id
    left join mo on mo.user_id = m.user_id
    left join ach on ach.user_id = m.user_id
  )
  select
    s.user_id,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    coalesce(st.current_streak, 0)::int as current_streak,
    coalesce(st.badge_is_active_today, false) as badge_is_active_today,
    s.workout_days,
    s.achievement_points,
    s.total_points,
    row_number() over (order by s.total_points desc, coalesce(st.current_streak, 0) desc)::int as rank
  from scored s
  join public.profiles pr on pr.user_id = s.user_id
  left join public.user_stats_live st on st.user_id = s.user_id
  where pr.account_status = 'active' and pr.deleted_at is null
  order by s.total_points desc, current_streak desc
  limit greatest(1, least(p_limit, 200));
$$;

revoke all on function public.get_circle_ranking(text, text, integer) from public, anon;
grant execute on function public.get_circle_ranking(text, text, integer) to authenticated;

comment on function public.get_circle_ranking(text, text, integer) is
  'Competition ranking. Achievement points are period-scoped by first unlock date (earned_at) using [period_start, period_end); old achievements do not keep scoring in later weeks.';
