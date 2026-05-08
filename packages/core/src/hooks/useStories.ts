import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateStoryInput, EnrichedStory } from "../domain/types";
import type { SendDirectMessageInput } from "../services/messages";
import { useGymCircleServices } from "./SupabaseProvider";

export type UseStoriesResult = {
  stories: EnrichedStory[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  publish: (input: CreateStoryInput) => Promise<void>;
  like: (storyId: string) => Promise<void>;
  deleteStory: (storyId: string) => Promise<void>;
  muteAuthor: (mutedUserId: string) => Promise<void>;
  reply: (
    story: Pick<EnrichedStory, "id" | "media_url" | "user_id">,
    body: string,
  ) => Promise<void>;
  shareToDirect: (
    story: Pick<EnrichedStory, "id" | "media_url">,
    input: Pick<SendDirectMessageInput, "receiverId" | "body">,
  ) => Promise<void>;
};

export function useStories(currentUserId: string | null): UseStoriesResult {
  const services = useGymCircleServices();
  const [stories, setStories] = useState<EnrichedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await services.stories.listActive();
      if (mountedRef.current) {
        setStories(list);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) setError(err as Error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [services]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const channel = services.client
      .channel("stories")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stories" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      services.client.removeChannel(channel);
    };
  }, [services, refresh]);

  const publish = useCallback(
    async (input: CreateStoryInput) => {
      if (!currentUserId) throw new Error("não autenticado");
      await services.stories.create(currentUserId, input);
      await services.stats.refreshMine();
      await refresh();
    },
    [services, currentUserId, refresh],
  );

  const like = useCallback(
    async (storyId: string) => {
      if (!currentUserId) throw new Error("não autenticado");
      await services.stories.like(storyId, currentUserId);
      await refresh();
    },
    [services, currentUserId, refresh],
  );

  const deleteStory = useCallback(
    async (storyId: string) => {
      await services.stories.remove(storyId);
      await services.stats.refreshMine();
      await refresh();
    },
    [services, refresh],
  );

  const muteAuthor = useCallback(
    async (mutedUserId: string) => {
      if (!currentUserId) throw new Error("não autenticado");
      await services.stories.mute(currentUserId, mutedUserId);
      await refresh();
    },
    [services, currentUserId, refresh],
  );

  const reply = useCallback(
    async (
      story: Pick<EnrichedStory, "id" | "media_url" | "user_id">,
      body: string,
    ) => {
      if (!currentUserId) throw new Error("não autenticado");
      await services.messages.sendDirect(currentUserId, {
        receiverId: story.user_id,
        body,
        storyId: story.id,
        replyToStory: true,
        storyPreviewUrl: story.media_url,
      });
    },
    [services, currentUserId],
  );

  const shareToDirect = useCallback(
    async (
      story: Pick<EnrichedStory, "id" | "media_url">,
      input: Pick<SendDirectMessageInput, "receiverId" | "body">,
    ) => {
      if (!currentUserId) throw new Error("não autenticado");
      await services.messages.sendDirect(currentUserId, {
        receiverId: input.receiverId,
        body: input.body ?? "Compartilhou um story com você.",
        storyId: story.id,
        replyToStory: false,
        storyPreviewUrl: story.media_url,
      });
    },
    [services, currentUserId],
  );

  return {
    stories,
    loading,
    error,
    refresh,
    publish,
    like,
    deleteStory,
    muteAuthor,
    reply,
    shareToDirect,
  };
}
