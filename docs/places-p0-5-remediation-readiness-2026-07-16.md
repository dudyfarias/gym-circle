# Places P0.5 — remediação, readiness e privacidade

Data: 2026-07-16
Status: **migration aplicada após release gate; frontend validado para rollout**

## 1. Resultado executivo

A P0.5 remove o uso do Nominatim público como autocomplete, corrige a
atribuição OpenStreetMap, endurece a privacidade de `user_gyms`, preserva a
procedência mínima de novos lugares externos e transforma o harness em um
processo seguro de readiness. Nenhum provider foi escolhido.

O benchmark real ainda não pode começar: 65 casos estão `approved` e 95 estão
`uncertain`. Os incertos ficam explicitamente bloqueados até validação
independente; não foram aprovados usando resultados de provider como gabarito.

## 2. Busca temporária até a decisão de provider

### Antes

- dois caracteres e debounce de 280 ms disparavam `/api/places/search`;
- cada alteração relevante podia chegar ao Nominatim público;
- o fluxo se comportava como autocomplete;
- a resposta era rotulada como `Google/Localização`.

### Agora

1. Digitação filtra apenas os locais já cadastrados no Gym Circle.
2. Busca externa exige três caracteres e ação explícita por Enter ou pelo CTA
   `Buscar locais externos`.
3. Client aplica cooldown e cache em memória por query.
4. Endpoint exige intenção explícita e aplica um rate limit defensivo local.
5. O endpoint devolve atribuição OpenStreetMap e não expõe contato pessoal no
   `User-Agent`.
6. Nearby continua sendo uma ação ligada ao uso explícito da localização. O
   Overpass público permanece uma dependência temporária, sem SLA, e deve ser
   substituído na P1 após o ADR.

O header de intenção não é autenticação; ele é um guardrail de contrato. O
rate limit em memória também não é global entre instâncias serverless. A P1
deverá adotar quota distribuída, circuit breaker e kill switch.

## 3. Atribuição por fonte

A origem visual está centralizada no contrato de provider:

| Origem | Label | Atribuição |
|---|---|---|
| Base própria | Gym Circle | nenhuma externa |
| Nominatim/Overpass | OpenStreetMap | `© OpenStreetMap contributors` + link |
| Local atual | Localização atual | nenhuma externa |
| Manual | Contribuição | nenhuma externa |
| Community | Comunidade Gym Circle | nenhuma externa |

Google, Apple e Mapbox já têm representação no contrato, mas só aparecem se um
adapter futuro realmente produzir candidatos dessa fonte.

## 4. Privacidade de `user_gyms`

A migration
`20260716133638_places_p0_5_privacy_and_provenance.sql`:

- remove `user_gyms_select_all`;
- revoga `SELECT` de `anon`;
- permite ao autenticado ler apenas as próprias linhas;
- mantém insert/update/delete próprios;
- cria `get_visible_profile_gym(p_user_id)`, que retorna somente `gym_id`, nome,
  cidade e estado da academia principal quando `private.can_view_profile_posts`
  autoriza;
- cria a view `visible_profile_main_gyms` com `security_invoker` para hidratação
  segura em lote, com o mesmo recorte de dados e as mesmas regras de
  privacidade/bloqueio;
- não expõe academias secundárias, preferências ou datas do vínculo.

O frontend deixa de baixar todos os vínculos e solicita apenas
`user_id = currentUserId`. Academias de terceiros passam a vir exclusivamente
da view limitada; `profiles.main_gym_id` bruto só é aceito para o próprio
usuário. Se a view não estiver disponível, o fallback seguro é ocultar a
academia de terceiros.

Limitação conhecida: `profiles.main_gym_id` continua no contrato legado de
`profiles`, embora não seja mais usado como fonte de terceiros nesta surface. A
P1/P2 deve remover essa coluna das demais surfaces públicas antes de restringir
o contrato sem quebrar edição e compatibilidade.

## 5. Procedência externa

Foi escolhida a tabela separada, compatível com o futuro place ID interno:

`gym_place_external_refs`:

- `gym_id`;
- `provider` (`google`, `apple`, `openstreetmap`, `mapbox`);
- `external_id`;
- `source_service` (`nominatim`/`overpass`, quando aplicável);
- `provider_category`;
- `created_by`, timestamps e metadados opcionais de verificação/expiração.

Regras:

- `unique(provider, external_id)`;
- RLS deny-by-default e sem grants diretos ao client;
- nenhum payload completo é persistido;
- RPC atômica `register_external_gym` reaproveita somente a mesma referência;
- colisão de nome/cidade sem a mesma referência retorna
  `external_gym_requires_manual_review`;
- IDs externos nunca são chave primária do Gym Circle.

