-- Sprint 7.5.8 — Estatísticas globais por achievement.
--
-- Retorna quantos users TÊM o achievement (count distinct user_id em
-- user_achievements) + total de users "qualificados" (profiles ativos
-- não-deletados).
--
-- Cliente calcula percentage = earned_count / total_users * 100 e formata
-- com precisão até 0.01%. Sem cache server-side — queries são instantâneas
-- com volume atual (28 users). Quando volume crescer, considerar
-- materialized view ou cron-based snapshot.
--
-- Pode ser chamada por qualquer authenticated user — dados são agregados
-- (não exponem identidade individual). SECURITY DEFINER pra contornar
-- RLS de user_achievements (que é por-user normalmente — aqui queremos
-- count global).

create or replace function public.get_achievement_global_stats(
  p_achievement_id text
) returns table(earned_count bigint, total_users bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    (
      select count(distinct user_id)
      from public.user_achievements
      where achievement_id = p_achievement_id
    ) as earned_count,
    (
      select count(*)
      from public.profiles
      where deleted_at is null
        and account_status = 'active'
    ) as total_users;
end;
$$;

grant execute on function public.get_achievement_global_stats(text) to authenticated, anon;

comment on function public.get_achievement_global_stats(text) is
  'Sprint 7.5.8 — retorna stats agregadas pra mostrar raridade no AchievementDetailOverlay (Apple Fitness style). SECURITY DEFINER pra contornar RLS de user_achievements (queremos count global, não só do próprio user).';
