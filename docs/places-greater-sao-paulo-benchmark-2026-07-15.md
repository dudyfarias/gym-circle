# Places P0 — Grande São Paulo: benchmark, cobertura e licenciamento

Data da auditoria: 2026-07-16
Status: **P0.5 passou release gate; benchmark externo real pendente**
Escopo: Grande São Paulo; migration P0.5 aplicada antes do frontend; benchmark pago não executado.

## 1. Resumo executivo

O Gym Circle já tem uma fachada de busca, uma base interna e fluxos de check-in,
mas a solução atual não é adequada para crescer:

- a base remota possui 25 locais, apenas 12 na Grande São Paulo;
- `gyms` não registra categoria, provider, external ID, autoria ou verificação;
- busca textual e reverse geocoding usam o Nominatim público;
- nearby usa um endpoint público do Overpass;
- o client faz busca com debounce de 280 ms, o que caracteriza autocomplete na
  prática e conflita com a política do Nominatim público;
- o resultado externo perde a proveniência quando vira `gyms`;
- a RLS permite que qualquer usuário autenticado insira um local, mas não há
  autoria/moderação; `user_gyms` tem leitura para `anon`, expondo vínculos que
  precisam ser revistos na P1/P2;
- não há credenciais de benchmark configuradas. Por isso não houve chamadas
  pagas nem lote contra serviços públicos, e cobertura/latência permanecem
  pendentes.

Foi criada uma amostra validada com 160 casos e um harness isolado. A decisão de
provider continua aberta. A hipótese a testar é híbrida: busca comercial para
negócios, fonte OSM contratada/própria para espaços públicos e mapa visual por
plataforma. Isso não é ainda uma decisão de contratação.

## 2. O que foi e não foi executado

Executado:

- auditoria do código de busca, localização, check-in e criação de local;
- consultas read-only ao Supabase;
- inventário de nomes de configuração sem exibir valores;
- revisão de preço e licença em fontes oficiais;
- amostra de 160 casos;
- validadores, normalizador, scoring e adaptadores em pasta isolada;
- testes locais e dry-run sem request externo.

Não executado:

- chamadas reais a Google, Apple, Mapbox ou provider OSM comercial;
- benchmark em massa no Nominatim/Overpass público;
- ingestão ou armazenamento de resposta externa;
- alteração do app, schema, migrations, dados de produção ou deploy.

## 3. Estado atual no Supabase

### 3.1 Tabelas e relações

| Tabela | Campos de local relevantes | Uso atual |
|---|---|---|
| `gyms` | `id`, `name`, `address`, `city`, `state`, `latitude`, `longitude`, `created_at` | Catálogo interno único de academias e lugares |
| `user_gyms` | `user_id`, `gym_id`, `is_main`, preferências | Vínculo usuário–academia |
| `profiles` | `main_gym_id` | Academia principal |
| `checkins` | `user_id`, `gym_id`, `checkin_date`, `created_at` | Check-in explícito |
| `posts` | `gym_id`, `location_source`, nome/coordenadas/URL | Local do conteúdo social |
| `stories` | `gym_id` | Local do story |
| `activities` | `gym_id`, `location_source`, nome/coordenadas/URL e `external_id` | Contrato pronto, mas não usado pelos registros atuais |

Não existem tabelas canônicas de `places`, referências de provider, categorias,
contribuições comunitárias, verificação ou merge auditável.

### 3.2 Quantidade e qualidade da base própria

Snapshot read-only em 2026-07-16:

| Métrica | Valor |
|---|---:|
| Locais em `gyms` | 25 |
| Locais na Grande São Paulo | 12 |
| Coordenadas válidas | 22 |
| Sem endereço | 6 |
| Sem cidade | 3 |
| Sem estado | 6 |
| Grupos duplicados por nome/cidade normalizados | 1 |
| `user_gyms` | 25 |
| Perfis com academia principal | 9 |
| Check-ins | 20 |
| Posts com academia | 131 |
| Stories com academia | 115 |

