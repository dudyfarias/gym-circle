# O que ficou para trás — Sprints 10 → 16

> Pesquisa de 11/jun/2026. Fontes: tracker (110 tasks), git log, comentários "próxima sprint/follow-up" no código, placeholders "Em breve" na UI, e os docs de auditoria das sprints 9.9/known-issues.

## 1. Gaps de numeração (cosméticos — conteúdo foi absorvido, nada perdido)

| Número | O que houve |
|--------|-------------|
| Sprint 10.2 | Nunca existiu. Os P0s #2–#4 do `sprint-9.9-audit-remaining.md` (strings/a11y hardcoded) foram fechados pela 9.9.1 (sweep L10n); a numeração pulou de 10.1 pra 10.3 |
| Sprint 12.2 | Pulado — "Responder"/swipe-delete entraram como parte da 12.1; câmera virou 12.3 |
| Sprint 7.5.3 | Pulado na época do gamification v2 |

## 2. Deixados para trás DE VERDADE (abertos hoje, verificados no código)

### Produto / Web
| # | Item | Origem | Evidência atual | Sugestão |
|---|------|--------|------------------|----------|
| 1 | **Competição no MyCircle** | Sprint 8.12.3 criou o placeholder | `MyCircleSheet.tsx:672` — seção G renderiza "Em breve" até hoje | É o "Ranking semanal" do roadmap → v1.2 (Sprint 19) |
| 2 | **HealthKit** | Roadmap doc Sprint 5.6; P2 #17 da 9.9 | `v1.1-sprint-5-healthkit-roadmap.md` — nunca iniciado | v2.0 (decisão mantida) |
| 3 | Group workouts não contam pra CONQUISTAS (só pra desafios) | `achievements.ts:289` "sub-fase futura" | Comentário vivo no código | Sprint 17 (junto do recompute pós-publish) |
| 4 | Conquistas repetíveis (count>1) — lógica repeatable adiada | `achievementsStats.ts:176` | count=1 fixo | Backlog (baixo) |
| 5 | Tap no nome em ProfileIdentity ("próxima sprint") | `ProfileIdentity.tsx:63` | Anotado, não feito | Backlog (baixo) |
| 6 | Lookback de activity pra navegação antiga do calendário de TERCEIROS (90d bulk / 400 entries) | `useSupabaseSocial.ts:243` "próxima sprint" | Posts por mês resolvido (b1eca76); activity de terceiros segue limitado | Backlog (médio-baixo) |
| 7 | Chaves i18n mortas `settings.account.comingSoon` ("Em breve — alterar e-mail, sair e apagar conta") | locale pt-BR:203/208 | Sem call site (suspend/delete JÁ estão wired) — só lixo | Limpar na Sprint 16 |

### Server / RPCs anotadas como "depois"
| # | Item | Origem | Estado |
|---|------|--------|--------|
| 8 | `monthly_recap_cover_set` RPC | Sprint 8.13.5 ("Sprint 9+") | Ainda read-merge-write client-side |
| 9 | `top_workout_type_in_month` RPC | Sprint 9.5.5 | Ainda group+count client-side (ok até ~500 posts/mês) |

### Nativo (P2s da 9.9 — congelados quando o foco voltou pro web na Sprint 11+)
| # | Item | Evidência |
|---|------|-----------|
| 10 | **Composer nativo** | `MainTabView.swift:44` — empty state literal "Composer nativo fica para a proxima sprint." |
| 11 | **Chat nativo** | `MainTabView.swift:52` — "Mensagens nativas ficam para uma fase futura." |
| 12 | StoriesViews real (hoje viewer parcial) | P2 #14 |
| 13 | FeedScreen completo, PostScreen, CheckIn, Comments, Notifications, FollowList nativos | P2 #12/15/16/18/19/20 |
| 14 | **Réplica nativa do Hall estilo Apple** + earnedMeta no DetailOverlay + 3D no CelebrationOverlay | Follow-ups anotados na Sprint 15 |

> Decisão implícita que vale tornar explícita: a migração nativa foi **pausada de propósito** na Sprint 11 pra acelerar features web. Não é esquecimento — mas precisa de data pra retomar (proposta: fase 2.0 do roadmap).

### Validações pendentes da known-issues (30/mai)
| # | Item | Estado |
|---|------|--------|
| 15 | Story viewed state (ring azul voltando após reabrir) | Nunca re-validado formalmente — incluir no próximo smoke |
| 16 | Continuidade de stories entre autores | Re-validar junto do fix B3 (setState-in-effect no StoryViewer) |

### Docs que "gritam" pendência mas estão DESATUALIZADOS (limpar pra não confundir)
| Doc | Problema |
|-----|----------|
| `sprint-9.9-audit-remaining.md` §4 | Checklist App Store todo em ❌ — mas screenshots/copy/demo account/support URL foram FEITOS (Sprints 10.6/10.8/11.5) e a v1.1 está na loja |
| `version-1.1-known-issues.md` | Dos 5 críticos, 4 foram resolvidos (chat reopen → migration 20260521; profile overwrite → 11.2; notificações tag → 10.5; comments overlay → 5.11); manter só os 2 de stories |
| 334 checkboxes `- [ ]` em 9 docs | Maioria = checklists de smoke manuais antigos; arquivar ou marcar como históricos |
| `docs/gamification-v2.md` | Não absorveu regras novas (multi-tags, grupo a dois) |

## 3. Conclusão

Entre as Sprints 10 e 16 **nenhuma feature prometida ao usuário ficou perdida** — os "buracos" de numeração foram absorções. O que ficou aberto de verdade se divide em: (a) **1 placeholder visível** (Competição), (b) **a frente nativa inteira pausada** (decisão consciente, sem data de retomada), (c) **6 micro-pendências de código** anotadas como "próxima sprint" e nunca puxadas, (d) **2 validações de stories** nunca re-feitas, e (e) **docs desatualizados** que fazem o aberto parecer maior do que é.

Recomendação: absorver (c)+(e) na Sprint 16 (são pequenas), (a) na Sprint 19/v1.2 como Ranking, (d) no smoke do build 7, e dar data explícita pra (b) no plano v2.0.
