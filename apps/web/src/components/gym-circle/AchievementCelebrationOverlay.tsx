"use client";

import confetti from "canvas-confetti";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeIcon } from "./design-system";
import { simulateHaptic } from "./social/haptics";
import { getAchievementCompositeId, type Achievement } from "./social/achievements";

/**
 * AchievementCelebrationOverlay — Sprint 7.5.11.
 *
 * Full-screen overlay (z-80) que aparece quando user ganha um achievement
 * pela primeira vez. Combina:
 *
 *   - Background blur + spotlight radial
 *   - Arte 3D gigante (fallback BadgeIcon size 110) com scale spring +
 *     rotation contínua sutil
 *   - Glow ring expandindo do centro
 *   - Confetti particles (canvas-confetti) escalonado por raridade
 *   - Texto stagger top-down: eyebrow → título → descrição → chips
 *   - Haptic burst no mount (intensidade escala com raridade)
 *   - Botão "Continuar" + auto-dismiss timer escalado
 *   - Indicador de queue "N de M" quando há múltiplas celebrações
 *
 * Multi-achievement: caller mantém queue + passa um achievement por vez.
 * Quando dismissar, caller avança pra próximo. UX: 1 overlay limpo por
 * conquista, sem stacking confuso.
 *
 * Performance: confetti roda só durante mount window. Auto-dismiss
 * timer libera memória. canvas-confetti GPU-accelerated em iOS Safari.
 */

type AchievementCelebrationOverlayProps = {
  open: boolean;
  achievement: Achievement | null;
  /** Posição no queue (1-based). undefined quando há 1 só. */
  queueIndex?: number;
  queueTotal?: number;
  onDismiss: () => void;
  /** Pula resto do queue (quando há múltiplas pendentes). */
  onSkipAll?: () => void;
};

