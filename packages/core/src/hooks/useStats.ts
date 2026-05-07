import { useCallback, useEffect, useRef, useState } from "react";
import type { UserStatsRow } from "../domain/types";
import { useGymCircleServices } from "./SupabaseProvider";

export type UseStatsResult = {
  stats: UserStatsRow | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useStats(userId: string | null): UseStatsResult {
  const services = useGymCircleServices();
  const [stats, setStats] = useState<UserStatsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await services.stats.forUser(userId);
      if (mountedRef.current) {
        setStats(next);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) setError(err as Error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [services, userId]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    if (!userId) return;
    const channel = services.client
      .channel(`user_stats:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_stats",
          filter: `user_id=eq.${userId}`,
        },
        () => refresh(),
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      services.client.removeChannel(channel);
    };
  }, [services, userId, refresh]);

  return { stats, loading, error, refresh };
}
