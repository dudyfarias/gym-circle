import { EXECUTION_ELIGIBLE_REVIEW_STATUS, summarizeReviewStatuses } from "./cases.mjs";
import { buildHybridCostScenarios, COST_MODEL_ASSUMPTIONS } from "./costEstimate.mjs";
import { validateCases } from "./validateCases.mjs";

export function buildProviderReadiness(providers, environment = process.env) {
  return [...providers.values()].map((provider) => {
    const missing = provider.requiredEnvironment.filter((name) => !environment[name]);
    return {
      provider: provider.id,
      status: missing.length === 0 ? "configured_not_executed" : "skipped_missing_configuration",
      required_environment_names: provider.requiredEnvironment,
      missing_environment_names: missing,
    };
  });
}

export function buildReadinessReport(cases, providers, environment = process.env) {
  const validation = validateCases(cases);
  const review = summarizeReviewStatuses(cases);
  const blockers = cases
    .filter((item) => item.review_status !== EXECUTION_ELIGIBLE_REVIEW_STATUS)
    .map((item) => ({
      benchmark_case_id: item.benchmark_case_id,
      review_status: item.review_status,
    }));

  return {
    mode: "dry-run",
    generated_at: new Date().toISOString(),
    scope: "Greater São Paulo",
    provider_requests_sent: 0,
    raw_provider_payload_persisted: false,
    validation: {
      valid_schema: validation.valid,
      errors: validation.errors,
      total_cases: cases.length,
    },
    review: {
      ...review,
      benchmark_ready: validation.valid && review.all_approved,
      blockers,
    },
    providers: buildProviderReadiness(providers, environment),
    planned_calls: {
      per_case_for_current_name_search_harness: 1,
      approved_sample_max_without_explicit_override: 5,
      full_approved_set: review.execution_eligible,
      full_catalog_after_approval: cases.length,
    },
    cost_model: {
      assumptions: COST_MODEL_ASSUMPTIONS,
      scenarios: buildHybridCostScenarios(),
    },
  };
}
