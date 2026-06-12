-- Sprint 16.5 (correção da 20260612090000) — o EXECUTE vinha do grant
-- default em PUBLIC; revogar só de anon não removia o acesso herdado.
-- Revoga de PUBLIC e re-concede explicitamente só a quem o app usa.
--
-- Verificado pós-aplicação (has_function_privilege):
--   anon → false nas 3 funções; authenticated → true onde o app precisa.

revoke execute on function public.backfill_user_achievements_server_side() from public, anon;
grant execute on function public.backfill_user_achievements_server_side() to authenticated;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke execute on function public.get_achievement_global_stats(text) from public, anon;
grant execute on function public.get_achievement_global_stats(text) to authenticated;
