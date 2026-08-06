import type { NotificationRow } from "@gym-circle/core";

export function collectNotificationActorIds(items: NotificationRow[]): string[] {
  return Array.from(
    new Set(
      items
        .map((notification) => notification.actor_id)
        .filter((actorId): actorId is string => Boolean(actorId)),
    ),
  );
}

/**
 * Junta os actors hidratados sob demanda com o dicionário de users do social.
 *
 * O hidratado vem de uma linha de `profiles`, que não conhece relação de
 * follow — ele nasce com `followStatus: "none"`. Por isso ele só PREENCHE
 * lacunas: se o social já conhece o user, o estado real vence. Deixar o
 * esqueleto sobrescrever fazia o CTA de follow-back mostrar "Seguir" para
 * quem o usuário já seguia.
 */
export function mergeNotificationActors<T>(
  users: Record<string, T>,
  hydrated: Record<string, T>,
): Record<string, T> {
  return { ...hydrated, ...users };
}
