-- =====================================================================
-- Sprint 10.7 — Auto-dispatch de push notifications via trigger
--
-- Quando user_achievements INSERT (novo achievement desbloqueado) ou
-- user_monthly_challenge_progress UPDATE (challenge completed_at sai
-- de NULL pra timestamp), dispara HTTP POST async pro Edge Function
-- send-push.
--
-- pg_net.http_post é assíncrono — não bloqueia o INSERT/UPDATE original.
-- Falhas no dispatch (rede, edge function down) não revertem o write.
--
-- Aplicada via Supabase MCP em 2026-06-08. Arquivo local registrado pra
-- manter histórico de migrations sincronizado.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ---------- (a) Helper function ----------

CREATE OR REPLACE FUNCTION private.dispatch_push(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_data jsonb DEFAULT '{}'::jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_function_url text := 'https://qajjpjmybmqqwflytcpr.functions.supabase.co/send-push';
  v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhampwam15Ym1xcXdmbHl0Y3ByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwOTU5MTksImV4cCI6MjA5MzY3MTkxOX0.mnwXnpMLg38LeBIoQm6gg5dc0EEEZS9F3MFQp7wXm3I';
  v_request_id bigint;
BEGIN
  SELECT extensions.http_post(
    url := v_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'user_id', p_user_id,
      'kind', p_kind,
      'title', p_title,
      'body', p_body,
      'data', p_data
    )
  ) INTO v_request_id;
  RETURN v_request_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION private.dispatch_push(uuid, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------- (b) Trigger: achievement unlock ----------

CREATE OR REPLACE FUNCTION private.notify_achievement_unlock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM private.dispatch_push(
    NEW.user_id,
    'achievement_unlock',
    'Conquista desbloqueada!',
    'Toque pra ver',
    jsonb_build_object('achievement_id', NEW.achievement_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_achievements_after_insert_notify ON public.user_achievements;
CREATE TRIGGER user_achievements_after_insert_notify
  AFTER INSERT ON public.user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_achievement_unlock();

-- ---------- (c) Trigger: challenge completed ----------

CREATE OR REPLACE FUNCTION private.notify_challenge_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR OLD.completed_at IS DISTINCT FROM NEW.completed_at) THEN
    PERFORM private.dispatch_push(
      NEW.user_id,
      'challenge_complete',
      'Desafio mensal completo!',
      'Você completou mais um desafio. Veja o detalhe.',
      jsonb_build_object('challenge_id', NEW.challenge_id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_monthly_challenge_progress_after_update_notify ON public.user_monthly_challenge_progress;
CREATE TRIGGER user_monthly_challenge_progress_after_update_notify
  AFTER UPDATE ON public.user_monthly_challenge_progress
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_challenge_complete();

COMMENT ON FUNCTION private.dispatch_push(uuid, text, text, text, jsonb) IS
  'Sprint 10.7 — fire-and-forget HTTP POST pro Edge Function send-push.';
COMMENT ON FUNCTION private.notify_achievement_unlock() IS
  'Sprint 10.7 — dispara push quando user desbloqueia achievement.';
COMMENT ON FUNCTION private.notify_challenge_complete() IS
  'Sprint 10.7 — dispara push quando user completa challenge mensal.';
