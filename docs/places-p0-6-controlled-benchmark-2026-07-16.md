# Places P0.6 — Controlled Provider Benchmark

Data: 2026-07-16; rodada de dez concluída em 2026-07-22
Status: **Apple 10/10 executado e revisado; comparação multiprovider pendente**
ADR: `Proposed`
Produção alterada: não

## 1. Resultado executivo

Uma chave Apple Maps associada ao Maps ID do Gym Circle foi provisionada fora
do repositório. O harness gera o JWT ES256 `server_api` em memória, troca esse
JWT por um access token curto e o reutiliza durante a rodada. Nenhum valor,
fragmento de chave, header ou token foi impresso ou persistido.

Por isso:

- o dry-run foi executado com zero requests externos e passou;
- a sanidade Apple de três casos foi concluída com quatro chamadas;
- a rodada Apple de dez casos foi concluída com onze chamadas: uma de token e
  dez buscas, exatamente no teto autorizado;
- a revisão humana classificou nove locais como corretos: oito em top 1 e o
  CrossFit 79 em top 2;
- o Centro Olímpico não foi encontrado corretamente; o primeiro resultado era
  outro local homônimo em Santo Amaro;
- nenhum resultado foi simulado ou substituído por fixture;
- Nominatim público não foi usado;
- o ADR permanece `Proposed`.

## 2. Subset controlado

O subset contém exatamente os dez papéis obrigatórios, IDs únicos e casos
`approved`:

| Caso | Papel |
|---|---|
| GSP-160 — Ironberg Barra Funda | academia âncora |
| GSP-001 — Smart Fit Shopping Light | rede/unidade próxima 1 |
| GSP-002 — Smart Fit Liberdade | rede/unidade próxima 2 |
| GSP-026 — Bluefit Leopoldina | rede |
| GSP-014 — Bio Ritmo Paulista | rede premium |
| GSP-013 — Academia Gaviões Paulista | rede regional |
| GSP-033 — Parque Ibirapuera | parque grande |
| GSP-032 — Parque Zilda Natel | parque de bairro |
| GSP-029 — CrossFit 79 | cauda longa independente/box |
| GSP-039 — Centro Olímpico de Treinamento e Pesquisa | centro público |

A sanidade está fixada em Ironberg, Smart Fit Shopping Light e Parque
Ibirapuera. O runner agora usa esses IDs explicitamente; ele não seleciona mais
os primeiros casos aprovados do CSV.

Ground truth usa páginas oficiais de operadores ou governo. As coordenadas de
Gaviões e dos equipamentos públicos permanecem marcadas como pontos aproximados
do benchmark, sem fingir precisão fornecida pela página oficial. CrossFit 79
mede cauda longa independente, mas é um box; uma futura rodada de academias
independentes deve adicionar uma academia convencional.

## 3. Credenciais, billing e autorização

| Provedor | Credencial | Billing/quota/restrições | Status |
|---|---|---|---|
| Google | `GOOGLE_PLACES_API_KEY` ausente | sem evidência local | não autorizado |
| Apple | inputs de assinatura configurados fora do repo | quota oficial de 25.000 calls/dia/team; teto local 11 | rodada de 10 concluída |
| Mapbox | `MAPBOX_ACCESS_TOKEN` ausente | sem evidência local | não autorizado |
| OSM próprio/comercial | endpoint ausente | sem contrato/policy local | não autorizado |

Checklist antes de destravar qualquer provider:

1. provisionar credencial fora do repositório;
2. confirmar API/endpoint correto;
3. registrar owner da conta e autorização do teste;
4. confirmar billing e consumo acumulado do mês;
5. definir quota diária e por minuto;
6. restringir chave por backend/IP/domínio conforme o produto;
7. configurar alerta e teto de custo;
8. revisar termos do endpoint usado;
9. executar dry-run novamente;
10. alterar `execution_allowed` somente após aprovação explícita.

