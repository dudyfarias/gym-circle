# Gym Circle Version 1.1 Opportunities

Data: 2026-05-30

## Quick wins

| Oportunidade | Impacto | Esforco | Observacao |
| --- | --- | --- | --- |
| Consolidar hotfixes de comments/notifications em commit proprio | alto | baixo | Evita regressao visual imediata |
| Limpar ambiente local e rodar validacao completa | alto | baixo | Pre-condicao para deploy seguro |
| Marcar services legados/fallback em comentarios | medio | baixo | Evita uso acidental |
| ProfilePreview/FullProfile types explicitos | alto | medio | Evita novo incidente de dados |
| Smoke test chat delete/reopen | alto | medio | Maior risco social atual |
| Notification tag status via participants | alto | baixo | Ja tem base no hotfix local |
| Followers/following overlay no perfil | medio | baixo | Ja existe `FollowListOverlay` |

## Feed

- Janela temporal de 48h no `get_home_feed`.
- Update local por post afetado para likes/comments.
- Skeleton + cache stale curto.
- Melhor "load more" sem resetar scroll.

Impacto: alto
Esforco: medio

## Stories

- Manter tray ultra leve e viewer sob demanda.
- Auto-advance robusto entre usuarios.
- Persistencia de viewed state testada em cold start.
- Tag accepted/rejected sem notificacoes obsoletas.

Impacto: alto
Esforco: medio

## Perfil

- Card de completar perfil somente no perfil, dismiss persistente.
- Separar contrato `FullProfile` vs `ProfilePreview`.
- Followers/following overlay.
- Ultimo post + grid com thumbnail/poster.

Impacto: alto
Esforco: medio

## Meu Circle

- Posicionar como hub de consistencia.
- Calendario mensal simples.
- Restauradores disponiveis + countdown.
- Monthly recap compartilhavel.

Impacto: medio/alto
Esforco: medio

## Chat

- Garantir idempotencia de direct conversation.
- Delete-for-me confiavel.
- Busca de usuarios por username/display name com follow context.
- Paginar historico antigo ao subir.

Impacto: alto
Esforco: medio/alto

## Notificacoes

- Bell social limpo: follows, likes, comments, tags.
- Estado correto dos CTAs de follow/tag.
- Preparar mapeamento notification -> deeplink futuro.

Impacto: alto
Esforco: medio

## Localizacao/Academias

- Melhorar deduplicacao de locais recentes/proximos.
- Exibir distancia aproximada com privacidade.
- Preparar Apple MapsProvider real sem trocar provider atual.

Impacto: medio
Esforco: medio

## Gamificacao

- Badges sociais leves.
- Ranking semanal somente entre amigos.
- Share mensal estilo Strava.
- Haptic/celebracao quando streak acende ou restore salva.

Impacto: alto
Esforco: medio/alto

## Performance

- Cache local com TTL por surface.
- Backfill de thumbnails/posters.
- Realtime por surface ativa.
- Prefetch idle de chunks mais provaveis.

Impacto: alto
Esforco: medio

## Native feel

- Haptics calibrados por acao.
- Keyboard e safe area revisados nos sheets.
- Camera/gallery native first.
- Push token lifecycle robusto.

Impacto: medio/alto
Esforco: medio

## Oportunidades que devem esperar

- HealthKit completo.
- Apple/Google Login na UI.
- App Expo/React Native completo.
- Ranking publico por academia.
- Transcoding pesado de video.
- Push real para todos eventos sem deep link testado.
