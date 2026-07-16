import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXECUTION_ELIGIBLE_REVIEW_STATUS,
  loadBenchmarkCases,
} from "./cases.mjs";
import { providers } from "./providers/index.mjs";
import { buildReadinessReport } from "./readinessReport.mjs";
import { aggregateScores, scoreCase } from "./scoreResult.mjs";
import { validateCases } from "./validateCases.mjs";

const MAX_SUPPORTED_CALLS = 200;
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
const execute = args.has("--execute");
const allowPaidRequests = args.has("--allow-paid-requests");
const limit = boundedInteger("--limit", DEFAULT_CALL_CAP);
const maxCalls = boundedInteger("--max-calls", DEFAULT_CALL_CAP);
const hasExplicitCallCap = valueFor("--max-calls") !== undefined;

if (providerId && !providers.has(providerId)) {
  console.error("Use --provider=google|apple|mapbox|osm");
  process.exit(1);
}

const allCases = await loadBenchmarkCases();
const here = dirname(fileURLToPath(import.meta.url));

if (!execute) {
  const report = buildReadinessReport(allCases, providers);
  const outputPath = resolve(here, "reports", "readiness.json");
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        ...report,
        output: outputPath,
        note: "No provider request was sent. Execution requires --execute and --allow-paid-requests.",
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!allowPaidRequests) {
  console.error(
    "External execution is locked. Add --allow-paid-requests only after quota, billing and licensing approval.",
  );
  process.exit(1);
}

if (!providerId) {
  console.error("External execution requires --provider=google|apple|mapbox|osm");
  process.exit(1);
}

if (!hasExplicitCallCap) {
  console.error("External execution requires an explicit --max-calls=<limit>");
  process.exit(1);
}

const validation = validateCases(allCases);
if (!validation.valid) {
  console.error(`Benchmark case validation failed: ${validation.errors.join("; ")}`);
  process.exit(1);
}

if (limit > maxCalls) {
  console.error(`Requested limit ${limit} exceeds explicit call cap ${maxCalls}`);
  process.exit(1);
}

const provider = providers.get(providerId);
const missingEnvironment = provider.requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length > 0) {
  console.error(`Provider skipped; missing environment names: ${missingEnvironment.join(", ")}`);
  process.exit(1);
}

const eligibleCases = allCases.filter(
  (item) => item.review_status === EXECUTION_ELIGIBLE_REVIEW_STATUS,
);
const cases = eligibleCases.slice(0, limit);
if (cases.length === 0) {
  console.error("No approved benchmark cases are eligible for external execution");
  process.exit(1);
}

const scoredRows = [];
for (const [caseIndex, testCase] of cases.entries()) {
  if (caseIndex > 0) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, provider.minimumDelayMs));
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  const startedAt = performance.now();
  try {
    const results = await provider.searchByName(testCase, { signal: controller.signal });
    const latencyMs = Math.round(performance.now() - startedAt);
    scoredRows.push(scoreCase(testCase, results, { latency_ms: latencyMs }));
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const message = error instanceof Error ? error.message : String(error);
    scoredRows.push(
      scoreCase(testCase, [], {
        latency_ms: latencyMs,
        rate_limited: message.includes("429"),
        timed_out: error?.name === "AbortError",
      }),
    );
  } finally {
    clearTimeout(timeout);
  }
}

const report = {
  provider: providerId,
  executed_at: new Date().toISOString(),
  scope: "Greater São Paulo",
  methodology_version: "1.1.0",
  raw_provider_payload_persisted: false,
  request_guard: {
    allow_paid_requests: true,
    max_calls: maxCalls,
    calls_sent: scoredRows.length,
    approved_cases_only: true,
  },
  aggregate: aggregateScores(scoredRows),
  cases: scoredRows,
};
const outputPath = resolve(here, "reports", `${providerId}-${Date.now()}.json`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      status: "complete",
      provider: providerId,
      calls_sent: scoredRows.length,
      output: outputPath,
    },
    null,
    2,
  ),
);
