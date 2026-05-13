# Gym Circle Mobile Shell

Estrutura preparada para migrar o PWA para Capacitor quando o beta web estiver validado.

## Reuso direto

- `packages/core/src/services`: auth, posts, stories, streak, follows, gyms, push e mensagens.
- `packages/core/src/domain`: regras puras de streak, social e tipos.
- `apps/web/src/components/gym-circle/social`: modelos de UI social e ações.
- Supabase schema e RLS independem da interface web.

## Capacitor

Config oficial: `capacitor.config.ts`.

- `appId`: `com.gymcircle.app`
- `appName`: `Gym Circle`
- `webDir`: `native-fallback`
- `server.url`: `https://gym-circle-rust.vercel.app`

O app nativo usa o deploy Vercel em produção porque o Gym Circle depende de
rotas dinâmicas do Next.js. O `native-fallback` existe para o Capacitor ter um
asset local simples quando não houver conexão.

Quando instalar Capacitor:

```bash
npm run cap:add:ios
npm run cap:build:ios
npm run cap:open:ios
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
- Para iOS, os textos de permissão são aplicados automaticamente por `scripts/patch-ios-permissions.mjs` após `cap:add:ios` e `cap:sync:ios`.
