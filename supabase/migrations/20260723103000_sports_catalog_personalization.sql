-- Sports Catalog & Personalization Foundation.
-- Prepared for review only: do not apply without the release gate.

-- activity_type remains the canonical sport identifier. The catalog is
-- versioned in application code, so adding a sport must not require editing a
-- closed database enum/check list. Keep a conservative identifier contract.
alter table public.activities
  drop constraint if exists activities_type_chk;

alter table public.activities
  add constraint activities_type_chk
  check (activity_type ~ '^[a-z][a-z0-9-]{0,63}$');

-- Only explicit preferences are persisted. Usage and recency are derived from
-- activities to avoid counters that drift from the workout history.
create table public.user_sport_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  sport_id text not null,
  is_favorite boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, sport_id),
  constraint user_sport_preferences_sport_id_chk
    check (sport_id ~ '^[a-z][a-z0-9-]{0,63}$')
);

create index if not exists user_sport_preferences_favorites_idx
  on public.user_sport_preferences (user_id, updated_at desc)
  where is_favorite;

create index if not exists activities_user_type_started_idx
  on public.activities (user_id, activity_type, started_at desc);

alter table public.user_sport_preferences enable row level security;

drop policy if exists user_sport_preferences_select_own
  on public.user_sport_preferences;
create policy user_sport_preferences_select_own
  on public.user_sport_preferences for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists user_sport_preferences_insert_own
  on public.user_sport_preferences;
create policy user_sport_preferences_insert_own
  on public.user_sport_preferences for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists user_sport_preferences_update_own
  on public.user_sport_preferences;
create policy user_sport_preferences_update_own
  on public.user_sport_preferences for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists user_sport_preferences_delete_own
  on public.user_sport_preferences;
create policy user_sport_preferences_delete_own
  on public.user_sport_preferences for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_sport_preferences from anon, authenticated;
grant select, insert, update, delete
  on public.user_sport_preferences to authenticated;
grant all on public.user_sport_preferences to service_role;

comment on table public.user_sport_preferences is
  'Private per-user sport favorites. Usage and recency are derived from activities.';

-- Keep the closed analytics contract explicit while adding only the safe
-- catalog events prepared by this sprint.
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
      'streak_saved',
      'sport_catalog_opened',
      'sport_searched',
      'sport_started',
      'sport_favorite_changed',
      'sport_start_cancelled'
    )
  );
