-- Sprint 7.5.10 — Substitui os 4 desafios genéricos de Junho 2026 por
-- versões temáticas brasileiras + 2 secretos.
--
-- Contexto brasileiro Junho 2026:
--   - Festas juninas (tradição cultural do mês)
--   - João Fonseca brilhando em Roland Garros (2026 sucesso continuado)
--   - Brasileirão 2026 em andamento (paixão nacional)
--   - Esquenta pré-Olimpíadas LA 2028 (atletas multi-modalidade)
--
-- Estrutura:
--   easy      — Festa Junina Fit (público)        — 8 treinos no mês
--   medium    — Saque Brasileiro (SECRETO)         — 3 treinos de tênis
--   hard      — Brasileirão da Galera (público)    — 4 treinos em grupo
--   legendary — Atleta Olímpico (SECRETO)          — 5 modalidades distintas
--
-- Quem completar os secretos descobre o desafio + ganha troféu único.

-- Limpa rows antigas de Junho 2026 + suas progressions
delete from public.user_monthly_challenge_progress
where challenge_id in (
  select id from public.monthly_challenges where period_key = '2026-06'
);
delete from public.monthly_challenges where period_key = '2026-06';

insert into public.monthly_challenges (
  period_key, title_pt, title_en, description_pt, description_en,
  difficulty, goal_kind, goal_target, start_date, end_date, trophy_id,
  is_secret, goal_config
) values
  (
    '2026-06',
    'Festa Junina Fit',
    'Festa Junina Fit',
    'Treine 8 dias em Junho enquanto o Brasil dança quadrilha. Bom São João pro corpo!',
    'Train 8 days in June while Brazil dances around bonfires. Holiday fitness vibes!',
    'easy',
    'workouts_in_month',
    8,
    '2026-06-01',
    '2026-06-30',
    'trophy:festa-junina-fit-2026-06',
    false,
    '{}'::jsonb
  ),
  (
    '2026-06',
    'Saque Brasileiro',
    'Brazilian Serve',
    'Publique 3 treinos de tênis em Junho. O Brasil tem tradição em Roland Garros.',
    'Post 3 tennis workouts in June. Brazilians make Roland Garros history.',
    'medium',
    'workout_type_specific',
    3,
    '2026-06-01',
    '2026-06-30',
    'trophy:saque-brasileiro-2026-06',
    true,
    '{"workout_type": "tenis"}'::jsonb
  ),
  (
    '2026-06',
    'Brasileirão da Galera',
    'Brasileirão Squad',
    'Treine com amigos 4 vezes em Junho. Time forte é time unido.',
    'Work out with friends 4 times in June. Squad goals strong.',
    'hard',
    'group_workouts',
    4,
    '2026-06-01',
    '2026-06-30',
    'trophy:brasileirao-galera-2026-06',
    false,
    '{}'::jsonb
  ),
  (
    '2026-06',
    'Atleta Olímpico',
    'Olympic Athlete',
    'Varie em 5 modalidades diferentes em Junho. Esquentando pra LA 2028.',
    'Vary across 5 different workout types in June. Heating up for LA 2028.',
    'legendary',
    'distinct_types',
    5,
    '2026-06-01',
    '2026-06-30',
    'trophy:atleta-olimpico-2026-06',
    true,
    '{}'::jsonb
  );
