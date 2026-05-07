-- Restrict admin aggregate views to admin users even when queried directly.

drop view if exists public.alpha_admin_daily_metrics;
create view public.alpha_admin_daily_metrics
with (security_invoker = true)
as
with days as (
  select generate_series(
    ((now() at time zone 'America/Sao_Paulo')::date - interval '30 days')::date,
    (now() at time zone 'America/Sao_Paulo')::date,
    interval '1 day'
  )::date as metric_date
)
select
  d.metric_date,
  (select count(*)::int from public.profiles p where p.created_at::date = d.metric_date) as users_registered,
  (select count(*)::int from public.posts p where p.created_at::date = d.metric_date) as posts_created,
  (select count(*)::int from public.stories s where s.created_at::date = d.metric_date) as stories_created,
  (select count(distinct ae.user_id)::int from public.analytics_events ae where ae.event_date = d.metric_date and ae.user_id is not null) as active_users,
  (select count(*)::int from public.analytics_events ae where ae.event_date = d.metric_date and ae.event_name = 'streak_lit') as streaks_lit,
  (select count(*)::int from public.analytics_events ae where ae.event_date = d.metric_date and ae.event_name = 'checkin_created') as checkins_created,
  (select count(*)::int from public.analytics_events ae where ae.event_date = d.metric_date and ae.event_name = 'like_created') as likes_created,
  (select count(*)::int from public.analytics_events ae where ae.event_date = d.metric_date and ae.event_name = 'comment_created') as comments_created
from days d
where private.is_admin()
order by d.metric_date desc;

drop view if exists public.alpha_admin_summary;
create view public.alpha_admin_summary
with (security_invoker = true)
as
select
  (select count(*)::int from public.profiles where account_status <> 'deleted') as users_registered,
  (select count(*)::int from public.posts where created_at >= (now() at time zone 'America/Sao_Paulo')::date) as posts_today,
  (select count(*)::int from public.stories where created_at >= (now() at time zone 'America/Sao_Paulo')::date) as stories_today,
  (select count(distinct user_id)::int from public.analytics_events where event_date = (now() at time zone 'America/Sao_Paulo')::date and user_id is not null) as active_users_today,
  (select count(*)::int from public.analytics_events where event_name = 'streak_lit' and event_date = (now() at time zone 'America/Sao_Paulo')::date) as streaks_lit_today,
  (select count(*)::int from public.reports where status in ('open', 'reviewing')) as open_reports,
  (select count(*)::int from public.user_blocks) as blocks_total,
  (select count(*)::int from public.account_deletion_requests where status in ('requested', 'processing')) as deletion_requests_open
where private.is_admin();

grant select on public.alpha_admin_daily_metrics to authenticated;
grant select on public.alpha_admin_summary to authenticated;
