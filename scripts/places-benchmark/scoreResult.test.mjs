import assert from "node:assert/strict";
import test from "node:test";
import { aggregateScores, scoreCase } from "./scoreResult.mjs";

const expected = {
  benchmark_case_id: "GSP-001",
  expected_name: "Parque Ibirapuera",
  latitude: -23.5874,
  longitude: -46.6576,
};

test("keeps coverage and relevance as separate dimensions", () => {
  const row = scoreCase(
    expected,
    [
      { rank: 1, name: "Outro parque", latitude: -23.58, longitude: -46.65 },
      { rank: 2, name: "Parque Ibirapuera", latitude: -23.5875, longitude: -46.6577 },
    ],
    { latency_ms: 120 },
  );
  assert.equal(row.coverage_status, "found_correct");
  assert.equal(row.relevance_rank, 2);
  assert.equal(row.relevance_bucket, "top_3");
});

test("aggregates latency without folding it into quality", () => {
  const aggregate = aggregateScores([
    { coverage_status: "found_correct", relevance_rank: 1, data_quality_score: 0.8, duplicate_count: 0, latency_ms: 100 },
    { coverage_status: "not_found", relevance_rank: null, data_quality_score: 0, duplicate_count: 0, latency_ms: 500 },
  ]);
  assert.equal(aggregate.coverage_score, 0.5);
  assert.equal(aggregate.latency_p50_ms, 100);
  assert.equal(aggregate.latency_p95_ms, 500);
});
