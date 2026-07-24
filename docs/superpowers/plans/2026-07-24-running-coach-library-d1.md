# Running Coach Library (Sprint D1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a biblioteca oficial de corrida do Gym Circle — programas multi-semana e sessões avulsas, executáveis pela engine guiada existente, com "Corrida livre / Corrida guiada" na seção Corrida.

**Architecture:** Camada owner-aware de conteúdo (oficial na D1) + tabela fina de programa (semana × ordem → sessão-template) + enrollment/completion por usuário. Reusa `workout_plan_steps` (Sprint B) como forma dos blocos e a engine `GuidedRunningSession` (Sprint C) sem mudança, via um adaptador puro session-template → bloco. Lógica pura testada; UI e SQL finos.

**Tech Stack:** Next.js (apps/web) + `@gym-circle/core` (domain/services) + Supabase (Postgres, RLS, RPC security-definer) + vitest.

**Spec:** `docs/superpowers/specs/2026-07-24-running-coach-library-d1-design.md`

**Regras invioláveis (do repo + spec):**
- Trabalhar em `main` (o repo **proíbe** worktrees). Rodar `npm run check:main` antes de editar/deployar.
- **Não aplicar migration** sem confirmação do Eduardo. **Não deployar** sem ordem. **Não commitar** sem aprovação (o executor pausa nos passos de commit e pede ok).
- Alvo por **esforço (RPE)**, nunca pace absoluto. **"Voltar após lesão" não existe** na v1. Conteúdo seedado `is_published=false`.
- Gate por fatia: `cd apps/web && npx tsc --noEmit && npx eslint <arquivos> && npx vitest run` + `npm run build` verdes.

**Calibragem deste plano:** Fatia 1 e 2 vêm em passos bite-sized/TDD com código completo (é a fundação + o primeiro testável no iPhone). Fatia 3 e 4 vêm como blocos de tarefa bem-especificados (arquivos + funções puras + testes), a serem expandidos em micro-passos quando chegarmos nelas — para o plano não drivar antes de ser executado.

---

## File Structure

**packages/core (domain + serviço + testes):**
- Create `packages/core/src/domain/running-library.ts` — tipos das 6 entidades + mappers row→domain + **funções puras**: `resolveNextProgramSession`, `computeProgramProgress`, `sessionTemplateToEngineBlocks` (adaptador), `buildRunningTimeline` (colapso de repetição + cor por tipo).
- Create `packages/core/src/domain/running-library.test.ts` — testes das funções puras + mappers.
- Modify `packages/core/src/domain/index.ts` — exportar os tipos/funções novos.
- Create `packages/core/src/services/runningLibrary.ts` — leitura (browse de sessões/programas com filtro por faceta) + wrappers das RPCs (`enroll`, `complete`, `abandon`) + leitura do enrollment do usuário.
- Create `packages/core/src/services/runningLibrary.test.ts` — testes do serviço com client Supabase mockado (padrão dos outros `services/*.test.ts`).

**apps/web (hook + UI):**
- Create `apps/web/src/components/gym-circle/workout/useRunningLibrary.ts` — hook (browse + enrollment state), padrão de `useRunningPlans.ts`.
- Create `apps/web/src/components/gym-circle/workout/RunningLibrarySheet.tsx` — biblioteca (browse por faceta + detalhe do programa semana a semana + enroll/continuar).
- Modify `apps/web/src/components/gym-circle/workout/SportCatalogSection.tsx` (ou o ponto de entrada da Corrida) — dois modos: **Corrida livre** / **Corrida guiada** (guiada abre a biblioteca).
- Modify `apps/web/src/components/gym-circle/workout/RunningPlanPreview.tsx` — timeline endurecida usando `buildRunningTimeline` (colapso de repetição, cor por `step_type`).
- Modify `apps/web/src/components/gym-circle/screens/WebWorkoutScreen.tsx` — wire da biblioteca + fluxo enroll → próxima sessão → `GuidedRunningSession` → `complete`.

**supabase (schema + seed, NÃO aplicados):**
- Create `supabase/migrations/<timestamp>_running_coach_library.sql` — 6 tabelas + índices + RLS + RPCs. Cabeçalho "do not apply without a dedicated release gate".
- Create `supabase/migrations/<timestamp+1>_seed_running_coach_library_flagship.sql` — seed dos 5 planos-farol, `is_published=false`.

---

## Fatia 1 — Schema + domain + adaptador (fundação)

