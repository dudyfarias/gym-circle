# Auditoria UI/UX — Treinos Gym Circle

Data: 2026-07-10
Fonte visual: `/Users/eduardofariascappia/Downloads/ScreenRecording_07-10-2026 12-41-44_1.MP4`
Frames extraídos: `/tmp/gc-workout-audit/frame_01.jpg` a `/tmp/gc-workout-audit/frame_10.jpg`

## Resumo executivo

A área de treinos evoluiu muito em identidade visual e já tem fundações importantes: cronômetro Apple-like, treinos salvos, registro de séries por exercício, timer de descanso, detalhe do treino com séries, e base de recordes pessoais. O gargalo agora não é "falta de tela"; é hierarquia.

A tela ativa tenta ser quatro coisas ao mesmo tempo:

1. cronômetro principal;
2. registro de séries;
3. timer de descanso;
4. comandos fixos de encerrar/pausar/fechar.

Isso gera competição visual e física: o rodapé fixo cobre/ameaça cobrir partes úteis, o registro de séries fica abaixo do fold, o timer de descanso perde força, e alguns gestos essenciais dependem de o usuário perceber scroll vertical + carrossel horizontal.

## Evidências do vídeo

### 1. Hub de criação

Frame: `/tmp/gc-workout-audit/frame_01.jpg`

Saúde: boa.

O bottom sheet de criação está simples e alinhado ao app. A separação entre iniciar treino, publicar treino e check-in é clara. O ponto de atenção é que "Publicar treino" e "Iniciar treino" podem ficar conceitualmente próximos quando o usuário acabou de terminar um treino; vale manter labels bem objetivos.

### 2. Escolher treino

Frame: `/tmp/gc-workout-audit/frame_02.jpg`

Saúde: média.

A tela já mostra até 5 treinos salvos antes das modalidades (`WebWorkoutScreen.tsx`, linhas 184-189 e 922-956), mas os treinos salvos e os tipos de treino aparecem no mesmo padrão visual, com o mesmo CTA de play. Isso torna a tela repetitiva e aumenta a carga cognitiva.

Problemas:

- treinos recentes e modalidades competem na mesma hierarquia;
- nomes longos truncam, mas ainda podem parecer "ruído";
- ainda há resíduo semântico de "Planilha" em fluxos paralelos;
- falta mostrar dados rápidos: último uso, quantidade de exercícios, duração média, progresso ou PR recente.

Recomendação:

- separar em duas seções bem diferentes:
  - "Continuar com seus treinos" em cards horizontais compactos;
  - "Modalidades" em lista vertical;
- trocar todo vocabulário de "planilha" para "treino";
- cada treino salvo deve mostrar: nome, grupos musculares, exercícios, última vez, e botão único "Iniciar".

### 3. Treino ativo — topo e registro de séries

Frames: `/tmp/gc-workout-audit/frame_03.jpg`, `/tmp/gc-workout-audit/frame_04.jpg`

Saúde: média.

O topo está forte: timer grande, status no canto, métricas básicas. O problema começa quando a sessão é de musculação: o bloco "Registrar séries" está correto tecnicamente, mas visualmente disputa espaço com o rodapé fixo (`WebWorkoutScreen.tsx`, linhas 1052-1283 e 1397-1458).

Problemas:

- o usuário precisa entender que existe carrossel horizontal dentro de uma tela vertical;
- o progresso `0/27 preenchidas` é pequeno para uma tarefa central;
- o próximo card aparece pela lateral e cria poluição em tela estreita;
- para exercícios por tempo, a UI ainda parece orientada a reps/kg;
- o rodapé fixo é grande e cria sensação de que a tela acabou antes do registro.

Recomendação:

- transformar o card do exercício atual no protagonista da tela de musculação;
- usar indicador explícito: "Exercício 1 de 9";
- adicionar ações claras: "Concluir exercício" e "Próximo";
- manter swipe horizontal como atalho, não como único modelo mental;
- para exercício por tempo, trocar reps/kg por duração/concluído;
- quando o usuário foca em reps/kg, o rodapé já recolhe; isso é bom, mas precisa ser complementado por mais espaço inferior permanente.

