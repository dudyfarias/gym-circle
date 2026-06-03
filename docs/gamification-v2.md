# Gym Circle 1.1 — Gamification v2

Data: 2026-06-03
Sprint: 7.5 (CONCLUÍDA — 6 sub-fases entregues)
Status: pronto pra smoke iPhone validation (Sprint 7.5.7)

## Status final por sub-fase

| Sub-fase | Status | Commit principal | Entrega |
|---|---|---|---|
| 7.5.0 | ✅ | `225fd57` | Auditoria + este doc (459 linhas) |
| 7.5.1 | ✅ | `a0d93be` | Foundation: 4 migrations + Achievement union + 21 derivados + 22 tests |
| 7.5.2 | ✅ | `7932106` | AchievementDetailOverlay Apple Fitness style |
| 7.5.3 | ⏸ | — | Assets 3D Spline (Eduardo produz async) |
| 7.5.4 | ✅ | `d16e5f7` | AchievementsSheet Hall da Fama (substitui BadgesSheet) |
| 7.5.5 | ✅ | `485cb66` | Featured Achievements row no ProfileScreen |
| 7.5.6 | ✅ | `04be7a8` | Monthly Challenges service + UI + 4 desafios seed |
| 7.5.7 | 🔄 | (este commit) | Smoke iPhone checklist + spec update |

## Sumário executivo

Transformar o sistema de badges 2D plano (20 itens em 1 hierarquia) em
ecosystem hierárquico com 5 categorias (**Badge / Medal / Trophy / Relic
/ Challenge**), visual 3D pre-rendered, tela de detalhe full-screen estilo
Apple Fitness Awards, e desafios mensais exclusivos.

**Princípio P0**: nada de migration destrutiva. Os 20 badges atuais migram
automaticamente pra categoria `badge` na nova hierarquia. Zero perda de
progresso porque todo o sistema atual é **derivado** de dados sociais
existentes.

---

## Auditoria — Sistema atual

### Localização

| Arquivo | Linhas | Responsabilidade |
|---|---|---|
| `apps/web/src/components/gym-circle/social/gamification.ts` | 392 | `Badge` type, `BadgeIconKey`, `getEarnedBadges`, `getNextBadge`, `countEarnedBadges` |
| `apps/web/src/components/gym-circle/BadgesSheet.tsx` | 300 | Sheet full-height com filter chips (Todos/Conquistados/Próximos/Secretos) |
| `apps/web/src/components/gym-circle/design-system/BadgeIcon.tsx` | 94 | Mapping `BadgeIconKey` → Lucide icon + tint CSS |
| `apps/web/src/components/gym-circle/design-system/AchievementBadge.tsx` | 35 | Pill horizontal legacy (não usado pelo badge system) |

**Decisão de auditoria**: não existe `BadgeService` ou `GamificationService` em
`packages/core`. Tudo é client-side derivacional puro.

### `Badge` type atual

```ts
type Badge = {
  id: BadgeId;           // 20 IDs hardcoded (BadgeId union)
  label: string;
  description: string;
  earned: boolean;        // calculado on-the-fly
  secret?: boolean;
  iconKey: BadgeIconKey;  // 10 icon keys → Lucide
  progress?: { current: number; target: number };
};
```

### 20 badges atuais (categorização informal por comentário)

**Onboarding (1)**: `first-workout`
**Streak progressivos (6)**: `streak-3` / `streak-7` / `streak-14` / `streak-30` / `streak-60` / `streak-100`
**Cadência (3)**: `active-week` / `month-active` / `year-active`
**Volume (1)**: `prolific` (50+ posts)
**Social (4)**: `social` / `popular` / `network` / `community` (followers 10/50/100/200)
**Recovery (1)**: `streak-recovered`
**Secret (4)**: `early-bird` / `night-owl` / `cross-trainer` / `explorer`

### Auditoria DB — tabelas existentes

