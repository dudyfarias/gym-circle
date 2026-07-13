# Roadmap técnico e de produto — Treinos Gym Circle

Data: 2026-07-12
Documento solicitado: `docs/workout-data-product-roadmap-2026-07-10.md`
Base: auditorias de 09/10 de julho, código e migrations versionadas no repositório.
Escopo: Next.js + Capacitor + Supabase.
Fora do escopo: Android, HealthKit/Strava, SwiftUI paralelo, Push e mudanças em produção.

## 1. Resumo executivo

O próximo salto da área de Treinos não depende primeiro de mais gráficos. Ele
depende de registrar intenção e contexto corretamente:

1. qual treino salvo originou a execução;
2. como esse treino estava configurado naquele momento;
3. quais séries eram planejadas, feitas, puladas ou adicionadas;
4. que tipo de carga foi registrado;
5. quais resultados realmente constituem recorde.

Sem essas relações, métricas como “feito 8 vezes”, taxa de conclusão, evolução
por treino e progressão de carga seriam inferidas por nome ou por `0 kg`, o que
produziria respostas convincentes e erradas.

Recomendação central:

- manter `activities` como fonte da sessão concluída;
- vincular opcionalmente a `workout_plans`, sempre com snapshot histórico;
- evoluir o contrato JSONB de `strength_sets` antes de normalizar;
- separar estado da série de sua origem;
- guardar ausência de carga como `null`, nunca como zero;
- calcular estatísticas derivadas a partir de `activities`, sem contadores-cache
  em `workout_plans` nesta fase;
- celebrar apenas PRs confirmados por dados válidos;
- começar a sugestão do dia com regras explicáveis, não com “IA” opaca.

## 2. Problema central: não salvar dado ruim

O dataset verificado pela auditoria v2 é pequeno: 13 activities, 3 de força e
56 séries. Apenas 8 séries tinham carga positiva. O gargalo não é JSONB nem
escala; é semântica.

Princípios obrigatórios:

- campo vazio permanece `null`;
- `0 kg` não significa “peso corporal” nem “não informado”;
- nome não é identidade: usar `exercise_id` e `workout_plan_id`;
- dados históricos não mudam quando um treino salvo é editado;
- “adicionada” é origem, não status;
- pulado e não preenchido não são a mesma coisa;
- PR precisa indicar métrica, unidade, contexto e regra de comparação;
- sugestão deve explicar por que apareceu e poder ser ignorada;
- nenhuma mensagem de recuperação deve soar como diagnóstico médico.

### 2.1 Bloqueadores encontrados no código atual

- o rascunho usa a chave global `gc-web-workout`, sem `user_id`; outra conta no
  mesmo iPhone pode restaurar a sessão anterior;
- o descanso guarda contador relativo e depende de `setInterval`; o WebView
  suspenso não garante contagem nem aviso na tela bloqueada;
- finalizar não possui chave idempotente; se o servidor inserir e a resposta se
  perder, o retry pode criar outra activity;
- “Salvar sem publicar” não pode prometer privacidade enquanto uma activity
  bruta puder aparecer no feed antes de existir post.

Esses itens são anteriores ao novo modelo analítico e formam a Sprint 0.

## 3. Modelo atual verificado

### 3.1 Tabelas e contratos

| Superfície | Estado atual | Suporta hoje | Lacuna |
|---|---|---|---|
| `activities` | sessão, tipo, origem, datas, duração, GPS, calorias, `strength_sets` JSONB | histórico próprio, streak, post social e métricas básicas | não possui `workout_plan_id` nem snapshot do plano |
| `workout_plans` | `id`, dono, nome, exercícios JSONB, timestamps | CRUD e início rápido | não possui favorito, sequência ou estatísticas de execução |
| `posts.source_activity_id` | FK única para activity | um treino vira um post sem duplicação | destaque de PR ainda não está modelado |
| `personal_record_results` | tentativas por activity/métrica | maior carga, 5 km e 10 km; ranking | reps, volume e highlights por activity ainda não existem |
| catálogo de exercícios | 94 exercícios, grupos, equipamento, textos, vídeo/status | picker, explicação e contribuição comunitária | curadoria EN, erros comuns, thumbnail e substituições |
| grupos musculares | 15 grupos | agregação e filtros | IDs/relacionamentos mais ricos não são necessários agora |
| técnicas | 8 técnicas | explicação e vínculo no set | curadoria de mídia e erros comuns |
| `user_activity_days` | fonte diária de streak | consistência/dias ativos | não deve virar fonte de métricas de força |
| achievements/badges | gamificação existente | milestones gerais | novos PRs devem reutilizar o motor, sem duplicar regra |

### 3.2 JSONB atual de séries

O core já persiste:

- reps e carga opcional;
- `exercise_id` e nome snapshot;
- tipo `reps | failure | duration`;
- duração;
- técnica e observações da técnica.

O serializer atual descarta séries não concluídas. Logo, não é possível medir
com confiança planejamento, pulos ou conclusão parcial.

### 3.3 RPCs e processamento existentes

- `get_personal_records` e `get_personal_records_v2`;
- `get_personal_record_leaderboard`;
- `submit_workout_exercise` e `submit_workout_technique`;
- RPCs de feed/detalhe que hidratam activity no post;
- nenhuma RPC dedicada a estatísticas de treino salvo ou histórico agregado.