## 4. Hardening do harness

A auditoria encontrou e corrigiu bloqueios que tornavam a execução insegura:

- `--subset=p0-6` agora é obrigatório para execução externa;
- o runner carrega os IDs do subset em sua ordem oficial;
- `approved_execution_limit` separa a autorização da sanidade da futura rodada
  de dez casos;
- `--limit` e `--max-calls` precisam ser explícitos;
- apenas limites de 3 ou 10 casos são aceitos;
- o orçamento contabiliza cada `fetch` real no ponto da chamada;
- a execução para na primeira falha, sem retry pago;
- autenticação/billing, 429, timeout, 5xx e call cap são classificados;
- relatório persiste somente scores, presença de campos e falhas sanitizadas;
- revisão humana é obrigatória e foi registrada neste documento para a rodada.

O teto global do harness é 30 requests. A sanidade usou `max-calls=4` e a
rodada final usou `max-calls=11`; ambos os tetos foram respeitados, sem retry.

## 5. Adaptadores auditados

### Google

Usa Places API Text Search (New), pt-BR, região BR, location bias e field mask
explícito limitado a identidade, nome, endereço, coordenada, categoria e status.
Telefone, site e horários exigem uma futura operação/details aprovada e não
serão cobrados silenciosamente nesta rodada. Um caso equivale a um request.
Permanece bloqueado até chave, billing, quota e restrições serem confirmados.

### Apple

Usa Maps Server API `/v1/search`. `searchLocation` está corretamente no formato
documentado longitude,latitude. O JWT de autorização usa ES256, Key ID, Team ID,
TTL de cinco minutos e scope `server_api`; o access token retornado por
`/v1/token` é mantido apenas em memória.

### Mapbox

O adaptador usava apenas `/suggest`, que não devolvia coordenadas resolvidas e
não era comparável aos demais. Foi trocado por `/forward`, operação oficial de
text search one-off, com coordenadas e metadata normalizável em um request.

### OSM/provider

Continua exigindo infraestrutura própria ou comercial. O host público
`nominatim.openstreetmap.org` é recusado. O adapter agora preserva eventual
path-prefix do endpoint contratado/self-hosted.

## 6. Dry-run

Comando validado:

```sh
node scripts/places-benchmark/runBenchmark.mjs \
  --dry-run \
  --subset=p0-6 \
  --limit=10 \
  --max-calls=10
```

Resultado:

- casos carregados: 10;
- todos approved: sim;
- providers configurados: Apple;
- providers pulados: Google, Mapbox e OSM/provider;
- requests externos: 0;
- payload bruto persistido: não;
- custo real desta sprint: USD 0;
- custo máximo da rodada: pendente de billing/uso atual da conta;
- gate: `ready_for_explicit_execution` para os dez casos;
- subset: `execution_allowed=true`, `approved_execution_limit=10`.

## 7. Rodadas reais

### Sanidade de três

Status: **concluída no Apple Maps e revisada manualmente**.

| Caso | Resultado humano | Rank | Distância ao ground truth | Latência |
|---|---|---:|---:|---:|
| Ironberg Barra Funda | correto (`Ironberg SP`, endereço confirmado) | 1 | 64 m | 1.174 ms |
| Smart Fit Shopping Light | unidade correta pelo endereço | 1 | 37 m | 484 ms |
| Parque Ibirapuera | correto | 1 | 248 m* | 358 ms |

\* O ground truth do parque é um ponto aproximado, já documentado.

Agregado revisado: cobertura 3/3, top 1 3/3, duplicatas 0, falhas 0,
p50 484 ms e p95 1.174 ms. O scorer inicialmente classificou Ironberg como
errado por comparar literalmente “Ironberg Barra Funda” com “Ironberg SP”. A
heurística foi corrigida para aceitar uma marca distintiva coincidente somente
quando a coordenada está até 300 m do ground truth; o recálculo não fez novas
chamadas externas.

### Dez casos

