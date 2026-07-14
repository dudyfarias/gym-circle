# QA e ativação dos dados novos de Treinos — 2026-07-13

## 1. Objetivo e limites

Esta sprint valida a fundação já publicada da área de Treinos e prepara a
ativação por uso normal do app. Não cria migration, não altera dados de produção
diretamente e não publica código. As consultas executadas nesta auditoria foram
somente leitura.

O gate principal continua sendo um treino autenticado iniciado em **Meus
treinos** num iPhone físico. Sem essa execução, o schema pode ser confirmado,
mas não é correto declarar a ativação dos dados reais como concluída.

## 2. Estado técnico confirmado

| Área | Estado no schema/código | Estado em dados reais |
|---|---|---|
| Activity ↔ treino salvo | Funcional: `workout_plan_id`, snapshots de nome/exercícios/versão, origem e validação de ownership | Estrutural: 0 de 16 activities ligadas |
| Séries semânticas | Funcional: `set_status` (`planned`, `completed`, `skipped`, `added`) e `set_origin` | Legado: 67 séries anteriores aparecem como `added` |
| Tipos de carga | Funcional: `external`, `bodyweight`, `assisted`, `not_provided`; carga vazia/zero vira ausência | Parcial: 15 external, 52 not_provided, 0 bodyweight e 0 assisted |
| RPE/RIR e nota por set | Controles opcionais e serialização presentes | Não ativado: 0 registros reais |
| Descanso alvo | Controle avançado e serialização presentes | Não ativado: 0 registros reais |
| Descanso real | Contrato e banco presentes; faltava associação do timer ao set | Patch local nesta sprint; ainda requer QA físico e publicação futura |
| Nota geral/exercício | `workout_note` e `workout_exercise_context` existem no contrato/RPC | Só estrutural; ainda não existe fluxo visual seguro |
| Favoritos e estatísticas | `is_favorite` e RPC `get_my_workout_plan_stats()` funcionais | Não ativado: 0 favoritos e nenhuma activity ligada |
| Recomendador V1 | Funcional e explicável: dia da semana, transição, frequência, recência e favorito | Fallback de baixa confiança enquanto não houver histórico ligado |
| PR highlights | Trigger, tabela, RPC, resumo pós-treino e card social funcionais | Ativo: 4 highlights, todos de maior carga |
| Catálogo | 94 exercícios e governança estrutural publicada | Conteúdo editorial incompleto: sem vídeos, aliases, erros comuns, variações ou revisões |

### Baseline read-only de produção

Captura em 13/07/2026:

- 16 activities;
- 67 séries;
- 7 treinos salvos;
- 5 resultados de recordes pessoais;
- 4 highlights de PR;
- 94 exercícios no catálogo;
- 0 activities com `workout_plan_id`;
- 0 treinos favoritos;
- 0 sets com `actual_rest_s`, RPE, RIR ou nota.

Os dez treinos mais recentes também estavam sem `workout_plan_id`, snapshot e
origem. Isso é compatível com dados anteriores ao rollout; não é evidência de
falha do fluxo novo até que um treino seja iniciado por **Meus treinos**.

## 3. Fluxo confirmado no código

1. O card em **Meus treinos** chama `startWorkoutPlan`.
2. O plano cria séries com origem `planned`, status `planned`, IDs de exercício,
   metas e contexto do plano.
3. A sessão local guarda o dono, o `client_session_id`, o plano, snapshots e a
   origem (`saved_plan`, `suggested` ou `duplicate`).
4. Na finalização:
   - série planejada marcada vira `completed`;
   - série adicionada e marcada mantém status `added` e origem `added`;
   - série pulada mantém `skipped`;
   - série não concluída permanece `planned`;
   - carga vazia permanece `null`/`not_provided`;
   - carga externa positiva entra em volume e PR;
   - `workout_plan_id`, snapshots e origem chegam à RPC idempotente.
5. O trigger gera highlights reproduzíveis e o resumo/post os lê por RPC.
6. A RPC de estatísticas deriva uso, recência, duração, volume e conclusão das
   activities. Nenhum contador agregado é mantido em `workout_plans`.

## 4. Patch mínimo desta sprint — descanso real

### Causa raiz

`actual_rest_s` já era lido, persistido no rascunho e enviado na finalização,
mas nenhum handler atribuía um valor ao set. O timer era global e não guardava
qual série o havia iniciado.

### Correção local

- a sessão passa a guardar `restSetClientId`;
- ao iniciar o descanso, o app associa o timer ao último set concluído do
  exercício atual ainda sem descanso registrado;
