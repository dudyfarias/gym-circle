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

async function runNativeHaptic(level: HapticLevel): Promise<boolean> {
  try {
    const [{ Capacitor }, haptics] = await Promise.all([
      import("@capacitor/core"),
      import("@capacitor/haptics"),
    ]);
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