As migrations já versionadas para `personal_record_results.exercise_id` e
variações do catálogo são propostas pendentes de aplicação; não são tratadas
neste documento como confirmadas em produção.

`packages/core/src/database.types.ts` ainda não cobre planos, catálogo e
recordes; o web usa casts de `SupabaseClient`. Cada sprint de schema deve
regenerar/checkar os tipos e remover os casts somente das superfícies tocadas.

### 3.4 O que calcular client-side por enquanto

Com o volume atual, podem continuar no cliente:

- histórico dos últimos 84 dias;
- volume válido por exercício;
- frequência semanal;
- comparação simples entre duas execuções;
- lacuna de grupo muscular;
- estado de aprendizado para progressão.

Mover para RPC quando um usuário ultrapassar 500 activities, a consulta atingir
p95 acima de 200 ms ou a mesma agregação passar a ser usada por várias telas.

## 4. Activity vinculada ao treino salvo

### 4.1 Migration aditiva proposta

Adicionar a `activities`:

```sql
workout_plan_id uuid null references public.workout_plans(id) on delete set null,
workout_plan_name_snapshot text null,
workout_plan_exercises_snapshot jsonb null,
workout_plan_snapshot_version smallint null,
workout_plan_started_from text null,
client_session_id uuid null,
publication_state text not null default 'private'
```

Valores iniciais de `workout_plan_started_from`:

- `saved_plan`;
- `free_workout`;
- `repeat_activity`;
- `suggestion`;
- `imported`.

`client_session_id` deve ser gerado uma vez ao começar a sessão e ter índice
único `(user_id, client_session_id)`. O mesmo ID sobrevive a background, force
quit e retry. `publication_state` separa o registro privado da criação do post
(`private | composing | shared`); a regra recomendada é activity privada e post
como única entidade social.

Adicionar índice parcial:

```sql
create index activities_user_plan_started_idx
on public.activities (user_id, workout_plan_id, started_at desc)
where workout_plan_id is not null;
```

### 4.2 Integridade e segurança

A FK simples garante existência, mas não garante que activity e plano tenham o
mesmo dono. A migration deve adicionar trigger `private` antes de insert/update
que valide `workout_plans.user_id = activities.user_id`. A função não deve ficar
exposta e seus grants devem ser revogados de `public`, `anon` e `authenticated`.

RLS existente de `activities` continua owner-only; `workout_plans` também.
Qualquer nova tabela em `public` precisa de RLS e privilégios mínimos, conforme
a orientação oficial do Supabase:
https://supabase.com/docs/guides/database/postgres/row-level-security

### 4.3 Por que snapshot é obrigatório

O usuário pode editar, remover ou renomear exercícios do plano. Uma activity
antiga precisa responder “o que foi proposto naquele dia”, não refletir a versão
atual do plano.

O snapshot deve conter somente campos de execução:

- versão do schema;
- `plan_exercise_id` estável;
- `exercise_id` e nome;
- ordem;
- séries e metas;
- tipo de alvo;
- técnica;
- descanso alvo.

Não copiar descrições, vídeos ou textos do catálogo para o snapshot.

### 4.4 Estatísticas: calcular, não armazenar

Não adicionar inicialmente `times_used`, `last_used_at` ou
`average_duration_s` a `workout_plans`. Eles ficam inconsistentes quando uma
activity é apagada, editada ou reatribuída.

Fonte correta:

```text
workout_plans 1 ── N activities
                    ├─ count(*)
                    ├─ max(started_at)
                    ├─ avg(elapsed_s)
                    ├─ volume válido
                    └─ conclusão
```

Persistir apenas `is_favorite boolean not null default false`, porque favorito
é escolha do usuário, não dado derivado.

Primeira implementação pode consultar activities owner-only. Quando a UI
precisar listar muitos planos, criar RPC `get_my_workout_plan_stats()` em uma
única chamada.

### 4.5 Finalização idempotente

Propor RPC transacional:

```text
finalize_workout_activity(p_client_session_id, p_payload)
```

Ela valida `auth.uid()`, retorna a activity já existente quando o mesmo client
ID for repetido e nunca cria duas linhas. O compartilhamento é uma operação
separada e idempotente que cria/vincula no máximo um post via
`posts.source_activity_id`.

Enquanto a activity não estiver vinculada a um post, RPCs de feed não devem
expor a linha como publicação. O histórico privado continua acessível ao dono.

### 4.6 Treinos antigos

- `workout_plan_id = null` continua válido;
- não inferir vínculo por nome;
- oferecer “Associar a um treino salvo” apenas como ação explícita futura;
- snapshots nunca são reconstruídos silenciosamente.

## 5. Séries planejadas, concluídas e puladas

### 5.1 Decisão de domínio

Não usar `added` como status. Uma série adicionada pode ser concluída ou pulada.

```ts
status: "planned" | "completed" | "skipped"
source: "plan" | "added"
```

Durante a sessão, `planned` significa pendente. Na activity finalizada, toda
série deve terminar como `completed` ou `skipped`. Se a sessão for encerrada
com pendências, o fechamento oferece marcar as restantes como puladas.

