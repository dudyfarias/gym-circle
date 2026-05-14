-- Keep the in-app bell focused on social notifications only.
-- Allowed in the bell:
-- - new follower / follow request
-- - post like / story like
-- - post comment
-- - mention / post tag / story tag
--
-- We intentionally stop follower fan-out notifications for "new story" and
-- "training today" because posting a workout should not spam followers' bell.

drop trigger if exists stories_after_insert_notify_followers on public.stories;
drop trigger if exists user_activity_days_after_insert_notify_followers
  on public.user_activity_days;

delete from public.notifications
 where kind in ('new_story', 'training_today');

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
        'post_tag',
        'story_tag'
      )
    );

comment on table public.notifications is
  'Notificações sociais. O sino do app mostra follow, likes, comentários, menções e marcações; treino/story novo não gera item no sino.';
