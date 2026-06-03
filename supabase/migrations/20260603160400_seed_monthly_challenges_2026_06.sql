-- Sprint 7.5.6 — Seed dos 4 desafios de Junho 2026 como demonstração
-- do sistema. Futuras runs serão via Edge Function scheduled.
--
-- Cada mês ganha 4 desafios:
--   - easy (~70% conseguem): 10 treinos
--   - medium (~30%): 15 treinos
--   - hard (~10%): 20 treinos
--   - legendary (~1%): 25 treinos (quase perfeito num mês de 30 dias)

insert into public.monthly_challenges (
  period_key, title_pt, title_en, description_pt, description_en,
  difficulty, goal_kind, goal_target, start_date, end_date, trophy_id
) values
  (
    '2026-06',
    'Início do Inverno',
    'Winter Kickoff',
    'Treine pelo menos 10 dias em Junho.',
    'Train at least 10 days in June.',
    'easy',
    'workouts_in_month',
    10,
    '2026-06-01',
    '2026-06-30',
    'trophy:winter-kickoff-2026-06'
  ),
  (
    '2026-06',
    'Mês Consistente',
    'Consistent Month',
    'Treine 15 dias em Junho.',
    'Train 15 days in June.',
    'medium',
    'workouts_in_month',
    15,
    '2026-06-01',
    '2026-06-30',
    'trophy:consistent-month-2026-06'
  ),
  (
    '2026-06',
    'Guerreiro de Junho',
    'June Warrior',
    'Treine 20 dias em Junho.',
    'Train 20 days in June.',
    'hard',
    'workouts_in_month',
    20,
    '2026-06-01',
    '2026-06-30',
    'trophy:june-warrior-2026-06'
  ),
  (
    '2026-06',
    'Quase Lendário',
    'Almost Legendary',
    'Treine 25 dias em Junho — meta lendária.',
    'Train 25 days in June — legendary target.',
    'legendary',
    'workouts_in_month',
    25,
    '2026-06-01',
    '2026-06-30',
    'trophy:almost-legendary-2026-06'
  )
on conflict (period_key, difficulty) do nothing;
