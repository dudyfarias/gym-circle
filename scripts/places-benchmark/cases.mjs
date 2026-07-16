import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const CASES_FILE = fileURLToPath(
  new URL("./benchmark-cases.csv", import.meta.url),
);

export const REQUIRED_COLUMNS = [
  "benchmark_case_id",
  "expected_name",
  "expected_category",
  "municipality",
  "macro_region",
  "neighborhood_or_area",
  "latitude",
  "longitude",
  "name_query",
  "category_query",
  "nearby_radius_m",
  "autocomplete_query",
  "ownership_type",
  "business_size",
  "review_status",
  "review_method",
  "review_note",
];

export const ALLOWED_REVIEW_STATUSES = new Set([
  "approved",
  "needs_correction",
  "remove",
  "duplicate",
  "uncertain",
]);

export const EXECUTION_ELIGIBLE_REVIEW_STATUS = "approved";

export function summarizeReviewStatuses(cases) {
  const counts = Object.fromEntries(
    [...ALLOWED_REVIEW_STATUSES].map((status) => [status, 0]),
  );
  const unknown = {};

  for (const item of cases) {
    if (ALLOWED_REVIEW_STATUSES.has(item.review_status)) {
      counts[item.review_status] += 1;
    } else {
      unknown[item.review_status] = (unknown[item.review_status] ?? 0) + 1;
    }
  }

  return {
    counts,
    unknown,
    total: cases.length,
    execution_eligible: counts[EXECUTION_ELIGIBLE_REVIEW_STATUS],
    all_approved: counts[EXECUTION_ELIGIBLE_REVIEW_STATUS] === cases.length,
  };
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === "," && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  values.push(current);
  return values;
}

export async function loadBenchmarkCases(path = CASES_FILE) {
  const text = await readFile(path, "utf8");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headers = parseCsvLine(lines.shift() ?? "");
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length > 0) {
    throw new Error(`Missing CSV columns: ${missingColumns.join(", ")}`);
  }

  return lines.map((line, rowIndex) => {
    const values = parseCsvLine(line);
    if (values.length !== headers.length) {
      throw new Error(
        `CSV row ${rowIndex + 2} has ${values.length} values; expected ${headers.length}`,
      );
    }
    const raw = Object.fromEntries(headers.map((header, index) => [header, values[index]]));
    return {
      ...raw,
      latitude: Number(raw.latitude),
      longitude: Number(raw.longitude),
      nearby_radius_m: Number(raw.nearby_radius_m),
    };
  });
}
