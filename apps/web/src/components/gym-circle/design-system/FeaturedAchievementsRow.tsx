"use client";

import { ChevronRight, HelpCircle, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AchievementArtifact3D } from "./AchievementArtifact3D";
import type { Achievement } from "../social/achievements";
import {
  getAchievementVisual,
  type AchievementVisualTone,
} from "../social/achievementVisual";

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
  // Sprint 19 — card colorido por RARIDADE (mesmo adapter do artefato), não
  // mais por categoria (medal perdeu o dourado fixo).
  const tone = TONE_CARD[getAchievementVisual(achievement).tone];

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
 * Sprint 19 — paleta do card por RARIDADE (tom do adapter): bg subtle + text.
 * comum(cinza) < incomum(verde) < raro(azul) < épico(roxo) < lendário(laranja).
 */
const TONE_CARD: Record<AchievementVisualTone, { bg: string; text: string }> = {
  stone: { bg: "bg-white/[0.06]", text: "text-white/82" },
  emerald: { bg: "bg-[#34D399]/12", text: "text-[#34D399]" },
  sapphire: { bg: "bg-[#3B82F6]/14", text: "text-[#60A5FA]" },
  amethyst: { bg: "bg-[#A855F7]/14", text: "text-[#C4B5FD]" },
  amber: { bg: "bg-[#F59E0B]/14", text: "text-[#FBBF24]" },
  dark: { bg: "bg-white/[0.04]", text: "text-white/56" },
  // Legados (não produzidos pelo mapa atual) — fallback razoável.
  cyan: { bg: "bg-[var(--gc-brand)]/14", text: "text-[var(--gc-brand)]" },
  blue: { bg: "bg-[#009DFF]/14", text: "text-[#60A5FA]" },
  bronze: { bg: "bg-[#B87536]/14", text: "text-[#D9A066]" },
  silver: { bg: "bg-white/[0.07]", text: "text-white/82" },
  gold: { bg: "bg-[#F5B83B]/14", text: "text-[#FBBF24]" },
  crystal: { bg: "bg-[#8CFBFF]/14", text: "text-[#8CFBFF]" },
};