O fluxo web agora envia provider, external ID, serviço e categoria ao serviço de
catálogo. Resultados manuais continuam no fluxo legado sem inventar procedência.

## 6. Deduplicação conservadora

O client classifica candidatos em:

- `same_external_ref`;
- `exact_match`;
- `likely_match`;
- `manual_review`;
- `distinct`.

A remoção automática só ocorre para `same_external_ref` do mesmo provider ou
`exact_match`. Proximidade, nome parcial, renomeação e endereço compartilhado
não são suficientes. Unidades de rede com endereços diferentes permanecem
separadas.

Casos automatizados incluem Smart Fit próximas, Bio Ritmo em bairros distintos,
acentos, renomeação, parque/centro esportivo e duas academias no mesmo shopping.

## 7. Benchmark readiness

### Gabarito

| Status | Casos | Pode gerar request? |
|---|---:|---|
| `approved` | 65 | sim, com guardrails |
| `uncertain` | 95 | não |
| Total | 160 | benchmark completo bloqueado |

Cada linha agora registra `review_method` e `review_note`. Não há mais status
legado `draft_manual_verification`.

### Dry-run

O modo padrão não chama API e gera relatório com:

- schema e distribuição dos 160 casos;
- casos bloqueados;
- providers configurados ou pulados;
- quantidade prevista de calls;
- custos com 0%, 30% e 70% de resolução interna;
- confirmação de que raw payload não será persistido.

Execução externa exige simultaneamente:

```text
--execute
--allow-paid-requests
--max-calls=<limite>
```

Além disso, provider, credencial e casos aprovados precisam estar válidos. A
primeira execução deve usar amostra pequena e quota mínima.

## 8. Credenciais pendentes — nomes somente

| Provider | Nomes/configuração |
|---|---|
| Google | `GOOGLE_PLACES_API_KEY`; Places habilitada; billing; quota; restrição server-side |
| Apple | `APPLE_MAPS_TOKEN` no harness; Team ID, Key ID e private key no gerador seguro do backend |
| Mapbox | `MAPBOX_ACCESS_TOKEN`; scopes mínimos e restrições de URL/ambiente |
| OSM | `OSM_NOMINATIM_BASE_URL` de instância própria/comercial permitida; policy/rate limit/atribuição |

O `.env.example` contém apenas os nomes. Nenhum valor entra em log, relatório ou
repositório.

## 9. Custo recalibrado

Estimativa Google conservadora, em USD, preservando as premissas do P0: 50% Text
Search, 50% Nearby, um Details por busca externa, reverse em 20%, mapa web em
25% e autocomplete concluído modelado sem custo.

| Cenário | 0% interno | 30% interno | 70% interno |
|---|---:|---:|---:|
| 5 mil buscas/mês | 0 | 0 | 0 |
| 100 mil buscas/mês | 3.485 | 2.292,50 | 740 |
| 1,5 milhão buscas/mês | 43.880 | 33.575 | 15.430 |

O valor de USD 43.880 é o cenário conservador sem resolução interna, não uma
previsão inevitável. Field masks, sessões, cache/base própria, mapa mobile,
tiers, tributos, câmbio e contrato podem alterar o total.

## 10. Rollout e gates

### P0.5 — esta entrega

- remediação da busca;
- atribuição;
- privacy migration;
- procedência mínima;
- dedupe conservador;
- readiness e custo híbrido.

### P0.6 — próxima

1. confirmar os 95 casos `uncertain` por fonte independente;
2. aprovar credenciais, quota e billing guardrails;
3. executar 5–10 casos por provider;
4. revisar output e compliance;
5. executar o lote aprovado;
6. analisar cobertura, relevância, qualidade, duplicidade e p50/p95;
7. concluir licença/custo;
8. submeter ADR a Produto, Engenharia e Privacy/Legal.

### P1

Só inicia após ADR `Accepted`, salvo experimento isolado por feature flag.

## 11. Validação e estado operacional

- migration aplicada no projeto `gym-circle` como versão remota
  `20260716150451_places_p0_5_privacy_and_provenance`;
- 25 gyms e 25 vínculos `user_gyms` foram preservados;
- `user_gyms` foi validada como owner-only; `anon` não possui `SELECT`;
- view/RPC limitada foram validadas para perfil público, privado, follow aceito
  e bloqueio bidirecional;
- RPC externa foi validada em fixture transacional com `ROLLBACK`: criação
  atômica, autoria por `auth.uid()`, reuso da referência e constraint de
  duplicidade passaram; nenhuma fixture permaneceu;
- nenhum request pago executado;
- nenhuma linha de produto foi criada, removida ou modificada pelo teste;
- nenhuma credencial criada/exposta;
- scripts e testes rodam fora do frontend;
- Android, SwiftUI paralelo, Push e HealthKit preservados.
