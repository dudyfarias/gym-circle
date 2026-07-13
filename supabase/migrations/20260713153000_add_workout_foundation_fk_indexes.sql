-- Cobertura direta das FKs adicionadas pelas Sprints A, D e G. Os indices
-- compostos de analytics continuam existindo; estes atendem joins/cascatas
-- iniciados pela coluna referenciada e removem os avisos do advisor.

create index if not exists activities_workout_plan_id_idx
  on public.activities (workout_plan_id)
  where workout_plan_id is not null;

create index if not exists personal_record_results_exercise_id_idx
  on public.personal_record_results (exercise_id)
  where exercise_id is not null;

create index if not exists activity_record_highlights_exercise_id_idx
  on public.activity_record_highlights (exercise_id)
  where exercise_id is not null;

create index if not exists workout_exercise_catalog_reviewed_by_idx
  on public.workout_exercise_catalog (reviewed_by)
  where reviewed_by is not null;

create index if not exists workout_technique_catalog_reviewed_by_idx
  on public.workout_technique_catalog (reviewed_by)
  where reviewed_by is not null;
