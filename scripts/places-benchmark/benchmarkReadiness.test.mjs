import assert from "node:assert/strict";
import test from "node:test";
import { loadBenchmarkCases, summarizeReviewStatuses } from "./cases.mjs";
import { providers } from "./providers/index.mjs";
import { buildReadinessReport } from "./readinessReport.mjs";

test("the dry-run validates all 160 cases without legacy draft statuses", async () => {
  const cases = await loadBenchmarkCases();
  const report = buildReadinessReport(cases, providers, {});
  const review = summarizeReviewStatuses(cases);

  assert.equal(report.validation.total_cases, 160);
  assert.equal(report.validation.valid_schema, true);
  assert.equal(report.provider_requests_sent, 0);
  assert.equal(Object.hasOwn(review.unknown, "draft_manual_verification"), false);
  assert.equal(review.counts.approved, 65);
  assert.equal(review.counts.uncertain, 95);
  assert.equal(report.review.benchmark_ready, false);
});

test("only approved cases count as execution eligible", async () => {
  const cases = await loadBenchmarkCases();
  const review = summarizeReviewStatuses(cases);
  assert.equal(review.execution_eligible, 65);
  assert.equal(
    cases.filter((item) => item.review_status !== "approved").every(
      (item) => item.review_status === "uncertain",
    ),
    true,
  );
});
