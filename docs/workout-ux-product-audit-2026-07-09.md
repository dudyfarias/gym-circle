# Auditoria profunda — Treinos Gym Circle

Data da auditoria: 2026-07-10 · **Revisão v2: 2026-07-10 (fatos verificados em produção + vídeo novo)**
Arquivo solicitado: `docs/workout-ux-product-audit-2026-07-09.md`
Documento complementar: `docs/workout-ui-ux-audit-2026-07-10.md` (evidências visuais detalhadas)
Escopo: UI/UX, produto, dados e arquitetura da área de treinos do app web/Capacitor.
Fora do escopo: Android, HealthKit/Strava, app SwiftUI paralelo, Push Notifications, App Store config, migrations em produção, publicação.

## 0. Revisão v2 — correções e fatos verificados

A v1 desta auditoria fazia afirmações razoáveis mas não verificadas. A v2 checou
o banco de produção (somente leitura), o código atual e um novo screen recording
(2026-07-10 12:41, 39s — frames em scratchpad da sessão). O que muda:

### Fatos verificados no banco (2026-07-10)

| Fato | Valor real | Impacto na auditoria |
|---|---|---|
| Activities totais | 13 (3 com strength_sets) | Dataset é MINÚSCULO. O risco real hoje é **gráfico/insight vazio**, não performance de JSONB. Estados vazios e first-run valem mais que otimização de query. |
| Sets registrados | 56, **100% com `exercise_id`** | O "fallback por nome normalizado p/ dados antigos" da v1 é **desnecessário** — não existe legado sem id. Agrupamento por `exercise_id` é viável já. |
| Sets com carga > 0 | 8 de 56 | A maioria dos sets registrados não tem carga → o campo KG "0" (ver achados do vídeo) provavelmente está gravando zeros não intencionais. |
| `workout_plans` colunas | id, user_id, name, exercises, created_at, updated_at | **Não existe `times_used`/`last_used_at`**; `touchPlan` no código só atualiza `updated_at` (recência). "Feito X vezes" exige dado novo ou heurística. |
| `activities.workout_plan_id` | **não existe** | Confirma o gap #1 da seção 9. |
| `personal_record_results` | 2 linhas; colunas incluem `exercise_key`, `value`, `reps`, `is_estimated`, `achieved_at` | A infra de PR **por exercício já existe** e está subusada — dá pra ancorar "melhor carga" nela sem migration. |
| Catálogo | 94 exercícios, 15 grupos musculares, 8 técnicas | Base sólida; biblioteca é questão de UI, não de dados. |
| RPCs existentes | `get_personal_records`, `get_personal_record_leaderboard`, `submit_workout_exercise` | **Não existe** nenhuma RPC de progresso/histórico por exercício — as RPCs da seção 10 seguem necessárias. |

### Achados novos do vídeo (não estavam na v1)

1. **Layout shift na tela "Escolha seu treino"**: a tela abre mostrando só as
   modalidades; os "Treinos recentes" carregam async e EMPURRAM tudo pra baixo
   ~1s depois. Usuário pode tocar na modalidade errada. Fix: skeleton/espaço
   reservado para a seção de recentes (ou carregar antes de abrir).
2. **Exercício "Por tempo" com campos REPS × KG**: evidência direta no frame — o
   card diz "Por tempo" mas oferece reps/kg. Mismatch confirmado (v1 já apontava;
   agora é prioridade de Sprint 1 com evidência).
3. **CTA "Iniciar descanso" parcialmente coberto pelo rodapé fixo** num frame e
   visível noutro — a colisão não é teórica, acontece em uso real.
4. **Plano chamado "Planilha"**: dado LEGADO do default antigo de nome
   (`name || "Planilha"`, já removido do código). Fix é de dado/UX: sugerir
   rename na lista (ou migração de dados opt-in), não mudar código de novo.
5. **KG mostra "0" que parece valor registrado** (não placeholder). Combinado
   com "8 de 56 sets com carga", indica que zeros estão sendo salvos sem
   intenção. Fix: placeholder visual + não persistir carga 0 como "0 kg".
6. **Treino de 0:26 publicado sem etapa intermediária** — encerrou e o post já
   estava no feed ("Adicionar fotos" depois). Reforça o resumo pós-treino como
   o passo que falta (e sugere confirmação para treinos muito curtos).
7. **Affordance do carrossel**: a pill "Arraste para passar" existe (bom), mas
   os 8 dots de paginação são minúsculos e não há botão alternativo — navegação
   por botão "Próximo" segue necessária (acessibilidade).

### Correções à v1

- Seção 4.4/19 (riscos): o risco "agregação JSONB pesada no client" é FUTURO,
  não presente — com 3 treinos de força o client-side é suficiente por meses.
  Recalibrado: priorizar UX/estados vazios primeiro, RPC quando houver volume.
- Seção 19 risco 4 ("dados antigos sem exercise_id"): removido — 100% dos sets
  têm `exercise_id` em produção.
- "Planilha": v1 tratava como vocabulário de UI; na verdade o resíduo restante
  é um REGISTRO com esse nome (dado), o código já foi limpo.
- `touchPlan` já existe e alimenta a ordenação "recentes" — a v1 não citava;
  "feito X vezes" ainda requer contador dedicado (ver seção 9).

## 1. Resumo executivo

A área de treinos do Gym Circle já tem a base que muitos apps levam meses para montar: treino ao vivo, planos de treino, registro de séries, carga/reps, timer de descanso, rotas, mapa, posts sociais, streaks, badges, recordes pessoais, catálogo de exercícios e técnicas. O problema principal agora não é ausência de feature; é a forma como essas features aparecem para o usuário.

Hoje o treino de musculação mistura quatro tarefas fortes na mesma tela:

1. acompanhar o tempo;
2. registrar séries;
3. controlar descanso;
4. encerrar/pausar/fechar.

Isso deixa a experiência visualmente premium, mas operacionalmente mais confusa do que deveria. O usuário precisa descobrir gestos, rolar para baixo, entender cards horizontais, preencher reps/kg e ainda lidar com um rodapé fixo pesado. Para um app social fitness, o próximo salto é transformar o registro de treino em um guia inteligente: o app deve dizer o que fazer agora, o que mudou desde a última vez, quando subir carga, que PR bateu e como postar isso no Circle.

Recomendação central:

- curto prazo: simplificar o fluxo de execução e pós-treino;
- médio prazo: mostrar carga anterior, histórico do exercício e comparação com treino anterior;
- depois: gráficos, progressão de carga, volume semanal, grupos musculares e insights sociais.

## 2. Evidências visuais da auditoria

Frames extraídos do vídeo enviado:

- `/tmp/gc-workout-audit/frame_01.jpg` — hub de criação;
- `/tmp/gc-workout-audit/frame_02.jpg` — escolha de treino;
- `/tmp/gc-workout-audit/frame_03.jpg` — treino ativo/topo;
- `/tmp/gc-workout-audit/frame_04.jpg` — registro de séries;
- `/tmp/gc-workout-audit/frame_07.jpg` — descanso competindo com rodapé;
- `/tmp/gc-workout-audit/frame_10.jpg` — treino publicado no feed.

