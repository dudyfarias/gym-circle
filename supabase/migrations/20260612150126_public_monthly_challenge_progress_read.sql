-- Gym Circle 1.1 — Hall da Fama social
--
-- Desafios mensais fazem parte do Hall da Fama público do usuário.
-- O progresso pode ser lido por outros usuários autenticados, igual ao
-- histórico em user_achievements, mas escrita continua restrita ao dono.
--
-- Segurança:
-- - não altera INSERT/UPDATE;
-- - não expõe auth.users;
-- - não libera anon;
-- - mantém RLS habilitado.

drop policy if exists ump_progress_own_read
  on public.user_monthly_challenge_progress;

drop policy if exists ump_progress_authenticated_read
  on public.user_monthly_challenge_progress;

create policy ump_progress_authenticated_read
  on public.user_monthly_challenge_progress
  for select
  to authenticated
  using (true);
