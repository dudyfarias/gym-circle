-- Sprint 19 — Competição: sistema de pontos + ranking (circle/global × week/month/year).
--
-- Pontos (espelha apps/web/src/components/gym-circle/social/rankingPoints.ts):
--   treino 10/dia · semana ISO completa (7/7) +20 · mês completo +50 ·
--   conquista/desafio por raridade: comum 1 / incomum 2 / raro 3 / épico 5 / lendário 10.
--   (desafio: difficulty easy/medium/hard/legendary -> raridade common/uncommon/epic/legendary)

create schema if not exists private;

-- 1) Mapa de pontos dos achievements ESTÁTICOS (raridade -> pontos).
create table if not exists public.achievement_points (
  achievement_id text primary key,
  points integer not null
);

insert into public.achievement_points (achievement_id, points) values
  ('badge:first-workout', 1),
  ('badge:early-bird', 2),
  ('badge:night-owl', 2),
  ('badge:cross-trainer', 3),
  ('badge:explorer', 3),
  ('medal:streak-3', 1),
  ('medal:streak-7', 1),
  ('medal:streak-14', 2),
  ('medal:streak-30', 3),
  ('medal:workouts-50', 2),
  ('medal:streak-recovered', 1),
  ('trophy:streak-60', 3),
  ('trophy:active-week', 2),
  ('trophy:month-active', 2),
  ('trophy:year-active', 3),
  ('trophy:friends-50', 2),
  ('trophy:network-100', 3),
  ('trophy:community-200', 3),
  ('trophy:social-10', 1),
  ('trophy:prolific-100', 5),
  ('relic:unbreakable', 5),
  ('relic:circle-master', 10),
  ('relic:streak-365', 10),
  ('relic:founder-2026', 10)
on conflict (achievement_id) do update set points = excluded.points;

alter table public.achievement_points enable row level security;
drop policy if exists achievement_points_read on public.achievement_points;
create policy achievement_points_read on public.achievement_points for select using (true);

-- 2) Pontos de um achievement por composite id (challenge:% via difficulty; fallback 1).
create or replace function private.points_for_achievement(p_id text)
returns integer
language sql
stable
set search_path = public, private, pg_temp
as $$
  select case
    when p_id like 'challenge:%' then coalesce((
      select case mc.difficulty
        when 'easy' then 1
        when 'medium' then 2
        when 'hard' then 5
        when 'legendary' then 10
        else 1
      end
      from public.monthly_challenges mc
      where mc.id = nullif(split_part(p_id, ':', 3), '')::uuid
      limit 1
    ), 1)
    else coalesce((select ap.points from public.achievement_points ap where ap.achievement_id = p_id), 1)
  end;
$$;

-- 3) Ranking da Competição. SECURITY DEFINER: lê activity/achievements dos membros
--    mas retorna SÓ agregado de pontos (nunca linhas cruas). auth.uid() = viewer.
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
      (now() at time zone 'America/Sao_Paulo')::date as end_date
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
     where uad.activity_date between b.start_date and b.end_date
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
     where (ua.earned_at at time zone 'America/Sao_Paulo')::date between b.start_date and b.end_date
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
