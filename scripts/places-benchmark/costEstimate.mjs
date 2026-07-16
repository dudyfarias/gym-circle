export const PRODUCT_SCENARIOS = [
  { id: "small", monthly_active_users: 1_000, searches_per_user: 5 },
  { id: "medium", monthly_active_users: 10_000, searches_per_user: 10 },
  { id: "large", monthly_active_users: 100_000, searches_per_user: 15 },
];

export const LOCAL_RESOLUTION_RATES = [0, 0.3, 0.7];

const GOOGLE_SKUS = {
  text_search_pro: {
    free: 5_000,
    tiers: [
      [95_000, 32],
      [400_000, 25.6],
      [500_000, 19.2],
      [4_000_000, 9.6],
    ],
  },
  nearby_search_pro: {
    free: 5_000,
    tiers: [
      [95_000, 32],
      [400_000, 25.6],
      [500_000, 19.2],
      [4_000_000, 9.6],
    ],
  },
  place_details_essentials: {
    free: 10_000,
    tiers: [
      [90_000, 5],
      [400_000, 4],
      [500_000, 3],
      [4_000_000, 1.5],
    ],
  },
  reverse_geocoding: {
    free: 10_000,
    tiers: [
      [90_000, 5],
      [400_000, 4],
      [500_000, 3],
      [4_000_000, 1.5],
    ],
  },
  dynamic_map_load: {
    free: 10_000,
    tiers: [
      [90_000, 7],
      [400_000, 5.6],
      [500_000, 4.2],
      [4_000_000, 2.1],
    ],
  },
};

function tieredCost(requests, sku) {
  let remaining = Math.max(0, requests - sku.free);
  let cost = 0;
  for (const [capacity, usdPerThousand] of sku.tiers) {
    const billed = Math.min(remaining, capacity);
    cost += (billed / 1_000) * usdPerThousand;
    remaining -= billed;
    if (remaining <= 0) break;
  }
  return cost;
}

export function estimateRequestMix(totalSearches, localResolutionRate) {
  const externalSearches = Math.round(totalSearches * (1 - localResolutionRate));
  return {
    total_searches: totalSearches,
    local_resolution_rate: localResolutionRate,
    internally_resolved_searches: totalSearches - externalSearches,
    external_searches: externalSearches,
    calls: {
      autocomplete_sessions: externalSearches,
      text_search_pro: Math.round(externalSearches * 0.5),
      nearby_search_pro: Math.round(externalSearches * 0.5),
      place_details_essentials: externalSearches,
      reverse_geocoding: Math.round(externalSearches * 0.2),
      dynamic_map_load: Math.round(externalSearches * 0.25),
    },
  };
}

export function estimateGoogleCostUsd(requestMix) {
  const billableSkuCosts = Object.fromEntries(
    Object.entries(GOOGLE_SKUS).map(([id, sku]) => [
      id,
      tieredCost(requestMix.calls[id] ?? 0, sku),
    ]),
  );
  const total = Object.values(billableSkuCosts).reduce((sum, value) => sum + value, 0);
  return {
    currency: "USD",
    estimated_total: Number(total.toFixed(2)),
    by_sku: Object.fromEntries(
      Object.entries(billableSkuCosts).map(([id, value]) => [id, Number(value.toFixed(2))]),
    ),
  };
}

export function buildHybridCostScenarios() {
  return PRODUCT_SCENARIOS.flatMap((scenario) => {
    const totalSearches = scenario.monthly_active_users * scenario.searches_per_user;
    return LOCAL_RESOLUTION_RATES.map((localResolutionRate) => {
      const requestMix = estimateRequestMix(totalSearches, localResolutionRate);
      return {
        scenario: scenario.id,
        monthly_active_users: scenario.monthly_active_users,
        searches_per_user: scenario.searches_per_user,
        ...requestMix,
        google_estimate: estimateGoogleCostUsd(requestMix),
      };
    });
  });
}

export const COST_MODEL_ASSUMPTIONS = {
  pricing_snapshot: "2026-07-10",
  autocomplete: "Completed autocomplete sessions are modeled at USD 0.",
  search_mix: "Each external search is split 50% text search and 50% nearby search.",
  details: "One Place Details Essentials request per external search.",
  reverse_geocoding: "20% of external searches use reverse geocoding.",
  maps: "25% of external searches load a dynamic web map.",
  caveat: "Planning estimate only; field masks, session completion, volume tiers, tax, FX and provider contract can change the bill.",
};