- ao terminar naturalmente ou tocar em **Pular**, calcula
  `presetS - remainingS` e grava em `actualRestS` somente naquele set;
- o vínculo sobrevive a background/reabertura pelo rascunho local;
- desmarcar a conclusão do set remove seu descanso real;
- se não houver set elegível, o timer continua utilizável, mas não inventa uma
  associação.

Nenhum schema ou dado de produção foi alterado.

## 5. Roteiro obrigatório — iPhone físico autenticado

### 5.1 Gate principal: Meus treinos

- [ ] Abrir build atual no iPhone físico e fazer login com a conta principal.
- [ ] Ir a **Treino** → **Meus treinos**.
- [ ] Escolher um treino salvo e tocar em **Começar**.
- [ ] Confirmar que o nome/exercícios correspondem ao plano escolhido.
- [ ] Completar uma série com carga externa positiva.
- [ ] Completar uma série com carga não informada.
- [ ] Selecionar **Peso corporal** e completar uma série.
- [ ] Selecionar **Assistido**, informar assistência positiva e completar.
- [ ] Abrir os campos avançados de uma série e preencher RPE ou RIR.
- [ ] Preencher uma nota curta de set.
- [ ] Informar descanso alvo.
- [ ] Pular uma série/exercício planejado.
- [ ] Adicionar uma série manual e concluí-la.
- [ ] Iniciar descanso após um set; deixar um terminar.
- [ ] Iniciar outro descanso e tocar em **Pular** antes do fim.
- [ ] Minimizar o app durante um terceiro descanso e reabrir.
- [ ] Finalizar o treino e revisar duração, sets, reps, volume e eventual PR.
- [ ] Compartilhar no Circle.
- [ ] Guardar o ID/horário da activity para validar com as consultas abaixo.

Resultado esperado: activity com plano/snapshots, combinação coerente de status,
tipos de carga corretos, `actual_rest_s` apenas nos sets associados e post com o
mesmo highlight do resumo quando houver PR.

### 5.2 Matriz complementar

#### Treino livre

- [ ] Iniciar Musculação por **Modalidades**.
- [ ] Confirmar `workout_plan_id = null` e origem `free`.
- [ ] Adicionar exercício/set e finalizar sem vazamento de dados do plano salvo.

#### Treino sugerido e favorito

- [ ] Favoritar um treino e confirmar estrela/ordenação.
- [ ] Iniciar pelo card sugerido e validar origem `suggested`.
- [ ] Após finalizar, reabrir Treino e conferir uso/recência/recomendação.
- [ ] Desfavoritar e confirmar rollback visual em caso de falha de rede.

#### Sessão e resiliência

- [ ] Treino abaixo de 2 minutos pede confirmação.
- [ ] Teclado não cobre reps, kg, avançado, descanso ou CTA principal.
- [ ] Safe area funciona em iPhone pequeno e grande.
- [ ] Background preserva sessão, set atual, timer e plano.
- [ ] Sem internet mantém rascunho; finalização mostra erro recuperável.
- [ ] Logout/login na mesma conta restaura somente o próprio rascunho.
- [ ] Troca para outra conta não mostra nem reivindica a sessão anterior.
- [ ] Voltar à primeira conta recupera apenas o rascunho dela, se ainda existir.

#### Tipos especiais

- [ ] Exercício por tempo mostra duração, não força reps/kg.
- [ ] Exercício até a falha exige reps, permite carga opcional e conclusão manual.
- [ ] Peso corporal não cria PR de maior carga externa.
- [ ] Assistido usa `assisted_weight_kg` e não cria PR de maior carga.
- [ ] Não informado mantém todos os pesos nulos.

## 6. SQL read-only para depois do teste

> Os nomes abaixo refletem o schema publicado. Versões antigas do checklist
> usavam `workout_plan_origin`, `status` e `workout_pr_highlights`; os nomes
> corretos são `workout_plan_started_from`, `set_status`/`set_origin` e
> `activity_record_highlights`.

### 6.1 Activities recentes

```sql
select
  id,
  user_id,
  activity_type,
  workout_plan_id,
  workout_plan_name_snapshot,
  workout_plan_version_snapshot,
  workout_plan_started_from,
  started_at,
  ended_at,
  elapsed_s,
  jsonb_array_length(coalesce(strength_sets, '[]'::jsonb)) as sets_count,
  created_at
from public.activities
order by created_at desc
limit 10;
```

