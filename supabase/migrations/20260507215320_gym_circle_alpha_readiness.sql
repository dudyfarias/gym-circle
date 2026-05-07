-- Gym Circle alpha readiness: onboarding, social safety, analytics and admin metrics.

-- ---------------------------------------------------------------------
-- Profile readiness/legal flags
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists alpha_terms_accepted_at timestamptz,
  add column if not exists privacy_policy_accepted_at timestamptz,
  add column if not exists account_status text not null default 'active',
  add column if not exists deleted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
    check (account_status in ('active', 'deletion_requested', 'deleted'));

create index if not exists profiles_onboarding_idx
  on public.profiles (onboarding_completed_at)
  where onboarding_completed_at is not null;

create index if not exists profiles_account_status_idx
  on public.profiles (account_status);

-- ---------------------------------------------------------------------
-- Social safety tables
-- ---------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id  uuid not null references auth.users(id) on delete cascade,
  blocked_id  uuid not null references auth.users(id) on delete cascade,
  reason      text,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_idx
  on public.user_blocks (blocked_id, created_at desc);

create table if not exists public.reports (
  id                uuid primary key default gen_random_uuid(),
  reporter_id       uuid not null references auth.users(id) on delete cascade,
  reported_user_id  uuid references auth.users(id) on delete set null,
  post_id           uuid references public.posts(id) on delete set null,
  story_id          uuid references public.stories(id) on delete set null,
  reason            text not null check (reason in ('spam', 'harassment', 'nudity', 'violence', 'hate', 'fake_profile', 'other')),
  details           text,
  status            text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz,
  check (reported_user_id is not null or post_id is not null or story_id is not null)
);

create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);
create index if not exists reports_reporter_idx
  on public.reports (reporter_id, created_at desc);

create table if not exists public.account_deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  reason        text,
  status        text not null default 'requested' check (status in ('requested', 'processing', 'completed', 'cancelled')),
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

create unique index if not exists account_deletion_requests_open_user_idx
  on public.account_deletion_requests (user_id)
  where status in ('requested', 'processing');

create table if not exists public.legal_acceptances (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  document_type  text not null check (document_type in ('alpha_terms', 'privacy_policy', 'beta_disclaimer')),
  version        text not null,
  accepted_at    timestamptz not null default now(),
  metadata       jsonb not null default '{}'::jsonb,
  unique (user_id, document_type, version)
);

create index if not exists legal_acceptances_user_idx
  on public.legal_acceptances (user_id, accepted_at desc);

-- ---------------------------------------------------------------------
-- Product analytics
-- ---------------------------------------------------------------------
create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  event_name  text not null check (
    event_name in (
      'signup_completed',
      'profile_completed',
      'first_post_created',
      'streak_lit',
      'follow_created',
      'like_created',
      'comment_created',
      'story_created',
      'checkin_created',
      'day_1_retention',
      'app_opened'
    )
  ),
  event_date  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  metadata    jsonb not null default '{}'::jsonb,
  source      text not null default 'client' check (source in ('client', 'server')),
  created_at  timestamptz not null default now()
);

create index if not exists analytics_events_name_date_idx
  on public.analytics_events (event_name, event_date desc);
create index if not exists analytics_events_user_created_idx
  on public.analytics_events (user_id, created_at desc);
create index if not exists analytics_events_daily_active_idx
  on public.analytics_events (event_date, user_id)
  where user_id is not null;

-- ---------------------------------------------------------------------
-- Admin + safety helpers
-- ---------------------------------------------------------------------
create or replace function private.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_user_id
      and lower(p.username::text) = 'dudy'
      and p.account_status <> 'deleted'
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select private.is_admin((select auth.uid()));
$$;

create or replace function private.is_account_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = p_user_id
      and p.account_status = 'active'
      and p.deleted_at is null
  );
$$;

create or replace function private.has_block_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_a is not null
    and p_b is not null
    and exists (
      select 1
      from public.user_blocks b
      where (b.blocker_id = p_a and b.blocked_id = p_b)
         or (b.blocker_id = p_b and b.blocked_id = p_a)
    );
$$;

