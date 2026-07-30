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

test("does not mark nearby units of the same chain as duplicates", () => {
  const row = scoreCase(
    {
      ...expected,
      expected_name: "Smart Fit Shopping Light",
    },
    [
      {
        rank: 1,
        name: "Smart Fit Shopping Light",
        latitude: -23.545,
        longitude: -46.636,
      },
      {
        rank: 2,
        name: "Smart Fit Liberdade",
        latitude: -23.557,
        longitude: -46.635,
      },
    ],
  );
  assert.equal(row.duplicate_count, 0);
});

test("accepts a distinctive brand abbreviation when the result is at the verified location", () => {
  const row = scoreCase(
    {
      benchmark_case_id: "GSP-160",
      expected_name: "Ironberg Barra Funda",
      latitude: -23.5217275,
      longitude: -46.6712642,
    },
    [
      {
        name: "Ironberg SP",
        address: "Rua Robert Bosch, 469",
        latitude: -23.5222781,
        longitude: -46.6710943,
        category: "gym",
        rank: 1,
      },
    ],
  );
  assert.equal(row.coverage_status, "found_correct");
  assert.equal(row.relevance_bucket, "top_1");
  assert.equal(row.match_confidence, 0.8);
});
