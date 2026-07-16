import type {
  EnrichedPost,
  GymLocationOption,
  PostLocationSource,
} from "./types";
import type { PlaceProvider } from "./placeProvider";

export type PlaceCandidate = {
  provider: PlaceProvider;
  providerId: string;
  gymId?: string;
  locationId?: string | null;
  placeId?: string | null;
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

export type PlaceMatchClassification =
  | "same_external_ref"
  | "exact_match"
  | "likely_match"
  | "manual_review"
  | "distinct";

export type PlaceProviderAttribution = {
  sourceLabel: string;
  attributionLabel: string | null;
  attributionUrl: string | null;
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
> & {
  locationAddress?: string | null;
  locationId?: string | null;
  placeId?: string | null;
};

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

function getPrimaryLocationId(candidate: PlaceCandidate): string | null {
  return candidate.gymId || candidate.locationId || null;
}

function getPlaceId(candidate: PlaceCandidate): string | null {
  if (candidate.placeId) return `${candidate.provider}:${candidate.placeId}`;
  if (
    candidate.provider !== "manual" &&
    candidate.provider !== "current" &&
    candidate.providerId &&
    !candidate.providerId.startsWith("registered/")
  ) {
    return `${candidate.provider}:${candidate.providerId}`;
  }
  return null;
}

export function getSearchText(candidate: PlaceCandidate): string {
  return normalizeText(
    [
      candidate.name,
      candidate.address,
      candidate.neighborhood,
      candidate.city,
      candidate.state,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

export function getSourceLabel(candidate: PlaceCandidate): string {
  return getProviderAttribution(candidate.provider).sourceLabel;
}

export function getProviderAttribution(
  provider: PlaceCandidate["provider"],
): PlaceProviderAttribution {
  if (provider === "registered") {
    return {
      sourceLabel: "Gym Circle",
      attributionLabel: null,
      attributionUrl: null,
    };
  }
  if (provider === "nominatim" || provider === "overpass") {
    return {
      sourceLabel: "OpenStreetMap",
      attributionLabel: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
    };
  }
  if (provider === "current") {
    return {
      sourceLabel: "Localização atual",
      attributionLabel: null,
      attributionUrl: null,
    };
  }
  if (provider === "google") {
    return {
      sourceLabel: "Google Maps",
      attributionLabel: "Google Maps",
      attributionUrl: "https://maps.google.com/",
    };
  }
  if (provider === "apple") {
    return {
      sourceLabel: "Apple Maps",
      attributionLabel: "Apple Maps",
      attributionUrl: "https://www.apple.com/maps/",
    };
  }
  if (provider === "mapbox") {
    return {
      sourceLabel: "Mapbox",
      attributionLabel: "© Mapbox",
      attributionUrl: "https://www.mapbox.com/about/maps/",
    };
  }
  if (provider === "community") {
    return {
      sourceLabel: "Comunidade Gym Circle",
      attributionLabel: null,
      attributionUrl: null,
    };
  }
  return {
    sourceLabel: "Contribuição",
    attributionLabel: null,
    attributionUrl: null,
  };
}

function getDistanceBetweenCandidates(
  a: PlaceCandidate,
  b: PlaceCandidate,
): number | null {
  if (
    typeof a.latitude !== "number" ||
    typeof a.longitude !== "number" ||
    typeof b.latitude !== "number" ||
    typeof b.longitude !== "number"
  ) {
    return null;
  }
  return calculateDistanceKm(
    { lat: a.latitude, lng: a.longitude },
    { lat: b.latitude, lng: b.longitude },
  );
}

function locationsConflict(a: PlaceCandidate, b: PlaceCandidate): boolean {
  const aCity = normalizeText(a.city);
  const bCity = normalizeText(b.city);
  if (aCity && bCity && aCity !== bCity) return true;

  const aAddress = normalizeText(a.address);
  const bAddress = normalizeText(b.address);
  return Boolean(aAddress && bAddress && aAddress !== bAddress);
}

/**
 * Classificação conservadora usada antes de remover um candidato duplicado.
 * Proximidade sozinha nunca prova que dois locais são o mesmo lugar: redes
 * podem ter unidades próximas e um shopping pode conter várias academias.
 */
export function classifyPlaceMatch(
  a: PlaceCandidate,
  b: PlaceCandidate,
): PlaceMatchClassification {
  const aPrimaryId = getPrimaryLocationId(a);
  const bPrimaryId = getPrimaryLocationId(b);
  if (aPrimaryId && bPrimaryId && aPrimaryId === bPrimaryId)
    return "exact_match";

  const aPlaceId = getPlaceId(a);
  const bPlaceId = getPlaceId(b);
  if (aPlaceId && bPlaceId && aPlaceId === bPlaceId) return "same_external_ref";

  const aName = normalizeText(a.name);
  const bName = normalizeText(b.name);
  if (!aName || !bName) return "distinct";

  const aAddress = normalizeText(a.address);
  const bAddress = normalizeText(b.address);
  const sameAddress = Boolean(aAddress && bAddress && aAddress === bAddress);
  const distanceKm = getDistanceBetweenCandidates(a, b);
  const nearby = distanceKm !== null && distanceKm <= 0.25;

  if (aName === bName && sameAddress && !locationsConflict(a, b)) {
    return "exact_match";
  }

  // Endereços completos diferentes são evidência suficiente para manter
  // unidades separadas, mesmo quando pertencem à mesma rede e ficam próximas.
  if (aName === bName && locationsConflict(a, b)) return "distinct";

  const nameLooksSame =
    aName === bName ||
    (aName.length > 6 && bName.includes(aName)) ||
    (bName.length > 6 && aName.includes(bName));
  if (nameLooksSame && sameAddress && !locationsConflict(a, b))
    return "likely_match";
  if (nameLooksSame && nearby && !locationsConflict(a, b))
    return "manual_review";

  // Mesmo endereço com nomes diferentes pode ser renomeação, mas também pode
  // representar dois estabelecimentos no mesmo prédio. Nunca mesclar sozinho.
  if (sameAddress && nearby) return "manual_review";

  return "distinct";
}

export function isSameApproxPlace(
  a: PlaceCandidate,
  b: PlaceCandidate,
): boolean {
  const classification = classifyPlaceMatch(a, b);
  return (
    classification === "same_external_ref" || classification === "exact_match"
  );
}

export function dedupeCandidates(
  candidates: PlaceCandidate[],
): PlaceCandidate[] {
  const deduped: PlaceCandidate[] = [];

  for (const candidate of candidates) {
    const duplicateIndex = deduped.findIndex((item) =>
      isSameApproxPlace(item, candidate),
    );
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

function dedupeRecentCandidates(
  candidates: PlaceCandidate[],
): PlaceCandidate[] {
  const deduped: PlaceCandidate[] = [];
  for (const candidate of candidates) {
    const duplicate = deduped.some((item) => {
      const classification = classifyPlaceMatch(item, candidate);
      return (
        classification === "same_external_ref" ||
        classification === "exact_match" ||
        // Isso só elimina repetição visual no histórico recente. Não faz
        // merge persistente de unidades sem endereço confirmado.
        (classification === "manual_review" &&
          normalizeText(item.name) === normalizeText(candidate.name) &&
          !normalizeText(item.address) &&
          !normalizeText(candidate.address))
      );
    });
    if (!duplicate) {
      deduped.push(candidate);
    }
  }
  return deduped;
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
    locationId: gym.id,
    placeId: null,
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
    locationId: usage.locationId ?? usage.gymId ?? null,
    placeId: usage.placeId ?? null,
    name,
    address: usage.locationAddress ?? "",
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
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .map((usage) => usageToCandidate(usage, gymsById))
    .filter((candidate): candidate is PlaceCandidate => Boolean(candidate));

  return dedupeRecentCandidates(candidates).slice(0, max);
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