### Passo 1 — Hub de criação

Saúde: boa.

O bottom sheet de criação tem boa clareza inicial. As três ações principais — iniciar treino, publicar treino e check-in — estão compreensíveis. O risco é conceitual: "publicar treino" e "iniciar treino" podem se misturar quando o usuário acabou de terminar uma sessão.

### Passo 2 — Escolher treino

Saúde: média.

A tela já mostra até 5 treinos salvos antes das modalidades, o que está certo como direção de produto. Porém, treinos salvos e modalidades aparecem quase com a mesma estrutura visual. O usuário vê uma lista de coisas com botão de play, mas precisa interpretar sozinho se aquilo é plano salvo, modalidade livre ou ferramenta.

Problemas:

- treinos recentes e modalidades competem no mesmo nível;
- nomes longos truncam;
- o termo "planilha" ainda pode aparecer em fluxos paralelos;
- falta mostrar "feito X vezes", "última vez" e grupos musculares.

### Passo 3 — Treino ativo

Saúde: média.

O topo está forte e próximo de Apple Fitness: timer grande, status, início, descanso e calorias. Mas o registro de séries, que é a tarefa principal na musculação, fica abaixo do fold e perde hierarquia.

Problemas:

- o usuário precisa perceber rolagem vertical;
- o card horizontal de exercício não é óbvio o suficiente;
- o progresso `0/27 preenchidas` existe, mas é pequeno;
- o rodapé fixo parece mais importante do que registrar séries.

### Passo 4 — Registrar séries

Saúde: média/baixa.

A estrutura técnica é boa: cada exercício agrupa séries, mostra reps e kg, permite adicionar série e usa carrossel horizontal. Mas o fluxo exige muito aprendizado na primeira vez.

Problemas:

- o usuário precisa entender swipe lateral;
- o próximo exercício "vaza" pela lateral e pode parecer ruído;
- faltam botões explícitos como "Concluir exercício" e "Próximo";
- exercícios por tempo/falha ainda entram numa estrutura muito reps/kg.

### Passo 5 — Descanso

Saúde: baixa na posição atual.

O descanso tem boa lógica, com 1:00 e ajustes de +/- 10s. Mas ele aparece baixo na tela e compete diretamente com os controles fixos de pausar/encerrar.

Problema de UX:

- o CTA do descanso pode ficar parcialmente escondido ou visualmente subordinado ao footer.

Recomendação:

- descanso deve viver dentro do contexto do exercício atual ou virar mini painel acima dos controles.

### Passo 6 — Treino publicado no feed

Saúde: média.

O treino sem mídia aparece como card fitness e pode adicionar fotos. Isso é bom, mas o treino precisa parecer post social completo, não item separado.

Recomendação:

- treino publicado deve ter resumo fitness + legenda + curtir + comentar + enviar + menu;
- se tiver mídia, as infos de treino devem entrar dentro da pílula/tag do tipo de treino, para não duplicar bloco de resumo.

## 3. Mapa do fluxo atual de treino

### Entrada

- `GymCirclePreview.tsx` controla a navegação principal e abre o fluxo de treino.
- O botão `+` abre o hub de criação.
- `WebWorkoutScreen.tsx` contém escolha e execução do treino.

### Escolher treino

Componentes/funções:

- `WebWorkoutScreen.tsx`
- `WorkoutPlansFab.tsx`
- `useWorkoutPlans.ts`
- `useWorkoutCatalog.ts`

Dados:

- `workout_plans`;
- catálogo de exercícios;
- técnicas;
- grupos musculares.

### Executar treino

Componentes/funções:

- `WebWorkoutScreen.tsx`;
- `workoutSession.ts`;
- `restTimer.ts`;
- `WorkoutLocationBridge.ts` para Capacitor/iOS;
- `WorkoutCatalogSheets.tsx` para detalhes de exercício/técnica.

Dados:

- sessão local em storage;
- `strengthSets` em estado React;
- rota/GPS para caminhada/corrida/bike;
- descanso contado localmente.

### Finalizar treino

Fluxo atual:

1. usuário toca encerrar;
2. confirma;
3. `onFinish` salva `activities`;
4. limpa sessão local;
5. chama `onCompose` para abrir publicação.

Dados:

- `activities`;
- `strength_sets`;
- `route`;
- `source_activity_id` quando vira post.

### Postar treino

Componentes:

- `PostScreen.tsx`;
- `EditPostSheet.tsx`;
- `SocialPostCard.tsx`;
- `FeedActivityCard.tsx`;
- `WorkoutDetailOverlay.tsx`;
- `WorkoutRouteMap.tsx`.

Dados:

- `posts`;
- `activities`;
- `post_media`;
- `post_likes`;
- `post_comments`;
- `post_shares`;
- `source_activity_id`.

### Ver treino no feed/perfil

Dados e RPCs:

- `get_home_feed`;
- `get_home_activities`;
- `get_profile_posts`;
- `source_activity_id`;
- `workout_strength_sets`;
- `workout_route`.

### Ver progresso/recordes

Componentes:

- `PersonalRecordsLauncher.tsx`;
- `PersonalRecordsSheet.tsx`;
- `usePersonalRecords.ts`.

Dados:

- `personal_record_results`;
- RPC `get_personal_records`;
- RPC `get_personal_record_leaderboard`.

## 4. Diagnóstico pelos 5 papéis

## 4.1 Product Manager

### O que está funcionando

- O Gym Circle já une treino + social + streak.
- Treino vira post, o que aumenta retenção social.
- Planos salvos aproximam o app de um treino recorrente.
- Recordes pessoais criam motivação.
- O app tem base para competir com "diário de treino", não apenas "rede social fitness".

### Problemas de valor percebido

1. O usuário registra dados, mas ainda não recebe inteligência proporcional.
2. O treino salvo existe, mas não mostra evolução daquele treino.
3. O recorde existe, mas está escondido em uma superfície separada.
4. O pós-treino não celebra suficientemente progresso, PR ou consistência.
5. A repetição de treino ainda parece manual demais.

### Maiores oportunidades de retenção

- "Use sua carga anterior";
- "Hora de subir carga";
- "Você evoluiu em 3 exercícios";
- "Esse treino foi feito 8 vezes";
- "Seu volume semanal subiu 12%";
- "Faz 9 dias que você não treina pernas";
- ranking entre amigos por exercício;
- post social de PR.

## 4.2 UX Designer

### Problemas de UX alta severidade

1. Registro de séries não é suficientemente óbvio para o primeiro uso.
2. Rodapé fixo compete com conteúdo principal durante musculação.
3. Descanso fica visualmente separado da série/exercício que o gerou.
4. Fluxo de finalizar pula rápido demais para publicação, sem uma etapa premium de resumo.

### Problemas de UX média severidade

1. Treinos recentes e modalidades parecem cards do mesmo tipo.
2. Gestos horizontais dependem de descoberta.
3. Usuário não vê carga anterior durante o preenchimento.
4. O app não diz "o próximo passo é este".
5. O usuário não vê claramente quantas séries/exercícios faltam.

### Problemas de UX baixa severidade

1. Alguns textos auxiliares são pequenos.
2. Badges/pílulas de progresso têm pouca força visual.
3. Nomes longos truncam sem alternativa contextual.

