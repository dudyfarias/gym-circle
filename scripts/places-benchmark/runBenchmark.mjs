import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadBenchmarkCases } from "./cases.mjs";
import {
  classifyProviderFailure,
  createRequestBudget,
  MAX_SUPPORTED_CALLS,
  P0_6_MAX_CASES,
  validateExecutionSafety,
} from "./executionSafety.mjs";
import {
  loadPrioritySubset,
  resolvePriorityBenchmarkCases,
  validatePrioritySubset,
} from "./prioritySubset.mjs";
import { providers } from "./providers/index.mjs";
import { buildReadinessReport } from "./readinessReport.mjs";
import { aggregateScores, scoreCase } from "./scoreResult.mjs";
import { validateCases } from "./validateCases.mjs";

const DEFAULT_CALL_CAP = 5;
const args = new Set(process.argv.slice(2));
const valueFor = (name) => {
  const prefix = `${name}=`;
  return [...args].find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
};

function boundedInteger(name, fallback, maximum = MAX_SUPPORTED_CALLS) {
  const raw = valueFor(name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${name} must be an integer from 1 to ${maximum}`);
  }
  return parsed;
}

const providerId = valueFor("--provider");
const subsetId = valueFor("--subset");
const execute = args.has("--execute");
const dryRun = args.has("--dry-run") || !execute;
const allowPaidRequests = args.has("--allow-paid-requests");
const limit = boundedInteger(
  "--limit",
  subsetId === "p0-6" ? P0_6_MAX_CASES : DEFAULT_CALL_CAP,
);
const maxCalls = boundedInteger("--max-calls", DEFAULT_CALL_CAP);
const hasExplicitLimit = valueFor("--limit") !== undefined;
const hasExplicitCallCap = valueFor("--max-calls") !== undefined;

if (providerId && !providers.has(providerId)) {
  console.error("Use --provider=google|apple|mapbox|osm");
  process.exit(1);
}
if (subsetId && subsetId !== "p0-6") {
  console.error("Use --subset=p0-6 for the controlled benchmark");
  process.exit(1);
}
if (execute && args.has("--dry-run")) {
  console.error("Choose either --dry-run or --execute, never both");
  process.exit(1);
}

const allCases = await loadBenchmarkCases();
const here = dirname(fileURLToPath(import.meta.url));
let subset = null;
let selectedCases = allCases;
if (subsetId === "p0-6") {
  subset = await loadPrioritySubset();
  const subsetValidation = validatePrioritySubset(subset, allCases);
  if (!subsetValidation.valid) {
    console.error(`P0.6 subset validation failed: ${subsetValidation.errors.join("; ")}`);
    process.exit(1);
  }
  selectedCases = resolvePriorityBenchmarkCases(subset, allCases, {
    sanityOnly: limit === 3,
  });
}

if (dryRun) {
  const report = buildReadinessReport(selectedCases, providers, process.env, {
    requireDatasetCoverage: subsetId !== "p0-6",
  });
  const configuredProviders = report.providers.filter(
    (provider) => provider.status === "configured_not_executed",
  );
  const gateStatus =
    !report.validation.valid_schema || !report.review.benchmark_ready
      ? "blocked_by_case_validation"
      : configuredProviders.length === 0
      ? "blocked_by_credentials"
      : subset && !subset.execution_allowed
        ? "blocked_by_execution_approval"
        : "ready_for_explicit_execution";
  const outputPath = resolve(here, "reports", "readiness.json");
  const readinessOutput = {
    ...report,
    selection: {
      subset: subsetId ?? "full_catalog",
      case_ids: selectedCases.map((item) => item.benchmark_case_id),
      sanity_only: subsetId === "p0-6" && limit === 3,
    },
    execution_gate: {
      status: gateStatus,
      subset_execution_allowed: subset?.execution_allowed ?? null,
      approved_execution_limit: subset?.approved_execution_limit ?? null,
      explicit_limit: hasExplicitLimit ? limit : null,
      explicit_max_calls: hasExplicitCallCap ? maxCalls : null,
    },
    controlled_run_plan: {
      operation: "text_search_by_name",
      planned_cases: selectedCases.length,
      maximum_requests: hasExplicitCallCap ? maxCalls : null,
      actual_requests: 0,
      actual_cost_usd: 0,
      maximum_cost_estimate: "pending_provider_billing_and_current_account_usage",
    },
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(readinessOutput, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        ...readinessOutput,
        output: outputPath,
        note: "No provider request was sent. Execution requires --execute and --allow-paid-requests.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const safetyErrors = validateExecutionSafety({
  allowPaidRequests,
  approvedExecutionLimit: subset?.approved_execution_limit ?? 0,
  execute,
  hasExplicitCallCap,
  hasExplicitLimit,
  limit,
  maxCalls,
  providerId,
  subsetExecutionAllowed: subset?.execution_allowed ?? false,
  subsetId,
});
if (safetyErrors.length > 0) {
  console.error(`Execution blocked: ${safetyErrors.join("; ")}`);
  process.exit(1);
}

const validation = validateCases(selectedCases, {
  requireDatasetCoverage: subsetId !== "p0-6",
});
if (!validation.valid) {
  console.error(`Benchmark case validation failed: ${validation.errors.join("; ")}`);
  process.exit(1);
}

const provider = providers.get(providerId);
const providerConfigured = provider.isConfigured
  ? provider.isConfigured(process.env)
  : provider.requiredEnvironment.every((name) => process.env[name]);
const missingEnvironment = provider.requiredEnvironment.filter((name) => !process.env[name]);
if (!providerConfigured) {
  console.error(`Provider skipped; missing environment names: ${missingEnvironment.join(", ")}`);
  process.exit(1);
}

const cases = selectedCases.slice(0, limit);
if (cases.length === 0) {
  console.error("No approved benchmark cases are eligible for external execution");
  process.exit(1);
}

const scoredRows = [];
const failures = [];
const requestBudget = createRequestBudget(maxCalls);
for (const [caseIndex, testCase] of cases.entries()) {
  if (caseIndex > 0) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, provider.minimumDelayMs));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const startedAt = performance.now();
  try {
    const results = await provider.searchByName(testCase, {
      request: requestBudget.request,
      signal: controller.signal,
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    scoredRows.push(scoreCase(testCase, results, { latency_ms: latencyMs }));
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const failure = classifyProviderFailure(error);
    failures.push({
      benchmark_case_id: testCase.benchmark_case_id,
      ...failure,
      latency_ms: latencyMs,
    });
    break;
  } finally {
    clearTimeout(timeout);
  }
}

const report = {
  status: failures.length > 0 ? "aborted" : "complete_pending_human_review",
  provider: providerId,
  executed_at: new Date().toISOString(),
  scope: "Greater São Paulo",
  methodology_version: "1.1.0",
  raw_provider_payload_persisted: false,
  normalized_review_snapshot_temporary: true,
  normalized_review_snapshot_cache_expires_at: new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  ).toISOString(),
  request_guard: {
    allow_paid_requests: true,
    max_calls: maxCalls,
    calls_sent: requestBudget.callsSent,
    approved_cases_only: true,
  },
  aggregate: aggregateScores(scoredRows),
  cases: scoredRows,
  failures,
  human_review: {
    status: scoredRows.length > 0 ? "pending" : "not_started",
    allowed_values: [
      "found_correct",
      "found_wrong_unit",
      "found_wrong_place",
      "ambiguous",
      "not_found",
      "closed_or_outdated",
    ],
  },
};
const outputPath = resolve(here, "reports", `${providerId}-${Date.now()}.json`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      status: report.status,
      execution_status: report.status,
      provider: providerId,
      calls_sent: requestBudget.callsSent,
      output: outputPath,
    },
    null,
    2,
  ),
);
if (failures.length > 0) process.exitCode = 1;
