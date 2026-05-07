# Gym Circle Mobile Shell

Estrutura preparada para migrar o PWA para Capacitor quando o beta web estiver validado.

## Reuso direto

- `packages/core/src/services`: auth, posts, stories, streak, follows, gyms, push e mensagens.
- `packages/core/src/domain`: regras puras de streak, social e tipos.
- `apps/web/src/components/gym-circle/social`: modelos de UI social e ações.
- Supabase schema e RLS independem da interface web.

## Capacitor

Config inicial: `capacitor.config.json`.

Quando instalar Capacitor:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init Gym Circle app.gymcircle.mobile --web-dir apps/web/out
npx cap add ios
npx cap add android
```

## Permissões nativas previstas

- Câmera: postar feed/story e enviar mídia no chat.
- Fotos/Galeria: selecionar imagem ou vídeo existente.
- Microfone: gravação de vídeo pelo fluxo de câmera.
- Localização: check-in e postagem com local atual.
- Push notifications: mensagens, follow requests, curtidas e comentários.

## Observações

- O PWA atual já usa `capture="environment"` no fluxo de post e chat.
- Push web salva subscriptions em `public.push_subscriptions`; o envio server-side deve usar VAPID privado em uma função futura.
- Para App Store/Play Store, adicionar textos de permissão em `Info.plist` e `AndroidManifest.xml` depois de gerar os projetos nativos.