## 4.3 UI Designer

### Pontos fortes

- Dark mode consistente.
- Estética premium.
- Uso de ciano como cor de ação funciona bem.
- Timer principal tem presença.
- Cards arredondados seguem a linguagem do app.

### Ajustes recomendados

1. Reduzir brilho/glow e peso visual do rodapé durante registro.
2. Dar mais respiro ao card atual do exercício.
3. Separar visualmente "treinos salvos" de "modalidades".
4. Criar mini gráficos consistentes com o feed: linhas simples, barras pequenas, pílulas de PR.
5. Estados vazios precisam ser mais instrutivos, menos genéricos.
6. O pós-treino deveria parecer uma conquista, não só confirmação.

### Direção visual

Referência desejada:

- Apple Fitness para treino ativo;
- Instagram/Threads para feed/social;
- Strava para mapa/ritmo/rota;
- Hevy/Strong para séries, histórico e progressão.

## 4.4 Data/Product Analytics

### Dados existentes hoje

Já existem:

- tipo de atividade: força, corrida, caminhada, bike, outro;
- início/fim;
- duração;
- tempo em movimento;
- distância;
- elevação;
- rota;
- batimentos médios/máximos;
- calorias ativas/totais;
- data do treino;
- séries de musculação em JSONB;
- reps;
- carga;
- exercício;
- exercício id;
- técnica;
- target de reps/falha/duração;
- planos salvos;
- catálogo de exercícios;
- grupos musculares;
- técnicas;
- posts sociais;
- streak;
- user_activity_days;
- recordes pessoais de carga, 5k e 10k.

### Dá para fazer com dados atuais

- histórico simples por exercício;
- maior carga por exercício;
- último treino por exercício;
- volume total por treino;
- séries totais;
- reps totais;
- treino feito X vezes se vincular nome/plano por heurística;
- PR de carga;
- PR de 5k/10k;
- frequência semanal/mensal;
- consistência/streak;
- mapa e ritmo para rota;
- comparação simples com treino anterior.

### Dá para fazer com pequena adaptação

- "usar carga anterior" confiável;
- "hora de progredir carga";
- volume por grupo muscular;
- treino favorito/mais repetido;
- exercício estagnado;
- alertas de grupo muscular;
- sugestão de treino do dia baseada em último grupo.

### Precisa migration/RPC

- tabela derivada `activity_strength_sets`;
- relação explícita entre `activity` e `workout_plan_id`;
- notas por exercício/série;
- RPE/RIR;
- sets concluídos vs planejados;
- histórico de substituições de exercício;
- recomendação de progressão persistida;
- volume por grupo muscular performático;
- insights semanais versionados.

### Precisa integração futura

- zonas de batimento;
- calorias confiáveis;
- VO2/pace avançado;
- import real HealthKit/Strava;
- recuperação baseada em sono/frequência cardíaca.

## 4.5 Engineer/Architect

### Pontos técnicos fortes

- `activities` é a fonte correta para treino.
- `posts.source_activity_id` evita duplicação.
- `strength_sets` já suporta reps, kg, exercício, técnica e target.
- Catálogo de exercícios/técnicas já existe.
- PRs já têm tabela própria.
- O feed já recebe dados de treino via RPC.

### Riscos técnicos

1. Agregar JSONB de `strength_sets` no client pode ficar caro conforme volume cresce.
2. Gráficos por exercício precisam de query dedicada.
3. Progressão de carga precisa de critérios claros para evitar sugestão ruim.
4. Se "plano salvo" não ficar vinculado à atividade, estatísticas de "treino feito X vezes" ficam frágeis.
5. Catálogo de exercícios precisa de `exercise_id` consistente; nome livre gera duplicação.

### Ordem técnica segura

1. UX sem migration: reorganizar telas e copy.
2. Analytics client-side bounded: últimos 30-50 treinos do usuário.
3. RPCs leves para histórico por exercício.
4. Tabela derivada de sets se volume crescer.
5. Recomendações inteligentes persistidas.

## 5. Problemas de UX por severidade

### Alta

1. Rodapé fixo compete com o registro de séries.
2. O usuário pode não perceber que precisa rolar para registrar tudo.
3. O descanso fica deslocado da ação de série.
4. Falta uma etapa clara de resumo pós-treino antes de publicar.
5. A carga anterior não aparece no momento de preencher carga.

### Média

1. Treinos recentes e modalidades têm visual parecido demais.
2. "Treino", "post", "atividade", "check-in" e "publicar treino" podem confundir.
3. O carrossel horizontal não tem CTA explícito suficiente.
4. Progressos como `0/27` são informativos, mas pouco motivacionais.
5. Recordes pessoais estão subaproveitados.

### Baixa

1. Microcopy pode ficar mais orientada à ação.
2. Alguns labels secundários têm contraste baixo.
3. Nomes longos precisam truncar com mais contexto.
4. Estados vazios poderiam ensinar melhor.

## 6. Features recomendadas

## 6.1 Gráfico de evolução de carga por exercício

Descrição: gráfico por exercício mostrando carga máxima, carga média, volume e PRs ao longo do tempo.

Valor: o usuário vê progresso real e volta para acompanhar evolução.

Complexidade: média.

Dados necessários:

- `activities.strength_sets`;
- `exercise_id` ou `exercise_key`;
- `ended_at`;
- reps;
- carga.

Migration: não obrigatória para MVP; recomendada para performance depois.

Retenção: alta.

Prioridade: Must have.

## 6.2 Histórico do exercício

Descrição: bottom sheet/tela com última vez, melhor carga, melhor série, volume total, evolução e botão "usar carga anterior".

Valor: reduz fricção no treino e aumenta sensação de inteligência.

Complexidade: média.

Migration: não no MVP; sim se quiser notas/RPE persistidos.

Prioridade: Must have.

## 6.3 Hora de progredir carga

Descrição: sugestão baseada em completar todas as séries no topo da faixa de reps em 2 treinos seguidos.

Exemplo: "Você fez 3×12 com 20kg duas vezes seguidas. Que tal tentar 22kg?"

Valor: diferencia o app de um simples log.

Complexidade: média/alta.

Migration: não para cálculo instantâneo; recomendada para histórico robusto.

Prioridade: Must have.

## 6.4 Use sua carga anterior

Descrição: botão dentro do exercício para preencher reps/kg da última execução.

Valor: reduz digitação e deixa o treino mais rápido.

Complexidade: baixa/média.

Migration: não obrigatória.

Prioridade: Must have.

## 6.5 Comparação com treino anterior

Descrição: mostrar "Última vez: 3×10 com 20kg" e "Hoje: +6 reps".

Valor: feedback imediato.

Complexidade: média.

Migration: não obrigatória para MVP.

Prioridade: Should have.

## 6.6 Volume total do treino

Descrição: total levantado, séries, reps, tempo e exercícios concluídos.

Valor: melhora pós-treino e post social.

Complexidade: baixa.

Migration: não.

Prioridade: Must have.

## 6.7 Volume por grupo muscular

Descrição: séries/volume por peito, costas, pernas, ombros etc.

Valor: ajuda equilíbrio e planejamento.