### 5.2 Contrato JSONB v2 recomendado

```ts
type ActivityStrengthSetV2 = {
  setId: string;
  schemaVersion: 2;
  exerciseBlockId: string;
  planExerciseId: string | null;
  exerciseId: string | null;
  exerciseNameSnapshot: string;
  exerciseOrder: number;
  setOrder: number;
  plannedSetIndex: number | null;
  source: "plan" | "added";
  status: "planned" | "completed" | "skipped";
  targetKind: "reps" | "failure" | "duration";
  plannedRepsMin: number | null;
  plannedRepsMax: number | null;
  plannedDurationSeconds: number | null;
  plannedWeightKg: number | null;
  actualReps: number | null;
  actualDurationSeconds: number | null;
  loadType: "external" | "bodyweight" | "assisted" | "not_provided";
  weightKg: number | null;
  assistedWeightKg: number | null;
  completedAt: string | null;
  skippedAt: string | null;
  skipReason: string | null;
  rpe: number | null;
  rir: number | null;
  note: string | null;
  targetRestSeconds: number | null;
  actualRestSeconds: number | null;
};
```

`exerciseBlockId` diferencia duas ocorrências do mesmo exercício no mesmo plano.
`setId` permite atualizar uma linha sem depender de posição. Campos antigos
continuam decodificados como séries concluídas para compatibilidade.

### 5.3 JSONB agora, tabela depois

Curto prazo: manter JSONB, porque o dataset é pequeno e o fluxo já está pronto.
O core deve:

- ler schema v1 e v2;
- escrever somente v2 para atividades novas;
- preservar planned/skipped no fechamento;
- nunca regravar uma activity antiga apenas por ter sido aberta.

Médio prazo: criar `activity_strength_sets` quando houver necessidade real de
ranking/analytics por série, edição parcial server-side ou escala. A tabela deve
ser derivada/backfilled do JSONB em migration separada, não mantida em dual-write
indefinidamente.

### 5.4 Métricas liberadas

- conclusão = completed / (completed + skipped);
- aderência ao plano considera apenas `source = plan`;
- séries extras usam `source = added` e não inflam o denominador;
- exercício pulado = bloco com zero completed e ao menos um skipped;
- volume planejado vs realizado apenas quando a meta de carga existir;
- treino parcial fica explícito, sem inferir por campo vazio.

## 6. Carga correta

### 6.1 Regras de persistência

| Tipo | Campo | Regra | Volume/PR inicial |
|---|---|---|---|
| `external` | `weightKg` | obrigatório e > 0 | conta para volume e PR |
| `bodyweight` | carga externa opcional futura | `weightKg = null` | reps contam; volume separado |
| `assisted` | `assistedWeightKg` | obrigatório e > 0 | não entra no PR de maior carga |
| `not_provided` | nenhum | todos os pesos null | não entra em volume/PR de carga |

Regras adicionais:

- `weightKg <= 0` é normalizado para `null` na leitura;
- input vazio nunca envia `0`;
- weighted bodyweight futuro deve usar `additionalWeightKg`, não sobrecarregar
  o significado de peso corporal;
- menor assistência só representa progresso quando exercício, reps e contexto
  são comparáveis;
- `bodyweightKgSnapshot` é opcional e só deve existir com consentimento; não é
  necessário para a primeira versão.

### 6.2 UX recomendada

Default por exercício/equipamento:

- halter/barra/máquina: `Carga externa`;
- flexão/barra livre/abdominal: `Peso corporal`;
- graviton/máquina assistida: `Assistido`;
- fallback: `Não informar carga`.

Na linha da série, mostrar um chip discreto. Ao tocar:

- **Carga externa** — input `kg`;
- **Peso corporal** — sem campo obrigatório;
- **Assistido** — input `kg de assistência`;
- **Sem carga informada** — sem input.

Usuários iniciantes veem somente a opção recomendada; as demais ficam num menu.

### 6.3 Validações

- external sem peso positivo: manter pendente ou trocar para not_provided após
  confirmação;
- assisted sem assistência positiva: não concluir como assisted;
- failure permite reps + qualquer modo de carga válido;
- duration normalmente não requer carga, mas não deve bloquear exercício
  isométrico com peso externo.

## 7. Notas, RPE/RIR e descanso

### 7.1 Nível simples, padrão

Por bloco de exercício:

- `exercise_note` até 1.000 caracteres;
- `target_rest_seconds` vindo do plano;
- `actual_rest_seconds` agregado das séries;
- nota pós-exercício opcional.

UX: “Nota para a próxima vez” após concluir o exercício, recolhida por padrão.

### 7.2 Nível avançado

Por série:

- RPE de 1 a 10, passo 0,5;
- ou RIR de 0 a 10;
- nota até 500 caracteres;
- desconforto opcional como texto privado, sem diagnóstico.

Não exigir RPE/RIR e não mostrar os dois por padrão. Preferência do usuário
define qual escala aparece. Se ambos forem persistidos, validar consistência;
para a primeira versão, `num_nonnulls(rpe, rir) <= 1` é mais seguro.

Microcopy:

