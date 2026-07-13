# Auditoria de gaps das Sprints D–G — 13/07/2026

## 1. Escopo e estado observado

Esta auditoria compara os documentos
`workout-data-product-roadmap-2026-07-10.md` e
`workout-remaining-map-2026-07-12.md` com o código atual. O objetivo é separar
base reutilizável, implementação parcial e trabalho realmente pendente nas
Sprints D–G:

- D — PRs e pós-treino social;
- E — evolução por treino salvo e favoritos;
- F — sugestão do dia;
- G — catálogo editorial e sequências.

O snapshot foi feito na branch `main`. As migrations de Sprint 0 e das
fundações A–C ainda não são evidência de produção nesta auditoria. Arquivos
locais/untracked em construção também não são classificados como feature
entregue até estarem integrados, testados, versionados e aplicados no banco.

## 2. Resumo executivo

| Sprint | Já existe | Falta para concluir | Dependência bloqueante |
|---|---|---|---|
| D — PR social | tentativas de PR, recordes atuais, ranking, resumo básico e vínculo post/activity | highlight imutável, métricas novas, RPC por activity, opt-out e UI social | B: status/load type confiáveis |
| E — evolução do treino | CRUD de planos e analytics por exercício/semana | vínculo activity/plan em produção, favorito, stats agregadas e detalhe do plano | A: plan ID + snapshots |
| F — sugestão | insights conservadores de progressão/semana/grupo e scorer puro em construção | consulta integrada, card/copy, dismiss e histórico ligado | A e E; amostra mínima |
| G — catálogo/sequência | catálogo PT/EN, aliases comuns, filtros, preview, contribuições e variações propostas | curadoria, proveniência/licença, campos editoriais, RLS editorial, substituições e sequências | migration de variações + pipeline editorial |

Conclusão: a ordem segura é **A/B primeiro, depois D e E, depois F, e G em
duas partes** (catálogo editorial e sequências). Publicar D antes de B pode
criar PR falso; publicar E/F antes de A exige inferir plano por nome, o que é
incorreto; publicar mídia do catálogo sem proveniência/licença cria risco
jurídico.

## 3. Base transversal já existente

### 3.1 Dados e domínio

- `activities.strength_sets` armazena séries de força em JSONB.
- `posts.source_activity_id` mantém rastreabilidade entre treino e post.
- `personal_record_results` guarda uma tentativa por activity/métrica.
- A captura atual reconhece `strength_weight`, `run_5k_time` e
  `run_10k_time`, filtrando peso e reps positivos.
- A migration local `20260712231537_canonicalize_personal_record_exercise_id.sql`
  propõe `exercise_id`, `get_personal_records_v2` e ranking canônico, mas o
  mapa de fechamento registra que ela ainda depende do gate migration → web.
- O catálogo atual possui grupos, exercícios, técnicas, nomes PT/EN, um array
  comum de aliases, equipamento, descrição, instruções, vídeo/search query,
  status e autoria.
- A migration local `20260712231606_add_workout_exercise_variations.sql`
  propõe `parent_exercise_id` e `movement_pattern`, com fallback no cliente
  enquanto as colunas não existirem.

### 3.2 Cliente e superfícies

- `WorkoutCompletionSummary.tsx` já mostra duração, exercícios, séries,
  reps, volume válido, comparação com a sessão anterior e mapa.
- `usePersonalRecords.ts`, `PersonalRecordsSheet.tsx`,
  `ExerciseProgressDetail.tsx` e `PersonalRecordsLauncher.tsx` já entregam
  recordes, ranking e histórico/progresso por exercício.
- `workoutProgress.ts` agrega 84 dias/200 activities por exercício, semana e
  grupo muscular; peso zero/negativo vira ausência.
- `workoutInsights.ts` produz estado de aprendizado, progressão conservadora,
  lacuna de grupo e comparativo semanal.
- `useWorkoutPlans.ts` oferece CRUD e `touchPlan`, mas `touchPlan` apenas muda
  `updated_at`; não comprova execução.
- `useWorkoutCatalog.ts` oferece carga, busca, contribuição, fallback de
  schema e ligação de variações explícitas.
- `SocialPostCard.tsx` e `FeedActivityCard.tsx` exibem resumo do treino, mídia,
  rota e detalhes, mas não PR imutável.

### 3.3 Testes existentes úteis

- histórico e comparação: `exerciseHistory.test.ts`;
- correspondência recorde/exercício: `personalRecordMatching.test.ts`;
- progresso e insights: `workoutProgress.test.ts`, `workoutInsights.test.ts`;
- catálogo: `workoutCatalogFilters.test.ts`,
  `workoutCatalogLocalization.test.ts`, `workoutCatalogVariations.test.ts`;
