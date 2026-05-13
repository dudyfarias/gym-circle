-- Phase 1 Alpha retention layer:
-- - expands product analytics events requested for the closed alpha
-- - notifies DMs, new stories and "people training today"
-- - keeps all writes server-side through SECURITY DEFINER triggers/RLS

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
        'app_opened'
      )
    );

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
    check (
      kind in (
        'like',
        'comment',
        'follow',
        'mention',
        'follow_request',
        'story_like',
        'story_reply',
        'new_message',
        'new_story',
        'training_today'
      )
    );

create index if not exists notifications_kind_created_idx
  on public.notifications (kind, created_at desc);

-- Replace the existing post analytics trigger body so every post gets
-- post_created while the first post remains a one-time funnel milestone.
create or replace function private.analytics_post_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(
    new.user_id,
    'post_created',
    jsonb_build_object('post_id', new.id, 'media_type', new.media_type),
    'server'
  );

  if not exists (
    select 1 from public.analytics_events
    where user_id = new.user_id and event_name = 'first_post_created'
  ) then
    perform private.track_event(
      new.user_id,
      'first_post_created',
      jsonb_build_object('post_id', new.id),
      'server'
    );
  end if;

  return new;
end;
$$;

create or replace function private.analytics_direct_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform private.track_event(
    new.sender_id,
    'message_sent',
    jsonb_build_object(
      'receiver_id', new.receiver_id,
      'conversation_id', new.conversation_id,
      'media_type', new.media_type,
      'reply_to_story', coalesce(new.reply_to_story, false)
    ),
    'server'
  );

  return new;
end;
$$;

revoke all on function private.analytics_direct_message_insert() from public;

drop trigger if exists direct_messages_after_insert_analytics on public.direct_messages;
create trigger direct_messages_after_insert_analytics
  after insert on public.direct_messages
  for each row execute function private.analytics_direct_message_insert();

create or replace function private.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_kind text := 'new_message';
  v_body text;
begin
  if new.receiver_id is null or new.sender_id is null or new.receiver_id = new.sender_id then
    return new;
  end if;

  if coalesce(new.reply_to_story, false) and new.story_id is not null then
    v_kind := 'story_reply';
  end if;

  v_body := nullif(trim(coalesce(new.body, '')), '');
  if v_body is null and new.media_type = 'video' then
    v_body := 'Vídeo enviado';
  elsif v_body is null and new.media_url is not null then
    v_body := 'Foto enviada';
  end if;

  insert into public.notifications (user_id, actor_id, kind, story_id, body)
  values (new.receiver_id, new.sender_id, v_kind, new.story_id, left(v_body, 140));

  return new;
end;
$$;

revoke all on function private.notify_direct_message() from public;

drop trigger if exists direct_messages_after_insert_notify on public.direct_messages;
create trigger direct_messages_after_insert_notify
  after insert on public.direct_messages
  for each row execute function private.notify_direct_message();

create or replace function private.notify_new_story()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, story_id)
  select f.follower_id, new.user_id, 'new_story', new.id
    from public.follows f
   where f.following_id = new.user_id
     and f.status = 'accepted'
     and f.follower_id <> new.user_id
     and not private.has_block_between(f.follower_id, new.user_id);

  return new;
end;
$$;

revoke all on function private.notify_new_story() from public;

drop trigger if exists stories_after_insert_notify_followers on public.stories;
create trigger stories_after_insert_notify_followers
  after insert on public.stories
  for each row execute function private.notify_new_story();

create or replace function private.notify_training_today()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce(new.has_photo, false) then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, kind, body)
  select
    f.follower_id,
    new.user_id,
    'training_today',
    'treinou hoje'
  from public.follows f
  where f.following_id = new.user_id
    and f.status = 'accepted'
    and f.follower_id <> new.user_id
    and not private.has_block_between(f.follower_id, new.user_id);

  return new;
end;
$$;

revoke all on function private.notify_training_today() from public;

drop trigger if exists user_activity_days_after_insert_notify_followers
  on public.user_activity_days;
create trigger user_activity_days_after_insert_notify_followers
  after insert on public.user_activity_days
  for each row execute function private.notify_training_today();

comment on function private.notify_direct_message() is
  'Creates in-app notifications for new Direct messages and story replies.';

comment on function private.notify_new_story() is
  'Creates follower notifications when a followed user posts a story.';

comment on function private.notify_training_today() is
  'Creates follower notifications when a user lights their daily circle.';
