"use client";

import { calculateDistanceKm, type Coordinates } from "@gym-circle/core";

export type NormalizedPlace = {
  provider: "web" | "apple-maps";
  providerId: string;
  name: string;
  address: string;
  city: string;
  state: string | null;
  latitude: number;
  longitude: number;
  distanceKm?: number | null;
};

export type LocationProvider = {
  getCurrentPosition(): Promise<Coordinates>;
  searchPlaces(query: string, coords?: Coordinates | null): Promise<NormalizedPlace[]>;
  nearbyPlaces(coords: Coordinates): Promise<NormalizedPlace[]>;
  reverseGeocode(coords: Coordinates): Promise<NormalizedPlace | null>;
  normalizePlace(place: unknown): NormalizedPlace | null;
  calculateDistance(from: Coordinates, to: Coordinates): number;
};

function normalizePlace(place: unknown): NormalizedPlace | null {
  const candidate = place as Partial<NormalizedPlace> & {
    latitude?: unknown;
    longitude?: unknown;
  };
  if (
    !candidate ||
    typeof candidate.name !== "string" ||
    typeof candidate.latitude !== "number" ||
    typeof candidate.longitude !== "number"
  ) {
    return null;
  }

  return {
    provider: candidate.provider === "apple-maps" ? "apple-maps" : "web",
    providerId: candidate.providerId || `${candidate.latitude},${candidate.longitude}`,
    name: candidate.name,
    address: candidate.address || "",
    city: candidate.city || "",
    state: candidate.state ?? null,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    distanceKm: candidate.distanceKm ?? null,
  };
}

function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Localização indisponível neste dispositivo."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  });
}

async function searchPlaces(query: string, coords?: Coordinates | null) {
  const params = new URLSearchParams({ q: query });
  if (coords) {
    params.set("lat", String(coords.latitude));
    params.set("lng", String(coords.longitude));
  }
  const response = await fetch(`/api/places/search?${params.toString()}`);
  if (!response.ok) return [];
  const payload = (await response.json()) as { places?: unknown[] };
  return (payload.places ?? []).map(normalizePlace).filter(Boolean) as NormalizedPlace[];
}

async function nearbyPlaces(coords: Coordinates) {
  const params = new URLSearchParams({
    lat: String(coords.latitude),
    lng: String(coords.longitude),
  });
  const response = await fetch(`/api/places/nearby?${params.toString()}`);
  if (!response.ok) return [];
  const payload = (await response.json()) as { places?: unknown[] };
  return (payload.places ?? []).map(normalizePlace).filter(Boolean) as NormalizedPlace[];
}

export const CurrentWebLocationProvider: LocationProvider = {
  getCurrentPosition,
  searchPlaces,
  nearbyPlaces,
  async reverseGeocode(coords) {
    return {
      provider: "web",
      providerId: `current/${coords.latitude.toFixed(5)}/${coords.longitude.toFixed(5)}`,
      name: "Localização atual",
      address: "",
      city: "",
      state: null,
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceKm: null,
    };
  },
  normalizePlace,
  calculateDistance(from, to) {
    return calculateDistanceKm(from, to);
  },
};

export const AppleMapsProvider: LocationProvider = {
  ...CurrentWebLocationProvider,
  normalizePlace(place) {
    const normalized = normalizePlace(place);
    return normalized ? { ...normalized, provider: "apple-maps" } : null;
  },
};
