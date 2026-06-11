# Gym Circle Full App Audit

> **Data:** 11/jun/2026 · **Commit auditado:** `dbaa3d1` (main) · **Modo:** read-only (zero mudanças de produto, zero migrations, zero deploy, zero commits nesta etapa)
> Documentos-satélite nesta pasta: [bug-audit](bug-audit.md) · [performance-audit-v2](performance-audit-v2.md) · [ux-product-audit](ux-product-audit.md) · [security-audit](security-audit.md) · [supabase-audit](supabase-audit.md) · [swiftui-native-audit](swiftui-native-audit.md) · [capacitor-ios-audit](capacitor-ios-audit.md) · [feature-opportunities](feature-opportunities.md) · [technical-debt](technical-debt.md) · [recommended-roadmap](recommended-roadmap.md)

## Resumo Executivo

O Gym Circle está **saudável e em forma de produto real**: v1.1 na App Store, produção alinhada com o main (verificado na Vercel), banco consistente (verificado read-only), build de produção passando, 62 migrations disciplinadas, push ponta-a-ponta, gamificação premium (Hall 3D) e uma fundação SwiftUI séria com 14 telas espelho.

Os três achados que mais importam:

1. **O relógio de julho** — os desafios mensais de junho foram seedados por migration manual; **não existe seed de julho**. Em 01/jul a feature de retenção mais forte do app desaparece silenciosamente. É a única pendência com deadline de calendário.
2. **Baseline de erro normalizada** — 20 erros de tsc + 7 testes falhando + 7 erros de ESLint são "conhecidos e ignorados". Isso já custou caro (regressões reais chegaram a produção neste ciclo) porque sinal novo se mistura ao ruído velho. Zerar e travar é a alavanca nº 1 de qualidade.
3. **Drift da gamificação duplicada (TS ↔ Swift)** — a regra de multi-tags já divergiu entre web e nativo. Enquanto as regras viverem em dois clients, cada fix custa dois PRs e a UX pode contradizer a si mesma. Direção estrutural: regras no server.

Nenhum segredo exposto. Nenhum bug crítico de perda de dados aberto. A maior parte dos bugs relatados historicamente foi corrigida e tem fix verificado em produção.

## Estado Geral do Produto

| Camada | Nota | Comentário |
|--------|------|------------|
| Web app (Next.js + Supabase) | **B+** | Features completas e coesas; dívida concentrada em 2 arquivos gigantes |
| iOS Capacitor (shell) | **A-** | Configuração madura, permissões impecáveis, estratégia híbrida-remota funcionando |
| SwiftUI foundation | **B** | Bem isolada e testável; gaps de config de produção e drift de regras |
| Supabase | **A-** | RPCs de surface, RLS centralizada, advisors limpos exceto hardening de anon |
| Processo/Workflow | **B+** | Guard-rails pós-incidente seguraram; baselines de erro são o ponto fraco |

## Principais Riscos

1. Seed de julho ausente (deadline 01/jul) — *product*.
2. Baselines de erro normalizadas (tsc/vitest/eslint) — *engenharia*.
3. Drift TS↔Swift de gamificação — *consistência*.
4. `resolve_email_for_username` aberto pra anon (enumeração de e-mail) — *privacidade*.
5. Recompute de desafios client-side pode regredir progress com dados parciais (B5) — *dados*.
6. Escala: god hook re-renderiza tudo; feed sem virtualização; push síncrono por trigger — *futuro (10k+)*.

## Bugs Críticos

Nenhum bug **crítico ativo** (perda de dados/crash) foi encontrado. Os de prioridade ALTA estão em [bug-audit.md](bug-audit.md): B1/B2 (suites quebradas), B3 (7× setState-in-effect — provável raiz do flicker de imagens e glitches de stories), B4 (goal kinds não implementados — latente com deadline).

## Quick Wins (≤1 dia cada)

1. Seed julho + lembrete mensal.
2. Leaked-password protection ON (1 clique no dashboard).
3. REVOKE EXECUTE de anon nas 4 funções (security-audit).
4. Badge "+N" no dia do calendário com 2+ posts.
5. Estreitar `allowNavigation` (tirar `*.vercel.app`).
6. Regenerar `database.types.ts`.
7. Fix dos 2 setState-in-effect de imagem (GCImage, StoryViewer).
8. Empty states: hall de terceiro + desafio secreto.

## Performance

Resumo (detalhe em [performance-audit-v2.md](performance-audit-v2.md)): boot em 3 fases instrumentado ✓; RPCs de surface ✓; os gargalos reais são de **render** (god hook de 4.658 linhas com estado único + 7 setState-in-effect), não de banco. 59 `select("*")` para projetar nas rotas quentes. Plano de escala 1k/10k/50k documentado.

## UX e Produto