### Task 1.1: Migration do schema (arquivo, NÃO aplicar)

**Files:**
- Create: `supabase/migrations/<timestamp>_running_coach_library.sql`

- [ ] **Step 1: Escrever a migration** (aditiva; espelha os padrões da Sprint B em `20260723191546_running_workout_data_model.sql`).

```sql
-- Sprint D1 — Running Coach Library.
-- Prepared for review only. Do not apply without a dedicated release gate.
-- Conteúdo oficial owner-aware (owner_user_id null = oficial). Reusa a forma de
-- workout_plan_steps. Estado do usuário (enrollment/completion) com RLS dono-só.

-- 1) Sessão-template oficial ---------------------------------------------------
create table if not exists public.running_session_template (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_user_id uuid references auth.users(id) on delete cascade,
  origin text not null default 'official',
  visibility text not null default 'public',
  title text not null,
  description text,
  estimated_duration_s integer,
  estimated_distance_m numeric,
  primary_step_type text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint running_session_template_origin_check
    check (origin in ('official','professional','imported','ai')),
  constraint running_session_template_visibility_check
    check (visibility in ('public','assigned','private')),
  constraint running_session_template_owner_origin_check
    check ((origin = 'official') = (owner_user_id is null)),
  constraint running_session_template_title_check
    check (char_length(btrim(title)) between 1 and 120)
);

-- 2) Blocos da sessão-template — ESPELHO de public.workout_plan_steps ----------
-- Copiar as MESMAS colunas e constraints de workout_plan_steps
-- (migration 20260723191546, linhas 128-279), trocando o FK:
--   workout_plan_id -> session_template_id references public.running_session_template(id) on delete cascade
create table if not exists public.running_session_template_step (
  id uuid primary key default gen_random_uuid(),
  session_template_id uuid not null
    references public.running_session_template(id) on delete cascade,
  position integer not null,
  step_type text not null,
  title text not null,
  instructions text,
  repetitions integer not null default 1,
  repetitions_min integer,
  repetitions_max integer,
  target_basis text not null,
  distance_m numeric, distance_min_m numeric, distance_max_m numeric,
  duration_s integer, duration_min_s integer, duration_max_s integer,
  pace_min_s_per_km integer, pace_max_s_per_km integer,
  heart_rate_zone smallint,
  recovery_type text not null default 'none',
  recovery_duration_s integer, recovery_distance_m numeric,
  target_effort numeric,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint running_session_template_step_plan_position_key
    unique (session_template_id, position) deferrable initially deferred
  -- + REPETIR verbatim os checks de workout_plan_steps, RENOMEANDO cada um com o
  --   prefixo running_session_template_step_* :
  --   _position_check, _type_check, _title_check, _repetitions_check,
  --   _target_basis_check, _measurements_check, _target_check,
  --   _zone_effort_check, _recovery_type_check, _recovery_check, _metadata_check
);

-- 3) Programa oficial ----------------------------------------------------------
create table if not exists public.running_program (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  owner_user_id uuid references auth.users(id) on delete cascade,
  origin text not null default 'official',
  visibility text not null default 'public',
  title text not null,
  description text,
  level text,
  goal text,
  weeks integer not null,
  sessions_per_week integer not null,
  time_bucket integer,
  suggested_spacing text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint running_program_origin_check
    check (origin in ('official','professional','imported','ai')),
  constraint running_program_visibility_check
    check (visibility in ('public','assigned','private')),
  constraint running_program_owner_origin_check
    check ((origin = 'official') = (owner_user_id is null)),
  constraint running_program_level_check
    check (level is null or level in ('starting','beginner','intermediate','advanced')),
  constraint running_program_goal_check
    check (goal is null or goal in
      ('start_running','first_5k','improve_5k','first_10k','improve_10k',
       'half_marathon','marathon','conditioning','general')),
  constraint running_program_weeks_check check (weeks between 1 and 52),
  constraint running_program_spw_check check (sessions_per_week between 1 and 14),
  constraint running_program_time_bucket_check
    check (time_bucket is null or time_bucket in (20,30,45,60,90))
);

-- 4) Mapa semana × ordem -> sessão-template ------------------------------------
create table if not exists public.running_program_session (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.running_program(id) on delete cascade,
  week_index integer not null,
  order_in_week integer not null,
  session_template_id uuid not null references public.running_session_template(id),
  notes text,
  constraint running_program_session_week_check check (week_index between 1 and 52),
  constraint running_program_session_order_check check (order_in_week between 1 and 14),
  constraint running_program_session_unique unique (program_id, week_index, order_in_week)
);

-- 5) Enrollment (estado do usuário) --------------------------------------------
create table if not exists public.running_program_enrollment (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.running_program(id),
  status text not null default 'active',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint running_program_enrollment_status_check
    check (status in ('active','completed','abandoned'))
);
-- ≤1 enrollment ativo por usuário:
create unique index if not exists running_program_enrollment_one_active_idx
  on public.running_program_enrollment (user_id) where status = 'active';

-- 6) Conclusão de sessão (liga à activity) -------------------------------------
create table if not exists public.running_program_session_completion (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null
    references public.running_program_enrollment(id) on delete cascade,
  program_session_id uuid not null references public.running_program_session(id),
  activity_id uuid not null references public.activities(id),
  completed_at timestamptz not null default now(),
  constraint running_program_session_completion_unique
    unique (enrollment_id, program_session_id)
);

-- Índices de leitura
create index if not exists running_program_published_idx
  on public.running_program (is_published, level, goal);
create index if not exists running_program_session_program_idx
  on public.running_program_session (program_id, week_index, order_in_week);
```

