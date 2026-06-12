-- Sprint 16.5 — Hardening: REVOKE de EXECUTE em funções SECURITY DEFINER
-- que os advisors apontaram como executáveis por roles que não precisam
-- delas (auditoria de 11/jun, security-audit.md).
--
-- O app web/nativo SEMPRE chama essas funções com sessão autenticada;
-- nenhuma é usada pré-login (a única pré-login é resolve_email_for_username,
-- que fica FORA deste revoke — redesign próprio anotado no security-audit).
--
-- Reversível com GRANT EXECUTE equivalente.

-- Anon podia disparar o backfill (computação pesada repetida = mini-DoS).
revoke execute on function public.backfill_user_achievements_server_side() from anon;

-- Utilitária de DDL — não é API; ninguém de fora deve executar.
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;

-- Stats globais de conquistas: dado agregado, mas não precisa ser público
-- pra quem nem logou.
revoke execute on function public.get_achievement_global_stats(text) from anon;