- RPE: “Quão difícil foi, de 1 a 10?”
- RIR: “Quantas repetições ainda caberiam com boa técnica?”

### 7.3 O que isso libera

- repetir observações úteis no próximo treino;
- sugestão de manter carga quando esforço foi alto;
- descanso-alvo por exercício;
- deload futuro baseado em tendência, nunca em uma sessão isolada;
- explicação mais confiável para uma recomendação.

## 8. Evolução do catálogo

### 8.1 Estado atual e migrations já propostas

O repositório já contém proposta para `parent_exercise_id` e
`movement_pattern`, sem inferência automática. Ela precisa de curadoria e
aplicação separada.

### 8.2 Contrato futuro

Manter/adicionar:

- `name_pt`, `name_en`;
- `aliases_pt`, `aliases_en` — migrar gradualmente de `aliases` único;
- grupo primário e secundários atuais;
- `equipment`;
- `difficulty` (`beginner | intermediate | advanced`);
- `movement_pattern` e `parent_exercise_id`;
- instruções PT/EN;
- `common_mistakes_pt/en`;
- `video_url` e `thumbnail_url`;
- `replacement_exercise_ids` ou tabela relacional curada;
- status e revisão editorial.

Não substituir slugs/IDs atuais. Tradução muda; identidade não.

### 8.3 Pipeline editorial

1. instruções textuais revisadas;
2. tradução humana ou revisão humana do texto assistido;
3. erros comuns;
4. vídeo próprio, licenciado ou animação própria;
5. thumbnail própria;
6. revisão técnica e de direitos;
7. publicação `approved`.

Não copiar vídeos, thumbnails ou descrições de concorrentes. Links de busca
podem ajudar curadoria interna, mas não são mídia aprovada.

### 8.4 Features liberadas

- substituição por equipamento/movimento equivalente;
- onboarding por dificuldade;
- explicação técnica mais confiável;
- treino sugerido com alternativas;
- analytics por movimento sem juntar exercícios apenas pelo nome.

## 9. PRs no pós-treino e no post social

### 9.1 O que já funciona

`personal_record_results` armazena resultados por activity. As migrations
versionadas propõem `exercise_id` canônico e RPC v2. A captura atual reconhece:

- maior carga por exercício;
- 5 km;
- 10 km.

### 9.2 Métricas propostas

Separar claramente:

- `strength_weight` — maior carga externa com reps válidas;
- `strength_reps_at_weight` — mais reps na mesma carga;
- `strength_set_volume` — maior reps × carga numa série;
- `strength_exercise_volume` — maior volume do exercício numa activity;
- `strength_workout_volume` — maior volume válido da activity;
- `run_5k_time` e `run_10k_time`;
- `run_best_pace` apenas com distância mínima e GPS confiável.

“Primeira vez”, treino mais longo e maior número de séries são milestones ou
achievements, não necessariamente PR de força.

### 9.3 Migration/RPC

Manter `personal_record_results` como histórico de tentativas e expandir seu
check de `metric_key` de forma aditiva. Para preservar o que era novo naquele
momento, criar `activity_pr_highlights` imutável com:

- `activity_id`, `user_id` e `metric_key`;
- `exercise_id` nullable;
- nome snapshot, valor anterior, novo valor e unidade;
- `secondary_value`/unidade para reps ou carga de referência;
- `metadata jsonb` pequeno para contexto;
- `achieved_at` e unique por activity/métrica/exercise/escopo.

A captura é server-derived, compara somente activities anteriores e sets
completed com carga válida. A tabela bruta é owner-only; o feed recebe apenas o
subset seguro através da visibilidade do post.

Propor RPC:

```text
get_activity_record_highlights(p_activity_id uuid)
```

Ela retorna apenas resultados da activity que superaram tentativas anteriores,
incluindo `previous_value`, diferença e tipo. Deve ler os highlights imutáveis,
ser `security invoker`, validar visibilidade pela RLS e nunca aceitar outro user
arbitrário.

### 9.4 Pós-treino premium

Hierarquia:

1. `Treino concluído`;
2. hero do maior highlight: `Novo PR no Supino Reto`;
3. resumo: duração, exercícios, conclusão, volume válido;
4. lista “Você evoluiu em 3 exercícios”;
5. adicionar foto/legenda;
6. `Compartilhar no Circle` e `Salvar sem publicar`.

### 9.5 Post social

- pílula de PR no bloco do treino;
- card compacto com exercício, métrica e evolução;
- não duplicar resumo quando houver mídia;
- usuário pode remover o destaque antes de publicar;
- post referencia `source_activity_id`, não copia recorde sem rastreabilidade;
- feed nunca recalcula “novo” usando dados futuros.

Para preservar o que era novo naquele momento, a versão posterior pode salvar
IDs dos highlights escolhidos no post ou numa tabela de ligação.

## 10. Treino sugerido do dia

### 10.1 V1 — determinística e explicável

Entradas:

- planos salvos/favoritos;
- última activity por plano;
- exposição de grupos nos últimos 7/14 dias;
- frequência semanal;
- último grupo treinado;
- sequência configurada, quando existir.

Score sugerido:

```text
+ 40 plano favorito não executado recentemente
+ 30 próximo da sequência configurada
+ 20 contém grupo pouco registrado em 14 dias
+ 10 ajuda a meta de frequência semanal
- 30 repete majoritariamente o treino de ontem
```