| Tabela | Rows | Uso pro novo sistema |
|---|---|---|
| `profiles` | 28 | Add JSONB `featured_achievements` (Section 13) |
| `posts` | 87 | Fonte de "primeiro treino", "100 treinos", "prolific", cross-trainer, explorer, secret timing badges |
| `stories` | 68 | Fonte de "primeiro story", "10 stories" (NOVO) |
| `checkins` | 8 | Fonte de "primeiro check-in", "30/100 check-ins" (NOVO) |
| `follows` | 88 | Fonte de "primeiro amigo seguido", social tiers (NOVO + extensão) |
| `post_comments` | 39 | Fonte de "primeiro comentário" (NOVO) |
| `post_participants` | 8 | Fonte de "primeiro treino marcado", "treino em grupo" (NOVO) |
| `story_participants` | 6 | Marcações em stories — futura conquista |
| `user_stats` | 28 | longest_streak (já usado) |
| `user_stats_live` | n/a | View calculada — não usado diretamente pra badges |
| `user_activity_days` | 311 | Fonte da verdade do streak (já usado indireto) |
| `streak_restore_events` | 42 | Histórico de restauradores (já usado) |
| `streak_restored_days` | 8 | Dias específicos restaurados |

**Nenhuma das seguintes existe** (todas precisam ser criadas):
- `monthly_challenges`
- `user_monthly_challenge_progress`
- `user_achievements`

---

## Nova hierarquia

```
Achievement
├── Badge      (conquistas básicas)
├── Medal      (marcos intermediários)
├── Trophy     (conquistas importantes)
├── Relic      (extremamente raras)
└── Challenge  (desafios mensais exclusivos)
```

### Discriminante

Tipo TypeScript discriminado:

```ts
type Achievement =
  | { kind: "badge"; ... }
  | { kind: "medal"; tier: "bronze" | "silver" | "gold"; ... }
  | { kind: "trophy"; ... }
  | { kind: "relic"; ... }
  | { kind: "challenge"; periodKey: string; ... };
```

Categoria é metadata visual (3D asset, glow intensity, animações) — não muda
a fonte de dados.

---

## Mapeamento conceitual

### Badges (categoria `badge`)

Conquistas únicas, baixa raridade. Visual 3D pequeno, pouco brilho.

| ID novo | Source data | Já existe? |
|---|---|---|
| `first-workout` | `posts.count(user) >= 1` | ✅ Sprint 5.3 |
| `first-checkin` | `checkins.count(user) >= 1` | ❌ NOVO |
| `first-story` | `stories.count(user) >= 1` | ❌ NOVO |
| `first-follow` | `follows.count(follower=user) >= 1` | ❌ NOVO |
| `first-comment` | `post_comments.count(author=user) >= 1` | ❌ NOVO |
| `first-tag-accepted` | `post_participants.count(participant=user, status=accepted) >= 1` | ❌ NOVO |
| `first-group-workout` | `posts.count(user, with 2+ accepted participants) >= 1` | ❌ NOVO |

### Medalhas (categoria `medal`)

Marcos intermediários. Visual metal (bronze → prata → ouro). Mais brilho.

| ID | Source | Status |
|---|---|---|
| `streak-3` | `user.longestStreak >= 3` | ✅ existe (era badge) |
| `streak-7` | `>= 7` | ✅ existe |
| `streak-14` | `>= 14` | ✅ existe |
| `checkins-30` | `checkins.count >= 30` | ❌ NOVO |
| `workouts-50` | `posts.count >= 50` | ✅ existe (era `prolific`) |
| `stories-10` | `stories.count >= 10` | ❌ NOVO |

### Troféus (categoria `trophy`)

Conquistas importantes. Visual grande, compartilhável, tela dedicada.

