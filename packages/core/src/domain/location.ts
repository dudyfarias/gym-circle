export type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

export type ApproximateLocation = {
  label: string;
  neighborhood?: string | null;
  city?: string | null;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function buildGoogleMapsSearchUrl(query: string): string {
  const params = new URLSearchParams({ api: "1", query });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildGoogleMapsUrlFromCoordinates(coordinates: Coordinates): string {
  return buildGoogleMapsSearchUrl(`${coordinates.latitude},${coordinates.longitude}`);
}

export function calculateDistanceKm(from: Coordinates, to: Coordinates): number {
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

export function formatDistanceKm(distanceKm: number): string {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return "";
  if (distanceKm < 1) return "< 1 km";
  if (distanceKm < 10) {
    return `${distanceKm.toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0,
    })} km`;
  }
  return `${Math.round(distanceKm).toLocaleString("pt-BR")} km`;
}

export function sanitizeLocationLabel(
  source: "none" | "gym" | "current" | "custom",
  label?: string | null,
  fallback?: string | null,
): string | null {
  if (source === "none") return null;

  const value = (label ?? fallback ?? "").trim();
  const looksLikeCoordinates = /^-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?$/.test(value);

  if (source === "current") {
    return value && !looksLikeCoordinates ? value : "Localização atual";
  }

  return value || null;
}

export function createReverseGeocodingCacheKey(coordinates: Coordinates): string {
  return `${coordinates.latitude.toFixed(3)},${coordinates.longitude.toFixed(3)}`;
}

export async function resolveApproximateLocationName(
  _coordinates: Coordinates,
): Promise<ApproximateLocation | null> {
  return null;
}
