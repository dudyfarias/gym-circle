import assert from "node:assert/strict";
import test from "node:test";

import { loadBenchmarkCases } from "./cases.mjs";
import {
  loadPrioritySubset,
  validatePrioritySubset,
} from "./prioritySubset.mjs";

test("P0.6 priority subset contains ten approved and execution-locked cases", async () => {
  const [subset, benchmarkCases] = await Promise.all([
    loadPrioritySubset(),
    loadBenchmarkCases(),
  ]);

  assert.deepEqual(validatePrioritySubset(subset, benchmarkCases), {
    errors: [],
    valid: true,
  });
});
