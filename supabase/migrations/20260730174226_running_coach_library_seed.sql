-- Sprint D1 — Running Coach Library seed (Fatia 2).
-- Applied in production through the dedicated release gate on 2026-07-30.
-- Apply AFTER 20260730174204_running_coach_library.sql (depends on its tables).
--
-- Two flagship beginner sessions so "Corrida guiada" has content to test:
--   1) Primeira caminhada  — 30 min walk (warmup / walk / cooldown)
--   2) Intervalado leve     — run/walk intervals (warmup / 6× 1 min / cooldown)
--
-- Seeded is_published = TRUE on purpose: the RLS read policy only exposes
-- official content when is_published is true, so publishing here is what makes
-- the sessions visible to the app for on-device testing. Content copy and the
-- medical disclaimer get their final review in Fatia 4 (unpublish/edit there if
-- needed). Deterministic UUIDs keep the seed idempotent and let Fatia 3 programs
-- reference these templates.
--
-- Idempotency: the template insert is guarded by `on conflict (slug) do nothing`
-- and its steps are inserted via a CTE that only fires when the template row was
-- actually created (returning id) — so a re-run inserts nothing. (We avoid
-- `on conflict (session_template_id, position)` because that unique constraint
-- is DEFERRABLE and Postgres cannot use a deferrable constraint as an ON CONFLICT
-- arbiter.)

begin;

-- 1) Primeira caminhada -------------------------------------------------------
with ins as (
  insert into public.running_session_template (
    id, slug, owner_user_id, origin, visibility, title, description,
    estimated_duration_s, estimated_distance_m, primary_step_type, is_published
  ) values (
    'd1000000-0000-4000-a000-000000000001',
    'primeira-caminhada',
    null,
    'official',
    'public',
    'Primeira caminhada',
    'Seu primeiro passo. 30 minutos de caminhada leve, do aquecimento ao desaquecimento — sem pressa, só constância.',
    1800,
    null,
    'walk',
    true
  )
  on conflict (slug) do nothing
  returning id
)
insert into public.running_session_template_step (
  session_template_id, position, step_type, title, instructions,
  repetitions, target_basis, duration_s, recovery_type, recovery_duration_s, target_effort
)
select
  ins.id, s.position, s.step_type, s.title, s.instructions,
  s.repetitions, s.target_basis, s.duration_s, s.recovery_type,
  s.recovery_duration_s, s.target_effort
from ins
cross join (values
  (
    0, 'warmup', 'Aquecimento caminhando',
    'Comece devagar, soltando o corpo. Respire fundo e encontre um passo confortável.',
    1, 'duration', 300, 'none', null::integer, 2::numeric
  ),
  (
    1, 'walk', 'Caminhada contínua',
    'Passo firme e constante. Você deve conseguir conversar sem perder o fôlego.',
    1, 'duration', 1200, 'none', null, 3
  ),
  (
    2, 'cooldown', 'Desaquecimento',
    'Diminua o ritmo aos poucos até parar. Alongue levemente ao final.',
    1, 'duration', 300, 'none', null, 2
  )
) as s(
  position, step_type, title, instructions,
  repetitions, target_basis, duration_s, recovery_type, recovery_duration_s, target_effort
);

-- 2) Intervalado leve ---------------------------------------------------------
with ins as (
  insert into public.running_session_template (
    id, slug, owner_user_id, origin, visibility, title, description,
    estimated_duration_s, estimated_distance_m, primary_step_type, is_published
  ) values (
    'd1000000-0000-4000-a000-000000000002',
    'intervalado-leve',
    null,
    'official',
    'public',
    'Intervalado leve',
    'Alterna trotes curtos com caminhada de recuperação. A forma mais gentil de começar a correr.',
    1710,
    null,
    'interval',
    true
  )
  on conflict (slug) do nothing
  returning id
)
insert into public.running_session_template_step (
  session_template_id, position, step_type, title, instructions,
  repetitions, target_basis, duration_s, recovery_type, recovery_duration_s, target_effort
)
select
  ins.id, s.position, s.step_type, s.title, s.instructions,
  s.repetitions, s.target_basis, s.duration_s, s.recovery_type,
  s.recovery_duration_s, s.target_effort
from ins
cross join (values
  (
    0, 'warmup', 'Aquecimento',
    'Caminhe rápido por 10 minutos para preparar o corpo antes dos trotes.',
    1, 'duration', 600, 'none', null::integer, 3::numeric
  ),
  (
    1, 'interval', '6 × 1 min de trote',
    'Trote leve por 1 minuto, depois caminhe 90s para recuperar. Repita 6 vezes.',
    6, 'duration', 60, 'walking', 90, 6
  ),
  (
    2, 'cooldown', 'Desaquecimento',
    'Caminhe leve por 5 minutos até normalizar a respiração.',
    1, 'duration', 300, 'none', null, 2
  )
) as s(
  position, step_type, title, instructions,
  repetitions, target_basis, duration_s, recovery_type, recovery_duration_s, target_effort
);

commit;
