-- Agenda reminder diário de atividade.
--
-- Horário: 18:05 America/Sao_Paulo (21:05 UTC).
-- A Edge Function valida x-push-dispatch-secret; o segredo fica no Vault e
-- nunca é versionado na migration.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
    from cron.job
   where jobname = 'gym-circle-daily-activity-reminders';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'gym-circle-daily-activity-reminders',
    '5 21 * * *',
    $job$
      select net.http_post(
        url := 'https://qajjpjmybmqqwflytcpr.supabase.co/functions/v1/send-daily-activity-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-dispatch-secret', (
            select decrypted_secret
              from vault.decrypted_secrets
             where name = 'push_dispatch_secret'
             order by created_at desc
             limit 1
          )
        ),
        body := jsonb_build_object(
          'scheduled', true,
          'limit', 500,
          'time_zone', 'America/Sao_Paulo'
        )
      );
    $job$
  );
end;
$$;
