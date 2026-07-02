# Rastreio de treino — Fase 1, Slice 1 (fundação + tracker web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação de dados de `activities` + o "Iniciar treino" enxuto do web (cronômetro + timer de descanso + aviso), com a atividade virando post (`source_activity_id`) e marcando o dia/streak — ponta a ponta e testável.

**Architecture:** Nova tabela `activities` (fonte da atividade) + coluna `posts.source_activity_id` (espelha `source_checkin_id`) + trigger que marca `user_activity_days`. No web, o botão `+` central abre um hub (Iniciar treino / Postar treino / Check-in); "Iniciar treino" no web é um cronômetro + timer de descanso programável com aviso de precisão. Ao encerrar, cria uma `activity` (`origin=web_timer`) e oferece virar post. Tudo reusa o design system atual (`--gc-*`, `SocialPostCard`, os sheets).

**Tech Stack:** Supabase Postgres (migration via MCP `apply_migration`), `packages/core` (TS puro + Vitest), `apps/web` (Next.js 16 + react-i18next + Tailwind vars), preview via `preview_*`.

**Regras do projeto (CLAUDE.md):** branch `main`; `npm run check:main` antes de editar/deployar; `npm run deploy:preview` pra verificação; `deploy:prod` só quando o Eduardo pedir; nunca commitar segredos. Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

## Decomposição da Fase 1 (contexto)

- **Slice 1 (ESTE plano):** fundação de dados + tracker web enxuto.
- Slice 2: nativo — hub `+` + seletor de tipo + sessão de academia (`HKWorkoutSession`) + timer de descanso + resumo→post.
- Slice 3: nativo — import do HealthKit (Strava/Nike) no composer.
- Slice 4: harmonização/paridade fina + push prod.

Spec: `docs/superpowers/specs/2026-07-02-workout-tracking-design.md`.

## Estrutura de arquivos (Slice 1)

- Create: `supabase/migrations/<ts>_activities_foundation.sql` — tabela + `source_activity_id` + triggers + RLS.
- Modify: `packages/core/src/database.types.ts` — tipos gerados (regenerar após migration).
- Create: `packages/core/src/domain/activity.ts` — tipo de domínio `Activity`/`ActivityInput` + mappers puros.
- Create: `packages/core/src/domain/activity.test.ts` — testes dos mappers.
- Create: `packages/core/src/services/activities.ts` — `activityService(client)` (create/list).
- Create: `packages/core/src/services/activities.test.ts` — testes do service (mock client).
- Create: `apps/web/src/components/gym-circle/workout/restTimer.ts` — máquina do timer de descanso (pura).
- Create: `apps/web/src/components/gym-circle/workout/restTimer.test.ts` — testes da máquina.
- Create: `apps/web/src/components/gym-circle/workout/workoutElapsed.ts` — helper de tempo decorrido/format (puro) + teste.
- Create: `apps/web/src/components/gym-circle/CreateHubSheet.tsx` — o hub do `+` (Iniciar/Postar/Check-in).
- Create: `apps/web/src/components/gym-circle/screens/WebWorkoutScreen.tsx` — "Iniciar treino" web (cronômetro + descanso + aviso + encerrar→resumo).
- Modify: `apps/web/src/components/gym-circle/social/supabaseSocialActions.ts` — ação `startWebActivity`/`finishWebActivity` (cria `activity`; reusa `publishWorkout` p/ o post).
- Modify: `apps/web/src/components/gym-circle/social/types.ts` — tipos `Activity*` + assinatura das ações.
- Modify: `apps/web/src/components/gym-circle/GymCirclePreview.tsx` — trocar a câmera central pelo `+` que abre o `CreateHubSheet`; wire das telas.
- Modify: `apps/web/src/i18n/locales/{pt-BR,en}.json` — chaves `workout.*` e `createHub.*`.

---

## Task 1: Migration `activities` (DB)

**Files:**
- Create: `supabase/migrations/<ts>_activities_foundation.sql`
- Reference (ler antes): `supabase/migrations/20260629120000_checkin_counts_as_workout_day.sql` (padrão do trigger de streak), `supabase/migrations/20260701175012_promote_checkins_and_fix_saint_thomas.sql` (padrão do `source_checkin_id`).

- [ ] **Step 1: Escrever a migration** — `activities` + RLS + `posts.source_activity_id` + trigger de validação + trigger de streak. SQL base:

