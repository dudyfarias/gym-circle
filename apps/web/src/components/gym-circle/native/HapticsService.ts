"use client";

export type HapticLevel =
  | "light"
  | "medium"
  | "success"
  | "warning"
  | "error"
  | "selection";

const fallbackPatterns: Record<HapticLevel, number[]> = {
  light: [8],
  medium: [14],
  success: [12, 24, 12],
  warning: [16, 26, 10],
  error: [22, 35, 22],
  selection: [6],
};

function vibrateFallback(level: HapticLevel) {
  if (typeof window === "undefined" || !("navigator" in window)) return;
  const vibrate = window.navigator.vibrate;
  if (typeof vibrate === "function") {
    vibrate.call(window.navigator, fallbackPatterns[level]);
  }
}

// Cache module-level dos dynamic imports do Capacitor. Sem isso, cada chamada
// (Haptics pode disparar dezenas de vezes em ações burst — swipe, scrub) faria
// 2 dynamic imports. Bundler cacheia internamente, mas o lookup de Promise
// ainda tem overhead. Cache aqui evita tanto o lookup quanto múltiplas
// criações de Promise no path quente.
type NativeHapticModules = {
  Capacitor: typeof import("@capacitor/core").Capacitor;
  haptics: typeof import("@capacitor/haptics");
};
let cachedNativeModules: Promise<NativeHapticModules | null> | null = null;

function loadNativeHapticModules(): Promise<NativeHapticModules | null> {
  if (cachedNativeModules) return cachedNativeModules;
  cachedNativeModules = Promise.all([
    import("@capacitor/core"),
    import("@capacitor/haptics"),
  ])
    .then(([core, haptics]) => ({ Capacitor: core.Capacitor, haptics }))
    .catch(() => null);
  return cachedNativeModules;
}

async function runNativeHaptic(level: HapticLevel): Promise<boolean> {
  try {
    const loaded = await loadNativeHapticModules();
    if (!loaded) return false;
    const { Capacitor, haptics } = loaded;
    if (!Capacitor.isNativePlatform()) return false;

    if (level === "selection") {
      await haptics.Haptics.selectionChanged();
      return true;
    }

    if (level === "success" || level === "warning" || level === "error") {
      const notificationType =
        level === "success"
          ? haptics.NotificationType.Success
          : level === "warning"
            ? haptics.NotificationType.Warning
            : haptics.NotificationType.Error;
      await haptics.Haptics.notification({ type: notificationType });
      return true;
    }

    await haptics.Haptics.impact({
      style:
        level === "medium"
          ? haptics.ImpactStyle.Medium
          : haptics.ImpactStyle.Light,
    });
    return true;
  } catch {
    return false;
  }
}

async function play(level: HapticLevel) {
  const didPlayNative = await runNativeHaptic(level);
  if (!didPlayNative) vibrateFallback(level);
}

export const HapticsService = {
  light: () => play("light"),
  medium: () => play("medium"),
  success: () => play("success"),
  warning: () => play("warning"),
  error: () => play("error"),
  selection: () => play("selection"),
  play,
};