- resumo: `workoutSummary.test.ts`.

Não há cobertura ponta a ponta de highlight social, estatística por plano,
card de sugestão, sequência ou fluxo editorial/admin.

## 4. Sprint D — PRs e pós-treino social

### 4.1 O que já existe

1. `personal_record_results` preserva resultados por activity, em vez de
   manter apenas o recorde atual.
2. O trigger privado recompõe tentativas após insert/update da activity.
3. `get_personal_records` e a proposta v2 devolvem o melhor resultado atual.
4. O ranking do Circle já suporta métricas de força/corrida existentes.
5. O resumo pós-treino já tem hierarquia visual, métricas, comparação e CTAs
   de foto/compartilhamento.
6. O post mantém `source_activity_id`, portanto um highlight futuro pode ser
   validado contra a fonte.

### 4.2 O que ainda falta

1. **Imutabilidade do “novo PR”.** Hoje o cliente conhece o melhor recorde
   atual, não o que foi novo no instante daquela activity. Recalcular um post
   antigo com dados atuais muda o passado.
2. Tabela `activity_pr_highlights` com valor anterior, novo valor, unidade,
   exercício, contexto e unique por activity/métrica/escopo.
3. Métricas adicionais com regras separadas:
   - reps na mesma carga;
   - volume da melhor série;
   - volume por exercício;
   - volume total válido do treino;
   - pace real com qualidade/distância mínima.
4. RPC `get_activity_record_highlights(p_activity_id uuid)` com RLS/visibilidade
   da própria activity/post e retorno apenas do subset social seguro.
5. Captura server-derived que compare somente activities anteriores e apenas
   séries `completed` com `load_type = external` e carga/reps positivas.
6. Busca dos highlights depois da finalização; hoje
   `WebWorkoutScreen.tsx` monta o resumo logo após criar a activity usando só
   métricas locais e comparação com a sessão anterior.
7. Hero/lista de PR no `WorkoutCompletionSummary`.
8. Pílula/card no `SocialPostCard` e no card de activity, sem duplicar o bloco
   quando há mídia.
9. Opt-out por publicação e vínculo dos highlights escolhidos ao post ou
   seleção preservada no payload social.
10. Copy/i18n para métrica, delta, estimativa e estado sem destaque.

### 4.3 Migration e RPC recomendadas

Migration `create_activity_pr_highlights`:

- expandir `personal_record_results.metric_key` de forma aditiva;
- criar `activity_pr_highlights` owner-only para leitura bruta;
- manter FK cascade para activity e FK nullable para exercício;
- incluir `previous_value`, `value`, unidades, `secondary_value`, metadata
  pequena e `achieved_at`;
- trigger/função privada idempotente para derivação;
- opcionalmente criar relação `post_pr_highlights(post_id, highlight_id)` se
  o usuário puder selecionar/ocultar destaques por post.

RPC `get_activity_record_highlights(uuid)`:

- `security invoker`;
- validação por RLS, sem parâmetro de user arbitrário;
- não retorna notas privadas/RPE;
- diferencia resultado estimado e confirmado.

### 4.4 Arquivos prováveis

- `supabase/migrations/*create_activity_pr_highlights.sql`;
- `apps/web/.../workout/usePersonalRecords.ts`;
- novo `apps/web/.../workout/useActivityRecordHighlights.ts`;
- `WorkoutCompletionSummary.tsx`;
- `SocialPostCard.tsx` e `FeedActivityCard.tsx`;
- mappers/selectors/tipos sociais do workout;
- `pt-BR.json`, `en.json`;
- `packages/core/src/database.types.ts` regenerado.

### 4.5 Testes obrigatórios

- primeiro resultado não gera delta falso;
- recorde anterior, empate e regressão;
- zero/null/not_provided ignorados;
- assisted não vira maior carga externa;
- skipped/planned ignorados;
- activity editada/deletada e idempotência do trigger;
- corrida estimada não recebe o mesmo destaque de corrida confirmada;
- post histórico preserva highlight original;
- RLS: owner, seguidor aceito de perfil privado, não seguidor e bloqueado;
- opt-out não remove o recorde bruto;
- card com e sem mídia não duplica resumo.

### 4.6 Bloqueadores de produção

- Sprint B aplicada e cliente gravando `status`/`load_type` corretamente;
- migration canônica de `exercise_id` validada/aplicada;
- testes SQL de trigger/RLS em preview;
- smoke autenticado com duas contas;
- nenhum highlight derivado de dados legados ambíguos sem marca de legado.

