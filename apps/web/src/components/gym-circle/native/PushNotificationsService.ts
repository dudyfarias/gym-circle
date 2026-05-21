"use client";

import type { PushService } from "@gym-circle/core";

const LAST_NATIVE_TOKEN_KEY = "gym-circle.native-push-token.v1";

type NativePushRegisterResult =
  | { status: "unsupported" }
  | { status: "permission_denied" }
  | { status: "registered"; token: string }
  | { status: "failed"; error: unknown };

async function getNativePlatform(): Promise<"ios" | "android" | null> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return null;
    const platform = Capacitor.getPlatform();
    return platform === "ios" || platform === "android" ? platform : null;
  } catch {
    return null;
  }
}

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_NATIVE_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_NATIVE_TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

function clearStoredToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_NATIVE_TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function waitForNativeToken(): Promise<string> {
  const { PushNotifications } = await import("@capacitor/push-notifications");

  // Guarda handles dos listeners pra remover no finally — sem isso, chamar
  // waitForNativeToken() múltiplas vezes (ex: troca de user) acumularia
  // listeners "registration"/"registrationError" mortos em memória.
  let registrationHandle:
    | Awaited<ReturnType<typeof PushNotifications.addListener>>
    | null = null;
  let errorHandle:
    | Awaited<ReturnType<typeof PushNotifications.addListener>>
    | null = null;

  // Promise externa: resolveFn/rejectFn escapam o construtor pra os callbacks
  // dos listeners conseguirem settlar a token wait. Promise é "settle once",
  // então não precisamos de flag `settled` extra — chamadas tardias são no-op.
  let resolveFn!: (value: string) => void;
  let rejectFn!: (reason: unknown) => void;
  const tokenPromise = new Promise<string>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  const timer = window.setTimeout(
    () => rejectFn(new Error("Tempo esgotado ao registrar notificações.")),
    12_000,
  );

  try {
    registrationHandle = await PushNotifications.addListener(
      "registration",
      (token) => {
        resolveFn(token.value);
      },
    );
    errorHandle = await PushNotifications.addListener(
      "registrationError",
      (error) => {
        rejectFn(error);
      },
    );

    // register() resolve quando a chamada nativa foi feita (rápido); o token
    // em si chega depois via listener "registration". Await garante que o
    // dispatch nativo aconteceu antes de bloquear na tokenPromise.
    await PushNotifications.register();
    return await tokenPromise;
  } finally {
    window.clearTimeout(timer);
    void registrationHandle?.remove();
    void errorHandle?.remove();
  }
}

async function registerToken(
  userId: string,
  push: PushService,
  options: { requestPermission: boolean },
): Promise<NativePushRegisterResult> {
  const platform = await getNativePlatform();
  if (!platform) return { status: "unsupported" };

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const current = await PushNotifications.checkPermissions();
    let receive = current.receive;
    if (receive !== "granted" && options.requestPermission) {
      const requested = await PushNotifications.requestPermissions();
      receive = requested.receive;
    }
    if (receive !== "granted") return { status: "permission_denied" };

    const token = await waitForNativeToken();
    await push.saveDeviceToken(userId, {
      platform,
      token,
      deviceId: typeof navigator === "undefined" ? null : navigator.userAgent,
      appVersion: process.env.NEXT_PUBLIC_APP_VERSION ?? null,
    });
    storeToken(token);
    return { status: "registered", token };
  } catch (error) {
    return { status: "failed", error };
  }
}

export const PushNotificationsService = {
  requestPushPermission: (userId: string, push: PushService) =>
    registerToken(userId, push, { requestPermission: true }),

  registerPushToken: (userId: string, push: PushService) =>
    registerToken(userId, push, { requestPermission: false }),

  async unregisterPushToken(push: PushService) {
    const token = readStoredToken();
    clearStoredToken();
    if (!token) return;
    await push.revokeDeviceToken(token).catch(() => undefined);
  },
};
