import { describe, expect, it, vi } from "vitest";
import { participantService } from "./participants";
import type { PostParticipantRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

function postParticipant(
  taggedUserId: string,
  status: "pending" | "accepted" | "rejected",
): PostParticipantRow {
  return {
    id: `participant-${taggedUserId}`,
    post_id: "post-1",
    tagged_by_user_id: "author-1",
    tagged_user_id: taggedUserId,
    status,
    accepted_at: status === "accepted" ? "2026-05-19T10:00:00.000Z" : null,
    rejected_at: status === "rejected" ? "2026-05-19T10:00:00.000Z" : null,
    created_at: "2026-05-19T09:00:00.000Z",
  };
}

function createRequestPostTagsClient(existing: PostParticipantRow[]) {
  const selectedRows: unknown[] = [];
  let mode: "select" | "delete" | null = null;
  const query = {
    select: vi.fn(() => {
      mode = "select";
      return query;
    }),
    delete: vi.fn(() => {
      mode = "delete";
      return query;
    }),
    eq: vi.fn(() => query),
    in: vi.fn((_column: string, _values: string[]) => {
      if (mode === "delete") return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: existing, error: null });
    }),
    insert: vi.fn((rows: unknown[]) => {
      selectedRows.push(...rows);
      return {
        select: vi.fn().mockResolvedValue({
          data: rows.map((row, index) => ({
            id: `inserted-${index}`,
            created_at: "2026-05-19T11:00:00.000Z",
            accepted_at: null,
            rejected_at: null,
            ...row,
          })),
          error: null,
        }),
      };
    }),
  };
  const from = vi.fn(() => query);
  const client = { from } as unknown as GymCircleClient;
  return { client, query, selectedRows };
}

describe("participantService.requestPostTags", () => {
  it("creates pending requests for new tagged users after editing a post", async () => {
    const { client, query, selectedRows } = createRequestPostTagsClient([]);

    const result = await participantService(client).requestPostTags("post-1", "author-1", [
      "friend-1",
      "friend-1",
      "author-1",
      "friend-2",
    ]);

    expect(query.insert).toHaveBeenCalledTimes(1);
    expect(selectedRows).toEqual([
      {
        post_id: "post-1",
        tagged_by_user_id: "author-1",
        tagged_user_id: "friend-1",
        status: "pending",
      },
      {
        post_id: "post-1",
        tagged_by_user_id: "author-1",
        tagged_user_id: "friend-2",
        status: "pending",
      },
    ]);
    expect(result).toHaveLength(2);
  });

  it("does not duplicate pending or accepted tags and resends rejected tags", async () => {
    const { client, query, selectedRows } = createRequestPostTagsClient([
      postParticipant("accepted-user", "accepted"),
      postParticipant("pending-user", "pending"),
      postParticipant("rejected-user", "rejected"),
    ]);

    await participantService(client).requestPostTags("post-1", "author-1", [
      "accepted-user",
      "pending-user",
      "rejected-user",
      "new-user",
    ]);

    expect(query.in).toHaveBeenCalledWith("tagged_user_id", ["rejected-user"]);
    expect(selectedRows).toEqual([
      {
        post_id: "post-1",
        tagged_by_user_id: "author-1",
        tagged_user_id: "rejected-user",
        status: "pending",
      },
      {
        post_id: "post-1",
        tagged_by_user_id: "author-1",
        tagged_user_id: "new-user",
        status: "pending",
      },
    ]);
  });
});