Complexidade: média.

Migration: não obrigatória se exercícios têm muscleGroup; recomendada para performance.

Prioridade: Should have.

## 6.8 Alertas inteligentes

Descrição: "Você treinou peito 3 vezes essa semana e pernas 0."

Valor: gera hábito e orienta treino do dia.

Complexidade: média.

Migration: talvez.

Prioridade: Should have.

## 6.9 Treino favorito/mais feito

Descrição: quantidade de vezes, última execução, média de duração e evolução.

Valor: reforça rotina.

Complexidade: baixa se vincular `workout_plan_id`; média sem isso.

Migration: recomendada.

Prioridade: Should have.

## 6.10 Tela Progresso

Descrição: área central para cargas, PRs, volume semanal, frequência, grupos musculares e consistência.

Valor: transforma treino em produto recorrente.

Complexidade: alta.

Migration: sim para versão escalável.

Prioridade: Should have.

## 6.11 PRs e conquistas

Descrição: maior carga, maior volume, maior sequência, primeira vez, treino mais completo.

Valor: celebração social.

Complexidade: média.

Migration: pequena adaptação em `personal_record_results` ou achievements.

Prioridade: Must have.

## 6.12 Sugestão de treino do dia

Descrição: recomendado por plano, último grupo treinado e frequência.

Valor: reduz indecisão.

Complexidade: média/alta.

Migration: talvez.

Prioridade: Could have inicialmente; Should have depois.

## 6.13 Recuperação muscular simples

Descrição: "Peito treinado há 2 dias", sem promessa médica.

Valor: orientação simples.

Complexidade: média.

Migration: não obrigatória.

Prioridade: Should have.

## 6.14 Notas por exercício

Descrição: notas como "cotovelo incomodou", "carga leve", "aumentar próxima".

Valor: diário de treino real.

Complexidade: média.

Migration: sim.

Prioridade: Could have.

## 6.15 Timer de descanso inteligente

Descrição: descanso por exercício/técnica, haptic e próximo set pronto.

Valor: experiência premium durante treino.

Complexidade: média.

Migration: pequena se salvar descanso por exercício.

Prioridade: Should have.

## 6.16 Templates inteligentes

Descrição: salvar treino atual como modelo, duplicar, substituir, reordenar, marcar aquecimento.

Valor: melhora criação e repetição.

Complexidade: média.

Migration: pequena.

Prioridade: Should have.

## 6.17 Modo treino mais limpo

Descrição: foco no exercício atual, menos botões, progress bar, carga anterior visível.

Valor: maior clareza no fluxo principal.

Complexidade: média.

Migration: não.

Prioridade: Must have.

## 6.18 Pós-treino premium

Descrição: resumo com PRs, volume, evolução e CTA "Compartilhar no Circle".

Valor: retenção + social.

Complexidade: média.

Migration: não para MVP.

Prioridade: Must have.

## 6.19 Post de treino mais bonito

Descrição: card com resumo, PR, volume, mini gráfico, mapa e ações sociais.

Valor: melhora feed e desejo de postar.

Complexidade: média.

Migration: não para MVP.

Prioridade: Should have.

## 6.20 Insights semanais

Descrição: "Essa semana você treinou 4 vezes", "volume subiu 12%", "2 PRs".

Valor: retenção semanal.

Complexidade: média/alta.

Migration: recomendada para histórico/cache.

Prioridade: Should have.

## 7. MoSCoW

### Must have

- Modo treino mais limpo.
- Pós-treino premium.
- Volume total do treino.
- Gráfico de evolução de carga por exercício.
- Histórico do exercício.
- Use sua carga anterior.
- Hora de progredir carga.
- PRs celebrados no fim do treino.

### Should have

- Comparação com treino anterior.
- Volume por grupo muscular.
- Alertas inteligentes.
- Treino favorito/mais feito.
- Tela Progresso.
- Timer de descanso inteligente.
- Templates inteligentes.
- Post de treino mais bonito.
- Insights semanais.
- Recuperação muscular simples.

### Could have

- Notas por exercício.
- Sugestão de treino do dia.
- Deload simples.
- Rankings por exercício.
- Score de equilíbrio muscular.

### Won't do now

- HealthKit/Strava.
- Recuperação fisiológica avançada.
- Prescrição médica/risco de lesão.
- IA generativa complexa para treino automático.
- Normalização completa de todos os históricos antes de validar UX.

## 8. Dados disponíveis hoje

### `activities`

Campos relevantes:

- `activity_type`;
- `mode`;
- `origin`;
- `started_at`;
- `ended_at`;
- `elapsed_s`;
- `moving_s`;
- `distance_m`;
- `elevation_gain_m`;
- `route`;
- `splits`;
- `avg_hr`;
- `max_hr`;
- `active_calories`;
- `total_calories`;
- `workout_date`;
- `strength_sets`.

### `strength_sets`

Campos serializados:

- `reps`;
- `weight_kg`;
- `exercise`;
- `exercise_id`;
- `target_kind`;
- `duration_seconds`;
- `technique_id`;
- `technique_name`;
- `technique_notes`.

### `workout_plans`

Permite treinos salvos com exercícios, séries, reps, técnica e target.

### Catálogo

- `workout_muscle_groups`;
- `workout_exercise_catalog`;
- `workout_technique_catalog`.

### Social

- `posts`;
- `post_media`;
- `post_likes`;
- `post_comments`;
- `source_activity_id`.

### Progressão/recordes

- `personal_record_results`;
- `get_personal_records`;
- `get_personal_record_leaderboard`.

### Consistência

- `user_activity_days`;
- `user_stats`;
- achievements/badges.

## 9. Dados que faltam

Para uma experiência excelente, faltam (v2 — verificado em produção):

1. `workout_plan_id` em `activities` (confirmado ausente).
2. `times_used` + `last_used_at` em `workout_plans` (confirmado ausente; hoje
   `touchPlan` só atualiza `updated_at` — recência sem contagem).
3. Tabela derivada `activity_strength_sets` (só quando houver volume; hoje 56
   sets no total — client-side basta).
4. Campo de conclusão por set/exercício.
5. Notas por exercício/set.
6. RPE/RIR opcional.
7. Carga sugerida ou recomendação persistida.
8. Descanso alvo por exercício.
9. Substituição de exercício.
10. Histórico de alterações de plano.
11. Cache de insights semanais.

## 10. Queries/RPCs recomendadas

### `get_exercise_progress`

Retorna histórico de um exercício:

- data;
- activity_id;
- exercise_id/key;
- max_weight_kg;
- best_reps;
- total_volume;
- total_sets;
- estimated_1rm;
- pr_flags.

### `get_previous_exercise_performance`

Retorna a última execução de um exercício para preencher o treino atual.

### `get_workout_plan_stats`

Retorna:

- plan_id;
- vezes executado;
- última execução;
- duração média;
- volume médio;
- taxa de conclusão.

### `get_weekly_training_balance`

Retorna séries/volume por grupo muscular na semana/mês.

### `get_progression_recommendations`

Retorna:

- exercício;
- carga atual;
- carga sugerida;
- motivo;
- confiança.

## 11. Índices futuros candidatos

Se criar tabela derivada:

