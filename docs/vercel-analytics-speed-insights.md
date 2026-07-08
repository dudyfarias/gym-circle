# Vercel Analytics e Speed Insights

Sprint: ativação dos painéis oficiais da Vercel para o Gym Circle.

## Estado inicial

Projeto publicado:

- https://gym-circle-rust.vercel.app

App Next.js:

- App Router em `apps/web/src/app`
- Layout raiz: `apps/web/src/app/layout.tsx`

Antes desta sprint:

- `@vercel/analytics` não estava instalado.
- `@vercel/speed-insights` estava aparecendo no `package.json` raiz, mas não no workspace Next.js (`apps/web`).
- Não havia `<Analytics />`.
- Não havia `<SpeedInsights />`.
- Não havia eventos customizados da Vercel.

Arquivos sujos não relacionados vistos no início e mantidos fora do commit desta sprint:

- alterações da sprint Supabase Performance em `apps/web/src/components/gym-circle/**`
- `ios-native/GymCircleNative/GymCircleNative.xcodeproj/project.pbxproj`
- `android/`
- `ios/App/App/config 2.xml`
- arquivos/docs/migration da sprint Supabase Performance

## Arquivos alterados nesta sprint

- `apps/web/package.json`
- `package-lock.json`
- `apps/web/src/app/layout.tsx`
- `docs/vercel-analytics-speed-insights.md`

## Implementação

Pacotes oficiais instalados no workspace web:

- `@vercel/analytics`
- `@vercel/speed-insights`

Imports adicionados no layout raiz:

```tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
```

Componentes adicionados uma única vez no `<body>`:

```tsx
<Analytics />
<SpeedInsights />
```

Eles ficam fora dos providers do app para evitar remounts desnecessários.

## Privacidade

Esta sprint usa apenas os componentes oficiais da Vercel.

Não foram adicionados:

- custom events;
- user id;
- e-mail;
- nome;
- CPF;
- token;
- conteúdo de chat;
- localização precisa;
- dados de saúde/treino em payloads.

Se eventos customizados forem adicionados no futuro, devem ser agregados e sem PII.

## Como validar no painel da Vercel

Depois do deploy production READY:

1. Abrir https://gym-circle-rust.vercel.app
2. Navegar por algumas telas:
   - `/`
   - perfil
   - feed
   - treino
   - post, se possível
3. Conferir na Vercel:
   - Analytics: visitors/page views
   - Speed Insights: FCP, LCP, INP, CLS e TTFB

Observações:

- Os dados podem levar alguns minutos para aparecer.
- Ad blockers podem bloquear a coleta; testar em navegador/aba sem extensão se necessário.