## 5. Sprint E — Evolução por treino e favoritos

### 5.1 O que já existe

- planos salvos têm CRUD, lista por `updated_at` e exercícios snapshotados no
  próprio JSON do plano;
- `touchPlan` fornece recência operacional, mas não execução real;
- progresso por exercício/semana/grupo já pode alimentar componentes visuais;
- histórico por exercício e comparação com sessão anterior já estão prontos.

### 5.2 O que ainda falta

1. `activities.workout_plan_id` e snapshots de nome/exercícios/versionamento.
2. Threading do contexto do plano: iniciar plano → sessão local → payload de
   finalização → core service → activity.
3. `workout_plans.is_favorite`; não persistir `times_used`, `last_used_at` ou
   média, pois eles sofrem drift após delete/edit.
4. RPC agregada `get_my_workout_plan_stats(p_limit integer default 20)`.
5. Stats por plano:
   - vezes executado;
   - última execução;
   - duração mediana/média válida;
   - volume médio/máximo válido;
   - conclusão média;
   - últimas execuções;
   - exercícios mais pulados;
   - evolução por medianas de janelas.
6. Favorite toggle e ordenação estável no hook/card.
7. Sheet/tela de detalhe do treino salvo.
8. Estados de amostra insuficiente e de plano apagado após execução.
9. Paginação/limit da RPC sem uma query por card.

### 5.3 Migration e RPC recomendadas

- Sprint A deve adicionar plan ID, snapshots, started_from, trigger que valida
  ownership, índice parcial e `is_favorite`.
- Não adicionar counters/caches em `workout_plans` na primeira versão.
- `get_my_workout_plan_stats` deve usar `auth.uid()`, ser `security invoker`,
  limitar o resultado e derivar estatísticas das activities visíveis do dono.
- Índice: `activities(user_id, workout_plan_id, started_at desc)` onde plan ID
  não é null; índice de planos por user/favorite/updated.

### 5.4 Arquivos prováveis

- migration da Sprint A e migration/RPC de stats;
- `workoutSession.ts`, `WebWorkoutScreen.tsx`;
- tipos e services de activity em web/core;
- `useWorkoutPlans.ts`;
- novo `useWorkoutPlanStats.ts` e `WorkoutPlanDetailSheet.tsx`;
- hub/cards em `WebWorkoutScreen.tsx`/`WorkoutPlansFab.tsx`;
- i18n e tipos Supabase regenerados.

### 5.5 Testes obrigatórios

- iniciar plano persiste ID e snapshot;
- editar/apagar plano não altera activity histórica;
- plano de outro usuário é rejeitado pelo banco;
- favorito owner-only e ordenação;
- delete/edit de activity reconcilia stats;
- plano apagado ainda tem snapshot histórico;
- durations inválidas e volumes sem external ignorados;
- conclusão usa completed/(completed+skipped), não séries adicionadas;
- evolução exige amostra mínima por janela;
- uma única chamada entrega cards sem N+1;
- paginação/limit e troca de conta não misturam dados.

### 5.6 Bloqueadores de produção

- Sprint A expandida e validada antes do web dependente;
- backfill não deve inferir plano pelo nome; atividades antigas ficam null;
- Sprint B para conclusão/volume confiáveis;
- tipos regenerados e fallback durante rollout;
- smoke Capacitor: iniciar/retomar/finalizar plano, logout/login e offline.

## 6. Sprint F — Sugestão do dia

### 6.1 O que já existe

- `workoutInsights.ts` já gera insights conservadores de progresso, lacuna de
  grupo e semana, sem linguagem médica;
- `useWorkoutProgress.ts` tem recorte limitado e isolado por usuário;
- planos salvos e catálogo fornecem nome, exercícios e grupos;
- há um scorer pessoal determinístico em construção com testes de padrão por
  dia da semana, transição, frequência, recência, favorito e baixa confiança.

Esse scorer isolado não constitui feature entregue: ainda faltam fonte de
histórico ligado, hook, UI, i18n, dismiss e release.

### 6.2 O que ainda falta

1. Ler histórico real por `workout_plan_id`; não inferir por nome.
2. Integrar scorer a um hook com lifecycle/troca de conta e limite temporal.
3. Card no hub: uma sugestão principal, no máximo duas alternativas e motivo.
4. CTA `Começar`, ação `Agora não` e dismiss namespaced por usuário/dia.
5. Estado sem histórico: onboarding, nunca recomendação com falsa confiança.
6. Copy explicável e não médica.
7. Instrumentação agregada sem PII: exibiu, iniciou, ignorou e qual razão.
8. Definir limiar de confiança e evitar repetição do treino de ontem.
9. Opcional `get_workout_suggestion_context()` se o cliente precisar de várias
   consultas; primeiro medir a versão client-side.