- `activity_strength_sets_user_exercise_date_idx` em `(user_id, exercise_id, performed_at desc)`;
- `activity_strength_sets_activity_idx` em `(activity_id)`;
- `activity_strength_sets_plan_idx` em `(workout_plan_id, performed_at desc)`;
- `activities_user_type_date_idx` em `(user_id, activity_type, workout_date desc)`;
- `activities_user_plan_date_idx` em `(user_id, workout_plan_id, workout_date desc)` se houver `workout_plan_id`.

Não criar agora; apenas planejar.

## 12. Nova arquitetura de informação recomendada

### Treinar

Entrada principal para agir agora:

- Começar treino;
- Continuar treino em andamento;
- Meus treinos recentes;
- Modalidades: Musculação, Corrida, Caminhada, Bike, Outro.

### Progresso

Entrada para entender evolução:

- Cargas;
- PRs;
- Volume;
- Frequência;
- Grupos musculares;
- Insights semanais.

### Biblioteca

Entrada para montar/editar:

- Exercícios;
- Treinos salvos;
- Templates;
- Técnicas;
- Histórico por exercício.

### Pós-treino

Momento de celebração/publicação:

- resumo;
- PRs;
- evolução;
- legenda;
- adicionar foto/vídeo;
- compartilhar no Circle.

## 13. O que fica onde

### Botão `+`

Deve focar criação:

- Iniciar treino;
- Publicar treino/foto;
- Check-in.

### Tela de treino

Deve focar execução:

- treino em andamento;
- últimos treinos;
- modalidades;
- plano atual.

### Perfil

Deve mostrar identidade:

- melhores PRs;
- streak;
- badges;
- treinos recentes;
- posts.

### Post

Deve mostrar história social:

- legenda;
- mídia;
- resumo do treino;
- PR/volume se relevante;
- ações sociais.

### Detalhe do treino

Deve mostrar dados ricos:

- séries;
- rota/mapa;
- volume;
- PRs;
- comparação com treino anterior;
- botões: repetir, compartilhar, editar.

## 14. Wireframes textuais

## 14.1 Tela inicial de treino

Objetivo: começar rápido ou retomar rotina.

Componentes:

- header "Treinar";
- se houver treino ativo: card "Treino em andamento";
- seção "Últimos treinos";
- cards horizontais de até 5 treinos;
- seção "Modalidades";
- CTA "Criar treino".

CTA principal: Iniciar.

CTA secundário: Criar treino.

Estado vazio: "Crie seu primeiro treino ou comece livre agora."

## 14.2 Seleção de treino

Objetivo: escolher entre plano salvo e modalidade livre.

Hierarquia:

1. treinos salvos;
2. modalidades;
3. biblioteca/criar.

Microcopy:

- "Continue de onde costuma treinar."
- "Ou comece livre por modalidade."

## 14.3 Execução de treino

Objetivo: guiar o usuário durante a sessão.

Hierarquia:

1. timer/estado;
2. progresso do treino;
3. exercício atual;
4. séries;
5. descanso;
6. controles.

CTA principal: Concluir série ou Iniciar descanso.

CTA secundário: Próximo exercício.

## 14.4 Card do exercício durante treino

Componentes:

- nome do exercício;
- grupo muscular;
- técnica;
- última execução;
- séries planejadas;
- campos reps/kg;
- botão "usar anterior";
- botão "concluir exercício";
- PR/alerta se houver.

Microcopy:

- "Última vez: 3×10 com 20kg"
- "Você está a 2 reps do seu melhor volume."

## 14.5 Histórico do exercício

Objetivo: entender progresso de um exercício.

Componentes:

- gráfico de carga;
- gráfico de volume;
- melhor série;
- última execução;
- lista de treinos;
- notas.

CTA principal: Usar última carga.

## 14.6 Tela de progresso

Objetivo: evolução geral.

Componentes:

- PRs recentes;
- carga por exercício;
- volume semanal;
- grupos musculares;
- frequência;
- insights.

CTA principal: Ver exercício.

## 14.7 Detalhe do exercício

Objetivo: aprender e escolher variações.

Componentes:

- vídeo;
- instruções;
- músculos;
- variações;
- histórico pessoal;
- PR;
- botão adicionar ao treino.

## 14.8 Resumo pós-treino

Objetivo: celebrar e preparar postagem.

Componentes:

- tempo;
- volume;
- séries;
- exercícios;
- PRs;
- evolução vs último treino;
- legenda;
- adicionar mídia;
- compartilhar.

CTA principal: Compartilhar no Circle.

CTA secundário: Salvar privado / adicionar fotos.

## 14.9 Post de treino no feed

Objetivo: socializar progresso.

Componentes:

- header social;
- mídia se houver;
- pílula de treino com dados;
- PR/volume se relevante;
- mapa se rota;
- legenda;
- ações sociais.

## 14.10 Insight semanal

Objetivo: gerar retorno semanal.

Componentes:

- "Semana fechada";
- treinos feitos;
- volume;
- PRs;
- grupo mais treinado;
- grupo esquecido;
- CTA "Planejar próxima semana".

## 15. Microcopy sugerida

### Durante treino

- "Exercício 1 de 8"
- "Faltam 2 séries"
- "Usar carga anterior"
- "Concluir exercício"
- "Próximo exercício"
- "Iniciar descanso"
- "Descanso pronto"

### Progresso

- "Você evoluiu desde a última vez"
- "Melhor carga"
- "Melhor volume"
- "Última execução"
- "Hora de tentar mais carga"
- "Mantenha a carga hoje"

### Pós-treino

- "Treino concluído"
- "Você evoluiu em 3 exercícios"
- "Novo PR"
- "Volume total"
- "Escreva como foi esse treino"
- "Compartilhar no Circle"

### Alertas

- "Faz 9 dias que você não treina costas"
- "Pernas ficaram para trás essa semana"
- "Peito já teve estímulo suficiente essa semana"

## 16. Repetição e simplificação

### Unificar

- "planilha" e "treino" devem virar apenas "treino".
- Treino sem mídia e post com treino devem usar a mesma estrutura social.
- Recordes e progresso devem se encontrar numa área "Progresso".

### Remover/reduzir

- Reduzir dependência de swipe invisível.
- Reduzir cards com mesmo formato na escolha de treino.
- Reduzir footer fixo durante preenchimento.

### Transformar

- Descanso em componente contextual do exercício.
- Finalização em tela de resumo pós-treino.
- Histórico do exercício em bottom sheet.

### Menos cliques

- Botão "usar carga anterior".
- Repetir treino direto do post/detalhe.
- Criar treino a partir de treino concluído.

## 17. Features descartadas por enquanto

1. Prescrição automática completa de treino.
2. Recuperação muscular com promessa fisiológica.
3. IA generativa para montar ciclo inteiro sem validação.
4. Integração HealthKit/Strava nesta sprint.
5. Social betting/competição com prêmio.
6. Ranking público global irrestrito por carga, por risco de comparação tóxica e dados inconsistentes.

## 18. Plano de sprints

## Sprint 1 — Quick UX Wins

Objetivo: diminuir confusão no fluxo principal.

Escopo (v2 — inclui achados do vídeo):