Resumo (detalhe em [ux-product-audit.md](ux-product-audit.md)): o app **parece premium** (Hall 3D é o highlight) e os fluxos principais são claros; as fricções top são percepção do calendário (1 foto/dia), desafios que só atualizam no boot, e primeira sessão com feed vazio. Onboarding contextual (7C) é um diferencial — estender pras telas novas.

## Segurança

Resumo (detalhe em [security-audit.md](security-audit.md)): **nenhum segredo no repo ou no client** (p8 fora do git, .env ignorado, service role inexistente no front). Ações: hardening de anon (4 fns), leaked-password ON, mover o `.p8` pra fora da pasta, estreitar allowNavigation.

## Supabase

Resumo (detalhe em [supabase-audit.md](supabase-audit.md)): 62 migrations íntegras, 28 RPCs em uso, 1 edge function, RLS centralizada em `private.*`. Pendências: types desatualizados, 2 RPCs de delete de conversa a consolidar, decisão de produto sobre `user_achievements` public_read.

## SwiftUI

Resumo (detalhe em [swiftui-native-audit.md](swiftui-native-audit.md)): fundação isolada e com testes nos builders. Gaps: config de produção (env-only não existe em build de distribuição — hoje o bridge injeta), drift multi-tags a portar, `swift test` só roda com destino iOS (no macOS falha por UIKit — esperado). Caminho pro standalone mapeado com riscos.

## Capacitor/iOS

Resumo (detalhe em [capacitor-ios-audit.md](capacitor-ios-audit.md)): config madura; permissões com strings PT-BR exemplares; versão 1.1.0(6) consistente; `config 2.xml` já não existe; deep links é o gap estrutural (sem Associated Domains).

## Testes — estado e lacunas

**Validações executadas nesta auditoria:**

| Comando | Resultado |
|---------|-----------|
| `npm run build` (apps/web) | ✅ PASSA (11 rotas) |
| `npx vitest run` | ⚠️ 223/230 — 7 falhas em 3 suítes (imageCache×5, authInterface×1, locationSearch×1) |
| `npx tsc --noEmit` | ⚠️ 20 erros (todos em 4 `.test.ts` — fixtures desatualizadas) |
| `npx eslint src` | ⚠️ 7 errors (set-state-in-effect) + 17 warnings |
| `swift test` (host macOS) | ❌ não compila no macOS (`import UIKit`) — esperado; requer destino iOS Simulator |
| `xcodebuild` simulador | ⏭️ **não executado** — pesado e exige resolução local de toolchain; recomendado como `scripts/native-test.sh` em sprint nativa |
| `npx cap sync ios` | ⏭️ **não executado de propósito** — mutaria o working tree (copia assets/pods), violando o read-only desta auditoria |
| `git diff --check` | ✅ limpo |

**Cobertura:** 41 arquivos de teste (web 24 suítes + packages/core 10 serviços + 3 Swift). Bons: serviços core, builders de streak/calendar/achievements/challenges (34 + 9 + 33 casos recentes). **Lacunas recomendadas:** chat delete-for-me (fluxo RPC), notifications CTA routing, stories continuidade entre autores, onboarding persistence (contextual_hints_seen), profile preview vs full merge, AchievementBuilder Swift pós-port multi-tags, e os 7 testes quebrados como prioridade zero.

## App Store

v1.1 publicada; metadados/screenshots/review notes/conta demo prontos (`STORE_METADATA.md` + Sprint 10.6/10.8). Próxima atualização (1.1.x): bump triplo de versão via script, validar `aps-environment` no archive, screenshots novos (Hall 3D, carrossel), release notes com carrossel + Hall + replies. Nenhum risco novo de review identificado (permissões enxutas, privacy/support/terms no ar).

## Oportunidades

Top 5 de [feature-opportunities.md](feature-opportunities.md): (1) automação de desafios mensais, (2) recompute pós-publish, (3) universal links, (4) ranking semanal + shareable Circle card, (5) Meu Treino (v2.0, a aposta de utilidade diária).

## Roadmap Recomendado

Ver [recommended-roadmap.md](recommended-roadmap.md) — 7 dias / 30 dias / 1.1.x / 1.2 / 2.0, com a regra operacional: *deploys → dados → código* antes de qualquer caça a bug.

## Próximas Sprints (sugestão de corte)

1. **Sprint 16 — Saúde & Julho**: seed julho + zerar baselines (tsc/vitest/eslint) + fix setState-in-effect.
2. **Sprint 16.5 — Hardening**: REVOKEs anon + leaked password + allowNavigation + p8 relocation.
3. **Sprint 17 — Gamificação viva**: recompute pós-publish + goal kinds faltantes + badge "+N" calendário + empty states.
4. **Sprint 18 — Build nativo 7**: ports Swift (multi-tags, calendário vídeo) + smoke TestFlight.
5. **Sprint 19 — Growth**: push de recap + universal links (kickoff 1.2).
