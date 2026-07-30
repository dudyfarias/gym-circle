"use client";

import { type RunningSessionTemplate } from "@gym-circle/core/domain";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Biblioteca de corrida guiada (Sprint D1) — sessões-farol oficiais publicadas.
 * Somente leitura: espelha o padrão de useRunningPlans (request-token guard para
 * ignorar respostas obsoletas), mas sem mutações — o conteúdo é app-owned.
 */
export function useRunningLibrary(enabled: boolean) {
  const services = useGymCircleServices();
  const [sessions, setSessions] = useState<RunningSessionTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    const request = requestRef.current + 1;
    requestRef.current = request;
    setLoading(true);
    setError(null);
    try {
      const next =
        await services.runningLibrary.listPublishedSessionTemplates();
      if (requestRef.current === request) setSessions(next);
    } catch {
      if (requestRef.current === request) {
        setError("running_library_load_failed");
      }
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, [enabled, services.runningLibrary]);

  useEffect(() => {
    if (!enabled) {
      requestRef.current += 1;
      return;
    }
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, refresh]);

  return { error, loading, refresh, sessions };
}
