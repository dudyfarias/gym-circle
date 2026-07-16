import type { GymRow, UserGymRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

/**
 * Dados crus de um lugar vindos da API de busca (Nominatim/Google/etc).
 * O mesmo shape vai ser usado por qualquer provider futuro.
 */
export type PlaceCandidate = {
  name: string;
  address?: string | null;
  neighborhood?: string | null;
  city: string;
  state?: string | null;
  latitude: number;
  longitude: number;
  provider?: "google" | "apple" | "openstreetmap" | "mapbox" | "manual" | null;
  externalId?: string | null;
  sourceService?: "nominatim" | "overpass" | string | null;
  providerCategory?: string | null;
};

/**
 * Tolerância de coords pra considerar 2 lugares "o mesmo" no dedup.
 * 0.0009° ≈ 100m em latitudes brasileiras — distância suficiente pra
 * pegar a mesma academia mesmo com OSM e Google divergindo um pouco.
 */
const COORD_DEDUP_TOLERANCE = 0.0009;

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function ensurePlaceHasCoordinates(place: PlaceCandidate) {
  if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) {
    throw new Error("Para cadastrar academia, a localização é obrigatória.");
  }
}

function normalizeCityForInsert(place: PlaceCandidate): string {
  const city = place.city?.trim();
  if (city && city.length >= 2) return city;
  const neighborhood = place.neighborhood?.trim();
  if (neighborhood && neighborhood.length >= 2) return neighborhood;
  const state = place.state?.trim();
  if (state && state.length >= 2) return state;
  return "Brasil";
}

export function gymService(client: GymCircleClient) {
  return {
    async list(limit = 50): Promise<GymRow[]> {
      const { data, error } = await client
        .from("gyms")
        .select("*")
        .order("name", { ascending: true })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },

    async byId(id: string): Promise<GymRow | null> {
      const { data, error } = await client.from("gyms").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },

    async create(input: {
      name: string;
      address?: string | null;
      city?: string | null;
      state?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }): Promise<GymRow> {
      if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
        throw new Error("Para cadastrar academia, a localização é obrigatória.");
      }

      const { data, error } = await client
        .from("gyms")
        .insert({
          name: input.name.trim(),
          address: input.address?.trim() || null,
          city: input.city?.trim() || "Brasil",
          state: input.state?.trim() || null,
          latitude: input.latitude,
          longitude: input.longitude,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    /**
     * Pega uma academia/lugar do catálogo OU cria se for nova.
     *
     * Estratégia de dedup em 2 camadas:
     * 1. Match por coordenadas (~100m de tolerância) + nome similar.
     *    Cobre o caso comum: outro user já catalogou essa Bluefit.
     * 2. Fallback no constraint único `(lower(name), lower(city))`.
     *    Se o INSERT bater duplicate, busca pelo par nome+city.
     *
     * Após retornar, o caller decide se quer chamar addUserGym() pra
     * vincular ao perfil do próprio usuário.
     */
    async findOrCreateFromPlace(place: PlaceCandidate): Promise<GymRow> {
      ensurePlaceHasCoordinates(place);

      if (
        place.provider &&
        place.provider !== "manual" &&
        place.externalId?.trim()
      ) {
        const { data: gymId, error: registerError } = await client.rpc(
          "register_external_gym",
          {
            p_address: place.address?.trim() || null,
            p_city: normalizeCityForInsert(place),
            p_external_id: place.externalId.trim(),
            p_latitude: place.latitude,
            p_longitude: place.longitude,
            p_name: place.name.trim(),
            p_provider: place.provider,
            p_provider_category: place.providerCategory?.trim() || null,
            p_source_service: place.sourceService?.trim() || null,
            p_state: place.state?.trim() || null,
          },
        );
        if (registerError) throw registerError;
        if (!gymId) throw new Error("Falha ao preservar a origem do local externo.");

        const { data: gym, error: gymError } = await client
          .from("gyms")
          .select("*")
          .eq("id", gymId)
          .single();
        if (gymError) throw gymError;
        return gym;
      }

      // 1. Match por proximidade — bbox de ±100m no lat/lng
      const { data: nearby, error: nearbyErr } = await client
        .from("gyms")
        .select("*")
        .gte("latitude", place.latitude - COORD_DEDUP_TOLERANCE)
        .lte("latitude", place.latitude + COORD_DEDUP_TOLERANCE)
        .gte("longitude", place.longitude - COORD_DEDUP_TOLERANCE)
        .lte("longitude", place.longitude + COORD_DEDUP_TOLERANCE)
        .limit(8);
      if (nearbyErr) throw nearbyErr;

      const targetName = normalizeName(place.name);
      const coordMatch = (nearby ?? []).find(
        (row) => normalizeName(row.name) === targetName,
      );
      if (coordMatch) return coordMatch;

      // 2. Tenta INSERT; se cair no constraint único, busca por nome+city
      const insertPayload = {
        name: place.name.trim(),
        address: place.address?.trim() || null,
        city: normalizeCityForInsert(place),
        state: place.state?.trim() || null,
        latitude: place.latitude,
        longitude: place.longitude,
      };
      const { data: inserted, error: insertErr } = await client
        .from("gyms")
        .insert(insertPayload)
        .select("*")
        .single();
      if (!insertErr && inserted) return inserted;

      const isDuplicate = (insertErr as { code?: string } | null)?.code === "23505";
      if (!isDuplicate) {
        throw insertErr ?? new Error("Falha ao catalogar local.");
      }

      // 3. Duplicate constraint hit — outro user inseriu primeiro,
      // ou a query inicial não cobriu (tipo lat/lng nulos).
      const { data: existing, error: lookupErr } = await client
        .from("gyms")
        .select("*")
        .ilike("name", insertPayload.name)
        .ilike("city", insertPayload.city)
        .maybeSingle();
      if (lookupErr) throw lookupErr;
      if (existing) return existing;

      throw insertErr;
    },

    async listForUser(userId: string): Promise<UserGymRow[]> {
      const { data, error } = await client
        .from("user_gyms")
        .select("*")
        .eq("user_id", userId)
        .order("is_main", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async addUserGym(userId: string, gymId: string, isMain = false) {
      if (isMain) {
        const { error: resetError } = await client
          .from("user_gyms")
          .update({ is_main: false })
          .eq("user_id", userId);
        if (resetError) throw resetError;
      }

      const { data, error } = await client
        .from("user_gyms")
        .upsert(
          { user_id: userId, gym_id: gymId, is_main: isMain },
          { onConflict: "user_id,gym_id" },
        )
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },

    async removeUserGym(userId: string, gymId: string) {
      const { error } = await client
        .from("user_gyms")
        .delete()
        .match({ user_id: userId, gym_id: gymId });
      if (error) throw error;
    },
  };
}

export type GymService = ReturnType<typeof gymService>;