Retornar no máximo uma sugestão principal e duas alternativas, sempre com
motivo. Não usar RPE nem “recuperação” na V1.

### 10.2 V2 — sequência de planos

Adicionar a `workout_plans`:

- `sequence_id` nullable;
- `sequence_position` nullable;
- ou uma tabela `workout_plan_sequences` + itens ordenados.

Isso suporta PPL, Upper/Lower e ABC sem inferir pelo nome.

### 10.3 V3 — contexto avançado

Somente após RPE/RIR, volume e conclusão confiáveis:

- tendência de esforço;
- volume recente;
- sessões incompletas;
- manutenção de carga;
- deload simples com linguagem cautelosa.

Copy correta:

- “Pode ser um bom dia para Pull.”
- “Faz 6 dias que você não registra pernas.”
- “Seu próximo treino na sequência é Pull.”

Evitar: “Seu músculo está recuperado” ou “Você deve treinar X”.

## 11. Favoritos e evolução por treino

### 11.1 Card do treino salvo

- estrela/fixar;
- `Feito X vezes`;
- `Última vez há N dias`;
- número de exercícios;
- duração média;
- CTA único `Começar`.

### 11.2 Detalhe

- últimas execuções;
- duração média e melhor consistência;
- volume médio/máximo válido;
- conclusão média;
- exercícios mais pulados;
- evolução percentual comparando medianas de janelas, não a primeira contra a
  última sessão isolada.

### 11.3 Cálculos

- `times_used`: count activities com plan ID;
- última execução: max started_at;
- duração média: média ou mediana de elapsed_s válido;
- volume: somente external com peso/reps positivos;
- conclusão: completed / (completed + skipped), apenas séries do plano;
- evolução percentual: mediana das últimas 3 vs 3 anteriores, exigindo ao menos
  duas sessões em cada janela.

### 11.4 RPC futura

`get_my_workout_plan_stats(p_limit integer default 20)` retorna stats apenas do
usuário autenticado. O frontend não deve fazer N queries por card.

Índices:

- activities `(user_id, workout_plan_id, started_at desc)` parcial;
- workout_plans `(user_id, is_favorite desc, updated_at desc)`;
- não criar índices JSONB antes de uma query medida justificar.

## 12. QA visual autenticado em iPhone

### 12.1 Pré-requisitos

- build Capacitor/TestFlight atual;
- iPhone pequeno e grande;
- duas contas de teste sem dados compartilhados;
- plano com reps, falha, duração, bodyweight e assisted;
- modo avião e rede instável disponíveis;
- logs debug sem tokens ou conteúdo sensível.

### 12.2 Matriz obrigatória

| Área | Cenário | Resultado esperado | Gate |
|---|---|---|---|
| Auth | login, logout e conta B | nenhuma sessão/histórico da conta A aparece | bloqueante |
| Sessão | iniciar plano e livre | plan ID/snapshot corretos; livre fica null | bloqueante |
| Retomar | background, matar e reabrir | mesma sessão, timer coerente, sem duplicar activity | bloqueante |
| Offline | concluir sem internet | sessão não é perdida; erro e retry explícitos | bloqueante |
| Teclado | reps/kg em iPhone pequeno | campo e CTA visíveis; footer recolhido | bloqueante |
| Safe area | notch/home indicator | descanso/footer não se sobrepõem | bloqueante |
| Reps | vazio/parcial/zero | zero não vira série concluída | bloqueante |
| External | kg vazio/0/positivo | vazio/0 não entram em volume; positivo entra | bloqueante |
| Bodyweight | reps sem kg | conclui como bodyweight, sem PR de carga | alto |
| Assisted | assistência positiva | unidade/copy corretas; não vira PR de maior carga | alto |
| Falha | com e sem carga | reps obrigatórias, carga opcional, confirmação explícita | bloqueante |
| Duração | 30s/tempo manual | não mostra reps/kg como principal | bloqueante |
| Descanso | iniciar, ±10, pular, pausar | nunca coberto; não toca após encerrar | alto |
| Navegação | swipe e Próximo | estado preservado, sem double advance | alto |
| Pular | série/exercício | status skipped explícito e reversível durante sessão | alto |
| Finalizar | pendências e <2 min | confirmação correta; nada publica sozinho | bloqueante |
| Resumo | volume/PR/conclusão | ignora dado inválido e permite ocultar PR | bloqueante |
| Social | salvar/publicar/mídia | uma activity, um post, sem duplicação | bloqueante |
| Sem rede | publicar e retry | não cria dois posts nem perde legenda | bloqueante |
| Acessibilidade | VoiceOver/tamanho de texto | labels, ordem e CTAs compreensíveis | alto |

### 12.3 Gates específicos de lifecycle e privacidade

- namespace do rascunho: `gc-web-workout:{userId}` ou payload com
  `ownerUserId`, rejeitando restore de outro usuário;
- logout com treino ativo exige decisão explícita: cancelar logout, descartar ou
  preservar somente no namespace do dono;
