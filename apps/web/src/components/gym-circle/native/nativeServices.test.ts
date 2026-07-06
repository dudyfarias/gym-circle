import { afterEach, describe, expect, it, vi } from "vitest";
import { HapticsService } from "./HapticsService";
import {
  clearNativeFeelCaches,
  nativeCacheKeys,
  readNativeCache,
  writeNativeCache,
  type StorageLike,
} from "./LocalAppCache";
import { CurrentWebLocationProvider } from "./LocationProvider";
import { NativeMediaPickerService } from "./NativeMediaPickerService";
import { PushNotificationsService } from "./PushNotificationsService";
import type { PushService } from "@gym-circle/core";

vi.mock("@capacitor/filesystem", () => ({
  Filesystem: {
    readFile: vi.fn(async () => ({ data: "Y2FtZXJhLWltYWdl" })),
  },
}));

function createStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Native Feel services", () => {
  it("respects cache TTL and clears native feel cache on logout", () => {
    const storage = createStorage();
    const key = nativeCacheKeys.home("user-1");

    writeNativeCache(key, { ids: ["post-1"] }, 1000, { now: 100, storage });

    expect(readNativeCache<{ ids: string[] }>(key, { now: 500, storage })?.ids).toEqual([
      "post-1",
    ]);
    expect(readNativeCache(key, { now: 1200, storage })).toBeNull();

    writeNativeCache(key, { ids: ["post-2"] }, 1000, { now: 1300, storage });
    clearNativeFeelCaches({ storage });
    expect(readNativeCache(key, { now: 1400, storage })).toBeNull();
  });

  it("falls back safely when native media picker is unavailable", async () => {
    await expect(NativeMediaPickerService.takePhoto()).resolves.toBeNull();
    await expect(NativeMediaPickerService.pickWorkoutMedia()).resolves.toBeNull();
  });

  it("normalizes native camera media through Filesystem when webPath fetch fails", async () => {
    const result = await NativeMediaPickerService.normalizeMediaResult(
      {
        uri: "file:///tmp/captured-photo.jpg",
        metadata: { format: "jpeg", resolution: "640x480" },
      },
      "image",
    );

    expect(result?.file.type).toBe("image/jpeg");
    expect(result?.width).toBe(640);
    expect(result?.height).toBe(480);
    await expect(result?.file.text()).resolves.toBe("camera-image");
  });

  it("plays web vibration fallback when native haptics are unavailable", async () => {
    const vibrate = vi.fn();
    vi.stubGlobal("window", { navigator: { vibrate } });

    await HapticsService.light();

    expect(vibrate).toHaveBeenCalledWith([8]);
  });

  it("keeps push registration unsupported on web without throwing", async () => {
    const push = {
      saveDeviceToken: vi.fn(),
      revokeDeviceToken: vi.fn(),
    } as unknown as PushService;

    await expect(
      PushNotificationsService.registerPushToken("user-1", push),
    ).resolves.toEqual({ status: "unsupported" });
  });

  it("unregisterPushToken revokes stored token and clears local storage", async () => {
    // Pré-popular storage simulando registro nativo anterior.
    const storage = createStorage();
    storage.setItem("gym-circle.native-push-token.v1", "apns-test-token");
    vi.stubGlobal("window", { localStorage: storage });

    const push = {
      saveDeviceToken: vi.fn(),
      revokeDeviceToken: vi.fn().mockResolvedValue(undefined),
    } as unknown as PushService;

    await PushNotificationsService.unregisterPushToken(push);

    // Token foi mandado pro server pra revoke + storage local foi limpa.
    expect(push.revokeDeviceToken).toHaveBeenCalledWith("apns-test-token");
    expect(storage.getItem("gym-circle.native-push-token.v1")).toBeNull();
  });

  it("keeps the local token when logout revocation fails so it can retry", async () => {
    const storage = createStorage();
    storage.setItem(
      "gym-circle.native-push-token.v2",
      JSON.stringify({ token: "apns-retry-token", userId: "user-1" }),
    );
    vi.stubGlobal("window", { localStorage: storage });
    const push = {
      saveDeviceToken: vi.fn(),
      revokeDeviceToken: vi.fn().mockRejectedValue(new Error("offline")),
    } as unknown as PushService;

    await expect(
      PushNotificationsService.revokeDeviceTokenOnLogout("user-1", push),
    ).resolves.toBe(false);
    expect(storage.getItem("gym-circle.native-push-token.v2")).not.toBeNull();
  });

  it("unregisterPushToken is a no-op when no token was stored", async () => {
    // Caso de logout sem ter registrado push antes — não pode falhar.
    const storage = createStorage();
    vi.stubGlobal("window", { localStorage: storage });

    const push = {
      saveDeviceToken: vi.fn(),
      revokeDeviceToken: vi.fn().mockResolvedValue(undefined),
    } as unknown as PushService;

    await PushNotificationsService.unregisterPushToken(push);

    expect(push.revokeDeviceToken).not.toHaveBeenCalled();
  });

  it("normalizes web location candidates and calculates distance", () => {
    const normalized = CurrentWebLocationProvider.normalizePlace({
      providerId: "osm/1",
      name: "Smart Fit",
      address: "Rua A",
      city: "São Paulo",
      state: "SP",
      latitude: -23.56,
      longitude: -46.65,
    });

    expect(normalized?.name).toBe("Smart Fit");
    expect(
      CurrentWebLocationProvider.calculateDistance(
        { latitude: -23.56, longitude: -46.65 },
        { latitude: -23.57, longitude: -46.65 },
      ),
    ).toBeGreaterThan(1);
  });
});