### 4. Timer de descanso

Frame: `/tmp/gc-workout-audit/frame_07.jpg`

Saúde: baixa na posição atual.

O timer de descanso tem boa lógica: começa em 1:00 e permite +/- 10s (`WebWorkoutScreen.tsx`, linhas 1286-1367). Mas no vídeo ele aparece baixo e o CTA fica encostado/coberto pelo rodapé fixo. Funcionalmente, o descanso deveria ser uma ação de altíssima frequência em musculação.

Recomendação:

- mover o descanso para dentro do card do exercício atual, abaixo das séries;
- ou abrir o descanso como mini painel acima dos controles, com prioridade visual;
- mostrar "Retomar treino" quando o descanso/pausa estiver ativo, conforme regra já desejada;
- nunca deixar o CTA do descanso em área coberta pelo footer.

### 5. Card publicado de treino

Frame: `/tmp/gc-workout-audit/frame_10.jpg`

Saúde: média.

O treino sem mídia aparece com resumo e botão "Adicionar fotos". Isso resolve o básico, mas ainda pode parecer um tipo separado de post, não uma publicação social completa. A direção ideal é: o treino precisa ter identidade fitness, mas herdar a estrutura social padrão do feed.

Recomendação:

- manter o resumo de treino como bloco de conteúdo;
- abaixo dele, usar as ações sociais padrão: curtir, comentar, enviar;
- se for autor, "Adicionar fotos" pode ser CTA contextual;
- se tiver mídia, colocar as infos do treino dentro da tag/pílula do tipo de treino para evitar duplicação visual.

## Fundações técnicas encontradas

### Registro de séries

`packages/core/src/domain/activity.ts` já modela `StrengthSet` com:

- `reps`;
- `weightKg`;
- `exercise`.

No web, a sessão de força mantém `strengthSets` editável e pré-carrega séries vindas de treino salvo (`WebWorkoutScreen.tsx`, linhas 172-174 e 433-450).

### Treinos salvos

`useWorkoutPlans` usa a tabela `workout_plans`; a tela de escolha já pega até 5 treinos com exercícios (`WebWorkoutScreen.tsx`, linhas 184-189). Isso está alinhado com a ideia de acesso rápido, mas precisa de separação visual melhor.

### Recordes pessoais

A migration `20260706133433_workout_personal_records.sql` já cria `personal_record_results` e captura:

- maior carga por exercício (`strength_weight`);
- tempo estimado/real de 5 km (`run_5k_time`);
- tempo estimado/real de 10 km (`run_10k_time`).

O app já tem `PersonalRecordsSheet`, mas hoje ele é mais "ranking/recorde" do que "analytics de evolução".

## Gargalo de produto

O app registra dados bons, mas ainda não devolve inteligência suficiente para o usuário durante o treino.

O usuário quer saber:

- estou ficando mais forte?
- em qual exercício estou evoluindo?
- quantas vezes fiz esse treino?
- quando devo aumentar a carga?
- quais exercícios estou negligenciando?
- qual treino faz sentido hoje?

Hoje parte dessas respostas existe no banco, mas não está visível no fluxo certo.

## Roadmap recomendado

### P0 — Clareza e redução de confusão

1. Separar "Meus treinos recentes" de "Modalidades".
2. Trocar todo vocabulário de "planilha" por "treino".
3. Reorganizar a tela ativa de musculação:
   - card atual maior;
   - "Exercício X/Y";
   - CTA "Concluir exercício";
   - botão "Próximo";
   - menos dependência de swipe invisível.
4. Resolver definitivamente a competição com o rodapé fixo.
5. Colocar descanso dentro do contexto do exercício.
6. Para exercícios por tempo, não mostrar reps/kg como se fosse série de carga.
7. Depois de encerrar, mostrar tela de resumo/publicação com legenda, visibilidade, adicionar mídia e PRs batidos.

### P1 — Gráficos e progressão

1. Gráfico de evolução por exercício:
   - maior carga;
   - carga de trabalho;
   - volume total (`reps × kg`);
   - melhor série;
   - número de sessões.
2. Tela "Histórico do exercício":
   - última carga usada;
   - melhor carga;
   - média dos últimos treinos;
   - tendência.