| ID | Source | Status |
|---|---|---|
| `perfect-week` | 7 dias consecutivos numa semana ISO | ❌ NOVO query |
| `perfect-month` | Todos os dias do mês treinados | ❌ NOVO query (extensão do current) |
| `workouts-100` | `posts.count >= 100` | ❌ NOVO threshold |
| `checkins-100` | `checkins.count >= 100` | ❌ NOVO |
| `first-year` | 1 ano completo desde createdAt | ❌ NOVO query |
| `friends-50` | `follows.count >= 50` | ✅ extensão de `popular` |

### Relíquias (categoria `relic`)

Extremamente raras. Visual cristal/diamante/vidro com glow discreto.

| ID | Source | Raridade target |
|---|---|---|
| `circle-master` | 300 dias treinados no ano | <1% |
| `unbreakable` | `longestStreak >= 100` | ✅ existe (`streak-100`) |
| `streak-365` | `longestStreak >= 365` | ❌ NOVO threshold |
| `founder-2026` | `created_at <= 2026-12-31` | ❌ NOVO hardcoded |

### Desafios (categoria `challenge`)

Desafios mensais exclusivos. **Não voltam** — quem ganhou mantém pra sempre,
quem perdeu não recupera.

Estrutura mensal (lançada todo dia 1º):
- **1 fácil** (~70% conseguem) — ex: 10 treinos no mês
- **1 médio** (~30%) — ex: 15 treinos no mês
- **1 difícil** (~10%) — ex: 25 treinos no mês
- **1 lendário** (~1%) — ex: todos os dias do mês

Cada um, quando completado, vira **Troféu exclusivo** (`trophy` com `periodKey: "YYYY-MM"`).

---

## Mudanças necessárias

### Migrations (aditivas, zero-risk)

**Migration 1**: `monthly_challenges` (definições centralizadas)

```sql
create table monthly_challenges (
  id uuid primary key default gen_random_uuid(),
  period_key text not null, -- "YYYY-MM"
  title_pt text not null,
  title_en text not null,
  description_pt text not null,
  description_en text not null,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'legendary')),
  goal_kind text not null check (goal_kind in ('workouts_in_month', 'streak_in_month', 'perfect_month', 'group_workouts', 'distinct_types')),
  goal_target integer not null,
  start_date date not null,
  end_date date not null,
  trophy_id text not null, -- foreign key conceitual pro Trophy gerado
  created_at timestamptz default now()
);

create unique index monthly_challenges_period_difficulty
  on monthly_challenges(period_key, difficulty);
```

**Migration 2**: `user_monthly_challenge_progress` (tracking)

```sql
create table user_monthly_challenge_progress (
  user_id uuid not null references auth.users(id),
  challenge_id uuid not null references monthly_challenges(id),
  progress integer not null default 0,
  completed_at timestamptz,
  primary key (user_id, challenge_id)
);

-- RLS: user lê/atualiza só os próprios
```

**Migration 3**: `user_achievements` (histórico)

```sql
create table user_achievements (
  user_id uuid not null references auth.users(id),
  achievement_id text not null, -- composite key formato: "kind:id" ex: "badge:first-workout"
  earned_at timestamptz not null default now(),
  count integer not null default 1, -- pra achievements re-conquistáveis tipo "perfect-week"
  metadata jsonb default '{}'::jsonb,
  primary key (user_id, achievement_id)
);

-- RLS: público READ (pra ver achievements de outros users), próprio user WRITE
```

**Migration 4**: `profiles.featured_achievements`

```sql
alter table profiles
  add column if not exists featured_achievements jsonb not null default '[]'::jsonb;

comment on column profiles.featured_achievements is
  'Array de até 3 achievement_ids equipados pra mostrar no perfil. Shape: ["relic:circle-master", "trophy:perfect-month", "medal:streak-7"].';
```

### Sistema de tracking (cron / triggers)

Para "Data da conquista" funcionar (Section 15), precisamos detectar
o momento em que cada achievement é EARNED. Duas estratégias:

