import { useCallback, useEffect, useRef, useState } from "react";
import type { CreateStoryInput, EnrichedStory } from "../domain/types";
import { useGymCircleServices } from "./SupabaseProvider";

export type UseStoriesResult = {
  stories: EnrichedStory[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  publish: (input: CreateStoryInput) => Promise<void>;
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

  return { stories, loading, error, refresh, publish };
}
