"use client";

import { useEffect } from "react";

const BOOT_LOG_PREFIX = "[GymCircleBoot]";

type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: {
    SplashScreen?: {
      hide?: (options?: { fadeOutDuration?: number }) => Promise<void>;
    };
  };
};

type CapacitorWindow = Window & {
  Capacitor?: CapacitorBridge;
};

function unlockDocument() {
  document.documentElement.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("pointer-events");
  document.documentElement.style.removeProperty("opacity");
  document.body.style.removeProperty("overflow");
  document.body.style.removeProperty("pointer-events");
  document.body.style.removeProperty("opacity");
}

async function hideNativeSplash(reason: string) {
  try {
    const capacitor = (window as CapacitorWindow).Capacitor;
    const isNative =
      capacitor?.isNativePlatform?.() ??
      (typeof capacitor?.getPlatform === "function" && capacitor.getPlatform() !== "web");

    if (!isNative) {
      console.info(`${BOOT_LOG_PREFIX} splash hide skipped: browser`, { reason });
      return;
    }

    const splashScreen = capacitor?.Plugins?.SplashScreen;
    if (!splashScreen?.hide) {
      console.info(`${BOOT_LOG_PREFIX} splash hide skipped: plugin unavailable`, {
        reason,
      });
      return;
    }

    await splashScreen.hide({ fadeOutDuration: 220 });
    console.info(`${BOOT_LOG_PREFIX} splash hidden`, { reason });
  } catch (error) {
    console.warn(`${BOOT_LOG_PREFIX} splash hide failed`, { error, reason });
  }
}

export function NativeBootController() {
  useEffect(() => {
    console.info(`${BOOT_LOG_PREFIX} app mounted`);
    unlockDocument();

    const earlyTimer = window.setTimeout(() => {
      unlockDocument();
      void hideNativeSplash("mounted-timeout");
    }, 700);

    const safetyTimer = window.setTimeout(() => {
      unlockDocument();
      void hideNativeSplash("safety-timeout");
    }, 3200);

    const onLoad = () => {
      unlockDocument();
      void hideNativeSplash("window-load");
    };

    window.addEventListener("load", onLoad, { once: true });
    void hideNativeSplash("mounted");

    return () => {
      window.clearTimeout(earlyTimer);
      window.clearTimeout(safetyTimer);
      window.removeEventListener("load", onLoad);
    };
  }, []);

  return null;
}
