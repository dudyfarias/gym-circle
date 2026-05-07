-- =====================================================================
-- Cleanup automático de stories expirados.
-- Job hora-em-hora: apaga linhas em public.stories e arquivos no bucket
-- 'stories' que passaram do TTL de 24h.
-- =====================================================================

create extension if not exists pg_cron with schema extensions;

create or replace function private.cleanup_expired_stories()
returns void
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  -- 1. Apaga linhas em public.stories cujo TTL passou
  delete from public.stories where expires_at < now();

  -- 2. Apaga arquivos no bucket 'stories' com mais de 24h
  --    (no fluxo atual, raramente há arquivos nesse bucket porque o adapter
  --    reusa a URL do bucket 'posts'. Cobre o caso futuro de uploads diretos.)
  delete from storage.objects
   where bucket_id = 'stories'
     and created_at < now() - interval '24 hours';
end;
$$;

comment on function private.cleanup_expired_stories()
  is 'Apaga stories expirados (>24h) e arquivos órfãos no bucket stories. Chamado por pg_cron.';

-- Remove job antigo se existir (idempotência) e agenda
select cron.unschedule('gym-circle-cleanup-stories')
 where exists (select 1 from cron.job where jobname = 'gym-circle-cleanup-stories');

select cron.schedule(
  'gym-circle-cleanup-stories',
  '5 * * * *',  -- 5min depois de cada hora cheia
  $cron$ select private.cleanup_expired_stories(); $cron$
);;
