# Running Session Events

Data: 2026-07-24

## Contrato

O engine produz eventos internos. A ponte web publica apenas:

```ts
{
  eventId: string;
  type: RunningSessionEventType;
  messageKey: string | null;
}
```

Não são publicados usuário, coordenadas, endereço, nome/instruções do plano ou
payload de GPS.

## Eventos

| Evento | Uso atual/futuro |
|---|---|
| `running_started` | analytics e abertura do coach |
| `running_paused` | analytics/áudio futuro |
| `running_resumed` | analytics/áudio futuro |
| `step_started` | UI, áudio, Watch e Live Activity futuros |
| `step_completed` | progresso e resultado |
| `step_skipped` | resultado e feedback |
| `step_transition` | preparação da próxima etapa |
| `pace_high` | feedback de ritmo |
| `pace_low` | feedback de ritmo |
| `interval_start` | haptic/áudio futuro |
| `recovery_start` | haptic/áudio futuro |
| `motivation` | mensagem contextual traduzível |
| `running_finished` | resumo e compartilhamento |
| `workout_cancelled` | analytics de abandono |
| `running_error` | observabilidade sem PII |

## Consumidores futuros

- narração e fones Bluetooth;
- haptics;
- Apple Watch e Wear OS;
- Live Activities/Dynamic Island;
- coach supervisionado;
- dashboards de assessoria.

Esses consumidores devem observar o contrato. Não devem importar lógica de
progressão para criar máquinas paralelas.
