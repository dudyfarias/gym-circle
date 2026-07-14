-- Workout Catalog Intelligence & Exercise Picker v2
--
-- Additive only. Legacy columns (`equipment`, `aliases`, `status`,
-- `parent_exercise_id`) remain available so saved workouts and older clients
-- continue to work while the catalog moves to normalized metadata.

alter table public.workout_exercise_catalog
  add column if not exists primary_equipment text,
  add column if not exists compatible_equipments text[] not null default '{}',
  add column if not exists required_equipment text[] not null default '{}',
  add column if not exists optional_equipment text[] not null default '{}',
  add column if not exists exercise_type text,
  add column if not exists default_load_type text,
  add column if not exists exercise_priority_score integer not null default 50,
  add column if not exists review_status text not null default 'needs_review',
  add column if not exists default_rest_s integer,
  add column if not exists default_rpe numeric(3, 1),
  add column if not exists default_target_kind text,
  add column if not exists default_reps integer,
  add column if not exists default_duration_s integer,
  add column if not exists default_distance_m numeric,
  add column if not exists execution_steps_pt text[] not null default '{}',
  add column if not exists execution_steps_en text[] not null default '{}',
  add column if not exists editorial_review_version text;

alter table public.workout_exercise_catalog
  add constraint workout_exercise_catalog_exercise_type_check
    check (exercise_type is null or exercise_type in (
      'compound', 'isolation', 'conditioning', 'mobility', 'warmup'
    )),
  add constraint workout_exercise_catalog_default_load_type_check
    check (default_load_type is null or default_load_type in (
      'external', 'bodyweight', 'assisted', 'not_provided'
    )),
  add constraint workout_exercise_catalog_priority_check
    check (exercise_priority_score between 0 and 100),
  add constraint workout_exercise_catalog_review_status_check
    check (review_status in ('draft', 'needs_review', 'approved', 'deprecated')),
  add constraint workout_exercise_catalog_default_rest_check
    check (default_rest_s is null or default_rest_s between 0 and 1800),
  add constraint workout_exercise_catalog_default_rpe_check
    check (default_rpe is null or default_rpe between 1 and 10),
  add constraint workout_exercise_catalog_default_target_kind_check
    check (default_target_kind is null or default_target_kind in (
      'reps', 'failure', 'duration', 'distance'
    )),
  add constraint workout_exercise_catalog_default_reps_check
    check (default_reps is null or default_reps between 1 and 1000),
  add constraint workout_exercise_catalog_default_duration_check
    check (default_duration_s is null or default_duration_s between 1 and 86400),
  add constraint workout_exercise_catalog_default_distance_check
    check (default_distance_m is null or default_distance_m > 0);

