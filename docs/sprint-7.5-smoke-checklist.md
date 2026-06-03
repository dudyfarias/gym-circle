# Sprint 7.5 — Smoke Test iPhone

Data: 2026-06-03
Status: pronto pra validação

## Pré-requisitos

- Pull da branch `main` (commit `04be7a8` ou superior)
- App buildado e rodando no iPhone real (Capacitor)
- User logado com pelo menos 1 post de treino

## Roteiro de validação

### 1. ProfileScreen — Conquistas em Destaque (Sprint 7.5.5)

- [ ] Abrir aba "Perfil"
- [ ] **Esperado**: row "Conquistas em destaque" entre identidade e
  chips de completion (se user tem ≥ 1 achievement earned). Mostra
  até 3 cards com glow ring colorido por categoria.
- [ ] Tap em qualquer card → abre AchievementDetailOverlay full-screen
- [ ] **Edge case**: user sem nenhum earned → row simplesmente não
  aparece (graceful empty).

### 2. AchievementDetailOverlay (Sprint 7.5.2)

- [ ] Tap em achievement abre overlay com animação:
  - Background blur fade-in
  - Card scale 95→100 (cubic-bezier)
  - Spotlight glow radial atrás do ícone
  - Haptic burst no mount
- [ ] Layout:
  - ← close button top-left + share button (disabled)
  - BadgeIcon GIGANTE (size 86) no centro com glow ring
  - Nome (26px font-black)
  - Descrição
  - Stats card opcional (só com detail data — vazio nesta versão)
  - Raridade chip ou "% global" (depende do achievement.rarity)
  - "Como desbloquear" hint quando !earned
- [ ] **Secret + !earned**: HelpCircle 88px + "???" + mystery hint
- [ ] **Locked**: BadgeIcon blur + Lock glassmorphism overlay
- [ ] ← fecha overlay com fade

### 3. MyCircle — Banner welcome (Sprint 7C.3, regressão)

- [ ] Tap nos rings do perfil → abre MyCircleSheet
- [ ] **Primeira visita**: banner azul no topo "Bem-vindo ao seu hub..."
- [ ] Tap no X → banner some, persiste localStorage + DB cross-device

### 4. MyCircle — Badge de destaque (Sprint 5.9, regressão)

- [ ] Seção F mostra card único do badge de destaque (nextBadge ou
  último earned)
- [ ] Tap no card abre AchievementsSheet (Hall da Fama)

### 5. MyCircle — Monthly Challenges (Sprint 7.5.6, NOVO)

- [ ] Seção G entre Badges e Monthly Recap
- [ ] Título: "Desafios de Junho de 2026"
- [ ] 4 rows ordenadas por dificuldade ASC:
  1. Início do Inverno (easy, cyan, target 10)
  2. Mês Consistente (medium, brand cyan, target 15)
  3. Guerreiro de Junho (hard, purple, target 20)
  4. Quase Lendário (legendary, gold, target 25)
- [ ] Cada row: ícone Trophy + título + chip difficulty + descrição +
  progress N/target + progress bar
- [ ] **Progresso real-time**: se user publicar treino novo hoje,
  ao reabrir MyCircle o progress aumenta (sync rola no useEffect)
- [ ] **Edge case**: outros users → seção some (só pro próprio user)

### 6. MyCircle — Recap (Sprint 5.10, regressão)

- [ ] Seção H continua mostrando "Compartilhar resumo de Junho"
- [ ] CTA secundário "Outro mês ou o ano todo →" abre picker

### 7. AchievementsSheet — Hall da Fama (Sprint 7.5.4)

- [ ] Tap "Mais →" no badge highlight (ou tap no card de destaque) abre
  o sheet full-height
- [ ] Header: "Hall da Fama" + X close
- [ ] Hero: barra de progresso "X de Y conquistadas" + %
- [ ] 6 tab chips scroll horizontal: Tudo / Badges / Medalhas / Troféus
  / Relíquias / Desafios
