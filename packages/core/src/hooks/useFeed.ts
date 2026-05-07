import { useCallback, useEffect, useRef, useState } from "react";
import type { CreatePostInput, EnrichedPost } from "../domain/types";
import { useGymCircleServices } from "./SupabaseProvider";

export type UseFeedResult = {
  posts: EnrichedPost[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  like: (postId: string) => Promise<void>;
  unlike: (postId: string) => Promise<void>;
  comment: (postId: string, body: string) => Promise<void>;
  publish: (input: CreatePostInput) => Promise<void>;
};

export function useFeed(currentUserId: string | null): UseFeedResult {
  const services = useGymCircleServices();
  const [posts, setPosts] = useState<EnrichedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await services.posts.listFeed(currentUserId);
      if (mountedRef.current) {
        setPosts(list);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) setError(err as Error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [services, currentUserId]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const channel = services.client
      .channel("feed-posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes" },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      services.client.removeChannel(channel);
    };
  }, [services, refresh]);

  const like = useCallback(
    async (postId: string) => {
      if (!currentUserId) throw new Error("não autenticado");
      setPosts((curr) =>
        curr.map((p) =>
          p.id === postId
            ? { ...p, liked_by_me: true, likes_count: p.likes_count + 1 }
            : p,
        ),
      );
      await services.posts.like(postId, currentUserId);
    },
    [services, currentUserId],
  );

  const unlike = useCallback(
    async (postId: string) => {
      if (!currentUserId) throw new Error("não autenticado");
      setPosts((curr) =>
        curr.map((p) =>
          p.id === postId
            ? { ...p, liked_by_me: false, likes_count: Math.max(0, p.likes_count - 1) }
            : p,
        ),
      );
      await services.posts.unlike(postId, currentUserId);
    },
    [services, currentUserId],
  );

  const comment = useCallback(
    async (postId: string, body: string) => {
      if (!currentUserId) throw new Error("não autenticado");
      await services.posts.comment(postId, currentUserId, body);
      await refresh();
    },
    [services, currentUserId, refresh],
  );

  const publish = useCallback(
    async (input: CreatePostInput) => {
      if (!currentUserId) throw new Error("não autenticado");
      await services.posts.create(currentUserId, input);
      await services.stats.refreshMine();
      await refresh();
    },
    [services, currentUserId, refresh],
  );

  return { posts, loading, error, refresh, like, unlike, comment, publish };
}
