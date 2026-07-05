"use client";

import { useEffect } from "react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { PushNotificationsService } from "./native/PushNotificationsService";

type NativePushControllerProps = {
  userId: string;
};

/**
 * Driver nativo de push notifications.
 *
 * 1. Foundation: não pede permissão automaticamente. Se o usuário já
 *    concedeu permissão no iOS, registra/renova o token alguns segundos
 *    depois do boot para não disputar a primeira tela útil.
 *
 * 2. Sprint 10.3 — runtime listeners:
 *    - `pushNotificationReceived` (app aberto): dispatch DOM event
 *      `gymcircle:push-received` pra componentes interessados (toast,
 *      haptic, refresh local).
 *    - `pushNotificationActionPerformed` (user tocou notificação no SO):
 *      dispatch `gymcircle:push-action` com payload. Layouts top-level
 *      podem navegar (achievements → AchievementsSheet, challenge →
 *      MyCircleSheet, message → ChatScreen).
 *
 *    Roteamento concreto fica em listeners externos pra manter este
 *    componente desacoplado.
 */
export function NativePushController({ userId }: NativePushControllerProps) {
  const services = useGymCircleServices();

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const syncToken = async (attempt: number) => {
      const result = await PushNotificationsService.registerPushToken(
        userId,
        services.push,
      );
      if (cancelled || result.status !== "failed" || attempt >= 2) return;

      // APNs pode demorar no primeiro boot/rede móvel. Repetimos com backoff
      // sem abrir novamente o prompt de permissão.
      timer = window.setTimeout(
        () => void syncToken(attempt + 1),
        attempt === 0 ? 15_000 : 45_000,
      );
    };

    timer = window.setTimeout(() => void syncToken(0), 2_500);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [services.push, userId]);

  // Sprint 10.3 — runtime listeners (push received + action tap).
  // Roda só em native (Capacitor isNativePlatform); web fica no-op.
  useEffect(() => {
    let receivedHandle: { remove: () => void } | null = null;
    let actionHandle: { remove: () => void } | null = null;
    let cancelled = false;

    async function attachListeners() {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );
        if (cancelled) return;

        receivedHandle = await PushNotifications.addListener(
          "pushNotificationReceived",
          (notification) => {
            // Dispatch DOM event — componentes top-level decidem o que fazer.
            // CustomEvent.detail carrega o payload completo (data + notification).
            window.dispatchEvent(
              new CustomEvent("gymcircle:push-received", {
                detail: notification,
              }),
            );
          },
        );

        actionHandle = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            window.dispatchEvent(
              new CustomEvent("gymcircle:push-action", {
                detail: action,
              }),
            );
          },
        );
      } catch {
        // ignore: plugin ausente ou não autorizado é cenário esperado.
      }
    }

    void attachListeners();

    return () => {
      cancelled = true;
      receivedHandle?.remove();
      actionHandle?.remove();
    };
  }, []);

  return null;
}
