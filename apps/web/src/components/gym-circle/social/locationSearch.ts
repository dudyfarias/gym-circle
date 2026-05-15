import type { EnrichedPost, GymLocationOption, PostLocationSource } from "./types";

export type PlaceCandidate = {
  provider: "registered" | "nominatim" | "overpass" | "manual" | "current";
  providerId: string;
  gymId?: string;
  name: string;
  address: string;
  neighborhood: string | null;
  city: string;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  kind: string;
};

export type LocatedPlaceCandidate = PlaceCandidate & {
  latitude: number;
  longitude: number;
};

export type LocationUsage = Pick<
  EnrichedPost,
  | "createdAt"
  | "gymId"
  | "gymName"
  | "id"
  | "locationLatitude"
  | "locationLongitude"
  | "locationName"
  | "locationSource"
  | "userId"
>;

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number | null): string {
  if (km === null) return "";
  if (km < 0.1) return "aqui";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")}km`;
  return `${Math.round(km)}km`;
}

export function getKindLabel(kind: string): string {
  const lc = kind.toLowerCase();
  if (lc.includes("gym") || lc.includes("fitness")) return "Academia";
  if (lc.includes("studio")) return "Estúdio";
  if (lc.includes("sport")) return "Esporte";
  if (lc.includes("stadium") || lc.includes("pitch")) return "Estádio";
  if (lc.includes("park") || lc.includes("track")) return "Parque";
  return "Lugar";
}

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

export function getSearchText(candidate: PlaceCandidate): string {
  return normalizeText(
    [candidate.name, candidate.address, candidate.neighborhood, candidate.city, candidate.state]
      .filter(Boolean)
      .join(" "),
  );
}

export function getSourceLabel(candidate: PlaceCandidate): string {
  if (candidate.provider === "registered") return "Cadastrada";
  if (candidate.provider === "overpass") return "Próxima";
  if (candidate.provider === "nominatim") return "Google/Localização";
  if (candidate.provider === "current") return "Atual";
  return "Manual";
}

export function isSameApproxPlace(a: PlaceCandidate, b: PlaceCandidate): boolean {
  const aName = normalizeText(a.name);
  const bName = normalizeText(b.name);
  if (!aName || !bName) return false;

  const nameLooksSame =
    aName === bName ||
    (aName.length > 6 && bName.includes(aName)) ||
    (bName.length > 6 && aName.includes(bName));
  if (!nameLooksSame) return false;

  if (
    typeof a.latitude === "number" &&
    typeof a.longitude === "number" &&
    typeof b.latitude === "number" &&
    typeof b.longitude === "number"
  ) {
    return (
      calculateDistanceKm(
        { lat: a.latitude, lng: a.longitude },
        { lat: b.latitude, lng: b.longitude },
      ) <= 0.25
    );
  }

  const aCity = normalizeText(a.city);
  const bCity = normalizeText(b.city);
  const sameCity = Boolean(aCity && bCity && aCity === bCity);
  const aAddress = normalizeText(a.address);
  const bAddress = normalizeText(b.address);
  const sameAddress =
    Boolean(aAddress && bAddress && aAddress === bAddress) ||
    Boolean(aAddress && bAddress && aAddress.includes(bAddress)) ||
    Boolean(aAddress && bAddress && bAddress.includes(aAddress));

  return sameCity || sameAddress;
}

export function dedupeCandidates(candidates: PlaceCandidate[]): PlaceCandidate[] {
  const deduped: PlaceCandidate[] = [];

  for (const candidate of candidates) {
    const duplicateIndex = deduped.findIndex((item) => isSameApproxPlace(item, candidate));
    if (duplicateIndex === -1) {
      deduped.push(candidate);
      continue;
    }

    if (
      candidate.provider === "registered" &&
      deduped[duplicateIndex]?.provider !== "registered"
    ) {
      deduped[duplicateIndex] = candidate;
    }
  }

  return deduped;
}

export function withoutDuplicateCandidates(
  candidates: PlaceCandidate[],
  excluded: PlaceCandidate[],
): PlaceCandidate[] {
  return candidates.filter(
    (candidate) => !excluded.some((item) => isSameApproxPlace(item, candidate)),
  );
}

