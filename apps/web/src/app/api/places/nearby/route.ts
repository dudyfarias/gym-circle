/**
 * "What's around me" — lista lugares de treino próximos das coordenadas
 * informadas, sem precisar de query text. Usado pra preencher a sheet
 * de busca antes do user digitar (Apple Maps idiom).
 *
 * Usa Overpass API (OpenStreetMap) ao invés de Nominatim porque:
 * 1. Overpass tem query language (filtra por tag tipo amenity=gym),
 *    Nominatim só faz text search.
 * 2. Resultado já vem com lat/lng + tags, não precisa de outra request
 *    pra pegar detalhes.
 *
 * Free, sem API key. Mirrors públicos: overpass-api.de, kumi.systems, etc.
 * Política: User-Agent identificável, evitar queries muito grandes.
 */

import { NextResponse } from "next/server";

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type NearbyPlace = {
  provider: "overpass";
  providerId: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number;
  kind: string;
};

const EARTH_RADIUS_KM = 6371;
const OVERPASS_TIMEOUT_MS = 6_000;
const OVERPASS_CACHE_TTL_MS = 5 * 60_000;
const OVERPASS_FAILURE_COOLDOWN_MS = 60_000;
const OVERPASS_CACHE_MAX_ENTRIES = 100;
const nearbyCache = new Map<
  string,
  { cachedAt: number; results: NearbyPlace[] }
>();
let circuitOpenUntil = 0;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getKindFromTags(tags: Record<string, string>): string {
  if (tags.leisure === "fitness_centre" || tags.amenity === "gym") return "gym";
  if (tags.leisure === "sports_centre" || tags.leisure === "sports_hall") return "sports_centre";
  if (tags.leisure === "stadium") return "stadium";
  if (tags.leisure === "track") return "track";
  if (tags.leisure === "park" || tags.leisure === "pitch") return "park";
  return "place";
}

function getKindScore(kind: string): number {
  if (kind === "gym") return 100;
  if (kind === "sports_centre") return 80;
  if (kind === "stadium") return 60;
  if (kind === "track") return 50;
  if (kind === "park") return 40;
  return 10;
}

function pickName(tags: Record<string, string>): string | null {
  // Preferência: name (nome principal), name:pt-BR, name:pt
  return (
    tags.name ||
    tags["name:pt-BR"] ||
    tags["name:pt"] ||
    tags["operator"] ||
    null
  );
}

function buildAddress(tags: Record<string, string>): string {
  const street = tags["addr:street"];
  const number = tags["addr:housenumber"];
  return [street, number].filter(Boolean).join(", ");
}

function getNeighborhood(tags: Record<string, string>): string | null {
  return tags["addr:suburb"] || tags["addr:neighbourhood"] || null;
}

function getCity(tags: Record<string, string>): string {
  return (
    tags["addr:city"] ||
    tags["is_in:city"] ||
    tags["is_in"] ||
    ""
  );
}

function getState(tags: Record<string, string>): string | null {
  return tags["addr:state"] || tags["is_in:state"] || null;
}

function getCacheKey(lat: number, lng: number, radiusMeters: number): string {
  return `${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusMeters}`;
}

function cacheNearbyResults(key: string, results: NearbyPlace[]): void {
  if (nearbyCache.size >= OVERPASS_CACHE_MAX_ENTRIES) {
    const oldestKey = nearbyCache.keys().next().value;
    if (oldestKey) nearbyCache.delete(oldestKey);
  }
  nearbyCache.set(key, { cachedAt: Date.now(), results });
}

