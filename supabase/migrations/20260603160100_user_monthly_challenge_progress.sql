-- Sprint 7.5.1 — Tracking individual de progresso por user em cada desafio.
--
-- Cada user pode ter MAX 1 row por (user_id, challenge_id). Progress
-- atualizado via lazy-check no boot OU trigger futuro. completed_at
-- preenchido quando progress >= goal_target.
--
-- Pós-fim-do-mês: rows ficam congeladas. Quem completou tem completed_at,
-- quem não tem fica null pra sempre — desafio nunca volta.

create table public.user_monthly_challenge_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.monthly_challenges(id) on delete cascade,
  progress integer not null default 0 check (progress >= 0),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge_id)
);

create index user_monthly_challenge_progress_user
  on public.user_monthly_challenge_progress(user_id);

create index user_monthly_challenge_progress_completed
  on public.user_monthly_challenge_progress(user_id, completed_at)
  where completed_at is not null;

comment on table public.user_monthly_challenge_progress is
  'Sprint 7.5 — progresso de cada user em cada desafio mensal. Quando completed_at != null, user ganhou o troféu exclusivo associado.';

alter table public.user_monthly_challenge_progress enable row level security;

-- User lê só dele
create policy "ump_progress_own_read"
  on public.user_monthly_challenge_progress
  for select
  to authenticated
  using (auth.uid() = user_id);

-- User UPDATE/INSERT só dele (autor da progressão)
create policy "ump_progress_own_write"
  on public.user_monthly_challenge_progress
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ump_progress_own_update"
  on public.user_monthly_challenge_progress
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
