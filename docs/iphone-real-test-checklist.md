# Gym Circle — Checklist de Teste em iPhone Real

Use este checklist para validar o Gym Circle rodando como app nativo via
Capacitor/Xcode antes de enviar para TestFlight.

## Preparação

```bash
npm run build
npm run cap:sync:ios
npm run cap:open:ios
```

No Xcode:

1. Abrir o target `App`.
2. Em `Signing & Capabilities`, selecionar sua Apple Developer Team.
3. Confirmar `Bundle Identifier`: `com.gymcircle.app`.
4. Confirmar `Signing`: `Automatically manage signing`.
5. Confirmar capability `Push Notifications`.
6. Confirmar `Deployment Target`: iOS 15.6 ou superior.
7. Conectar o iPhone real.
8. Selecionar o iPhone como destino.
9. Clicar em `Run`.

Observação: `DEVELOPMENT_TEAM`, certificados, provisioning profiles e arquivos
de signing são locais da conta Apple e não devem ser commitados.

## Smoke test nativo

- [ ] App instala no iPhone real.
- [ ] App abre sem tela branca.
- [ ] Splash screen aparece com fundo preto/branding Gym Circle.
- [ ] Status bar e safe area não cortam o topo.
- [ ] Bottom navigation fica dentro da safe area.
- [ ] Scroll principal não trava.
- [ ] Teclado não cobre input de chat/post.
- [ ] App volta corretamente do background.

## Auth

- [ ] Cadastro com email, username e senha.
- [ ] Login com email + senha.
- [ ] Login com username + senha.
- [ ] Reset de senha abre fluxo correto.
- [ ] Logout funciona.

## Feed e post

- [ ] Feed carrega.
- [ ] Feed respeita posts permitidos/seguidos.
- [ ] Pull to refresh funciona.
- [ ] Câmera abre no fluxo de post.
- [ ] Galeria abre no fluxo de post.
- [ ] Post com foto é publicado.
- [ ] Post com vídeo é publicado.
- [ ] Like/deslike em post atualiza o coração.
- [ ] Comentário em post funciona.
- [ ] Apagar comentário próprio funciona.

## Stories

- [ ] Criar story com foto.
- [ ] Criar story com vídeo.
- [ ] Visualizar story.
- [ ] Story visto fica com anel apagado ao reabrir o app.
- [ ] Curtir story funciona.
- [ ] Coração do story fica electric blue quando curtido.
- [ ] Responder story cria/usa chat 1:1.
- [ ] Menu de 3 pontos abre.
- [ ] Denunciar/silenciar/deixar de seguir funcionam conforme o caso.
- [ ] Apagar story próprio remove a bolha se for o único story.

## Chat

- [ ] Aba chat abre.
- [ ] Lista de conversas carrega.
- [ ] Abrir conversa.
- [ ] Enviar mensagem de texto.
- [ ] Enviar foto no chat.
- [ ] Enviar vídeo no chat.
- [ ] Resposta de story aparece com referência.
- [ ] Contador de não lidas atualiza.
- [ ] Swipe para apagar conversa funciona.

## Localização e check-in

- [ ] Selecionar localização atual pede permissão.
- [ ] Permissão negada mostra estado correto.
- [ ] Localização encontrada pode ser removida antes de postar.
- [ ] Post com localização atual não expõe coordenadas exatas no feed.
- [ ] Check-in em academia funciona.
- [ ] Busca/local de academia funciona.

## Perfil e streak

- [ ] Perfil próprio abre.
- [ ] Avatar aparece e persiste.
- [ ] Perfil público abre ao tocar em usuário.
- [ ] Perfil público mostra posts anteriores permitidos.
- [ ] Streak badge aparece no feed/perfil/stories/chat.
- [ ] Streak acende ao publicar post/story.
- [ ] Badge inativo aparece apagado antes de postar no dia.
- [ ] Roda de streak não sobrepõe textos.

## Segurança social

- [ ] Perfil privado respeita visibilidade.
- [ ] Bloquear usuário.
- [ ] Denunciar usuário.
- [ ] Denunciar post.
- [ ] Denunciar story.
- [ ] Excluir conta.

## Notificações

- [ ] App pede permissão de notificação quando necessário.
- [ ] Notificação de mensagem funciona quando permitido.
- [ ] Notificação de like/story/follow não quebra o app.

## Critérios para liberar TestFlight

- [ ] Nenhum crash em uso básico por 10 minutos.
- [ ] Publicar post leva menos de 10 segundos em rede normal.
- [ ] Câmera, galeria, localização e chat funcionam no device real.
- [ ] Safe areas corretas em todas as abas principais.
- [ ] Não há tela branca ao abrir/reabrir.
