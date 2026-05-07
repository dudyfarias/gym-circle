import { describe, expect, it } from "vitest";
import {
  calculateDistanceKm,
  createReverseGeocodingCacheKey,
  formatDistanceKm,
  sanitizeLocationLabel,
} from "./location";

describe("location helpers", () => {
  it("calculates approximate distance in kilometers", () => {
    const recife = { latitude: -8.0578, longitude: -34.8829 };
    const olinda = { latitude: -8.0108, longitude: -34.8553 };

    expect(calculateDistanceKm(recife, olinda)).toBeGreaterThan(5);
    expect(calculateDistanceKm(recife, olinda)).toBeLessThan(7);
  });

  it("formats short and long distances for pt-BR UI", () => {
    expect(formatDistanceKm(0.42)).toBe("< 1 km");
    expect(formatDistanceKm(2.35)).toBe("2,4 km");
    expect(formatDistanceKm(12.3)).toBe("12 km");
  });

  it("does not expose raw coordinates as current location labels", () => {
    expect(sanitizeLocationLabel("current", "-8.05780, -34.88290")).toBe(
      "Localização atual",
    );
    expect(sanitizeLocationLabel("current", "Boa Viagem")).toBe("Boa Viagem");
    expect(sanitizeLocationLabel("gym", "Pulse Club Recife")).toBe(
      "Pulse Club Recife",
    );
  });

  it("creates low precision keys for future reverse geocoding cache", () => {
    expect(
      createReverseGeocodingCacheKey({
        latitude: -8.0578123,
        longitude: -34.8829123,
      }),
    ).toBe("-8.058,-34.883");
  });
});
