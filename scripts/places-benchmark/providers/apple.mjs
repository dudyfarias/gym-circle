import { normalizeProviderResult } from "../normalizeResult.mjs";
import {
  getAppleMapsAccessToken,
  hasAppleMapsSigningConfiguration,
} from "./appleAuth.mjs";

export const appleProvider = {
  id: "apple",
  minimumDelayMs: 100,
  requiredEnvironment: ["APPLE_MAPS_TOKEN"],
  environmentAlternatives: [
    ["APPLE_MAPS_TOKEN"],
    ["APPLE_MAPS_TEAM_ID", "APPLE_MAPS_KEY_ID", "APPLE_MAPS_PRIVATE_KEY_PATH"],
  ],
  isConfigured(environment = process.env) {
    return Boolean(environment.APPLE_MAPS_TOKEN) || hasAppleMapsSigningConfiguration(environment);
  },
  async searchByName(testCase, { request = fetch, signal } = {}) {
    const token = await getAppleMapsAccessToken({ request, signal });
    const params = new URLSearchParams({
      q: testCase.name_query,
      lang: "pt-BR",
      searchLocation: `${testCase.longitude},${testCase.latitude}`,
    });
    const response = await request(`https://maps-api.apple.com/v1/search?${params}`, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error(`Apple Maps Server API returned HTTP ${response.status}`);
    const payload = await response.json();
    return (payload.results ?? []).slice(0, 5).map((result, index) =>
      normalizeProviderResult(
        "apple",
        {
          ...result,
          id: result.id,
          name: result.name,
          address: result.formattedAddressLines?.join(" ") ?? result.formattedAddress,
          latitude: result.coordinate?.latitude,
          longitude: result.coordinate?.longitude,
          category: result.poiCategory,
        },
        index + 1,
      ),
    );
  },
};
