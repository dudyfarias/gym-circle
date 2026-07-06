-- Cobrem as FKs usadas para auditoria/moderação de contribuições comunitárias.
create index if not exists workout_exercise_catalog_created_by_idx
  on public.workout_exercise_catalog (created_by)
  where created_by is not null;

create index if not exists workout_technique_catalog_created_by_idx
  on public.workout_technique_catalog (created_by)
  where created_by is not null;
