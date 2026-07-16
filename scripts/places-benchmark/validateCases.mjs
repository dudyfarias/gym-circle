import {
  ALLOWED_REVIEW_STATUSES,
  loadBenchmarkCases,
  REQUIRED_COLUMNS,
  summarizeReviewStatuses,
} from "./cases.mjs";

const ALLOWED_CATEGORIES = new Set([
  "gym",
  "gym_chain",
  "neighborhood_gym",
  "crossfit_box",
  "functional_studio",
  "pilates_studio",
  "dance_studio",
  "martial_arts_gym",
  "sports_club",
  "public_park",
  "running_track",
  "sports_court",
  "football_field",
  "swimming_pool",
  "public_sports_center",
  "calisthenics_area",
  "cycling_route",
  "rehabilitation_center",
  "other_sports_place",
]);

const REQUIRED_MUNICIPALITIES = new Set([
  "São Paulo",
  "Guarulhos",
  "Osasco",
  "Barueri",
  "Santana de Parnaíba",
  "Carapicuíba",
  "Cotia",
  "Taboão da Serra",
  "Embu das Artes",
  "Santo André",
  "São Bernardo do Campo",
  "São Caetano do Sul",
  "Diadema",
  "Mauá",
  "Mogi das Cruzes",
]);

export function validateCases(cases) {
  const errors = [];
  if (cases.length < 150 || cases.length > 200) {
    errors.push(`Expected 150-200 cases; found ${cases.length}`);
  }

  const ids = new Set();
  for (const [index, item] of cases.entries()) {
    for (const column of REQUIRED_COLUMNS) {
      if (item[column] === "" || item[column] === undefined || item[column] === null) {
        errors.push(`Row ${index + 2}: ${column} is required`);
      }
    }
    if (ids.has(item.benchmark_case_id)) {
      errors.push(`Duplicate id: ${item.benchmark_case_id}`);
    }
    ids.add(item.benchmark_case_id);
    if (!ALLOWED_CATEGORIES.has(item.expected_category)) {
      errors.push(`Invalid category: ${item.expected_category}`);
    }
    if (!ALLOWED_REVIEW_STATUSES.has(item.review_status)) {
      errors.push(`Invalid review status: ${item.review_status}`);
    }
    if (
      !Number.isFinite(item.latitude) ||
      !Number.isFinite(item.longitude) ||
      item.latitude < -24.2 ||
      item.latitude > -22.8 ||
      item.longitude < -47.3 ||
      item.longitude > -45.7
    ) {
      errors.push(`Out-of-scope coordinate: ${item.benchmark_case_id}`);
    }
  }

  const municipalities = new Set(cases.map((item) => item.municipality));
  for (const municipality of REQUIRED_MUNICIPALITIES) {
    if (!municipalities.has(municipality)) errors.push(`Missing municipality: ${municipality}`);
  }

  for (const type of ["public", "private"]) {
    if (!cases.some((item) => item.ownership_type === type)) {
      errors.push(`Missing ownership type: ${type}`);
    }
  }

  const macroRegions = new Set(cases.map((item) => item.macro_region));
  for (const region of ["Centro", "Zona Oeste", "Zona Sul", "Zona Norte", "Zona Leste", "Região Metropolitana"]) {
    if (!macroRegions.has(region)) errors.push(`Missing macro region: ${region}`);
  }

  return { errors, valid: errors.length === 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cases = await loadBenchmarkCases();
  const result = validateCases(cases);
  const review = summarizeReviewStatuses(cases);
  if (!result.valid) {
    console.error(result.errors.join("\n"));
    process.exitCode = 1;
  } else {
    const categories = new Set(cases.map((item) => item.expected_category));
    const municipalities = new Set(cases.map((item) => item.municipality));
    console.log(
      JSON.stringify(
        {
          status: "valid",
          cases: cases.length,
          categories: categories.size,
          municipalities: municipalities.size,
          review_statuses: review.counts,
          execution_eligible: review.execution_eligible,
          benchmark_ready: review.all_approved,
        },
        null,
        2,
      ),
    );
  }
}