- background de 30 s/5 min e force quit devem derivar tempo de timestamps;
- descanso usa `endsAtMs`, não decremento acumulado; aviso com tela bloqueada só
  pode ser prometido após bridge/notificação local nativa testada;
- finalizar offline mantém rascunho; retry com o mesmo `client_session_id`
  resulta em uma única activity;
- resposta perdida após insert também retorna a mesma activity;
- conta B nunca vê sessão, planos, histórico ou resumo da conta A;
- salvar sem publicar não cria item social nem usa copy ambígua.

### 12.4 Evidências por execução

Registrar por build:

- aparelho/iOS/build;
- conta e fixture usada;
- vídeo dos fluxos bloqueantes;
- resultado esperado/real;
- log sanitizado;
- issue vinculada;
- aprovação de produto + engenharia.

Não declarar QA visual concluído com testes unitários ou screenshots estáticos.

## 13. Roadmap implementável

O código atual já contém partes das antigas Sprints 1, 2, 3, 4 e 6. Para evitar
refazer trabalho, a sequência abaixo usa estado real do repositório.

### Sprint 0 — Sessão, privacidade e idempotência

**Objetivo:** impedir vazamento entre contas, duplicação e timer incorreto.

**Escopo:** storage namespaced por usuário, `ownerUserId`, `client_session_id`,
finalização idempotente, estado social privado/compartilhado e descanso por
timestamp absoluto.

**Fora:** plano salvo, novos gráficos e PR social.

**Migration:** sim, client session/publication state e unique index.
**RPC:** `finalize_workout_activity`; publicação idempotente pode reutilizar ou
evoluir o merge atual.
**Arquivos:** workoutSession, restTimer, WebWorkoutScreen, auth/logout, core
activity/service, migrations e RPCs de feed.
**Riscos:** apagar rascunho válido, dupla activity e alarme tardio.
**Testes:** A/B/A, logout offline, resposta perdida, retry, background, force
quit e treino privado.
**Aceite:** zero restore cruzado, uma activity por client ID, activity privada
fora do feed e timer derivado de timestamps.
**Entrega:** exige smoke TestFlight/iPhone; aviso em tela bloqueada pode exigir
mudança nativa/local notification e novo build.

### Sprint A — Fundação activity ↔ plan

**Objetivo:** criar identidade histórica do treino executado.

**Escopo:** plan ID, snapshots, `is_favorite`, threading na sessão local e
activity, stats básicas derivadas e cards de uso.

**Fora:** conclusão por série, PR novo e sugestão.

**Migration:** sim, aditiva em activities/workout_plans.
**RPC:** opcional; começar query owner-only, criar uma agregada se evitar N+1.
**Arquivos:** migration, database types, core activity, services, workoutSession,
WebWorkoutScreen, useWorkoutPlans e cards.
**Riscos:** plano de outro usuário, snapshot grande, perder plan ID ao retomar.
**Testes:** owner validation, plano apagado, snapshot imutável, livre, retomar,
estatísticas após apagar activity.
**Aceite:** “feito X vezes”, última execução e duração vêm de activities reais.
**Entrega:** web ao vivo; mudança de core/Capacitor exige `cap sync` e smoke no
iPhone, mas não necessariamente novo binário se só houver web bundle remoto.

### Sprint B — Séries semânticas e carga correta

**Objetivo:** tornar cada set confiável para analytics.

**Escopo:** schema JSONB v2, status/source, planned vs actual, load type,
bodyweight/assisted/not provided, skip e conclusão.

**Fora:** normalização em tabela, RPE/RIR e PR social.

**Migration:** não para JSONB; constraints/índices só quando normalizar.
**RPC:** não.
**Arquivos:** core activity, session storage, WebWorkoutScreen, summary,
history/progress e testes.
**Riscos:** serializer descartar skipped, sessão v1, zero reintroduzido.
**Testes:** decoder v1/v2, external/bodyweight/assisted, falha/duração,
planned/completed/skipped/added e cálculo de conclusão/volume.
**Aceite:** activity final explica exatamente o planejado, feito e pulado;
volume externo ignora vazio/zero.
**Entrega:** web + `cap sync` apenas se plugin/config mudar; QA TestFlight é gate.

### Sprint C — Contexto avançado

**Objetivo:** notas e esforço opcionais sem poluir o fluxo.

**Escopo:** nota por exercício/set, descanso alvo/real, RPE ou RIR em avançado.

**Fora:** deload automático.

**Migration:** não se permanecer no JSONB v2; sim se criar tabela normalizada.
**RPC:** não.
**Arquivos:** tipos de plano/activity, editor do plano, card de exercício,
restTimer, histórico e resumo.
**Riscos:** fricção e dados inconsistentes entre RPE/RIR.
**Testes:** validação de faixa, privacidade das notas, descanso real, campos
recolhidos e legado sem contexto.
**Aceite:** iniciante conclui sem ver campos avançados; usuário avançado recupera
notas no próximo treino.
**Entrega:** web; TestFlight obrigatório se houver aviso/haptic em background.

### Sprint D — PRs e pós-treino social

**Objetivo:** transformar progresso confiável em celebração.

**Escopo:** métricas novas, RPC de highlights, resumo premium, pílula/card social
e opt-out.