- separar "Meus treinos" de "Modalidades" (headers distintos + card compacto);
- **eliminar o layout shift dos recentes** (skeleton/altura reservada enquanto carrega);
- reorganizar tela ativa de musculação;
- deixar exercício atual mais claro ("Exercício X de Y" + botão "Próximo");
- **exercício "Por tempo" ganha UI própria** (duração/concluído — sem reps × kg);
- **KG vira placeholder de verdade** e carga 0 não persiste como "0 kg";
- resolver competição com rodapé (**CTA do descanso nunca coberto** — evidência no frame);
- descanso contextual;
- resumo pós-treino básico (antes de virar post; confirmação p/ treinos < 2 min);
- oferecer rename inline pro plano legado "Planilha" (dado, não código).

Fora de escopo:

- migrations;
- gráficos complexos;
- HealthKit/Strava.

Arquivos prováveis:

- `WebWorkoutScreen.tsx`;
- `WorkoutPlansFab.tsx`;
- `PostScreen.tsx`;
- i18n `pt-BR.json` e `en.json`;
- componentes de feed/card se necessário.

Migration: não.

Testes:

- unit de rest timer;
- sessão de treino;
- render básico se existente;
- lint/build.

Risco: médio, por tocar fluxo central.

Critérios de aceite:

- usuário entende exercício atual;
- não há CTA escondido pelo footer;
- descanso aparece no contexto certo;
- finalizar mostra resumo claro;
- termos "planilha" somem da UI de treino.

## Sprint 2 — Histórico e carga anterior

Objetivo: reduzir digitação e mostrar memória do app.

Escopo:

- buscar última execução por exercício;
- mostrar "última vez";
- botão "usar carga anterior";
- comparação simples com treino anterior;
- histórico do exercício em bottom sheet.

Migration: não obrigatória; RPC simples recomendada.

Risco: médio.

Critérios:

- ao abrir exercício, usuário vê última carga;
- pode preencher com um toque;
- comparação aparece no fim.

## Sprint 3 — Progresso e gráficos

Objetivo: criar área de evolução.

Escopo:

- gráfico de carga por exercício;
- volume semanal;
- PRs;
- frequência;
- grupos musculares.

Migration: recomendada.

Arquivos prováveis:

- `workout/`;
- nova RPC/migration;
- tela/sheet de Progresso;
- componentes de chart.

Risco: médio/alto por dados.

Critérios:

- gráfico carrega rápido;
- sem scan pesado client-side;
- histórico respeita privacidade/RLS.

## Sprint 4 — Sugestões inteligentes

Objetivo: orientar treino.

Escopo:

- hora de progredir carga;
- alertas de grupo muscular;
- treino sugerido do dia;
- deload simples.

Migration: talvez.

Risco: alto se regra for ruim; mitigar com copy cuidadosa.

Critérios:

- sugestão explica motivo;
- usuário pode ignorar;
- não promete resultado médico.

## Sprint 5 — Premium/social

Objetivo: transformar progresso em conteúdo social.

Escopo:

- post de treino mais bonito;
- mini gráfico no post;
- PR compartilhável;
- insight semanal;
- conquistas por treino.

Migration: pequena se novas conquistas.

Risco: médio.

Critérios:

- feed fica mais desejável;
- treino com foto não duplica informações;
- treino sem foto continua post social completo.

## 19. Riscos técnicos

1. Query em JSONB pode pesar SE o volume crescer — hoje (56 sets) é risco
   futuro; não bloquear MVP client-side por isso.
2. Exercise names livres podem quebrar agrupamento; priorizar `exercise_id`
   (v2: 100% dos sets em produção já têm `exercise_id` — manter assim).
3. Sugestão de carga precisa considerar reps alvo, carga, histórico e tipo de exercício.
4. ~~Dados antigos sem `exercise_id`~~ — removido na v2; não existem em produção.
5. Zeros de carga não intencionais (v2: só 8/56 sets têm carga > 0) podem poluir
   gráficos e PRs — sanitizar na escrita e/ou filtrar `weight_kg > 0` na leitura.
6. Ranking precisa respeitar privacidade, bloqueios e follow status.
7. Normalização futura deve ser aditiva e idempotente.
8. Com dataset pequeno, TODO insight/gráfico precisa de estado vazio/threshold
   ("registre carga em 3 treinos para ver seu gráfico") — senão a área Progresso
   nasce parecendo quebrada.

## 20. Próximo prompt recomendado — implementar Sprint 1

```text
Vamos implementar a Sprint 1 — Quick UX Wins da área de Treinos.

Objetivo:
Melhorar clareza da tela de escolher treino, execução de musculação e pós-treino, sem migrations e sem publicar automaticamente.

Escopo:
1. Separar "Meus treinos" de "Modalidades" na tela de escolher treino, com
   skeleton/altura reservada pros recentes (elimina o layout shift do load).
2. Tela ativa de musculação com exercício atual como foco:
   - "Exercício X de Y" claro;
   - séries restantes;
   - botões "Concluir exercício" e "Próximo exercício" (swipe vira atalho);
   - exercício "Por tempo" com UI de duração/concluído (sem reps × kg);
   - campo KG com placeholder real; carga 0 não persiste como "0 kg".
3. Reposicionar o timer de descanso para o CTA nunca ficar sob o rodapé.
4. Reduzir peso/altura do footer fixo durante preenchimento.
5. Criar etapa de resumo pós-treino antes de abrir publicação:
   - duração;
   - séries;
   - volume calculado (só sets com carga > 0);
   - exercícios;
   - CTA "Compartilhar no Circle";
   - CTA "Adicionar foto";
   - confirmação extra quando o treino durou menos de 2 minutos.
6. Lista de treinos salvos: ação de renomear inline (cobre o plano legado
   "Planilha" sem migração de dados).

Não fazer:
- migrations;
- HealthKit/Strava;
- Android;
- SwiftUI paralelo;
- push;
- publicação sem aprovação.

Validar:
npm run lint
npm run build
npm test -- --run
git diff --check
```

## 21. Conclusão

O Gym Circle já tem um diferencial raro: treino real + rede social + streak + recordes. O próximo passo não é adicionar mais botões; é organizar a experiência para o usuário sentir que o app acompanha a evolução dele. O produto deve sair de "registrar treino" para "ser guiado, comparar, evoluir e compartilhar".

Minha recomendação é começar pela Sprint 1. Ela não depende de migration, melhora imediatamente a experiência principal e prepara terreno para as features inteligentes.

## 22. Registro de implementação — Sprint 1 Quick UX Wins

Implementada em 11 de julho de 2026 com base nesta auditoria e nas evidências
visuais complementares. O escopo foi mantido em web/Capacitor compartilhado,
sem migration, RPC nova, alteração no Supabase de produção, Push, Android,
HealthKit ou app SwiftUI paralelo.

### 22.1 Escolha de treino

- A seção **Meus treinos** passa a existir desde o primeiro render e reserva
  altura estável durante o carregamento. Isso impede que **Modalidades** mude de
  posição depois da resposta assíncrona.
- Foram adicionados skeleton premium, erro com retry e estado vazio estável.
- Treinos salvos aparecem em carrossel próprio, limitados aos cinco primeiros,
  com número de exercícios e CTA **Começar**.
