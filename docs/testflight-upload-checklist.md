# Gym Circle — Checklist de Upload TestFlight

Use este checklist depois que o app rodar corretamente no iPhone real.

## App Store Connect

- [ ] Criar app no App Store Connect.
- [ ] Nome: `Gym Circle`.
- [ ] Bundle ID: `com.gymcircle.app`.
- [ ] SKU: `gym-circle-ios-001`.
- [ ] Primary Language: Português (Brasil).
- [ ] Categoria primária: Health & Fitness.
- [ ] Categoria secundária: Social Networking.
- [ ] Privacy Policy URL: `https://gym-circle-rust.vercel.app/privacy`.
- [ ] Terms URL: `https://gym-circle-rust.vercel.app/terms`.
- [ ] Support URL: definir suporte oficial.

## Apple Developer

- [ ] App ID `com.gymcircle.app` criado.
- [ ] Push Notifications habilitado no App ID.
- [ ] Conta Apple Developer ativa.
- [ ] Xcode logado com a Apple Developer Team.
- [ ] Signing automático funcionando no target `App`.

## Antes do Archive

```bash
npm run build
npm run cap:sync:ios
npm run lint
npm test -- --run
npx cap doctor
```

No Xcode:

- [ ] Target `App` selecionado.
- [ ] Bundle Identifier: `com.gymcircle.app`.
- [ ] Team selecionada.
- [ ] Automatically manage signing ligado.
- [ ] Push Notifications visível em Capabilities.
- [ ] Version: `1.0.0`.
- [ ] Build: incrementar a cada upload.
- [ ] Destination: `Any iOS Device`.

## Archive e upload

- [ ] Xcode: `Product > Archive`.
- [ ] Organizer abre com o archive.
- [ ] `Validate App`.
- [ ] Corrigir qualquer alerta bloqueante.
- [ ] `Distribute App`.
- [ ] Selecionar `App Store Connect`.
- [ ] Enviar build.
- [ ] Aguardar processamento no App Store Connect.

## TestFlight

- [ ] Abrir aba TestFlight.
- [ ] Criar grupo `Alpha Gym Circle`.
- [ ] Adicionar testers internos.
- [ ] Adicionar testers externos se necessário.
- [ ] Preencher What to Test.
- [ ] Enviar convite.

Sugestão de texto para `What to Test`:

```text
Teste o loop principal do Gym Circle: login, feed, publicar treino com foto ou
vídeo, stories, streak, chat, localização/check-in, perfil público, denúncia,
bloqueio e exclusão de conta. Reporte qualquer tela branca, crash, problema de
safe area, teclado cobrindo input ou falha ao postar mídia.
```

## Conta demo para review

- [ ] Criar usuário demo.
- [ ] Popular feed/stories para evitar app vazio.
- [ ] Confirmar login com username e senha.
- [ ] Salvar credenciais no App Review Information.

Sugestão:

```text
Username: applereview
Email: review@dudyfarias.com
Senha: definir em cofre seguro e colar apenas no App Store Connect
```

Notas para review:

```text
Login via username ou email. Após login, o app abre direto no feed. Para testar
publicação, toque no botão de câmera na barra inferior. Para stories, toque nas
bolhas superiores. Para mensagens, abra um perfil e toque em mensagem. Para
excluir conta, acesse Perfil > Configurações > Excluir conta.
```

## App Privacy

Preencher conforme `STORE_METADATA.md`.

- [ ] Email.
- [ ] User ID.
- [ ] Fotos e vídeos.
- [ ] Áudio de vídeo.
- [ ] Mensagens.
- [ ] Localização opcional.
- [ ] Interações do app.
- [ ] Diagnósticos/analytics internos.
- [ ] Declarar que dados não são usados para tracking.

## Screenshots e metadata

- [ ] Screenshots iPhone 6.7".
- [ ] Screenshots iPhone 6.5", se exigido.
- [ ] Descrição.
- [ ] Subtitle.
- [ ] Keywords.
- [ ] Age rating.
- [ ] Copyright.
- [ ] Support URL.
- [ ] Marketing URL.

## Critérios para enviar testers

- [ ] Build processado com sucesso.
- [ ] TestFlight instala no seu iPhone.
- [ ] Login funciona no build TestFlight.
- [ ] Post com foto/vídeo funciona no build TestFlight.
- [ ] Stories e chat funcionam no build TestFlight.
- [ ] Sem crash no fluxo principal.
