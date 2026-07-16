# ADR — Provider de Places para a Grande São Paulo

- Status: **Proposed — evidence pending**
- Data: 2026-07-16
- Owners: Product + Backend + Mobile + Privacy/Legal
- Escopo: busca de locais esportivos na Grande São Paulo

## 1. Contexto

O Gym Circle tem 25 locais internos, somente 12 na Grande São Paulo. A auditoria
encontrou Nominatim público funcionando como autocomplete, Overpass público no
nearby, `user_gyms` publicamente legível, procedência descartada e dedupe
agressivo. A P0.5 corrigiu os quatro primeiros limites e sua migration passou
pelo release gate e foi aplicada; o Overpass ainda não tem SLA de produção.

A decisão precisa equilibrar cobertura de negócios locais, espaços públicos,
custo, latência, licença, iOS, Android e backend. Nenhum provider pode ser
escolhido apenas por reputação.

## 2. Escopo geográfico

São Paulo capital — Centro, Oeste, Sul, Norte e Leste — mais Guarulhos, Osasco,
Barueri, Santana de Parnaíba, Carapicuíba, Cotia, Taboão da Serra, Embu das
Artes, Santo André, São Bernardo do Campo, São Caetano do Sul, Diadema, Mauá e
Mogi das Cruzes.

## 3. Alternativas

### A. Google Places + Google Maps

Vantagens esperadas: cobertura comercial, detalhes, SDKs iOS/Android e backend.

Riscos: Text/Nearby Pro caros em escala; cache restrito; conteúdo Google não
pode alimentar base própria; exibição em mapa de terceiros é restrita, salvo
exceções específicas como Places UI Kit.

### B. Apple MapKit + Maps Server API

Vantagens esperadas: integração iOS, busca on-device e backend, mapa nativo.

Riscos: não cobre Android nativamente; quota publicada de 25 mil calls/dia por
team entre Server API/MapKit JS; preço e persistência menos explícitos na
documentação pública.

### C. Dados OpenStreetMap + infraestrutura própria/comercial

Vantagens esperadas: parques, pistas, ciclovias e flexibilidade do dado ODbL.

Riscos: qualidade comercial variável; atribuição/share-alike; custo operacional.
Nominatim/Overpass/tiles públicos não são produção nem autocomplete.

### D. Mapbox Search + Maps

Vantagens esperadas: experiência multiplataforma, mapas vetoriais e Search Box.

Riscos: Search Box é temporário e não permite persistir resultados; sessões e
map loads têm custos distintos; permanente exige produto/contrato específico.

### E. Arquitetura híbrida

Um provider comercial para negócio, uma fonte OSM contratada/própria para espaço
público e mapas por plataforma, atrás de uma fachada própria.

Riscos: atribuição e termos não podem ser misturados; dedupe precisa manter
proveniência; maior complexidade operacional.

## 4. Metodologia

Amostra versionada de 160 casos, com 90 na capital e 70 nos demais municípios,
19 categorias, 87 privados e 73 públicos.

Medidas independentes:

- cobertura correta/parcial/incorreta;
- rank top 1/top 3/top 5;
- completude/correção de campos;
- duplicidade/unidades confundidas;
- p50/p95/falhas/rate limit;
- custo por SKU/cenário;
- flexibilidade de licença e plataforma.

## 5. Evidência disponível

| Dimensão | Google | Apple | OSM | Mapbox |
|---|---|---|---|---|
| Cobertura Grande SP | pendente | pendente | pendente | pendente |
| Relevância | pendente | pendente | pendente | pendente |
| Qualidade | pendente | pendente | pendente | pendente |
| p50/p95 | pendente | pendente | pendente | pendente |
| Custo | confirmado/estimado | sem preço público | infra/quote pendente | confirmado/estimado |
| Persistência | Place ID sim; conteúdo restrito | pendente/fortemente restrita | sim sob ODbL | Search Box não; permanent contratado |
| iOS | sim | sim | via adapter/mapa | sim |
| Android | sim | não nativo | via adapter/mapa | sim |
| Backend | sim | sim | sim próprio/comercial | sim |

Não há credenciais configuradas e nenhum benchmark externo foi executado. Dos
160 casos, 65 estão `approved` e 95 `uncertain`; os incertos bloqueiam o run
completo. Logo, não há vencedor confirmado.

## 6. Custos e licenças