Distribuição principal: São Paulo 12, Recife 4, valor genérico `Brasil` 3 e
outros municípios/valores isolados. Há registros que são residência, edifício,
cidade ou nome genérico, demonstrando ausência de taxonomia e moderação.

As 23 activities existentes no snapshot estavam com `location_source = none`;
nenhuma tinha `gym_id`, nome ou coordenadas de local. Portanto, o schema aceita
localização em activity, mas o uso real ainda não alimenta Places.

### 3.3 RLS e integridade

- `gyms`: leitura pública e insert para autenticado com perfil, nome, cidade e
  coordenadas válidas. Não há update/delete de usuário.
- `user_gyms`: o próprio usuário insere/edita/remove, mas a leitura atual inclui
  `anon` e `authenticated` com `using true`. Isso deve ser revisto como risco de
  privacidade antes de ampliar descoberta.
- `checkins`: leitura autenticada respeita o perfil/follow; insert/delete só do
  próprio usuário.
- `gyms_location_required` está `NOT VALID`: protege novos dados via policy e
  constraint, mas preserva registros antigos inválidos.
- existe unicidade por `lower(trim(name)), lower(trim(city))`; ela não distingue
  unidades da mesma rede na mesma cidade e pode bloquear locais legítimos.

## 4. Estado atual no frontend/backend

### 4.1 Fluxo de busca

1. `GymSearchSheet` lista até 50 locais internos.
2. Geolocation usa `getCurrentPosition`, alta precisão, `maximumAge=60s` e timeout.
3. Nearby consulta `/api/places/nearby` em raio de 2.500 m (1.500 m em parte do
   check-in).
4. Texto com dois ou mais caracteres dispara, após 280 ms, `/api/places/search`.
5. Resultado interno e externo é normalizado no client e deduplicado.
6. Locais recentes vêm de posts do próprio usuário.
7. Cadastro manual exige GPS; reverse preenche cidade/endereço e pode cair no
   fallback genérico `Brasil`.

### 4.2 Providers atuais

| Rota | Provider | Cache declarado | Limite/fallback atual |
|---|---|---:|---|
| `/api/places/search` | Nominatim público | 60 s | 10 resultados; sem rate limiter global |
| `/api/places/reverse` | Nominatim público | 10 min | sem circuit breaker |
| `/api/places/nearby` | Overpass público | 5 min | raio até 5 km; endpoint único |

O User-Agent contém contato pessoal hardcoded. A P1 deve usar configuração de
contato operacional e nunca expor pessoa física no source.

