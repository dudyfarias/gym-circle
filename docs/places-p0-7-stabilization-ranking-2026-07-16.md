# Places P0.7 — Stabilization & Intelligent Place Ranking

Data: 2026-07-16  
Status: implementada localmente; sem commit, migration, benchmark pago ou deploy  
ADR: `Proposed`

## 1. Resultado executivo

A P0.7 corrige três falhas preexistentes e remove a prioridade artificial da
origem do local. Resultados próprios e externos agora entram no mesmo pipeline:

1. coletar;
2. normalizar;
3. calcular distância;
4. deduplicar por identificadores fortes;
5. calcular relevância;
6. ordenar;
7. separar ação de localização atual, Recentes e lista principal.

Sem texto, distância é a fonte de verdade. Com texto, correspondência de nome é
a fonte de verdade e distância ordena unidades equivalentes. O registro
canônico do Gym Circle continua sendo preferido quando há duplicata confirmada,
mas a origem não promove um local distante.

## 2. Erros estabilizados

### 2.1 Preferências de exercícios — 404

- Request: `GET /rest/v1/user_workout_exercise_preferences`.
- Origem: `useWorkoutCatalog`.
- Momento: carregamento autenticado do catálogo.
- Causa: a tabela pertence à migration de Catalog Intelligence, ainda ausente
  no schema remoto auditado, mas o hook consultava a tabela em todo carregamento.
- Impacto: 404 repetível e favoritos sem fallback confiável.
- Correção: a consulta principal usa apenas colunas existentes (`select *`),
  detecta `review_status` como capability e só consulta preferências remotas
  quando o schema novo está presente. No schema legado, favoritos ficam em
  storage local por usuário. Não há retry automático.

### 2.2 Catálogo — 400

- Request: `GET /rest/v1/workout_exercise_catalog` com colunas e filtro
  `review_status` ainda inexistentes em produção.
- Origem: `useWorkoutCatalog`.
- Momento: primeira carga do Exercise Picker.
- Causa: query otimista ao schema futuro, seguida por fallback; o fallback
  funcionava, mas a primeira request sempre falhava.
- Impacto: erro 400 no console/rede, latência extra e risco de incompatibilidade.
- Correção: uma única consulta compatível com o schema remoto. O mapper mantém
  defaults para campos aditivos; filtragem editorial só é aplicada se a
  capability existir.

### 2.3 Nearby/Overpass — 504

- Request: `POST https://overpass-api.de/api/interpreter` por
  `/api/places/nearby`.
- Origem: `GymSearchSheet` e `CheckInScreen`.
- Momento: GPS disponível e tela de local/check-in aberta.
- Causa: consulta ampla, timeout upstream maior que a margem da função, sem
  abort do servidor, cache local ou circuit breaker.
- Impacto: 504, lista vazia e fluxo de check-in degradado.
- Correção:
  - timeout da query Overpass em 5 s e abort da aplicação em 6 s;
  - raio máximo temporário de 2,5 km;
  - consulta `nwr` limitada a 24 elementos;
  - cache efêmero de 5 minutos;
  - circuit breaker de 60 segundos;
  - zero retry automático;
  - resposta degradada 200 com lista vazia, preservando resultados internos;
  - AbortController no cliente e cleanup ao fechar a tela.

O fallback mantém base Gym Circle, Recentes, busca manual e cadastro. Um 504 não
apaga dados já carregados nem bloqueia a interface.

## 3. Ranking unificado

### 3.1 Modelo

`PlaceCandidate` passou a aceitar metadata comum de aliases, recente, academia
principal, verificação, check-ins e scores. A mesma engine recebe o contexto:

- `checkin`;
- `post_location`;
- `profile_gym`.

### 3.2 Sem query

Ordem efetiva:

1. candidato com coordenada/distância válida;
2. distância crescente;
3. relevância apenas em empate de aproximadamente 5 metros;
4. recente, principal, verificação e popularidade;
5. origem como último desempate técnico.

Score de proximidade máximo: 65. Buckets usados para o score, não para substituir
a distância real:

- até 250 m;
- 251–750 m;
- 751 m–2 km;
- 2–8 km;
- acima de 8 km.

O boost da origem própria é apenas `0.1`; portanto, um OSM a 421 m pode vir antes
de uma academia Gym Circle mais distante.

### 3.3 Com query

Prioridade textual:

- nome exato: 100;
- prefixo forte: 75;
- tokens completos no nome: 55;
- frase em nome/endereço/bairro/cidade/aliases: 45;
- tokens distribuídos: 30;
- proximidade: até 40;
- recente: 12;
- principal: até 12 no contexto de perfil;
- verificado: 5;
- origem própria: 0.1.

Texto é normalizado sem acentos e sem distinção de caixa. `Bluefit` prioriza
Bluefit e ordena unidades do mesmo nível por distância; um exact match pode
vencer um local genérico mais próximo.

## 4. Deduplicação e seções

A deduplicação usa mapas de chaves fortes, evitando busca quadrática na lista
completa:

