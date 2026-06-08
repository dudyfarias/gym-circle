-- =====================================================================
-- Sprint 9.9.9 — Advisor cleanup (8 jun 2026)
--
--   (a) 5 RLS policies trocam auth.uid() por (select auth.uid())
--       Evita re-eval por row em user_monthly_challenge_progress + user_achievements.
--   (b) Multiple permissive policies dedup em reports + user_blocks
--       _self_admin já cobre _self via OR — drop sem perda de acesso.
--   (c) 11 FK indexes covering pra performance de join/lookups
--
-- Aplicada via Supabase MCP em 2026-06-08. Arquivo local registrado pra
-- manter histórico de migrations sincronizado.
-- =====================================================================

-- ---------- (a) RLS initplan fix ----------
-- Substitui auth.uid() por (select auth.uid()) pra evitar re-evaluation
-- por row. Reference: lint 0003_auth_rls_initplan.

DROP POLICY IF EXISTS ump_progress_own_read ON public.user_monthly_challenge_progress;
CREATE POLICY ump_progress_own_read ON public.user_monthly_challenge_progress
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ump_progress_own_update ON public.user_monthly_challenge_progress;
CREATE POLICY ump_progress_own_update ON public.user_monthly_challenge_progress
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ump_progress_own_write ON public.user_monthly_challenge_progress;
CREATE POLICY ump_progress_own_write ON public.user_monthly_challenge_progress
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS user_achievements_own_insert ON public.user_achievements;
CREATE POLICY user_achievements_own_insert ON public.user_achievements
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS user_achievements_own_update ON public.user_achievements;
CREATE POLICY user_achievements_own_update ON public.user_achievements
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- (b) Multiple permissive policies dedup ----------
-- Lint 0006_multiple_permissive_policies. _self_admin já contém o OR
-- com (SELECT auth.uid()) = reporter_id/blocker_id, então cobre 100%
-- do que _self cobria + admin.

DROP POLICY IF EXISTS reports_select_own ON public.reports;
DROP POLICY IF EXISTS user_blocks_select_self ON public.user_blocks;

-- ---------- (c) FK indexes covering ----------
-- Lint 0001_unindexed_foreign_keys. Joins / cascade deletes em FKs sem
-- index causam scans completos das child tables.

CREATE INDEX IF NOT EXISTS conversations_created_by_idx
  ON public.conversations (created_by);

CREATE INDEX IF NOT EXISTS notifications_actor_id_idx
  ON public.notifications (actor_id);

CREATE INDEX IF NOT EXISTS notifications_post_id_idx
  ON public.notifications (post_id);

CREATE INDEX IF NOT EXISTS notifications_comment_id_idx
  ON public.notifications (comment_id);

CREATE INDEX IF NOT EXISTS post_participants_tagged_by_user_idx
  ON public.post_participants (tagged_by_user_id);

CREATE INDEX IF NOT EXISTS reports_post_id_idx
  ON public.reports (post_id);

CREATE INDEX IF NOT EXISTS reports_reported_user_id_idx
  ON public.reports (reported_user_id);

CREATE INDEX IF NOT EXISTS reports_story_id_idx
  ON public.reports (story_id);

CREATE INDEX IF NOT EXISTS story_participants_tagged_by_user_idx
  ON public.story_participants (tagged_by_user_id);

CREATE INDEX IF NOT EXISTS streak_restored_days_restore_event_idx
  ON public.streak_restored_days (restore_event_id);

CREATE INDEX IF NOT EXISTS user_monthly_challenge_progress_challenge_idx
  ON public.user_monthly_challenge_progress (challenge_id);
