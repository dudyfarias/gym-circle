"use client";

import {
  type RunningWorkoutPlan,
  type RunningWorkoutPlanDraft,
} from "@gym-circle/core/domain";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { useCallback, useEffect, useRef, useState } from "react";

export function useRunningPlans(enabled: boolean) {
  const services = useGymCircleServices();
  const [plans, setPlans] = useState<RunningWorkoutPlan[]>([]);
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
      const next = await services.runningPlans.listRunningPlans();
      if (requestRef.current === request) setPlans(next);
    } catch {
      if (requestRef.current === request) {
        setError("running_plans_load_failed");
      }
    } finally {
      if (requestRef.current === request) setLoading(false);
    }
  }, [enabled, services.runningPlans]);

  useEffect(() => {
    if (!enabled) {
      requestRef.current += 1;
      return;
    }
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [enabled, refresh]);

  const createPlan = useCallback(
    async (input: RunningWorkoutPlanDraft) => {
      const created = await services.runningPlans.createRunningPlan(input);
      setPlans((current) => [created, ...current]);
      return created;
    },
    [services.runningPlans],
  );

  const updatePlan = useCallback(
    async (id: string, input: RunningWorkoutPlanDraft) => {
      const updated = await services.runningPlans.updateRunningPlan(id, input);
      setPlans((current) =>
        current
          .map((plan) => (plan.id === id ? updated : plan))
          .sort((left, right) =>
            right.updatedAt.localeCompare(left.updatedAt),
          ),
      );
      return updated;
    },
    [services.runningPlans],
  );

  const duplicatePlan = useCallback(
    async (id: string) => {
      const duplicated =
        await services.runningPlans.duplicateRunningPlan(id);
      setPlans((current) => [duplicated, ...current]);
      return duplicated;
    },
    [services.runningPlans],
  );

  const deletePlan = useCallback(
    async (id: string) => {
      await services.runningPlans.deleteRunningPlan(id);
      setPlans((current) => current.filter((plan) => plan.id !== id));
    },
    [services.runningPlans],
  );

  return {
    createPlan,
    deletePlan,
    duplicatePlan,
    error,
    loading,
    plans,
    refresh,
    updatePlan,
  };
}
