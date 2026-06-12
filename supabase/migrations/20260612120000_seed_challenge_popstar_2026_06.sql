-- Desafio Popstar (task #119) — entra mid-month em Junho 2026 como 5º
-- desafio do período. Goal kind novo media_count_in_post: completa ao
-- publicar UM post com 10 mídias no carrossel (limite do composer,
-- Sprint 14). Progress = melhor carrossel do mês (recompute web).
--
-- Troféu 3D dedicado (Rodin V2/Leonardo): /achievements/3d/popstar.glb
--
-- Idempotente: guard por trophy_id (junho já tem seed — o guard por
-- period_key do padrão de julho pularia o insert).

-- O unique (period_key, difficulty) da Sprint 7.5.1 assumia exatamente
-- 4 desafios/mês (1 por dificuldade). Com desafios extras tipo Popstar,
-- o invariante real é "sem troféu duplicado no período".
alter table public.monthly_challenges
  drop constraint if exists monthly_challenges_period_difficulty;
drop index if exists public.monthly_challenges_period_difficulty;
create unique index if not exists monthly_challenges_period_trophy
  on public.monthly_challenges (period_key, trophy_id);

-- O CHECK de goal_kind (Sprint 7.5.1) lista os kinds válidos — estende
-- com media_count_in_post. Drop+add é idempotente por natureza.
alter table public.monthly_challenges
  drop constraint if exists monthly_challenges_goal_kind_check;
alter table public.monthly_challenges
  add constraint monthly_challenges_goal_kind_check check (
    goal_kind = any (array[
      'workouts_in_month'::text,
      'streak_in_month'::text,
      'perfect_month'::text,
      'group_workouts'::text,
      'distinct_types'::text,
      'workout_type_specific'::text,
      'media_count_in_post'::text
    ])
  );

do $$
begin
  if exists (
    select 1 from public.monthly_challenges
    where trophy_id = 'trophy:popstar-2026-06'
  ) then
    raise notice 'Desafio Popstar 2026-06 já existe — seed ignorado.';
    return;
  end if;

  insert into public.monthly_challenges (
    period_key, title_pt, title_en, description_pt, description_en,
    difficulty, goal_kind, goal_target, start_date, end_date, trophy_id,
    is_secret, goal_config
  ) values (
    '2026-06',
    'Popstar',
    'Popstar',
    'Publique um treino com 10 mídias no carrossel. Dia épico merece cobertura de paparazzi.',
    'Post one workout with 10 carousel medias. Epic days deserve paparazzi coverage.',
    'medium',
    'media_count_in_post',
    10,
    '2026-06-01',
    '2026-06-30',
    'trophy:popstar-2026-06',
    false,
    '{}'::jsonb
  );
end $$;
