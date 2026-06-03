-- Sprint 7.5.1 — Definições centralizadas dos desafios mensais exclusivos.
--
-- Cada linha representa UM desafio de UM mês com uma dificuldade específica.
-- Combinação (period_key, difficulty) é única — não há dois desafios "fácil"
-- no mesmo mês.
--
-- Quem ganha mantém pra sempre via user_monthly_challenge_progress. Quem
-- perde não recupera — a row aqui não muda mas user.completed_at fica null.

create table public.monthly_challenges (
  id uuid primary key default gen_random_uuid(),
  period_key text not null, -- "YYYY-MM"
  title_pt text not null,
  title_en text not null,
  description_pt text not null,
  description_en text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'legendary')),
  goal_kind text not null check (goal_kind in ('workouts_in_month', 'streak_in_month', 'perfect_month', 'group_workouts', 'distinct_types')),
  goal_target integer not null check (goal_target > 0),
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  trophy_id text not null, -- composite "trophy:projeto-verao-2026-06" — sem FK pra evitar referência circular
  created_at timestamptz not null default now()
);

create unique index monthly_challenges_period_difficulty
  on public.monthly_challenges(period_key, difficulty);

create index monthly_challenges_active_period
  on public.monthly_challenges(period_key);

comment on table public.monthly_challenges is
  'Sprint 7.5 — definições centralizadas de desafios mensais. Cada mês tem 4 (easy/medium/hard/legendary). Combinação period_key + difficulty é única.';

-- RLS: público READ (todos veem quais desafios existem), nenhum WRITE (gerenciado server-side)
alter table public.monthly_challenges enable row level security;

create policy "monthly_challenges_public_read"
  on public.monthly_challenges
  for select
  to authenticated, anon
  using (true);
