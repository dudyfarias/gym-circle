"use client";

const PRODUCTION_APP_URL = "https://gym-circle-rust.vercel.app";

type CapacitorBridge = {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
};

type CapacitorWindow = Window & {
  Capacitor?: CapacitorBridge;
};

function configuredAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    PRODUCTION_APP_URL
  ).replace(/\/$/, "");
}

function isNativeCapacitor() {
  if (typeof window === "undefined") return false;
  const capacitor = (window as CapacitorWindow).Capacitor;
  return (
    capacitor?.isNativePlatform?.() ??
    (typeof capacitor?.getPlatform === "function" && capacitor.getPlatform() !== "web")
  );
}

function currentOrigin() {
  if (typeof window === "undefined") return configuredAppUrl();
  const origin = window.location.origin;
  if (
    isNativeCapacitor() ||
    origin === "capacitor://localhost" ||
    origin === "ionic://localhost" ||
    origin === "file://"
  ) {
    return configuredAppUrl();
  }
  return origin.replace(/\/$/, "");
}

export function getAuthRedirectTo(path = "/") {
  const base = currentOrigin();
  if (!path || path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const message = raw.trim();
  if (!message) return fallback;

  if (message.startsWith("{") || message.startsWith("[")) return fallback;
  if (/provider.*not.*enabled/i.test(message)) {
    return "Esse login ainda não está disponível. Tente novamente em alguns minutos.";
  }
  if (/redirect|callback|oauth/i.test(message)) {
    return "Não conseguimos abrir o login social. Tente novamente ou use email e senha.";
  }
  if (/network|fetch|failed/i.test(message)) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }

  return message;
}
