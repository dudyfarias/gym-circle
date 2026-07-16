/**
 * Proxy pra Nominatim (OpenStreetMap) — busca de academia/lugar por nome
 * + bias na localização atual do usuário.
 *
 * Por que server-side e não client?
 * 1. Nominatim exige User-Agent identificável (política de uso); não dá
 *    pra confiar em CORS + browser User-Agent.
 * 2. Esconde detalhes do provider (amanhã trocamos por Google Places ou
 *    Apple MapKit sem mexer no client).
 * 3. Permite adicionar caching/throttling sem reescrever client.
 *
 * Política Nominatim resumida:
 * - 1 req/seg por IP, no máximo
 * - User-Agent com email ou app URL é obrigatório
 * - https://operations.osmfoundation.org/policies/nominatim/
 */

import { NextResponse } from "next/server";
import {
  canRunExternalPlaceSearch,
  EXTERNAL_PLACE_SEARCH_MIN_LENGTH,
} from "../../../../lib/places/externalSearchPolicy";

type NominatimResult = {
  place_id: number;
  osm_id: number;
  osm_type: string;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city_district?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    state_code?: string;
    country_code?: string;
    house_number?: string;
  };
};

export type PlaceCandidate = {
  provider: "nominatim";
  /** ID estável do OSM — usado pra refazer match na próxima busca. */
  providerId: string;
  name: string;
  /** Endereço sintetizado pra mostrar na UI ("Rua X, 123 · Vila Mariana"). */
  address: string;
  neighborhood: string | null;
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
  /** Distância em km da posição informada pelo client (se vier). */
  distanceKm: number | null;
  /** OSM class: amenity, leisure, sport... usado pra ordenar e badgear. */
  kind: string;
};

const EARTH_RADIUS_KM = 6371;
const EXPLICIT_SEARCH_HEADER = "x-gymcircle-search-intent";
const SERVER_RATE_LIMIT_MS = 2_000;
const RATE_LIMIT_ENTRY_TTL_MS = 60_000;
const lastSearchByClient = new Map<string, number>();

function getClientKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown-client"
  );
}

function getRateLimitRetryAfterMs(request: Request, now = Date.now()): number {
  for (const [key, lastRequestAt] of lastSearchByClient) {
    if (now - lastRequestAt > RATE_LIMIT_ENTRY_TTL_MS)
      lastSearchByClient.delete(key);
  }

  const clientKey = getClientKey(request);
  const lastRequestAt = lastSearchByClient.get(clientKey) ?? 0;
  const retryAfterMs = Math.max(
    0,
    SERVER_RATE_LIMIT_MS - (now - lastRequestAt),
  );
  if (retryAfterMs === 0) lastSearchByClient.set(clientKey, now);
  return retryAfterMs;
}

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
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Heurística de "bom resultado pra fitness": academia, ginásio, estádio,
 * parque com pista... ranqueia esses por cima de cafés/bares que possam
 * vir junto com a query.
 */
function getPlaceKindScore(result: NominatimResult): number {
  const tags = [result.class, result.type].filter(Boolean) as string[];
  const joined = tags.join(":").toLowerCase();
  if (joined.includes("gym") || joined.includes("fitness_centre")) return 100;
  if (joined.includes("sports_centre") || joined.includes("sports_hall"))
    return 80;
  if (joined.includes("stadium") || joined.includes("pitch")) return 60;
  if (joined.includes("park") || joined.includes("track")) return 40;
  if (joined.includes("leisure")) return 30;
  return 10;
}

