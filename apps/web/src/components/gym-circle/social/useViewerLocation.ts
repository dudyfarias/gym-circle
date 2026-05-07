"use client";

import { useCallback, useState } from "react";
import type { Coordinates } from "@gym-circle/core";

export type ViewerLocationStatus =
  | "idle"
  | "requesting"
  | "granted"
  | "denied"
  | "error"
  | "unsupported";

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
  const [status, setStatus] = useState<ViewerLocationStatus>("idle");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setStatus("granted");
    } catch (err) {
      const next = getLocationError(err);
      setCoordinates(null);
      setStatus(next.status);
      setError(next.message);
    }
  }, []);

  const reset = useCallback(() => {
    setCoordinates(null);
    setStatus("idle");
    setError(null);
  }, []);

  return {
    coordinates,
    error,
    request,
    reset,
    status,
  };
}
