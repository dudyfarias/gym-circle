# Gym Circle — Roadmap Recomendado

> Gerado pela auditoria de 11/jun/2026. Priorização = impacto × esforço × risco. Nada aqui foi iniciado.

## Próximos 7 dias (estabilidade + o relógio de julho)

| # | Item | Tipo | Por quê agora |
|---|------|------|---------------|
| 1 | **Seed dos desafios de JULHO/2026** + gerador/checklist mensal | Product | Sem isso, 01/jul os desafios somem (deadline real) |
| 2 | Sprint saúde de checks: zerar tsc (20), vitest (7), eslint (7 errors) | Bugs | Destrava detecção de regressão pra todo o resto |
| 3 | Fix dos 7 `set-state-in-effect` (GCImage/StoryViewer primeiro) | Bugs/Perf | Provável causa do flicker de imagem e glitches de stories |
| 4 | Hardening Supabase: REVOKE anon (4 fns) + leaked-password ON + estreitar `allowNavigation` | Security | 1 sessão de trabalho, risco zero de produto |
| 5 | Port multi-tags pro `AchievementBuilder.swift` (entra no próximo build junto com o fix do calendário nativo dbaa3d1) | Native | Paridade do Hall antes do próximo TestFlight |

## Próximos 30 dias (confiança + percepção premium)

| # | Item | Tipo |
|---|------|------|
| 6 | Badge "+N" no calendário + empty states (hall de terceiro, desafio secreto, feed vazio) | Polish |
| 7 | Recompute de desafio pós-publish (com guard anti-regressão de progress — B5) | Product |
| 8 | Implementar `streak_in_month` + `perfect_month` (B4) — destrava variedade de desafios | Product |
| 9 | Regenerar database.types + remover casts; projetar colunas nos select("*") quentes | Perf/Debt |
| 10 | Push de recap dia 1 + comunicar features escondidas (restaurador, featured, recap) | Growth |
| 11 | TestFlight build 7: fixes nativos acumulados (calendário vídeo, multi-tags, splash novo) | Release |

## Versão 1.1.x (atualização incremental da App Store — ~30-45 dias)

- Tudo acima consolidado.
- Release notes: carrossel multi-mídia, Hall da Fama 3D, respostas em comentários, desafios de julho.
- Checklist release: bump script (3 lugares), validar aps-environment no archive, screenshots novos do Hall.

## Versão 1.2 (growth + alcance)

- **Universal links** (post/perfil) + Associated Domains.
- **Ranking semanal entre amigos** + Shareable Circle card (story IG).
- Preferências de notificação por tipo.
- Moderação mínima (UI de reports).
- Perf: fatiar `useSupabaseSocial` (fase 1: chat ou stories), code-split de sheets, virtualização do feed se necessário.
- Decisão de produto: check-in (fundir no post ou aposentar).

## Versão 2.0 (plataforma)

- **Meu Treino / workout builder** (a feature de utilidade diária).
- **HealthKit** (anéis com dados reais — roadmap doc da Sprint 5.6 como base).
- **Fase nativa SwiftUI standalone** (ordem sugerida: MyCircle → Hall → Profile → Feed read-only), com regras de gamificação movidas pra server-side ANTES (mata o drift TS↔Swift na raiz).
- Android: decidir PWA++ vs nativo conforme tração.
- Admin/analytics dashboard interno.

## Mapa por categoria

- **Bugs**: itens 2, 3, 8 + B5/B7 (bug-audit.md)
- **Polish**: 6, splash teto, micro-motion
- **Performance**: 9, fatiamento do hook, virtualização (1.2)
- **Product**: 1, 7, 8, 10, check-in (1.2), Meu Treino (2.0)
- **Native**: 5, 11, fase standalone (2.0)
- **Growth**: 10, universal links, ranking, shareable card (1.2)

## Regra de ouro operacional (mantida da auditoria)

Antes de caçar qualquer "bug de produção que sumiu/regrediu": conferir deploys da Vercel (incidente Codex 10/jun) → depois dados (SQL read-only) → só então código.
