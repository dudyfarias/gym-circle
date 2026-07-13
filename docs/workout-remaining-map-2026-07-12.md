# Mapa de fechamento da area de treinos — 12/07/2026

## Resumo executivo

O pacote local fecha os itens que podiam ser implementados sem fabricar dados,
sem alterar producao e sem criar uma dependencia destrutiva: QA logico das
Sprints 2/3, qualidade de dados, insights conservadores, biblioteca com filtros,
localizacao segura, variacoes reais e recordes canonicos por exercicio.

As duas migrations deste pacote estao apenas versionadas localmente. O deploy
web que seleciona `parent_exercise_id` e `movement_pattern` deve ocorrer somente
depois da migration de variacoes. Nenhuma migration foi aplicada nesta execucao.

## Fechado neste pacote

### Execucao, historico e recordes

- Serie ate a falha aceita repeticoes e carga opcional; preencher reps nao
  conclui a serie antes da confirmacao explicita.
- Exercicios por duracao entram no historico e comparacao em segundos.
- Historico e recordes vivem na mesma superficie.
- Requests de recordes/ranking ignoram respostas antigas e isolam troca de
  usuario.
- A RPC v2 de recordes expoe `exercise_id`; clientes novos usam o ID e fazem
  fallback para a RPC antiga durante a transicao.
- Ranking recebe o UUID canonico quando disponivel e preserva a chave textual
  para exercicios legados/personalizados.

### Insights

- Estado de aprendizado quando ainda nao existem duas sessoes comparaveis.
- `Carga consistente` exige duas sessoes com ao menos duas series ponderadas,
  mesma quantidade de series, mesma maior carga, reps e volume sem queda.
- Comparativo semanal nao compara uma semana parcial com outra completa.
- Apenas um gap muscular pode ocupar os cards prioritarios.
- Nenhuma mensagem promete recuperacao medica ou prescreve aumento de carga.

### Biblioteca

- Busca global por PT, EN, aliases e nomes de variacoes.
- Filtros por todos os grupos, grupo muscular e equipamento.
- Equipamentos traduzidos; itens comunitarios identificados.
- Preview antes de adicionar, com instrucoes, tecnica e video quando houver.
- Conteudo legado duplicado em PT/EN nao aparece como traducao inglesa falsa.
- Variações sao exibidas somente quando existe relacao explicita no catalogo.
- Escape fecha primeiro o preview, sem derrubar o picker pai.

## Migrations preparadas e nao aplicadas

### `20260712231537_canonicalize_personal_record_exercise_id.sql`

- adiciona `personal_record_results.exercise_id` nullable com FK;
- backfill conservador usando o `exercise_id` do set original;
- captura futura grava ID canonico e mantem `exercise_key` legado;
- cria `get_personal_records_v2` sem remover a RPC antiga;
- ranking agrega aliases pelo ID quando ele existe;
- RLS e grants continuam restritos a usuarios autenticados.

### `20260712231606_add_workout_exercise_variations.sql`

- adiciona `parent_exercise_id` e `movement_pattern`;
- nao infere parentes por nome;
- inicia cada item legado como raiz do proprio movimento;
- trigger herda o padrao do pai e bloqueia ciclos;
- indices suportam parentesco e filtros por padrao;
- RLS e RPC de contribuicao existentes permanecem compativeis.

## O que ainda falta

### P0 — gate antes de publicar este pacote

1. Aplicar as duas migrations em ambiente de preview/staging e executar os SQLs
   de validacao comentados nelas.
2. Aplicar em producao somente com aprovacao explicita.
3. Depois da migration de variacoes, publicar o web; inverter a ordem quebra a
   consulta do catalogo porque as colunas ainda nao existiriam.
4. Smoke autenticado em iPhone/Capacitor:
   - falha com e sem carga;
   - duracao;
   - historico junto dos recordes;
   - ranking e retry;
   - troca de conta;
   - filtros PT/EN;
   - preview, Escape/back, teclado e safe area.

### P1 — vinculo entre treino salvo e execucao

Dados faltantes:

- `activities.workout_plan_id`;
- `workout_plans.last_used_at`;
- `workout_plans.times_used`.

Resultado esperado: ordenar os cinco treinos recentes por uso real, exibir
quantas vezes cada treino foi realizado e calcular duracao/volume medio sem
inferir pelo nome. Exige migration aditiva, threading do ID na sessao local e
gravacao no fechamento da activity.

### P1 — planejado versus realizado

O JSON atual persiste apenas series concluidas. Ainda faltam:

- estado `planned | completed | skipped`;
- posicao estavel da serie e do exercicio;
- meta de reps/duracao e carga sugerida separada do resultado;
- motivo opcional para pular.

Sem isso, o app nao pode afirmar que “todas as series foram concluidas” nem
usar o topo da faixa planejada como regra de progressao.

### P1 — semantica de carga

Adicionar `load_mode` com valores como `external`, `bodyweight`, `assisted` e
`unreported`. Hoje `null` significa apenas carga nao informada. Isso evita
confundir peso corporal com dado ausente e prepara PRs assistidos corretamente.

### P2 — contexto de treino

- notas por exercicio;
- RPE/RIR opcional;
- descanso-alvo por exercicio;
- favorito e substituicao de exercicio;
- aquecimento, supersets e drop sets estruturados.

Esses campos devem ser opcionais, sem alegacoes medicas e sem bloquear o fluxo
rapido de registro.

### P2 — curadoria do catalogo

- revisar os nomes ingleses legados com fonte humana/confiavel;
- ligar `parent_exercise_id` e `movement_pattern` de forma curada;
- aprovar videos demonstrativos por exercicio e tecnica;
- revisar as duas contribuicoes comunitarias atuais.

Busca de video e traducao automatica nao equivalem a conteudo aprovado.

### P2 — destaque social e inteligencia

- destacar PR confirmado no resumo e post do treino;
- treino favorito/mais usado e duracao media;
- sugestao de treino do dia baseada no plano e historico;
- alerta simples de grupo nao treinado, sem chamar isso de recuperacao;
- insight semanal compartilhavel.

### P3 — escala e integracoes

- migrar progresso para RPC agregada apenas acima de 500 activities por usuario
  ou p95 de consulta acima de 200 ms;
- HealthKit/Strava;
- Android;
- app SwiftUI paralelo.

## Ordem recomendada

1. Gate P0 e publicacao coordenada migration -> web.
2. Vínculo `workout_plan_id` e estatisticas de uso.
3. Planejado/realizado + `load_mode`.
4. Curadoria bilingue, variacoes e videos.
5. PR social, favoritos e sugestoes.
6. RPC de escala e integracoes somente quando os limites justificarem.

## Criterio de conclusao real

Este pacote esta pronto para revisao tecnica quando lint, testes, build e
`git diff --check` estiverem verdes. Ele so esta pronto para producao depois da
validacao das migrations e do smoke autenticado em iPhone. Nao houve deploy,
commit, push nem mutacao de producao nesta execucao.
