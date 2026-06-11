# Gym Circle — Dívida Técnica

> Read-only, 11/jun/2026.

## Crítica (pode virar incidente/paralisia)

| Item | Detalhe | Risco | Plano |
|------|---------|-------|-------|
| **Baseline de erros normalizada** | 20 erros tsc (4 .test.ts) + 7 testes vitest falhando + 7 erros ESLint — todo check "passa com ressalvas" há semanas | Regressão nova se esconde no ruído; ninguém nota o 21º erro | Sprint de saúde: zerar os 3 baselines e travar em CI (tsc --noEmit, vitest, eslint --max-warnings) |
| **Gamificação duplicada TS ↔ Swift** | `achievements.ts` vs `AchievementBuilder.swift`; drift multi-tags JÁ existe (B10) | Conquista diverge entre superfícies; cada fix = 2 PRs | Curto: port do fix. Estrutural: regras server-side (RPC) consumidas pelos 2 clients |
| **Seed manual de desafios mensais** | Junho foi seedado por migration; julho NÃO existe | 01/jul: desafios desaparecem do MyCircle/Hall | Gerador + lembrete recorrente (ou RPC de rollover) |

## Média

| Item | Detalhe | Plano |
|------|---------|-------|
| God hook `useSupabaseSocial.ts` (4.658 linhas, 1 agg state) | Re-render global; difícil de testar; PRs colidem | Fatiar por domínio (feed/chat/stories/profile) com selectors — fazer por partes, 1 domínio por sprint |
| God component `GymCirclePreview.tsx` (2.308 linhas) | Todos os sheets/overlays num arquivo | Extrair "SheetHost" + dynamic imports dos pesados |
| `database.types.ts` desatualizado ("symlink quirk" casts em 4+ serviços) | Type safety furada nas tabelas novas | `supabase gen types` + remover casts |
| 59 `select("*")` | Payload e acoplamento de schema | Projetar colunas nas rotas quentes primeiro |
| Fallbacks silenciosos de RPC (`logSurfaceFallback` só com PERF_DEBUG) | Mascara incidente de RPC em produção | Logger com sampling/telemetria mínima em prod |
| `delete_conversation_for_me` + `delete_direct_conversation_for_me` coexistindo | Duplicação de caminho de delete | Consolidar na próxima sprint de chat |
| `goal_kind` aceita valores não implementados (B4) | streak_in_month/perfect_month travam em 0 | Implementar ou constraint no seed |
| Versionamento manual em 3 lugares (package.json x2 + pbxproj) | Erro humano em release | Script `npm run bump` |

## Baixa

| Item | Detalhe |
|------|---------|
| `BadgeIcon.tsx` legado ainda vivo (fallback 2D usado em poucos lugares) — ok manter até o 3D cobrir 100%, depois remover |
| `useGymCircleSocial.ts` (960 linhas) + `mock-data.ts` = modo demo `/demo` via MockHomeWrapper — NÃO é mock vazando em produção (rota separada); manter, mas marcar claramente como demo-only |
| Dirs `output/` (vazio) e `build/` (11MB) na raiz — artefatos; confirmar e remover do disco (já fora do deploy) |
| `ios-native` com 634MB locais (.build/DerivedData) — ignorados; limpar local com `swift package clean` quando precisar de espaço |
| 28 `console.*` em produção — padronizar logger |
| 36 índices sem uso (advisors INFO) — manter até ter volume; revisar em v1.2 |
| Param `_parentCommentId` órfão (B7) |
| Docs: STORE_METADATA/TestFlight checklist atualizados ✓; `docs/gamification-v2.md` precisa absorver as regras novas (multi-tags, grupo a dois) |

## Aceitável (decisão consciente — não mexer)

- Estratégia híbrida-remota (server.url) — é a vantagem competitiva de iteração do projeto hoje.
- Fallback `get_story_tray` legado atrás do lightweight.
- Deps curadas (exhaustive-deps off em handlers estáveis) — padrão documentado no código.
- `user_achievements` public_read (raridade global) — reconfirmar como decisão de produto.

## Dívida que pode virar risco (radar)

1. Recompute de desafios client-side (web-only) → mover pra server quando o nativo crescer.
2. Feed sem virtualização → vira problema real com usuários heavy (>100 posts carregados).
3. Edge function de push chamada por trigger síncrono → fila/batch antes de campanhas em massa.
4. Workflow dual-agente (Codex + Claude) no mesmo main — guard-rails existem (check:main, pre-push, .vercelignore) e seguraram desde 10/jun; manter disciplina de checar deploys antes de caçar bug.