create or replace function private.can_view_profile(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    private.is_admin()
    or (
      private.is_account_active(p_owner_id)
      and not private.has_block_between((select auth.uid()), p_owner_id)
    );
$$;

create or replace function private.can_view_profile_posts(p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    private.is_admin()
    or (
      private.is_account_active(p_owner_id)
      and not private.has_block_between((select auth.uid()), p_owner_id)
      and (
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
        )
      )
    );
$$;

create or replace function private.can_interact_with_user(p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    (select auth.uid()) is not null
    and p_target_id is not null
    and private.is_account_active((select auth.uid()))
    and private.is_account_active(p_target_id)
    and not private.has_block_between((select auth.uid()), p_target_id);
$$;

revoke all on function private.is_admin(uuid) from public;
revoke all on function private.is_admin() from public;
revoke all on function private.is_account_active(uuid) from public;
revoke all on function private.has_block_between(uuid, uuid) from public;
revoke all on function private.can_view_profile(uuid) from public;
revoke all on function private.can_view_profile_posts(uuid) from public;
revoke all on function private.can_interact_with_user(uuid) from public;

grant execute on function private.is_admin(uuid) to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_account_active(uuid) to authenticated;
grant execute on function private.has_block_between(uuid, uuid) to authenticated;
grant execute on function private.can_view_profile(uuid) to anon, authenticated;
grant execute on function private.can_view_profile_posts(uuid) to anon, authenticated;
grant execute on function private.can_interact_with_user(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS: new tables
-- ---------------------------------------------------------------------
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.legal_acceptances enable row level security;
alter table public.analytics_events enable row level security;

drop policy if exists "user_blocks_select_self_admin" on public.user_blocks;
drop policy if exists "user_blocks_insert_self" on public.user_blocks;
drop policy if exists "user_blocks_delete_self" on public.user_blocks;
create policy "user_blocks_select_self_admin"
  on public.user_blocks for select to authenticated
  using ((select auth.uid()) in (blocker_id, blocked_id) or private.is_admin());
create policy "user_blocks_insert_self"
  on public.user_blocks for insert to authenticated
  with check ((select auth.uid()) = blocker_id and private.is_account_active((select auth.uid())));
create policy "user_blocks_delete_self"
  on public.user_blocks for delete to authenticated
  using ((select auth.uid()) = blocker_id or private.is_admin());

drop policy if exists "reports_select_self_admin" on public.reports;
drop policy if exists "reports_insert_self" on public.reports;
drop policy if exists "reports_update_admin" on public.reports;
create policy "reports_select_self_admin"
  on public.reports for select to authenticated
  using ((select auth.uid()) = reporter_id or private.is_admin());
create policy "reports_insert_self"
  on public.reports for insert to authenticated
  with check ((select auth.uid()) = reporter_id and private.is_account_active((select auth.uid())));
create policy "reports_update_admin"
  on public.reports for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "account_deletion_requests_select_self_admin" on public.account_deletion_requests;
drop policy if exists "account_deletion_requests_insert_self" on public.account_deletion_requests;
drop policy if exists "account_deletion_requests_update_admin" on public.account_deletion_requests;
create policy "account_deletion_requests_select_self_admin"
  on public.account_deletion_requests for select to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());
create policy "account_deletion_requests_insert_self"
  on public.account_deletion_requests for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "account_deletion_requests_update_admin"
  on public.account_deletion_requests for update to authenticated
  using (private.is_admin())
  with check (private.is_admin());

drop policy if exists "legal_acceptances_select_self_admin" on public.legal_acceptances;
drop policy if exists "legal_acceptances_insert_self" on public.legal_acceptances;
create policy "legal_acceptances_select_self_admin"
  on public.legal_acceptances for select to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());
create policy "legal_acceptances_insert_self"
  on public.legal_acceptances for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "analytics_events_select_self_admin" on public.analytics_events;
drop policy if exists "analytics_events_insert_self" on public.analytics_events;
create policy "analytics_events_select_self_admin"
  on public.analytics_events for select to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());
create policy "analytics_events_insert_self"
  on public.analytics_events for insert to authenticated
  with check ((select auth.uid()) = user_id and source = 'client');

grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, insert, update on public.account_deletion_requests to authenticated;
grant select, insert on public.legal_acceptances to authenticated;
grant select, insert on public.analytics_events to authenticated;

-- ---------------------------------------------------------------------
-- RLS: privacy/block hardening on existing social tables
-- ---------------------------------------------------------------------
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
  on public.profiles for select to anon, authenticated
  using (private.can_view_profile(user_id));

