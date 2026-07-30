import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const runner = fileURLToPath(new URL("./runBenchmark.mjs", import.meta.url));
const cleanEnvironment = {
  HOME: process.env.HOME,
  PATH: process.env.PATH,
  TMPDIR: process.env.TMPDIR,
};

function run(args) {
  return spawnSync(process.execPath, [runner, ...args], {
    encoding: "utf8",
    env: cleanEnvironment,
  });
}

test("P0.6 dry-run loads only the controlled ten cases and sends zero requests", () => {
  const result = run([
    "--dry-run",
    "--subset=p0-6",
    "--limit=10",
    "--max-calls=10",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.provider_requests_sent, 0);
  assert.equal(report.validation.total_cases, 10);
  assert.equal(report.selection.case_ids[0], "GSP-160");
  assert.equal(report.execution_gate.status, "blocked_by_credentials");
  const persisted = JSON.parse(readFileSync(report.output, "utf8"));
  assert.equal(persisted.execution_gate.status, "blocked_by_credentials");
  assert.equal(persisted.selection.case_ids.length, 10);
});

test("ten-case execution is still blocked when the selected provider is not configured", () => {
  const result = run([
    "--execute",
    "--allow-paid-requests",
    "--provider=google",
    "--subset=p0-6",
    "--limit=10",
    "--max-calls=10",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing environment names: GOOGLE_PLACES_API_KEY/);
});

test("paid execution requires explicit limit and call cap", () => {
  const result = run([
    "--execute",
    "--allow-paid-requests",
    "--provider=google",
    "--subset=p0-6",
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /explicit --limit/);
  assert.match(result.stderr, /explicit --max-calls/);
});