- [ ] Cada tab mostra 3 seções:
  - Conquistados · N (cards coloridos)
  - Próximos · N (cards com progress bar)
  - Bloqueados · N (cards dim + Lock)
- [ ] Tab "Desafios": mostra os 4 desafios mensais com progress
- [ ] Tap em qualquer card → AchievementDetailOverlay
- [ ] KindBadge chip ao lado do label (cor por categoria)
- [ ] **Edge case**: tab sem items → empty state texto centralizado

### 8. AchievementDetailOverlay — Categorias

- [ ] Abrir um Badge → categoria mostra "Badge" chip
- [ ] Abrir um Medal → categoria mostra "Medalha" chip
- [ ] Abrir um Trophy → categoria mostra "Troféu" chip
- [ ] Abrir um Relic → categoria mostra "Relíquia" chip
- [ ] Abrir um Challenge → categoria mostra "Desafio" chip

### 9. Performance

- [ ] LCP de Profile screen < 2s (com 50+ posts)
- [ ] MyCircleSheet abre em < 300ms
- [ ] AchievementsSheet tab switch instantâneo
- [ ] AchievementDetailOverlay anima 60fps suave
- [ ] Monthly challenges sync NÃO bloqueia UI (best-effort async)

### 10. i18n EN ↔ PT-BR

- [ ] Trocar idioma do device pra EN
- [ ] AchievementDetailOverlay: "Achievement" / "Earned" / "Progress"
- [ ] AchievementsSheet: "Hall of Fame" / "All / Badges / Medals /
  Trophies / Relics / Challenges"
- [ ] MonthlyChallenges: "June challenges" / "Easy / Medium / Hard /
  Legendary"
- [ ] FeaturedAchievements: "Featured achievements"

### 11. Dark mode

- [ ] App fundo: #0a0b0c
- [ ] Cards: white/[0.04] a white/[0.08] (subtle elevations)
- [ ] Glows visíveis mas não over-saturated
- [ ] Texto: white com opacity 100% / 72% / 52% / 44% por hierarquia
- [ ] Nenhum elemento azul-escuro hardcoded que quebre no dark

### 12. Compat retroativa

- [ ] User com 0 monthly challenge progress: card mostra todos 4 como
  "não iniciados" com bar 0%
- [ ] User com algum challenge completo: row tem glow + Check icon +
  bar removida
- [ ] User sem nenhum achievement earned: row Featured não renderiza,
  AchievementsSheet mostra empty per tab
- [ ] Sub-fases anteriores (5.x, 6, 7A, 7B, 7C.1-3) seguem funcionando
  sem regressão

## Bugs conhecidos

Nenhum no momento. Reportar via issue se encontrar.

## Próximas sub-fases após smoke OK

- 7.5.3 (skip): assets 3D Spline — você produz quando quiser
- 8.x: SwiftUI Migration absorve animações + arte nativa USDZ
- 9: TestFlight build + Apple Review

## Resultado esperado (Section 20 do brief)

- ✅ Sistema deixou de parecer lista flat de badges
- ✅ Conquistas têm valor social (chip "Conquista secreta", chip de
  categoria diferenciada visualmente)
- ⚠️ Visual 3D pre-rendered não disponível ainda (Sprint 7.5.3
  follow-up async). Fallback 2D BadgeIcon GIGANTE entrega 60% do
  impacto visual.
- ✅ Troféus comparáveis a Awards do Apple Fitness (layout detail
  similar)
- ✅ Relíquias destacadas com glow purple/gold
- ✅ Desafios mensais geram recorrência (4 níveis difficulty)
- ✅ Perfil mais interessante (Featured row + tap → overlay)
- ✅ MyCircle reforça gamificação (highlight + challenges)
- ⚠️ Base pronta pra rankings futuros (DB user_achievements pode
  agregar percentil global em query nova)
- ✅ Compatibilidade total com usuários atuais (zero migration
  destrutiva, achievements derivados)
