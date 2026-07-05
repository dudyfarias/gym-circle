-- Defesa explícita: a auditoria de push é somente server-side.
-- Além dos grants revogados, a policy restritiva impede acesso de clientes
-- mesmo se um grant amplo for adicionado por engano no futuro.

drop policy if exists push_delivery_attempts_no_client_access
  on public.push_delivery_attempts;

create policy push_delivery_attempts_no_client_access
  on public.push_delivery_attempts
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);
