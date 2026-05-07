-- =====================================================================
-- Cleanup automático de stories expirados (TTL 24h).
-- pg_cron roda a função 1x por hora, no minuto 5.
-- ---------------------------------------------------------------------
-- Limitação conhecida: Supabase bloqueia DELETE em storage.objects via
-- SQL (trigger protect_delete). O cleanup do bucket 'stories' precisa
-- ser feito via Storage API com service_role key — fica como follow-up
-- numa Edge Function. No fluxo atual o impacto é mínimo porque o adapter
-- reusa a URL do bucket 'posts' como media_url do story.
-- =====================================================================

create extension if not exists pg_cron with schema extensions;

drop function if exists private.cleanup_expired_stories();

create or replace function private.cleanup_expired_stories()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  delete from public.stories where expires_at < now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

comment on function private.cleanup_expired_stories()
  is 'Apaga stories com expires_at < now(). Chamado de hora-em-hora por pg_cron.';

-- Idempotência: remove agendamento antigo se existir
do $$
begin
  if exists (select 1 from cron.job where jobname = 'gym-circle-cleanup-stories') then
    perform cron.unschedule('gym-circle-cleanup-stories');
  end if;
end$$;

select cron.schedule(
  'gym-circle-cleanup-stories',
  '5 * * * *',
  $cron$ select private.cleanup_expired_stories(); $cron$
);
