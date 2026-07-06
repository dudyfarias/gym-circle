import { afterEach, describe, expect, it, vi } from "vitest";
import type { PushService } from "@gym-circle/core";
import { PushNotificationsService } from "./PushNotificationsService";

const nativeMocks = vi.hoisted(() => {
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const emit = (event: string, payload: unknown) => {
    for (const listener of listeners.get(event) ?? []) listener(payload);
  };
  return {
    listeners,
    emit,
    isNativePlatform: vi.fn(() => true),
    isPluginAvailable: vi.fn(() => true),
    getPlatform: vi.fn(() => "ios"),
    checkPermissions: vi.fn(async () => ({ receive: "granted" })),
    requestPermissions: vi.fn(async () => ({ receive: "granted" })),
    register: vi.fn(async () => {
      queueMicrotask(() =>
        emit("registration", { value: "apns-device-token-1234567890" }),
      );
    }),
    unregister: vi.fn(async () => undefined),
    addListener: vi.fn(
      async (event: string, callback: (payload: unknown) => void) => {
        const eventListeners = listeners.get(event) ?? new Set();
        eventListeners.add(callback);
        listeners.set(event, eventListeners);
        return {
          remove: vi.fn(async () => {
            eventListeners.delete(callback);
          }),
        };
      },
    ),
  };
});

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: nativeMocks.isNativePlatform,
    isPluginAvailable: nativeMocks.isPluginAvailable,
    getPlatform: nativeMocks.getPlatform,
  },
}));

vi.mock("@capacitor/push-notifications", () => ({
  PushNotifications: {
    checkPermissions: nativeMocks.checkPermissions,
    requestPermissions: nativeMocks.requestPermissions,
    register: nativeMocks.register,
    unregister: nativeMocks.unregister,
    addListener: nativeMocks.addListener,
  },
}));

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

function pushServiceMock() {
  return {
    saveDeviceToken: vi.fn(async () => undefined),
    revokeDeviceToken: vi.fn(async () => undefined),
  } as unknown as PushService;
}

function installWindow() {
  const localStorage = storage();
  vi.stubGlobal("window", {
    localStorage,
    setTimeout,
    clearTimeout,
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal(
    "CustomEvent",
    class {
      constructor(
        public type: string,
        public init?: { detail?: unknown },
      ) {}
    },
  );
  return localStorage;
}

afterEach(() => {
  nativeMocks.listeners.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  nativeMocks.isNativePlatform.mockReturnValue(true);
  nativeMocks.isPluginAvailable.mockReturnValue(true);
  nativeMocks.getPlatform.mockReturnValue("ios");
  nativeMocks.checkPermissions.mockResolvedValue({ receive: "granted" });
  nativeMocks.requestPermissions.mockResolvedValue({ receive: "granted" });
});

describe("PushNotificationsService", () => {
  it("requests iOS permission, registers, and saves the token for the user", async () => {
    const localStorage = installWindow();
    const push = pushServiceMock();

    const result = await PushNotificationsService.requestPushPermission(
      "user-1",
      push,
    );

    expect(result).toEqual({
      status: "registered",
      token: "apns-device-token-1234567890",
    });
    expect(nativeMocks.requestPermissions).toHaveBeenCalledOnce();
    expect(nativeMocks.register).toHaveBeenCalledOnce();
    expect(push.saveDeviceToken).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        platform: "ios",
        token: "apns-device-token-1234567890",
        deviceId: expect.any(String),
        appVersion: expect.any(String),
      }),
    );
    expect(localStorage.getItem("gc-push-enabled")).toBe("true");

    const cleanup = await PushNotificationsService.setupListeners(
      "user-1",
      push,
    );
    await cleanup();
  });

  it("installs all four Capacitor listeners", async () => {
    installWindow();
    const push = pushServiceMock();
    const cleanup = await PushNotificationsService.setupListeners(
      "user-2",
      push,
    );

    expect(nativeMocks.addListener.mock.calls.map(([event]) => event)).toEqual([
      "registration",
      "registrationError",
      "pushNotificationReceived",
      "pushNotificationActionPerformed",
    ]);

    await cleanup();
  });

  it("does not register when the user denies notification permission", async () => {
    installWindow();
    const push = pushServiceMock();
    nativeMocks.requestPermissions.mockResolvedValueOnce({ receive: "denied" });

    await expect(
      PushNotificationsService.requestPushPermission("user-3", push),
    ).resolves.toEqual({ status: "permission_denied" });
    expect(nativeMocks.register).not.toHaveBeenCalled();
    expect(push.saveDeviceToken).not.toHaveBeenCalled();
  });
});
