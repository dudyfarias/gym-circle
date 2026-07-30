# Running Session Engine

Data: 2026-07-24
Status: implementado localmente; não publicado

## Objetivo

O `RunningSessionEngine` é a camada determinística que transforma um
`RunningWorkoutPlan` salvo em uma sessão guiada. Ele não conhece React, banco,
GPS nativo, áudio ou Apple Watch. Recebe observações normalizadas e devolve um
novo estado mais eventos.

## Auditoria da base atual

- A corrida livre é iniciada em `WebWorkoutScreen` e usa o mesmo
  `StoredWorkoutSession` das demais modalidades.
- O cronômetro usa `startedAtMs`, `pausedAtMs` e `pausedTotalMs`; ele não depende
  da frequência de renderização.
- A rota, distância, moving time e elevação continuam sob responsabilidade de
  `workoutSession.ts` e `WorkoutLocationBridge`.
- Em iOS, a ponte nativa pode continuar capturando em background. Na web, o
  watcher existente continua sendo o fallback.
- A sessão é persistida no `localStorage` por usuário. A versão 5 agora aceita
  opcionalmente o snapshot do engine guiado.
- A finalização continua criando uma `activity` canônica com
  `activity_type = run`, rota e métricas do pipeline outdoor existente.
- Os planos estruturados são lidos de `workout_plans` e
  `workout_plan_steps`. O engine congela um snapshot do plano no início.

## Responsabilidades

- expandir steps, repetições e recuperações em segmentos executáveis;
- iniciar, pausar, retomar, concluir, pular, voltar, finalizar e cancelar;
- avançar automaticamente por duração ou distância;
- calcular progresso do segmento e do plano;
- comparar o pace atual com o intervalo alvo;
- produzir resultados reais por segmento;
- emitir eventos sanitizados para analytics e integrações futuras;
- restaurar e validar uma sessão persistida.

O engine não:

- inicia um segundo GPS;
- grava diretamente no Supabase;
- solicita HealthKit;
- produz áudio ou haptics;
- inventa FC, pace, distância ou duração ausentes.

## Observação de entrada

```ts
type RunningSessionObservation = {
  atMs: number;
  elapsedS: number;
  distanceM: number;
  currentPaceSPerKm?: number | null;
  heartRate?: number | null;
};
```

`elapsedS` e `distanceM` são totais da atividade. O engine guarda os totais no
início de cada segmento e calcula deltas. Observações repetidas ou atrasadas
(`atMs <= lastObservationAtMs`) são ignoradas.

## Persistência e resiliência

O estado completo é serializável e fica em `StoredWorkoutSession.guidedRunning`.
Ao restaurar, a versão, o plano, os segmentos, a posição ativa e o status são
validados. Um estado inválido não é assumido silenciosamente.

Timers nunca são incrementados por contagem de ticks. Ao voltar do background,
o tempo é recalculado a partir do relógio da sessão. Rerenders não reiniciam o
segmento.

## Limitação deliberada desta sprint

Não foi criada migration de `running_sessions` ou de resultados por etapa.
Nesta etapa:

- o estado guiado é durável localmente enquanto a sessão está ativa;
- a activity final preserva o vínculo e snapshot de versão do plano;
- o resumo por etapa existe no resultado local pós-treino;
- persistência histórica detalhada por etapa fica para um release gate com
  schema/RLS próprios.

Essa decisão evita misturar uma migration nova à Sprint C e mantém corrida
livre, caminhada, bike e musculação inalteradas.
