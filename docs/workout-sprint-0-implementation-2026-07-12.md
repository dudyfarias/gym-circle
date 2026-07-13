# Sprint 0 — sessão, privacidade e idempotência

Data: 2026-07-12
Status: implementada localmente; migration não aplicada; sem commit, push ou deploy.

## Objetivo

Remover quatro riscos anteriores às sprints de dados e progresso:

1. restaurar o treino de outra conta no mesmo aparelho;
2. criar activities duplicadas quando a resposta da finalização se perde;
3. exibir no feed uma activity que o usuário salvou sem publicar;
4. atrasar ou congelar o descanso quando o WebView fica em background.

## Implementação

### Sessão local isolada

- storage passou de `gc-web-workout` para `gc-web-workout:{userId}`;
- o payload v5 guarda `ownerUserId` e rejeita owner divergente;
- a chave global v4, sem dono verificável, é removida em vez de ser atribuída à
  conta que estiver aberta;
- cada sessão recebe um UUID `clientSessionId` no momento em que começa;
- séries, rota, pausas e timer de descanso continuam no mesmo rascunho.

### Finalização idempotente

- o web envia o mesmo `clientSessionId` em todo retry;
- `activityService.create` chama `finalize_workout_activity` quando há esse ID;
- o RPC retorna a activity existente ou cria uma única linha;
- índice parcial único protege `(user_id, client_session_id)` também em corrida
  concorrente;
- o rascunho só é limpo depois de uma resposta bem-sucedida;
- há fallback temporário para insert legado somente quando o RPC ainda não
  existe, permitindo rollout expand-first. Falhas reais de rede, RLS ou payload
  não são mascaradas.

### Publicação explícita

- activities existentes são retrocompatibilizadas como `shared`;
- activities novas nascem `private`;
- a activity só muda para `shared` quando existe um post com
  `source_activity_id`;
- excluir o último post volta a activity para `private` sem apagar o histórico;
- `get_home_activities` exclui privadas, inclusive do feed do próprio dono;
- RLS permite ao dono ler seu histórico privado e a seguidores ler apenas uma
  activity compartilhada;
- policy e trigger impedem o cliente de marcar uma activity como compartilhada
  sem post.

### Descanso resiliente

- o timer persiste `endsAtMs` absoluto;
- tick, pausa, retomada e ajuste derivam o restante do relógio real;
- minimizar e voltar não acumula atraso do `setInterval`;
- estado do descanso é salvo dentro da sessão e restaurado após reabrir.

Limite conhecido: um WebView suspenso não garante som enquanto a tela está
bloqueada. A contagem estará correta ao retomar, mas aviso confiável em lock
screen exige Local Notifications/bridge nativo e validação em TestFlight.

## Migration preparada

Arquivo:

`supabase/migrations/20260713012108_harden_workout_session_finalization.sql`

Ela é aditiva e contém:

- `activities.client_session_id`;
- `activities.publication_state`;
- backfill preservando activities antigas como compartilhadas;
- constraint e índice único parcial;
- policies RLS revisadas;
- guard de integridade do estado de publicação;
- RPC `finalize_workout_activity(uuid, jsonb)` com `security invoker`;
- triggers de sincronização post/activity;
- filtro da RPC `get_home_activities`.

A migration não foi aplicada em produção. Docker não estava disponível para
subir o Supabase local, portanto a validação SQL em banco preview continua
obrigatória antes da aplicação.

## Testes automatizados

Cobertura adicionada:

- isolamento A/B no storage;
- rejeição da sessão global legada sem owner;
- restore de séries e timer;
- deadline após suspensão;
- pausa, retomada e ajuste do descanso;
- RPC idempotente no serviço;
- fallback somente para RPC ausente;
- propagação de falha RLS real.

## QA bloqueante antes de produção

1. aplicar a migration em preview;
2. testar RLS com duas contas;
3. A inicia treino, sai, B entra e não vê o treino de A;
4. A volta e restaura o próprio treino;
5. simular resposta perdida e finalizar duas vezes: uma única activity;
6. salvar sem publicar: aparece no histórico do dono e não no feed;
7. publicar: post aparece e activity é hidratada;
8. excluir post: activity volta a privada;
9. background/force quit durante descanso e sessão;
10. validar feed, streak, detalhe e integração de activity;
11. rodar advisors e regenerar tipos depois da migration;
12. smoke autenticado no iPhone/TestFlight.

## Ordem segura de rollout

1. preview + testes SQL/RLS;
2. aplicar migration aditiva;
3. confirmar RPC no schema cache;
4. publicar web;
5. smoke com duas contas;
6. observar erros/duplicidades e então remover o fallback legado em sprint
   posterior.

## Próximas sprints

1. **Sprint A — activity ↔ treino salvo:** plan ID, snapshots, favorito e
   estatísticas derivadas de uso.
2. **Sprint B — séries semânticas e carga:** planned/completed/skipped/added,
   `load_type` e volume correto.
3. **Sprint C — contexto de execução:** notas, RPE/RIR e descanso alvo/real.
4. **Sprint D — PR e pós-treino social:** PRs válidos, highlights e card social.
5. **Sprint E — evolução do treino:** vezes feito, última execução, duração,
   volume e conclusão.
6. **Sprint F — sugestão do dia:** regras explicáveis baseadas em histórico.
7. **Sprint G — catálogo:** traduções, aliases, variações, instruções e mídia
   própria/licenciada.
