import { normalizeProviderResult } from "../normalizeResult.mjs";

export const googleProvider = {
  id: "google",
  minimumDelayMs: 100,
  requiredEnvironment: ["GOOGLE_PLACES_API_KEY"],
  async searchByName(testCase, { signal } = {}) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.primaryType",
          "places.businessStatus",
          "places.nationalPhoneNumber",
          "places.websiteUri",
          "places.regularOpeningHours",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: testCase.name_query,
        languageCode: "pt-BR",
        regionCode: "BR",
        locationBias: {
          circle: {
            center: { latitude: testCase.latitude, longitude: testCase.longitude },
            radius: 10_000,
          },
        },
      }),
    });
    if (!response.ok) throw new Error(`Google Places returned HTTP ${response.status}`);
    const payload = await response.json();
    return (payload.places ?? []).slice(0, 5).map((result, index) =>
      normalizeProviderResult("google", result, index + 1),
    );
  },
};
