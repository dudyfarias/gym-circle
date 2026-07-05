# Auditoria de GPS, rota e detalhe do treino — 2026-07-04

## Incidente reproduzido

Treino do perfil `dudy`, iniciado aproximadamente às 17:09:

| Fonte | Tempo | Distância | Elevação |
|---|---:|---:|---:|
| Apple Watch | 12:13 | 1,47 km | 4 m |
| Gym Circle | 11:35 | 875,5 m | 22,3 m |

O Gym Circle perdeu aproximadamente 594 m (40,4%) e superestimou a elevação.
O treino foi salvo e ligado corretamente ao post com foto, mas `activities.route`
ficou `null`, portanto a rota histórica não pode ser reconstruída pelo servidor.

## Causas confirmadas

### 1. Passos pequenos eram descartados

O tracker web descartava todo segmento menor que 2 m e, mesmo assim, avançava
a âncora. Em leituras frequentes de caminhada, vários passos sucessivos podiam
somar zero.

### 2. O GPS dependia da tela do cronômetro estar aberta

O `watchPosition` era removido quando o modal fechava/minimizava. O relógio
continuava derivado de `startedAt`, mas a distância parava.

### 3. O Capacitor não possuía gravador nativo

O shell iOS usava o `navigator.geolocation` do WKWebView. Essa API não é um
gravador confiável em background e não havia plugin CoreLocation registrado.

### 4. A rota não atravessava o contrato de persistência

`WebActivityInput`, `ActivityInput` e o insert de `activities` enviavam distância
e elevação, mas não enviavam `route`. Por isso o mapa não tinha dados.

### 5. O detalhe do post perdia o treino em alguns caminhos

`get_home_feed` trazia métricas, mas `get_profile_posts` não. Além disso:

- o overlay web do post não repassava a ação de abrir o detalhe do treino;
- a busca individual do post no Swift reidratava mídia/social, mas descartava
  `source_activity_id` e todas as métricas da atividade.

### 6. Elevação aceitava ruído demais

Variações pequenas de altitude eram acumuladas sem considerar adequadamente a
precisão vertical. Isso explica 22,3 m no app contra 4 m no Apple Watch.

## Correções aplicadas

- Tracker web agora acumula deslocamentos pequenos antes de avançar a âncora.
- Ida e volta sobre a mesma rua são contabilizadas normalmente.
- O tracker web continua ativo ao minimizar o mostrador.
- Sessão local passou a guardar polyline compacta, movimento e precisão.
- `activities.route` passa a receber `[[latitude, longitude], ...]`.
- Novo plugin CoreLocation no Capacitor iOS:
  - funciona em segundo plano;
  - persiste estado durante a sessão;
  - respeita pausa/retomada;
  - filtra precisão, teleporte e ruído de altitude;
  - devolve distância, tempo em movimento, elevação e rota.
- O Swift nativo recebeu os mesmos filtros de precisão.
- `get_profile_posts` agora retorna métricas e rota da activity usando
  `SECURITY INVOKER`.
- Feed, perfil e post individual preservam o vínculo do treino.
- O detalhe web mostra mapa geográfico com tiles OpenStreetMap e polyline.
- O detalhe Swift mostra MapKit com rota, início e fim.

## Limitações e rollout

- O treino já registrado do `dudy` não possui pontos de rota; o mapa só poderá
  aparecer em treinos novos, salvo importação futura de `HKWorkoutRoute`.
- Navegador/PWA puro continua sujeito às restrições de background do sistema.
- O GPS nativo do Capacitor exige uma nova build/TestFlight. Publicar apenas a
  Vercel entrega o fallback web corrigido, mas não instala o plugin CoreLocation.
- Comparação final deve ser feita em aparelho real, simultaneamente com Apple
  Watch, em percurso de ida e volta de pelo menos 1 km.

## Verificações executadas

- TypeScript sem erros.
- ESLint sem warnings.
- 423 testes web/core passando, incluindo regressões de passos pequenos e
  percurso de ida e volta.
- Next.js production build concluído.
- Capacitor iOS compilado para iOS Simulator.
- Swift nativo compilado para iOS Simulator.
- Migration remota aplicada e verificada no projeto Supabase.