drop policy if exists "follows_insert_not_blocked" on public.follows;
create policy "follows_insert_not_blocked"
  on public.follows as restrictive for insert to authenticated
  with check (private.can_interact_with_user(following_id));

drop policy if exists "post_likes_insert_not_blocked" on public.post_likes;
create policy "post_likes_insert_not_blocked"
  on public.post_likes as restrictive for insert to authenticated
  with check (
    exists (
      select 1
      from public.posts p
      where p.id = post_id
        and private.can_interact_with_user(p.user_id)
        and private.can_view_profile_posts(p.user_id)
    )
  );

drop policy if exists "post_comments_insert_not_blocked" on public.post_comments;
create policy "post_comments_insert_not_blocked"
  on public.post_comments as restrictive for insert to authenticated
  with check (
    exists (
      select 1
      from public.posts p
      where p.id = post_id
        and private.can_interact_with_user(p.user_id)
        and private.can_view_profile_posts(p.user_id)
    )
  );

drop policy if exists "direct_messages_insert_not_blocked" on public.direct_messages;
create policy "direct_messages_insert_not_blocked"
  on public.direct_messages as restrictive for insert to authenticated
  with check (private.can_interact_with_user(receiver_id));

drop policy if exists "posts_insert_active_self" on public.posts;
create policy "posts_insert_active_self"
  on public.posts as restrictive for insert to authenticated
  with check ((select auth.uid()) = user_id and private.is_account_active(user_id));

drop policy if exists "stories_insert_active_self" on public.stories;
create policy "stories_insert_active_self"
  on public.stories as restrictive for insert to authenticated
  with check ((select auth.uid()) = user_id and private.is_account_active(user_id));

-- ---------------------------------------------------------------------
-- Client RPCs
-- ---------------------------------------------------------------------
create or replace function public.mark_onboarding_complete()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'auth.uid() is null';
  end if;

  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where user_id = (select auth.uid());

  insert into public.analytics_events (user_id, event_name, metadata, source)
  values ((select auth.uid()), 'profile_completed', '{}'::jsonb, 'client');
end;
$$;

revoke all on function public.mark_onboarding_complete() from public, anon;
grant execute on function public.mark_onboarding_complete() to authenticated;