Status: **concluída no Apple Maps e revisada manualmente**.

| Caso | Resultado humano | Rank |
|---|---|---:|
| Ironberg Barra Funda | correto (`Ironberg SP`) | 1 |
| Smart Fit Shopping Light | unidade correta pelo endereço | 1 |
| Smart Fit Liberdade | unidade correta pelo endereço | 1 |
| Bluefit Leopoldina | correto | 1 |
| Bio Ritmo Paulista | correto | 1 |
| Academia Gaviões Paulista | correto | 1 |
| Parque Ibirapuera | correto | 1 |
| Parque Zilda Natel | correto | 1 |
| CrossFit 79 | correto; `CrossFit 7Nove` apareceu antes | 2 |
| Centro Olímpico | não encontrado corretamente; homônimo errado em Santo Amaro | — |

Agregado humano: cobertura correta 9/10, top 1 8/10, top 3 9/10, zero
duplicatas e zero falhas de transporte. A latência teve p50 de 394 ms e p95 de
2.055 ms. O scorer automático marcou o Centro Olímpico como unidade errada por
similaridade nominal; a revisão humana o classifica como `found_wrong_place`,
pois endereço e coordenada não correspondem ao COTP de Moema.

## 8. Custo e licenciamento

As projeções de produto para 0%, 30% e 70% de resolução interna continuam no
readiness report e são estimativas, não faturas. Sem conta/billing não é possível
confirmar franquia disponível nem custo marginal dos dez requests.

Regras atuais relevantes:

- Google permite persistir Place IDs, mas restringe cache/armazenamento de
  conteúdo e exige atribuição;
- Mapbox Search Box declara uso temporário dos resultados; persistência exige
  produto/contrato adequado;
- o serviço público Nominatim proíbe autocomplete e consultas sistemáticas;
- Apple exige token autorizado; cache, persistência e combinação precisam de
  revisão do contrato aplicável antes de P1;
- um provider OSM comercial/self-hosted precisa ter contrato, rate limit e
  política próprios, além das obrigações ODbL quando aplicáveis.

Referências oficiais:

- [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Google Place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Apple Maps Server API Search](https://developer.apple.com/documentation/applemapsserverapi/-v1-search)
- [Mapbox Search Box API](https://docs.mapbox.com/api/search/search-box/)
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/)

## 9. Comparação atual

| Dimensão | Google | Apple | OSM/provider | Mapbox |
|---|---|---|---|---|
| Credencial | ausente | configurada fora do repo | ausente | ausente |
| Rodada controlada | não executada | 10 casos concluídos | não executada | não executada |
| Cobertura/relevância | pendente | 9/10 corretos; top 1 8/10; top 3 9/10 | pendente | pendente |
| Qualidade/duplicatas | pendente | essenciais utilizáveis nos 9 acertos; 0 duplicatas | pendente | pendente |
| p50/p95 | pendente | 394/2.055 ms | pendente | pendente |
| Consumo da rodada | nenhum | 11 service calls da quota | nenhum | nenhum |
| Licença do endpoint | revisão preliminar | pendente contrato | pendente provider | temporário/restrito |

## 10. Recomendação

Manter o ADR como `Proposed`. A evidência de dez casos valida o adapter Apple e
é promissora para redes e parques, mas não compara provedores e expôs uma falha
em centro esportivo público e uma inversão de relevância na cauda longa.

Próxima ação:

1. configurar um segundo provider comercial autorizado e repetir estes dez;
2. executar uma rodada Apple de 40 casos balanceados, com aprovação separada;
3. reforçar o corte de centros públicos e academias independentes;
4. revisar licença/cache Apple com Privacy/Legal antes de P1;
5. aceitar o ADR somente após comparação e definição explícita de fallback.

Não há base para eliminar os providers não executados nem aceitar o ADR. A P0.6
controlada está encerrada; o gate seguinte é uma rodada comparativa, não a P1.
