import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadBenchmarkCases } from "./cases.mjs";

const here = dirname(fileURLToPath(import.meta.url));
export const PRIORITY_SUBSET_PATH = resolve(here, "p0-6-priority-cases.json");

export async function loadPrioritySubset() {
  return JSON.parse(await readFile(PRIORITY_SUBSET_PATH, "utf8"));
}

export function validatePrioritySubset(subset, benchmarkCases) {
  const errors = [];
  const ids = new Set();
  const caseById = new Map(
    benchmarkCases.map((benchmarkCase) => [
      benchmarkCase.benchmark_case_id,
      benchmarkCase,
    ]),
  );

  if (typeof subset.execution_allowed !== "boolean") {
    errors.push("Priority subset must declare execution_allowed as a boolean");
  }
  if (![0, 3, 10].includes(subset.approved_execution_limit)) {
    errors.push("Priority subset approved_execution_limit must be 0, 3, or 10");
  }
  if (!subset.execution_allowed && subset.approved_execution_limit !== 0) {
    errors.push("A locked priority subset must have approved_execution_limit 0");
  }
  if (!Array.isArray(subset.cases) || subset.cases.length !== 10) {
    errors.push(
      `Expected exactly 10 priority cases; found ${subset.cases?.length ?? 0}`,
    );
  }

  for (const item of subset.cases ?? []) {
    if (ids.has(item.benchmark_case_id)) {
      errors.push(`Duplicate priority case: ${item.benchmark_case_id}`);
    }
    ids.add(item.benchmark_case_id);
    const benchmarkCase = caseById.get(item.benchmark_case_id);
    if (!benchmarkCase) {
      errors.push(`Unknown priority case: ${item.benchmark_case_id}`);
      continue;
    }
    if (benchmarkCase.review_status !== "approved") {
      errors.push(`Priority case is not approved: ${item.benchmark_case_id}`);
    }
    for (const field of [
      "expected_name",
      "expected_category",
      "municipality",
      "neighborhood_or_area",
      "name_query",
      "category_query",
      "autocomplete_query",
      "review_method",
      "review_note",
    ]) {
      if (!String(benchmarkCase[field] ?? "").trim()) {
        errors.push(`Priority case ${item.benchmark_case_id} lacks ${field}`);
      }
    }
    if (
      !Number.isFinite(benchmarkCase.latitude) ||
      !Number.isFinite(benchmarkCase.longitude) ||
      benchmarkCase.latitude < -24.2 ||
      benchmarkCase.latitude > -23.1 ||
      benchmarkCase.longitude < -47.2 ||
      benchmarkCase.longitude > -45.7
    ) {
      errors.push(`Priority case has implausible GSP coordinates: ${item.benchmark_case_id}`);
    }
    if (!Number.isFinite(benchmarkCase.nearby_radius_m)) {
      errors.push(`Priority case lacks nearby radius: ${item.benchmark_case_id}`);
    }
    if (!String(item.evidence_url ?? "").startsWith("https://")) {
      errors.push(
        `Priority case lacks HTTPS evidence: ${item.benchmark_case_id}`,
      );
    }
  }

  const requiredRoles = [
    "ironberg_barra_funda",
    "smart_fit_nearby_1",
    "smart_fit_nearby_2",
    "bluefit",
    "bio_ritmo",
    "gavioes",
    "large_park",
    "neighborhood_park",
    "independent_gym",
    "public_sports_center",
  ];
  const roles = new Set((subset.cases ?? []).map((item) => item.role));
  for (const role of requiredRoles) {
    if (!roles.has(role)) errors.push(`Missing priority role: ${role}`);
  }

  const sanityCaseIds = subset.sanity_case_ids ?? [];
  if (!Array.isArray(sanityCaseIds) || sanityCaseIds.length !== 3) {
    errors.push("Priority subset must declare exactly three sanity_case_ids");
  } else {
    const sanityRoles = new Set(
      sanityCaseIds.map((id) =>
        (subset.cases ?? []).find((item) => item.benchmark_case_id === id)?.role,
      ),
    );
    if (!sanityRoles.has("ironberg_barra_funda")) {
      errors.push("Sanity subset must include Ironberg Barra Funda");
    }
    if (!["smart_fit_nearby_1", "smart_fit_nearby_2"].some((role) => sanityRoles.has(role))) {
      errors.push("Sanity subset must include one Smart Fit");
    }
    if (!sanityRoles.has("large_park")) {
      errors.push("Sanity subset must include one large park");
    }
    if (new Set(sanityCaseIds).size !== sanityCaseIds.length) {
      errors.push("Sanity subset contains duplicate IDs");
    }
    for (const id of sanityCaseIds) {
      if (!ids.has(id)) errors.push(`Sanity case is outside priority subset: ${id}`);
    }
  }

  const expectedCalls = (subset.cases ?? []).length;
  if (
    subset.estimated_calls?.current_name_search_runner_per_provider !==
    expectedCalls
  ) {
    errors.push("Name-search call estimate does not match priority case count");
  }

  return { errors, valid: errors.length === 0 };
}

export function resolvePriorityBenchmarkCases(
  subset,
  benchmarkCases,
  { sanityOnly = false } = {},
) {
  const caseById = new Map(
    benchmarkCases.map((benchmarkCase) => [
      benchmarkCase.benchmark_case_id,
      benchmarkCase,
    ]),
  );
  const ids = sanityOnly
    ? subset.sanity_case_ids
    : subset.cases.map((item) => item.benchmark_case_id);
  return ids.map((id) => caseById.get(id)).filter(Boolean);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [subset, benchmarkCases] = await Promise.all([
    loadPrioritySubset(),
    loadBenchmarkCases(),
  ]);
  const result = validatePrioritySubset(subset, benchmarkCases);
  if (!result.valid) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      JSON.stringify(
        {
          status: "valid",
          cases: subset.cases.length,
          execution_allowed: subset.execution_allowed,
          approved_execution_limit: subset.approved_execution_limit,
          estimated_calls: subset.estimated_calls,
        },
        null,
        2,
      ),
    );
  }
}
