import type { PostParticipantRow, StoryParticipantRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

type ParticipantStatus = "pending" | "accepted" | "rejected";
type ParticipantTable = "post_participants" | "story_participants";

function isMissingParticipantTable(error: unknown, table: ParticipantTable) {
  const postgrestError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const haystack = [
    postgrestError.code,
    postgrestError.message,
    postgrestError.details,
    postgrestError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    postgrestError.code === "PGRST205" ||
    postgrestError.code === "42P01" ||
    (haystack.includes("schema cache") && haystack.includes(table)) ||
    haystack.includes(`public.${table}`) ||
    haystack.includes(`relation "${table}" does not exist`)
  );
}

function uniqueUserIds(userIds: string[], currentUserId: string) {
  return Array.from(
    new Set(userIds.filter((id) => id && id !== currentUserId)),
  );
}

export function participantService(client: GymCircleClient) {
  return {
    async listPostParticipants(postIds: string[]): Promise<PostParticipantRow[]> {
      if (postIds.length === 0) return [];
      const { data, error } = await client
        .from("post_participants")
        .select("*")
        .in("post_id", postIds);
      if (error) {
        if (isMissingParticipantTable(error, "post_participants")) return [];
        throw error;
      }
      return (data ?? []) as PostParticipantRow[];
    },

    async listStoryParticipants(storyIds: string[]): Promise<StoryParticipantRow[]> {
      if (storyIds.length === 0) return [];
      const { data, error } = await client
        .from("story_participants")
        .select("*")
        .in("story_id", storyIds);
      if (error) {
        if (isMissingParticipantTable(error, "story_participants")) return [];
        throw error;
      }
      return (data ?? []) as StoryParticipantRow[];
    },

    async createPostTags(
      postId: string,
      taggedByUserId: string,
      taggedUserIds: string[],
    ): Promise<PostParticipantRow[]> {
      const rows = uniqueUserIds(taggedUserIds, taggedByUserId).map((taggedUserId) => ({
        post_id: postId,
        tagged_by_user_id: taggedByUserId,
        tagged_user_id: taggedUserId,
        status: "pending",
      }));
      if (rows.length === 0) return [];

      const { data, error } = await client
        .from("post_participants")
        .upsert(rows, { onConflict: "post_id,tagged_user_id", ignoreDuplicates: true })
        .select("*");
      if (error) {
        if (isMissingParticipantTable(error, "post_participants")) return [];
        throw error;
      }
      return (data ?? []) as PostParticipantRow[];
    },

    async createStoryTags(
      storyId: string,
      taggedByUserId: string,
      taggedUserIds: string[],
    ): Promise<StoryParticipantRow[]> {
      const rows = uniqueUserIds(taggedUserIds, taggedByUserId).map((taggedUserId) => ({
        story_id: storyId,
        tagged_by_user_id: taggedByUserId,
        tagged_user_id: taggedUserId,
        status: "pending",
      }));
      if (rows.length === 0) return [];

      const { data, error } = await client
        .from("story_participants")
        .upsert(rows, { onConflict: "story_id,tagged_user_id", ignoreDuplicates: true })
        .select("*");
      if (error) {
        if (isMissingParticipantTable(error, "story_participants")) return [];
        throw error;
      }
      return (data ?? []) as StoryParticipantRow[];
    },

    async respondToPostTag(
      postId: string,
      taggedUserId: string,
      status: Extract<ParticipantStatus, "accepted" | "rejected">,
    ): Promise<PostParticipantRow | null> {
      const { data, error } = await client
        .from("post_participants")
        .update({ status })
        .eq("post_id", postId)
        .eq("tagged_user_id", taggedUserId)
        .select("*")
        .maybeSingle();
      if (error) {
        if (isMissingParticipantTable(error, "post_participants")) return null;
        throw error;
      }
      return data as PostParticipantRow | null;
    },

    async respondToStoryTag(
      storyId: string,
      taggedUserId: string,
      status: Extract<ParticipantStatus, "accepted" | "rejected">,
    ): Promise<StoryParticipantRow | null> {
      const { data, error } = await client
        .from("story_participants")
        .update({ status })
        .eq("story_id", storyId)
        .eq("tagged_user_id", taggedUserId)
        .select("*")
        .maybeSingle();
      if (error) {
        if (isMissingParticipantTable(error, "story_participants")) return null;
        throw error;
      }
      return data as StoryParticipantRow | null;
    },
  };
}

export type ParticipantService = ReturnType<typeof participantService>;
