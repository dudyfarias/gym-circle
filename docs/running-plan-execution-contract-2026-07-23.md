# Running Plan Execution Contract — 2026-07-23

## Objetivo

Este contrato descreve como uma sprint futura executará os mesmos
`workout_plan_steps`. Não cria tabelas de sessão agora.

## Snapshot no início

Ao iniciar um plano, a futura sessão deve congelar:

- `workout_plan_id`;
- `plan_version`;
- nome, nível, objetivo e origem;
- lista ordenada completa de steps;
- targets e recuperações.

Editar o plano depois do início não altera uma sessão ativa ou activity antiga.

## Máquina de estado

Sessão:

- `pending`;
- `active`;
- `paused`;
- `completed`;
- `discarded`.

Resultado de bloco:

- `pending`;
- `active`;
- `paused`;
- `completed`;
- `skipped`.

Cada bloco deve suportar iniciar, pausar, completar, pular, repetir e avançar
manual ou automaticamente. Autoavanço nunca deve impedir controle manual.

## Dados reais

Um futuro `running_session_step_results` deverá guardar, no mínimo:

- step/snapshot identificado;
- posição;
- status;
- timestamps;
- tempo real;
- distância real;
- pace médio;
- FC média quando autorizada;
- esforço informado.

Prescrição e resultado nunca devem ser sobrescritos um pelo outro.

## Repetições e recuperação

Um step com `repetitions = 6` representa seis execuções do alvo e cinco
recuperações entre elas. A execução deve identificar a repetição atual e nunca
criar recuperação depois da última repetição.

Recuperação pode terminar por:

- duração;
- distância;
- ação manual;
- condição futura autorizada.

## GPS e background

Corrida estruturada deve reutilizar o pipeline outdoor atual. A máquina de
steps é uma camada acima da captura, não um segundo GPS. Bloquear tela,
background, pausa e retomada devem preservar rota e step atual.

## Atividade final

A activity futura continua com `activity_type = run` e recebe:

- vínculo e snapshot do plano;
- resultados reais;
- rota, distância e duração do pipeline atual;
- source/origin verdadeiro.

O feed pode usar os totais da activity. Detalhes por bloco são privados por
padrão até uma decisão explícita de compartilhamento.

## Importação futura

Texto, imagem, PDF ou profissional devem produzir
`RunningPlanImportDraft`, mostrar warnings/confidence e terminar no mesmo
`RunningWorkoutPlanDraft` usado pelo editor. Nada é salvo sem revisão.

## Próxima migration possível

Somente na sprint de execução guiada avaliar:

- `running_sessions`;
- `running_session_step_results`;
- snapshot imutável;
- resume token/local persistence;
- RLS owner-only;
- idempotência de finalização.