O modelo Google de 50% Text Search + 50% Nearby + Details + 20% reverse + 25%
web map estima USD 0 / 3.485 / 43.880 nos cenários 5k / 100k / 1,5M. Isso é uma
estimativa conservadora; field masks/IDs-only/UI Kit podem reduzir o valor.

Mapbox Search Box sessions estima USD 28,75 / 1.121,25 / USD 7.941,25 até 1M,
com 500k adicionais sujeitos a contrato, mais category/reverse e mapa.

Apple tem quota publicada, mas sem preço público granular. OSM data não tem fee,
mas infraestrutura/serviço comercial precisa ser orçado.

Detalhes e links oficiais estão no [relatório P0](../places-greater-sao-paulo-benchmark-2026-07-15.md).

## 7. Decisão recomendada

**Ainda não aceitar uma decisão final de provider.**

Direção provisória para o benchmark:

- Google como baseline comercial;
- OSM via provider autorizado ou self-host como baseline público/outdoor;
- Apple Server API como comparação e MapKit como candidato de mapa iOS;
- Mapbox como alternativa multiplataforma e de mapa visual.

Somente após o run real decidir:

- provider principal de busca;
- provider complementar;
- mapa iOS;
- mapa Android/web;
- backend e fallback.

## 8. Arquitetura obrigatória independentemente do vencedor

```text
Gym Circle place_id
  -> zero ou mais external refs
  -> policy por provider
  -> conteúdo canônico confirmado
  -> fatos próprios/comunitários separados
```

- external ID nunca é PK;
- raw provider content não vai para a entidade canônica;
- promoção só após uso relevante/confirmação;
- cache/attribution/expiry via policy engine;
- merge auditável e reversível;
- fallback configurável sem release do app.

## 9. Consequências

Positivas:

- troca de provider sem reidentificar locais;
- legalidade e proveniência por campo;
- base comunitária vira ativo próprio;
- busca comercial e outdoor podem ter fontes diferentes.

Negativas:

- schema/RLS/adapters mais complexos;
- necessidade de moderação e merge;
- custo de múltiplos providers no piloto;
- revisão jurídica recorrente.

## 10. Riscos

- escolher Google sem controlar SKU pode gerar custo alto;
- reintroduzir Nominatim como autocomplete ou escalar Overpass público pode
  resultar em bloqueio;
- misturar Google/Apple/Mapbox em mapa incompatível viola termos;
- combinar OSM com base própria sem desenho ODbL pode acionar share-alike;
- salvar resultados temporários cria dívida jurídica;
- dedupe agressivo pode fundir unidades legítimas;
- iniciar P1 sem manter os contratos da migration P0.5 reabre os riscos de
  `user_gyms` e procedência;
- `profiles.main_gym_id` ainda é contrato legado e precisa migrar para a
  superfície limitada antes de endurecimento por coluna;
- aprovar os 95 casos incertos com resposta de provider contaminaria o ground
  truth;
- ausência de credenciais/quota impede medir cobertura, latência e falhas.

### Addendum P0.7

A estabilização local não altera a decisão de provider:

- preferências e catálogo precisaram de capability detection porque o frontend
  estava adiantado em relação ao schema remoto;
- Overpass público permanece apenas fallback temporário, agora com timeout de
  6 s, cache curto, zero retry e circuit breaker;
- origem foi removida como fator dominante do ranking;
- o subset P0.6 tem dez casos aprovados, mas não foi executado;
- 87 casos seguem `uncertain`.

O ADR permanece **Proposed**. O subset controlado mede a arquitetura temporária;
ele não autoriza P1 nem define provider principal.

## 11. Critérios para `Accepted`

- casos aprovados, corrigidos ou removidos, sem `uncertain` no lote final;
- benchmark real executado primeiro em amostra e depois no lote aprovado;
- top 1/top 3 e cobertura por corte;
- p50/p95 e falhas;
- custo recalculado com 0%, 30% e 70% de resolução interna;
- licença por campo revisada/aprovada;
- provider OSM/Apple com quota/contrato esclarecidos;
- POC de fallback;
- threat/privacy review;
- provider/fallback escolhidos;
- decisão assinada por Produto, Engenharia e Privacy/Legal.

## 12. Critérios de reavaliação

- cobertura local cai mais de 10 pontos;
- custo por sessão dobra;
- alteração material de termos/quota;
- lançamento Android muda o mapa visual;
- provider bloqueia cache/combinação necessários;
- expansão para outra região brasileira;
- SLA/falhas ultrapassam orçamento operacional.
