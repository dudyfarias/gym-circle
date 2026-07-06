"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { useTranslation } from "react-i18next";
import { PushNotificationsService } from "./native/PushNotificationsService";

type NativePushControllerProps = {
  userId: string;
};

const PROMPT_KEY_PREFIX = "gym-circle.push-permission-cta.v1";
const PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function promptStorageKey(userId: string) {
  return `${PROMPT_KEY_PREFIX}:${userId}`;
}

function promptWasDismissed(userId: string) {
  try {
    const stored = window.localStorage.getItem(promptStorageKey(userId));
    if (!stored) return false;
    const dismissedAt = Number(stored);
    // Valores legados sem timestamp continuam respeitados.
    if (!Number.isFinite(dismissedAt)) return true;
    return Date.now() - dismissedAt < PROMPT_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function rememberPromptDecision(userId: string) {
  try {
    window.localStorage.setItem(promptStorageKey(userId), String(Date.now()));
  } catch {
    // A ausência de localStorage só pode fazer o CTA reaparecer futuramente.
  }
}

/**
 * Orquestra o push do shell Capacitor depois que a sessão já foi autenticada.
 *
 * - instala os quatro listeners oficiais uma única vez;
 * - renova silenciosamente o token quando a permissão já está concedida;
 * - quando o estado é `prompt`, mostra primeiro um CTA contextual;
 * - só chama requestPermissions() após toque explícito em "Ativar".
 */
export function NativePushController({ userId }: NativePushControllerProps) {
  const { t } = useTranslation();
  const services = useGymCircleServices();
  const [promptOpen, setPromptOpen] = useState(false);
  const [activating, setActivating] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;
    let removeListeners: (() => Promise<void>) | null = null;

    async function registerWithRetry(attempt: number) {
      const result =
        await PushNotificationsService.registerForPushNotifications(
          userId,
          services.push,
        );
      if (cancelled || result.status !== "failed" || attempt >= 2) return;
      timer = window.setTimeout(
        () => void registerWithRetry(attempt + 1),
        attempt === 0 ? 15_000 : 45_000,
      );
    }

    async function boot() {
      if (!(await PushNotificationsService.isAvailable()) || cancelled) return;
      removeListeners = await PushNotificationsService.setupListeners(
        userId,
        services.push,
      );
      if (cancelled) {
        await removeListeners();
        return;
      }

      const permission = await PushNotificationsService.checkPermissions();
      if (permission === "granted") {
        // Não disputa o primeiro frame útil depois do login.
        timer = window.setTimeout(
          () => void registerWithRetry(0),
          2_500,
        );
        return;
      }

      if (
        (permission === "prompt" ||
          permission === "prompt-with-rationale") &&
        !promptWasDismissed(userId)
      ) {
        // Contextualiza antes do popup do iOS; nunca pede no primeiro segundo.
        timer = window.setTimeout(() => {
          if (!cancelled) setPromptOpen(true);
        }, 4_000);
      }
    }

    void boot();
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      if (removeListeners) void removeListeners();
    };
  }, [services.push, userId]);

  function dismissPrompt() {
    rememberPromptDecision(userId);
    setPromptOpen(false);
    setPromptError(null);
  }

  async function activatePush() {
    if (activating) return;
    setActivating(true);
    setPromptError(null);
    const result = await PushNotificationsService.requestPushPermission(
      userId,
      services.push,
    );

    if (result.status === "registered") {
      rememberPromptDecision(userId);
      try {
        window.localStorage.setItem("gc-push-enabled", "true");
      } catch {
        // O token no Supabase é o estado autoritativo.
      }
      setPromptOpen(false);
    } else if (result.status === "permission_denied") {
      rememberPromptDecision(userId);
      setPromptError(t("pushPermission.denied"));
    } else if (result.status === "unsupported") {
      setPromptError(t("pushPermission.unsupported"));
    } else {
      setPromptError(t("pushPermission.failed"));
    }
    setActivating(false);
  }

  if (!promptOpen) return null;

  return (
    <div
      aria-label={t("pushPermission.title")}
      aria-modal="true"
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/65 px-4 pb-[calc(var(--gc-safe-bottom)+16px)] backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-[448px] rounded-[26px] border border-white/[0.09] bg-[#101214] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
        <span className="grid size-12 place-items-center rounded-[16px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
          <BellRing size={22} strokeWidth={2.4} />
        </span>
        <h2 className="mt-4 text-[19px] font-black text-white">
          {t("pushPermission.title")}
        </h2>
        <p className="mt-1.5 text-[13px] font-bold leading-5 text-white/52">
          {t("pushPermission.body")}
        </p>

        {promptError ? (
          <p
            aria-live="assertive"
            className="mt-4 rounded-[14px] bg-[var(--gc-pink)]/10 px-3 py-2.5 text-[11.5px] font-bold text-[var(--gc-pink)]"
          >
            {promptError}
          </p>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            className="gc-pressable rounded-full bg-white/[0.07] py-3 text-[13px] font-black text-white"
            disabled={activating}
            onClick={dismissPrompt}
            type="button"
          >
            {promptError
              ? t("common.close")
              : t("pushPermission.notNow")}
          </button>
          <button
            className="gc-pressable rounded-full bg-[var(--gc-brand)] py-3 text-[13px] font-black text-[var(--gc-brand-ink)] disabled:opacity-45"
            disabled={activating || Boolean(promptError)}
            onClick={() => void activatePush()}
            type="button"
          >
            {activating
              ? t("pushPermission.activating")
              : t("pushPermission.activate")}
          </button>
        </div>
      </div>
    </div>
  );
}