**A. Trigger-based** (recomendado pra performance):
- Trigger em `posts INSERT` checa se ativou um achievement
- Insert em `user_achievements` se sim, com `earned_at = now()`

**B. Lazy-check no boot**:
- Cliente checa diff entre `getEarnedAchievements(user, data)` e `user_achievements` table
- Insert das diffs com `earned_at = first_qualifying_event.created_at` (precisa query mais cara)

**Recomendação**: B pra MVP (zero trigger code), migrar pra A se ficar lento.

### Conquistas em destaque

`profiles.featured_achievements JSONB` armazena até 3 IDs equipados.
Frontend lê + renderiza no `ProfileScreen`. EditProfile ganha UI pra
escolher entre os achievements já ganhos.

---

## Compatibilidade retroativa

| Sistema atual | Comportamento pós-7.5 |
|---|---|
| 20 badges client-side | Migram pra categoria `badge`/`medal` automaticamente — ver mapping table |
| `Badge` type | Vira `BadgeAchievement extends Achievement` |
| `BadgeIcon` 2D | Continua funcionando pro fallback (3D não carregou ainda) |
| `BadgesSheet` | Vira `AchievementsSheet` (Hall da Fama) — multi-tab por categoria |
| `MyCircleSheet` | Card de destaque agora prioriza por raridade (Relic > Trophy > Medal > Badge) |
| `nextBadge` heuristic | Vira `nextAchievement` cobrindo todas categorias |
| `secret` badges | Continuam — kind: "badge" + secret: true |
| `streak-recovered` | Migra pra medal |

**Garantias**:
- Nenhum user perde achievement já conquistado
- `user_activity_days` continua sendo source of truth do streak
- BadgesSheet legado funciona até `AchievementsSheet` ser entregue (sub-fase específica)

---

## Visual 3D — estratégia

### Por que pre-rendered (PNG/WEBP) vs runtime 3D (Three.js)

**Pros pre-rendered**:
- Zero custo de runtime/GPU (carrega como imagem)
- Compatível 100% com Capacitor + Vercel + SwiftUI nativo (reusa asset)
- LRU cache via `MediaLoadingService` já existente
- Lazy load trivial — só carrega quando entra na viewport
- Funciona em devices low-end sem stutter

**Pros runtime 3D**:
- Interativo (parallax, rotação)
- Tamanho de bundle menor (modelos USDZ pequenos)

**Decisão**: pre-rendered PNG/WEBP com transparency. SwiftUI Sprint 8 pode
opcionalmente substituir por USDZ + RealityKit pra interactividade extra,
mas os mesmos PNGs servem como fallback universal.

### Pipeline de arte

Cada achievement precisa de 3 estados:
- `earned.webp` (1x: 256×256, 2x: 512×512) — visual completo, glow
- `locked.webp` (mesma resolução) — escurecido, com cadeado overlay
- `silhouette.webp` (secret badges não-earned) — apenas silhueta + "???"

**Ferramenta sugerida**: Spline (free tier suficiente pra prototyping)
ou Blender (export PNG com Eevee). Apenas o autor (Eduardo) executa
essa parte — eu posso definir paleta + naming convention.

Estrutura de pasta:
```
apps/web/public/achievements/
  badges/
    first-workout.webp
    first-workout.locked.webp
  medals/
    streak-7.webp
    streak-7.locked.webp
  trophies/
    perfect-month.webp
  relics/
    circle-master.webp
  challenges/
    2026-06-projeto-verao.webp
```

### Componente

```tsx
<Achievement3D
  kind="trophy"
  id="perfect-month"
  earned={true}
  size="lg"  // sm | md | lg | xl
  glow="brand"  // brand | gold | crystal
  className="..."
/>
```

Internal: resolve URL → `<img>` com `loading="lazy"` + LRU cache hook.

---

## Telas / componentes a criar

### 1. `AchievementDetailOverlay.tsx` (Section 21)

