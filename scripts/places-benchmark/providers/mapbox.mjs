import { randomUUID } from "node:crypto";
import { normalizeProviderResult } from "../normalizeResult.mjs";

export const mapboxProvider = {
  id: "mapbox",
  minimumDelayMs: 100,
  requiredEnvironment: ["MAPBOX_ACCESS_TOKEN"],
  async searchByName(testCase, { signal } = {}) {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) throw new Error("MAPBOX_ACCESS_TOKEN is not configured");
    const sessionToken = randomUUID();
    const params = new URLSearchParams({
      q: testCase.name_query,
      access_token: token,
      session_token: sessionToken,
      country: "br",
      language: "pt",
      proximity: `${testCase.longitude},${testCase.latitude}`,
      limit: "5",
    });
    const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`, {
      signal,
    });
    if (!response.ok) throw new Error(`Mapbox Search Box returned HTTP ${response.status}`);
    const payload = await response.json();
    return (payload.suggestions ?? []).slice(0, 5).map((result, index) =>
      normalizeProviderResult(
        "mapbox",
        {
          id: result.mapbox_id,
          name: result.name,
          address: result.full_address ?? result.place_formatted,
          category: result.poi_category?.[0] ?? result.feature_type,
        },
        index + 1,
      ),
    );
  },
};