O Nominatim público limita o aplicativo inteiro a 1 req/s e proíbe autocomplete;
também pode retirar acesso sem aviso. Logo, não deve continuar como
infraestrutura de produção/autocomplete. [Política oficial do
Nominatim](https://operations.osmfoundation.org/policies/nominatim/).

### 4.3 Criação e deduplicação

Ao selecionar resultado externo, `findOrCreateFromPlace`:

1. busca `gyms` em um bounding box de aproximadamente 100 m;
2. exige nome normalizado exatamente igual;
3. tenta insert sem provider/external ID;
4. em conflito, busca nome/cidade.

No client, o dedupe considera ID interno, provider ID, nome semelhante,
endereço ou distância até 250 m, preferindo o registro interno. Problemas:

- `providerId` existe só em memória;
- duas unidades próximas podem ser fundidas indevidamente;
- o mesmo local com grafia diferente pode duplicar;
- nome/cidade impede duas unidades homônimas legítimas;
- não há fila de revisão nem undo de merge;
- Nominatim é rotulado na UI como “Google/Localização”, atribuição incorreta.

### 4.4 O que reaproveitar na P1

- `GymSearchSheet` e seus estados de permissão/erro;
- proxy server-side `/api/places/*` como fachada trocável;
- `PlaceCandidate` como ponto de partida, após incluir provider e políticas;
- Haversine, recentes e seção base própria/externa;
- vínculo por `gym_id`, check-ins e integrações sociais existentes;
- testes atuais de dedupe, adaptados para IDs externos persistentes.

## 5. Configurações encontradas

Foram inspecionados apenas nomes de variáveis em código e arquivos `.env`; os
valores não foram exibidos.

| Provedor | Configuração encontrada | Uso atual | Ambiente | Status |
|---|---|---|---|---|
| Google Maps/Places | nenhuma variável de API | apenas links externos `maps.google.com` | web | não configurado |
| Apple MapKit Local Search | nenhuma no app Capacitor | nenhum | iOS atual | não configurado |
| Apple Maps Server API | nenhuma | nenhum | backend | não configurado |
| Mapbox | nenhuma | nenhum | web/mobile/backend | não configurado |
| OSM/Nominatim | não requer chave; endpoint hardcoded | search/reverse | Vercel server | parcialmente configurado e inadequado para escala |
| OSM/Overpass | não requer chave; endpoint hardcoded | nearby | Vercel server | parcialmente configurado e sem SLA |

Nomes esperados pelo harness, ainda ausentes: `GOOGLE_PLACES_API_KEY`,
`APPLE_MAPS_TOKEN`, `MAPBOX_ACCESS_TOKEN` e `OSM_NOMINATIM_BASE_URL` para
instância comercial/própria. Nenhum valor deve entrar no repositório.

## 6. Amostra da Grande São Paulo

Arquivo: `scripts/places-benchmark/benchmark-cases.csv`.

| Dimensão | Distribuição |
|---|---|
| Total | 160 |
| São Paulo capital | 90 |
| Região Metropolitana | 70 |
| Centro / Oeste / Sul / Norte / Leste | 17 / 20 / 22 / 14 / 17 |
| Municípios | 15 |
| Privados / públicos | 87 / 73 |
| Rede / regional / local / público | 42 / 37 / 8 / 73 |
| Categorias internas cobertas | 19 de 19 |
| Approved / uncertain | 65 / 95 |

Cada linha guarda nome/categoria esperados, município, região, coordenada
aproximada, query nominal, query categórica, raio nearby, prefixo de autocomplete,
tipo e porte. Coordenadas são âncoras aproximadas, não prova de endereço.

Antes de um run pago completo, os 95 casos `uncertain` precisam ser confirmados
por curadoria independente e fonte permitida. Eles estão explicitamente
bloqueados e não podem gerar request; cada linha registra método e nota da
revisão. Isso evita pontuar um provider contra um gabarito possivelmente antigo.

## 7. Metodologia

### 7.1 Quatro testes por caso

- nome: busca exata com bias geográfico;
- categoria: ex. academia, parque ou box na região;
- nearby: categoria dentro do raio definido;
- autocomplete: prefixo e seleção em sessão válida.

### 7.2 Dimensões independentes

Cobertura:

- `found_correct`, `not_found`, `wrong_unit`, `old_name`, `closed` ou
  `partially_correct`.

Relevância:

- rank correto e buckets top 1, top 3, top 5, fora do top 5, não encontrado.

Qualidade:

- presença/correção de nome, endereço, coordenada, bairro, município, categoria,
  telefone, site, horários, funcionamento, marca/unidade.

Duplicidade:

- repetição de external ID, nomes equivalentes, unidade antiga/nova e unidades
  confundidas.

Performance:

- média, p50, p95, timeout, falhas e rate limiting. Performance nunca compõe a
  nota de qualidade.

Cortes obrigatórios:

- redes;
- academias/estúdios locais;
- espaços públicos;
- centro versus periferia;
- capital versus cada município metropolitano.

### 7.3 Score transparente

O harness produz `coverage_score`, top 1/top 3, `data_quality_score`, duplicidade,
p50/p95 e falhas. Não gera nota geral. Os dados brutos permitidos e os estados
por caso continuam auditáveis.

## 8. Resultados atuais

Não houve benchmark real por falta de credenciais autorizadas. A tabela não
transforma documentação comercial em evidência de cobertura.

| Critério | Google | Apple | OSM | Mapbox |
|---|---|---|---|---|
| Academias de rede | pendente | pendente | pendente | pendente |
| Academias locais | pendente | pendente | pendente | pendente |
| Boxes/estúdios | pendente | pendente | pendente | pendente |
| Parques | pendente | pendente | pendente | pendente |
| Centros públicos | pendente | pendente | pendente | pendente |
| Top 1 / Top 3 | pendente | pendente | pendente | pendente |
| Duplicatas | pendente | pendente | pendente | pendente |
| p50 / p95 | pendente | pendente | pendente | pendente |
| iOS | suportado | suportado | via web/provider | suportado |
| Android | suportado | não suportado nativamente | via web/provider | suportado |
| Backend | suportado | Server API | self-host/comercial | suportado |

## 9. Custos oficiais e cenários

Preços em USD consultados em 2026-07-16; revisar antes de contratar. Cenários:
5 mil, 100 mil e 1,5 milhão de sessões/mês. Modelo comparativo:

- uma sessão de autocomplete concluída;
- 50% text search e 50% nearby;
- um details essencial após seleção;
- reverse geocoding em 20%;
- mapa web em 25%;
- sem fotos, reviews ou campos Enterprise.

### 9.1 Google PAYG

Referência: [tabela oficial](https://developers.google.com/maps/billing-and-pricing/pricing).
Autocomplete em sessão corretamente encerrada usa SKU gratuito; requests órfãos
podem cobrar `Autocomplete Requests`. Mobile Maps SDK aparece como no-cost; para
comparação web foi usado Dynamic Maps.

| Componente | 5 mil | 100 mil | 1,5 milhão |
|---|---:|---:|---:|
| Text Search Pro (50%) | 0 | 1.440 | 18.080 |
| Nearby Search Pro (50%) | 0 | 1.440 | 18.080 |
| Place Details Essentials | 0 | 450 | 4.300 |
| Reverse/geocoding (20%) | 0 | 50 | 1.250 |
| Dynamic Maps web (25%) | 0 | 105 | 2.170 |
| Total modelado | **0** | **3.485** | **43.880** |

Risco: 10% de autocomplete órfão no cenário grande adicionaria cerca de USD 368.
Field masks, IDs-only e Places UI Kit podem mudar muito o custo; medir o produto
real antes de orçamento definitivo. Google oferece planos de assinatura, mas os
SKUs e limites precisam ser conferidos para a combinação escolhida.

### 9.2 Apple

A Apple documenta até 25 mil service calls/dia por team compartilhadas entre
Maps Server API e MapKit JS, sem tabela pública por request. Em 1,5 milhão/mês a
média seria cerca de 50 mil/dia, acima desse limite publicado. Custo fica
`pendente/sem preço público`; capacidade e eventual aumento de quota exigem
confirmação comercial. [Apple Maps Server API](https://developer.apple.com/documentation/applemapsserverapi).

### 9.3 Mapbox

Referência: [pricing oficial](https://www.mapbox.com/pricing). Search Box cobra
autocomplete/retrieve por sessão e category/reverse por request.

| Componente | 5 mil | 100 mil | 1,5 milhão |
|---|---:|---:|---:|
| Search Box sessions | 28,75 | 1.121,25 | 7.941,25 até 1M + contrato para 500k |
| Category + reverse (70% das sessões) | 0 | 76,50 | 1.352,50 + contrato acima de 1M |
| Mapbox GL JS loads (25%) | 0 | 0 | 1.175,00 |

Search Box não permite armazenar resultados. Geocoding permanente é produto
separado, a partir de USD 5/1.000 até 500 mil, e não transforma automaticamente
POIs do Search Box em conteúdo próprio. Mapas mobile usam métrica MAU própria e
devem ser orçados separadamente.

### 9.4 OSM

Dados OSM não têm cobrança de licença, mas infraestrutura não é gratuita.
Nominatim/tiles públicos não têm SLA e não são orçamento de produção. Custos de
provider comercial e self-host (compute, RAM, storage, ingest, updates, tiles,
monitoramento e plantão) permanecem pendentes de proposta técnica/comercial.

### 9.5 Controles obrigatórios

- quota por usuário/IP/app e debounce por sessão;
- budget alerts de 50/75/90/100%;
- limite diário e kill switch por provider;
- field masks mínimos;
- circuit breaker e fallback;
- separar custo de autocomplete, search, details, reverse e map load;
- não enviar query livre/coordenadas para analytics.

### 9.6 Efeito da base própria — recalibração P0.5

Estimativa Google conservadora em USD:

| Buscas/mês | 0% resolvidas internamente | 30% | 70% |
|---|---:|---:|---:|
| 5 mil | 0 | 0 | 0 |
| 100 mil | 3.485 | 2.292,50 | 740 |
| 1,5 milhão | 43.880 | 33.575 | 15.430 |

Assim, USD 43.880 representa o cenário grande sem base própria/cache, não um
custo inevitável. As premissas e cálculos executáveis ficam em
`scripts/places-benchmark/costEstimate.mjs`.

## 10. Licenciamento por provider

Esta seção é arquitetura, não parecer jurídico.

### Google Places

- `place_id`: pode ser persistido indefinidamente; refresh após 12 meses é
  recomendado. [Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id).
- lat/lng de Places: cache temporário até 30 dias; depois remover/atualizar.
- demais conteúdo: não prefetch/index/store fora das exceções; não copiar para
  uma base própria.
- exibição sem mapa exige atribuição Google Maps; em mapa, conteúdo Places deve
  aparecer em Google Map. Places UI Kit tem exceção específica para mapa de
  terceiros, preservando atribuição e cache.
- fotos/reviews: apenas exibição com atribuição de autor e link de origem; não
  tratá-las como asset próprio.
- treinamento de IA/base derivada: não usar conteúdo do provider.

Fontes: [políticas Places](https://developers.google.com/maps/documentation/places/web-service/policies)
e [termos específicos](https://cloud.google.com/maps-platform/terms/maps-service-terms/index-20240522).

### Apple Maps

- busca no device e no backend é suportada por MapKit/Maps Server API;
- termos proíbem extração em massa, criação de base a partir do serviço,
  armazenamento/cache não autorizado e treinamento de modelo;
- persistência de Place IDs/campos e TTL não está suficientemente explícita na
  documentação pública consultada: tratar como apenas exibição até validação
  jurídica/contratual;
- não copiar fotos, avaliações, horários ou POIs para a base canônica.

Fonte: [Apple Maps Terms of Use](https://www.apple.com/legal/internet-services/maps/terms-en.html).

### OpenStreetMap

- dados OSM podem ser usados e persistidos sob ODbL;
- atribuição é obrigatória e uma Derivative Database pública pode acionar
  share-alike; separar camada OSM da base própria e revisar Collective Database;
- OSM type/id pode ser referência externa respeitando a licença;
- Nominatim público: 1 req/s absoluto, sem autocomplete, sem queries
  sistemáticas, cache obrigatório em bulk permitido e possibilidade de bloqueio;
- tiles públicos têm política separada, cache mínimo conforme headers/7 dias e
  proibição de prefetch/offline.

Fontes: [ODbL e atribuição](https://www.openstreetmap.org/copyright),
[FAQ legal OSM](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ),
[Nominatim](https://operations.osmfoundation.org/policies/nominatim/) e
[tiles](https://operations.osmfoundation.org/policies/tiles/).

### Mapbox

- Search Box: somente uso temporário; resultados não podem ser armazenados;
- Geocoding temporário: sessão atual, sem persistência;
- Geocoding permanente: armazenamento permitido mediante produto/contrato, para
  uso próprio, não distribuição/sublicença;
- resposta de Geocoding deve ser usada com mapa Mapbox;
- POI Search Box e geocoding de endereços são produtos diferentes;
- atribuição e termos permanecem obrigatórios.

Fontes: [Search Box](https://docs.mapbox.com/api/search/search-box/),
[Geocoding](https://docs.mapbox.com/api/search/geocoding/) e
[temporary vs permanent](https://docs.mapbox.com/help/dive-deeper/understand-temporary-vs-permanent-geocoding/).

### Classificação de dados

| Classe | Exemplos |
|---|---|
| Persistência permitida | ID interno; conteúdo criado/confirmado no Gym Circle; Google Place ID; OSM conforme ODbL; Mapbox permanent contratado |
| Cache temporário | Google lat/lng até 30 dias; Mapbox temporary na sessão; provider conforme contrato |
| Apenas exibição | detalhes/fotos/reviews/horários de providers sem permissão de persistência |
| Conteúdo próprio | check-ins, fotos internas, equipamentos informados, correções e verificações |
| Conteúdo comunitário | fatos com autor, data, confiança, moderação e histórico |
| Proibido/restrito | bulk copy, scraping, base derivada não autorizada, IA treinada com conteúdo comercial |

## 11. Arquitetura futura sem migration

```text
Client
  -> Gym Circle Places API
       -> busca canônica própria
       -> policy engine por provider
       -> adapter primário
       -> adapter complementar/fallback
       -> normalização
       -> dedupe/ranking
       -> resposta com provider + attribution + expiry
       -> promoção para place interno somente após evento relevante
```

`gymcircle_places`:

- `id`, `canonical_name`, `slug`, `category`, lat/lng;
- bairro/cidade/estado/país e `address_summary` confirmado;
- `status`, `verification_status`, `created_by`, timestamps.

`gymcircle_place_external_refs`:

- `id`, `place_id`, `provider`, `external_id`, `provider_category`;
- `last_verified_at`, `cache_expires_at`, timestamps;
- unique por provider/external ID;
- external ID nunca é PK do produto.

Metadados temporários de provider devem ficar em cache com TTL/policy, não na
linha canônica.

## 12. Deduplicação proposta

Sinais positivos, com pesos auditáveis:

- external ref já ligada: confirmação forte;
- mesmo telefone/domínio confirmado: forte;
- nome normalizado + endereço + distância curta: forte;
- mesma rede e unidade: médio/forte;
- nome similar + categoria + raio: médio;
- apenas proximidade: insuficiente.

Saídas:

- `confirmed_match`;
- `probable_duplicate`;
- `manual_review`;
- `different_places`.

Nunca fazer merge destrutivo automático. Guardar auditoria, aliases, refs
movidas e permitir undo. Unidades da mesma rede precisam de `brand` e `branch`.

## 13. Busca híbrida

1. Consultar base própria por nome/categoria/proximidade.
2. Se cobertura/relevância não atingir o gate, consultar provider externo.
3. Normalizar sem perder provider/atribuição/TTL.
4. Deduplicar contra internos e entre providers sem misturar conteúdo proibido.
5. Exibir origem visual correta.
6. Criar `place_id` interno apenas após check-in, seleção no perfil/post/activity,
   confirmação ou curadoria.
7. Persistir somente referência/campos permitidos e fatos próprios.
8. Em falha, retornar base própria + provider complementar; nunca esconder erro.

## 14. Taxonomia esportiva

Categorias internas canônicas:

`gym`, `gym_chain`, `neighborhood_gym`, `crossfit_box`, `functional_studio`,
`pilates_studio`, `dance_studio`, `martial_arts_gym`, `sports_club`,
`public_park`, `running_track`, `sports_court`, `football_field`,
`swimming_pool`, `public_sports_center`, `calisthenics_area`, `cycling_route`,
`rehabilitation_center`, `other_sports_place`.

Cada adapter mantém uma tabela versionada provider-category -> interna. Resultado
ambíguo recebe `other_sports_place` e pode ser corrigido pela comunidade.

## 15. Enriquecimento próprio

Entidades futuras separadas:

- equipamentos e disponibilidade;
- modalidades;
- amenidades (estacionamento, vestiário, chuveiro, piscina, acessibilidade);
- fatos outdoor (iluminação, banheiro, bebedouro, circuito);
- fotos do Gym Circle;
- check-ins/popularidade;
- faixa de preço informada;
- correções, denúncias e confirmação de funcionamento.

Todo fato tem autor, timestamp, confiança, estado de moderação e histórico. Um
usuário comum não altera `verification_status` nem status administrativo.

## 16. Privacidade

- localização precisa é usada na busca e não vai para analytics/logs;
- check-in é explícito;
- academia principal respeita privacidade do perfil;
- local acompanha visibilidade do post;
- rota outdoor não pode inferir residência; privacy zones entram em roadmap;
- queries livres têm retenção mínima e nunca entram em treinamento;
- RLS separa dados públicos, contribuição própria e ações de moderação;
- `user_gyms_select_all` precisa ser endurecida antes da expansão.

## 17. Sprint Places P1 — Hybrid Search Foundation

Objetivo: criar fachada e identidade canônica sem importar catálogo em massa.

Escopo:

- schema de `gymcircle_places` e refs externas;
- RLS e RPC de promoção sob demanda;
- contrato `PlaceCandidate` com policy/attribution/expiry;
- adapter primário + complementar sob feature flag;
- busca interna primeiro, normalização, dedupe e ranking;
- rate limit, quotas, budget alerts, circuit breaker e cache compatível;
- UI que distingue base própria e provider;
- observabilidade sem PII;
- migração controlada dos 25 `gyms`, sem merge destrutivo;
- testes de RLS, dedupe, fallback e atribuição.

Fora da P1: mapa completo, marketplace, scanner, avaliações, inventário amplo e
IA.

Gate para iniciar: benchmark real com gabarito revisado, contrato de licença
aprovado e orçamento de piloto.

## 18. Addendum P0.5 — remediation/readiness

Em 2026-07-16 foi concluída localmente a P0.5:

- Nominatim deixou de ser acionado por debounce/autocomplete; busca externa
  exige CTA/Enter, três caracteres, cooldown e intenção explícita;
- atribuição passou a `© OpenStreetMap contributors`;
- dedupe só remove referência externa idêntica do mesmo provider ou match exato;
- migration aplicada torna `user_gyms` owner-only e cria RPC/view limitada
  para academia principal; o frontend em lote consome a view e não confia em
  `profiles.main_gym_id` de terceiros;
- `gym_place_external_refs` e `register_external_gym` preservam procedência sem
  raw provider payload;
- dry-run bloqueia execução com casos `uncertain`, exige
  `--allow-paid-requests` e limite explícito;
- custo agora modela 0%, 30% e 70% de resolução pela base própria.

Detalhes: [Places P0.5](./places-p0-5-remediation-readiness-2026-07-16.md).

## 19. Validações desta entrega

- CSV: 160 casos, 19 categorias e 15 municípios — válido;
- revisão: 65 `approved`, 95 `uncertain`, nenhum draft legado;
- testes de benchmark: 11/11 passando;
- dry-run: zero requests, providers ausentes listados e custos calculados;
- consultas Supabase: somente read-only;
- nenhum segredo impresso ou criado;
- migration P0.5 aplicada como versão remota `20260716150451`; nenhum benchmark
  pago foi executado.

## 20. Pendências para concluir o P0

1. confirmar e promover os 95 casos `uncertain` para `approved` ou removê-los;
2. aprovar contas/chaves de benchmark e quotas pequenas;
3. executar primeiro 10 casos por provider e revisar compliance;
4. executar 160 casos em janelas controladas;
5. registrar top 1/top 3, qualidade, duplicidade, p50/p95 e falhas;
6. obter proposta OSM comercial/self-host e confirmação Apple de quota;
7. fazer revisão jurídica final;
8. então atualizar o ADR de `Proposed` para `Accepted`.