### 6.2 Séries, origem, carga e contexto avançado

```sql
select
  a.id as activity_id,
  a.workout_plan_id,
  s->>'set_id' as set_id,
  s->>'exercise_id' as exercise_id,
  s->>'exercise' as exercise,
  s->>'set_status' as set_status,
  s->>'set_origin' as set_origin,
  s->>'load_type' as load_type,
  s->>'reps' as reps,
  s->>'weight_kg' as weight_kg,
  s->>'assisted_weight_kg' as assisted_weight_kg,
  s->>'rpe' as rpe,
  s->>'rir' as rir,
  s->>'target_rest_s' as target_rest_s,
  s->>'actual_rest_s' as actual_rest_s,
  s->>'note' as note
from public.activities a
cross join lateral jsonb_array_elements(
  coalesce(a.strength_sets, '[]'::jsonb)
) s
order by a.created_at desc, (s->>'set_index')::integer
limit 100;
```

### 6.3 Treinos salvos

```sql
select
  id,
  user_id,
  name,
  plan_version,
  is_favorite,
  created_at,
  updated_at
from public.workout_plans
order by updated_at desc
limit 20;
```

### 6.4 Estatísticas derivadas

Executar pela Data API com uma sessão autenticada do próprio usuário:

```sql
select * from public.get_my_workout_plan_stats();
```

Campos esperados: `execution_count`, `last_executed_at`,
`average_duration_s`, `average_volume_kg`, `max_volume_kg` e
`average_completion_rate`. No SQL Editor, `auth.uid()` normalmente é nulo; não
usar resultado vazio dali para concluir que a RPC falhou.

### 6.5 Highlights e recordes

```sql
select
  id,
  activity_id,
  user_id,
  exercise_id,
  metric_key,
  value,
  unit,
  previous_value,
  achieved_at,
  created_at
from public.activity_record_highlights
order by created_at desc
limit 20;

select *
from public.personal_record_results
order by achieved_at desc
limit 20;
```

## 7. Critérios de validação depois de uma execução

- `workout_plan_id` igual ao plano escolhido;
- nome, exercícios e versão preservados nos snapshots;
- origem `saved_plan` ou `suggested`, conforme o CTA usado;
- séries planejadas concluídas com `set_status = completed`;
- série pulada com `set_status = skipped`;
- série criada na sessão com `set_origin = added` e status `added` quando feita;
- kg vazio como `null` e `load_type = not_provided`;
- external com `weight_kg > 0`;
- bodyweight sem peso externo;
- assisted com `assisted_weight_kg > 0`;
- RPE/RIR/nota presentes somente quando informados;
- `actual_rest_s` coerente com o timer e associado ao set correto;
- RPC passa de zero para uma execução no plano;
- recomendador passa a ter uma sessão ligada e ainda informa confiança baixa;
- highlight aparece somente se a activity realmente superar a marca anterior.

## 8. Pendências deliberadas

### Nota geral e nota por exercício

O schema e a RPC aceitam `workout_note` e `workout_exercise_context`, mas a tela
atual só expõe nota por set. Adicionar a nota depois que a activity já foi
finalizada exigiria um fluxo explícito de atualização/erro/retentativa. Isso não
é um patch seguro desta sprint e fica para uma entrega pequena dedicada.

### Types do Supabase

`packages/core/src/database.types.ts` está desatualizado e explica os casts
manuais no web. A geração atual produz aproximadamente 97 mil caracteres,
contra 60 mil do arquivo versionado, incluindo os novos campos e RPCs. Como a
substituição geraria diff amplo, ela deve ser feita numa PR exclusiva, com
revisão dos casts removidos e suíte completa. Não foi alterada nesta sprint.

### QA físico

O checklist acima não pode ser marcado como concluído por teste unitário,
browser desktop ou inspeção de código. É necessário executar no iPhone e então
repetir as consultas read-only.

## 9. Próxima sprint — Workout Plan Detail & Evolution

Sem migration nova, a próxima tela pode reutilizar `workout_plans`,
`get_my_workout_plan_stats()` e activities ligadas:

- cabeçalho com favorito e **Repetir treino**;
- feito X vezes e última execução;
- duração média;
- volume médio e maior volume;
- taxa de conclusão;
- últimas execuções;
- sets/exercícios mais pulados derivados do JSONB;
- evolução de volume com estado vazio até haver ao menos duas execuções.

Gate: implementar somente depois que o QA desta sprint produzir ao menos uma
activity real ligada a um plano e confirmar que as métricas mudam como esperado.
