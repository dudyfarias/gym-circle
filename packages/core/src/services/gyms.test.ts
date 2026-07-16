import { describe, expect, it, vi } from "vitest";
import { gymService } from "./gyms";
import type { GymCircleClient } from "./supabase";

describe("gymService external provenance", () => {
  it("registers an external gym through the atomic provenance RPC", async () => {
    const gym = {
      id: "gym-1",
      name: "Parque Ibirapuera",
      address: "Av. Pedro Álvares Cabral",
      city: "São Paulo",
      state: "SP",
      latitude: -23.5874,
      longitude: -46.6576,
      created_at: "2026-07-16T00:00:00.000Z",
    };
    const single = vi.fn().mockResolvedValue({ data: gym, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const rpc = vi.fn().mockResolvedValue({ data: gym.id, error: null });
    const client = { from, rpc } as unknown as GymCircleClient;

    const result = await gymService(client).findOrCreateFromPlace({
      name: gym.name,
      address: gym.address,
      city: gym.city,
      state: gym.state,
      latitude: gym.latitude,
      longitude: gym.longitude,
      provider: "openstreetmap",
      externalId: "way/123",
      sourceService: "nominatim",
      providerCategory: "public_park",
    });

    expect(result).toEqual(gym);
    expect(rpc).toHaveBeenCalledWith("register_external_gym", {
      p_address: gym.address,
      p_city: gym.city,
      p_external_id: "way/123",
      p_latitude: gym.latitude,
      p_longitude: gym.longitude,
      p_name: gym.name,
      p_provider: "openstreetmap",
      p_provider_category: "public_park",
      p_source_service: "nominatim",
      p_state: gym.state,
    });
    expect(from).toHaveBeenCalledWith("gyms");
  });
});