function mapResult(
  result: NominatimResult,
  origin: { lat: number; lng: number } | null,
): PlaceCandidate {
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  const address = result.address ?? {};
  const city =
    address.city ??
    address.town ??
    address.municipality ??
    address.city_district ??
    "";
  const neighborhood =
    address.suburb ?? address.neighbourhood ?? address.city_district ?? null;
  const state = address.state ?? address.state_code ?? null;

  // Endereço sintetizado pro display — sem repetir cidade/UF que já vão
  // como chips menores na UI.
  const street = [address.road, address.house_number]
    .filter(Boolean)
    .join(", ");
  const addressLine = [street, neighborhood].filter(Boolean).join(" · ");

  // Nome — Nominatim às vezes não tem `name` (POIs amplos). Cai pro
  // primeiro segmento do display_name nesses casos.
  const fallbackName =
    result.display_name?.split(",")[0]?.trim() ?? "Lugar sem nome";
  const name = (result.name?.trim() || fallbackName).slice(0, 120);

  return {
    provider: "nominatim",
    providerId: `${result.osm_type}/${result.osm_id}`,
    name,
    address:
      addressLine ||
      result.display_name?.split(",").slice(1, 3).join(", ") ||
      "",
    neighborhood,
    city,
    state,
    latitude: lat,
    longitude: lng,
    distanceKm: origin ? distanceKm(origin.lat, origin.lng, lat, lng) : null,
    kind: result.class ?? result.type ?? "place",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();
  if (!query || !canRunExternalPlaceSearch(query)) {
    return NextResponse.json(
      {
        error: `query parameter \`q\` is required (min ${EXTERNAL_PLACE_SEARCH_MIN_LENGTH} chars)`,
      },
      { status: 400 },
    );
  }

  if (request.headers.get(EXPLICIT_SEARCH_HEADER) !== "explicit") {
    return NextResponse.json(
      { error: "A busca externa exige uma ação explícita do usuário." },
      { status: 400 },
    );
  }

  const retryAfterMs = getRateLimitRetryAfterMs(request);
  if (retryAfterMs > 0) {
    return NextResponse.json(
      { error: "Aguarde um instante antes de fazer outra busca externa." },
      {
        headers: {
          "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1_000))),
        },
        status: 429,
      },
    );
  }

  const latParam = url.searchParams.get("lat");
  const lngParam = url.searchParams.get("lng");
  const lat = latParam ? parseFloat(latParam) : NaN;
  const lng = lngParam ? parseFloat(lngParam) : NaN;
  const hasOrigin = Number.isFinite(lat) && Number.isFinite(lng);
  const origin = hasOrigin ? { lat, lng } : null;

  const nominatimParams = new URLSearchParams({
    q: query,
    format: "json",
    addressdetails: "1",
    limit: "10",
    "accept-language": "pt-BR",
    countrycodes: "br",
  });

  // Bias por proximidade — viewbox de ~10km ao redor (≈ 0.09° lat/lng em SP).
  // bounded=0 = só preferência, não restrição estrita.
  if (origin) {
    const radius = 0.09;
    nominatimParams.set(
      "viewbox",
      `${origin.lng - radius},${origin.lat - radius},${origin.lng + radius},${origin.lat + radius}`,
    );
    nominatimParams.set("bounded", "0");
  }

  const nominatimUrl = `https://nominatim.openstreetmap.org/search?${nominatimParams.toString()}`;

  let nominatimResponse: Response;
  try {
    nominatimResponse = await fetch(nominatimUrl, {
      headers: {
        // User-Agent é exigência da política de uso do Nominatim.
        "User-Agent": "GymCircle/1.0 (+https://gym-circle-rust.vercel.app)",
        "Accept-Language": "pt-BR",
      },
      // Cache leve no edge da Vercel — evita martelar Nominatim com a
      // mesma query em 1 minuto (típico quando user digita rápido).
      next: { revalidate: 60 },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Não conseguimos contatar o serviço de busca. Tente de novo em alguns segundos.",
      },
      { status: 502 },
    );
  }

  if (!nominatimResponse.ok) {
    return NextResponse.json(
      { error: "Serviço de busca temporariamente indisponível." },
      { status: nominatimResponse.status },
    );
  }

  let raw: NominatimResult[];
  try {
    raw = (await nominatimResponse.json()) as NominatimResult[];
  } catch {
    return NextResponse.json(
      { error: "Resposta inválida do serviço de busca." },
      { status: 502 },
    );
  }

  // Mapeia + filtra resultados sem nome/coordenadas válidas
  const mapped = raw
    .map((result) => mapResult(result, origin))
    .filter(
      (place) =>
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude) &&
        place.name.length > 0,
    );

  // Ordenação: kind score (gym > stadium > park > outros) → distância
  const sorted = mapped.sort((a, b) => {
    const aScore = getPlaceKindScore(
      raw.find((r) => `${r.osm_type}/${r.osm_id}` === a.providerId) ??
        ({} as NominatimResult),
    );
    const bScore = getPlaceKindScore(
      raw.find((r) => `${r.osm_type}/${r.osm_id}` === b.providerId) ??
        ({} as NominatimResult),
    );
    if (aScore !== bScore) return bScore - aScore;
    if (a.distanceKm == null || b.distanceKm == null) return 0;
    return a.distanceKm - b.distanceKm;
  });

  return NextResponse.json({
    attribution: {
      label: "© OpenStreetMap contributors",
      provider: "openstreetmap",
      url: "https://www.openstreetmap.org/copyright",
    },
    results: sorted.slice(0, 8),
  });
}
