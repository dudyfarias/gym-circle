import { describe, expect, it } from "vitest";
import {
  canRunExternalPlaceSearch,
  EXTERNAL_PLACE_SEARCH_CLIENT_COOLDOWN_MS,
  getExternalPlaceSearchCooldownMs,
  normalizeExternalPlaceSearchQuery,
} from "./externalSearchPolicy";

describe("external place search policy", () => {
  it("requires at least three typed characters", () => {
    expect(canRunExternalPlaceSearch("SP")).toBe(false);
    expect(canRunExternalPlaceSearch("  USP  ")).toBe(true);
  });

  it("normalizes an explicit search key without leaking the raw input shape", () => {
    expect(normalizeExternalPlaceSearchQuery("  BLUEFIT   Moema ")).toBe(
      "bluefit moema",
    );
  });

  it("enforces the local cooldown between external requests", () => {
    const now = 10_000;
    expect(getExternalPlaceSearchCooldownMs(now - 300, now)).toBe(
      EXTERNAL_PLACE_SEARCH_CLIENT_COOLDOWN_MS - 300,
    );
    expect(getExternalPlaceSearchCooldownMs(now - 10_000, now)).toBe(0);
  });
});
