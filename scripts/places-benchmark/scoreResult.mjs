import { haversineDistanceM, normalizeText } from "./normalizeResult.mjs";

function nameSimilarity(expected, actual) {
  const a = normalizeText(expected);
  const b = normalizeText(actual);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const intersection = [...aTokens].filter((token) => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

const GENERIC_NAME_TOKENS = new Set([
  "academia",
  "barra",
  "centro",
  "fitness",
  "funda",
  "gym",
  "parque",
  "paulo",
  "sao",
  "sp",
  "unidade",
]);

function hasDistinctiveTokenMatch(expected, actual) {
  const expectedTokens = normalizeText(expected).split(" ");
  const actualTokens = new Set(normalizeText(actual).split(" "));
  return expectedTokens.some(
    (token) => token.length >= 5 && !GENERIC_NAME_TOKENS.has(token) && actualTokens.has(token),
  );
}

function matchConfidence(expected, result) {
  const similarity = nameSimilarity(expected.expected_name, result.name);
  const distance = haversineDistanceM(expected, result);
  if (similarity >= 0.55) return similarity;
  if (distance !== null && distance <= 300 && hasDistinctiveTokenMatch(expected.expected_name, result.name)) {
    return 0.8;
  }
  return similarity;
}

function coverageStatus(best, expected) {
  if (!best) return "not_found";
  if (best.business_status === "CLOSED_PERMANENTLY") return "closed_or_outdated";
  const confidence = matchConfidence(expected, best);
  const distance = haversineDistanceM(expected, best);
  if (confidence >= 0.8 && (distance === null || distance <= 2_500)) return "found_correct";
  if (confidence >= 0.8) return "found_wrong_unit";
  if (confidence >= 0.55) return "ambiguous";
  return "found_wrong_place";
}

function findBestMatch(expected, results) {
  return results
    .map((result) => ({
      result,
      name_score: nameSimilarity(expected.expected_name, result.name),
      match_confidence: matchConfidence(expected, result),
      distance_m: haversineDistanceM(expected, result),
    }))
    .sort((a, b) => {
      if (a.match_confidence !== b.match_confidence) {
        return b.match_confidence - a.match_confidence;
      }
      return (a.distance_m ?? Number.POSITIVE_INFINITY) -
        (b.distance_m ?? Number.POSITIVE_INFINITY);
    })[0] ?? null;
}

export function scoreCase(expected, results, performance = {}) {
  const best = findBestMatch(expected, results);
  const matched = best?.result ?? null;
  const rank = best && best.match_confidence >= 0.55 ? matched?.rank ?? null : null;
  const duplicates = results.filter(
    (result) =>
      matched &&
      result !== matched &&
      nameSimilarity(matched.name, result.name) >= 0.9 &&
      (haversineDistanceM(matched, result) ?? Number.POSITIVE_INFINITY) <= 75,
  ).length;
  const qualityFields = matched
    ? [
        Boolean(matched.name),
        Boolean(matched.address),
        Number.isFinite(matched.latitude),
        Number.isFinite(matched.longitude),
        Boolean(matched.category),
      ]
    : [];

  return {
    benchmark_case_id: expected.benchmark_case_id,
    coverage_status: coverageStatus(matched, expected),
    human_review_status: "pending",
    relevance_rank: rank,
    relevance_bucket:
      rank === 1 ? "top_1" : rank && rank <= 3 ? "top_3" : rank && rank <= 5 ? "top_5" : rank ? "outside_top_5" : "not_found",
    name_similarity: best?.name_score ?? 0,
    match_confidence: best?.match_confidence ?? 0,
    coordinate_distance_m: best?.distance_m ?? null,
    data_quality_score:
      qualityFields.length === 0
        ? 0
        : qualityFields.filter(Boolean).length / qualityFields.length,
    duplicate_count: duplicates,
    field_presence: matched
      ? {
          address: Boolean(matched.address),
          business_status: Boolean(matched.business_status),
          category: Boolean(matched.category),
          coordinates:
            Number.isFinite(matched.latitude) &&
            Number.isFinite(matched.longitude),
          hours: matched.has_hours,
          name: Boolean(matched.name),
          phone: matched.has_phone,
          site: matched.has_site,
        }
      : null,
    human_review_snapshot: {
      matched_result: matched
        ? {
            name: matched.name,
            address: matched.address,
            latitude: matched.latitude,
            longitude: matched.longitude,
            category: matched.category,
            rank: matched.rank,
          }
        : null,
      top_candidates: results.slice(0, 5).map((result) => ({
        name: result.name,
        address: result.address,
        latitude: result.latitude,
        longitude: result.longitude,
        category: result.category,
        rank: result.rank,
      })),
    },
    latency_ms: performance.latency_ms ?? null,
    timed_out: Boolean(performance.timed_out),
    rate_limited: Boolean(performance.rate_limited),
  };
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

export function aggregateScores(rows) {
  const found = rows.filter((row) => row.coverage_status === "found_correct");
  const latencies = rows.map((row) => row.latency_ms).filter(Number.isFinite);
  return {
    cases: rows.length,
    coverage_score: rows.length ? found.length / rows.length : null,
    relevance_top_1: rows.length ? rows.filter((row) => row.relevance_rank === 1).length / rows.length : null,
    relevance_top_3: rows.length ? rows.filter((row) => row.relevance_rank && row.relevance_rank <= 3).length / rows.length : null,
    data_quality_score: found.length
      ? found.reduce((sum, row) => sum + row.data_quality_score, 0) / found.length
      : null,
    duplicate_rate: rows.length
      ? rows.filter((row) => row.duplicate_count > 0).length / rows.length
      : null,
    latency_p50_ms: percentile(latencies, 0.5),
    latency_p95_ms: percentile(latencies, 0.95),
    failure_rate: rows.length
      ? rows.filter((row) => row.timed_out || row.rate_limited).length / rows.length
      : null,
  };
}
