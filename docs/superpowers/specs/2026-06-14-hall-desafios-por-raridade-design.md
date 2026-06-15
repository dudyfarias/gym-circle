# Design — "Tudo é desafio, agrupado por raridade"

**Data:** 2026-06-14
**Status:** Aprovado (brainstorming) — pronto pro plano de implementação
**Escopo:** Web (apps/web). Nativo SwiftUI = passe de paridade seguinte.

## Problema

O Hall da Fama (`AchievementsSheet`) agrupa as conquistas por **categoria**
(badge / medalha / troféu / relíquia / desafio) — 5 "kinds". O Eduardo quer
acabar com essa distinção: **tudo vira "desafio"** e o agrupamento passa a ser
por **raridade**. Além disso, hoje os desafios mensais **pulam o tier "raro"**
(a dificuldade mapeia fácil→comum, médio→incomum, difícil→épico, lendário→
lendário — sem azul). Eduardo quer que desafios possam ter **todas as 5
raridades**.

Pré-requisito já entregue (Sprint 19): a **cor** dos artefatos já vem da
raridade (`RARITY_TONE` = stone/emerald/sapphire/amethyst/amber =
cinza/verde/azul/roxo/laranja), e medalhas perderam bronze/prata/ouro.

## Decisões (travadas no brainstorming)

1. **Forma = raridade** (opção "C"): a silhueta do artefato passa a codificar a
   raridade. A distinção de categoria some do visual.
2. **Desafio carrega raridade direto** (5 níveis), no lugar de `difficulty`.
   Migração 1:1 preserva pontos; "raro/azul" abre pra novos desafios.
3. **Vocabulário:** título da tela continua **"Hall da Fama"**; os itens passam
   a ser chamados **"desafios"** na copy.
4. **Ordem das faixas:** do mais raro pro mais comum (Lendário → Épico → Raro →
   Incomum → Comum).
5. **Os 5 `kind` continuam internos** (chave do banco `kind:id`), mas não
   guiam mais nem visual nem agrupamento.

## A escada de formas (raridade → silhueta)

| Raridade | Forma | Implementação CSS | Tom (Sprint 19) | Pontos |
|---|---|---|---|---|
| common | **disco** | `border-radius: 50%` | stone (cinza, sem glow) | 1 |
| uncommon | **quadrado** | `border-radius: 22%` | emerald (verde) | 2 |
| rare | **hexágono** | `clip-path: polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)` | sapphire (azul) | 3 |
| epic | **escudo** | `clip-path: polygon(10% 6%,90% 6%,90% 50%,50% 100%,10% 50%)` | amethyst (roxo) | 5 |
| legendary | **estrela** | `clip-path: polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)` | amber (laranja) | 10 |

Nas formas de clip-path, o clip aplica-se ao **shell** do artefato — os overlays
de brilho internos herdam o recorte do pai (não precisam de `rounded-[inherit]`).
Disco/quadrado seguem com `border-radius` + `overflow-hidden`.

## Mudanças por arquivo (web)

### Modelo / lógica pura
- **`social/achievements.ts`**
  - `ChallengeAchievement`: remove o campo `difficulty`; usa o `rarity` da base
    (sempre setado pra desafio).
  - `AchievementsInput.monthlyChallenges[]`: `difficulty` → `rarity:
    AchievementRarity`.
  - `buildChallenges`: `rarity: c.rarity` direto (remove o ternário de
    difficulty→rarity).
  - `suggestFeaturedAchievements`: `priorityScore` passa a ser só
    `rarityRank` (remove o `kindRank * 10`). `resolveFeaturedAchievements`
    segue igual (composite ids intactos).
  - `kind`, `MedalTier` e `tier` **permanecem** no tipo (inertes) pra não
    quebrar composite ids / chamadas existentes.
- **`social/achievementVisual.ts`**
  - Renomeia `AchievementVisualKind` → `AchievementVisualShape` com valores
    `disc | square | hex | shield | star`.
  - Novo `RARITY_SHAPE: Record<AchievementRarity, AchievementVisualShape>`.
  - `getAchievementVisual`: remove os branches de `kind` (KIND_SHAPE) e de
    `difficulty` (DIFFICULTY_TONE). Passa a: secreto-não-conquistado →
    `{ shape: "disc", tone: "dark", monogram: "?" }` (não vaza raridade);
    senão → `tone = RARITY_TONE[rarity] ?? "stone"`, `shape =
    RARITY_SHAPE[rarity] ?? "disc"`. Lógica de monograma inalterada (mapa
    estático + mês do periodKey pra desafio + target do progresso + 1ª letra).
- **`social/rankingPoints.ts`**
  - Desafio passa a ser pontuado por `rarity` (via `pointsForRarity`).
    `DIFFICULTY_RARITY`/`pointsForDifficulty` ficam órfãos → remover se não
    usados (ajustar `buildScoreBreakdown`).

### UI
- **`design-system/AchievementArtifact3D.tsx`**: `shapeClass` keyed por
  `visual.shape` (5 formas; hex/escudo/estrela via `[clip-path:polygon(...)]`
  do Tailwind, espaços viram `_`). Remove o bloco de alças do troféu
  (`kind==="trophy3d"`) e a rotação/scale de relíquia (`isRelic`). Glow e
  cadeado de locked seguem.
