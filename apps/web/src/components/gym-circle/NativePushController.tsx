"use client";

import { useEffect } from "react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { PushNotificationsService } from "./native/PushNotificationsService";

type NativePushControllerProps = {
  userId: string;
};

/**
 * Foundation nativa: não pede permissão automaticamente.
 * Se o usuário já concedeu permissão no iOS, registra/renova o token
 * alguns segundos depois do boot para não disputar a primeira tela útil.
 */
export function NativePushController({ userId }: NativePushControllerProps) {
  const services = useGymCircleServices();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void PushNotificationsService.registerPushToken(userId, services.push).catch(
        () => undefined,
      );
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [services.push, userId]);

  return null;
}
