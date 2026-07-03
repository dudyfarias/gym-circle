-- Explicit deny policy documents that cleanup history is server-only and also
-- keeps the RLS advisor quiet; service_role bypasses RLS for the Edge Function.
drop policy if exists media_cleanup_runs_deny_clients
  on public.media_cleanup_runs;
create policy media_cleanup_runs_deny_clients
  on public.media_cleanup_runs
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Existing FK surfaced while validating the new schema. Cleanup and activity
-- mutations should not need a full activities scan when a gym is changed.
create index if not exists activities_gym_id_idx
  on public.activities (gym_id);
