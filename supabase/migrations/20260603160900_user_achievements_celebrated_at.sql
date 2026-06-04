-- Sprint 7.5.11 — Achievement Celebration Overlay tracking.
--
-- Coluna `celebrated_at` distingue achievements que JÁ apareceram em
-- celebration overlay (não disparar de novo) de achievements NOVOS
-- (aparecer no próximo boot).
--
-- Pipeline:
--   1. INSERT em user_achievements (backfill ou trigger natural)
--   2. Frontend query: WHERE user_id=me AND celebrated_at IS NULL
--   3. Mostra overlay pra cada → user tap "Continuar"
--   4. UPDATE celebrated_at = now() pelo composite ID
--
-- Pré-celebração de tudo existente: setar celebrated_at = earned_at
-- pra TODOS rows atuais. Sem isso, primeiro boot pós-deploy ia
-- explodir N overlays pra achievements antigos (UX ruim).

alter table public.user_achievements
  add column if not exists celebrated_at timestamptz;

-- Backfill: tudo que existe AGORA é considerado pré-celebrado.
-- Próximos earnings (post-deploy) chegam com celebrated_at = null
-- e disparam o overlay.
update public.user_achievements
  set celebrated_at = earned_at
  where celebrated_at is null;

create index if not exists user_achievements_uncelebrated
  on public.user_achievements (user_id)
  where celebrated_at is null;

comment on column public.user_achievements.celebrated_at is
  'Sprint 7.5.11 — quando user dispensou o celebration overlay. NULL = ainda não celebrou (entra na queue). Backfill inicial setou pra earned_at em todos os existentes.';
