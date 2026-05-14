import { describe, expect, it, vi } from "vitest";
import { safetyService } from "./safety";
import type { GymCircleClient } from "./supabase";

describe("safetyService account suspension", () => {
  it("requests temporary suspension through the secure RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          {
            reactivation_token: "token-123",
            reactivation_expires_at: "2026-05-21T18:00:00.000Z",
          },
        ],
        error: null,
      }),
    } as unknown as GymCircleClient & { rpc: ReturnType<typeof vi.fn> };
    const service = safetyService(client);

    const result = await service.suspendAccount();

    expect(client.rpc).toHaveBeenCalledWith("suspend_own_account");
    expect(result).toEqual({
      token: "token-123",
      expiresAt: "2026-05-21T18:00:00.000Z",
    });
  });

  it("issues a fresh reactivation token for a suspended account", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: {
          reactivation_token: "fresh-token",
          reactivation_expires_at: "2026-05-21T18:30:00.000Z",
        },
        error: null,
      }),
    } as unknown as GymCircleClient & { rpc: ReturnType<typeof vi.fn> };
    const service = safetyService(client);

    const result = await service.issueReactivationToken();

    expect(client.rpc).toHaveBeenCalledWith("issue_account_reactivation_token");
    expect(result.token).toBe("fresh-token");
  });

  it("reactivates only through the token RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as GymCircleClient & { rpc: ReturnType<typeof vi.fn> };
    const service = safetyService(client);

    await service.reactivateAccount("secure-token");

    expect(client.rpc).toHaveBeenCalledWith("reactivate_suspended_account", {
      p_token: "secure-token",
    });
  });

  it("keeps deletion on the existing deletion RPC", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as unknown as GymCircleClient & { rpc: ReturnType<typeof vi.fn> };
    const service = safetyService(client);

    await service.requestAccountDeletion(" Solicitação pelo app ");

    expect(client.rpc).toHaveBeenCalledWith("request_account_deletion", {
      p_reason: "Solicitação pelo app",
    });
  });
});
