import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHybridCostScenarios,
  estimateGoogleCostUsd,
  estimateRequestMix,
} from "./costEstimate.mjs";

test("reduces external calls when the internal place base resolves more searches", () => {
  const withoutLocalBase = estimateRequestMix(100_000, 0);
  const matureLocalBase = estimateRequestMix(100_000, 0.7);
  assert.equal(withoutLocalBase.external_searches, 100_000);
  assert.equal(matureLocalBase.external_searches, 30_000);
  assert.ok(
    estimateGoogleCostUsd(matureLocalBase).estimated_total <
      estimateGoogleCostUsd(withoutLocalBase).estimated_total,
  );
});

test("emits every product and local-resolution scenario", () => {
  const scenarios = buildHybridCostScenarios();
  assert.equal(scenarios.length, 9);
  assert.deepEqual(
    [...new Set(scenarios.map((item) => item.local_resolution_rate))],
    [0, 0.3, 0.7],
  );
});