create or replace function public.accept_alpha_legal(
  p_terms_version text default 'alpha-2026-05-07',
  p_privacy_version text default 'privacy-2026-05-07'
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'auth.uid() is null';
  end if;

  insert into public.legal_acceptances (user_id, document_type, version)
  values
    ((select auth.uid()), 'alpha_terms', p_terms_version),
    ((select auth.uid()), 'privacy_policy', p_privacy_version),
    ((select auth.uid()), 'beta_disclaimer', 'beta-2026-05-07')
  on conflict (user_id, document_type, version) do nothing;

  update public.profiles
     set alpha_terms_accepted_at = coalesce(alpha_terms_accepted_at, now()),
         privacy_policy_accepted_at = coalesce(privacy_policy_accepted_at, now())
   where user_id = (select auth.uid());
end;
$$;

revoke all on function public.accept_alpha_legal(text, text) from public, anon;
grant execute on function public.accept_alpha_legal(text, text) to authenticated;

create or replace function public.request_account_deletion(p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'auth.uid() is null';
  end if;

  if not exists (
    select 1
    from public.account_deletion_requests
    where user_id = (select auth.uid())
      and status in ('requested', 'processing')
  ) then
    insert into public.account_deletion_requests (user_id, reason)
    values ((select auth.uid()), nullif(trim(coalesce(p_reason, '')), ''));
  end if;

  update public.profiles
     set account_status = 'deletion_requested',
         deleted_at = coalesce(deleted_at, now()),
         display_name = 'Usuário removido',
         bio = null,
         fitness_goal = null,
         avatar_url = null,
         instagram_username = null,
         sports = '{}',
         is_private = true
   where user_id = (select auth.uid());
end;
$$;

revoke all on function public.request_account_deletion(text) from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;

-- ---------------------------------------------------------------------
-- Analytics helpers + triggers
-- ---------------------------------------------------------------------
create or replace function private.track_event(
  p_user_id uuid,
  p_event_name text,
  p_metadata jsonb default '{}'::jsonb,
  p_source text default 'server'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null then
    return;
  end if;

  insert into public.analytics_events (user_id, event_name, metadata, source)
  values (p_user_id, p_event_name, coalesce(p_metadata, '{}'::jsonb), p_source);
end;
$$;

revoke all on function private.track_event(uuid, text, jsonb, text) from public;

create or replace function private.analytics_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(new.user_id, 'signup_completed', '{}'::jsonb, 'server');
  return new;
end;
$$;

create or replace function private.analytics_post_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.analytics_events
    where user_id = new.user_id and event_name = 'first_post_created'
  ) then
    perform private.track_event(new.user_id, 'first_post_created', jsonb_build_object('post_id', new.id), 'server');
  end if;
  return new;
end;
$$;

create or replace function private.analytics_story_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(new.user_id, 'story_created', jsonb_build_object('story_id', new.id), 'server');
  return new;
end;
$$;

create or replace function private.analytics_activity_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.has_photo and not exists (
    select 1
    from public.analytics_events
    where user_id = new.user_id
      and event_name = 'streak_lit'
      and event_date = new.activity_date
  ) then
    perform private.track_event(
      new.user_id,
      'streak_lit',
      jsonb_build_object('source_type', new.source_type, 'source_id', new.source_id),
      'server'
    );
  end if;
  return new;
end;
$$;

create or replace function private.analytics_follow_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(new.follower_id, 'follow_created', jsonb_build_object('following_id', new.following_id, 'status', new.status), 'server');
  return new;
end;
$$;

create or replace function private.analytics_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(new.user_id, 'like_created', jsonb_build_object('post_id', new.post_id), 'server');
  return new;
end;
$$;

create or replace function private.analytics_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(new.user_id, 'comment_created', jsonb_build_object('post_id', new.post_id, 'comment_id', new.id), 'server');
  return new;
end;
$$;

create or replace function private.analytics_checkin_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(new.user_id, 'checkin_created', jsonb_build_object('gym_id', new.gym_id, 'checkin_id', new.id), 'server');
  return new;
end;
$$;

drop trigger if exists profiles_after_insert_analytics on public.profiles;
create trigger profiles_after_insert_analytics
  after insert on public.profiles
  for each row execute function private.analytics_profile_insert();

drop trigger if exists posts_after_insert_analytics on public.posts;
create trigger posts_after_insert_analytics
  after insert on public.posts
  for each row execute function private.analytics_post_insert();

drop trigger if exists stories_after_insert_analytics on public.stories;
create trigger stories_after_insert_analytics
  after insert on public.stories
  for each row execute function private.analytics_story_insert();

drop trigger if exists user_activity_days_after_insert_analytics on public.user_activity_days;
create trigger user_activity_days_after_insert_analytics
  after insert on public.user_activity_days
  for each row execute function private.analytics_activity_insert();

drop trigger if exists follows_after_insert_analytics on public.follows;
create trigger follows_after_insert_analytics
  after insert on public.follows
  for each row execute function private.analytics_follow_insert();

drop trigger if exists post_likes_after_insert_analytics on public.post_likes;
create trigger post_likes_after_insert_analytics
  after insert on public.post_likes
  for each row execute function private.analytics_like_insert();

drop trigger if exists post_comments_after_insert_analytics on public.post_comments;
create trigger post_comments_after_insert_analytics
  after insert on public.post_comments
  for each row execute function private.analytics_comment_insert();

drop trigger if exists checkins_after_insert_analytics on public.checkins;
create trigger checkins_after_insert_analytics
  after insert on public.checkins
  for each row execute function private.analytics_checkin_insert();

-- ---------------------------------------------------------------------
-- Admin views. security_invoker keeps RLS active; admin policies reveal all.
-- ---------------------------------------------------------------------
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
  (select count(*)::int from public.account_deletion_requests where status in ('requested', 'processing')) as deletion_requests_open;

grant select on public.alpha_admin_daily_metrics to authenticated;
grant select on public.alpha_admin_summary to authenticated;

comment on table public.user_blocks is 'Bloqueios sociais entre usuários. Bloqueados somem do feed/perfil e não podem interagir.';
comment on table public.reports is 'Denúncias de usuários, posts ou stories para revisão interna.';
comment on table public.analytics_events is 'Eventos de produto para alpha fechada e funil social.';
comment on table public.account_deletion_requests is 'Pedidos de exclusão/desativação para processamento interno.';