export function gymToCandidate(
  gym: GymLocationOption,
  coords: { lat: number; lng: number } | null,
): PlaceCandidate {
  const hasCoordinates =
    typeof gym.latitude === "number" && typeof gym.longitude === "number";
  return {
    provider: "registered",
    providerId: `registered/${gym.id}`,
    gymId: gym.id,
    name: gym.name,
    address: gym.address ?? "",
    neighborhood: null,
    city: gym.city ?? "",
    state: gym.state ?? null,
    latitude: gym.latitude ?? null,
    longitude: gym.longitude ?? null,
    distanceKm:
      coords && hasCoordinates
        ? calculateDistanceKm(coords, {
            lat: gym.latitude as number,
            lng: gym.longitude as number,
          })
        : null,
    kind: "gym",
  };
}

function usageToCandidate(
  usage: LocationUsage,
  gymsById: Map<string, GymLocationOption>,
): PlaceCandidate | null {
  const gym = usage.gymId ? gymsById.get(usage.gymId) : null;
  if (gym) return gymToCandidate(gym, null);

  const name = (usage.locationName || usage.gymName || "").trim();
  if (!name) return null;

  const hasCoordinates =
    typeof usage.locationLatitude === "number" &&
    typeof usage.locationLongitude === "number";
  if (!usage.gymId && !hasCoordinates) return null;

  const provider =
    usage.locationSource === "current" ? "current" : ("manual" as const);

  return {
    provider,
    providerId: `${provider}/${usage.id}`,
    gymId: usage.gymId || undefined,
    name,
    address: "",
    neighborhood: null,
    city: "",
    state: null,
    latitude: hasCoordinates ? usage.locationLatitude : null,
    longitude: hasCoordinates ? usage.locationLongitude : null,
    distanceKm: null,
    kind: sourceToKind(usage.locationSource),
  };
}

function sourceToKind(source: PostLocationSource): string {
  if (source === "gym") return "gym";
  if (source === "current") return "current";
  return "place";
}

export function getRecentPostLocations(
  userId: string,
  usages: LocationUsage[],
  registeredGyms: GymLocationOption[] = [],
  max = 3,
): PlaceCandidate[] {
  const gymsById = new Map(registeredGyms.map((gym) => [gym.id, gym]));
  const candidates = usages
    .filter((usage) => usage.userId === userId)
    .filter((usage) => usage.locationSource !== "none")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((usage) => usageToCandidate(usage, gymsById))
    .filter((candidate): candidate is PlaceCandidate => Boolean(candidate));

  return dedupeCandidates(candidates).slice(0, max);
}

export function getRegisteredSearchCandidates({
  coords,
  query,
  registeredGyms,
}: {
  coords: { lat: number; lng: number } | null;
  query: string;
  registeredGyms: GymLocationOption[];
}): PlaceCandidate[] {
  const normalizedQuery = normalizeText(query.trim());
  const candidates = registeredGyms.map((gym) => gymToCandidate(gym, coords));

  const filtered = candidates.filter((candidate) => {
    if (normalizedQuery.length >= 2) {
      return getSearchText(candidate).includes(normalizedQuery);
    }
    if (coords && candidate.distanceKm !== null) {
      return candidate.distanceKm <= 8;
    }
    return false;
  });

  return filtered
    .sort((a, b) => {
      if (a.distanceKm !== null && b.distanceKm !== null) {
        return a.distanceKm - b.distanceKm;
      }
      if (a.distanceKm !== null) return -1;
      if (b.distanceKm !== null) return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    })
    .slice(0, coords ? 30 : 40);
}

export function buildLocationResultSections({
  apiResults,
  coords,
  currentLocationCandidate,
  query,
  recentCandidates,
  registeredGyms,
}: {
  apiResults: PlaceCandidate[];
  coords: { lat: number; lng: number } | null;
  currentLocationCandidate?: PlaceCandidate | null;
  query: string;
  recentCandidates: PlaceCandidate[];
  registeredGyms: GymLocationOption[];
}) {
  const trimmed = query.trim();
  const isSearching = trimmed.length >= 2;
  const registeredCandidates = getRegisteredSearchCandidates({
    coords,
    query: trimmed,
    registeredGyms,
  });

  if (isSearching) {
    return {
      isSearching,
      nearby: [],
      recent: [],
      search: dedupeCandidates([...registeredCandidates, ...apiResults]),
    };
  }

  const recent = dedupeCandidates(recentCandidates).slice(0, 3);
  const nearbyBase = dedupeCandidates([
    ...(currentLocationCandidate ? [currentLocationCandidate] : []),
    ...registeredCandidates,
    ...apiResults,
  ]);

  return {
    isSearching,
    nearby: withoutDuplicateCandidates(nearbyBase, recent),
    recent,
    search: [],
  };
}
