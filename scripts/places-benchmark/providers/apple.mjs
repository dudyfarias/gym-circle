import { normalizeProviderResult } from "../normalizeResult.mjs";

export const appleProvider = {
  id: "apple",
  minimumDelayMs: 100,
  requiredEnvironment: ["APPLE_MAPS_TOKEN"],
  async searchByName(testCase, { signal } = {}) {
    const token = process.env.APPLE_MAPS_TOKEN;
    if (!token) throw new Error("APPLE_MAPS_TOKEN is not configured");
    const params = new URLSearchParams({
      q: testCase.name_query,
      lang: "pt-BR",
      searchLocation: `${testCase.longitude},${testCase.latitude}`,
    });
    const response = await fetch(`https://maps-api.apple.com/v1/search?${params}`, {
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
