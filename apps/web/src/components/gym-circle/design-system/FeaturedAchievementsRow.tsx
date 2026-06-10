"use client";

import { ChevronRight, HelpCircle, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AchievementArtifact3D } from "./AchievementArtifact3D";
import type {
  Achievement,
  AchievementKind,
} from "../social/achievements";

/**
 * Sprint 7.5.5 — Conquistas em Destaque (Section 13 do brief).
 *
 * Row horizontal compacto no ProfileScreen (e ProfileSheet pra outros
 * users) com até 3 achievements priorizados. Modos:
 *
 *   1. User manualmente equipou (profile.featuredAchievements) →
 *      mostra esses. Validação que cada ID realmente está em
 *      user_achievements acontece no caller (filtro antes de passar).
 *   2. User não equipou → caller deve passar suggested (de
 *      `suggestFeaturedAchievements`).
 *   3. Lista vazia → não renderiza nada (caller decide).
 *
 * Tap em qualquer card → onOpenDetail(achievement). Wire-up no
 * GymCirclePreview pra abrir AchievementDetailOverlay.
 *
 * Compatível com 5 categorias — Relic (purple glow), Trophy (brand),
 * Medal (gold), Badge (white), Challenge (green).
 */

type FeaturedAchievementsRowProps = {
  achievements: ReadonlyArray<Achievement>;
  /** Opcional: tap em qualquer card. */
  onOpenDetail?: (achievement: Achievement) => void;
  /**
   * Sprint 15.5 — botão pill cinza no canto superior direito do header que
   * abre o Hall da Fama (overlay). Quando presente, a seção renderiza mesmo
   * com lista vazia (header + hint) pra entrada do hall nunca sumir.
   */
  onOpenHall?: () => void;
  /** Espaçamento extra do caller (ex: mt-8 nas seções do MyCircle). */
  className?: string;
};

export function FeaturedAchievementsRow({
  achievements,
  onOpenDetail,
  onOpenHall,
  className = "",
}: FeaturedAchievementsRowProps) {
  const { t } = useTranslation();

  if (achievements.length === 0 && !onOpenHall) return null;

  return (
    <section className={["mt-4", className].join(" ")}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-black uppercase tracking-[0.06em] text-white/44">
          {t("profile.featuredAchievements.title")}
        </h3>
        {onOpenHall ? (
          <button
            aria-label={t("achievementsSheet.title")}
            className="gc-pressable grid size-8 place-items-center rounded-full bg-white/[0.06] text-white/72"
            onClick={onOpenHall}
            type="button"
          >
            <ChevronRight size={16} strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
      {achievements.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {achievements.slice(0, 3).map((achievement) => (
            <FeaturedCard
              achievement={achievement}
              key={`${achievement.kind}-${achievement.id}`}
              onTap={onOpenDetail ? () => onOpenDetail(achievement) : undefined}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-[16px] bg-white/[0.025] px-3 py-3 text-[12px] font-bold text-white/44">
          {t("profile.featuredAchievements.empty")}
        </p>
      )}
    </section>
  );
}

/**
 * Card compacto (square aspect). Visual:
 *   - Glow ring sutil colorido por categoria (relic/trophy/medal/badge/challenge)
 *   - Ícone único centralizado
 *   - Label truncada bottom
 *
 * Estados:
 *   - earned + public → ícone brilhante + glow ring
 *   - secret + !earned → "???" com mystery icon (raro pq destaque
 *     prioriza earned, mas vale a defensive)
 *   - !earned + public → dim + Lock (também raro — caller costuma
 *     filtrar pra mostrar só earned)
 */
function FeaturedCard({
  achievement,
  onTap,
}: {
  achievement: Achievement;
  onTap?: () => void;
}) {
  const { t } = useTranslation();
  const isMystery = Boolean(achievement.secret && !achievement.earned);
  const Tag = onTap ? "button" : "div";
  const tone = KIND_TONE[achievement.kind];

  return (
    <Tag
      aria-label={
        isMystery
          ? t("profile.featuredAchievements.secret")
          : achievement.label
      }
      className={[
        "flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-[16px] p-2 transition-colors",
        achievement.earned ? tone.bg : "bg-white/[0.025]",
        onTap ? "gc-pressable" : "",
      ].join(" ")}
      onClick={onTap}
      type={onTap ? "button" : undefined}
    >
      {isMystery ? (
        <span className="grid size-9 place-items-center rounded-[12px] bg-white/[0.06] text-white/40">
          <HelpCircle size={18} strokeWidth={2.4} />
        </span>
      ) : achievement.earned ? (
        // Sprint 15 — artefato 3D no destaque do perfil (glow do card via
        // KIND_TONE; o halo interno fica off pra não duplicar brilho).
        <AchievementArtifact3D achievement={achievement} glow={false} size="sm" />
      ) : (
        <span className="grid size-9 place-items-center rounded-[12px] bg-white/[0.04] text-white/40">
          <Lock size={16} strokeWidth={2.4} />
        </span>
      )}
      <span
        className={[
          "line-clamp-2 text-center text-[9.5px] font-black leading-[1.1]",
          achievement.earned ? tone.text : "text-white/56",
        ].join(" ")}
      >
        {isMystery ? "???" : achievement.label}
      </span>
    </Tag>
  );
}

/**
 * Paleta por categoria — bg subtle + glow shadow + text tone.
 * Cores escolhidas pra dar hierarquia visual: relic (purple) > trophy
 * (brand) > medal (gold) > badge (white).
 */
const KIND_TONE: Record<
  AchievementKind,
  { bg: string; glow: string; text: string }
> = {
  relic: {
    bg: "bg-[#A78BFA]/12",
    glow: "shadow-[0_0_24px_rgba(167,139,250,0.32)]",
    text: "text-[#A78BFA]",
  },
  trophy: {
    bg: "bg-[var(--gc-brand)]/14",
    glow: "shadow-[0_0_24px_rgba(48,213,255,0.28)]",
    text: "text-[var(--gc-brand)]",
  },
  medal: {
    bg: "bg-[#FBBF24]/14",
    glow: "shadow-[0_0_24px_rgba(251,191,36,0.24)]",
    text: "text-[#FBBF24]",
  },
  badge: {
    bg: "bg-white/[0.06]",
    glow: "shadow-[0_0_18px_rgba(255,255,255,0.12)]",
    text: "text-white",
  },
  challenge: {
    bg: "bg-[#34D399]/12",
    glow: "shadow-[0_0_24px_rgba(52,211,153,0.28)]",
    text: "text-[#34D399]",
  },
};
