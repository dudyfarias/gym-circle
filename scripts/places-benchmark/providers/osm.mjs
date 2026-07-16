import { normalizeProviderResult } from "../normalizeResult.mjs";

const PUBLIC_NOMINATIM_HOSTS = new Set([
  "nominatim.openstreetmap.org",
]);

export const osmProvider = {
  id: "osm",
  minimumDelayMs: 1_000,
  requiredEnvironment: ["OSM_NOMINATIM_BASE_URL"],
  async searchByName(testCase, { signal } = {}) {
    const configured = process.env.OSM_NOMINATIM_BASE_URL;
    if (!configured) {
      throw new Error(
        "OSM_NOMINATIM_BASE_URL must point to an authorized commercial or self-hosted instance",
      );
    }
    const baseUrl = new URL(configured);
    if (PUBLIC_NOMINATIM_HOSTS.has(baseUrl.hostname)) {
      throw new Error("The public Nominatim service is intentionally blocked for this benchmark");
    }
    const params = new URLSearchParams({
      q: testCase.name_query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "5",
      countrycodes: "br",
      "accept-language": "pt-BR",
    });
    const response = await fetch(new URL(`/search?${params}`, baseUrl), {
      signal,
      headers: { "User-Agent": "GymCircle-Places-P0/1.0 (benchmark; no autocomplete)" },
    });
    if (!response.ok) throw new Error(`Configured Nominatim returned HTTP ${response.status}`);
    const payload = await response.json();
    return payload.slice(0, 5).map((result, index) =>
      normalizeProviderResult(
        "osm",
        {
          id: `${result.osm_type}/${result.osm_id}`,
          name: result.name ?? result.display_name?.split(",")[0],
          address: result.display_name,
          latitude: result.lat,
          longitude: result.lon,
          category: result.type ?? result.class,
        },
        index + 1,
      ),
    );
  },
};
