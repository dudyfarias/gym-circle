-- Planilhas de treino (rotinas de musculação salvas pelo usuário). Dados
-- próprios (só o dono lê/escreve). Abrir uma planilha inicia um treino de
-- força com os exercícios carregados; a carga é preenchida na hora.
--
-- exercises jsonb: [{ "name": text, "sets": int|null, "reps": int|null }, ...]

create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.workout_plans is
  'Planilhas/rotinas de treino do usuário (só o dono). exercises = [{name, sets, reps}].';

create index if not exists workout_plans_user_updated_idx
  on public.workout_plans (user_id, updated_at desc);

alter table public.workout_plans enable row level security;

-- Só o dono acessa a própria planilha. (select auth.uid()) evita reavaliar por
-- linha (padrão de hardening do projeto).
create policy "workout_plans_owner_select"
  on public.workout_plans for select
  using (user_id = (select auth.uid()));

create policy "workout_plans_owner_insert"
  on public.workout_plans for insert
  with check (user_id = (select auth.uid()));

create policy "workout_plans_owner_update"
  on public.workout_plans for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "workout_plans_owner_delete"
  on public.workout_plans for delete
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.workout_plans to authenticated;