- **`AchievementsSheet.tsx`**:
  - `CATEGORY_ORDER` (kinds) → `RARITY_ORDER = ["legendary","epic","rare",
    "uncommon","common"]`.
  - `SheetView = "overview" | "all" | AchievementRarity`.
  - Filtro de categoria: `a.kind === view` → `(a.rarity ?? "common") === view`.
  - Copy "conquistas" → "desafios" (hero "X de Y", categoryCount). Título
    segue "Hall da Fama". Remove o caso especial `challengesArePersonal`
    (challenges agora se espalham pelas faixas).
- **`design-system/FeaturedAchievementsRow.tsx`**: `TONE_CARD` já é keyed por
  tone — segue. Confirmar que herda a forma nova (vem do artefato).
- **`MonthlyChallengesCard.tsx`**: `DIFFICULTY_ORDER`/`DIFFICULTY_TONE` →
  ordenar/tonalizar por **rarity**; label i18n `monthlyChallenges.difficulty.*`
  → `monthlyChallenges.rarity.*`.
- **`AchievementDetailOverlay.tsx`**: **sem mudança** — já usa `RarityChip`
  (não mostra categoria).

### Dados
- **`social/monthlyChallenges.ts`**: `MonthlyChallengeData.difficulty` →
  `rarity` (5 valores). Select da surface `"difficulty,..."` → `"rarity,..."`.
  Mapper (linha ~165) e `metadata` (linha ~414) passam a usar `rarity`.

### i18n (pt-BR + en)
- `achievementsSheet.tabs.{common,uncommon,rare,epic,legendary}` =
  Comum/Incomum/Raro/Épico/Lendário (Common/Uncommon/Rare/Epic/Legendary).
- `achievementsSheet.categoryDescription.{rarity}` (descrições curtas por
  faixa) — ou remove a linha de descrição.
- `monthlyChallenges.rarity.{...}` labels.
- Copy do Hall: "conquista(s)" → "desafio(s)" onde aplicável (título intacto).

### Banco (migration nova)
- `monthly_challenges`: `ADD COLUMN rarity text CHECK (rarity in
  ('common','uncommon','rare','epic','legendary'))`. Backfill: easy→common,
  medium→uncommon, hard→epic, legendary→legendary. `SET NOT NULL` após
  backfill. **`difficulty` fica** (inerte; nativo depreca depois).
- `private.points_for_achievement`: o branch `challenge:%` passa a ler
  `monthly_challenges.rarity` → CASE common1/uncommon2/rare3/epic5/legendary10.
  Pontos preservados (épico=difícil=5, etc.). `get_circle_ranking` herda sem
  tocar.
- **Auditar consumidores de `monthly_challenges.difficulty`** no banco —
  trigger de push (Sprint 10.7) / edge function APNS. Como `difficulty` fica
  preenchida pros rows atuais e o seeding novo seta **as duas** (difficulty
  derivada + rarity) até o nativo migrar, nada quebra.

### Processo de seed
- **`docs/monthly-challenges-process.md`** (e o template/script de seed do
  dia-25): passar a setar `rarity` (e, na transição, `difficulty` derivada
  pra não deixar a coluna inerte nula em rows novos).

## Testes
- `achievementVisual.test.ts`: reescrever pra shape=raridade (disco/quadrado/
  hexágono/escudo/estrela), remover testes de kind-shape e difficulty-tone;
  secreto = disco neutro escuro "?".
- `achievements.test.ts`: desafio com rarity direto (sem mapping); featured
  ranqueado por raridade.
- `monthlyChallenges.test.ts`: campo `rarity`.
- `rankingPoints.test.ts`: ajustar se `DIFFICULTY_RARITY` sair.
- Verde: `tsc --noEmit` + `eslint` + `vitest run`.

## Escopo & riscos

| Item | Decisão |
|---|---|
| Nativo (Hall, formas, ler rarity) | **Fora** deste passe — paridade seguinte. Não bloqueia. |
| GLB 3D | N/A — artefatos são CSS puro. |
| Secreto não-conquistado numa faixa de raridade | Aparece como "???" na faixa real (mesmo "vazamento" de hoje, que já mostrava a categoria). Artefato neutro escuro — sem vazar forma/cor. Aceito. |
| Coluna `difficulty` órfã | Mantida inerte até o nativo deprecar — sem risco pro web (shipado é web). |
| Drift de pontos | Nenhum — migração 1:1 preserva pontos de todos os desafios existentes. |
| Deploy | Push na main (auto-deploy prod) só com OK explícito do Eduardo. |

## Verificação de aceite (smoke)
- Hall agrupa por raridade (Lendário→Comum); cards e drill-down por faixa;
  copy diz "desafios"; título "Hall da Fama".
- Artefatos: disco/quadrado/hexágono/escudo/estrela por raridade, cor da
  Sprint 19; secreto não-conquistado segue "???".
- Desafio mensal mostra raridade (inclusive um teste "raro/azul"); pontos
  conferem no ranking.
