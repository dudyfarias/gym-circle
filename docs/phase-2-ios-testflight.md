# Gym Circle — FASE 2: Capacitor + iOS + TestFlight

Status em 2026-05-13: projeto iOS criado, Capacitor sincronizado, Xcode aberto
e build local iOS validado.

## Produção usada pelo app nativo

- URL: `https://gym-circle-rust.vercel.app`
- Bundle ID: `com.gymcircle.app`
- App Name: `Gym Circle`
- Capacitor config: `capacitor.config.ts`
- Web fallback local: `native-fallback/index.html`

O app iOS carrega a URL de produção da Vercel via `server.url`. Isso preserva
o deploy web/PWA e não quebra Supabase, porque storage/auth continuam em
`*.supabase.co` dentro de `allowNavigation`.

## Comandos validados

```bash
npm run build
npm run cap:add:ios
npm run cap:sync:ios
npm run cap:doctor
npm run cap:open:ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO -quiet build
```

Resultado:

- Next build: verde.
- Capacitor Doctor: iOS OK.
- iOS project: criado em `ios/`.
- Xcode workspace: abriu.
- Bundle ID no projeto Xcode: `com.gymcircle.app`.
- Deployment target: iOS 15.0.
- Version: 1.0.
- Build: 1.
- Supported devices: iPhone.
- Push Notifications capability: configurada no projeto.
- Entitlements: `ios/App/App/App.entitlements`.
- Debug iOS build: verde.
- Release iOS build sem code signing: verde.

## Build local

O runtime iOS 26.5 foi instalado no Xcode e o projeto compila localmente para
device genérico com code signing desativado.

O Archive/TestFlight ainda depende de selecionar a Apple Developer Team no
Xcode, porque esse dado é local da conta Apple e não deve ser versionado no repo.

## Ajustes manuais necessários no Xcode

1. `App > Signing & Capabilities`
2. Team: selecionar conta Apple Developer.
3. Bundle Identifier: confirmar `com.gymcircle.app`.
4. Confirmar Capability: `Push Notifications`.
5. Adicionar `Background Modes` somente se formos usar push/background futuro.
6. Version: `1.0.0`.
7. Build: `1`.
8. Supported Destinations: iPhone.
9. Rodar em iPhone real com cabo ou Wi-Fi debugging.

## Permissões iOS

Aplicadas automaticamente por `scripts/patch-ios-permissions.mjs` em
`ios/App/App/Info.plist`.

- Câmera: publicar foto/vídeo de treino.
- Fotos/Galeria: escolher foto/vídeo do feed, stories e chat.
- Salvar na galeria: salvar mídia publicada quando necessário.
- Microfone: áudio de vídeos.
- Localização: localização atual/check-in, sempre opcional.
- Notificações: mensagens, curtidas, comentários e follows.
- Push entitlement: `aps-environment = development` para builds locais.
- Export compliance: `ITSAppUsesNonExemptEncryption = false`.

## Assets nativos

- App icon nativo: usa `apps/web/public/icons/icon-1024.png`.
- Splash/launch screen: usa `apps/web/public/splash/splash-1170x2532.png`.
- Launch background: preto.
- Status bar: dark style sobre fundo preto via Capacitor.
- Safe areas: tratadas no CSS web e no fallback nativo.

## Checklist de teste em iPhone real

- [ ] Login com email + senha.
- [ ] Login com username + senha.
- [ ] Reset de senha.
- [ ] Feed cronológico.
- [ ] Feed mostra somente pessoas seguidas + bloco de sugestões.
- [ ] Abrir perfil ao tocar no username/avatar.
- [ ] Postar foto no feed.
- [ ] Postar vídeo no feed.
- [ ] Postar story foto.
- [ ] Postar story vídeo.
- [ ] Story visto mantém anel apagado após fechar/reabrir.
- [ ] Curtir/descurtir post com coração electric blue.
- [ ] Curtir story com coração electric blue.
- [ ] Responder story no chat.
- [ ] Criar primeira conversa pelo perfil público.
- [ ] Chat envia texto.
- [ ] Chat envia foto.
- [ ] Chat envia vídeo.
- [ ] Deletar conversa por gesto de swipe.
- [ ] Comentar post.
- [ ] Apagar comentário próprio.
- [ ] Streak acende ao postar feed/story.
- [ ] Badge inativo fica apagado antes de postar no dia.
- [ ] Localização atual solicita permissão.
- [ ] Localização atual salva e não expõe coordenadas exatas no feed.
- [ ] Perfil próprio edita avatar e mantém a foto.
- [ ] Perfil público mostra posts anteriores.
- [ ] Check-in funciona.
- [ ] Notificações pedem permissão.
- [ ] Notificação de mensagem aparece quando permitido.
- [ ] Bloquear usuário.
- [ ] Denunciar usuário/post/story.
- [ ] Excluir conta.
- [ ] Pull to refresh nas abas principais.
- [ ] Bottom nav não sobe indevidamente com teclado.
- [ ] Safe area correta em iPhones com Dynamic Island.

## Checklist App Store Connect

- [ ] Criar App ID `com.gymcircle.app` em Apple Developer.
- [ ] Habilitar Push Notifications no App ID.
- [ ] Criar app no App Store Connect.
- [ ] Nome: `Gym Circle`.
- [ ] SKU: `gymcircle-ios-1`.
- [ ] Categoria primária: Health & Fitness.
- [ ] Categoria secundária: Social Networking.
- [ ] Privacy Policy URL: `https://gym-circle-rust.vercel.app/privacy`.
- [ ] Terms URL: `https://gym-circle-rust.vercel.app/terms`.
- [ ] Support URL: Instagram/suporte oficial.
- [ ] Preencher Privacy Nutrition Labels conforme `STORE_METADATA.md`.
- [ ] Criar demo account para Apple Review.
- [ ] Popular demo account com posts/stories reais.
- [ ] Gerar screenshots 6.7" e 6.5".
- [ ] Xcode `Product > Archive`.
- [ ] `Validate App`.
- [ ] `Distribute App > App Store Connect`.
- [ ] Aguardar processamento do build.
- [ ] Criar grupo TestFlight fechado.
- [ ] Adicionar 20-50 testers.
- [ ] Enviar convite com instruções de feedback.

## Próximo passo operacional

No Xcode, selecionar iPhone real, configurar Team e tocar em Run. Para
TestFlight: `Product > Archive`, validar e distribuir para App Store Connect.