- **Modalidades** ficou em seção separada e mantém Musculação, Corrida,
  Caminhada, Bike e Outro como ações livres.
- O CTA **Criar treino** abre diretamente o editor sem reabrir sozinho quando a
  tela é montada novamente.

### 22.2 Dado legado “Planilha”

- O dado legado não foi migrado nem alterado automaticamente.
- Nome vazio ou exatamente `Planilha` é apresentado como **Treino sem nome**.
- O card oferece **Renomear** e salva apenas depois de uma ação explícita do
  usuário, reutilizando o fluxo atual de `workout_plans`.
- Novas microcopies da área usam **treino**, não “planilha”.

### 22.3 Execução de musculação

- O exercício atual virou o foco visual do modo ativo.
- Cada card informa **Exercício X de Y**, séries concluídas, séries faltantes,
  tipo do alvo e técnica quando disponível.
- O swipe horizontal e o autoavanço foram preservados, mas deixaram de ser a
  única navegação: há botões **Anterior**, **Próximo exercício** e
  **Concluir exercício**.
- Exercícios já concluídos podem ser revisitados sem novo autoavanço forçado.
- Inputs e conclusões são persistidos no rascunho local; minimizar/reabrir não
  apaga reps, cargas, durações nem marcações.
- Sessões locais do formato anterior são lidas como v4 sem perder relógio,
  pausas, distância ou rota.

### 22.4 Séries por repetição, falha e duração

- Séries normais continuam com **Reps × Kg**.
- Séries até a falha não exigem carga.
- Séries **Por tempo** ganharam UI de duração em segundos e ação de conclusão;
  não exibem mais Reps × Kg nem inventam repetições.
- Uma duração vazia não pode ser concluída sem valor planejado e não é mais
  convertida artificialmente em `1s`.
- Apagar uma duração concluída devolve a série ao estado pendente.
- A conclusão do exercício deriva os IDs válidos antes de atualizar o estado,
  evitando perder séries por agendamento assíncrono do React.

### 22.5 Carga vazia e volume

- O input de Kg abre vazio e usa placeholder; `0` não aparece mais como carga
  registrada por padrão.
- Valor vazio, zero, negativo ou inválido é normalizado para `null`.
- Leitura e serialização tratam cargas legadas menores ou iguais a zero como
  ausência de carga.
- Volume estimado soma somente séries com reps positivas e carga positiva.
- Não houve limpeza retroativa dos dados e nenhuma migration foi criada.

### 22.6 Descanso e rodapé

- O descanso foi movido para dentro do contexto do exercício ativo.
- Timer, ajuste de ±10 segundos, **Pular descanso** e CTA de início ficam acima
  do dock e respeitam a safe area.
- O rodapé de Encerrar/Pausar/Fechar ficou menor e recolhe durante a digitação,
  mantendo os campos visíveis no iPhone.
- As mensagens de séries restantes foram pluralizadas em pt-BR e inglês.

### 22.7 Finalização e resumo

- Treinos abaixo de dois minutos exibem confirmação estável com
  **Continuar treino** e **Salvar mesmo assim**.
- Depois da confirmação, a tela mostra **Treino concluído** antes de abrir o
  composer, com duração e, conforme a modalidade, exercícios, séries,
  repetições, volume estimado, distância e mapa da rota.
- **Compartilhar no Circle** abre diretamente os detalhes do post.
- **Adicionar foto** abre a etapa de mídia.
- **Concluir por agora** encerra o fluxo sem prometer privacidade que o modelo
  atual de `activities` não oferece.
- O composer diferencia corretamente treino sem mídia de check-in sem mídia.

Nota de arquitetura: `finishWebActivity` continua persistindo a activity antes
de renderizar o resumo para garantir atividade, streak e recuperação do dado.
Como activities não promovidas já podem aparecer no feed, um rascunho realmente
privado exigiria mudança de modelo/backend e ficou explicitamente fora desta
sprint. O resumo interrompe o fluxo antes do composer/publicação com mídia.

### 22.8 Arquivos e cobertura

Principais superfícies alteradas:

- `WebWorkoutScreen.tsx`;
- `WorkoutPlansFab.tsx`;
- `WorkoutCompletionSummary.tsx`;
- `workoutSession.ts`;
- `workoutSummary.ts`;
- `PostScreen.tsx` e o contexto do composer;
- serialização de `StrengthSet` no pacote core;
- traduções pt-BR/en;
- testes de resumo, sessão e activity.

Validação final local:

- ESLint: sem erros ou warnings;
- TypeScript: sem erros;
- Vitest: **61 arquivos e 464 testes passando**;
- Next.js production build: concluído;
- JSON pt-BR/en: válido;
- `git diff --check`: limpo;
- QA visual Playwright: escolha, execução, preenchimento, descanso e resumo
  verificados em viewports de 390×844 e 375×667; nenhum CTA ficou coberto.

### 22.9 Pendências deliberadamente fora da Sprint 1

- histórico e gráfico por exercício;
- uso automático de carga anterior;
- sugestão de progressão;
- PRs e novas conquistas;
- supersets, drop sets e warm-up sets;
- rascunho privado de activity;
- novas RPCs ou migrations;
- integrações HealthKit/Strava e Android.

## 23. Registro de implementação — Sprint 2 Histórico e carga anterior

Implementada em 11 de julho de 2026 no commit `37885a8`. A revisão de 12 de
julho confirmou que a base estava funcional e identificou ajustes incorporados
à Sprint 3.

### 23.1 Entregas

- O exercício ativo mostra a última execução do próprio usuário.
- **Usar cargas** reaplica somente pesos nos campos vazios; repetições permanecem
  como resultado real da sessão atual.
- O histórico contextual lista sessões, melhor série, volume e duração.
- O pós-treino compara apenas exercícios presentes nas duas sessões, evitando
  comparar rotinas incompatíveis.
- Exercícios por duração passam a existir no histórico sem inventar reps ou
  carga.
- Falhas de carregamento têm estado de erro e retry; troca/logout não reutiliza
  dados da conta anterior.
- O resumo de última execução deixou de sugerir que todas as séries tiveram as
  mesmas repetições e mostra a melhor série de forma direta.

### 23.2 Ajuste de séries até a falha

- **Até a falha** agora aceita **Reps × Kg**.
- Repetições continuam obrigatórias para concluir a série; carga é opcional para
  peso corporal.
- Com carga positiva, a série entra em volume, histórico, gráficos e recorde.
- Sem carga, continua válida e entra somente em repetições.
- Não houve migration: `StrengthSet`, JSONB, serialização e captura de recordes
  já suportavam `target_kind = failure` com `weight_kg`.

## 24. Registro de implementação — Sprint 3 Progresso e gráficos

Implementada em 12 de julho de 2026. A definição oficial seguida foi a desta
auditoria: **Progresso e gráficos**. O plano “Biblioteca e inteligência” do
documento visual complementar permanece como etapa futura.

### 24.1 Progresso e recordes em uma superfície

- O launcher do perfil passa a abrir **Progresso e recordes**.
- A mesma sheet reúne as abas acessíveis **Visão geral**, **Histórico** e
  **Recordes**; o ranking entre amigos foi preservado.