- ID interno;
- provider + external ID;
- nome + endereço + cidade normalizados.

Somente `same_external_ref` e `exact_match` são consolidados. Proximidade sozinha
nunca faz merge. Unidades próximas da mesma rede, academias no mesmo shopping e
renomeações ambíguas permanecem separadas ou em revisão manual.

Seções:

- `Usar localização atual`: ação especial apenas para localização de post;
- `Recentes`: seção própria, deduplicada;
- `Perto de você`: Gym Circle + externo ordenados juntos;
- `Resultados da busca`: ranking textual unificado.

A lista principal só aparece quando a rodada nearby termina; durante a coleta há
um estado estável de loading. Isso evita o item mudar sob o dedo do usuário.

## 5. UI e origem

O item exibe nome, categoria, distância, endereço curto e fonte em linha
secundária. A origem deixou de ser um chip dominante. A atribuição obrigatória
do OpenStreetMap continua visível e correta.

## 6. Benchmark P0.6

O catálogo continua com 160 casos. Após revisão por páginas oficiais:

- approved: 73;
- uncertain: 87;
- remove/duplicate/needs_correction: 0;
- benchmark completo pronto: não.

Foram corrigidos/aprovados:

- Smart Fit Shopping Light;
- Smart Fit Liberdade;
- Academia Gaviões Paulista;
- Bio Ritmo Conjunto Nacional - Paulista;
- Smart Fit Pinheiros;
- Bluefit Leopoldina;
- CrossFit 79;
- Ironberg Barra Funda.

Evidências primárias: [Ironberg](https://www.ironberg.com.br/sao-paulo.html),
[Smart Fit Pinheiros](https://www.smartfit.com.br/locations/pinheiros),
[Smart Fit Liberdade](https://www.smartfit.com.br/academias/liberdade),
[Bluefit Leopoldina](https://www.bluefit.com.br/unidade/leopoldina),
[Bio Ritmo Paulista](https://www.bioritmo.com.br/unidades/paulista),
[Gaviões Paulista](https://www.academiagavioes.com.br/unidades/item/paulista),
[CrossFit 79](https://www.crossfit.com/gym/7695/crossfit-79),
[Parque Ibirapuera](https://prefeitura.sp.gov.br/web/meio_ambiente/w/parques/regiao_sul/14062),
[Parque Zilda Natel](https://legislacao.prefeitura.sp.gov.br/leis/decreto-50425-de-12-de-fevereiro-de-2009/consolidado) e
[Centro Olímpico](https://prefeitura.sp.gov.br/web/esportes/centro_olimpico/apresentacao).

O subset controlado está em `p0-6-priority-cases.json`, com exatamente dez casos
approved. Permanece `execution_allowed: false`.

Estimativa:

- runner atual de name search: 10 chamadas por provedor;
- matriz nome/categoria/nearby/autocomplete: 40 por provedor;
- quatro provedores: 160 chamadas no cenário completo.

Nenhuma chamada paga foi executada.

## 7. Observabilidade e privacidade

A rota retorna `degraded` e `reason` sem coordenadas ou payload externo. O
frontend distingue timeout/degradação sem registrar localização. Eventos de
produto adicionais ficaram pendentes porque o picker não recebe hoje o serviço
central `analytics.trackSafe`; não foi criado um segundo canal paralelo ou um
logger com PII apenas para esta sprint.

## 8. Arquivos da P0.7

- `apps/web/src/app/api/places/nearby/route.ts`
- `apps/web/src/app/api/places/nearby/route.test.ts`
- `apps/web/src/components/gym-circle/GymSearchSheet.tsx`
- `apps/web/src/components/gym-circle/screens/CheckInScreen.tsx`
- `apps/web/src/components/gym-circle/screens/PostScreen.tsx`
- `apps/web/src/components/gym-circle/EditPostSheet.tsx`
- `apps/web/src/components/gym-circle/EditProfileSheet.tsx`
- `apps/web/src/components/gym-circle/social/locationSearch.ts`
- `apps/web/src/components/gym-circle/social/locationSearch.test.ts`
- `apps/web/src/components/gym-circle/workout/useWorkoutCatalog.ts`
- `apps/web/src/components/gym-circle/workout/useWorkoutCatalog.test.ts`
- arquivos de benchmark e documentação citados neste relatório.

## 9. Pendências e gate

Antes de publicar:

1. concluir validações integrais;
2. QA autenticado em iPhone para check-in e post;
3. confirmar ausência de 404/400/504 no ambiente de preview;
4. revisar os 87 casos ainda uncertain ou registrar fonte/bloqueio individual;
5. manter o ADR `Proposed`;
6. obter aprovação explícita para commit/deploy.

Ordem oficial:

1. P0.7 — estabilização e ranking;
2. P0.6 — dez casos controlados;
3. ADR Accepted ou nova rodada;
4. P1 — Hybrid Search Foundation;
5. Place Profile & Hero Experience.