- [ ] **Step 2: RLS + grants** (no mesmo arquivo). Conteúdo: `revoke all from anon`; `grant select to authenticated`; policy de leitura `using ((origin='official' and is_published) or owner_user_id = (select auth.uid()))` nas 3 tabelas de conteúdo pai; as filhas (`_step`, `_program_session`) fazem policy por join no pai. Estado: RLS dono-só (`user_id = (select auth.uid())` direto no enrollment; via join no completion). Escrita das tabelas de conteúdo: só `service_role`.

- [ ] **Step 3: RPCs** (espelhar o padrão `private.<fn>` security-definer + wrapper `public.<fn>` security-invoker + `revoke`/`grant execute to authenticated`, como `save_running_workout_plan`):
  - `enroll_in_running_program(p_program_id uuid) returns uuid`
  - `complete_program_session(p_enrollment_id uuid, p_program_session_id uuid, p_activity_id uuid) returns void` (valida ownership do enrollment + activity + pertinência da sessão ao programa; se última, `status='completed'`)
  - `abandon_running_program(p_enrollment_id uuid) returns void`

- [ ] **Step 4: Validar sintaxe sem aplicar.** Rodar apenas o parser local se houver; senão, revisão visual + `git diff --check`. **NÃO** rodar `apply_migration`.

- [ ] **Step 5: Commit** (pausar e pedir ok):
```bash
git add supabase/migrations/<timestamp>_running_coach_library.sql
git commit -m "feat(running): D1 schema — library, programs, enrollment (not applied)"
```

### Task 1.2: Tipos do domain + mappers

**Files:**
- Create: `packages/core/src/domain/running-library.ts`
- Test: `packages/core/src/domain/running-library.test.ts`
- Modify: `packages/core/src/domain/index.ts`

- [ ] **Step 1: Escrever o teste dos mappers** (`running-library.test.ts`) — dado uma row snake_case de `running_session_template` + steps, `runningSessionTemplateFromRow` produz o objeto camelCase esperado; idem programa. Seguir o padrão de `running.ts`/`activity.ts`.
- [ ] **Step 2: Rodar → falha** (`npx vitest run packages/core/src/domain/running-library.test.ts`) — Expected: FAIL (módulo não existe).
- [ ] **Step 3: Implementar tipos + mappers** em `running-library.ts`: `RunningSessionTemplate`, `RunningSessionTemplateStep` (reusar o tipo de step de `running.ts`/`running-session.ts` se já existir — DRY), `RunningProgram`, `RunningProgramSession`, `RunningProgramEnrollment`, `RunningProgramSessionCompletion`, e `*FromRow`.
- [ ] **Step 4: Exportar** em `domain/index.ts`.
- [ ] **Step 5: Rodar → passa.**
- [ ] **Step 6: Commit** (pedir ok): `feat(running): D1 domain types + mappers`.

### Task 1.3: Funções puras (o núcleo testável)

**Files:**
- Modify: `packages/core/src/domain/running-library.ts`
- Test: `packages/core/src/domain/running-library.test.ts`

- [ ] **Step 1: Testes** para as 4 funções puras:

