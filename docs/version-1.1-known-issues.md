# Gym Circle Version 1.1 Known Issues

Data: 2026-05-30

> **ATUALIZAÇÃO 11/jun/2026 (Sprint 16)** — este doc é um snapshot
> histórico; a maioria dos itens abaixo foi RESOLVIDA. Status atual:
>
> | Item original | Status |
> |---------------|--------|
> | Chat reabrindo conversa apagada | ✅ Resolvido — migration `20260521_stabilize_chat_delete_reopen` + RPCs delete-for-me |
> | Overwrite lógico de dados de perfil | ✅ Resolvido — Sprint 11.2 (profile row direto + mergeProfileRows prefere non-null) |
> | Validação local bloqueada (lint/node_modules) | ✅ Resolvido — Sprint 16: tsc 0 erros, vitest 230/230, eslint 0 errors, build passa |
> | Notificações de tag com botões obsoletos | ✅ Resolvido — Sprints 10.5/11.3/11.4 |
> | Comments overlay abrindo com post junto | ✅ Resolvido — Sprint 5.11 (PostDetailOverlay separado) |
> | Apple/Google login ocultos na UI | ✅ Mantido por decisão — protegido por teste (`authInterface.test.ts`) |
> | Story viewed state (ring azul voltando) | ⏳ Re-validar no smoke do build 7 (Sprint 18) |
> | Stories: continuidade entre autores | ⏳ Re-validar no smoke do build 7 — fix provável já no ar (Sprint 16, render-adjust no StoryViewer) |
> | Feed/realtime listeners amplos | ✅ Sem listeners globais hoje (chat = polling; auditoria 11/jun) |
>
> Lista viva de bugs: `docs/audits/bug-audit.md`.

## Criticos

### Chat pode reabrir conversa apagada ou oscilar conversa existente/nova

- Area: chat
- Evidencia: relatos recentes do usuario apos mudanças Supabase.
- Suspeitas: merge de summaries, delete-for-me local vs RPC, fallback antigo `conversation_members`, estado local nao invalidado.
- Arquivos: `ChatScreen.tsx`, `useSupabaseSocial.ts`, `messages.ts`, migration `20260521184212_stabilize_chat_delete_reopen.sql`.
- Prioridade: critica.

### Dados de perfil ja sofreram overwrite logico

- Area: perfil
- Evidencia: docs locais de recovery e relato de dados antigos desaparecidos.
- Suspeita: Preview parcial sobrescrevendo FullProfile/caches.
- Arquivos: `profiles.ts`, `profileRows.ts`, `useSupabaseSocial.ts`, `ProfileScreen`, `EditProfileSheet`.
- Prioridade: critica.

### Validacao local esta bloqueada

- Area: dev/release
- Evidencia: lint falha por `node_modules/function.prototype.name/index.js` ausente; package/package-lock estao modificados.
- Risco: push sem validacao completa.
- Prioridade: critica para release.

### Notificacoes de tag podem mostrar botoes obsoletos

- Area: notificacoes
- Evidencia: screenshot 2026-05-29; hotfix local nao commitado no momento da auditoria.
- Causa: UI listava notificacao sem consultar status atual em participants.
- Prioridade: critica.

### Comments overlay pode abrir com foto/post do feed junto

- Area: comentarios
- Evidencia: relato do usuario; hotfix local nao commitado no momento da auditoria.
- Causa: callback de comment/detalhe e backdrop insuficiente.
- Prioridade: alta.

## Altos

### Apple/Google Login existem no service, mas devem ficar ocultos na UI

- Area: auth
- Risco: reativar sem review/config completa.
- Decisao atual: manter email/senha.

### Story viewed state ja teve regressao

- Area: stories
- Risco: ring azul volta apos fechar/reabrir app.
- Validar localStorage + `story_views` + RPC tray.

### Feed/realtime ainda tem listeners amplos

- Area: performance
- Risco: refresh global e stutter em iPhone.
- Mitigacao: Sprint E.

### Cache local pode mostrar estado antigo

- Area: cache/performance
- Risco: "arrastar para atualizar volta versao anterior".
- Mitigacao: TTL, versionamento, invalidacao apos mutation.

### Midia antiga nao tem thumbnails/posters

- Area: midia
- Risco: video preto no grid, carregamento pesado.
- Mitigacao: fallback existe; backfill futuro.

### Push foundation nao envia push real

- Area: push/native
- Risco: expectativa de notificacoes nativas sem entrega.
- Status: token lifecycle parcial.

## Medios

### `postService.listFeed` e `storyService.listActive` ainda sao fallbacks amplos

- Area: core services
- Risco: futuros devs reutilizarem fluxo legado.
- Recomendacao: marcar como legacy/fallback em docs/codigo depois da estabilizacao.

### `profileService.listSuggested` usa `profiles.select("*")`

- Area: discovery
- Risco: payload desnecessario e preview amplo.
- Recomendacao: usar `get_user_suggestions`.

### Expo scaffold pode confundir roadmap

- Area: mobile
- Risco: dividir foco entre Capacitor release e Expo placeholder.
- Recomendacao: manter como future lab.

### Admin/analytics ainda simples

- Area: admin
- Risco: pouco acompanhamento de alpha/retencao.
- Recomendacao: Sprint futura de internal analytics.

## Baixos

### Alguns componentes visuais acumulam logica demais

- Area: design system
- Exemplo: `SocialPostCard`, `StoryViewer`.
- Risco: manutencao.
- Recomendacao: refactor incremental quando tocar.

### Docs de sprints antigas podem estar desatualizados

- Area: documentacao
- Risco: divergencia entre docs e produto real.
- Recomendacao: referenciar este audit como baseline 1.1.