export function AchievementCelebrationOverlay({
  open,
  achievement,
  queueIndex,
  queueTotal,
  onDismiss,
  onSkipAll,
}: AchievementCelebrationOverlayProps) {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const confettiFnRef = useRef<ReturnType<typeof confetti.create> | null>(null);

  // Escala visual por raridade: + intensa pra relíquias/legendary.
  // Common (badge) → 30 particles, 3s | Legendary → 200 + 5s + gold
  const intensity = getIntensity(achievement);

  // Auto-dismiss timer — tap "Continuar" cancela
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => onDismiss(), intensity.autoDismissMs);
    return () => clearTimeout(id);
  }, [open, intensity.autoDismissMs, onDismiss]);

  // Sprint 16 — reset do estado de animação ao fechar acontece DURANTE
  // o render (converge em 1 re-render; padrão "adjusting state when
  // props change") em vez de setState síncrono no effect.
  if (!open && mounted) {
    setMounted(false);
  }

  // Mount animation + haptic + confetti burst
  useEffect(() => {
    if (!open || !achievement) {
      return;
    }

    // Haptic baseado na raridade
    simulateHaptic(intensity.haptic);

    const raf = requestAnimationFrame(() => setMounted(true));

    // Setup canvas-confetti com canvas custom (overlay tem z-80, queremos
    // os particles dentro mas atrás do conteúdo)
    if (confettiCanvasRef.current && !confettiFnRef.current) {
      confettiFnRef.current = confetti.create(confettiCanvasRef.current, {
        resize: true,
        useWorker: false, // worker pode bugar em Capacitor WebView
      });
    }

    // Burst inicial (delayed 200ms pra coincidir com scale entry)
    const burstId = setTimeout(() => {
      const fire = confettiFnRef.current ?? confetti;
      fire({
        particleCount: intensity.particles,
        spread: intensity.spread,
        origin: { y: 0.45 },
        colors: intensity.colors,
        gravity: 0.9,
        ticks: 280,
        scalar: intensity.scalar,
      });
      // Burst secundário pra raridades altas (efeito "explosão dupla")
      if (intensity.particles >= 80) {
        setTimeout(() => {
          fire({
            particleCount: Math.floor(intensity.particles * 0.5),
            spread: intensity.spread + 30,
            origin: { y: 0.4, x: 0.2 },
            colors: intensity.colors,
            scalar: intensity.scalar,
          });
          fire({
            particleCount: Math.floor(intensity.particles * 0.5),
            spread: intensity.spread + 30,
            origin: { y: 0.4, x: 0.8 },
            colors: intensity.colors,
            scalar: intensity.scalar,
          });
        }, 250);
      }
    }, 200);

    return () => {
      clearTimeout(burstId);
      cancelAnimationFrame(raf);
    };
  }, [open, achievement, intensity]);

  // Reset confetti instance quando achievement muda (evita stale canvas)
  useEffect(() => {
    return () => {
      if (confettiFnRef.current) {
        confettiFnRef.current.reset();
        confettiFnRef.current = null;
      }
    };
  }, [achievement?.kind, achievement?.id]);

  const showQueueBadge = useMemo(
    () => typeof queueIndex === "number" && typeof queueTotal === "number" && queueTotal > 1,
    [queueIndex, queueTotal],
  );

  if (!open || !achievement) return null;

  const compositeId = getAchievementCompositeId(achievement);

  return (
    <div
      aria-hidden={!open}
      aria-label={t("achievementCelebration.title")}
      aria-modal="true"
      className={[
        "fixed inset-0 z-[80] flex items-center justify-center bg-black/72 backdrop-blur-2xl transition-opacity duration-300",
        mounted ? "opacity-100" : "opacity-0",
      ].join(" ")}
      role="dialog"
    >
      {/* Confetti canvas — preenche overlay inteiro */}
      <canvas
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        ref={confettiCanvasRef}
      />

      {/* Spotlight radial brand color */}
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out",
          mounted ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{
          backgroundImage: `radial-gradient(circle at 50% 45%, ${intensity.glowColor} 0%, transparent 50%)`,
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[420px] flex-col items-center px-6 text-center">
        {/* Queue indicator top */}
        {showQueueBadge ? (
          <p
            className={[
              "mb-4 text-[11px] font-black uppercase tracking-[0.12em] text-white/64 transition-all duration-500 ease-out",
              mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            ].join(" ")}
          >
            {t("achievementCelebration.queueIndicator", {
              index: queueIndex,
              total: queueTotal,
            })}
          </p>
        ) : null}

        {/* Arte 3D placeholder (2D fallback gigante com glow + scale spring) */}
        <div
          className="relative my-6"
          style={{
            // Custom transform stagger pra simular spring overshoot
            transform: mounted ? "scale(1)" : "scale(0.35)",
            transition: "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          {/* Glow ring atrás */}
          <div
            aria-hidden
            className={[
              "absolute inset-0 -z-10 rounded-full blur-3xl transition-opacity duration-1000",
              mounted ? "opacity-100" : "opacity-0",
            ].join(" ")}
            style={{
              backgroundColor: intensity.glowColor,
              transform: "scale(1.5)",
            }}
          />
          <BadgeIcon
            className="size-44 rounded-[40px]"
            earned
            iconKey={achievement.iconKey}
            size={88}
          />
          {/* Sparkle decorativo nos cantos pra raridades altas */}
          {intensity.particles >= 80 ? (
            <>
              <SparkleDecor className="absolute -right-2 -top-2" />
              <SparkleDecor className="absolute -bottom-2 -left-3" />
              <SparkleDecor className="absolute -right-4 bottom-4" />
            </>
          ) : null}
        </div>

        {/* Eyebrow */}
        <p
          className={[
            "text-[12px] font-black uppercase tracking-[0.16em] text-[var(--gc-brand)] transition-all duration-500 ease-out [transition-delay:240ms]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          ].join(" ")}
        >
          {t("achievementCelebration.eyebrow")}
        </p>

        {/* Título */}
        <h2
          className={[
            "mt-3 text-[28px] font-black leading-tight tracking-tight text-white transition-all duration-500 ease-out [transition-delay:340ms]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          ].join(" ")}
        >
          {achievement.label}
        </h2>

        {/* Descrição */}
        <p
          className={[
            "mt-2 max-w-[340px] text-[13.5px] font-bold leading-[1.45] text-white/76 transition-all duration-500 ease-out [transition-delay:420ms]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          ].join(" ")}
        >
          {achievement.description}
        </p>

        {/* Botões */}
        <div
          className={[
            "mt-8 flex w-full flex-col gap-2 transition-all duration-500 ease-out [transition-delay:540ms]",
            mounted ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          ].join(" ")}
        >
          <button
            aria-label={t("achievementCelebration.continue")}
            className="gc-pressable rounded-full bg-white px-6 py-3 text-[14px] font-black text-black"
            data-achievement={compositeId}
            onClick={onDismiss}
            type="button"
          >
            {t("achievementCelebration.continue")}
          </button>
          {showQueueBadge && onSkipAll ? (
            <button
              aria-label={t("achievementCelebration.skipAll")}
              className="gc-pressable rounded-full bg-white/[0.06] px-6 py-2.5 text-[12px] font-bold text-white/64"
              onClick={onSkipAll}
              type="button"
            >
              {t("achievementCelebration.skipAll")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Sparkle absoluto decorativo. CSS-only, sem dependência. Adicionado
 * pra raridades altas (épico/lendário) dar sensação de "joia". 4-point
 * star com pulse subtle.
 */
function SparkleDecor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={["pointer-events-none animate-pulse", className ?? ""].join(" ")}
      style={{ animationDuration: "1800ms" }}
    >
      <svg
        fill="none"
        height="22"
        viewBox="0 0 22 22"
        width="22"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M11 0L13.2 8.8L22 11L13.2 13.2L11 22L8.8 13.2L0 11L8.8 8.8L11 0Z"
          fill="#FBBF24"
        />
      </svg>
    </span>
  );
}

/**
 * Intensity preset baseado em rarity → particle count, spread, colors,
 * haptic strength, auto-dismiss.
 *
 * Haptic mapping pra FeedbackTone existente (haptics.ts):
 *   common    → brand    (selection — leve)
 *   uncommon  → follow   (medium)
 *   rare      → follow   (medium)
 *   epic      → success  (success notification)
 *   legendary → success  (success notification + extended visuals)
 */
type Intensity = {
  particles: number;
  spread: number;
  scalar: number;
  colors: string[];
  glowColor: string;
  autoDismissMs: number;
  haptic: "brand" | "follow" | "success";
};

function getIntensity(achievement: Achievement | null): Intensity {
  const rarity = achievement?.rarity ?? "common";

  switch (rarity) {
    case "legendary":
      return {
        particles: 200,
        spread: 100,
        scalar: 1.2,
        colors: ["#FBBF24", "#F59E0B", "#FCD34D", "#FFEDD5", "#FFFFFF"],
        glowColor: "rgba(251,191,36,0.42)",
        autoDismissMs: 6500,
        haptic: "success",
      };
    case "epic":
      return {
        particles: 140,
        spread: 90,
        scalar: 1.1,
        colors: ["#A78BFA", "#C4B5FD", "#8B5CF6", "#FFFFFF"],
        glowColor: "rgba(167,139,250,0.40)",
        autoDismissMs: 5500,
        haptic: "success",
      };
    case "rare":
      return {
        particles: 90,
        spread: 80,
        scalar: 1.0,
        colors: ["#30D5FF", "#8CFBFF", "#0066FF", "#FFFFFF"],
        glowColor: "rgba(48,213,255,0.36)",
        autoDismissMs: 5000,
        haptic: "follow",
      };
    case "uncommon":
      return {
        particles: 55,
        spread: 70,
        scalar: 0.95,
        colors: ["#34D399", "#A7F3D0", "#10B981", "#FFFFFF"],
        glowColor: "rgba(52,211,153,0.32)",
        autoDismissMs: 4200,
        haptic: "follow",
      };
    case "common":
    default:
      return {
        particles: 35,
        spread: 60,
        scalar: 0.9,
        colors: ["#30D5FF", "#8CFBFF", "#FFFFFF"],
        glowColor: "rgba(48,213,255,0.28)",
        autoDismissMs: 3500,
        haptic: "brand",
      };
  }
}