function degradedNearbyResponse(reason: string, retryAfterSeconds = 60) {
  return NextResponse.json(
    {
      degraded: true,
      reason,
      results: [],
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": String(retryAfterSeconds),
      },
      status: 200,
    },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  const lat = latParam ? parseFloat(latParam) : NaN;
  const lng = lngParam ? parseFloat(lngParam) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat/lng required" },
      { status: 400 },
    );
  }

  const radiusMeters = Math.max(
    100,
    Math.min(
      parseInt(url.searchParams.get("radius") ?? "1500", 10) || 1500,
      2500,
    ),
  );
  const cacheKey = getCacheKey(lat, lng, radiusMeters);
  const now = Date.now();
  const cached = nearbyCache.get(cacheKey);
  if (cached && now - cached.cachedAt <= OVERPASS_CACHE_TTL_MS) {
    return NextResponse.json({ cached: true, results: cached.results });
  }
  if (now < circuitOpenUntil) {
    return degradedNearbyResponse(
      "nearby_temporarily_unavailable",
      Math.max(1, Math.ceil((circuitOpenUntil - now) / 1000)),
    );
  }

  // Overpass QL — busca nodes + ways em paralelo. Limita por radius.
  // `out center tags` retorna lat/lng do centroide (importante pra ways)
  // junto com todas as tags do elemento.
  const query = `
    [out:json][timeout:5];
    (
      nwr["leisure"="fitness_centre"](around:${radiusMeters},${lat},${lng});
      nwr["leisure"="sports_centre"](around:${radiusMeters},${lat},${lng});
      nwr["leisure"="sports_hall"](around:${radiusMeters},${lat},${lng});
      nwr["amenity"="gym"](around:${radiusMeters},${lat},${lng});
      nwr["leisure"="stadium"](around:${radiusMeters},${lat},${lng});
      nwr["leisure"="track"](around:${radiusMeters},${lat},${lng});
      nwr["leisure"="park"](around:${radiusMeters},${lat},${lng});
    );
    out center tags 24;
  `.trim();

  const overpassUrl = "https://overpass-api.de/api/interpreter";

  let overpassResponse: Response;
  try {
    overpassResponse = await fetch(overpassUrl, {
      method: "POST",
      headers: {
        "User-Agent": "GymCircle/1.0 (+https://gym-circle-rust.vercel.app)",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `data=${encodeURIComponent(query)}`,
      cache: "no-store",
      signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    });
  } catch {
    circuitOpenUntil = Date.now() + OVERPASS_FAILURE_COOLDOWN_MS;
    return degradedNearbyResponse("nearby_timeout");
  }

  if (!overpassResponse.ok) {
    circuitOpenUntil = Date.now() + OVERPASS_FAILURE_COOLDOWN_MS;
    return degradedNearbyResponse("nearby_upstream_error");
  }

  type OverpassResponse = { elements?: OverpassElement[] };
  let raw: OverpassResponse;
  try {
    raw = (await overpassResponse.json()) as OverpassResponse;
  } catch {
    circuitOpenUntil = Date.now() + OVERPASS_FAILURE_COOLDOWN_MS;
    return degradedNearbyResponse("nearby_invalid_response");
  }

  const places: NearbyPlace[] = [];
  for (const element of raw.elements ?? []) {
    const tags = element.tags ?? {};
    const name = pickName(tags);
    if (!name) continue;

    const elementLat = element.lat ?? element.center?.lat;
    const elementLng = element.lon ?? element.center?.lon;
    if (
      typeof elementLat !== "number" ||
      typeof elementLng !== "number" ||
      Number.isNaN(elementLat) ||
      Number.isNaN(elementLng)
    ) {
      continue;
    }

    const kind = getKindFromTags(tags);
    places.push({
      provider: "overpass",
      providerId: `${element.type}/${element.id}`,
      name: name.slice(0, 120),
      address: buildAddress(tags),
      neighborhood: getNeighborhood(tags),
      city: getCity(tags),
      state: getState(tags),
      latitude: elementLat,
      longitude: elementLng,
      distanceKm: distanceKm(lat, lng, elementLat, elementLng),
      kind,
    });
  }

  // Dedup por providerId (Overpass às vezes retorna node + way pro mesmo lugar)
  const dedupedByName = new Map<string, NearbyPlace>();
  for (const place of places) {
    // Chave: nome normalizado + lat/lng arredondados a 4 casas (~10m)
    const key = `${place.name.toLowerCase().trim()}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`;
    const existing = dedupedByName.get(key);
    if (!existing || getKindScore(place.kind) > getKindScore(existing.kind)) {
      dedupedByName.set(key, place);
    }
  }

  // Distância é a fonte de verdade; categoria serve apenas de desempate.
  const sorted = Array.from(dedupedByName.values()).sort((a, b) => {
    const distanceDiff = a.distanceKm - b.distanceKm;
    if (distanceDiff !== 0) return distanceDiff;
    return getKindScore(b.kind) - getKindScore(a.kind);
  });

  const results = sorted.slice(0, 16);
  cacheNearbyResults(cacheKey, results);
  circuitOpenUntil = 0;
  return NextResponse.json({ results });
}
