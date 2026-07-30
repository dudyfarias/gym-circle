import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyProviderFailure,
  createRequestBudget,
  validateExecutionSafety,
} from "./executionSafety.mjs";

const safeExecution = {
  allowPaidRequests: true,
  approvedExecutionLimit: 3,
  execute: true,
  hasExplicitCallCap: true,
  hasExplicitLimit: true,
  limit: 3,
  maxCalls: 3,
  providerId: "google",
  subsetId: "p0-6",
  subsetExecutionAllowed: true,
};

test("execution requires both explicit paid-request guards", () => {
  assert.deepEqual(
    validateExecutionSafety({
      ...safeExecution,
      allowPaidRequests: false,
      hasExplicitCallCap: false,
      hasExplicitLimit: false,
    }),
    [
      "Missing --allow-paid-requests",
      "External execution requires an explicit --limit",
      "External execution requires an explicit --max-calls",
    ],
  );
});

test("execution is locked while the priority subset is not authorized", () => {
  const errors = validateExecutionSafety({
    ...safeExecution,
    subsetExecutionAllowed: false,
  });
  assert.equal(errors.some((error) => error.includes("execution is locked")), true);
});

test("only the 3-case sanity run or 10-case controlled run is accepted", () => {
  assert.equal(validateExecutionSafety(safeExecution).length, 0);
  assert.equal(
    validateExecutionSafety({
      ...safeExecution,
      approvedExecutionLimit: 10,
      limit: 10,
      maxCalls: 10,
    }).length,
    0,
  );
  assert.equal(
    validateExecutionSafety({ ...safeExecution, limit: 10, maxCalls: 10 }).some((error) =>
      error.includes("approved limit"),
    ),
    true,
  );
  assert.equal(validateExecutionSafety({ ...safeExecution, limit: 4, maxCalls: 4 }).length > 0, true);
});

test("request budget counts actual fetches and stops at the cap", async () => {
  const calls = [];
  const budget = createRequestBudget(1, async (url) => {
    calls.push(url);
    return { ok: true };
  });
  await budget.request("https://example.test/one");
  await assert.rejects(
    () => budget.request("https://example.test/two"),
    /Request budget exhausted/,
  );
  assert.equal(budget.callsSent, 1);
  assert.deepEqual(calls, ["https://example.test/one"]);
});

test("provider failures are classified without exposing response bodies", () => {
  assert.deepEqual(classifyProviderFailure(new Error("Provider returned HTTP 403")), {
    failure_type: "authentication_or_billing",
    http_status: 403,
  });
  assert.deepEqual(classifyProviderFailure(new Error("Provider returned HTTP 429")), {
    failure_type: "rate_limited",
    http_status: 429,
  });
});