Full-screen overlay z-72, igual `PostDetailOverlay` da Sprint 5.11.
Renderiza arte 3D grande + nome + descrição + stats + raridade.

Animações: fade + scale 0.96→1.0 + blur background + haptic("brand").

### 2. `AchievementsSheet.tsx` (Section 14) — Hall da Fama

Substitui `BadgesSheet`. Tabs:
- Badges
- Medalhas
- Troféus
- Relíquias
- Desafios
- Secretos

Cada tab tem 3 sub-grupos: Conquistados / Próximos / Bloqueados.

### 3. `ProfileFeaturedAchievements.tsx` (Section 13)

Row horizontal no `ProfileScreen` com até 3 achievements equipados,
priorizados por raridade. Tap → `AchievementDetailOverlay`.

### 4. `MonthlyChallengeCard.tsx` (Sections 7-11)

Card no `MyCircleSheet` mostrando os 4 desafios do mês corrente com
progresso real-time. Difficulty diferenciado por glow (easy/cyan,
medium/blue, hard/purple, legendary/gold).

---

## Performance (Section 16)

- **Boot**: carrega apenas `featured_achievements` + counts agregados
- **Detail screen**: lazy-load arte 3D só quando overlay abre
- **AchievementsSheet**: virtualized list quando >50 items
- **LRU cache**: reuso de `MediaLoadingService` (Sprint 1 v1.1.1)
- **DB queries**: aggregate counts por tipo (não `select(*)`)
- **Trigger vs query**: lazy-check no boot (estratégia B acima)

---

## Plano de execução

### Sprint 7.5.0 — Auditoria (este documento)

**Status**: ✅ concluído (este documento).

### Sprint 7.5.1 — Foundation: tipos + migrations

- Discriminated union `Achievement` em `social/achievements.ts`
- 4 migrations aplicadas em prod via MCP
- Backfill de `user_achievements` rodando lazy-check no boot
- Mapping table de 20 badges → categorias novas
- TS types em `database.types.ts` + `EnrichedUser`

### Sprint 7.5.2 — Achievement Detail Overlay (sem 3D ainda)

- Componente full-screen com 2D fallback (BadgeIcon grande)
- Layout Apple Fitness style: arte centro + nome + desc + stats
- Raridade computed se há dados suficientes
- Animação fade + scale + blur
- Wire-up no MyCircle/BadgesSheet/Profile

### Sprint 7.5.3 — Arte 3D (assets + componente)

- Eduardo produz primeiro lote de assets (10 prioritários)
- `Achievement3D` component com lazy load + LRU cache
- Substitui BadgeIcon em surfaces críticas
- Fallback 2D continua pra assets não-produzidos

### Sprint 7.5.4 — Hall da Fama (`AchievementsSheet`)

- Tabs por categoria
- Sub-grupos por estado (conquistados/próximos/bloqueados)
- Search/filter
- Migra `BadgesSheet` callsites

### Sprint 7.5.5 — Conquistas em destaque no perfil

- DB write via `setFeaturedAchievement`
- EditProfile ganha picker pra escolher os 3
- ProfileScreen renderiza row horizontal

### Sprint 7.5.6 — Monthly Challenges

- Generator de desafios (1 fácil + 1 médio + 1 difícil + 1 lendário)
- Card no MyCircleSheet
- Trigger de "completion → trophy minted"
- Cron pra finalizar no fim do mês

### Sprint 7.5.7 — Smoke iPhone + ajustes

---

## Roadmap futuro (pós-7.5)

- **Rankings**: top streak / top check-ins por gym / por cidade
- **Comparação social**: "Você vs amigos" em conquistas
- **Compartilhamento**: export PNG do trophy pra Instagram Stories
- **Achievements colaborativos**: "Treinem juntos 30 dias"
- **HealthKit integration**: medals/trophies baseados em kcal/duração (após Sprint 8)
