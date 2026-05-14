"use client";

import { useCallback, useEffect, useState } from "react";
import type { Coordinates } from "@gym-circle/core";

export type ViewerLocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "dismissed"
  | "error"
  | "unsupported";

type StoredPromptStatus = "granted" | "denied" | "dismissed";

const LOCATION_PROMPT_STORAGE_KEY = "gym-circle:location-permission-prompt";

function loadStoredPromptStatus(): StoredPromptStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(LOCATION_PROMPT_STORAGE_KEY) ?? "null",
    );
    if (
      parsed &&
      typeof parsed === "object" &&
      ["granted", "denied", "dismissed"].includes(String(parsed.status))
    ) {
      return parsed.status as StoredPromptStatus;
    }
  } catch {
    // localStorage can fail in iOS private contexts. Fail open.
  }
  return null;
}

function persistPromptStatus(status: StoredPromptStatus) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LOCATION_PROMPT_STORAGE_KEY,
      JSON.stringify({ status, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Non-critical preference.
  }
}

export function shouldShowViewerLocationPrompt(
  status: ViewerLocationStatus,
  hasDistancePosts: boolean,
) {
  return (
    hasDistancePosts &&
    status !== "granted" &&
    status !== "denied" &&
    status !== "dismissed"
  );
}

function getLocationError(err: unknown): {
  status: ViewerLocationStatus;
  message: string;
} {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? Number((err as { code?: unknown }).code)
      : 0;

  if (code === 1) {
    return {
      status: "denied",
      message: "Permissão negada. Ative a localização para ver distâncias.",
    };
  }

  if (code === 3) {
    return {
      status: "error",
      message: "Tempo esgotado. Tente novamente em um local com sinal melhor.",
    };
  }

  return {
    status: "error",
    message: "Não conseguimos localizar você agora.",
  };
}

export function useViewerLocation() {
  const [status, setStatus] = useState<ViewerLocationStatus>(() => {
    const stored = loadStoredPromptStatus();
    return stored ?? "idle";
  });
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.permissions) return;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((permission) => {
        if (permission.state === "granted") {
          persistPromptStatus("granted");
          setStatus((current) => (current === "requesting" ? current : "granted"));
        }
        if (permission.state === "denied") {
          persistPromptStatus("denied");
          setStatus((current) => (current === "requesting" ? current : "denied"));
        }
      })
      .catch(() => undefined);
  }, []);

  const request = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unsupported");
      setError("Este navegador não suporta localização.");
      return;
    }

    setStatus("requesting");
    setError(null);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 60000,
          timeout: 10000,
        });
      });

      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      persistPromptStatus("granted");
      setStatus("granted");
    } catch (err) {
      const next = getLocationError(err);
      setCoordinates(null);
      if (next.status === "denied") persistPromptStatus("denied");
      setStatus(next.status);
      setError(next.message);
    }
  }, []);

  const dismiss = useCallback(() => {
    persistPromptStatus("dismissed");
    setStatus("dismissed");
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setCoordinates(null);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    coordinates,
    error,
    dismiss,
    request,
    reset,
    status,
  };
}