```sql
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  mode text not null,
  origin text not null,
  source_app text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  elapsed_s integer not null default 0,
  moving_s integer,
  distance_m numeric, elevation_gain_m numeric,
  route jsonb, splits jsonb,
  avg_hr integer, max_hr integer,
  active_calories numeric, total_calories numeric,
  workout_date date not null,
  created_at timestamptz not null default now(),
  constraint activities_type_chk check (activity_type in ('strength','run','walk','ride','other')),
  constraint activities_mode_chk check (mode in ('session','route')),
  constraint activities_origin_chk check (origin in ('live','web_timer','imported'))
);
create index if not exists activities_user_date_idx on public.activities (user_id, workout_date desc);
alter table public.activities enable row level security;
create policy activities_select_own on public.activities for select using ((select auth.uid()) = user_id);
create policy activities_insert_own on public.activities for insert with check ((select auth.uid()) = user_id);
create policy activities_update_own on public.activities for update using ((select auth.uid()) = user_id);
create policy activities_delete_own on public.activities for delete using ((select auth.uid()) = user_id);

alter table public.posts add column if not exists source_activity_id uuid references public.activities(id) on delete set null;
create unique index if not exists posts_source_activity_id_unique_idx on public.posts (source_activity_id) where source_activity_id is not null;

-- validação: post e atividade de origem são do mesmo user/dia (espelha validate_post_source_checkin)
create or replace function private.validate_post_source_activity() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare linked public.activities%rowtype;
begin
  if new.source_activity_id is null then return new; end if;
  select * into linked from public.activities where id = new.source_activity_id;
  if not found then raise exception 'atividade de origem não encontrada' using errcode='23503'; end if;
  if linked.user_id is distinct from new.user_id or linked.workout_date is distinct from new.workout_date then
    raise exception 'post e atividade não pertencem ao mesmo treino' using errcode='23514';
  end if;
  return new;
end; $$;
drop trigger if exists posts_validate_source_activity on public.posts;
create trigger posts_validate_source_activity before insert or update of source_activity_id, user_id, workout_date
  on public.posts for each row execute function private.validate_post_source_activity();
```

Pro **trigger de streak**: mirror do check-in — estender a constraint de `source_type` de `user_activity_days` p/ incluir `'activity'`, e criar `activities_after_insert`/`_after_delete` que fazem upsert de `(user_id, workout_date, source_type='activity', has_photo=true)` + o mesmo recalc do check-in. **Ler `20260629120000_*.sql` e replicar a lógica de recalc/backfill** (não reinventar).

- [ ] **Step 2: Aplicar em branch/dev primeiro** — usar o Supabase MCP `apply_migration` num projeto/branch de dev se existir; senão, validar o SQL com `execute_sql` numa transação `begin; ... rollback;`. **Não** aplicar em prod ainda (Slice 1 fecha com deploy:preview; prod só quando o Eduardo pedir).

- [ ] **Step 3: Commit** (só o arquivo .sql; guard antes)

```bash
npm run check:main && git add supabase/migrations/*_activities_foundation.sql && \
git commit -m "feat(db): fundação activities + source_activity_id + streak trigger"
```

## Task 2: Verificar a migration (DB tests)

- [ ] **Step 1** — via `execute_sql` no ambiente aplicado: conferir `activities` existe, RLS ligada, `posts.source_activity_id` existe, os 2 triggers existem.
- [ ] **Step 2** — teste do trigger de validação: inserir uma `activity` (user A, dia X), tentar linkar num `posts` de user B ou dia Y → deve falhar `23514`; mesmo user/dia → passa.
- [ ] **Step 3** — teste do streak: inserir `activity` p/ um user de teste sem check-in no dia → `user_activity_days` ganha 1 linha `source_type='activity'`; inserir check-in no mesmo dia → **não** duplica o dia (dedup). Deletar a activity reverte se não houver outra fonte.

## Task 3: Domínio + tipos (packages/core)

**Files:** Create `packages/core/src/domain/activity.ts` + `activity.test.ts`; regenerar `database.types.ts`.

- [ ] **Step 1: Regenerar tipos** — `mcp generate_typescript_types` (ou script existente) após a migration; conferir `activities` e `posts.source_activity_id` aparecem.
- [ ] **Step 2: Escrever o teste falho** — `activity.test.ts`: `activityRowToDomain(row)` mapeia snake→camel e `activityInputToRow(input, userId)` monta o insert (workout_date derivado de started_at em SP, origin default, campos null quando session).

