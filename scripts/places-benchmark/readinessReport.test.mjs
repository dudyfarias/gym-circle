import assert from "node:assert/strict";
import test from "node:test";
import { buildReadinessReport } from "./readinessReport.mjs";

const providers = new Map([
  [
    "google",
    { id: "google", requiredEnvironment: ["GOOGLE_PLACES_API_KEY"] },
  ],
]);

const validCase = {
  benchmark_case_id: "GSP-001",
  expected_name: "Parque Ibirapuera",
  expected_category: "public_park",
  municipality: "São Paulo",
  macro_region: "Zona Sul",
  neighborhood_or_area: "Ibirapuera",
  latitude: -23.5874,
  longitude: -46.6576,
  name_query: "Parque Ibirapuera",
  category_query: "parque Ibirapuera",
  nearby_radius_m: 2_500,
  autocomplete_query: "Parque Ibi",
  ownership_type: "public",
  business_size: "public",
  review_status: "uncertain",
};

test("never includes secret values and marks an unconfigured provider as skipped", () => {
  const report = buildReadinessReport([validCase], providers, {
    GOOGLE_PLACES_API_KEY: "must-not-appear",
  });
  assert.equal(report.providers[0].status, "configured_not_executed");
  assert.equal(JSON.stringify(report).includes("must-not-appear"), false);
});

test("an uncertain case is an explicit benchmark blocker", () => {
  const report = buildReadinessReport([validCase], providers, {});
  assert.equal(report.review.benchmark_ready, false);
  assert.deepEqual(report.review.blockers, [
    { benchmark_case_id: "GSP-001", review_status: "uncertain" },
  ]);
  assert.equal(report.providers[0].status, "skipped_missing_configuration");
  assert.equal(report.provider_requests_sent, 0);
});
