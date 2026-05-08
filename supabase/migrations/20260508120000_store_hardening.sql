-- =====================================================================
-- Hardening pré-app-store
-- - gyms_insert_authed: era WITH CHECK (true). Agora exige profile criado
--   e tamanhos mínimos sensatos pra evitar spam.
-- - chat-media bucket: removido SELECT amplo (URL pública não precisa).
-- - Unique index pra prevenir duplicatas case-insensitive de academia.
-- =====================================================================

drop policy if exists "gyms_insert_authed" on public.gyms;
create policy "gyms_insert_authed" on public.gyms
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
       where p.user_id = (select auth.uid())
    )
    and length(trim(name)) >= 3
    and city is not null
    and length(trim(city)) >= 2
  );

create unique index if not exists gyms_unique_name_city
  on public.gyms (lower(trim(name)), lower(trim(coalesce(city, ''))));

drop policy if exists "Public read chat media" on storage.objects;

comment on function public.resolve_email_for_username(text) is
  'Login por @username. Exposto a anon de propósito — RPC retorna apenas o email se o username existir, usado pelo client antes do signInWithPassword. Risco aceito: enumeração de usernames ativos.';

comment on function public.refresh_my_stats() is
  'Força recálculo de user_stats do próprio usuário autenticado. SECURITY DEFINER intencional — checa auth.uid() is null antes de operar.';
