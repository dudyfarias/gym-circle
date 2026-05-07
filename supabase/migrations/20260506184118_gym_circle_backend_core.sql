-- =====================================================================
-- Gym Circle — Backend Core
-- ---------------------------------------------------------------------
-- Tabelas: profiles, gyms, user_gyms, posts, stories, post_likes,
--          post_comments, follows, checkins, user_activity_days,
--          user_stats.
-- Streak: user_activity_days é fonte da verdade; user_stats é cache
--         atualizado por triggers em posts e stories.
-- Segurança: RLS habilitado em todas as tabelas públicas. Funções
--            SECURITY DEFINER residem no schema `private`, fora da Data API.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext"   with schema extensions;
create extension if not exists "pg_trgm"  with schema extensions;

-- ---------------------------------------------------------------------
-- 2. Schemas
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from anon, authenticated;
grant usage on schema private to postgres;

-- ---------------------------------------------------------------------
-- 3. Tabelas
-- ---------------------------------------------------------------------

-- 3.1 gyms
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

-- 3.2 profiles (1:1 com auth.users)
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

-- 3.3 user_gyms
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

-- garantir no máximo 1 main por usuário
create unique index if not exists user_gyms_one_main_per_user
  on public.user_gyms (user_id) where is_main;

-- 3.4 posts (foto obrigatória)
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

create index if not exists posts_user_created_idx     on public.posts (user_id, created_at desc);
create index if not exists posts_workout_date_idx     on public.posts (workout_date);
create index if not exists posts_created_at_idx       on public.posts (created_at desc);
create index if not exists posts_gym_idx              on public.posts (gym_id);

-- 3.5 stories
create table if not exists public.stories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  media_url     text not null check (length(trim(media_url)) > 0),
  gym_id        uuid references public.gyms(id) on delete set null,
  workout_type  text,
  expires_at    timestamptz not null default (now() + interval '24 hours'),
  created_at    timestamptz not null default now()
);

create index if not exists stories_user_idx        on public.stories (user_id);
create index if not exists stories_active_idx      on public.stories (expires_at);

-- 3.6 post_likes
create table if not exists public.post_likes (
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_likes_user_idx on public.post_likes (user_id);

-- 3.7 post_comments
create table if not exists public.post_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 600),
  created_at  timestamptz not null default now()
);

create index if not exists post_comments_post_idx on public.post_comments (post_id, created_at);

-- 3.8 follows
create table if not exists public.follows (
  follower_id   uuid not null references auth.users(id) on delete cascade,
  following_id  uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

-- 3.9 checkins
create table if not exists public.checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  gym_id        uuid not null references public.gyms(id) on delete cascade,
  checkin_date  date not null default (now() at time zone 'utc')::date,
  created_at    timestamptz not null default now()
);

create index if not exists checkins_user_date_idx on public.checkins (user_id, checkin_date desc);
create index if not exists checkins_gym_date_idx  on public.checkins (gym_id, checkin_date desc);

-- 3.10 user_activity_days (fonte da verdade do streak)
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

