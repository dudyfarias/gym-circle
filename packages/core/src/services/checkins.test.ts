import { describe, expect, it, vi } from "vitest";
import type { GymCircleClient } from "./supabase";
import { checkinService } from "./checkins";

describe("checkinService unified social editor", () => {
  it("moves a check-in through the deduplicating RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "checkin-existing",
      error: null,
    });
    const service = checkinService({ rpc } as unknown as GymCircleClient);

    const checkinId = await service.updateLocation("checkin-1", "gym-2");

    expect(checkinId).toBe("checkin-existing");
    expect(rpc).toHaveBeenCalledWith("update_social_checkin", {
      p_checkin_id: "checkin-1",
      p_gym_id: "gym-2",
    });
  });

  it("apaga um check-in pelo id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockReturnValue({ eq });
    const service = checkinService({
      from: vi.fn().mockReturnValue({ delete: remove }),
    } as unknown as GymCircleClient);

    await service.remove("checkin-1");

    expect(remove).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", "checkin-1");
  });
});
