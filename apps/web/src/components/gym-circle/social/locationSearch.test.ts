import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocationResultSections,
  getRecentPostLocations,
  type LocationUsage,
  type PlaceCandidate,
} from "./locationSearch";
import type { GymLocationOption } from "./types";

const gym: GymLocationOption = {
  id: "gym-1",
  name: "Bluefit Paulista",
  address: "Av. Paulista, 1000",
  city: "São Paulo",
  state: "SP",
  latitude: -23.561,
  longitude: -46.656,
};

function usage(input: Partial<LocationUsage> & { id: string }): LocationUsage {
  return {
    createdAt: input.createdAt ?? "2026-05-14T12:00:00.000Z",
    gymId: input.gymId ?? "",
    gymName: input.gymName ?? "",
    id: input.id,
    locationLatitude: input.locationLatitude ?? null,
    locationLongitude: input.locationLongitude ?? null,
    locationName: input.locationName ?? null,
    locationSource: input.locationSource ?? "none",
    userId: input.userId ?? "user-1",
  };
}

function apiCandidate(input: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    provider: input.provider ?? "overpass",
    providerId: input.providerId ?? "api-1",
    name: input.name ?? "Parque Ibirapuera",
    address: input.address ?? "Av. Pedro Álvares Cabral",
    neighborhood: input.neighborhood ?? null,
    city: input.city ?? "São Paulo",
    state: input.state ?? "SP",
    latitude: input.latitude ?? -23.587,
    longitude: input.longitude ?? -46.657,
    distanceKm: input.distanceKm ?? 1.5,
    kind: input.kind ?? "park",
  };
}

describe("post location search", () => {
  it("mostra no máximo 3 recentes, ordenados e sem duplicar lugar", () => {
    const recent = getRecentPostLocations(
      "user-1",
      [
        usage({ id: "older-duplicate", createdAt: "2026-05-10T12:00:00.000Z", gymId: gym.id, gymName: gym.name, locationSource: "gym" }),
        usage({ id: "recent-gym", createdAt: "2026-05-14T12:00:00.000Z", gymId: gym.id, gymName: gym.name, locationSource: "gym" }),
        usage({ id: "park", createdAt: "2026-05-13T12:00:00.000Z", locationName: "Parque Villa-Lobos", locationSource: "current", locationLatitude: -23.546, locationLongitude: -46.725 }),
        usage({ id: "studio", createdAt: "2026-05-12T12:00:00.000Z", locationName: "Studio Flow", locationSource: "current", locationLatitude: -23.56, locationLongitude: -46.64 }),
        usage({ id: "fourth", createdAt: "2026-05-11T12:00:00.000Z", locationName: "Pista USP", locationSource: "current", locationLatitude: -23.56, locationLongitude: -46.73 }),
      ],
      [gym],
    );

    expect(recent).toHaveLength(3);
    expect(recent.map((item) => item.name)).toEqual([
      "Bluefit Paulista",
      "Parque Villa-Lobos",
      "Studio Flow",
    ]);
  });

  it("mistura cadastradas e API em Perto de você quando há GPS", () => {
    const sections = buildLocationResultSections({
      apiResults: [apiCandidate()],
      coords: { lat: -23.561, lng: -46.656 },
      query: "",
      recentCandidates: [],
      registeredGyms: [gym],
    });

    expect(sections.nearby.map((item) => item.name)).toEqual([
      "Bluefit Paulista",
      "Parque Ibirapuera",
    ]);
  });

  it("busca manual retorna resultados por texto e prioriza cadastradas em duplicatas", () => {
    const sections = buildLocationResultSections({
      apiResults: [
        apiCandidate({
          provider: "nominatim",
          providerId: "google-bluefit",
          name: "Bluefit Paulista",
          latitude: -23.5611,
          longitude: -46.6561,
        }),
      ],
      coords: { lat: -23.561, lng: -46.656 },
      query: "bluefit",
      recentCandidates: [],
      registeredGyms: [gym],
    });

    expect(sections.search).toHaveLength(1);
    expect(sections.search[0]?.provider).toBe("registered");
  });

  it("não exibe mais dropdown técnico de Nenhuma na tela de post", () => {
    const postScreenPath = fileURLToPath(new URL("../screens/PostScreen.tsx", import.meta.url));
    const source = readFileSync(postScreenPath, "utf8");

    expect(source).not.toContain("locationOptions");
    expect(source).not.toContain("Academia cadastrada");
    expect(source).toContain("setSearchOpen(true)");
    expect(source).toContain("Remover localização");
  });
});
