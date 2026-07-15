"use client";

import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { useTranslation } from "react-i18next";
import {
  extractPushNotificationData,
  normalizePushNavigationTarget,
} from "./native/pushDeepLinks";
import { PushNotificationsService } from "./native/PushNotificationsService";

type NativePushControllerProps = {
  userId: string;
};

// v4 rearma uma única vez o CTA para quem não ativou nas campanhas anteriores.
// Usuários já autorizados seguem pelo registro silencioso e não veem o modal.
const PROMPT_KEY_PREFIX = "gym-circle.push-permission-cta.v4";
const PROMPT_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const FOREGROUND_TOAST_MS = 5_500;

type ForegroundPushToast = {
  id: number;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

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
  const [foregroundToast, setForegroundToast] =
    useState<ForegroundPushToast | null>(null);
  const [activating, setActivating] = useState(false);
  const [promptErrorKey, setPromptErrorKey] = useState<
    "denied" | "unsupported" | "failed" | null
  >(null);
  // Motivo técnico real da falha de registro (erro do APNs vindo do
  // registrationError, ou "push_registration_timeout"). Exibido no device pra
  // diagnóstico — sem isso só víamos o erro genérico.
  const [promptErrorDetail, setPromptErrorDetail] = useState<string | null>(
    null,
  );

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
      if (cancelled) return;
      if (result.status === "registered") {
        setPromptOpen(false);
        setPromptErrorKey(null);
        setPromptErrorDetail(null);
        return;
      }
      if (result.status !== "failed") return;

      const detail =
        result.error instanceof Error
          ? result.error.message
          : typeof result.error === "string"
            ? result.error
            : "unknown_error";
      setPromptErrorDetail(detail);
      setPromptErrorKey("failed");
      setPromptOpen(true);

      if (attempt >= 2) return;
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

      if (permission === "denied" && !promptWasDismissed(userId)) {
        timer = window.setTimeout(() => {
          if (!cancelled) {
            setPromptErrorKey("denied");
            setPromptOpen(true);
          }
        }, 4_000);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    let hideTimer: number | null = null;

    const handleForegroundPush = (event: Event) => {
      const notification = (event as CustomEvent).detail as
        | Record<string, unknown>
        | undefined;
      const title =
        typeof notification?.title === "string" && notification.title.trim()
          ? notification.title.trim()
          : t("pushPermission.foregroundTitle");
      const body =
        typeof notification?.body === "string" && notification.body.trim()
          ? notification.body.trim()
          : t("pushPermission.foregroundBody");
      const data = extractPushNotificationData(notification ?? {});

      try {
        window.localStorage.setItem(
          "gym-circle.push-last-received.v1",
          JSON.stringify({
            title,
            body,
            receivedAt: new Date().toISOString(),
            type:
              typeof data.type === "string"
                ? data.type
                : typeof data.gymcircle_kind === "string"
                  ? data.gymcircle_kind
                  : null,
          }),
        );
      } catch {
        // Diagnóstico local é best-effort.
      }

      setForegroundToast({
        id: Date.now(),
        title,
        body,
        data,
      });

      if (hideTimer !== null) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(
        () => setForegroundToast(null),
        FOREGROUND_TOAST_MS,
      );
    };

    window.addEventListener("gymcircle:push-received", handleForegroundPush);
    return () => {
      if (hideTimer !== null) window.clearTimeout(hideTimer);
      window.removeEventListener(
        "gymcircle:push-received",
        handleForegroundPush,
      );
    };
  }, [t]);

  function dismissPrompt() {
    if (promptErrorKey !== "failed" && promptErrorKey !== "unsupported") {
      rememberPromptDecision(userId);
    }
    setPromptOpen(false);
    setPromptErrorKey(null);
    setPromptErrorDetail(null);
  }

  async function activatePush() {
    if (activating) return;
    setActivating(true);
    setPromptErrorKey(null);
    setPromptErrorDetail(null);
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
      setPromptErrorKey("denied");
    } else if (result.status === "unsupported") {
      setPromptErrorKey("unsupported");
    } else {
      // Expõe o motivo REAL: erro do APNs (registrationError) ou
      // "push_registration_timeout" (nenhum callback nativo em 20s → binário
      // sem capability/entitlement de push corretos).
      const detail =
        result.error instanceof Error
          ? result.error.message
          : typeof result.error === "string"
            ? result.error
            : "unknown_error";
      console.error("[push] registration failed:", result.error);
      setPromptErrorDetail(detail);
      setPromptErrorKey("failed");
    }
    setActivating(false);
  }

  function openForegroundToastTarget() {
    if (!foregroundToast) return;
    const target = normalizePushNavigationTarget(foregroundToast.data);
    if (!target) {
      setForegroundToast(null);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("gymcircle:push-action", {
        detail: { data: foregroundToast.data, target },
      }),
    );
    setForegroundToast(null);
  }

  const canAttemptActivation =
    promptErrorKey !== "denied" && promptErrorKey !== "unsupported";

  return (
    <>
      {foregroundToast ? (
        <button
          aria-live="polite"
          className="gc-pressable fixed left-4 right-4 top-[calc(var(--gc-safe-top)+12px)] z-[115] mx-auto flex max-w-[448px] items-start gap-3 rounded-[22px] border border-white/[0.09] bg-[#111417]/95 p-3 text-left shadow-[0_18px_64px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          onClick={openForegroundToastTarget}
          type="button"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
            <BellRing size={20} strokeWidth={2.35} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-black text-white">
              {foregroundToast.title}
            </span>
            <span className="mt-0.5 line-clamp-2 block text-[12px] font-bold leading-4 text-white/58">
              {foregroundToast.body}
            </span>
          </span>
        </button>
      ) : null}

      {promptOpen ? (
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

            {promptErrorKey ? (
              <p
                aria-live="assertive"
                className="mt-4 rounded-[14px] bg-[var(--gc-pink)]/10 px-3 py-2.5 text-[11.5px] font-bold text-[var(--gc-pink)]"
              >
                {t(`pushPermission.${promptErrorKey}`)}
              </p>
            ) : null}

            {promptErrorDetail ? (
              <p className="mt-2 select-text break-words rounded-[12px] bg-white/[0.05] px-3 py-2 font-mono text-[10.5px] leading-4 text-white/55">
                {promptErrorDetail}
              </p>
            ) : null}

            <div
              className={`mt-5 grid gap-2 ${canAttemptActivation ? "grid-cols-2" : "grid-cols-1"}`}
            >
              <button
                className="gc-pressable rounded-full bg-white/[0.07] py-3 text-[13px] font-black text-white"
                disabled={activating}
                onClick={dismissPrompt}
                type="button"
              >
                {promptErrorKey
                  ? t("common.close")
                  : t("pushPermission.notNow")}
              </button>
              {canAttemptActivation ? (
                <button
                  className="gc-pressable rounded-full bg-[var(--gc-brand)] py-3 text-[13px] font-black text-[var(--gc-brand-ink)] disabled:opacity-45"
                  disabled={activating}
                  onClick={() => void activatePush()}
                  type="button"
                >
                  {activating
                    ? t("pushPermission.activating")
                    : t("pushPermission.activate")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