3. Sugestão "Hora de progredir":
   - se o usuário completou todas as séries alvo em 2-3 sessões recentes, sugerir +2,5 kg ou +5 kg;
   - se falhou reps, sugerir manter carga;
   - se caiu performance, sugerir descanso/deload.
4. Estatísticas do treino salvo:
   - feito X vezes;
   - última vez;
   - duração média;
   - taxa de conclusão;
   - exercícios mais pulados.

### P2 — Treino inteligente e social

1. "Próximo melhor treino" baseado em:
   - últimos grupos musculares treinados;
   - plano salvo;
   - descanso estimado;
   - frequência semanal.
2. Biblioteca de exercícios por grupo muscular:
   - variações livres/máquina/cabo/halter;
   - vídeo;
   - explicação;
   - técnica avançada.
3. Competição entre amigos:
   - ranking por exercício;
   - ranking de 5k/10k;
   - PRs semanais;
   - desafios por grupo.
4. Score de equilíbrio muscular:
   - peito/costas/pernas/ombros/braços/core;
   - alerta de grupo negligenciado.

## Dados/arquitetura recomendados para analytics

O recorde pessoal atual é bom para "melhor resultado", mas não basta para gráfico de evolução. Para gráficos e sugestões, precisamos de histórico agregado.

Recomendo criar RPCs leves antes de normalizar tudo:

1. `get_exercise_progress(p_user_id, p_exercise_key, p_limit)`
   - data;
   - activity_id;
   - max_weight_kg;
   - best_reps;
   - total_volume;
   - sets_count.

2. `get_workout_plan_stats(p_user_id)`
   - plan_id;
   - nome;
   - sessions_count;
   - last_completed_at;
   - avg_duration_s;
   - completion_rate.

3. `get_progression_recommendations(p_user_id)`
   - exercise_key;
   - current_weight_kg;
   - suggested_weight_kg;
   - confidence;
   - reason.

Quando o volume crescer, normalizar `activities.strength_sets` em uma tabela derivada (`activity_strength_sets`) vai facilitar índices e rankings.

## Acessibilidade e usabilidade

Riscos atuais:

- gestos horizontais escondidos não são óbvios;
- textos auxiliares pequenos demais em celular;
- footer fixo compete com conteúdo;
- botões principais são bons, mas campos de série são densos;
- baixo contraste em alguns labels secundários;
- indicadores como "0/27 preenchidas" são informativos, mas pouco acionáveis.

Correções:

- sempre ter alternativa por botão para swipe;
- aumentar rótulos de progresso;
- manter área de conteúdo fora do rodapé;
- usar estados de conclusão mais claros;
- incluir feedback háptico/visual ao completar série/exercício.

## Sprint sugerida

> Atualização de 12/07/2026: a execução adotou a numeração do documento
> principal. “Histórico e carga anterior” foi a Sprint 2 e “Progresso e
> gráficos” foi a Sprint 3. Os itens de biblioteca e inteligência abaixo ficam
> como backlog posterior, sem alterar as evidências desta auditoria visual.

### Sprint 1 — UX de treino ativo

- Separar treinos recentes/modalidades.
- Refatorar card atual de musculação.
- Mover/realocar descanso.
- Criar fluxo de finalizar com resumo + legenda + PR.
- Ajustar card publicado com ações sociais consistentes.

### Sprint 2 — Analytics MVP

- Criar RPC de progresso por exercício.
- Criar gráfico simples de carga/volume.
- Exibir "feito X vezes" em treino salvo.
- Criar primeira versão de "Hora de progredir".

### Sprint 3 — Biblioteca e inteligência

- Expandir catálogo por grupos musculares.
- Adicionar vídeos/explicações.
- Sugerir variações.
- Adicionar leaderboard por exercício e PR.

## Conclusão

O Gym Circle já tem a parte difícil começando a existir: dados reais de treino, séries, recordes, treinos salvos e feed social. O próximo salto é transformar registro em orientação. A experiência deve sair de "preencher campos durante o treino" para "o app me guia, registra sem atrapalhar e me mostra como evoluir".
