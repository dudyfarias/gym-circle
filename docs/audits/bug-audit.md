# Gym Circle — Auditoria de Bugs

> Auditoria read-only de 11/jun/2026 (main @ `dbaa3d1`). Nenhum fix aplicado nesta etapa.
> Evidência = verificada nesta auditoria (código, banco read-only, lint/test) ou em sessões de debugging recentes.

## Tabela de bugs

| ID | Área | Bug | Evidência | Impacto | Prioridade | Recomendação |
|----|------|-----|-----------|---------|------------|--------------|
| B1 | Testes/CI | 7 testes vitest falhando em 3 suítes: `imageCache.test.ts` (5), `authInterface.test.ts` (1), `locationSearch.test.ts` (1) | `npx vitest run` → 223/230. As 2 últimas são testes de "source snapshot" (grep no fonte) que driftaram; imageCache parece mock de `Image.decode` desatualizado | Sinal vermelho permanente esconde regressões novas | **Alta** | Sprint de saúde de testes: corrigir mocks do imageCache; substituir testes de source-grep por testes de comportamento |
| B2 | Testes/Types | Baseline de 20 erros `tsc` em 4 arquivos `.test.ts` (likes, profileRows, stories…) — fixtures desatualizadas vs `EnrichedUser`/`GymUser` | `npx tsc --noEmit` → 20 erros, todos em testes | Mesmo efeito do B1: normaliza erro; obriga todo PR a "contar baseline" | **Alta** | Atualizar fixtures (faltam `workoutsThisWeek`, `streakRestoresAvailable`, `contextual_hints_seen`, `featured_achievements`, `monthly_recap_covers`) |
| B3 | UI/Render | 7 erros `react-hooks/set-state-in-effect` (cascading renders): `StoryViewer.tsx:118`, `GCImage.tsx:82`, `PinchZoomImage.tsx:132`, `AchievementCelebrationOverlay.tsx:72`, `AchievementDetailOverlay.tsx:91,104`, `useLocale.ts:32` | ESLint full sweep | Renders em cascata; **candidato a causa-raiz de "imagens piscando preto" (GCImage) e glitches de stories (StoryViewer)** | **Alta** | Sprint dedicada: refatorar pra derived state / `key` remount / event handlers |
| B4 | Desafios | Goal kinds `streak_in_month` e `perfect_month` NÃO implementados no recompute (`monthlyChallenges.ts` → `default: break`) — desafio futuro com esses kinds fica travado em 0 pra sempre | Código + comentário "deferred" | Mês futuro que usar esses kinds repete o bug "desafio não desbloqueia" | **Alta (latente)** | Implementar os 2 kinds OU validar/recusar esses kinds no seed de novos meses |
| B5 | Desafios | `syncChallengeProgress` grava progress **menor** se o recompute rodar com posts parcialmente hidratados (fetch falho/janela incompleta) | Código: `result.progress !== challenge.progress` → upsert sem guard de regressão | Progresso do usuário pode regredir visualmente e no banco | Média | Guard: só persistir quando `result.progress > challenge.progress` ou quando justCompleted (decidir semântica de post deletado) |
| B6 | Calendário/Dados | Posts de vídeo pré-Sprint-13 sem `thumbnail_url`/`poster_url` (dado, não código) — código já protegido em `dbaa3d1`, mas o dia fica sem mini-foto | Query read-only: 1 post de vídeo (08/mai) sem derivados | Célula sólida sem foto | Baixa | Backfill opcional: gerar poster server-side pros vídeos antigos (1 registro hoje) |
| B7 | Comentários | Param `_parentCommentId` declarado e nunca usado em callback (`CommentsBottomSheet.tsx:785`) — checar se algum caminho de reply ignora o parent | ESLint warning | Se real, reply pode cair como comentário raiz nesse caminho | Média (verificar) | Confirmar wiring de reply nesse call site; remover param se for resquício |
| B8 | Push/Release | `aps-environment = development` no entitlements commitado | `ios/App/App/App.entitlements` | Se o archive não re-assinar pra produção, push para de funcionar no TestFlight/App Store | Média (verificar) | Confirmar que o profile de distribuição troca pra `production` no archive; documentar no checklist de release |
| B9 | Feed/Escala | Feed sem virtualização (lista renderiza todos os posts carregados, com mídia) | Leitura de código; sem `react-window`/virtualizer no bundle | Com paginação + uso longo, memória/scroll degradam (WKWebView) | Média (escala) | Virtualizar feed quando passar de ~100 posts em memória |
| B10 | Nativo/Drift | Cross-trainer e contagem de tipos no `AchievementBuilder.swift` usam só a tag primária — fix de multi-tags (f4e1f0b, web) não portado | `distinctWorkoutTypesIn7Days` no Swift; query nativa lê `workout_type` | Conquista aparece earned no web e locked no nativo (inconsistência visível) | Média | Portar regra multi-tags pro Swift na próxima sprint nativa |
| B11 | Hall/Privacy | Hall da Fama de TERCEIROS abre sem `monthlyChallenges` (categoria Desafios vazia) — por regra, mas o card da categoria mostra contagem 0 sem explicação | Código GymCirclePreview (condição own-only) | Confusão leve ("cadê os desafios dele?") | Baixa | Empty-state com texto ("Desafios são pessoais") ou esconder a categoria em hall de terceiro |

