import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocationResultSections,
  classifyPlaceMatch,
  dedupeCandidates,
  getProviderAttribution,
  getRecentPostLocations,
  getSourceLabel,
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
    locationAddress: input.locationAddress ?? null,
    locationId: input.locationId ?? null,
    placeId: input.placeId ?? null,
    userId: input.userId ?? "user-1",
  };
}

function apiCandidate(input: Partial<PlaceCandidate> = {}): PlaceCandidate {
  return {
    provider: input.provider ?? "overpass",
    providerId: input.providerId ?? "api-1",
    gymId: input.gymId,
    locationId: input.locationId,
    placeId: input.placeId,
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
  it("3 posts com o mesmo gym_id retornam 1 local recente", () => {
    const recent = getRecentPostLocations("user-1", [
      usage({
        id: "p3",
        createdAt: "2026-05-14T12:00:00.000Z",
        gymId: "gym-x",
        gymName: "Academia X",
        locationName: "Academia X",
        locationSource: "gym",
      }),
      usage({
        id: "p2",
        createdAt: "2026-05-13T12:00:00.000Z",
        gymId: "gym-x",
        gymName: "Academia X",
        locationName: "Academia X",
        locationSource: "gym",
      }),
      usage({
        id: "p1",
        createdAt: "2026-05-12T12:00:00.000Z",
        gymId: "gym-x",
        gymName: "Academia X",
        locationName: "Academia X",
        locationSource: "gym",
      }),
    ]);

    expect(recent).toHaveLength(1);
    expect(recent[0]?.name).toBe("Academia X");
  });

  it("3 posts com o mesmo nome e endereço retornam 1 local", () => {
    const recent = getRecentPostLocations("user-1", [
      usage({
        id: "studio-3",
        createdAt: "2026-05-14T12:00:00.000Z",
        locationAddress: "Rua das Flores, 10",
        locationLatitude: -23.55,
        locationLongitude: -46.64,
        locationName: "Studio Flow",
        locationSource: "current",
      }),
      usage({
        id: "studio-2",
        createdAt: "2026-05-13T12:00:00.000Z",
        locationAddress: " Rua das Flores, 10 ",
        locationLatitude: -23.5501,
        locationLongitude: -46.6401,
        locationName: "stúdio flow",
        locationSource: "current",
      }),
      usage({
        id: "studio-1",
        createdAt: "2026-05-12T12:00:00.000Z",
        locationAddress: "Rua das Flores 10",
        locationLatitude: -23.5502,
        locationLongitude: -46.6402,
        locationName: "Studio  Flow",
        locationSource: "current",
      }),
    ]);

    expect(recent).toHaveLength(1);
    expect(recent[0]?.name).toBe("Studio Flow");
  });

  it("locais diferentes retornam até 3 recentes únicos", () => {
    const recent = getRecentPostLocations("user-1", [
      usage({
        id: "a",
        locationName: "Academia A",
        locationSource: "current",
        locationLatitude: -23.1,
        locationLongitude: -46.1,
      }),
      usage({
        id: "b",
        locationName: "Academia B",
        locationSource: "current",
        locationLatitude: -23.2,
        locationLongitude: -46.2,
      }),
      usage({
        id: "c",
        locationName: "Academia C",
        locationSource: "current",
        locationLatitude: -23.3,
        locationLongitude: -46.3,
      }),
      usage({
        id: "d",
        locationName: "Academia D",
        locationSource: "current",
        locationLatitude: -23.4,
        locationLongitude: -46.4,
      }),
    ]);

    expect(recent).toHaveLength(3);
    expect(recent.map((item) => item.name)).toEqual([
      "Academia A",
      "Academia B",
      "Academia C",
    ]);
  });

  it("local repetido preserva a data mais recente para ordenação", () => {
    const recent = getRecentPostLocations("user-1", [
      usage({
        id: "new-duplicate",
        createdAt: "2026-05-14T12:00:00.000Z",
        locationName: "Academia X",
        locationSource: "current",
        locationLatitude: -23.1,
        locationLongitude: -46.1,
      }),
      usage({
        id: "middle",
        createdAt: "2026-05-13T12:00:00.000Z",
        locationName: "Academia Y",
        locationSource: "current",
        locationLatitude: -23.2,
        locationLongitude: -46.2,
      }),
      usage({
        id: "old-duplicate",
        createdAt: "2026-05-12T12:00:00.000Z",
        locationName: "Academia X",
        locationSource: "current",
        locationLatitude: -23.1001,
        locationLongitude: -46.1001,
      }),
    ]);

    expect(recent.map((item) => item.name)).toEqual([
      "Academia X",
      "Academia Y",
    ]);
    expect(recent[0]?.providerId).toBe("current/new-duplicate");
  });

  it("mostra no máximo 3 recentes, ordenados e sem duplicar lugar", () => {
    const recent = getRecentPostLocations(
      "user-1",
      [
        usage({
          id: "older-duplicate",
          createdAt: "2026-05-10T12:00:00.000Z",
          gymId: gym.id,
          gymName: gym.name,
          locationSource: "gym",
        }),
        usage({
          id: "recent-gym",
          createdAt: "2026-05-14T12:00:00.000Z",
          gymId: gym.id,
          gymName: gym.name,
          locationSource: "gym",
        }),
        usage({
          id: "park",
          createdAt: "2026-05-13T12:00:00.000Z",
          locationName: "Parque Villa-Lobos",
          locationSource: "current",
          locationLatitude: -23.546,
          locationLongitude: -46.725,
        }),
        usage({
          id: "studio",
          createdAt: "2026-05-12T12:00:00.000Z",
          locationName: "Studio Flow",
          locationSource: "current",
          locationLatitude: -23.56,
          locationLongitude: -46.64,
        }),
        usage({
          id: "fourth",
          createdAt: "2026-05-11T12:00:00.000Z",
          locationName: "Pista USP",
          locationSource: "current",
          locationLatitude: -23.56,
          locationLongitude: -46.73,
        }),
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
          address: "Av. Paulista, 1000",
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

  it("deduplica por place_id antes de comparar nome/endereço", () => {
    const candidates = dedupeCandidates([
      apiCandidate({
        name: "Nome antigo",
        placeId: "place-123",
        providerId: "google-old",
      }),
      apiCandidate({
        name: "Nome novo",
        placeId: "place-123",
        providerId: "google-new",
      }),
    ]);

    expect(candidates).toHaveLength(1);
  });

  it("atribui resultados OSM sem chamá-los de Google", () => {
    const candidate = apiCandidate({ provider: "nominatim" });

    expect(getSourceLabel(candidate)).toBe("OpenStreetMap");
    expect(getProviderAttribution(candidate.provider)).toEqual({
      attributionLabel: "© OpenStreetMap contributors",
      attributionUrl: "https://www.openstreetmap.org/copyright",
      sourceLabel: "OpenStreetMap",
    });
  });

  it("classifica o mesmo external ID como referência idêntica", () => {
    expect(
      classifyPlaceMatch(
        apiCandidate({ providerId: "node/123", name: "Nome antigo" }),
        apiCandidate({ providerId: "node/123", name: "Nome novo" }),
      ),
    ).toBe("same_external_ref");
  });

  it("não confunde IDs iguais vindos de providers diferentes", () => {
    expect(
      classifyPlaceMatch(
        apiCandidate({ provider: "nominatim", providerId: "123", name: "Local A" }),
        apiCandidate({ provider: "google", providerId: "123", name: "Local B" }),
      ),
    ).toBe("manual_review");
    expect(
      dedupeCandidates([
        apiCandidate({ provider: "nominatim", providerId: "123", name: "Local A" }),
        apiCandidate({ provider: "google", providerId: "123", name: "Local B" }),
      ]),
    ).toHaveLength(2);
  });

  it("deduplica nomes com e sem acento somente quando o endereço confirma", () => {
    const first = apiCandidate({
      address: "Rua das Flores, 10",
      name: "Academia Saúde",
      providerId: "node/1",
    });
    const second = apiCandidate({
      address: "Rua das Flores 10",
      name: "Academia Saude",
      providerId: "node/2",
    });

    expect(classifyPlaceMatch(first, second)).toBe("exact_match");
    expect(dedupeCandidates([first, second])).toHaveLength(1);
  });

  it("mantém unidades Smart Fit próximas separadas quando os endereços divergem", () => {
    const paulista = apiCandidate({
      address: "Av. Paulista, 1000",
      latitude: -23.561,
      longitude: -46.656,
      name: "Smart Fit",
      providerId: "node/paulista",
    });
    const brigadeiro = apiCandidate({
      address: "Av. Brigadeiro Luís Antônio, 2100",
      latitude: -23.5612,
      longitude: -46.6561,
      name: "Smart Fit",
      providerId: "node/brigadeiro",
    });

    expect(classifyPlaceMatch(paulista, brigadeiro)).toBe("distinct");
    expect(dedupeCandidates([paulista, brigadeiro])).toHaveLength(2);
  });

  it("mantém Bio Ritmo de bairros diferentes como locais distintos", () => {
    expect(
      classifyPlaceMatch(
        apiCandidate({
          address: "Rua Haddock Lobo, 500",
          city: "São Paulo",
          name: "Bio Ritmo",
          providerId: "bio-cerqueira",
        }),
        apiCandidate({
          address: "Av. Pavão, 700",
          city: "São Paulo",
          name: "Bio Ritmo",
          providerId: "bio-moema",
        }),
      ),
    ).toBe("distinct");
  });

  it("envia academia renomeada no mesmo endereço para revisão manual", () => {
    const oldGym = apiCandidate({
      address: "Rua Vergueiro, 100",
      name: "Academia Antiga",
      providerId: "old-gym",
    });
    const renamedGym = apiCandidate({
      address: "Rua Vergueiro, 100",
      name: "Academia Nova",
      providerId: "new-gym",
    });

    expect(classifyPlaceMatch(oldGym, renamedGym)).toBe("manual_review");
    expect(dedupeCandidates([oldGym, renamedGym])).toHaveLength(2);
  });

  it("não une parque e centro esportivo próximos apenas pela distância", () => {
    const park = apiCandidate({
      address: "Av. A, 1",
      latitude: -23.55,
      longitude: -46.64,
      name: "Parque Municipal",
      providerId: "park-1",
    });
    const sportsCenter = apiCandidate({
      address: "Av. A, 2",
      latitude: -23.5501,
      longitude: -46.6401,
      name: "Centro Esportivo Municipal",
      providerId: "sports-1",
    });

    expect(classifyPlaceMatch(park, sportsCenter)).toBe("distinct");
  });

  it("não une duas academias do mesmo shopping somente por endereço e proximidade", () => {
    const first = apiCandidate({
      address: "Shopping Central, Av. Principal, 100",
      name: "Academia Alpha",
      providerId: "shopping-alpha",
    });
    const second = apiCandidate({
      address: "Shopping Central, Av. Principal, 100",
      name: "Academia Beta",
      providerId: "shopping-beta",
    });

    expect(classifyPlaceMatch(first, second)).toBe("manual_review");
    expect(dedupeCandidates([first, second])).toHaveLength(2);
  });

  it("não exibe mais dropdown técnico de Nenhuma na tela de post", () => {
    const postScreenPath = fileURLToPath(
      new URL("../screens/PostScreen.tsx", import.meta.url),
    );
    const source = readFileSync(postScreenPath, "utf8");

    expect(source).not.toContain("locationOptions");
    expect(source).not.toContain("Academia cadastrada");
    expect(source).toContain("setSearchOpen(true)");
    // Sprint 16 — pós-9.9.1 a string "Remover localização" vive no i18n;
    // o fonte referencia a CHAVE (estável). Antes o teste grepava o PT
    // literal e quebrou no sweep de L10n.
    expect(source).toContain("postScreen.location.remove");
  });
});
