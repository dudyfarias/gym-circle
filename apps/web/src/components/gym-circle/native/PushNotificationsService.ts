"use client";

import type { PushService } from "@gym-circle/core";
import {
  extractPushNotificationData,
  normalizePushNavigationTarget,
} from "./pushDeepLinks";

const LEGACY_TOKEN_KEY = "gym-circle.native-push-token.v1";
const TOKEN_KEY = "gym-circle.native-push-token.v2";
const DEVICE_ID_KEY = "gym-circle.native-device-id.v1";
const DEFAULT_APP_VERSION = "1.1.0";

export const PUSH_ENABLED_CHANGE_EVENT = "gymcircle:push-enabled-change";

export type NativePushPermissionStatus =
  | "unsupported"
  | "prompt"
  | "prompt-with-rationale"
  | "granted"
  | "denied";

export type NativePushRegisterResult =
  | { status: "unsupported" }
  | { status: "permission_denied" }
  | { status: "registered"; token: string }
  | { status: "failed"; error: unknown };

type NativePlatform = "ios" | "android";
type StoredToken = { token: string; userId: string | null };
type ListenerHandle = { remove: () => Promise<void> };
type ListenerSession = {
  id: number;
  userId: string;
  push: PushService;
  handles: ListenerHandle[];
};

let listenerSequence = 0;
let activeListenerSession: ListenerSession | null = null;

function debugEnabled() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_PERF_DEBUG === "true"
  );
}

function maskToken(token: string) {
  if (token.length <= 12) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

function debugLog(
  level: "info" | "warn",
  event: string,
  details?: Record<string, unknown>,
) {
  if (!debugEnabled()) return;
  const logger = level === "warn" ? console.warn : console.info;
  logger(`[push] ${event}`, details ?? {});
}

async function getNativePlatform(): Promise<NativePlatform | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (
      !Capacitor.isNativePlatform() ||
      !Capacitor.isPluginAvailable("PushNotifications")
    ) {
      return null;
    }
    const platform = Capacitor.getPlatform();
    return platform === "ios" || platform === "android" ? platform : null;
  } catch {
    return null;
  }
}

function readStoredToken(): StoredToken | null {
  if (typeof window === "undefined") return null;
  try {
    const current = window.localStorage.getItem(TOKEN_KEY);
    if (current) {
      const parsed = JSON.parse(current) as Partial<StoredToken>;
      if (typeof parsed.token === "string" && parsed.token.length > 0) {
        return {
          token: parsed.token,
          userId: typeof parsed.userId === "string" ? parsed.userId : null,
        };
      }
    }
    const legacy = window.localStorage.getItem(LEGACY_TOKEN_KEY);
    return legacy ? { token: legacy, userId: null } : null;
  } catch {
    return null;
  }
}

function storeToken(token: string, userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, userId }));
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // Storage indisponível não invalida o token já salvo no Supabase.
  }
}

function clearStoredToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore
  }
}

function publishPushEnabledState(enabled: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("gc-push-enabled", String(enabled));
  } catch {
    // O token no Supabase continua sendo o estado autoritativo.
  }
  window.dispatchEvent(
    new CustomEvent(PUSH_ENABLED_CHANGE_EVENT, {
      detail: { enabled },
    }),
  );
}