-- Canonical equipment names keep the current free-text arrays compatible while
-- eliminating singular/plural and display-name drift for ranking and Scanner.
create or replace function public.workout_catalog_equipment_slug(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case lower(trim(value))
    when 'dumbbells' then 'dumbbell'
    when 'ez bar' then 'ez-bar'
    when 'pull-up bar' then 'pull-up-bar'
    when 'assisted pull-up machine' then 'assisted-pull-up-machine'
    when 'leg press' then 'leg-press-machine'
    when 'free weight' then 'free-weight'
    when 'incline bench' then 'incline-bench'
    when 'decline bench' then 'decline-bench'
    else trim(both '-' from regexp_replace(lower(trim(value)), '[^a-z0-9]+', '-', 'g'))
  end;
$$;

-- Editorial pass over the full current catalog. Existing rows already have one
-- primary muscle; this pass makes equipment, movement, recording and load
-- semantics explicit. Community submissions remain Needs Review.
update public.workout_exercise_catalog exercise
set
  primary_equipment = case
    when cardinality(exercise.equipment) = 0 then null
    else public.workout_catalog_equipment_slug(exercise.equipment[1])
  end,
  compatible_equipments = coalesce((
    select array_agg(distinct public.workout_catalog_equipment_slug(item) order by public.workout_catalog_equipment_slug(item))
    from unnest(exercise.equipment) item
  ), '{}'),
  required_equipment = case
    when cardinality(exercise.equipment) = 0 then '{}'
    else array[public.workout_catalog_equipment_slug(exercise.equipment[1])]
  end,
  optional_equipment = case
    when cardinality(exercise.equipment) <= 1 then '{}'
    else (
      select array_agg(distinct public.workout_catalog_equipment_slug(item) order by public.workout_catalog_equipment_slug(item))
      from unnest(exercise.equipment[2:cardinality(exercise.equipment)]) item
    )
  end,
  movement_pattern = case
    when exercise.slug like 'agachamento-%' or exercise.slug in ('hack-squat', 'leg-press-45', 'leg-press-45-passada', 'afundo-bulgaro', 'avanco-caminhando') then 'squat'
    when exercise.slug in ('levantamento-terra', 'meio-terra-com-barra', 'stiff-barra') then 'hinge'
    when exercise.slug = 'hip-thrust-barra' then 'hip-extension'
    when exercise.slug like 'supino-%' or exercise.slug in ('supino', 'supino-inclinado', 'flexao-de-bracos') then 'horizontal-push'
    when exercise.slug = 'crucifixo-inclinado-supino-inclinado-halteres' then 'chest-complex'
    when exercise.slug like 'crucifixo-%' or exercise.slug = 'crossover' then 'chest-fly'
    when exercise.slug like 'desenvolvimento-%' then 'vertical-push'
    when exercise.slug like 'elevacao-lateral%' then 'shoulder-abduction'
    when exercise.slug = 'elevacao-frontal-halteres' then 'shoulder-flexion'
    when exercise.slug like 'barra-fixa%' or exercise.slug like 'puxada-%' or exercise.slug = 'pull-down-barra' then 'vertical-pull'
    when exercise.slug like 'remada-%' then 'horizontal-pull'
    when exercise.slug = 'pullover' then 'shoulder-extension'
    when exercise.slug like 'rosca-%' or exercise.slug like 'biceps-%' then 'elbow-flexion'
    when exercise.slug like 'triceps-%' or exercise.slug in ('mergulho', 'rosca-francesa-anilha') then 'elbow-extension'
    when exercise.slug in ('cadeira-extensora', 'cadeira-extensora-mesa-flexora') then 'knee-extension'
    when exercise.slug in ('cadeira-flexora', 'mesa-flexora') then 'knee-flexion'
    when exercise.slug = 'cadeira-abdutora' then 'hip-abduction'
    when exercise.slug = 'cadeira-adutora' then 'hip-adduction'
    when exercise.slug like 'gemeos-%' or exercise.slug like 'panturrilha-%' then 'calf-raise'
    when exercise.slug in ('abdominal-crunch', 'abdominal-cabo', 'infra', 'obliquos', 'elevacao-de-pernas-suspenso') then 'trunk-flexion'
    when exercise.slug = 'prancha' then 'anti-extension'
    when exercise.slug = 'crucifixo-inverso-maquina' then 'horizontal-abduction'
    when exercise.slug = 'face-pull' then 'face-pull'
    when exercise.slug like 'manguito-%' then 'external-rotation'
    when exercise.slug like 'encolhimento-%' then 'scapular-elevation'
    when exercise.slug = 'flexao-de-punho-barra-sentado' then 'wrist-flexion'
    when exercise.slug in ('rotacional-de-punho', 'rosca-inversa-cross') then 'forearm-rotation'
    when exercise.slug like 'aquecimento-%' or exercise.slug = 'aquecimento' then 'warmup'
    when exercise.slug = 'alongamento' then 'mobility'
    else coalesce(nullif(exercise.movement_pattern, ''), exercise.slug)
  end,
  exercise_type = case
    when exercise.slug like 'aquecimento%' then 'warmup'
    when exercise.primary_muscle_group_slug = 'mobility' or exercise.slug = 'alongamento' then 'mobility'
    when exercise.slug in (
      'afundo-bulgaro', 'agachamento-frontal-barra', 'agachamento-halteres',
      'agachamento-livre-barra', 'agachamento-smith', 'avanco-caminhando',
      'barra-fixa', 'barra-fixa-graviton', 'desenvolvimento-halteres',
      'desenvolvimento-maquina', 'desenvolvimento-militar-barra',
      'crucifixo-inclinado-supino-inclinado-halteres', 'flexao-de-bracos',
      'hack-squat', 'hip-thrust-barra', 'leg-press-45',
      'leg-press-45-passada', 'levantamento-terra', 'meio-terra-com-barra',
      'mergulho', 'pull-down-barra', 'puxada-frente-barra',
      'puxada-pegada-neutra', 'puxada-polia-triangulo',
      'puxada-vertical-com-triangulo', 'remada-baixa-cabo',
      'remada-curva-barra', 'remada-maquina-neutra',
      'remada-unilateral-halter-serrote', 'remada-unilateral-peg-supinada',
      'stiff-barra', 'supino', 'supino-declinado-barra',
      'supino-declinado-halteres', 'supino-inclinado',
      'supino-inclinado-barra', 'supino-inclinado-halteres',
      'supino-maquina', 'supino-reto-barra', 'supino-reto-halteres'
    ) then 'compound'
    else 'isolation'
  end,
  default_load_type = case
    when exercise.equipment @> array['assisted pull-up machine']::text[] then 'assisted'
    when exercise.slug = 'alongamento' then 'not_provided'
    when exercise.equipment[1] = 'bodyweight' then 'bodyweight'
    when cardinality(exercise.equipment) = 0 then 'not_provided'
    else 'external'
  end,
  difficulty = coalesce(exercise.difficulty, case
    when exercise.slug in ('levantamento-terra', 'agachamento-frontal-barra', 'barra-fixa') then 'advanced'
    when exercise.slug like 'aquecimento%' or exercise.primary_muscle_group_slug = 'mobility' then 'beginner'
    when exercise.slug in (
      'agachamento-livre-barra', 'afundo-bulgaro', 'desenvolvimento-militar-barra',
      'meio-terra-com-barra', 'remada-curva-barra', 'stiff-barra',
      'supino-reto-barra', 'supino-inclinado-barra'
    ) then 'intermediate'
    else 'beginner'
  end),
  exercise_priority_score = case
    when exercise.status <> 'approved' then 20
    when exercise.slug = 'rosca-direta-barra' then 99
    when exercise.slug = 'rosca-scott-maquina-rosca-direta-halteres' then 97
    when exercise.slug = 'rosca-alternada-halteres' then 95
    when exercise.slug = 'biceps-alternado-com-giro' then 93
    when exercise.slug = 'biceps-martelo' then 91
    when exercise.slug = 'rosca-concentrada' then 89
    when exercise.slug in (
      'agachamento-livre-barra', 'barra-fixa', 'biceps-martelo',
      'cadeira-extensora', 'desenvolvimento-halteres', 'elevacao-lateral',
      'flexao-de-bracos', 'leg-press-45', 'levantamento-terra',
      'mesa-flexora', 'remada-baixa-cabo', 'remada-curva-barra',
      'rosca-alternada-halteres', 'rosca-direta-barra', 'stiff-barra',
      'supino-inclinado-halteres', 'supino-reto-barra',
      'supino-reto-halteres', 'triceps-polia-corda'
    ) then 90
    when cardinality(exercise.secondary_muscle_group_slugs) > 0 then 75
    else 65
  end,
  review_status = case exercise.status
    when 'approved' then 'approved'
    when 'rejected' then 'deprecated'
    else 'needs_review'
  end,
  default_rest_s = case
    when exercise.primary_muscle_group_slug = 'mobility' then 30
    when exercise_type = 'compound' then 120
    else 75
  end,
  default_rpe = case when exercise.primary_muscle_group_slug = 'mobility' then 5 else 7 end,
  default_target_kind = case
    when exercise.slug in ('alongamento', 'aquecimento', 'prancha') then 'duration'
    else 'reps'
  end,
  default_reps = case
    when exercise.slug in ('alongamento', 'aquecimento', 'prancha') then null
    when cardinality(exercise.secondary_muscle_group_slugs) > 0 then 10
    else 12
  end,
  default_duration_s = case
    when exercise.slug = 'prancha' then 45
    when exercise.slug in ('alongamento', 'aquecimento') then 60
    else null
  end,
  execution_steps_pt = coalesce(nullif(exercise.instructions_pt, '{}'), '{}'),
  execution_steps_en = coalesce(nullif(exercise.instructions_en, '{}'), '{}'),
  reviewed_at = case when exercise.status = 'approved' then now() else exercise.reviewed_at end,
  editorial_review_version = 'catalog-v2-2026-07-14';

-- The expression above cannot reference the newly assigned exercise_type in
-- the same UPDATE. Normalize rest after exercise_type has been persisted.
update public.workout_exercise_catalog
set default_rest_s = case
  when exercise_type in ('mobility', 'warmup') then 30
  when exercise_type = 'compound' then 120
  else 75
end;

alter table public.workout_exercise_catalog
  add constraint workout_exercise_catalog_primary_not_secondary_check
    check (not (primary_muscle_group_slug = any(secondary_muscle_group_slugs))),
  add constraint workout_exercise_catalog_approved_metadata_check
    check (
      review_status <> 'approved' or (
        primary_equipment is not null and
        exercise_type is not null and
        default_load_type is not null and
        difficulty is not null and
        movement_pattern is not null and
        default_target_kind is not null
      )
    );

create index if not exists workout_exercise_catalog_picker_idx
  on public.workout_exercise_catalog (
    review_status,
    primary_muscle_group_slug,
    exercise_priority_score desc,
    name_pt
  );

create index if not exists workout_exercise_catalog_compatible_equipment_idx
  on public.workout_exercise_catalog using gin (compatible_equipments);

-- Normalized equipment/machine model. A machine/equipment owns no exercise;
-- the junction table makes one machine compatible with many exercises.
create table public.workout_equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pt text not null,
  name_en text not null,
  kind text not null default 'equipment'
    check (kind in ('equipment', 'machine', 'station', 'accessory')),
  parent_equipment_id uuid references public.workout_equipment_catalog(id) on delete set null,
  aliases_pt text[] not null default '{}',
  aliases_en text[] not null default '{}',
  manufacturer text,
  model text,
  review_status text not null default 'approved'
    check (review_status in ('draft', 'needs_review', 'approved', 'deprecated')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workout_exercise_equipment_compatibility (
  exercise_id uuid not null references public.workout_exercise_catalog(id) on delete cascade,
  equipment_id uuid not null references public.workout_equipment_catalog(id) on delete cascade,
  compatibility_role text not null
    check (compatibility_role in ('primary', 'compatible', 'required', 'optional')),
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  primary key (exercise_id, equipment_id, compatibility_role)
);

create table public.workout_exercise_relations (
  source_exercise_id uuid not null references public.workout_exercise_catalog(id) on delete cascade,
  target_exercise_id uuid not null references public.workout_exercise_catalog(id) on delete cascade,
  relation_type text not null
    check (relation_type in (
      'variation', 'substitution', 'alternative', 'home_version', 'gym_version'
    )),
  sort_order integer not null default 100,
  rationale_pt text,
  rationale_en text,
  review_status text not null default 'needs_review'
    check (review_status in ('draft', 'needs_review', 'approved', 'deprecated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source_exercise_id, target_exercise_id, relation_type),
  constraint workout_exercise_relations_no_self check (source_exercise_id <> target_exercise_id)
);

insert into public.workout_equipment_catalog (slug, name_pt, name_en, kind, reviewed_at)
values
  ('assisted-pull-up-machine', 'Graviton', 'Assisted pull-up machine', 'machine', now()),
  ('barbell', 'Barra', 'Barbell', 'equipment', now()),
  ('bench', 'Banco', 'Bench', 'station', now()),
  ('bodyweight', 'Peso corporal', 'Bodyweight', 'equipment', now()),
  ('cable', 'Polia', 'Cable', 'station', now()),
  ('decline-bench', 'Banco declinado', 'Decline bench', 'station', now()),
  ('dumbbell', 'Halter', 'Dumbbell', 'equipment', now()),
  ('ez-bar', 'Barra W', 'EZ bar', 'equipment', now()),
  ('free-weight', 'Peso livre', 'Free weight', 'equipment', now()),
  ('incline-bench', 'Banco inclinado', 'Incline bench', 'station', now()),
  ('kettlebell', 'Kettlebell', 'Kettlebell', 'equipment', now()),
  ('leg-press-machine', 'Leg press', 'Leg press', 'machine', now()),
  ('machine', 'Máquina', 'Machine', 'machine', now()),
  ('plate', 'Anilha', 'Plate', 'equipment', now()),
  ('pull-up-bar', 'Barra fixa', 'Pull-up bar', 'station', now()),
  ('rack', 'Rack', 'Rack', 'station', now()),
  ('resistance-band', 'Elástico', 'Resistance band', 'equipment', now()),
  ('no-equipment', 'Sem equipamento', 'No equipment', 'equipment', now()),
  ('rope', 'Corda', 'Rope', 'accessory', now()),
  ('smith', 'Smith', 'Smith machine', 'machine', now())
on conflict (slug) do update set
  name_pt = excluded.name_pt,
  name_en = excluded.name_en,
  kind = excluded.kind,
  updated_at = now();

insert into public.workout_exercise_equipment_compatibility (
  exercise_id,
  equipment_id,
  compatibility_role,
  sort_order
)
select
  exercise.id,
  equipment.id,
  case when equipment.slug = exercise.primary_equipment then 'primary' else 'compatible' end,
  case when equipment.slug = exercise.primary_equipment then 0 else 100 end
from public.workout_exercise_catalog exercise
cross join lateral unnest(exercise.compatible_equipments) compatible_slug
join public.workout_equipment_catalog equipment on equipment.slug = compatible_slug
on conflict do nothing;

insert into public.workout_exercise_relations (
  source_exercise_id,
  target_exercise_id,
  relation_type,
  sort_order,
  review_status
)
select
  child.parent_exercise_id,
  child.id,
  'variation',
  100,
  case when child.status = 'approved' then 'approved' else 'needs_review' end
from public.workout_exercise_catalog child
where child.parent_exercise_id is not null
on conflict do nothing;

-- Favorites are private user preferences. Recent use remains derived from the
-- user's own activities so there is no second counter to drift out of sync.
create table public.user_workout_exercise_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.workout_exercise_catalog(id) on delete cascade,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create index user_workout_exercise_preferences_favorite_idx
  on public.user_workout_exercise_preferences (user_id, updated_at desc)
  where is_favorite;

alter table public.workout_equipment_catalog enable row level security;
alter table public.workout_exercise_equipment_compatibility enable row level security;
alter table public.workout_exercise_relations enable row level security;
alter table public.user_workout_exercise_preferences enable row level security;

create policy workout_equipment_catalog_read
  on public.workout_equipment_catalog for select
  to anon, authenticated
  using (review_status = 'approved');

create policy workout_exercise_equipment_compatibility_read
  on public.workout_exercise_equipment_compatibility for select
  to anon, authenticated
  using (true);

create policy workout_exercise_relations_read
  on public.workout_exercise_relations for select
  to anon, authenticated
  using (review_status = 'approved');

create policy user_workout_exercise_preferences_select_own
  on public.user_workout_exercise_preferences for select
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy user_workout_exercise_preferences_insert_own
  on public.user_workout_exercise_preferences for insert
  to authenticated
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy user_workout_exercise_preferences_update_own
  on public.user_workout_exercise_preferences for update
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
  with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy user_workout_exercise_preferences_delete_own
  on public.user_workout_exercise_preferences for delete
  to authenticated
  using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke all on public.workout_equipment_catalog from anon, authenticated;
revoke all on public.workout_exercise_equipment_compatibility from anon, authenticated;
revoke all on public.workout_exercise_relations from anon, authenticated;
revoke all on public.user_workout_exercise_preferences from anon, authenticated;
revoke execute on function public.workout_catalog_equipment_slug(text)
  from public, anon, authenticated;

grant select on public.workout_equipment_catalog to anon, authenticated;
grant select on public.workout_exercise_equipment_compatibility to anon, authenticated;
grant select on public.workout_exercise_relations to anon, authenticated;
grant select, insert, update, delete on public.user_workout_exercise_preferences to authenticated;
grant all on public.workout_equipment_catalog to service_role;
grant all on public.workout_exercise_equipment_compatibility to service_role;
grant all on public.workout_exercise_relations to service_role;
grant all on public.user_workout_exercise_preferences to service_role;
grant execute on function public.workout_catalog_equipment_slug(text) to service_role;

-- Editorial safety: AI/scanner consumers must query only review_status approved.
-- The current picker also filters this field after the migration is available.
comment on column public.workout_exercise_catalog.review_status is
  'Editorial gate. AI, Scanner and automatic generation may consume only approved rows.';