```ts
// resolveNextProgramSession: menor (week_index, order_in_week) sem completion
test("próxima sessão = menor semana/ordem não concluída", () => {
  const sessions = [
    { id: "a", weekIndex: 1, orderInWeek: 1 },
    { id: "b", weekIndex: 1, orderInWeek: 2 },
    { id: "c", weekIndex: 2, orderInWeek: 1 },
  ];
  expect(resolveNextProgramSession(sessions, new Set(["a"]))?.id).toBe("b");
  expect(resolveNextProgramSession(sessions, new Set(["a","b","c"]))).toBeNull();
});

// computeProgramProgress: % concluído
test("progresso = concluídas / total", () => {
  expect(computeProgramProgress(3, 1)).toEqual({ done: 1, total: 3, pct: 33 });
});

// sessionTemplateToEngineBlocks: steps -> array de bloco que a engine já roda
test("adaptador projeta steps no formato de bloco da engine", () => {
  const blocks = sessionTemplateToEngineBlocks(templateWith2Steps);
  expect(blocks).toHaveLength(2);
  expect(blocks[0].targetBasis).toBe("duration"); // mesmo shape do snapshot atual
});

// buildRunningTimeline: colapsa repetição + cor por tipo
test("timeline colapsa 6× num nó só com repetição", () => {
  const nodes = buildRunningTimeline(stepsWithInterval6x);
  const interval = nodes.find(n => n.stepType === "interval");
  expect(interval?.repetitions).toBe(6);
  expect(nodes.length).toBeLessThan(rawStepCount);
});
```

- [ ] **Step 2: Rodar → falha.**
- [ ] **Step 3: Implementar** as 4 funções. `sessionTemplateToEngineBlocks` DEVE produzir exatamente o shape que `GuidedRunningSession` já consome (ler o tipo do snapshot em `running-session.ts` e mapear 1:1 — não inventar campo). `buildRunningTimeline` retorna nós `{ stepType, label, repetitions, effort/zone, colorToken }`.
- [ ] **Step 4: Rodar → passa.**
- [ ] **Step 5: Commit** (pedir ok): `feat(running): D1 pure logic — next session, progress, engine adapter, timeline`.

**Gate da Fatia 1:** `cd apps/web && npx tsc --noEmit` e `cd packages/core && npx vitest run` verdes.

---

## Fatia 2 — Biblioteca + timeline + 2 sessões-farol (primeiro testável)

### Task 2.1: Serviço de leitura da biblioteca

**Files:**
- Create: `packages/core/src/services/runningLibrary.ts` + `.test.ts`
- **Modify: `packages/core/src/services/index.ts`** — registrar o serviço (ESSENCIAL: sem isso `services.runningLibrary` não tipa e o gate quebra)

- [ ] Testes com client mockado (padrão `services/*.test.ts`): `listPublishedSessionTemplates()` e `listPublishedPrograms(filter)` montam a query certa (`.eq('is_published', true)`, filtros de faceta) e mapeiam via os `*FromRow` da Fatia 1. TDD (falha → implementa → passa).
- [ ] **Registrar em `services/index.ts`** espelhando `runningPlans`: `import`, adicionar `runningLibrary: runningLibraryService(client)` no `createGymCircleServices`, e `export * from "./runningLibrary"`. Sem isso o hook da Task 2.3 não typecheck.
- [ ] Commit (ok).

### Task 2.2: `buildRunningTimeline` já testado → render endurecido

**Files:**
- Modify: `apps/web/src/components/gym-circle/workout/RunningPlanPreview.tsx`

- [ ] Trocar o render atual da timeline por consumo de `buildRunningTimeline` (colapso de repetição + cor por `step_type`: aquecimento verde, intervalado laranja, recovery azul, desaquecimento vermelho). Sem nova lógica no componente (ela está testada no domain). Verificar visual no preview (browser pane, viewport mobile). Commit (ok).

### Task 2.3: Hook + Sheet da biblioteca (browse de sessões avulsas)

**Files:**
- Create: `apps/web/src/components/gym-circle/workout/useRunningLibrary.ts` (padrão `useRunningPlans.ts`)
- Create: `apps/web/src/components/gym-circle/workout/RunningLibrarySheet.tsx`
- Modify: `apps/web/src/components/gym-circle/workout/SportCatalogSection.tsx` (entrada Corrida → **Corrida livre / Corrida guiada**; guiada abre `RunningLibrarySheet`)

