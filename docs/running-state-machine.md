# Running State Machine

Data: 2026-07-24

## Estados

```text
idle
  -> starting
  -> running
       -> paused -> running
       -> step_completed
       -> transition -> running
       -> finished
       -> cancelled
       -> error
```

O estado persistido contém uma única propriedade `status`. A UI não deriva a
máquina de combinações independentes de booleanos.

## Status dos segmentos

Os segmentos futuros são `pending`; o índice ativo identifica o segmento em
execução. Ao sair dele, um resultado imutável registra:

- `completed` ou `skipped`;
- início e fim;
- duração real;
- distância real;
- pace médio calculável.

Uma pausa não produz resultado intermediário nem altera a meta.

## Transições principais

| Ação/condição | Origem | Destino | Efeito |
|---|---|---|---|
| iniciar plano válido | idle | running | snapshot, evento de início e primeiro step |
| pausar | running/transition | paused | mantém posição e progresso |
| retomar | paused | running | recalcula a partir do relógio canônico |
| meta atingida | running | transition/finished | grava resultado do segmento |
| concluir manualmente | running/paused | transition/finished | fallback explícito |
| pular | running/paused | transition/finished | resultado `skipped` |
| voltar | sessão ativa | transition | remove resultado anterior reaberto |
| encerrar | sessão ativa | finished | consolida segmento atual |
| descartar | sessão ativa | cancelled | emite cancelamento e remove storage |
| plano inválido | idle | error | não inicia GPS guiado |

## Conclusão automática

- duração: delta de segundos do segmento atinge `targetDurationS`;
- distância: delta em metros atinge `targetDistanceM`;
- ranges: o limite superior é usado como alvo seguro de autoavanço;
- recuperação: usa duração ou distância normalizada;
- último segmento: muda diretamente para `finished`.

O avanço manual permanece disponível.

## Invariantes

- um snapshot de plano não muda durante a sessão;
- apenas um segmento está ativo;
- cada `segmentId` tem no máximo um resultado;
- distância e duração nunca são negativas;
- observações antigas não alteram o estado;
- a origem do GPS não muda as regras do engine;
- nenhuma transição depende de um render específico.