### 6.3 Abordagem recomendada

V1 não deve ser chamada de machine learning. É um recomendador pessoal,
determinístico e auditável:

- padrão do mesmo dia da semana;
- transição mais comum após o último plano;
- frequência geral;
- recência/anti-repetição;
- favorito explícito;
- depois, grupo pouco registrado.

Exibir confiança baixa enquanto houver menos de 3 sessões ligadas e só elevar
confiança com amostra de dia/transição repetida. ML real deve ser avaliado
depois de volume e métricas de qualidade suficientes; o dataset atual é pequeno
para justificar treinamento personalizado robusto.

### 6.4 Arquivos prováveis

- `workoutRecommendation.ts` e testes;
- novo `useWorkoutRecommendation.ts`;
- `useWorkoutPlans.ts`/fonte de activities ligadas;
- hub em `WebWorkoutScreen.tsx`;
- `workoutInsights.ts` apenas se compartilhar sinais;
- `pt-BR.json`, `en.json`;
- analytics existente, sem payload de saúde/identidade.

### 6.5 Testes obrigatórios

- sem plano e sem histórico;
- planos sem execuções;
- uma sessão e confiança baixa;
- padrão de segunda/terça;
- transição determinística;
- favorito recente versus anti-repetição;
- plano apagado, activity sem vínculo e data inválida;
- semanas parciais;
- empate determinístico;
- dismiss isolado por user/data;
- troca de conta e resposta antiga;
- idioma PT/EN;
- CTA inicia o plano correto.

### 6.6 Bloqueadores de produção

- Sprint A em produção e pelo menos novas activities realmente ligadas;
- favorito da Sprint E se entrar no score;
- scorer integrado, não apenas arquivo puro;
- QA de copy: “pode ser um bom dia”, nunca recuperação/prescrição;
- monitorar baixa amostra e permitir ignorar.

## 7. Sprint G — Catálogo editorial e sequências

### 7.1 O que já existe no catálogo

- nomes, descrição e instruções PT/EN;
- aliases comuns aos idiomas;
- grupos primário/secundários e equipamento;
- vídeo URL/search query;
- status `approved | community | rejected` e `created_by`;
- contribuições via RPC autenticada;
- busca PT/EN/aliases, filtros por grupo/equipamento, preview e localização;
- relação de variação/movement pattern proposta em migration, sem inferência
  automática.

### 7.2 Gaps editoriais

1. aliases separados por idioma;
2. difficulty e padrão editorial completo;
3. erros comuns PT/EN;
4. thumbnail;
5. substituições curadas por equipamento/movimento;
6. origem, licença, autor, URL de licença e aprovação de cada asset;
7. reviewed_by/reviewed_at e processo de moderação;
8. curadoria humana dos nomes ingleses legados e contribuições atuais;
9. painel/fluxo admin seguro;
10. tipos Supabase gerados para planos/catálogo/recordes.

Risco atual: a policy de leitura do catálogo permite `approved` e `community`
para clientes autenticados. Uma contribuição retorna imediatamente e também
pode continuar visível após refresh. Para uma biblioteca “aprovada”, a policy
deve ser `approved OR created_by = auth.uid()`; moderação global não pode ficar
aberta a usuário comum.

### 7.3 Gaps de sequências

- nenhuma tabela `workout_plan_sequences`/itens;
- nenhum vínculo e posição explícita dos planos;
- nenhum CRUD owner-only;
- nenhuma UI PPL/ABC/Upper-Lower;
- nenhum teste de ownership, posição duplicada ou plano de outro usuário;
- o recomendador só consegue aprender transições históricas, não obedecer uma
  sequência configurada.

### 7.4 Migrations/RPCs recomendadas

Separar em duas migrations/releases:

1. `expand_workout_catalog_editorial`
   - aliases PT/EN, difficulty, common mistakes, thumbnail e revisão;
   - tabela de assets/licenças ou campos explícitos de proveniência;
   - tabela curada de substituições, sem self-link e com índices nos dois lados;
   - policy approved/creator e grants mínimos.
2. `create_workout_plan_sequences`
   - sequência owner-only;
   - itens com posição única e FK para plano;
   - trigger que exige mesmo dono da sequência e plano;
   - índices por user e ordem.

Curadoria deve usar Edge Function/admin service ou função privada com claim de
moderador verificável. Não expor update/approve direto ao authenticated comum.

### 7.5 Arquivos prováveis