**Migration:** sim, personal_record_results/contexto.
**RPC:** `get_activity_record_highlights`.
**Arquivos:** migrations/RPC, usePersonalRecords, WorkoutCompletionSummary,
SocialPostCard/FeedActivityCard e i18n.
**Riscos:** PR falso, corrida estimada tratada como real e destaque recalculado.
**Testes:** recorde anterior, empate, zero/null, assisted, corrida estimada,
opt-out e post histórico imutável.
**Aceite:** cada highlight tem regra reproduzível e ignora carga inválida.
**Entrega:** migration + web; QA social autenticado, sem necessidade de build
nativo se nenhum arquivo iOS mudar.

### Sprint E — Evolução por treino e favoritos

**Objetivo:** devolver valor do vínculo criado na Sprint A.

**Escopo:** detalhe do plano, conclusão, volume, duração, últimas execuções,
favorito/mais executado.

**Migration:** apenas `is_favorite` se não entrar na Sprint A.
**RPC:** `get_my_workout_plan_stats`.
**Arquivos:** useWorkoutPlans, cards/hub, nova sheet de detalhe, progress charts
e database types.
**Riscos:** N+1 e percentuais com amostra mínima.
**Testes:** delete/edit de activity, favorito, plano apagado, amostra mínima e
paginação.
**Aceite:** estatísticas reconciliam com activities e mostram amostra insuficiente.
**Entrega:** migration/RPC + web; smoke Capacitor.

### Sprint F — Sugestão do dia V1

**Objetivo:** uma recomendação explicável e ignorável.

**Escopo:** scorer determinístico, motivo, favorito, grupo pouco registrado e
frequência.

**Fora:** prescrição de carga, recuperação médica, deload e ML.
**Migration:** não para V1; sequência explícita exige migration posterior.
**RPC:** opcional `get_workout_suggestion_context`.
**Arquivos:** workoutInsights, hub de treino, useWorkoutPlans/progress e i18n.
**Riscos:** linguagem médica, repetição e sugestão sem dados.
**Testes:** sem dados, uma sessão, semanas parciais, favorito recente, dismiss e
determinismo.
**Aceite:** sem histórico mostra onboarding; com histórico explica cada sugestão.
**Entrega:** web; não exige build nativo.

### Sprint G — Catálogo editorial e sequências

**Objetivo:** biblioteca premium e rotinas PPL/ABC/Upper-Lower explícitas.

**Escopo:** aliases por idioma, erros comuns, mídia licenciada, substituições e
sequências de planos.

**Fora:** copiar assets de concorrentes e publicar contribuições sem revisão.
**Migration:** sim.
**RPC:** CRUD seguro/admin para curadoria; usuário apenas lê approved.
**Arquivos:** migrations, useWorkoutCatalog, sheets/editor, painel/processo de
curadoria e i18n.
**Riscos:** copyright, tradução falsa e contribuição comunitária sem revisão.
**Testes:** RLS creator/moderador, locale, ciclo de variação, substituição,
licença ausente e fallback sem mídia.
**Aceite:** todo asset tem origem/licença e toda variação é curada.
**Entrega:** migration + web; sem build iOS, mas smoke Capacitor.

### Sprint H — Escala e integrações

**Objetivo:** escalar consultas e integrar fontes externas somente após dados
reais justificarem.
**Escopo:** tabela `activity_strength_sets`, backfill/cutover, RPCs agregadas e,
em sprints independentes, HealthKit/Strava/Android/SwiftUI.
**Fora:** iniciar por antecipação antes dos thresholds.
**Migration/RPC:** sim.
**Arquivos:** core/database types, migrations, hooks de progresso e bridges
nativas nas sprints específicas.
**Riscos:** dual-write, duplicata importada e regressão nativa.
**Testes:** reconciliação JSONB/tabela, idempotência, p95 e integração por fonte.
**Aceite:** contagens reconciliam e thresholds (>500 activities/user ou p95
>200ms) justificam a mudança.
**Entrega:** normalização web não exige build; integrações nativas exigem
TestFlight e revisão separada.

## 14. Migrations futuras propostas

1. `harden_workout_session_finalization`
   - client session, publication state, idempotência e feed privado.
2. `link_activities_to_workout_plans`
   - plan ID, snapshots, started_from, owner trigger, índice e favorito.
3. `create_activity_pr_highlights`
   - highlights imutáveis e contexto; tentativas continuam em
     `personal_record_results`.
4. `workout_plan_sequences`
   - sequência e itens ordenados.
5. `expand_workout_catalog_editorial`
   - aliases PT/EN, erros, thumbnail, difficulty e substituições.
6. `normalize_activity_strength_sets`
   - somente quando critérios de escala/consulta forem atingidos.

Cada migration deve ser aditiva, testada em preview e ter SQL de validação e
rollback lógico. Nenhuma deve ser aplicada em produção junto de uma mudança que
dependa dela sem estratégia compatível de deploy.

## 15. RPCs futuras propostas

- `finalize_workout_activity(p_client_session_id, p_payload)`;
- `get_my_workout_plan_stats(p_limit)`;
- `get_activity_record_highlights(p_activity_id)`;
- `get_workout_suggestion_context()` — somente se o client exigir várias
  consultas;