## Bugs já relatados — estado atual

| Relato | Estado | Evidência |
|--------|--------|-----------|
| Conversa apagada reaparecendo | **Mitigado** por migration `20260521_stabilize_chat_delete_reopen` + RPC `delete_*_conversation_for_me`; sem repro nesta auditoria | Migrations + RPCs no código |
| Profile preview sobrescrevendo full profile | **Mitigado** — `mergeProfileRows` prefere campos non-null e o row direto entra primeiro (Sprint 11.2) | `useSupabaseSocial.ts` ~2147 |
| Comentários abrindo com post inteiro junto | **Corrigido** na Sprint 5.11 (tap em foto → PostDetailOverlay; comentários separados) | Histórico + código |
| Stories fechando ao terminar usuário | **Suspeito relacionado ao B3** (`StoryViewer.tsx:118` setState-in-effect); monitorar após fix do B3 | ESLint |
| Imagens piscando preto | **Suspeito relacionado ao B3** (`GCImage.tsx:82`) + 5 testes do imageCache quebrados (B1) | ESLint + vitest |
| Cache trazendo estado antigo | Merges idempotentes (`mergeRowsByKey`) reduzem; SW só cacheia estáticos hasheados (HTML é `no-store`) | sw.js lido na íntegra |
| Notificações com CTA errado | Corrigido nas Sprints 11.3/11.4; sem repro | Histórico |
| Dados de perfil vazios/não persistindo | Corrigido (Sprint 11.1/11.2 + EditProfile 9.9.2); sem repro | Histórico |
| Fallbacks legados confundindo RPCs novas | Fallbacks existem por design (`logSurfaceFallback`) e são silenciosos sem `NEXT_PUBLIC_PERF_DEBUG` — risco de mascarar falha de RPC em produção | `useSupabaseSocial.ts:955` |
| Posts sumindo do calendário | **Corrigido** em f88c669 + b1eca76 + dbaa3d1 (hidratação own posts, fetch por mês, vídeo sem thumb) | Sessões 10–11/jun |
| Desafios não desbloqueando | **Corrigido** em f4e1f0b (grupo a dois + multi-tags); B4/B5/B10 são os resíduos | Sessão 10/jun |

## Observações de método

- Produção verificada read-only: deploy atual = tip do main; sem deploys do Codex desde 10/jun.
- Banco verificado read-only (via MCP): consistência posts ↔ user_activity_days = 100% pro usuário principal.
