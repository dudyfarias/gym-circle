-- Sprint 7.5.10 — Suporte a desafios secretos + goal_config JSONB
-- pra parâmetros extras de goal_kind (ex: workout_type específico).
--
-- is_secret: quando true, UI esconde título/descrição até user completar.
-- Mostra "???" + ícone misterioso. Mesmo padrão dos secret badges
-- (Sprint 5.3 — early-bird, night-owl, cross-trainer, explorer).
--
-- goal_config: JSONB livre pra parâmetros do goal_kind. Exemplos:
--   { "workout_type": "tennis" } — quando goal_kind = workout_type_specific
--   { "min_hour": 19 } — quando goal_kind = workouts_after_hour (futuro)
--   { "tags": ["amigo_a", "amigo_b"] } — quando goal_kind = with_specific_tags

alter table public.monthly_challenges
  add column if not exists is_secret boolean not null default false,
  add column if not exists goal_config jsonb not null default '{}'::jsonb;

-- Adiciona novo goal_kind possível
alter table public.monthly_challenges
  drop constraint if exists monthly_challenges_goal_kind_check;

alter table public.monthly_challenges
  add constraint monthly_challenges_goal_kind_check check (goal_kind in (
    'workouts_in_month',
    'streak_in_month',
    'perfect_month',
    'group_workouts',
    'distinct_types',
    'workout_type_specific'  -- Sprint 7.5.10: N posts de um workout_type específico
  ));

comment on column public.monthly_challenges.is_secret is
  'Sprint 7.5.10 — quando true, UI esconde título/descrição até user completar (revela ao ganhar). Mesmo padrão dos secret badges.';

comment on column public.monthly_challenges.goal_config is
  'Sprint 7.5.10 — parâmetros adicionais do goal_kind. Shape depende do kind. workout_type_specific: { "workout_type": "tennis" }.';
