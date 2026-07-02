-- Rastreio de treino — fundação: tabela activities + post ligado + streak.
--
-- Uma "activity" é um treino rastreado (ao vivo no app, cronômetro no web, ou
-- importado do Apple Saúde). Ela marca o dia/streak igual a um check-in, e pode
-- virar post via posts.source_activity_id (mesmo padrão do source_checkin_id).
-- Ver spec: docs/superpowers/specs/2026-07-02-workout-tracking-design.md

-- 1) Tabela activities -------------------------------------------------------
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  mode text not null,
  origin text not null,
  source_app text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  elapsed_s integer not null default 0,
  moving_s integer,
  distance_m numeric,
  elevation_gain_m numeric,
  route jsonb,
  splits jsonb,
  avg_hr integer,
  max_hr integer,
  active_calories numeric,
  total_calories numeric,
  workout_date date not null,
  created_at timestamptz not null default now(),
  constraint activities_type_chk check (activity_type in ('strength','run','walk','ride','other')),
  constraint activities_mode_chk check (mode in ('session','route')),
  constraint activities_origin_chk check (origin in ('live','web_timer','imported'))
);

create index if not exists activities_user_date_idx
  on public.activities (user_id, workout_date desc);

alter table public.activities enable row level security;

-- Dono tem acesso total; terceiros só veem via o post (que tem RLS própria).
drop policy if exists activities_select_own on public.activities;
create policy activities_select_own on public.activities
  for select using ((select auth.uid()) = user_id);
drop policy if exists activities_insert_own on public.activities;
create policy activities_insert_own on public.activities
  for insert with check ((select auth.uid()) = user_id);
drop policy if exists activities_update_own on public.activities;
create policy activities_update_own on public.activities
  for update using ((select auth.uid()) = user_id);
drop policy if exists activities_delete_own on public.activities;
create policy activities_delete_own on public.activities
  for delete using ((select auth.uid()) = user_id);

-- 2) posts.source_activity_id (espelha source_checkin_id) --------------------
alter table public.posts
  add column if not exists source_activity_id uuid
    references public.activities(id) on delete set null;

create unique index if not exists posts_source_activity_id_unique_idx
  on public.posts (source_activity_id)
  where source_activity_id is not null;

create or replace function private.validate_post_source_activity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked public.activities%rowtype;
begin
  if new.source_activity_id is null then
    return new;
  end if;
  select * into linked from public.activities where id = new.source_activity_id;
  if not found then
    raise exception 'atividade de origem não encontrada' using errcode = '23503';
  end if;
  if linked.user_id is distinct from new.user_id
     or linked.workout_date is distinct from new.workout_date then
    raise exception 'post e atividade de origem não pertencem ao mesmo treino'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_validate_source_activity on public.posts;
create trigger posts_validate_source_activity
  before insert or update of source_activity_id, user_id, workout_date
  on public.posts
  for each row
  execute function private.validate_post_source_activity();

comment on column public.posts.source_activity_id
  is 'Atividade rastreada que originou este post; evita duplicar o mesmo treino no feed.';

-- 3) Streak: activity marca o dia (espelha on_checkin_inserted) --------------
-- O motor de streak conta DATAS distintas, então activity + check-in no mesmo
-- dia = 1 dia (sem double-count). has_photo=true = "o dia conta".
do $$
declare c_name text;
begin
  select c.conname into c_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'user_activity_days'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%source_type%';
  if c_name is not null then
    execute format('alter table public.user_activity_days drop constraint %I', c_name);
  end if;
end $$;

alter table public.user_activity_days
  add constraint user_activity_days_source_type_check
  check (source_type in ('post', 'story', 'post_participant', 'story_participant', 'checkin', 'activity'));

create or replace function private.on_activity_inserted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
  values (new.user_id, new.workout_date, 'activity', new.id, true)
  on conflict (user_id, activity_date, source_type, source_id) do nothing;
  perform private.recalculate_user_stats(new.user_id);
  return new;
end; $$;

create or replace function private.on_activity_deleted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.user_activity_days where source_type = 'activity' and source_id = old.id;
  perform private.recalculate_user_stats(old.user_id);
  return old;
end; $$;

drop trigger if exists activities_after_insert on public.activities;
create trigger activities_after_insert after insert on public.activities
  for each row execute function private.on_activity_inserted();

drop trigger if exists activities_after_delete on public.activities;
create trigger activities_after_delete after delete on public.activities
  for each row execute function private.on_activity_deleted();
