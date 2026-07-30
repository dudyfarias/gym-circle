import assert from "node:assert/strict";
import test from "node:test";

import { loadBenchmarkCases } from "./cases.mjs";
import {
  loadPrioritySubset,
  resolvePriorityBenchmarkCases,
  validatePrioritySubset,
} from "./prioritySubset.mjs";

test("P0.6 priority subset contains ten approved cases authorized after sanity review", async () => {
  const [subset, benchmarkCases] = await Promise.all([
    loadPrioritySubset(),
    loadBenchmarkCases(),
  ]);

  assert.deepEqual(validatePrioritySubset(subset, benchmarkCases), {
    errors: [],
    valid: true,
  });
  assert.equal(subset.execution_allowed, true);
  assert.equal(subset.approved_execution_limit, 10);
  assert.deepEqual(
    resolvePriorityBenchmarkCases(subset, benchmarkCases, {
      sanityOnly: true,
    }).map((item) => item.benchmark_case_id),
    ["GSP-160", "GSP-001", "GSP-033"],
  );
});
