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