- `get_exercise_progress_v2(p_exercise_id, p_range)` quando escala justificar;
- RPCs administrativas privadas para curadoria, nunca abertas ao cliente comum.

Preferir `security invoker`. Funções privilegiadas ficam em schema privado,
com `search_path` fixo e grants revogados. Views públicas, se usadas, devem ser
`security_invoker = true`.

## 16. Riscos técnicos

| Risco | Consequência | Mitigação |
|---|---|---|
| inferir plano pelo nome | histórico incorreto | vínculo explícito + snapshot |
| persistir counters no plano | drift após delete/edit | derivar de activities |
| usar `added` como status | série adicionada não pode ser concluída/pulada | separar status/source |
| dual-write JSONB+tabela | divergência silenciosa | uma fonte por fase, backfill único |
| `0 kg` como ausência | PR/volume falso | null + load type |
| assisted como maior carga | progressão invertida | métrica própria/contexto |
| editar plano muda passado | analytics instável | snapshot imutável |
| PR recalculado no feed | “novo” muda com o tempo | highlight da activity/post |
| N queries por plano | lentidão | RPC agregada quando necessário |
| sugestão médica | risco de confiança/compliance | linguagem explicável e cautelosa |
| sessão local entre contas | vazamento de dados | storage namespaced + limpeza no logout |
| retry sem idempotência | activities/posts duplicados | client session único + RPC transacional |
| contador relativo em background | descanso incorreto/alarme tardio | `endsAtMs` + bridge local testada |
| activity antes do post | “salvar privado” aparece no feed | publication state + post como entidade social |
| migration antes/depois errado | app quebrado | expand/migrate/contract + fallback |
| vídeo sem licença | risco jurídico | pipeline editorial e prova de licença |
| types Supabase desatualizados | contrato quebrado só em runtime | regenerar tipos após cada migration |

## 17. Top 10 decisões

1. Corrigir isolamento de sessão e idempotência antes de novos dados.
2. Ligar activity a plan por ID e snapshot, nunca por nome.
3. Derivar estatísticas de activities; não manter counters-cache agora.
4. Persistir apenas favorito como atributo do plano.
5. Separar `status` de `source` nas séries.
6. Evoluir JSONB para v2 antes de normalizar.
7. Tratar `null` como não informado e `0` como inválido.
8. Modelar external/bodyweight/assisted/not_provided explicitamente.
9. Celebrar somente PRs reproduzíveis e imutáveis.
10. Começar sugestão do dia com regras simples e explicáveis.

## 18. Obrigatório antes de novos gráficos

- `exercise_id` canônico aplicado;
- carga vazia/zero saneada na escrita e leitura;
- load type;
- status/source de série;
- snapshot do plano para evolução por treino;
- definição de volume por tipo de carga;
- amostra mínima e estado vazio explícitos;
- QA de troca de conta e sessão local.

Sem isso, gráficos devem permanecer limitados ao histórico validado atual.

## 19. O que exige migration

- activity ↔ plan e snapshots;
- client session/publication state/idempotência;
- favorito persistido;
- novas métricas/contexto de PR;
- sequências de planos;
- campos editoriais adicionais do catálogo;
- eventual tabela normalizada de sets.

## 20. O que pode começar sem migration

- contrato JSONB v2 de sets, com decoder v1;
- UX de load type;
- notas/RPE/RIR dentro do JSONB;
- scorer de sugestão V1 usando histórico atual;
- resumo premium com métricas já válidas;
- checklist e automação parcial de QA;
- curadoria textual em arquivos de preparação, sem publicar conteúdo não revisto.

## 21. Sprint recomendada agora

Começar pela **Sprint 0 — Sessão, privacidade e idempotência**. Depois executar
**Sprint A — Fundação activity ↔ plan** e **Sprint B — Séries semânticas e carga
correta**.

A Sprint 0 remove riscos de vazamento e duplicação. A Sprint A habilita favorito,
uso e evolução por treino. A Sprint B impede que essas métricas sejam construídas
sobre zeros, pulos invisíveis e metas misturadas com resultado.

## 22. Critérios de release

- migrations validadas em preview e advisors sem regressão relevante;
- RLS owner-only testada com duas contas;
- core lê dados antigos e novos;
- lint, TypeScript, testes e build verdes;
- `git diff --check` limpo;
- nenhum secret ou arquivo nativo fora de escopo;
- QA autenticado no iPhone para todos os cenários bloqueantes;
- deploy expand/migrate/contract documentado;
- rollback funcional sem apagar histórico.

## 23. Próximo prompt recomendado

> Implementar a Sprint 0 — Sessão, privacidade e idempotência. Namespacear o
> rascunho por userId e validar owner no restore; adicionar client_session_id e
> publication_state; criar finalização idempotente; impedir activity privada no
> feed; migrar descanso para endsAtMs; testar A/B/A, logout, offline, resposta
> perdida, background e force quit. Não aplicar produção nem publicar sem
> aprovação.

## 24. Validação desta entrega

Esta entrega altera somente documentação. Não cria migration, RPC ou código.
Executar `git diff --check`, confirmar o diff exclusivo do documento, fazer
commit seletivo e push. A aplicação técnica começa apenas após aprovação da
Sprint 0.