-- 3.11 user_stats (cache denormalizado)
create table if not exists public.user_stats (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  current_streak         integer not null default 0,
  best_streak            integer not null default 0,
  workouts_this_month    integer not null default 0,
  active_days_this_year  integer not null default 0,
  last_active_date       date,
  badge_is_active_today  boolean not null default false,
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. Funções de streak (private schema)
-- ---------------------------------------------------------------------
-- A lógica vive aqui:
--   * has_photo é exigido para "acender" o badge.
--   * Múltiplos posts no mesmo dia contam como 1 dia (DISTINCT activity_date).
--   * current_streak ancora em hoje, ou em ontem se hoje não teve atividade.
--   * best_streak é a maior sequência consecutiva já registrada.

create or replace function private.calc_user_stats(p_user_id uuid)
returns table (
  current_streak         integer,
  best_streak            integer,
  workouts_this_month    integer,
  active_days_this_year  integer,
  last_active_date       date,
  badge_is_active_today  boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today              date := (now() at time zone 'utc')::date;
  v_anchor             date;
  v_current_streak     integer := 0;
  v_best_streak        integer := 0;
  v_run                integer := 0;
  v_prev               date;
  v_day                date;
  v_workouts_month     integer := 0;
  v_active_days_year   integer := 0;
  v_last_active        date;
  v_badge_today        boolean := false;
begin
  -- distintos dias com atividade fotográfica para este usuário, ordenados ascendente
  -- usados para best_streak
  v_prev := null;
  for v_day in
    select distinct activity_date
      from public.user_activity_days
     where user_id = p_user_id and has_photo = true
     order by activity_date asc
  loop
    if v_prev is not null and v_day = v_prev + interval '1 day' then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;

    if v_run > v_best_streak then
      v_best_streak := v_run;
    end if;

    v_prev := v_day;
  end loop;

  -- last_active_date
  select max(activity_date) into v_last_active
    from public.user_activity_days
   where user_id = p_user_id and has_photo = true;

  -- badge_is_active_today
  v_badge_today := exists (
    select 1 from public.user_activity_days
     where user_id = p_user_id
       and has_photo = true
       and activity_date = v_today
  );

  -- âncora do current_streak: hoje, ou ontem se hoje não teve atividade
  if v_badge_today then
    v_anchor := v_today;
  else
    v_anchor := v_today - interval '1 day';
  end if;

  -- caminhar para trás a partir da âncora enquanto houver dia consecutivo com atividade
  v_day := v_anchor;
  loop
    if exists (
      select 1 from public.user_activity_days
       where user_id = p_user_id
         and has_photo = true
         and activity_date = v_day
    ) then
      v_current_streak := v_current_streak + 1;
      v_day := v_day - interval '1 day';
    else
      exit;
    end if;
  end loop;

  -- workouts_this_month: dias distintos no mês corrente
  select count(distinct activity_date) into v_workouts_month
    from public.user_activity_days
   where user_id = p_user_id
     and has_photo = true
     and activity_date >= date_trunc('month', v_today)::date
     and activity_date <  (date_trunc('month', v_today) + interval '1 month')::date;

  -- active_days_this_year: dias distintos no ano corrente
  select count(distinct activity_date) into v_active_days_year
    from public.user_activity_days
   where user_id = p_user_id
     and has_photo = true
     and activity_date >= date_trunc('year', v_today)::date
     and activity_date <  (date_trunc('year', v_today) + interval '1 year')::date;

  return query
  select v_current_streak,
         greatest(v_best_streak, v_current_streak),
         v_workouts_month,
         v_active_days_year,
         v_last_active,
         v_badge_today;
end;
$$;

comment on function private.calc_user_stats(uuid)
  is 'Calcula stats de streak do usuário a partir de user_activity_days. Pura, sem efeitos colaterais.';

create or replace function private.recalculate_user_stats(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_stats record;
begin
  select * into v_stats from private.calc_user_stats(p_user_id);

  insert into public.user_stats (
    user_id, current_streak, best_streak, workouts_this_month,
    active_days_this_year, last_active_date, badge_is_active_today, updated_at
  )
  values (
    p_user_id, v_stats.current_streak, v_stats.best_streak, v_stats.workouts_this_month,
    v_stats.active_days_this_year, v_stats.last_active_date, v_stats.badge_is_active_today, now()
  )
  on conflict (user_id) do update set
    current_streak        = excluded.current_streak,
    best_streak           = excluded.best_streak,
    workouts_this_month   = excluded.workouts_this_month,
    active_days_this_year = excluded.active_days_this_year,
    last_active_date      = excluded.last_active_date,
    badge_is_active_today = excluded.badge_is_active_today,
    updated_at            = now();
end;
$$;

comment on function private.recalculate_user_stats(uuid)
  is 'Persiste o snapshot calculado em user_stats. Chamada por triggers de posts/stories.';

-- API pública leve: usuários autenticados podem forçar recálculo do próprio stats.
create or replace function public.refresh_my_stats()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'auth.uid() is null';
  end if;
  perform private.recalculate_user_stats(auth.uid());
end;
$$;

revoke all on function public.refresh_my_stats() from public, anon;
grant execute on function public.refresh_my_stats() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Triggers de atividade
-- ---------------------------------------------------------------------

-- 5.1 posts -> user_activity_days
create or replace function private.on_post_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
  values (new.user_id, new.workout_date, 'post', new.id, length(trim(new.image_url)) > 0)
  on conflict (user_id, activity_date, source_type, source_id) do nothing;

  perform private.recalculate_user_stats(new.user_id);
  return new;
end;
$$;

create or replace function private.on_post_deleted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.user_activity_days
   where source_type = 'post' and source_id = old.id;

  perform private.recalculate_user_stats(old.user_id);
  return old;
end;
$$;

drop trigger if exists posts_after_insert on public.posts;
create trigger posts_after_insert
  after insert on public.posts
  for each row execute function private.on_post_inserted();

drop trigger if exists posts_after_delete on public.posts;
create trigger posts_after_delete
  after delete on public.posts
  for each row execute function private.on_post_deleted();

-- 5.2 stories -> user_activity_days
create or replace function private.on_story_inserted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_activity_date date := (new.created_at at time zone 'utc')::date;
begin
  insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
  values (new.user_id, v_activity_date, 'story', new.id, length(trim(new.media_url)) > 0)
  on conflict (user_id, activity_date, source_type, source_id) do nothing;

  perform private.recalculate_user_stats(new.user_id);
  return new;
end;
$$;

create or replace function private.on_story_deleted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.user_activity_days
   where source_type = 'story' and source_id = old.id;

  perform private.recalculate_user_stats(old.user_id);
  return old;
end;
$$;

drop trigger if exists stories_after_insert on public.stories;
create trigger stories_after_insert
  after insert on public.stories
  for each row execute function private.on_story_inserted();

drop trigger if exists stories_after_delete on public.stories;
create trigger stories_after_delete
  after delete on public.stories
  for each row execute function private.on_story_deleted();

-- 5.3 auth.users -> profiles + user_stats automático
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_username text;
  v_display  text;
  v_base     text;
  v_attempt  integer := 0;
begin
  v_base := lower(coalesce(
    new.raw_user_meta_data->>'username',
    split_part(coalesce(new.email, ''), '@', 1),
    'user'
  ));
  v_base := regexp_replace(v_base, '[^a-z0-9_.]', '', 'g');
  if length(v_base) < 3 then
    v_base := 'user_' || substr(new.id::text, 1, 6);
  end if;
  v_username := substr(v_base, 1, 32);

  -- garantir unicidade do username
  while exists (select 1 from public.profiles where username = v_username) and v_attempt < 20 loop
    v_attempt := v_attempt + 1;
    v_username := substr(v_base, 1, 28) || '_' || substr(md5(random()::text), 1, 3);
  end loop;

  v_display := coalesce(
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'name',
    initcap(replace(v_base, '_', ' '))
  );

  insert into public.profiles (user_id, username, display_name, avatar_url)
  values (new.id, v_username, v_display, new.raw_user_meta_data->>'avatar_url')
  on conflict (user_id) do nothing;

  insert into public.user_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------
-- Política geral: leitura aberta para conteúdo social, escrita restrita ao dono.
-- Stats e activity_days: leitura aberta (badge é status público), escrita só via triggers.

alter table public.gyms                enable row level security;
alter table public.profiles            enable row level security;
alter table public.user_gyms           enable row level security;
alter table public.posts               enable row level security;
alter table public.stories             enable row level security;
alter table public.post_likes          enable row level security;
alter table public.post_comments       enable row level security;
alter table public.follows             enable row level security;
alter table public.checkins            enable row level security;
alter table public.user_activity_days  enable row level security;
alter table public.user_stats          enable row level security;

-- 6.1 gyms (catálogo público)
drop policy if exists "gyms_select_all"    on public.gyms;
drop policy if exists "gyms_insert_authed" on public.gyms;
create policy "gyms_select_all"    on public.gyms for select to anon, authenticated using (true);
create policy "gyms_insert_authed" on public.gyms for insert to authenticated with check (true);

-- 6.2 profiles
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_self"   on public.profiles;
drop policy if exists "profiles_update_self"   on public.profiles;
create policy "profiles_select_public" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6.3 user_gyms
drop policy if exists "user_gyms_select_all"   on public.user_gyms;
drop policy if exists "user_gyms_insert_self"  on public.user_gyms;
drop policy if exists "user_gyms_update_self"  on public.user_gyms;
drop policy if exists "user_gyms_delete_self"  on public.user_gyms;
create policy "user_gyms_select_all"  on public.user_gyms for select to anon, authenticated using (true);
create policy "user_gyms_insert_self" on public.user_gyms for insert to authenticated with check (auth.uid() = user_id);
create policy "user_gyms_update_self" on public.user_gyms for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_gyms_delete_self" on public.user_gyms for delete to authenticated using (auth.uid() = user_id);

-- 6.4 posts
drop policy if exists "posts_select_all"    on public.posts;
drop policy if exists "posts_insert_self"   on public.posts;
drop policy if exists "posts_update_self"   on public.posts;
drop policy if exists "posts_delete_self"   on public.posts;
create policy "posts_select_all"  on public.posts for select to anon, authenticated using (true);
create policy "posts_insert_self" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "posts_update_self" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts_delete_self" on public.posts for delete to authenticated using (auth.uid() = user_id);

-- 6.5 stories
drop policy if exists "stories_select_active" on public.stories;
drop policy if exists "stories_insert_self"   on public.stories;
drop policy if exists "stories_delete_self"   on public.stories;
create policy "stories_select_active" on public.stories
  for select to anon, authenticated using (expires_at > now() or auth.uid() = user_id);
create policy "stories_insert_self" on public.stories
  for insert to authenticated with check (auth.uid() = user_id);
create policy "stories_delete_self" on public.stories
  for delete to authenticated using (auth.uid() = user_id);

-- 6.6 post_likes
drop policy if exists "post_likes_select_all"   on public.post_likes;
drop policy if exists "post_likes_insert_self"  on public.post_likes;
drop policy if exists "post_likes_delete_self"  on public.post_likes;
create policy "post_likes_select_all"  on public.post_likes for select to anon, authenticated using (true);
create policy "post_likes_insert_self" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "post_likes_delete_self" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

-- 6.7 post_comments
drop policy if exists "post_comments_select_all"   on public.post_comments;
drop policy if exists "post_comments_insert_self"  on public.post_comments;
drop policy if exists "post_comments_update_self"  on public.post_comments;
drop policy if exists "post_comments_delete_self"  on public.post_comments;
create policy "post_comments_select_all"  on public.post_comments for select to anon, authenticated using (true);
create policy "post_comments_insert_self" on public.post_comments for insert to authenticated with check (auth.uid() = user_id);
create policy "post_comments_update_self" on public.post_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "post_comments_delete_self" on public.post_comments for delete to authenticated using (auth.uid() = user_id);

-- 6.8 follows
drop policy if exists "follows_select_all"      on public.follows;
drop policy if exists "follows_insert_self"     on public.follows;
drop policy if exists "follows_delete_self"     on public.follows;
create policy "follows_select_all"  on public.follows for select to anon, authenticated using (true);
create policy "follows_insert_self" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "follows_delete_self" on public.follows for delete to authenticated using (auth.uid() = follower_id);

-- 6.9 checkins
drop policy if exists "checkins_select_all"     on public.checkins;
drop policy if exists "checkins_insert_self"    on public.checkins;
drop policy if exists "checkins_delete_self"    on public.checkins;
create policy "checkins_select_all"  on public.checkins for select to anon, authenticated using (true);
create policy "checkins_insert_self" on public.checkins for insert to authenticated with check (auth.uid() = user_id);
create policy "checkins_delete_self" on public.checkins for delete to authenticated using (auth.uid() = user_id);

-- 6.10 user_activity_days (somente leitura via API; gravação via triggers SECURITY DEFINER)
drop policy if exists "uad_select_all" on public.user_activity_days;
create policy "uad_select_all" on public.user_activity_days
  for select to anon, authenticated using (true);

-- 6.11 user_stats (somente leitura via API; gravação via triggers SECURITY DEFINER)
drop policy if exists "user_stats_select_all" on public.user_stats;
create policy "user_stats_select_all" on public.user_stats
  for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- 7. Storage buckets e policies
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('posts',    'posts',    true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('stories',  'stories',  true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('avatars',  'avatars',  true)
  on conflict (id) do nothing;

-- Padrão de path: <user_id>/<arquivo>. As policies validam com auth.uid().
-- Lembrete da skill: upsert exige INSERT + SELECT + UPDATE.

drop policy if exists "Public read posts"    on storage.objects;
drop policy if exists "Public read stories"  on storage.objects;
drop policy if exists "Public read avatars"  on storage.objects;
drop policy if exists "Owner upload posts"   on storage.objects;
drop policy if exists "Owner upload stories" on storage.objects;
drop policy if exists "Owner upload avatars" on storage.objects;
drop policy if exists "Owner update posts"   on storage.objects;
drop policy if exists "Owner update stories" on storage.objects;
drop policy if exists "Owner update avatars" on storage.objects;
drop policy if exists "Owner delete posts"   on storage.objects;
drop policy if exists "Owner delete stories" on storage.objects;
drop policy if exists "Owner delete avatars" on storage.objects;

create policy "Public read posts"
  on storage.objects for select to anon, authenticated using (bucket_id = 'posts');
create policy "Public read stories"
  on storage.objects for select to anon, authenticated using (bucket_id = 'stories');
create policy "Public read avatars"
  on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');

create policy "Owner upload posts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner upload stories"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner upload avatars"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owner update posts"
  on storage.objects for update to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner update stories"
  on storage.objects for update to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner update avatars"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owner delete posts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'posts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner delete stories"
  on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner delete avatars"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 8. Realtime
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.stories;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.checkins;
alter publication supabase_realtime add table public.user_stats;

-- ---------------------------------------------------------------------
-- 9. Grants para Data API
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.gyms, public.profiles, public.user_gyms,
                public.posts, public.stories, public.post_likes,
                public.post_comments, public.follows, public.checkins,
                public.user_activity_days, public.user_stats
  to anon, authenticated;

grant insert, update, delete on public.profiles to authenticated;
grant insert, update, delete on public.user_gyms to authenticated;
grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.stories to authenticated;
grant insert, delete on public.post_likes to authenticated;
grant insert, update, delete on public.post_comments to authenticated;
grant insert, delete on public.follows to authenticated;
grant insert, delete on public.checkins to authenticated;
grant insert on public.gyms to authenticated;

-- user_activity_days e user_stats só são gravados via triggers SECURITY DEFINER

-- ---------------------------------------------------------------------
-- 10. View de feed enriquecido (com security_invoker para respeitar RLS)
-- ---------------------------------------------------------------------
create or replace view public.feed_posts
with (security_invoker = true)
as
  select
    p.id,
    p.user_id,
    p.image_url,
    p.caption,
    p.gym_id,
    p.workout_type,
    p.workout_date,
    p.created_at,
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
  left join public.user_stats us on us.user_id = p.user_id
  left join lateral (
    select count(*)::int as likes_count from public.post_likes pl where pl.post_id = p.id
  ) l on true
  left join lateral (
    select count(*)::int as comments_count from public.post_comments pc where pc.post_id = p.id
  ) c on true;

grant select on public.feed_posts to anon, authenticated;

-- ---------------------------------------------------------------------
-- 11. Comments
-- ---------------------------------------------------------------------
comment on table public.profiles            is 'Perfil público do usuário (1:1 com auth.users).';
comment on table public.gyms                is 'Catálogo de academias.';
comment on table public.user_gyms           is 'Vínculos academia<->usuário com preferências de horário.';
comment on table public.posts               is 'Posts de treino. Imagem obrigatória.';
comment on table public.stories             is 'Stories efêmeros (24h) que também acendem o badge.';
comment on table public.post_likes          is 'Curtidas em posts.';
comment on table public.post_comments       is 'Comentários em posts.';
comment on table public.follows             is 'Grafo de follows (follower -> following).';
comment on table public.checkins            is 'Presença social em uma academia (não acende badge sozinho).';
comment on table public.user_activity_days  is 'Fonte da verdade do streak: 1 linha por (usuário, dia, fonte).';
comment on table public.user_stats          is 'Cache denormalizado de streak/atividade. Atualizado por triggers.';
