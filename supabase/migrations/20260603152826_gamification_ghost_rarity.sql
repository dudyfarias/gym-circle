create or replace function public.get_achievement_rarity_summary()
returns table (
  achievement_id text,
  owners_count integer,
  total_users integer,
  owned_percent numeric
)
language sql
stable
set search_path = public
as $$
  with active_profiles as (
    select
      p.user_id,
      p.created_at,
      row_number() over (order by p.created_at asc, p.id asc)::integer as founder_rank
    from public.profiles p
    where coalesce(p.account_status, 'active') = 'active'
      and p.deleted_at is null
  ),
  totals as (
    select count(*)::integer as total_users
    from active_profiles
  ),
  post_days as (
    select
      p.user_id,
      coalesce(p.workout_date, (p.created_at at time zone 'America/Sao_Paulo')::date) as activity_date,
      count(*)::integer as posts_in_day
    from public.posts p
    join active_profiles ap on ap.user_id = p.user_id
    where nullif(p.image_url, '') is not null
    group by p.user_id, coalesce(p.workout_date, (p.created_at at time zone 'America/Sao_Paulo')::date)
  ),
  post_metrics as (
    select
      p.user_id,
      count(*)::integer as posts_count,
      bool_or(extract(hour from p.created_at at time zone 'America/Sao_Paulo') >= 23) as has_late_post,
      bool_or(extract(hour from p.created_at at time zone 'America/Sao_Paulo') < 5) as has_early_post
    from public.posts p
    join active_profiles ap on ap.user_id = p.user_id
    where nullif(p.image_url, '') is not null
    group by p.user_id
  ),
  max_post_days as (
    select user_id, max(posts_in_day)::integer as max_posts_in_day
    from post_days
    group by user_id
  ),
  week_types as (
    select
      p.user_id,
      count(distinct coalesce(nullif(p.workout_type, ''), 'Outro'))::integer as workout_types_this_week
    from public.posts p
    join active_profiles ap on ap.user_id = p.user_id
    where nullif(p.image_url, '') is not null
      and coalesce(p.workout_date, (p.created_at at time zone 'America/Sao_Paulo')::date)
        between (
          ((now() at time zone 'America/Sao_Paulo')::date)
          - (((extract(dow from (now() at time zone 'America/Sao_Paulo')::date)::integer + 6) % 7) * interval '1 day')
        )::date
        and (now() at time zone 'America/Sao_Paulo')::date
    group by p.user_id
  ),
  week_activity as (
    select
      uad.user_id,
      count(distinct uad.activity_date)::integer as workouts_this_week
    from public.user_activity_days uad
    join active_profiles ap on ap.user_id = uad.user_id
    where uad.has_photo = true
      and uad.activity_date
        between (
          ((now() at time zone 'America/Sao_Paulo')::date)
          - (((extract(dow from (now() at time zone 'America/Sao_Paulo')::date)::integer + 6) % 7) * interval '1 day')
        )::date
        and (now() at time zone 'America/Sao_Paulo')::date
    group by uad.user_id
  ),
  activity_metrics as (
    select
      uad.user_id,
      count(distinct uad.activity_date)::integer as active_days_count
    from public.user_activity_days uad
    join active_profiles ap on ap.user_id = uad.user_id
    where uad.has_photo = true
    group by uad.user_id
  ),
  story_metrics as (
    select s.user_id, count(*)::integer as stories_count
    from public.stories s
    join active_profiles ap on ap.user_id = s.user_id
    where nullif(s.media_url, '') is not null
    group by s.user_id
  ),
  comment_metrics as (
    select pc.user_id, count(*)::integer as comments_count
    from public.post_comments pc
    join active_profiles ap on ap.user_id = pc.user_id
    group by pc.user_id
  ),
  checkin_metrics as (
    select c.user_id, count(*)::integer as checkins_count
    from public.checkins c
    join active_profiles ap on ap.user_id = c.user_id
    group by c.user_id
  ),
  follow_metrics as (
    select f.following_id as user_id, count(*)::integer as followers_count
    from public.follows f
    join active_profiles ap on ap.user_id = f.following_id
    where f.status = 'accepted'
    group by f.following_id
  ),
  restore_metrics as (
    select sre.user_id, count(*)::integer as restore_used_count
    from public.streak_restore_events sre
    join active_profiles ap on ap.user_id = sre.user_id
    where sre.type = 'used'
    group by sre.user_id
  ),
  participant_metrics as (
    select user_id, count(*)::integer as group_workouts_count
    from (
      select pp.tagged_user_id as user_id
      from public.post_participants pp
      join active_profiles ap on ap.user_id = pp.tagged_user_id
      where pp.status = 'accepted'
      union all
      select pp.tagged_by_user_id as user_id
      from public.post_participants pp
      join active_profiles ap on ap.user_id = pp.tagged_by_user_id
      where pp.status = 'accepted'
    ) rows
    group by user_id
  ),
  user_facts as (
    select
      ap.user_id,
      ap.founder_rank,
      coalesce(pm.posts_count, 0) as posts_count,
      coalesce(sm.stories_count, 0) as stories_count,
      coalesce(cm.comments_count, 0) as comments_count,
      coalesce(chm.checkins_count, 0) as checkins_count,
      coalesce(fm.followers_count, 0) as followers_count,
      coalesce(rm.restore_used_count, 0) as restore_used_count,
      coalesce(gm.group_workouts_count, 0) as group_workouts_count,
      coalesce(mpd.max_posts_in_day, 0) as max_posts_in_day,
      coalesce(wt.workout_types_this_week, 0) as workout_types_this_week,
      coalesce(wa.workouts_this_week, 0) as workouts_this_week,
      coalesce(am.active_days_count, 0) as active_days_count,
      coalesce(pm.has_late_post, false) as has_late_post,
      coalesce(pm.has_early_post, false) as has_early_post,
      coalesce(us.best_streak, 0) as best_streak,
      coalesce(us.workouts_this_month, 0) as workouts_this_month,
      coalesce(us.active_days_this_year, 0) as active_days_this_year
    from active_profiles ap
    left join public.user_stats_live us on us.user_id = ap.user_id
    left join post_metrics pm on pm.user_id = ap.user_id
    left join story_metrics sm on sm.user_id = ap.user_id
    left join comment_metrics cm on cm.user_id = ap.user_id
    left join checkin_metrics chm on chm.user_id = ap.user_id
    left join follow_metrics fm on fm.user_id = ap.user_id
    left join restore_metrics rm on rm.user_id = ap.user_id
    left join participant_metrics gm on gm.user_id = ap.user_id
    left join max_post_days mpd on mpd.user_id = ap.user_id
    left join week_types wt on wt.user_id = ap.user_id
    left join week_activity wa on wa.user_id = ap.user_id
    left join activity_metrics am on am.user_id = ap.user_id
  ),
  flags as (
    select user_id, 'first-workout'::text as achievement_id from user_facts where posts_count >= 1
    union all select user_id, 'first-story' from user_facts where stories_count >= 1
    union all select user_id, 'first-checkin' from user_facts where checkins_count >= 1
    union all select user_id, 'first-comment' from user_facts where comments_count >= 1
    union all select user_id, 'first-group-workout' from user_facts where group_workouts_count >= 1
    union all select user_id, 'streak-3' from user_facts where best_streak >= 3
    union all select user_id, 'streak-7' from user_facts where best_streak >= 7
    union all select user_id, 'streak-14' from user_facts where best_streak >= 14
    union all select user_id, 'streak-30' from user_facts where best_streak >= 30
    union all select user_id, 'active-week' from user_facts where workouts_this_week >= 5
    union all select user_id, 'month-active' from user_facts where workouts_this_month >= 15
    union all select user_id, 'perfect-week' from user_facts where workouts_this_week >= 7
    union all select user_id, 'hundred-workouts' from user_facts where posts_count >= 100
    union all select user_id, 'social' from user_facts where followers_count >= 10
    union all select user_id, 'popular' from user_facts where followers_count >= 50
    union all select user_id, 'streak-recovered' from user_facts where restore_used_count >= 1
    union all select user_id, 'year-active' from user_facts where active_days_this_year >= 100
    union all select user_id, 'circle-master' from user_facts where active_days_this_year >= 300
    union all select user_id, 'unbreakable-100' from user_facts where best_streak >= 100
    union all select user_id, 'founder' from user_facts where founder_rank <= 100
    union all select user_id, 'owl' from user_facts where has_late_post
    union all select user_id, 'early-bird' from user_facts where has_early_post
    union all select user_id, 'lightning' from user_facts where max_posts_in_day >= 3
    union all select user_id, 'chameleon' from user_facts where workout_types_this_week >= 3
    union all select user_id, 'ghost' from user_facts where active_days_count >= 30 and stories_count = 0
    union all select user_id, 'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-easy'
      from user_facts where workouts_this_month >= 8
    union all select user_id, 'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-medium'
      from user_facts where workouts_this_month >= 15
    union all select user_id, 'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-hard'
      from user_facts where workouts_this_month >= 20
    union all select user_id, 'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-legendary'
      from user_facts
      where workouts_this_month >= extract(day from (
        date_trunc('month', now() at time zone 'America/Sao_Paulo')
        + interval '1 month' - interval '1 day'
      ))::integer
  ),
  all_achievement_ids as (
    select unnest(array[
      'first-workout','first-story','first-checkin','first-comment','first-group-workout',
      'streak-3','streak-7','streak-14','streak-30','active-week','month-active',
      'perfect-week','hundred-workouts','social','popular','streak-recovered',
      'year-active','circle-master','unbreakable-100','founder','owl','early-bird',
      'lightning','chameleon','ghost',
      'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-easy',
      'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-medium',
      'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-hard',
      'trophy-' || to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM') || '-legendary'
    ]) as achievement_id
  ),
  counts as (
    select achievement_id, count(distinct user_id)::integer as owners_count
    from flags
    group by achievement_id
  )
  select
    ids.achievement_id,
    coalesce(counts.owners_count, 0) as owners_count,
    totals.total_users,
    case
      when totals.total_users = 0 then 0::numeric
      else round((coalesce(counts.owners_count, 0)::numeric / totals.total_users::numeric) * 100, 4)
    end as owned_percent
  from all_achievement_ids ids
  cross join totals
  left join counts using (achievement_id)
  order by ids.achievement_id;
$$;

comment on function public.get_achievement_rarity_summary() is
  'Aggregates global Gym Circle achievement rarity percentages across active profiles.';

revoke all on function public.get_achievement_rarity_summary() from public, anon;
grant execute on function public.get_achievement_rarity_summary() to authenticated;
