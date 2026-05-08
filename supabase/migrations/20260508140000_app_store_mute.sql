-- =====================================================================
-- App Store readiness — silenciar usuário em stories e feed.
-- Apple Guideline 1.2: além de block/report, oferecer "mute" como
-- alternativa menos drástica é prática esperada de apps de UGC.
--
-- Story mute: o adapter (`useSupabaseSocial.ts`) e o serviço
-- (`packages/core/src/services/stories.ts`) já chamam `story_mutes`
-- com graceful fallback para "table missing". Esta migration
-- finalmente cria a tabela, ativando o feature end-to-end.
--
-- Post mute: novo. Mesma forma de `story_mutes`. Adapter e service
-- vão ser estendidos no mesmo PR.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. story_mutes — A silenciou stories de B
-- ---------------------------------------------------------------------
create table if not exists public.story_mutes (
  user_id        uuid not null references auth.users(id) on delete cascade,
  muted_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

create index if not exists story_mutes_muted_user_idx
  on public.story_mutes (muted_user_id);

alter table public.story_mutes enable row level security;

drop policy if exists "story_mutes_select_self" on public.story_mutes;
drop policy if exists "story_mutes_insert_self" on public.story_mutes;
drop policy if exists "story_mutes_delete_self" on public.story_mutes;

create policy "story_mutes_select_self" on public.story_mutes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "story_mutes_insert_self" on public.story_mutes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "story_mutes_delete_self" on public.story_mutes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.story_mutes to authenticated;

-- Realtime: precisa estar na publicação supabase_realtime
-- pra que o `.on('postgres_changes', { table: 'story_mutes' })` no
-- adapter receba eventos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'story_mutes'
  ) then
    alter publication supabase_realtime add table public.story_mutes;
  end if;
end $$;

comment on table public.story_mutes is
  'A silenciou stories de B. Usado pra esconder bubbles do tray de stories sem deixar de seguir.';

-- ---------------------------------------------------------------------
-- 2. post_mutes — A silenciou posts de B no feed
-- ---------------------------------------------------------------------
create table if not exists public.post_mutes (
  user_id        uuid not null references auth.users(id) on delete cascade,
  muted_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

create index if not exists post_mutes_muted_user_idx
  on public.post_mutes (muted_user_id);

alter table public.post_mutes enable row level security;

drop policy if exists "post_mutes_select_self" on public.post_mutes;
drop policy if exists "post_mutes_insert_self" on public.post_mutes;
drop policy if exists "post_mutes_delete_self" on public.post_mutes;

create policy "post_mutes_select_self" on public.post_mutes
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "post_mutes_insert_self" on public.post_mutes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "post_mutes_delete_self" on public.post_mutes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.post_mutes to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_mutes'
  ) then
    alter publication supabase_realtime add table public.post_mutes;
  end if;
end $$;

comment on table public.post_mutes is
  'A silenciou posts de B no feed. B continua aparecendo em stories e na busca.';
