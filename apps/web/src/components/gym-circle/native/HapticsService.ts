"use client";

import { Capacitor } from "@capacitor/core";

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

// O runtime precisa ser identificado antes de carregar o plugin de haptics.
// Carregar @capacitor/haptics no path web do primeiro toque criava um chunk
// assíncrono desnecessário e podia bloquear o renderer antes do callback do
// botão (o Perfil ficava completamente sem interação). O core já faz parte do
// shell Capacitor; o plugin pesado continua lazy e só existe no path nativo.
type NativeHapticModule = typeof import("@capacitor/haptics");
let cachedNativeModule: Promise<NativeHapticModule | null> | null = null;

function loadNativeHapticModule(): Promise<NativeHapticModule | null> {
  if (cachedNativeModule) return cachedNativeModule;
  cachedNativeModule = import("@capacitor/haptics").catch(() => null);
  return cachedNativeModule;
}

async function runNativeHaptic(level: HapticLevel): Promise<boolean> {
  // A checagem síncrona é intencional: no web, nenhum import assíncrono do
  // plugin deve acontecer entre o click e a ação principal do botão.
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const haptics = await loadNativeHapticModule();
    if (!haptics) return false;

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
