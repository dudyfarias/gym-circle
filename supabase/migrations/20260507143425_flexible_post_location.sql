-- =====================================================================
-- Gym Circle — Post flexível: mídia obrigatória, tipo/local opcionais
-- ---------------------------------------------------------------------
-- Produto:
-- - A única coisa obrigatória no post é mídia: foto ou vídeo.
-- - Tipo de treino é opcional.
-- - Local é opcional e pode apontar para Google Maps sem precisar ser uma
--   academia cadastrada no Gym Circle.
-- =====================================================================

alter table public.posts
  add column if not exists media_type text not null default 'image',
  add column if not exists location_source text not null default 'none',
  add column if not exists location_name text,
  add column if not exists location_latitude double precision,
  add column if not exists location_longitude double precision,
  add column if not exists location_google_maps_url text;

alter table public.posts
  alter column workout_type drop not null;

alter table public.posts
  drop constraint if exists posts_workout_type_check,
  drop constraint if exists posts_media_type_check,
  drop constraint if exists posts_location_source_check;

alter table public.posts
  add constraint posts_workout_type_check
    check (workout_type is null or length(trim(workout_type)) > 0),
  add constraint posts_media_type_check
    check (media_type in ('image', 'video')),
  add constraint posts_location_source_check
    check (location_source in ('none', 'gym', 'current', 'custom'));

alter table public.stories
  add column if not exists media_type text not null default 'image';

alter table public.stories
  drop constraint if exists stories_media_type_check;

alter table public.stories
  add constraint stories_media_type_check
    check (media_type in ('image', 'video'));

drop view if exists public.feed_posts;

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
    coalesce(l.likes_count, 0)    as likes_count,
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
  left join public.user_stats us on us.user_id = p.user_id
  left join lateral (
    select count(*)::int as likes_count from public.post_likes pl where pl.post_id = p.id
  ) l on true
  left join lateral (
    select count(*)::int as comments_count from public.post_comments pc where pc.post_id = p.id
  ) c on true;

grant select on public.feed_posts to anon, authenticated;
