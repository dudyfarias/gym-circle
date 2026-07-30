import type { RunningSessionEvent } from "@gym-circle/core/domain";

export const RUNNING_SESSION_EVENT_NAME = "gymcircle:running-session-event";

/**
 * Contrato local para analytics, áudio, haptics e wearables.
 *
 * O evento não contém coordenadas, endereço, nome do plano, instruções nem
 * qualquer identificador do usuário. Consumidores futuros recebem somente o
 * tipo de transição e a categoria opcional da mensagem.
 */
export function emitRunningSessionEvents(events: RunningSessionEvent[]) {
  if (typeof window === "undefined") return;
  for (const event of events) {
    window.dispatchEvent(
      new CustomEvent(RUNNING_SESSION_EVENT_NAME, {
        detail: {
          eventId: event.id,
          type: event.type,
          messageKey: event.messageKey ?? null,
        },
      }),
    );
  }
}
