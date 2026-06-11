# Gym Circle — Auditoria de Segurança

> Read-only, 11/jun/2026. Nenhum segredo é impresso neste documento — apenas arquivo, tipo, risco e recomendação.

## Segredos e arquivos sensíveis

| Item | Estado verificado | Risco | Recomendação |
|------|-------------------|-------|--------------|
| `AuthKey_N5KCS4NUP2.p8` (APNs key) na **raiz do repo** (disco) | NÃO rastreado pelo git (histórico vazio pra `*.p8`), coberto por `.gitignore:24` e `.vercelignore` (`*.p8`, `AuthKey_*.p8`), permissão `600` | **Médio** (só local, mas mora dentro da pasta do projeto — um `git add -f`, zip ou backup da pasta vaza a chave) | Mover pra fora do repo (ex.: `~/.keys/gymcircle/`) e referenciar por caminho; rotação só se houver suspeita de exposição |
| `apps/web/.env.local` | Ignorado (`apps/web/.gitignore:34`); nunca rastreado | Baixo | OK — manter `.env.local.example` sem valores reais |
| `generate-apple-secret.js` | Excluído do payload Vercel via `.vercelignore` | Baixo | OK |
| `ios/App/App/config 2.xml` (citado no escopo) | **Não existe mais** no working tree (já foi limpo) | — | Resolvido; nada a fazer |
| Service role key no client | `grep service_role` em apps/web/src + packages/core = **0 ocorrências** | — | OK — anon key é o único credential no client (correto) |
| Provisioning/DEVELOPMENT_TEAM | Não commitados; regra escrita no CLAUDE.md/AGENTS.md | OK | Manter |

## Advisors Supabase (read-only, 11/jun)

| Achado | Nível | Risco real | Recomendação |
|--------|-------|-----------|--------------|
| `resolve_email_for_username` executável por **anon** (SECURITY DEFINER) | WARN | **Médio-alto: enumeração username → e-mail** (privacidade). É necessária pré-login (login por username), mas hoje devolve o e-mail pra qualquer chamador anônimo | Reescrever pra não retornar o e-mail cru: fazer o sign-in server-side (edge function) ou retornar hash/erro genérico + rate limit |
| `backfill_user_achievements_server_side` executável por **anon** | WARN | Médio: anon pode disparar computação pesada repetidamente (mini-DoS) | `REVOKE EXECUTE FROM anon` (manter authenticated se necessário) |
| `rls_auto_enable` executável por anon/authenticated | WARN | Baixo-médio: função utilitária de DDL não deveria ser API pública | `REVOKE EXECUTE FROM anon, authenticated` |
| `get_achievement_global_stats` executável por anon | WARN | Baixo (vaza % agregado de conquistas) | Revogar de anon, manter authenticated |
| Demais SECURITY DEFINER pra authenticated (`use_streak_restore`, `refresh_my_stats`, `delete_my_account`, `sync_my_streak_restores`) | WARN | Baixo — são da API por design e internamente usam `auth.uid()` | Documentar como intencionais (allowlist) |
| **Leaked password protection DESATIVADA** | WARN | Médio | **Quick win**: ativar no dashboard (HaveIBeenPwned check) — 1 clique, zero código |

> Importante: nenhuma das ações acima foi executada — são recomendações para uma sprint de hardening.

## Superfície do app (Capacitor)

| Item | Estado | Risco | Recomendação |
|------|--------|-------|--------------|
| `allowNavigation: ["*.vercel.app", ...]` | Wildcard amplo — QUALQUER site `*.vercel.app` abre DENTRO do shell do app | Médio (phishing com cara de app) | Restringir a `gym-circle-rust.vercel.app` + `gym-circle-*-dudycappia-4508s-projects.vercel.app` |
| `limitsNavigationsToAppBoundDomains: false` | Escolha documentada (auth externa) | Baixo | OK por ora; reavaliar no app nativo |
| `cleartext: false`, `allowMixedContent: false` | Correto | — | OK |
| `aps-environment: development` no entitlements | O archive de distribuição precisa re-assinar pra `production` | Médio se o pipeline mudar | Item de checklist de release (push já funcionou em TestFlight ⇒ hoje o re-sign acontece) |

## Logs e dados

- 28 `console.log/warn/error` em produção (web src, fora de testes) — maioria `console.warn` de fallback com objetos de erro. Risco baixo, mas error objects do Supabase podem conter detalhes de schema. Recomendação: padronizar num logger com redaction e silenciar em produção.
- Fallbacks de RPC (`logSurfaceFallback`) só logam com `NEXT_PUBLIC_PERF_DEBUG=true` — em produção a falha de RPC fica **silenciosa** e o fallback roda query direta. Não é vazamento, mas mascara incidentes (observabilidade).
- Auth: erros mostrados ao usuário passam por tradução (sem raw dump verificado nas telas de login). OK.

## Privacidade / RLS (modelo)

- Perfil privado: `private.can_view_profile_posts` SECURITY DEFINER centraliza a regra; `canSeeDetails` no client é só UX (server-side garante via RLS) ✓.
- Bloqueios: `private.has_block_between` + filtro client (`blockedSet`) — dupla camada ✓.
- Mensagens: RPCs atômicas + RLS de conversation_participants (migrations 20260507/20260521) ✓.
- Storage: URLs públicas de mídia de post — qualquer um com a URL vê a imagem (modelo Instagram-like). Aceito por design; documentar que perfis privados NÃO protegem a mídia em si (apenas a descoberta). Se quiser proteção real: signed URLs (custo: complexidade + cache).

## Veredito

Nenhum segredo exposto no repositório ou no client. Os itens acionáveis são: (1) hardening dos 4 EXECUTEs de anon, (2) ativar leaked-password protection, (3) estreitar `allowNavigation`, (4) mover o `.p8` pra fora da pasta do projeto.
