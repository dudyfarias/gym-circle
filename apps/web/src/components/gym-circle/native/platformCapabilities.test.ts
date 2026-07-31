import { describe, expect, it } from "vitest";
import { resolvePlatformCapabilities } from "./platformCapabilities";

describe("resolvePlatformCapabilities", () => {
  it("keeps Apple Health and background outdoor tracking iOS-only", () => {
    expect(resolvePlatformCapabilities("ios")).toMatchObject({
      appleHealthImport: true,
      backgroundOutdoorTracking: true,
      nativePush: true,
    });
    expect(resolvePlatformCapabilities("android")).toMatchObject({
      appleHealthImport: false,
      backgroundOutdoorTracking: false,
    });
  });

  it("keeps Android push disabled until the FCM pipeline is enabled", () => {
    expect(resolvePlatformCapabilities("android").nativePush).toBe(false);
    expect(
      resolvePlatformCapabilities("android", {
        androidPushEnabled: true,
      }).nativePush,
    ).toBe(true);
  });

  it("does not expose native-only capabilities in the browser", () => {
    expect(resolvePlatformCapabilities("web")).toEqual({
      appleHealthImport: false,
      backgroundOutdoorTracking: false,
      nativePush: false,
      platform: "web",
    });
  });
});
