# Places & Maps Intelligence — roadmap Grande São Paulo

Data-base: 2026-07-16
Status: P0 em andamento; auditoria concluída, benchmark externo pendente.

## 1. Objetivo

Construir uma camada própria de lugares esportivos na Grande São Paulo sem
transformar catálogo de terceiros em dado interno por acidente. A camada deve
suportar check-in, academia do perfil, posts, atividades, parques, equipamentos
e descoberta futura em iOS, Android e backend.

## 2. Decisões canônicas

- Gym Circle cria e controla seu próprio `place_id`.
- IDs de Google, Apple, OSM ou Mapbox são referências externas.
- Provedor externo nunca é chave primária do produto.
- Conteúdo externo obedece cache, expiração, exibição e atribuição do contrato.
- O local interno nasce apenas após uso relevante, confirmação ou curadoria.
- Check-ins, equipamentos, fotos e correções produzidos no Gym Circle são
  entidades próprias com autoria e moderação.
- Search provider, mapa visual e fonte complementar podem ser diferentes, desde
  que os termos permitam a combinação.
- Nominatim público não é autocomplete nem infraestrutura de produção.

## 3. Diagnóstico P0

- 25 locais internos; 12 na Grande São Paulo.
- 22 com coordenadas válidas; 6 sem endereço; 3 sem cidade; 6 sem estado.
- `gyms` não guarda categoria, provider, external ID, autoria ou verificação.
- Busca textual/reverse usa Nominatim público; nearby usa Overpass público.
- provider ID é descartado na criação interna.
- dedupe atual combina nome/distância, sem revisão/undo.
- `user_gyms` tem política de leitura pública a revisar.
- não há credenciais comerciais configuradas; cobertura/latência não foram
  inventadas.

Relatório detalhado: [Places P0 — Grande São Paulo](./places-greater-sao-paulo-benchmark-2026-07-15.md).

## 4. Escopo geográfico inicial

Capital: Centro, Oeste, Sul, Norte e Leste.

Região Metropolitana: Guarulhos, Osasco, Barueri, Santana de Parnaíba,
Carapicuíba, Cotia, Taboão da Serra, Embu das Artes, Santo André, São Bernardo do
Campo, São Caetano do Sul, Diadema, Mauá e Mogi das Cruzes.

Não expandir nacionalmente antes de medir cobertura e custo nessa região.

## 5. Provedores em avaliação

### Google Places

Baseline comercial a testar para redes, academias locais, horários e status.
Place IDs podem ser persistidos, mas conteúdo e coordenadas têm restrições de
armazenamento/cache/atribuição. Custo de Text/Nearby Pro pode dominar a operação.

### Apple MapKit e Maps Server API

Opção natural de mapa e busca no iOS; Server API permite backend. Quota publicada
é compartilhada com MapKit JS e não há preço público granular. Persistência de
POI precisa de validação jurídica antes de base canônica.

### OpenStreetMap

Dados abertos sob ODbL, especialmente relevantes para parques, pistas e áreas
públicas. Produção exige provider comercial ou infraestrutura própria. Nominatim,
Overpass e tiles públicos têm capacidade/políticas próprias e não são SLA.

### Mapbox

Alternativa multiplataforma para mapas e Search Box. Search Box é temporário e
não permite persistir resultados; Geocoding permanente é produto separado.

## 6. Arquitetura-alvo

```text
Client
  -> Gym Circle Places API
      -> base canônica
      -> provider policy engine
      -> primary adapter
      -> complementary/fallback adapter
      -> normalize + dedupe + rank
      -> result with attribution and expiry
```

Entidades futuras:

- `gymcircle_places`;
- `gymcircle_place_external_refs`;
- categorias versionadas;
- contribuições/equipamentos/fatos;
- fotos internas;
- verificação/moderação;
- merge auditável e reversível.

## 7. Roadmap

### P0 — Provider, Coverage & Licensing Audit — IN PROGRESS

Feito:

- auditoria do app e Supabase;
- amostra de 160 casos/15 municípios/19 categorias;
- metodologia, custo, licenciamento e privacy review;
- harness isolado, adapters, validação e scoring;
- ADR em estado `Proposed`.

P0.5 concluída e aprovada no release gate:

- busca externa explícita no lugar de autocomplete público;
- atribuição OpenStreetMap;
- migration de privacy/procedência aplicada antes do frontend;
- dedupe conservador;
- dry-run com flags pagas, call cap e custos híbridos.

Pendente para P0.6:

- confirmação independente de 95 casos `uncertain`;
- credenciais/quota aprovadas;
- benchmark real e p50/p95;
- proposta OSM e revisão jurídica;
- decisão final de provider.

### P1 — Hybrid Search Foundation — BLOCKED BY P0

- place ID próprio e external refs;
- RLS e promoção sob demanda;
- facade local + externa;
- normalização/dedupe/ranking;
- cache/atribuição por policy;
- quotas, circuit breaker, observabilidade e flags;
- migração dos 25 locais existentes.

### P2 — Check-in e base própria v2

- detalhe do local;
- merge auditável;
- autoria/correção/verificação;
- privacidade de academia e check-in;
- relação com post e activity.

### P3 — Enriquecimento colaborativo

- equipamentos;
- modalidades e amenidades;
- fatos outdoor;
- fotos internas;
- moderação e confiança.

### P4 — Descoberta esportiva

- busca próxima e filtros;
- academias/parques/clubes;
- ranking interno;
- detalhe, check-ins e comunidade.

### P5 — Scanner e treino contextual

Somente após catálogo de lugares, equipamentos e exercícios estar aprovado.

## 8. Gates

- cobertura e relevância reais por região/categoria;
- licença por campo e TTL aprovados;
- custo pequeno/médio/grande e kill switch;
- nenhum raw provider payload na base canônica;
- fallback sem serviço público abusivo;
- RLS de memberships/check-ins corrigida;
- privacy review para coordenadas e rotas;
- QA iOS, Android e backend antes de rollout.

## 9. Próxima ação

Manter os contratos validados da migration P0.5, confirmar o gabarito
`uncertain`, provisionar credenciais de benchmark com quotas mínimas, executar
5–10 casos por provider e fazer review de compliance antes do lote aprovado.

Documentos:

- [Benchmark P0](./places-greater-sao-paulo-benchmark-2026-07-15.md)
- [Remediação/readiness P0.5](./places-p0-5-remediation-readiness-2026-07-16.md)
- [ADR provider Grande São Paulo](./adr/ADR-places-provider-greater-sao-paulo.md)
