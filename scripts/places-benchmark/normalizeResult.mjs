const CATEGORY_ALIASES = new Map([
  ["fitness_centre", "gym"],
  ["fitness_center", "gym"],
  ["gym", "gym"],
  ["health", "gym"],
  ["crossfit", "crossfit_box"],
  ["sports_centre", "public_sports_center"],
  ["sports_center", "public_sports_center"],
  ["sports_hall", "public_sports_center"],
  ["park", "public_park"],
  ["track", "running_track"],
  ["pitch", "sports_court"],
  ["stadium", "football_field"],
  ["swimming_pool", "swimming_pool"],
  ["martial_arts", "martial_arts_gym"],
  ["pilates", "pilates_studio"],
  ["dance", "dance_studio"],
]);

export function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceM(a, b) {
  if (![a?.latitude, a?.longitude, b?.latitude, b?.longitude].every(Number.isFinite)) {
    return null;
  }
  const earthRadiusM = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      sinLng * sinLng;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function normalizeCategory(value = "") {
  const normalized = normalizeText(value).replaceAll(" ", "_");
  return CATEGORY_ALIASES.get(normalized) ?? (normalized || "other_sports_place");
}

export function normalizeProviderResult(provider, raw, rank) {
  const location = raw.location ?? raw.coordinates ?? {};
  const latitude = Number(raw.latitude ?? location.latitude ?? location.lat);
  const longitude = Number(raw.longitude ?? location.longitude ?? location.lng);
  const name = String(raw.name ?? raw.displayName?.text ?? raw.display_name ?? "").trim();
  const address = String(raw.address ?? raw.formattedAddress ?? raw.formatted_address ?? "").trim();
  return {
    provider,
    provider_id: String(raw.provider_id ?? raw.id ?? raw.place_id ?? raw.mapbox_id ?? ""),
    rank,
    name,
    normalized_name: normalizeText(name),
    address,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
    category: normalizeCategory(raw.category ?? raw.primaryType ?? raw.type ?? raw.kind),
    has_phone: Boolean(raw.phone ?? raw.nationalPhoneNumber),
    has_site: Boolean(raw.website ?? raw.websiteUri),
    has_hours: Boolean(raw.hours ?? raw.regularOpeningHours),
    business_status: raw.business_status ?? raw.businessStatus ?? null,
  };
}