function stableDeviceId(): string {
  if (typeof window === "undefined") return "unknown";
  try {
    const existing = window.localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `gc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return "unavailable";
  }
}

async function removeListenerSession(session: ListenerSession | null) {
  if (!session) return;
  await Promise.allSettled(session.handles.map((handle) => handle.remove()));
  if (activeListenerSession?.id === session.id) {
    activeListenerSession = null;
  }
}

async function waitForNativeToken(): Promise<string> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  let registrationHandle: ListenerHandle | null = null;
  let errorHandle: ListenerHandle | null = null;

  let resolveToken!: (value: string) => void;
  let rejectToken!: (reason: unknown) => void;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const timer = window.setTimeout(
    () => rejectToken(new Error("push_registration_timeout")),
    20_000,
  );

  try {
    registrationHandle = await PushNotifications.addListener(
      "registration",
      (token) => resolveToken(token.value),
    );
    errorHandle = await PushNotifications.addListener(
      "registrationError",
      (error) => rejectToken(new Error(error.error)),
    );
    await PushNotifications.register();
    return await tokenPromise;
  } finally {
    window.clearTimeout(timer);
    await Promise.allSettled([
      registrationHandle?.remove(),
      errorHandle?.remove(),
    ]);
  }
}

async function revokeStoredToken(
  userId: string,
  push: PushService,
): Promise<boolean> {
  const stored = readStoredToken();
  if (!stored) return true;
  if (stored.userId && stored.userId !== userId) {
    debugLog("warn", "revoke skipped: token owner mismatch");
    return false;
  }

  try {
    await push.revokeDeviceToken(stored.token);
    clearStoredToken();
    debugLog("info", "device token revoked", {
      token: maskToken(stored.token),
    });
    return true;
  } catch (error) {
    // Mantém o token local para permitir retry; não imprime o token completo.
    debugLog("warn", "device token revoke failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export const PushNotificationsService = {
  async isAvailable(): Promise<boolean> {
    return (await getNativePlatform()) !== null;
  },

  async checkPermissions(): Promise<NativePushPermissionStatus> {
    if (!(await getNativePlatform())) return "unsupported";
    try {
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );
      const status = await PushNotifications.checkPermissions();
      debugLog("info", "permission checked", { status: status.receive });
      return status.receive;
    } catch (error) {
      debugLog("warn", "permission check failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return "unsupported";
    }
  },

  async requestPermissions(): Promise<NativePushPermissionStatus> {
    if (!(await getNativePlatform())) return "unsupported";
    try {
      const { PushNotifications } = await import(
        "@capacitor/push-notifications"
      );
      const status = await PushNotifications.requestPermissions();
      debugLog("info", "permission requested", { status: status.receive });
      return status.receive;
    } catch (error) {
      debugLog("warn", "permission request failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
  },

  async saveDeviceTokenToSupabase(
    userId: string,
    push: PushService,
    token: string,
  ): Promise<void> {
    const platform = await getNativePlatform();
    if (!platform) throw new Error("push_unsupported");
    try {
      await push.saveDeviceToken(userId, {
        platform,
        token,
        deviceId: stableDeviceId(),
        appVersion:
          process.env.NEXT_PUBLIC_APP_VERSION ?? DEFAULT_APP_VERSION,
      });
    } catch (error) {
      debugLog("warn", "device token save failed", {
        token: maskToken(token),
        error: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
    storeToken(token, userId);
    publishPushEnabledState(true);
    debugLog("info", "device token saved", { token: maskToken(token) });
  },

  async setupListeners(
    userId: string,
    push: PushService,
  ): Promise<() => Promise<void>> {
    if (!(await getNativePlatform())) return async () => undefined;

    if (
      activeListenerSession?.userId === userId &&
      activeListenerSession.push === push
    ) {
      const existing = activeListenerSession;
      return async () => {
        if (activeListenerSession?.id === existing.id) {
          await removeListenerSession(existing);
        }
      };
    }

    await removeListenerSession(activeListenerSession);
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );
    const session: ListenerSession = {
      id: ++listenerSequence,
      userId,
      push,
      handles: [],
    };

    session.handles = [
      await PushNotifications.addListener("registration", (token) => {
        debugLog("info", "registration success", {
          token: maskToken(token.value),
        });
        window.dispatchEvent(
          new CustomEvent("gymcircle:push-registration", {
            detail: { tokenPrefix: maskToken(token.value) },
          }),
        );
      }),
      await PushNotifications.addListener("registrationError", (error) => {
        debugLog("warn", "registration error", { error: error.error });
        window.dispatchEvent(
          new CustomEvent("gymcircle:push-registration-error", {
            detail: { error: error.error },
          }),
        );
      }),
      await PushNotifications.addListener(
        "pushNotificationReceived",
        (notification) => {
          window.dispatchEvent(
            new CustomEvent("gymcircle:push-received", {
              detail: notification,
            }),
          );
        },
      ),
      await PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (action) => {
          const data = extractPushNotificationData(action);
          window.dispatchEvent(
            new CustomEvent("gymcircle:push-action", {
              detail: {
                action,
                data,
                target: normalizePushNavigationTarget(data),
              },
            }),
          );
        },
      ),
    ];
    activeListenerSession = session;

    return async () => {
      if (activeListenerSession?.id === session.id) {
        await removeListenerSession(session);
      }
    };
  },

  async registerForPushNotifications(
    userId: string,
    push: PushService,
  ): Promise<NativePushRegisterResult> {
    if (!(await getNativePlatform())) return { status: "unsupported" };
    const permission = await this.checkPermissions();
    if (permission !== "granted") return { status: "permission_denied" };

    try {
      await this.setupListeners(userId, push);
      const token = await waitForNativeToken();
      await this.saveDeviceTokenToSupabase(userId, push, token);
      return { status: "registered", token };
    } catch (error) {
      debugLog("warn", "registration failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return { status: "failed", error };
    }
  },

  async requestPushPermission(
    userId: string,
    push: PushService,
  ): Promise<NativePushRegisterResult> {
    let permission: NativePushPermissionStatus;
    try {
      permission = await this.requestPermissions();
    } catch (error) {
      return { status: "failed", error };
    }
    if (permission === "unsupported") return { status: "unsupported" };
    if (permission !== "granted") return { status: "permission_denied" };
    return this.registerForPushNotifications(userId, push);
  },

  registerPushToken(userId: string, push: PushService) {
    return this.registerForPushNotifications(userId, push);
  },

  async unregisterDeviceToken(
    userId: string,
    push: PushService,
  ): Promise<boolean> {
    const revoked = await revokeStoredToken(userId, push);
    try {
      if (await this.isAvailable()) {
        const { PushNotifications } = await import(
          "@capacitor/push-notifications"
        );
        await PushNotifications.unregister();
      }
      publishPushEnabledState(false);
    } catch (error) {
      debugLog("warn", "native unregister failed", {
        error: error instanceof Error ? error.message : "unknown",
      });
      return false;
    }
    return revoked;
  },

  async revokeDeviceTokenOnLogout(
    userId: string,
    push: PushService,
  ): Promise<boolean> {
    return revokeStoredToken(userId, push);
  },

  // Compatibilidade temporária com callers/testes anteriores.
  async unregisterPushToken(push: PushService, userId?: string) {
    const stored = readStoredToken();
    return this.unregisterDeviceToken(
      userId ?? stored?.userId ?? "",
      push,
    );
  },
};
