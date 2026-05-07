-- =====================================================================
-- Gym Circle — Backend Core
-- =====================================================================

-- 1. Extensions
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext"   with schema extensions;
create extension if not exists "pg_trgm"  with schema extensions;

-- 2. Schemas
create schema if not exists private;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres;

-- 3. Tabelas
create table if not exists public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  address     text,
  city        text,
  state       text,
  latitude    double precision,
  longitude   double precision,
  created_at  timestamptz not null default now()
);
create index if not exists gyms_city_idx     on public.gyms (city);
create index if not exists gyms_name_trgm_idx on public.gyms using gin (lower(name) extensions.gin_trgm_ops);

create table if not exists public.profiles (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null unique references auth.users(id) on delete cascade,
  username                  citext not null unique check (length(username) between 3 and 32 and username ~ '^[a-z0-9_.]+$'),
  display_name              text not null check (length(trim(display_name)) > 0),
  avatar_url                text,
  bio                       text,
  fitness_goal              text,
  main_gym_id               uuid references public.gyms(id) on delete set null,
  preferred_training_times  text[] not null default '{}',
  is_private                boolean not null default false,
  created_at                timestamptz not null default now()
);
create index if not exists profiles_main_gym_idx on public.profiles (main_gym_id);

create table if not exists public.user_gyms (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  gym_id           uuid not null references public.gyms(id) on delete cascade,
  is_main          boolean not null default false,
  preferred_days   text[] not null default '{}',
  preferred_times  text[] not null default '{}',
  created_at       timestamptz not null default now(),
  unique (user_id, gym_id)
);
create index if not exists user_gyms_user_idx on public.user_gyms (user_id);
create index if not exists user_gyms_gym_idx  on public.user_gyms (gym_id);
create unique index if not exists user_gyms_one_main_per_user on public.user_gyms (user_id) where is_main;

create table if not exists public.posts (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  image_url         text not null check (length(trim(image_url)) > 0),
  caption           text,
  gym_id            uuid references public.gyms(id) on delete set null,
  workout_type      text not null check (length(trim(workout_type)) > 0),
  workout_date      date not null default (now() at time zone 'utc')::date,
  is_story_source   boolean not null default true,
  created_at        timestamptz not null default now()
);
create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);
create index if not exists posts_workout_date_idx on public.posts (workout_date);
create index if not exists posts_created_at_idx   on public.posts (created_at desc);
create index if not exists posts_gym_idx          on public.posts (gym_id);

create table if not exists public.stories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  media_url     text not null check (length(trim(media_url)) > 0),
  gym_id        uuid references public.gyms(id) on delete set null,
  workout_type  text,
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);
create index if not exists stories_user_idx   on public.stories (user_id);
create index if not exists stories_active_idx on public.stories (expires_at);

create table if not exists public.post_likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_likes_user_idx on public.post_likes (user_id);

create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 600),
  created_at  timestamptz not null default now()
);
create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

create table if not exists public.follows (
  follower_id   uuid not null references auth.users(id) on delete cascade,
  following_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);

create table if not exists public.checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  checkin_date  date not null default (now() at time zone 'utc')::date,
  created_at    timestamptz not null default now()
);
create index if not exists checkins_user_date_idx on public.checkins (user_id, checkin_date desc);
create index if not exists checkins_gym_date_idx  on public.checkins (gym_id, checkin_date desc);

create table if not exists public.user_activity_days (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  activity_date  date not null,
  source_type    text not null check (source_type in ('post','story')),
  source_id      uuid not null,
  has_photo      boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (user_id, activity_date, source_type, source_id)
);
create index if not exists user_activity_days_user_date_idx on public.user_activity_days (user_id, activity_date);

create table if not exists public.user_stats (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  current_streak         integer not null default 0,
  best_streak            integer not null default 0,
  workouts_this_month    integer not null default 0,
  active_days_this_year  integer not null default 0,
  last_active_date       date,
  badge_is_active_today  boolean not null default false,
  updated_at             timestamptz not null default now()
);;