- O histórico solicitado fica junto do recorde pessoal, não apenas durante um
  treino ativo.
- O detalhe de exercício mostra melhor carga, sessões, séries, recorde e lista
  cronológica de execuções.

### 24.2 Gráficos e métricas

- Gráfico semanal de frequência.
- Gráficos por exercício alternáveis entre carga, volume, repetições e tempo.
- Visão geral com treinos e dias ativos na semana, volume semanal e quantidade
  de recordes.
- Distribuição de séries por grupo muscular.
- Estados vazios explicam quando ainda faltam dados; a tendência só é desenhada
  com pelo menos dois pontos válidos.
- O gráfico oferece equivalente textual para leitores de tela e não depende
  apenas de cor.

### 24.3 Dados, privacidade e performance

- Sem migration e sem nova RPC nesta etapa: produção tinha apenas 15 atividades
  e 66 séries no momento da auditoria.
- A consulta é limitada aos últimos 84 dias e a 200 atividades, com select
  mínimo, filtro explícito por `user_id`, cleanup e proteção contra resposta
  antiga após troca de conta.
- O catálogo fornece o grupo muscular primário; exercício desconhecido cai em
  **Outros**.
- Carga zero, negativa ou ausente não entra em volume nem gráfico de carga.
- Série por duração usa segundos como métrica própria.
- A migração para RPC agregada fica condicionada a mais de 500 atividades por
  usuário ou p95 acima de 200 ms, evitando complexidade prematura.

### 24.4 Cobertura adicionada

- Histórico por duração e comparação apenas de exercícios em comum.
- Falha com e sem carga.
- Carga zero/null.
- Semanas cronológicas com gaps.
- Grupos musculares e fallback `other`.
- Pontos de exercício ordenados cronologicamente.
- Loading, erro, retry e isolamento por usuário nos hooks.

### 24.5 Próximas etapas deliberadamente fora da Sprint 3

- sugestão automática de progressão de carga;
- deload e alertas inteligentes;
- normalização de `strength_sets`;
- RPCs agregadas de progresso;
- vínculo persistido entre activity e workout plan;
- biblioteca inteligente, variações e vídeos adicionais;
- HealthKit/Strava, Android e app SwiftUI paralelo.

### 24.6 Validação final

- ESLint: sem erros ou warnings;
- TypeScript: sem erros;
- Vitest: **63 arquivos e 482 testes passando**;
- Next.js production build: concluído;
- JSON pt-BR/en: válido;
- `git diff --check`: limpo;
- nenhuma migration, secret ou dependência nova.

## 25. Registro de implementação — QA, qualidade, inteligência e biblioteca

Implementado em 12 de julho de 2026, cobrindo os quatro próximos passos após as
Sprints 2 e 3. Nenhuma alteração foi aplicada diretamente ao Supabase.

### 25.1 QA das Sprints 2 e 3

- O fluxo **até a falha** deixou de concluir automaticamente ao preencher reps:
  a confirmação é explícita, permitindo digitar a carga opcional antes de
  avançar.
- A comparação pós-treino passou a incluir exercícios por duração sem inventar
  repetições.
- Recordes agora isolam respostas por usuário; requests antigas não podem
  reaparecer após troca de conta.
- O ranking ganhou dedupe por sequência, erro e retry, evitando resposta de um
  recorde aparecer em outro.
- A UI informa que o histórico analítico cobre 84 dias, enquanto os recordes
  continuam all-time.

### 25.2 Qualidade dos dados verificada em produção

- 66 séries, todas com reps positivas, `exercise_id` válido e correspondência
  no catálogo.
- 14 séries com carga positiva e 52 sem carga; nenhuma carga zero, negativa ou
  string.
- 4 séries até a falha, ainda sem carga por serem dados anteriores ao campo de
  peso opcional.
- O banco salva somente séries explicitamente concluídas; séries planejadas ou
  puladas ainda não são persistidas e não entram em analytics.
- `null` significa **sem carga registrada**. Só tratamos como peso corporal
  quando o exercício for exclusivamente desse tipo ou houver confirmação
  futura do usuário.

### 25.3 Progressão inteligente conservadora

- Uma sugestão de progressão exige duas sessões comparáveis do mesmo
  `exercise_id`, pelo menos duas séries ponderadas em cada, mesma quantidade de
  séries ponderadas, mesma maior carga e reps totais sem queda.
- Sem evidência suficiente, a UI mostra estado de aprendizado; não inventa
  aumento de carga.
- Há comparativo semanal e alerta de grupo **não registrado** na semana com base
  somente no histórico. Não há promessa médica de recuperação ou deload.
- Produção ainda não possui nenhum exercício com duas sessões ponderadas
  comparáveis; portanto o comportamento correto atual é o estado de coleta.

### 25.4 Biblioteca de exercícios

- Busca textual global, mesmo quando outro grupo muscular está selecionado.
- Chips **Todos**, grupo muscular e equipamento, com áreas de toque de 44 px.
- Equipamentos traduzidos em pt-BR/en e exercícios comunitários identificados.
- Loading, erro/retry, estado vazio e fechamento por Escape.
- A seleção abre explicação/instruções e vídeo antes de adicionar ao treino.
- Editor usa nome do catálogo no idioma atual por `exerciseId`; técnicas também
  respeitam o idioma.
- Exercício/técnica inexistente só entra no catálogo comunitário depois de uma
  confirmação explícita.

### 25.5 Limites e próximos dados estruturais

- A estrutura de variações foi preparada com `parent_exercise_id` e
  `movement_pattern`, sem inferência por nome. A migration ainda não foi
  aplicada e a curadoria dos relacionamentos continua pendente.
- Histórico completo de conclusão exigirá persistir séries planejadas,
  concluídas e puladas, posição e metas.
- Diferenciar carga externa, peso corporal, assistido e não informado exigirá
  `load_mode`.
- A canonicalização de recordes por `exercise_id` foi preparada com backfill
  conservador, RPC v2 e fallback para `exercise_key`. A migration ainda não foi
  aplicada.
- RPC agregada continua condicionada a mais de 500 atividades por usuário ou
  p95 superior a 200 ms.

### 25.6 Evidência de QA

- Banco de produção auditado apenas com queries read-only.
- Regras puras cobertas para progressão, aprendizado, lacuna muscular,
  comparativo semanal, busca/filtros do catálogo, duração e conclusão até a
  falha.
- O navegador autenticado não estava disponível nesta execução; o smoke visual
  logado em iPhone/Capacitor permanece necessário antes de publicar.

### 25.7 Fechamento técnico e mapa de pendências

- O catálogo agora protege a interface inglesa de traduções legadas falsas,
  identifica o nome original e omite instruções PT quando não há versão EN.
- Variações explícitas aparecem no preview e também participam da busca.
- Recordes novos poderão ser associados diretamente ao mesmo `exercise_id` do
  histórico e do catálogo sem quebrar clientes antigos.
- O mapa operacional completo, incluindo ordem de migrations, QA obrigatório e
  backlog estrutural, está em
  `docs/workout-remaining-map-2026-07-12.md`.
