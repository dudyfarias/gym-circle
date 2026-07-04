-- Rastreio de treino — Slice 3 (import do Apple Saúde).
-- Treinos importados (Strava/Nike/etc via HealthKit) carregam o UUID do
-- HKWorkout em external_id; o índice único por usuário impede importar o
-- mesmo treino duas vezes (o app trata 23505 com mensagem amigável).

alter table public.activities
  add column if not exists external_id text;

create unique index if not exists activities_user_external_uidx
  on public.activities (user_id, external_id)
  where external_id is not null;
