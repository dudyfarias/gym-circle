-- Sprint 7.5.1 — Histórico de quando cada user ganhou cada achievement.
--
-- Usado pra mostrar "Conquistado: 08/05/2026" e "Total: 29 vezes" no
-- AchievementDetailOverlay (Apple Fitness style — Section 15 do brief).
--
-- achievement_id formato composite: "kind:id" (ex: "badge:first-workout",
-- "trophy:perfect-month", "challenge:projeto-verao-2026-06"). String em
-- vez de FK porque achievements das categorias badge/medal/trophy/relic
-- são derivadas de código (não há tabela "achievements" master). Só
-- challenges têm FK direta via metadata.
--
-- count: quantas vezes o user ganhou. Pra achievements one-shot (badges,
-- relíquias) fica 1. Pra achievements repetíveis ("Mês Perfeito" — pode
-- ganhar todo mês) incrementa.
--
-- RLS: público READ (pra mostrar achievements em perfis de outros users),
-- WRITE só próprio user (o backfill no boot).

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  earned_at timestamptz not null default now(),
  count integer not null default 1 check (count >= 1),
  last_earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  primary key (user_id, achievement_id)
);

create index user_achievements_user_recent
  on public.user_achievements(user_id, last_earned_at desc);

create index user_achievements_achievement
  on public.user_achievements(achievement_id);

comment on table public.user_achievements is
  'Sprint 7.5 — histórico de quando cada user ganhou cada achievement. achievement_id formato "kind:id". Usado pra timestamps + counts no detail screen.';

alter table public.user_achievements enable row level security;

create policy "user_achievements_public_read"
  on public.user_achievements
  for select
  to authenticated, anon
  using (true);

create policy "user_achievements_own_insert"
  on public.user_achievements
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_achievements_own_update"
  on public.user_achievements
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
