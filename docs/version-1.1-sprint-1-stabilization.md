# Gym Circle 1.1 - Sprint 1 - Stabilization Release

## Objetivo

Estabilizar os fluxos centrais do Gym Circle antes das proximas evolucoes da versao 1.1. Esta sprint nao adiciona novas funcionalidades grandes; o foco e reduzir regressao, estado antigo reaparecendo, inconsistencia social, cache indevido e instabilidade de build.

## Escopo

- Profile hardening: separar FullProfile de ProfilePreview e impedir perda de dados completos.
- Chat reliability: garantir que conversas apagadas saiam do estado local e sejam reidratadas com segurança.
- Notificacoes: refletir estado real de follows, tags, likes e comentarios.
- Comments overlay: abrir uma superficie dedicada de comentarios, sem renderizar card/midia do feed.
- Feed/stories/cache/RPCs: auditar consolidacao das surfaces e fallbacks.
- Build health: validar dependencias, lockfile, lint, build, testes e Capacitor sync.

## Bugs Criticos

- ProfilePreview parcial podia contaminar FullProfile em cenarios de cache/hidratacao se nao fosse tratado como preview.
- Comentarios ainda renderizavam `SocialPostCard` completo dentro do bottom sheet, trazendo imagem/video e custo de render desnecessario.
- Conversa apagada por ID removia o item localmente, mas nao reidratava o chat em caso de falha do RPC.
- Ambiente local estava com `package-lock.json` fora de sincronia com `apps/web/package.json`, faltando pacotes instalaveis em um install limpo.

## Correcoes Realizadas

- `CommentsBottomSheet` deixou de importar/renderizar `SocialPostCard`; agora mostra apenas contexto textual leve do autor, horario, caption truncada e contagem.
- `GymCirclePreview` removeu props antigas de post embebido no sheet de comentarios.
- `profileRows.test.ts` ganhou cobertura explicita garantindo que preview com `null`/arrays vazios nao apaga `avatar_url`, `bio`, `fitness_goal`, `instagram_username`, `birth_date`, `sports`, `main_gym_id` e `preferred_training_times`.
- `deleteChatConversationById` agora reidrata `refreshChat()` tambem quando o RPC falha, evitando estado local divergente.
- `package-lock.json` foi atualizado via `npm install` para refletir dependencias ja declaradas no workspace web.

## Auditorias

### Perfil

- `profileService.byUserId`, `profileService.byUsername` e `profileService.update` usam `select("*")` para perfil completo.
- `profileService.update` remove apenas `undefined`, preservando campos nao alterados e permitindo `null` apenas quando o usuario limpa um campo intencionalmente.
- `mergeProfileRows` preserva campos completos quando a proxima linha e preview.
- Cache local nao deve ser fonte unica de edicao; o perfil proprio completo continua vindo da query completa.

### Chat

- `get_conversation_summaries` e `get_conversation_messages` sao usados por surface.
- `delete_direct_conversation_for_me` tem fallback legado para marcar `conversation_participants.deleted_at` quando migration remota ainda nao chegou.
- Chat nao tem cache local persistente de mensagens privadas; logout limpa caches nativos.
- Estado local remove a conversa otimisticamente e reidrata o chat apos sucesso ou falha.

### Notificacoes

- O sino usa apenas kinds sociais permitidos.
- Tags aceitas viram estado informativo sem botoes.
- Tags recusadas sao removidas da lista local.
- `hydrateTagDecisions` consulta `post_participants` e `story_participants` para nao mostrar CTAs antigos.

### Comments Overlay

- O sheet de comentarios nao renderiza mais midia, carousel, video, `SocialPostCard` ou `PostDetailSheet`.
- Likes de comentarios, exclusao do proprio comentario e autocomplete de mencoes continuam no proprio overlay.

### Cache/RPCs

- `LocalAppCache` tem TTL curto e `clearNativeFeelCaches()` no logout.
- Chat nao fica em cache local persistente.
- RPCs de feed, stories, chat, perfil, busca e sugestoes permanecem como surfaces separadas com fallbacks.

## Validacoes

Comandos obrigatorios desta sprint:

- `npm run lint`: passou com 3 warnings existentes.
- `npm run build`: bloqueado localmente por travamento do Next/SWC em `Creating an optimized production build ...` mesmo apos limpar `.next` e testar Turbopack/Webpack. O processo ficou sem progresso util e foi interrompido para nao deixar runner pendurado. Vercel deve revalidar o build remoto no deploy.
- `npm test -- --run`: passou, 33 arquivos e 230 testes.
- `npx tsc -p apps/web/tsconfig.json --noEmit`: passou.
- `npx cap sync ios`: executou o sync e exibiu `Sync finished in 0.059s`; o processo do CLI nao encerrou sozinho no Node local e foi finalizado depois da mensagem de sucesso.
- `git diff --check`: passou.

## Regressoes Verificadas

- Perfil: update parcial preserva campos nao alterados.
- Perfil: preview parcial nao apaga full profile.
- Chat: delete-for-me por usuario e por conversation id atualiza estado e reidrata.
- Notificacoes: tag aceita nao mostra aceitar/recusar; tag rejeitada sai da lista.
- Comentarios: abrir comentarios nao renderiza post completo.
- Build: lockfile sincronizado com dependencias declaradas.

## Checklist

- [x] Auditar ProfilePreview vs FullProfile.
- [x] Reforcar teste de merge de profile.
- [x] Auditar update parcial do perfil.
- [x] Auditar chat delete/reopen/realtime.
- [x] Reforcar reidratacao em falha de delete de conversa.
- [x] Auditar notificacoes de tags.
- [x] Remover render pesado do comments overlay.
- [x] Sincronizar lockfile.
- [x] Rodar lint.
- [ ] Rodar build local sem travamento do Next/SWC.
- [x] Rodar testes.
- [x] Rodar typecheck web.
- [x] Rodar Capacitor sync iOS.
- [x] Rodar git diff check.

## Resultado Final

A estabilizacao de codigo foi concluida para perfil, chat, notificacoes e comentarios. O unico bloqueio local remanescente e tooling: `next build` trava no ambiente local atual, enquanto lint, typecheck, testes e sync iOS passaram. O deploy da Vercel precisa confirmar o build remoto antes de considerar a Sprint 1 totalmente fechada em producao.
