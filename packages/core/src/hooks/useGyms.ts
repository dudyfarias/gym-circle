import { useEffect, useRef, useState } from "react";
import type { GymRow } from "../domain/types";
import { useGymCircleServices } from "./SupabaseProvider";

export function useGyms() {
  const services = useGymCircleServices();
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    services.gyms
      .list()
      .then((list) => {
        if (!mountedRef.current) return;
        setGyms(list);
        setError(null);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setError(err as Error);
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [services]);

  return { gyms, loading, error };
}