```ts
import { describe, it, expect } from "vitest";
import { activityInputToRow } from "./activity";
it("session web_timer: só tempo, sem gps/hr", () => {
  const row = activityInputToRow({ activityType:"strength", mode:"session", origin:"web_timer",
    startedAt:"2026-07-02T21:00:00Z", endedAt:"2026-07-02T21:58:00Z", elapsedS:3480 }, "u1");
  expect(row.distance_m).toBeNull();
  expect(row.avg_hr).toBeNull();
  expect(row.workout_date).toBe("2026-07-02");
  expect(row.origin).toBe("web_timer");
});
```

- [ ] **Step 2b** Rodar: `npx vitest run packages/core/src/domain/activity.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `activity.ts` (tipos `Activity`, `ActivityInput`, `ActivityOrigin`, `ActivityMode` + os 2 mappers puros; data em `America/Sao_Paulo` como o resto do projeto).
- [ ] **Step 4** Rodar o teste → PASS.
- [ ] **Step 5: Commit** `feat(core): domínio Activity + mappers + testes`.

## Task 4: `activityService` (packages/core)

**Files:** Create `packages/core/src/services/activities.ts` + `activities.test.ts`.

- [ ] **Step 1: Teste falho** — `activityService(client).create(userId, input)` chama `client.from("activities").insert(row).select("*").single()` e devolve `Activity`. Usar o mesmo padrão de mock de `posts.test.ts`.
- [ ] **Step 2** rodar → FAIL.
- [ ] **Step 3: Implementar** `activities.ts` seguindo o shape de `postService` (mesmo arquivo-vizinho). Métodos: `create`, `recentForUser(limit)`.
- [ ] **Step 4** rodar → PASS.
- [ ] **Step 5: Commit** `feat(core): activityService (create/recent) + testes`.

## Task 5: Timer de descanso (web, lógica pura)

**Files:** Create `apps/web/src/components/gym-circle/workout/restTimer.ts` + `.test.ts` e `workoutElapsed.ts` + `.test.ts`.

- [ ] **Step 1: Teste falho** `restTimer.test.ts` — `restTimerReducer(state, action)`: start(90) → running 90; tick → 89; chega a 0 → `{status:"done"}`; reset volta ao preset. Presets `[60,90,120]` + custom. `workoutElapsed.ts`: `formatElapsed(3480)` → `"58:00"`, `formatElapsed(3720)` → `"1:02:00"`.
- [ ] **Step 2** rodar → FAIL.
- [ ] **Step 3: Implementar** as duas funções puras (sem timers reais — o componente chama `tick` num `setInterval`; a lógica é pura e testável).
- [ ] **Step 4** rodar → PASS.
- [ ] **Step 5: Commit** `feat(web): lógica pura do timer de descanso + elapsed + testes`.

## Task 6: Ação de criar atividade (web)

**Files:** Modify `social/supabaseSocialActions.ts`, `social/types.ts`.

- [ ] **Step 1** — adicionar em `types.ts`: `WebActivityInput` (activityType, startedAt, endedAt, elapsedS) + a assinatura `startWebActivity?`/`finishWebActivity?` no bundle de ações.
- [ ] **Step 2** — em `supabaseSocialActions.ts`, `finishWebActivity(input)`: chama `services.activities.create(currentUserId, {...input, mode:"session", origin:"web_timer"})`; devolve a `activity`. **Reusa** `publishWorkout` (já existe) pro caso "virar post": passa `sourceActivityId` no `CreateWorkoutPostInput` (adicionar o campo opcional, espelhando `sourceCheckinId`). `posts.ts` (core) já grava `source_checkin_id`; adicionar `source_activity_id` no insert do mesmo jeito (1 linha).
- [ ] **Step 3: Verificação** `cd apps/web && npx tsc --noEmit && npx eslint src --ext .ts,.tsx && npx vitest run` → tudo verde.
- [ ] **Step 4: Commit** `feat(web): action finishWebActivity + source_activity_id no post`.

## Task 7: Hub do `+` (web UI)

**Files:** Create `CreateHubSheet.tsx`; Modify `GymCirclePreview.tsx`.

- [ ] **Step 1** — `CreateHubSheet.tsx`: bottom-sheet reusando o padrão dos overlays atuais (mesma estrutura de `role="dialog"` + backdrop + painel `rounded-t-[32px] bg-[#0c0d0e]`). 3 linhas: **Iniciar treino** (ícone cronômetro, azul `--gc-blue`), **Postar treino** (câmera), **Check-in** (pin). Props: `onStartWorkout`, `onPostWorkout`, `onCheckIn`, `onClose`.
- [ ] **Step 2** — em `GymCirclePreview.tsx`, trocar o botão central da bottom-nav (câmera → `+`) e abrir o `CreateHubSheet` no lugar de ir direto ao composer. "Postar treino" mantém o fluxo atual; "Check-in" o atual; "Iniciar treino" abre a `WebWorkoutScreen` (Task 8).
- [ ] **Step 3: Verificação visual** — `preview_start` → `/demo` → abrir o `+` → screenshot + `preview_snapshot` (conferir as 3 opções + aria-labels). Ajustar até bater com o mockup.
- [ ] **Step 4: Commit** `feat(web): botão + vira hub de criar (iniciar/postar/check-in)`.

## Task 8: Tela "Iniciar treino" web + resumo→post (web UI)

**Files:** Create `screens/WebWorkoutScreen.tsx`; Modify `GymCirclePreview.tsx`, locales.

- [ ] **Step 1** — `WebWorkoutScreen.tsx` (data-first, tokens atuais): banner de aviso ("No app fica mais preciso — GPS, batimentos e calorias"), cronômetro grande (usa `workoutElapsed` + `setInterval`), card do timer de descanso (usa `restTimer`, presets 60/90/120 + custom, haptics via `navigator.vibrate` se houver), controles pausar/encerrar. Ao **encerrar** → resumo (duração) + CTA "Adicionar foto do treino" (abre o composer com `sourceActivityId`) + "Salvar sem foto" (chama `finishWebActivity` sem post). Persistir `startedAt` em `localStorage` (anti-refresh).
- [ ] **Step 2** — i18n: adicionar `workout.*` (title, precisionNotice, rest, addPhoto, saveWithoutPhoto, elapsed…) + `createHub.*` em pt-BR e en.
- [ ] **Step 3: Verificação** — `tsc/eslint/vitest` verdes + preview: abrir `+` → Iniciar treino → rodar o cronômetro alguns segundos → descanso → encerrar → resumo → "salvar sem foto" (conferir no console/network que a `activity` foi criada). Screenshot do fluxo.
- [ ] **Step 4: Commit** `feat(web): Iniciar treino enxuto (cronômetro + descanso + resumo→post)`.

## Task 9: Fechamento do Slice 1

- [ ] **Step 1** — rodar tudo: raiz `npx vitest run` (web+core) + `apps/web` `npx tsc --noEmit` + `npx eslint`.
- [ ] **Step 2** — aplicar a migration no **prod DB** só se o Eduardo aprovar (a feature web fica atrás do hub; sem a migration em prod, a action falha — então: ou aplica a migration em prod no deploy, ou mantém a tela atrás de um flag até aprovar). **Decisão de deploy é do Eduardo.**
- [ ] **Step 3** — `npm run deploy:preview` e mandar o link pro Eduardo validar o fluxo web.
- [ ] **Step 4** — atualizar a spec/roadmap se algo mudou; abrir o plano do Slice 2 (nativo).

## Testes (resumo)

- **DB:** validação `source_activity_id` (mesmo user/dia), dedup de dia no streak, RLS de `activities`.
- **Core (Vitest):** mappers de `activity`, `activityService.create`, timer de descanso, `formatElapsed`.
- **Web:** action `finishWebActivity` (tsc + o teste do bundle se existir), verificação de preview do fluxo.
- **Sensores:** N/A neste slice (web não tem GPS/HR).

## Riscos do Slice 1

| Risco | Mitigação |
|---|---|
| Migration em prod quebra o web atual (novo `source_activity_id`) | é aditivo/retrocompat (coluna nullable); a RPC do feed ignora; aplicar só no deploy aprovado |
| Dedup de dia no streak (activity + checkin + post) | trigger espelha o do check-in; Task 2 testa os 3 no mesmo dia = 1 dia |
| Timer perde contagem no refresh (PWA) | `startedAt` no `localStorage` + recomputa do relógio |
| UI destoar do app | reusa tokens/sheets atuais; verificação de preview obrigatória por task de UI |
