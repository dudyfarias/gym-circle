import assert from "node:assert/strict";
import test from "node:test";

import { appleProvider } from "./apple.mjs";
import { googleProvider } from "./google.mjs";
import { mapboxProvider } from "./mapbox.mjs";
import { osmProvider } from "./osm.mjs";

const benchmarkCase = {
  latitude: -23.525,
  longitude: -46.667,
  name_query: "Ironberg Barra Funda",
};

function jsonResponse(payload) {
  return {
    ok: true,
    async json() {
      return payload;
    },
  };
}

test("Apple sends searchLocation in documented longitude,latitude order", async () => {
  process.env.APPLE_MAPS_TOKEN = "test-token";
  let requestedUrl = "";
  await appleProvider.searchByName(benchmarkCase, {
    request: async (url) => {
      requestedUrl = String(url);
      return jsonResponse({ results: [] });
    },
  });
  assert.equal(new URL(requestedUrl).searchParams.get("searchLocation"), "-46.667,-23.525");
  delete process.env.APPLE_MAPS_TOKEN;
});

test("Google uses one text-search request with geographic bias", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-key";
  let calls = 0;
  let body = null;
  let fieldMask = "";
  await googleProvider.searchByName(benchmarkCase, {
    request: async (_url, init) => {
      calls += 1;
      body = JSON.parse(init.body);
      fieldMask = init.headers["X-Goog-FieldMask"];
      return jsonResponse({ places: [] });
    },
  });
  assert.equal(calls, 1);
  assert.equal(body.languageCode, "pt-BR");
  assert.equal(body.regionCode, "BR");
  assert.equal(body.locationBias.circle.center.longitude, benchmarkCase.longitude);
  assert.equal(fieldMask.includes("nationalPhoneNumber"), false);
  assert.equal(fieldMask.includes("regularOpeningHours"), false);
  delete process.env.GOOGLE_PLACES_API_KEY;
});

test("Mapbox uses one-off forward search and normalizes coordinates", async () => {
  process.env.MAPBOX_ACCESS_TOKEN = "test-token";
  let requestedUrl = "";
  const results = await mapboxProvider.searchByName(benchmarkCase, {
    request: async (url) => {
      requestedUrl = String(url);
      return jsonResponse({
        features: [
          {
            geometry: { coordinates: [-46.668, -23.526] },
            properties: {
              mapbox_id: "test-place",
              name: "Ironberg Barra Funda",
              full_address: "São Paulo, SP",
              feature_type: "poi",
            },
          },
        ],
      });
    },
  });
  assert.equal(new URL(requestedUrl).pathname.endsWith("/forward"), true);
  assert.equal(results[0].latitude, -23.526);
  assert.equal(results[0].longitude, -46.668);
  delete process.env.MAPBOX_ACCESS_TOKEN;
});

test("OSM preserves an authorized endpoint path and blocks public Nominatim", async () => {
  process.env.OSM_NOMINATIM_BASE_URL = "https://places.example.test/nominatim/";
  let requestedUrl = "";
  await osmProvider.searchByName(benchmarkCase, {
    request: async (url) => {
      requestedUrl = String(url);
      return jsonResponse([]);
    },
  });
  assert.equal(new URL(requestedUrl).pathname, "/nominatim/search");

  process.env.OSM_NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
  await assert.rejects(
    () => osmProvider.searchByName(benchmarkCase, { request: async () => jsonResponse([]) }),
    /public Nominatim service is intentionally blocked/,
  );
  delete process.env.OSM_NOMINATIM_BASE_URL;
});
