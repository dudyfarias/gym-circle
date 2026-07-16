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

  if (subset.execution_allowed !== false) {
    errors.push("Priority subset must remain execution_locked until approval");
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

  const expectedCalls = (subset.cases ?? []).length;
  if (
    subset.estimated_calls?.current_name_search_runner_per_provider !==
    expectedCalls
  ) {
    errors.push("Name-search call estimate does not match priority case count");
  }

  return { errors, valid: errors.length === 0 };
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
          estimated_calls: subset.estimated_calls,
        },
        null,
        2,
      ),
    );
  }
}
