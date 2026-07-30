import { normalizeProviderResult } from "../normalizeResult.mjs";

export const mapboxProvider = {
  id: "mapbox",
  minimumDelayMs: 100,
  requiredEnvironment: ["MAPBOX_ACCESS_TOKEN"],
  async searchByName(testCase, { request = fetch, signal } = {}) {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) throw new Error("MAPBOX_ACCESS_TOKEN is not configured");
    const params = new URLSearchParams({
      q: testCase.name_query,
      access_token: token,
      country: "br",
      language: "pt",
      proximity: `${testCase.longitude},${testCase.latitude}`,
      limit: "5",
    });
    const response = await request(`https://api.mapbox.com/search/searchbox/v1/forward?${params}`, {
      signal,
    });
    if (!response.ok) throw new Error(`Mapbox Search Box returned HTTP ${response.status}`);
    const payload = await response.json();
    return (payload.features ?? []).slice(0, 5).map((result, index) =>
      normalizeProviderResult(
        "mapbox",
        {
          id: result.properties?.mapbox_id,
          name: result.properties?.name,
          address:
            result.properties?.full_address ??
            result.properties?.place_formatted,
          category:
            result.properties?.poi_category?.[0] ??
            result.properties?.feature_type,
          latitude:
            result.properties?.coordinates?.latitude ??
            result.geometry?.coordinates?.[1],
          longitude:
            result.properties?.coordinates?.longitude ??
            result.geometry?.coordinates?.[0],
        },
        index + 1,
      ),
    );
  },
};