- migrations editoriais/sequence;
- `useWorkoutCatalog.ts`, tipos sociais e localization/filters;
- `WorkoutCatalogInfoSheet.tsx`, picker/editor de plano;
- novo fluxo/painel de curadoria separado da UI comum;
- `useWorkoutPlans.ts`, novo `useWorkoutPlanSequences.ts`;
- hub/editor de sequências;
- i18n e database types regenerados.

### 7.6 Testes obrigatórios

- RLS approved, creator, outro usuário e moderador;
- contribuição não é aprovada automaticamente;
- locale/aliases separados e fallback;
- URL sem licença não pode virar asset aprovado;
- fallback sem vídeo/thumbnail;
- variação sem inferência, ciclo e pai apagado;
- substituição curada, self-link e duplicidade;
- sequência owner-only, ordem única, reordenação e plano apagado;
- plano de outro usuário rejeitado;
- recomendador respeita sequência explícita;
- smoke de catálogo PT/EN no Capacitor.

### 7.7 Bloqueadores de produção

- migration de variações validada antes do web que seleciona as colunas;
- inventário/licença de qualquer mídia publicada;
- policy editorial corrigida;
- processo real de aprovação e rollback de conteúdo;
- sequência não pode misturar owners;
- curadoria e sequence devem ter releases separáveis.

## 8. Prioridade e ordem de implementação

### P0 — fundação antes de D–G

1. Validar/aplicar Sprint 0.
2. Validar/aplicar A (activity ↔ plan/snapshots/favorite).
3. Integrar/aplicar B (status/source/load type) e garantir que o cliente grave
   os campos.
4. Validar canonicalização de PR e variações em preview.

### P1 — valor imediato confiável

5. Sprint D: highlight imutável + resumo; depois card social.
6. Sprint E: stats agregadas + favorite + detalhe do plano.
7. Sprint F: recomendador V1 integrado e explicável.

### P2 — catálogo premium

8. G1: schema/policy/pipeline editorial sem mídia não licenciada.
9. G2: curadoria real de traduções, variações, substituições e assets.
10. G3: sequências de planos e integração ao recomendador.

## 9. Matriz de rollout para produção

| Etapa | Banco | Web | Gate |
|---|---|---|---|
| 0/A/B | migrations aditivas + RLS | cliente compatível/fallback | SQL preview, types, testes, iPhone |
| D1 | highlights/RPC | resumo pós-treino | dados válidos e idempotência |
| D2 | sem mudança ou relação post/highlight | card social/opt-out | duas contas e post histórico |
| E | stats RPC | cards/detalhe/favorito | reconciliar SQL × activities |
| F | nenhuma ou contexto RPC | sugestão/dismiss | baixa amostra e copy |
| G1 | editorial/RLS | leitura com fallback | catálogo continua disponível |
| G2 | conteúdo aprovado | preview/substituição | licença e revisão |
| G3 | sequences/RLS | editor + scorer | ownership e ordem |

Para cada etapa: `dry-run/preview → SQL de validação → advisors/RLS → testes
web → deploy compatível → smoke autenticado → monitoramento`. Não agrupar todas
as migrations e toda a UI num único corte irreversível.

## 10. Bloqueadores gerais de produção

- Docker/ambiente local ou projeto preview disponível para executar migrations
  e testes SQL; apenas lint de arquivo não valida trigger/RLS.
- Confirmação do projeto Supabase vinculado antes de qualquer `db push`.
- Ordem expand/migrate/contract e fallback para colunas/RPC ausentes.
- Regeneração de `packages/core/src/database.types.ts` após migrations.
- `lint`, `tsc`, testes, build e `git diff --check` verdes.
- stage seletivo: nunca incluir `android/`, projeto SwiftUI, `config 2.xml`,
  secrets, `.p8`, provisioning ou mudanças de signing.
- QA autenticado em iPhone/Capacitor com troca de conta, teclado, safe area,
  background, offline, retomar sessão e logout/login.
- Smoke social com autor e segundo usuário para PR/card/privacidade.
- Observação pós-release de erros Supabase, latência da RPC e abandono do fluxo.

## 11. Critério de conclusão por sprint

Uma Sprint D–G só está concluída quando:

1. schema/RPC e cliente estão integrados;
2. migrations estão aplicadas no ambiente correto e validadas;
3. RLS/grants foram testados com papéis/usuários distintos;
4. dados legados têm fallback explícito;
5. unitários, integração, build e smoke autenticado estão verdes;
6. a feature aparece na UI e seu CTA executa o fluxo real;
7. documentação registra versão, rollout e pendências;
8. produção foi monitorada após o deploy.

Arquivos puros, migrations vazias/locais ou componentes não conectados não
contam como sprint entregue.
