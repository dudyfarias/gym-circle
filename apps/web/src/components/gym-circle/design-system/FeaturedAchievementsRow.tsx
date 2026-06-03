"use client";

import { HelpCircle, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BadgeIcon } from "./BadgeIcon";
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
};

export function FeaturedAchievementsRow({
  achievements,
  onOpenDetail,
}: FeaturedAchievementsRowProps) {
  const { t } = useTranslation();

  if (achievements.length === 0) return null;

  return (
    <section className="mt-4">
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.06em] text-white/44">
        {t("profile.featuredAchievements.title")}
      </h3>
      <div className="grid grid-cols-3 gap-2">
        {achievements.slice(0, 3).map((achievement) => (
          <FeaturedCard
            achievement={achievement}
            key={`${achievement.kind}-${achievement.id}`}
            onTap={onOpenDetail ? () => onOpenDetail(achievement) : undefined}
          />
        ))}
      </div>
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
        <BadgeIcon
          className={[
            "size-9",
            tone.glow,
          ].join(" ")}
          earned
          iconKey={achievement.iconKey}
          size={20}
        />
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