- [ ] Hook busca sessões/programas publicados via serviço; estado de loading/erro. Sheet: cards + barra de filtro por faceta (filtro no cliente) + empty state por combinação. As **2 sessões-farol** aparecem aqui. Tocar numa sessão → `RunningPlanPreview` (com a timeline endurecida) → "Começar treino guiado". **Handoff pra engine:** a engine consome um `RunningSessionState` de `createRunningSessionState(plan: RunningWorkoutPlan)`, não um array de blocos cru. Então montar um `RunningWorkoutPlan` sintético (id/name/planVersion/estimated*/level/goal/source + os blocos de `sessionTemplateToEngineBlocks`) e chamar `createRunningSessionState`. Verificar no browser pane. Commit (ok).

### Task 2.4: Seed das 2 sessões-farol (arquivo, NÃO aplicar)

**Files:**
- Create: `supabase/migrations/<timestamp+1>_seed_running_coach_library_flagship.sql`

- [ ] Seed `is_published=false`, `origin='official'`, `owner_user_id=null`: **Primeira caminhada** (1 step: `walk`, `target_basis='duration'`, `duration_s=1800`, `target_effort=3`) e **Intervalado leve** (warmup + `interval` `repetitions=6` leve + recovery + cooldown, tudo por esforço, `pace_*` null). **Regra do `_target_check`:** todo bloco precisa de uma medida — mesmo os "por esforço" carregam `duration_s` (nunca emitir `target_basis='effort'` sem `duration_s`/`distance_m`, senão a constraint rejeita). Cabeçalho "do not apply without release gate". Commit (ok).

**Gate da Fatia 2:** tsc + eslint + `npm run build` verdes. **Testável no iPhone só após:** Eduardo aprovar aplicar as duas migrations (schema + seed) em prod + deploy. (Ver "Handoff de release" no fim.)

---

## Fatia 3 — Programa + enrollment + adaptador + 3 programas (blocos de tarefa)

> Expandir em micro-passos TDD ao iniciar a fatia. Arquivos e funções já definidos acima.

- **3.1 RPC wrappers no serviço** (`runningLibrary.ts`): `enroll(programId)`, `completeSession(enrollmentId, programSessionId, activityId)`, `abandon(enrollmentId)`, `getMyEnrollment()`. Testes com client mockado.
- **3.2 Detalhe do programa no Sheet:** estrutura semana a semana (usa `running_program_session` + templates), CTA "Começar programa" (enroll) e, se inscrito, progresso (`computeProgramProgress`) + "Continuar" → `resolveNextProgramSession` → `GuidedRunningSession` (via adaptador) → ao encerrar, `completeSession(...)` com a `activity.id` gerada.
- **3.3 Wire no `WebWorkoutScreen.tsx`:** conectar enroll/continuar/complete ao fluxo guiado existente.
- **3.4 Seed dos 3 programas** (`is_published=false`): Começar a correr (~4 sem, run/walk), Correr 30 minutos (progressão), Primeiro 5 km (~6-8 sem couch-to-5k por esforço). Reutilizar sessões-template entre semanas quando fizer sentido.
- Cada sub-tarefa: TDD onde há lógica pura, gate verde, commit (pedir ok).

---

## Fatia 4 — Revisão de conteúdo

- Tudo seedado `is_published=false`. Eduardo revisa os 5 planos (estrutura, esforços, disclaimer). Publicação = `update ... set is_published=true` (SQL gated, aplicado por ordem dele). Adicionar o **disclaimer** fixo na `RunningLibrarySheet` ("conteúdo educativo, não substitui avaliação profissional; consulte um médico antes de começar").

---

## Handoff de release (o que destrava o teste no iPhone)

Após a Fatia 2 verde e commitada, para o Eduardo testar no iPhone:
1. Eduardo **confirma** aplicar `..._running_coach_library.sql` + `..._seed_..._flagship.sql` em prod (via Supabase MCP `apply_migration`, com verificação de estado antes — checar drift, padrão da sessão).
2. `git push` da Fatia 2 → auto-deploy Vercel (chega no app Capacitor).
3. Eduardo abre Corrida → **Corrida guiada** → biblioteca com as 2 sessões → executa uma → confirma o fluxo guiado + timeline.
4. Só então seguimos para a Fatia 3 (programas).

---

## Riscos
- **Adaptador ≠ shape da engine:** mitigado por teste unitário lendo o tipo real do snapshot em `running-session.ts` (não inventar campos).
- **Drift de migration (padrão Codex):** antes de aplicar, checar o estado real do banco (tabelas/colunas já existem?) — como feito com `activity_health_metadata_v2`.
- **Conteúdo incorreto:** `is_published=false` até revisão humana; esforço, não pace; disclaimer.
