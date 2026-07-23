"use client";

import { useGymCircleServices } from "@gym-circle/core/hooks";
import {
  SPORT_CATALOG,
  rankSports,
  type SportDefinition,
  type SportId,
} from "@gym-circle/core/domain";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PersonalizationState = {
  favoriteIds: Set<string>;
  usageCountBySport: Map<string, number>;
  lastUsedAtBySport: Map<string, string>;
};

const EMPTY_STATE: PersonalizationState = {
  favoriteIds: new Set(),
  usageCountBySport: new Map(),
  lastUsedAtBySport: new Map(),
};

export function useSportCatalogPersonalization(input: {
  activeSportId?: string | null;
  enabled: boolean;
  userId: string;
}) {
  const services = useGymCircleServices();
  const [state, setState] = useState<PersonalizationState>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!input.enabled || !input.userId) return;
    const requestKey = `${input.userId}:${Date.now()}`;
    requestKeyRef.current = requestKey;
    setLoading(true);
    setError(null);
    try {
      const result = await services.sports.personalization(input.userId);
      if (requestKeyRef.current !== requestKey) return;
      setState({
        favoriteIds: new Set(result.favoriteSportIds),
        usageCountBySport: new Map(Object.entries(result.usageCountBySport)),
        lastUsedAtBySport: new Map(Object.entries(result.lastUsedAtBySport)),
      });
    } catch {
      if (requestKeyRef.current === requestKey) {
        setError("sport_personalization_load_failed");
      }
    } finally {
      if (requestKeyRef.current === requestKey) setLoading(false);
    }
  }, [input.enabled, input.userId, services.sports]);

  useEffect(() => {
    if (!input.enabled) {
      requestKeyRef.current = null;
      return;
    }
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      requestKeyRef.current = null;
    };
  }, [input.enabled, input.userId, refresh]);

  const rankedSports = useMemo(
    () =>
      rankSports(SPORT_CATALOG, {
        activeSportId: input.activeSportId,
        favoriteSportIds: state.favoriteIds,
        usageCountBySport: state.usageCountBySport,
        lastUsedAtBySport: state.lastUsedAtBySport,
        recommendedSportIds: ["strength", "run", "walk", "ride"],
      }),
    [
      input.activeSportId,
      state.favoriteIds,
      state.lastUsedAtBySport,
      state.usageCountBySport,
    ],
  );

  const toggleFavorite = useCallback(
    async (sport: SportDefinition) => {
      const sportId = sport.id as SportId;
      const wasFavorite = state.favoriteIds.has(sportId);
      setState((current) => {
        const favoriteIds = new Set(current.favoriteIds);
        if (wasFavorite) favoriteIds.delete(sportId);
        else favoriteIds.add(sportId);
        return { ...current, favoriteIds };
      });
      await services.analytics.trackSafe(
        input.userId,
        "sport_favorite_changed",
        { sport_id: sportId, favorite: !wasFavorite },
      );
      try {
        await services.sports.setFavorite(
          input.userId,
          sportId,
          !wasFavorite,
        );
      } catch (cause) {
        setState((current) => {
          const favoriteIds = new Set(current.favoriteIds);
          if (wasFavorite) favoriteIds.add(sportId);
          else favoriteIds.delete(sportId);
          return { ...current, favoriteIds };
        });
        throw cause;
      }
    },
    [input.userId, services.analytics, services.sports, state.favoriteIds],
  );

  const track = useCallback(
    (
      eventName:
        | "sport_catalog_opened"
        | "sport_searched"
        | "sport_started"
        | "sport_start_cancelled",
      metadata: Record<string, string | number | boolean | null>,
    ) => services.analytics.trackSafe(input.userId, eventName, metadata),
    [input.userId, services.analytics],
  );

  return {
    error,
    favoriteIds: state.favoriteIds,
    lastUsedAtBySport: state.lastUsedAtBySport,
    loading,
    rankedSports,
    refresh,
    toggleFavorite,
    track,
    usageCountBySport: state.usageCountBySport,
  };
}
