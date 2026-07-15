import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GymCircleClient } from "@gym-circle/core";
import {
  buildTrainerWorkspaceUpdate,
  createTrainerWorkspace,
  emptyTrainerWorkspaceDraft,
  invalidateTrainerWorkspace,
  loadMyTrainerWorkspace,
  validateTrainerWorkspaceDraft,
} from "./trainerWorkspace";

const workspaceRow = {
  id: "workspace-1",
  owner_user_id: "user-1",
  name: "Dudy Coach",
  slug: null,
  workspace_type: "individual",
  status: "active",
  city: null,
  state: null,
  logo_url: null,
  description: null,
  created_at: "2026-07-15T12:00:00.000Z",
  updated_at: "2026-07-15T12:00:00.000Z",
};

const membershipRow = {
  id: "membership-1",
  workspace_id: "workspace-1",
  user_id: "user-1",
  role: "owner",
  status: "active",
  invited_by: "user-1",
  joined_at: "2026-07-15T12:00:00.000Z",
  created_at: "2026-07-15T12:00:00.000Z",
  updated_at: "2026-07-15T12:00:00.000Z",
};

function createClient() {
  const rpc = vi.fn().mockResolvedValue({ data: workspaceRow, error: null });
  const from = vi.fn((table: string) => {
    const result =
      table === "trainer_workspaces" ? workspaceRow : membershipRow;
    const builder = {
      select: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
    };
    return builder;
  });
  return {
    client: { from, rpc } as unknown as GymCircleClient,
    from,
    rpc,
  };
}

describe("trainerWorkspace", () => {
  beforeEach(() => {
    invalidateTrainerWorkspace();
  });

  it("builds a safe initial individual workspace draft", () => {
    expect(emptyTrainerWorkspaceDraft("Dudy")).toMatchObject({
      name: "Dudy Coach",
      workspaceType: "individual",
    });
  });

  it("validates workspace fields before a mutation", () => {
    const draft = emptyTrainerWorkspaceDraft("Dudy");
    expect(validateTrainerWorkspaceDraft(draft)).toBeNull();
    expect(validateTrainerWorkspaceDraft({ ...draft, name: "x" })).toBe("name");
    expect(
      validateTrainerWorkspaceDraft({
        ...draft,
        description: "x".repeat(801),
      }),
    ).toBe("description");
  });

  it("normalizes optional editable fields without ownership fields", () => {
    const payload = buildTrainerWorkspaceUpdate({
      ...emptyTrainerWorkspaceDraft("Dudy"),
      city: " São Paulo ",
      state: " SP ",
    });
    expect(payload).toEqual({
      name: "Dudy Coach",
      description: null,
      city: "São Paulo",
      state: "SP",
    });
    expect(payload).not.toHaveProperty("owner_user_id");
    expect(payload).not.toHaveProperty("status");
  });

  it("deduplicates concurrent workspace loads", async () => {
    const { client, from } = createClient();
    const [first, second] = await Promise.all([
      loadMyTrainerWorkspace(client, "user-1"),
      loadMyTrainerWorkspace(client, "user-1"),
    ]);
    expect(first).toEqual(second);
    expect(first?.membership.role).toBe("owner");
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("creates through the RPC without accepting an owner id from the client", async () => {
    const { client, rpc } = createClient();
    const context = await createTrainerWorkspace(
      client,
      "user-1",
      emptyTrainerWorkspaceDraft("Dudy"),
    );
    expect(context.workspace.id).toBe("workspace-1");
    expect(rpc).toHaveBeenCalledWith("create_trainer_workspace", {
      p_name: "Dudy Coach",
      p_workspace_type: "individual",
    });
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("owner_user_id");
  });
});
