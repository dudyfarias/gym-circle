import { useCallback, useEffect, useRef, useState } from "react";
import type { ProfileRow } from "../domain/types";
import { useGymCircleServices } from "./SupabaseProvider";
import type { ProfileUpdate } from "../services/profiles";

export type UseProfileResult = {
  profile: ProfileRow | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  update: (patch: ProfileUpdate) => Promise<void>;
};

export function useProfile(userId: string | null): UseProfileResult {
  const services = useGymCircleServices();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const next = await services.profiles.byUserId(userId);
      if (mountedRef.current) {
        setProfile(next);
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
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  const update = useCallback(
    async (patch: ProfileUpdate) => {
      if (!userId) throw new Error("não autenticado");
      const next = await services.profiles.update(userId, patch);
      if (mountedRef.current) setProfile(next);
    },
    [services, userId],
  );

  return { profile, loading, error, refresh, update };
}
