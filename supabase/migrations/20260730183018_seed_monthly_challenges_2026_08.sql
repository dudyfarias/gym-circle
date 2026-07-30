-- Desafios editoriais de agosto de 2026.
--
-- Distribuição de dificuldade:
--   easy      ~70%: 8 dias ativos
--   medium    ~30%: 4 modalidades diferentes
--   hard      ~10%: 4 treinos aceitos com amigos
--   legendary  ~1%: todos os 31 dias ativos
--
-- A migration é idempotente: se o período já existe, não altera definições
-- nem progresso dos usuários.

do $$
begin
  if exists (
    select 1
      from public.monthly_challenges
     where period_key = '2026-08'
  ) then
    raise notice 'Desafios de 2026-08 já existem — seed ignorado.';
    return;
  end if;

  insert into public.monthly_challenges (
    period_key,
    title_pt,
    title_en,
    description_pt,
    description_en,
    difficulty,
    rarity,
    goal_kind,
    goal_target,
    start_date,
    end_date,
    trophy_id,
    is_secret,
    goal_config
  ) values
    (
      '2026-08',
      'Retorno ao Ritmo',
      'Back in Rhythm',
      'Treine em 8 dias diferentes de agosto e mantenha o seu Circle em movimento.',
      'Train on 8 different days in August and keep your Circle moving.',
      'easy',
      'common',
      'workouts_in_month',
      8,
      '2026-08-01',
      '2026-08-31',
      'trophy:retorno-ao-ritmo-2026-08',
      false,
      '{}'::jsonb
    ),
    (
      '2026-08',
      'Agosto Versátil',
      'August All-Rounder',
      'Complete quatro modalidades diferentes durante agosto.',
      'Complete four different workout types during August.',
      'medium',
      'uncommon',
      'distinct_types',
      4,
      '2026-08-01',
      '2026-08-31',
      'trophy:agosto-versatil-2026-08',
      true,
      '{}'::jsonb
    ),
    (
      '2026-08',
      'Círculo de Inverno',
      'Winter Circle',
      'Conclua quatro treinos com amigos em agosto. O frio fica menor quando o Circle vai junto.',
      'Complete four workouts with friends in August. Winter feels lighter when your Circle joins in.',
      'hard',
      'epic',
      'group_workouts',
      4,
      '2026-08-01',
      '2026-08-31',
      'trophy:circulo-de-inverno-2026-08',
      false,
      '{}'::jsonb
    ),
    (
      '2026-08',
      'Agosto Sem Falhas',
      'Flawless August',
      'Treine em todos os 31 dias de agosto para conquistar o troféu que nunca volta.',
      'Train on all 31 days of August to earn the trophy that will never return.',
      'legendary',
      'legendary',
      'perfect_month',
      31,
      '2026-08-01',
      '2026-08-31',
      'trophy:agosto-sem-falhas-2026-08',
      true,
      '{}'::jsonb
    );
end $$;
