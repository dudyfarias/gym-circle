import { useSyncExternalStore } from "react";

import { Capacitor } from "@capacitor/core";

export type GymCircleRuntimePlatform = "web" | "ios" | "android";

export type GymCirclePlatformCapabilities = {
  appleHealthImport: boolean;
  backgroundOutdoorTracking: boolean;
  nativePush: boolean;
  platform: GymCircleRuntimePlatform;
};

export function resolvePlatformCapabilities(
  platform: GymCircleRuntimePlatform,
  options: { androidPushEnabled?: boolean } = {},
): GymCirclePlatformCapabilities {
  return {
    appleHealthImport: platform === "ios",
    backgroundOutdoorTracking: platform === "ios",
    nativePush:
      platform === "ios" ||
      (platform === "android" && options.androidPushEnabled === true),
    platform,
  };
}

const WEB_CAPABILITIES = resolvePlatformCapabilities("web");
const IOS_CAPABILITIES = resolvePlatformCapabilities("ios");
const ANDROID_CAPABILITIES = resolvePlatformCapabilities("android", {
  // Só habilitar depois que app Firebase, registro FCM e sender Android
  // estiverem configurados juntos. Evita oferecer um toggle sem backend.
  androidPushEnabled: process.env.NEXT_PUBLIC_ANDROID_PUSH_ENABLED === "true",
});

export function getPlatformCapabilities(): GymCirclePlatformCapabilities {
  const capacitorPlatform = Capacitor.isNativePlatform()
    ? Capacitor.getPlatform()
    : "web";

  if (capacitorPlatform === "ios") return IOS_CAPABILITIES;
  if (capacitorPlatform === "android") return ANDROID_CAPABILITIES;
  return WEB_CAPABILITIES;
}

const subscribeToStaticPlatform = () => () => undefined;

export function usePlatformCapabilities(): GymCirclePlatformCapabilities {
  // A plataforma não muda durante a vida do app. useSyncExternalStore mantém
  // o snapshot web no servidor e resolve o snapshot nativo após a hidratação,
  // sem setState em effect nem divergência de HTML.
  return useSyncExternalStore(
    subscribeToStaticPlatform,
    getPlatformCapabilities,
    () => WEB_CAPABILITIES,
  );
}
