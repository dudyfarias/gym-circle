import assert from "node:assert/strict";
import test from "node:test";
import { haversineDistanceM, normalizeCategory, normalizeText } from "./normalizeResult.mjs";

test("normalizes Portuguese names without losing identity", () => {
  assert.equal(normalizeText("Academia Gaviões — São Paulo"), "academia gavioes sao paulo");
});

test("maps provider categories to the internal taxonomy", () => {
  assert.equal(normalizeCategory("fitness_centre"), "gym");
  assert.equal(normalizeCategory("martial arts"), "martial_arts_gym");
});

test("calculates geographic distance in meters", () => {
  const distance = haversineDistanceM(
    { latitude: -23.5505, longitude: -46.6333 },
    { latitude: -23.5514, longitude: -46.6333 },
  );
  assert.ok(distance > 90 && distance < 110);
});
