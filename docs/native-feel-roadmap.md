# Gym Circle Native Feel Roadmap

## Fase 1: Capacitor Premium

Objetivo: fazer o app atual parecer mais nativo sem reescrever a base.

- Haptics leves e consistentes
- Push notification foundation
- Cache local leve com stale-while-revalidate simples
- Câmera/galeria via Capacitor com fallback web
- Safe areas e teclado polidos
- LocationProvider desacoplado do provider atual
- Apple/Google Login continuam fora da interface até nova decisão de produto

## Fase 2: Módulos Nativos Pontuais

Objetivo: trocar apenas as partes que mais ganham com APIs nativas.

### Native Feel Sprint 2

#### A. Push notifications reais

- Envio via Edge Function/server
- Eventos:
  - like
  - follow
  - follow request
  - message
  - story reply
  - streak at risk
- Deep links para tela correta
- Tratamento de token revogado/expirado

#### B. Apple Maps real

- Plugin Capacitor/Swift
- CoreLocation
- MKLocalSearch
- Academias próximas
- Reverse geocoding nativo
- Salvar local no Supabase com coordenadas aproximadas

#### C. Haptics avançado

- Padrões por tipo de ação
- Sucesso/erro/streak com intensidade calibrada em iPhone real
- Redução automática para usuários sensíveis a movimento, se possível

#### D. Media picker avançado

- Vídeo melhor
- Compressão antes do upload
- Progress UI
- Retry upload
- Poster/thumbnail mais confiável

#### E. Cache local avançado

- IndexedDB
- Stale-while-revalidate por surface
- Offline shell
- Últimos feed/stories/profile
- Limpeza por logout e troca de usuário

#### F. Native transitions

- Story viewer
- Post composer
- Profile sheet
- Chat open
- Fechar/voltar com gesto parecido com Instagram iOS

#### G. HealthKit preparation

- Planejamento de permissões
- Mapeamento de dados
- Não implementar leitura HealthKit ainda

#### H. Auth futuro

- Apple Login e Google Login podem ser reavaliados depois.
- Enquanto isso, a interface oficial continua email/senha.

## Sprint 3: Feed + Comments UX Polish

Objetivo: feed e comentários minimalistas, social, iOS-like, mantendo
identidade Gym Circle. Inspiração em Instagram dark mode (apenas UX —
sem copiar marca/ícones/assets).

Detalhes em `docs/native-feel-sprint-3.md`.

### Resumo

- Post header minimalista
- Actions row clean
- Caption inline com "mais"
- Comments em bottom sheet
- Reactions rápidas
- Sugestões de amizade reformuladas (sem foco em academia)
- Microinterações + haptics
- Performance preservada (Sprints A–D + Native Sprint 1)

### Fora do escopo

- Apple Maps (Sprint 4)
- HealthKit (Sprint 4+)
- Login Apple/Google
- Reescrita nativa
- Refactor backend grande

## Fase 3: App Nativo Completo no Futuro

Objetivo: migrar surfaces críticas para React Native/Expo ou Swift quando o produto provar retenção e escala.

- Feed com renderização nativa
- Stories Viewer nativo
- Composer nativo
- Chat nativo
- Push/deep links completos
- Apple Maps/HealthKit integrados
- Compartilhamento iOS nativo

## Critério de Migração

Migrar para módulos nativos completos quando:

- WebView/Capacitor virar gargalo real medido em device
- Feed/stories/chat exigirem fluidez que CSS/JS não consegue entregar
- Push/deep link e câmera avançada forem essenciais para retenção
- A base de usuários justificar custo de manutenção nativa
