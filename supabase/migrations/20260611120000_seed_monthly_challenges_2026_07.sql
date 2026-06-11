-- Sprint 16 — Seed dos 4 desafios de Julho 2026 (temática brasileira).
--
-- Contexto brasileiro Julho 2026:
--   - COPA DO MUNDO 2026 (EUA/México/Canadá): mata-mata em julho,
--     final em 19/jul — o país inteiro respirando futebol
--   - Férias escolares de julho (rotina muda, treino não pode parar)
--   - Inverno no Brasil (a desculpa clássica pra hibernar)
--
-- Estrutura (mesmo padrão de Junho/7.5.10 — só goal kinds IMPLEMENTADOS
-- no recompute: workouts_in_month, workout_type_specific, group_workouts,
-- distinct_types; streak_in_month/perfect_month seguem proibidos até B4):
--   easy      — Férias em Movimento (público)   — 8 treinos no mês
--   medium    — Craque da Copa (SECRETO)        — 3 treinos de futebol
--   hard      — Seleção Convocada (público)     — 4 treinos em grupo
--   legendary — Inverno Imparável (SECRETO)     — 20 dias treinados
--
-- Idempotente: guard por period_key — re-aplicar NÃO duplica nem apaga
-- progresso (diferente do padrão delete+insert do replace de junho).

do $$
begin
  if exists (
    select 1 from public.monthly_challenges where period_key = '2026-07'
  ) then
    raise notice 'Desafios de 2026-07 já existem — seed ignorado.';
    return;
  end if;

  insert into public.monthly_challenges (
    period_key, title_pt, title_en, description_pt, description_en,
    difficulty, goal_kind, goal_target, start_date, end_date, trophy_id,
    is_secret, goal_config
  ) values
    (
      '2026-07',
      'Férias em Movimento',
      'Holidays in Motion',
      'Treine 8 dias em Julho. Férias é desculpa pra treinar em horário novo, não pra parar.',
      'Train 8 days in July. Vacation means new workout times, not no workouts.',
      'easy',
      'workouts_in_month',
      8,
      '2026-07-01',
      '2026-07-31',
      'trophy:ferias-movimento-2026-07',
      false,
      '{}'::jsonb
    ),
    (
      '2026-07',
      'Craque da Copa',
      'World Cup Star',
      'Publique 3 treinos de futebol em Julho — o mês da final da Copa de 2026.',
      'Post 3 soccer workouts in July — the month of the 2026 World Cup final.',
      'medium',
      'workout_type_specific',
      3,
      '2026-07-01',
      '2026-07-31',
      'trophy:craque-copa-2026-07',
      true,
      '{"workout_type": "futebol"}'::jsonb
    ),
    (
      '2026-07',
      'Seleção Convocada',
      'Squad Called Up',
      'Treine com amigos 4 vezes em Julho. Convoca a galera: seleção boa treina junta.',
      'Work out with friends 4 times in July. Call up your squad — great teams train together.',
      'hard',
      'group_workouts',
      4,
      '2026-07-01',
      '2026-07-31',
      'trophy:selecao-convocada-2026-07',
      false,
      '{}'::jsonb
    ),
    (
      '2026-07',
      'Inverno Imparável',
      'Unstoppable Winter',
      'Treine 20 dias em Julho. O frio tentou, mas você não hibernou.',
      'Train 20 days in July. Winter tried — you did not hibernate.',
      'legendary',
      'workouts_in_month',
      20,
      '2026-07-01',
      '2026-07-31',
      'trophy:inverno-imparavel-2026-07',
      true,
      '{}'::jsonb
    );
end $$;
