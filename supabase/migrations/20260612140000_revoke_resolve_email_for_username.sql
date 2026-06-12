-- Sprint 21.2 (parte 2) — fecha o advisor 0028: anon não resolve mais
-- username → e-mail. O login por username agora passa pela Edge Function
-- login-with-username (e-mail resolvido com service role, nunca devolvido).
--
-- A função fica no schema por janela de rollback (re-grant é 1 comando),
-- mas sem EXECUTE pra nenhum role de cliente.
--
-- ATENÇÃO ordem de rollout: aplicar SÓ depois do deploy do cliente novo
-- (commit 2dee10e) estar em produção — bundle antigo cacheado em PWA/shell
-- ainda chama o RPC e falharia login por username até recarregar.

revoke execute on function public.resolve_email_for_username(text)
  from public, anon, authenticated;
