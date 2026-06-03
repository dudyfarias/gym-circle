"use client";

import { ChevronLeft, HelpCircle, Lock, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeIcon } from "./design-system";
import { simulateHaptic } from "./social/haptics";
import {
  getAchievementCompositeId,
  type Achievement,
  type AchievementRarity,
} from "./social/achievements";
import {
  formatRarityPercent,
  getAchievementGlobalStats,
  type AchievementGlobalStats,
} from "./social/achievementsStats";
import { useGymCircleServices } from "@gym-circle/core/hooks";

/**
 * AchievementDetailOverlay — Sprint 7.5.2.
 *
 * Tela de detalhe full-screen estilo Apple Fitness Awards (Section 21 do
 * brief Sprint 7.5). Aberta ao tocar em qualquer achievement em qualquer
 * surface (MyCircle highlight, BadgesSheet card, Profile featured row).
 *
 * Layout:
 *   - Header transparent: ← close + ⤴ share placeholder
 *   - Centro: arte 3D grande (2D fallback BadgeIcon enquanto assets
 *     não chegam — Sprint 7.5.3) + spotlight glow
 *   - Abaixo: nome + descrição + stats card + raridade
 *   - Locked state: arte desfocada + cadeado + "Como desbloquear"
 *   - Secret + !earned: arte silhueta + "???"
 *
 * Animação entrada:
 *   - Background blur fade-in (200ms)
 *   - Card scale 0.96 → 1.0 (300ms cubic-bezier)
 *   - Glow ring entry (400ms ease-out)
 *   - haptic("brand") on mount
 *
 * Performance: dynamic import no GymCirclePreview pra lazy load. Detail
 * data (earned_at, count) entra opcionalmente — overlay renderiza sem se
 * caller não tiver.
 */

export type AchievementDetailData = {
  /** Quando o user ganhou (do user_achievements.earned_at). */
  earnedAt?: string | null;
  /** Última vez ganhou (pra repeatable trophies). */
  lastEarnedAt?: string | null;
  /** Quantas vezes ganhou (pra repeatable trophies). */
  count?: number;
  /**
   * Percentual de users globais que possuem (Section 15). Quando ausente
   * ou < 10 amostras, UI esconde — não mostra dados estatisticamente
   * insignificantes.
   */
  globalEarnedPercent?: number | null;
};

type AchievementDetailOverlayProps = {
  open: boolean;
  achievement: Achievement | null;
  /** Quando ausente, overlay renderiza só nome/descrição básicos. */
  detail?: AchievementDetailData;
  /** Se true, mostra "Como desbloquear" em vez de stats. */
  showUnlockHint?: boolean;
  onClose: () => void;
};

export function AchievementDetailOverlay({
  open,
  achievement,
  detail,
  showUnlockHint = false,
  onClose,
}: AchievementDetailOverlayProps) {
  const { t, i18n } = useTranslation();
  const services = useGymCircleServices();
  const [mounted, setMounted] = useState(false);
  // Sprint 7.5.8 + 7.5.9 — fetch stats globais completas ao abrir.
  // Tripla (percent + earnedCount + totalUsers) permite UX diferenciada
  // entre "ninguém ganhou" / "você é o primeiro" / "% real". Cache 5min.
  const [globalStats, setGlobalStats] = useState<AchievementGlobalStats | null>(
    null,
  );

  // Trigger animations on mount/open + haptic burst
  useEffect(() => {
    if (!open) {
      setMounted(false);
      return;
    }
    simulateHaptic("brand");
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Sprint 7.5.8 + 7.5.9 — fetch stats globais quando achievement muda.
  // Não bloqueia render: overlay aparece, e quando RPC retorna o chip
  // de raridade aparece com fade do mounted state.
  useEffect(() => {
    if (!open || !achievement) {
      setGlobalStats(null);
      return;
    }
    let cancelled = false;
    const compositeId = getAchievementCompositeId(achievement);
    void (async () => {
      const stats = await getAchievementGlobalStats(
        services.client,
        compositeId,
      );
      if (!cancelled) setGlobalStats(stats);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, achievement, services.client]);

  const isMysterySecret = useMemo(
    () => Boolean(achievement?.secret && !achievement?.earned),
    [achievement],
  );

  if (!open || !achievement) return null;

  const title = isMysterySecret ? "???" : achievement.label;
  const description = isMysterySecret
    ? t("achievementDetail.mysteryHint")
    : achievement.description;

  // Stats só quando o user JÁ ganhou + temos detail
  const showStats =
    achievement.earned && !isMysterySecret && detail !== undefined;

  // Sprint 7.5.9 — UX diferenciada por cenário de dados:
  //   A. Detail.globalEarnedPercent override → mostra % direto (legacy)
  //   B. earnedCount=0 + totalUsers>0 → "Ninguém conquistou ainda" (raro)
  //   C. earnedCount=1 + user é earned → "Você é o primeiro!" (especial)
  //   D. earnedCount>=2 → "% dos usuários possuem" (caso comum)
  //   E. Sem dados → fallback chip nominal (rarity)
  const effectiveGlobalPercent =
    detail?.globalEarnedPercent !== undefined &&
    detail?.globalEarnedPercent !== null
      ? detail.globalEarnedPercent
      : globalStats?.percent ?? null;
  const formattedRarityPercent = formatRarityPercent(
    effectiveGlobalPercent,
    i18n.language,
  );

  // Cenário B/C: detecta "ninguém" ou "você é o único" baseado no
  // earned + earnedCount. user é o earned quando achievement.earned=true.
  const isOnlyEarner =
    achievement.earned &&
    globalStats !== null &&
    globalStats.earnedCount === 1;
  const isNobodyYet =
    !achievement.earned &&
    globalStats !== null &&
    globalStats.earnedCount === 0 &&
    globalStats.totalUsers > 0;

  // Raridade aparece quando: dados reais disponíveis OU rarity nominal
  const showRarity =
    !isMysterySecret &&
    (formattedRarityPercent !== null ||
      isOnlyEarner ||
      isNobodyYet ||
      achievement.rarity !== undefined);

  return (
    <div
      aria-hidden={!open}
      aria-label={t("achievementDetail.title")}
      aria-modal="true"
      className={[
        "absolute inset-0 z-[74] flex flex-col bg-[#0a0b0c] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      role="dialog"
    >
      {/* Spotlight ambient — gradient radial brand do centro */}
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 transition-opacity duration-700 ease-out",
          mounted ? "opacity-100" : "opacity-0",
        ].join(" ")}
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 38%, rgba(48,213,255,0.16), transparent 55%)",
        }}
      />

      {/* Header transparent */}
      <header className="relative grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          aria-label={t("common.close")}
          className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white backdrop-blur-xl"
          onClick={onClose}
          type="button"
        >
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>
        <div />
        <button
          aria-label={t("achievementDetail.share")}
          className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white/56 backdrop-blur-xl"
          disabled
          type="button"
        >
          <Share2 size={17} strokeWidth={2.4} />
        </button>
      </header>

      {/* Body scrollable */}
      <div className="relative flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto flex max-w-[480px] flex-col items-center px-6 pb-8 pt-2">
          {/* Arte 3D placeholder — fallback 2D BadgeIcon GIGANTE com glow + scale */}
          <div
            className={[
              "relative my-8 transition-transform duration-500 ease-out",
              mounted ? "scale-100" : "scale-95",
            ].join(" ")}
          >
            {/* Glow ring atrás (visível só pra earned não-secret) */}
            {achievement.earned && !isMysterySecret ? (
              <div
                aria-hidden
                className={[
                  "absolute inset-0 -z-10 rounded-full bg-[var(--gc-brand)]/24 blur-3xl transition-opacity duration-700 ease-out",
                  mounted ? "opacity-100" : "opacity-0",
                ].join(" ")}
              />
            ) : null}

            <ArtworkPlaceholder
              achievement={achievement}
              isMysterySecret={isMysterySecret}
              locked={!achievement.earned && !isMysterySecret}
            />
          </div>

          {/* Nome */}
          <h2
            className={[
              "text-center text-[26px] font-black leading-tight tracking-tight text-white transition-all duration-500 ease-out",
              mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            ].join(" ")}
          >
            {title}
          </h2>

          {/* Descrição */}
          <p
            className={[
              "mt-2 max-w-[360px] text-center text-[14px] font-bold leading-[1.45] text-white/72 transition-all duration-500 ease-out [transition-delay:80ms]",
              mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
            ].join(" ")}
          >
            {description}
          </p>

          {/* Progress bar quando há progress + !earned */}
          {achievement.progress && !achievement.earned && !isMysterySecret ? (
            <div className="mt-6 w-full max-w-[320px]">
              <div className="mb-1.5 flex items-baseline justify-between">
                <span className="text-[11px] font-black uppercase tracking-[0.06em] text-white/44">
                  {t("achievementDetail.progress")}
                </span>
                <span className="text-[12px] font-black text-white">
                  {achievement.progress.current}/{achievement.progress.target}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(
                      100,
                      (achievement.progress.current / achievement.progress.target) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Stats card — só quando earned + detail disponível */}
          {showStats && detail ? (
            <div className="mt-6 grid w-full max-w-[360px] grid-cols-1 gap-2 rounded-[20px] bg-white/[0.035] p-4 sm:grid-cols-2">
              {detail.earnedAt ? (
                <StatRow
                  label={t("achievementDetail.stats.earnedAt")}
                  value={formatDate(detail.earnedAt, i18n.language)}
                />
              ) : null}
              {detail.count && detail.count > 1 ? (
                <StatRow
                  label={t("achievementDetail.stats.total")}
                  value={t("achievementDetail.stats.totalCount", {
                    count: detail.count,
                  })}
                />
              ) : null}
              {detail.lastEarnedAt && detail.count && detail.count > 1 ? (
                <StatRow
                  label={t("achievementDetail.stats.lastEarned")}
                  value={formatDate(detail.lastEarnedAt, i18n.language)}
                />
              ) : null}
            </div>
          ) : null}

          {/* Raridade — Sprint 7.5.8 + 7.5.9: cenário visual escolhido
              em ordem de prioridade:
              1. "Você é o primeiro!" quando earnedCount=1 e user é esse 1
              2. "Ninguém conquistou ainda" quando earnedCount=0 (raro)
              3. "% real" quando earnedCount>=2 com precisão até 0.01%
              4. Chip nominal de rarity (common/uncommon/rare/epic/legendary) */}
          {showRarity ? (
            <div
              className={[
                "mt-6 transition-all duration-500 ease-out [transition-delay:160ms]",
                mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
              ].join(" ")}
            >
              {isOnlyEarner ? (
                <p className="text-center text-[12px] font-black text-[var(--gc-brand)]">
                  ✦ {t("achievementDetail.onlyEarner")}
                </p>
              ) : isNobodyYet ? (
                <p className="text-center text-[12px] font-bold text-white/56">
                  {t("achievementDetail.nobodyYet")}
                </p>
              ) : formattedRarityPercent ? (
                <p className="text-center text-[12px] font-bold text-white/56">
                  {t("achievementDetail.rarityPercent", {
                    percent: formattedRarityPercent,
                  })}
                </p>
              ) : achievement.rarity ? (
                <RarityChip rarity={achievement.rarity} t={t} />
              ) : null}
            </div>
          ) : null}

          {/* Como desbloquear — locked state com hint */}
          {showUnlockHint && !achievement.earned && !isMysterySecret ? (
            <div className="mt-6 flex items-start gap-3 rounded-[16px] bg-white/[0.04] px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/56">
                <Lock size={15} strokeWidth={2.4} />
              </span>
              <p className="min-w-0 flex-1 text-[12.5px] font-bold leading-[1.4] text-white/72">
                {achievement.description}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder de arte 3D — Sprint 7.5.3 substitui por <img src="...webp">
 * quando assets pre-rendered chegarem. Por enquanto BadgeIcon gigante.
 *
 * Estados visuais:
 *   - mystery secret + !earned → HelpCircle gigante, white/36
 *   - locked (not earned, not secret) → BadgeIcon dim + Lock overlay
 *   - earned → BadgeIcon brilhante
 */
function ArtworkPlaceholder({
  achievement,
  isMysterySecret,
  locked,
}: {
  achievement: Achievement;
  isMysterySecret: boolean;
  locked: boolean;
}) {
  if (isMysterySecret) {
    return (
      <span className="grid size-44 place-items-center rounded-[40px] bg-white/[0.06] text-white/36">
        <HelpCircle size={88} strokeWidth={1.8} />
      </span>
    );
  }
  if (locked) {
    return (
      <div className="relative">
        <div className="opacity-32 blur-[2px]">
          <BadgeIcon
            className="size-44 rounded-[40px]"
            earned={false}
            iconKey={achievement.iconKey}
            size={86}
          />
        </div>
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid size-14 place-items-center rounded-full bg-white/[0.08] text-white/72 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <Lock size={24} strokeWidth={2.4} />
          </span>
        </span>
      </div>
    );
  }
  return (
    <BadgeIcon
      className="size-44 rounded-[40px]"
      earned
      iconKey={achievement.iconKey}
      size={86}
    />
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white/[0.04] px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-white/44">
        {label}
      </p>
      <p className="mt-0.5 text-[14px] font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

function RarityChip({
  rarity,
  t,
}: {
  rarity: AchievementRarity;
  t: (key: string) => string;
}) {
  const tone = RARITY_TONE[rarity];
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.04em]",
        tone,
      ].join(" ")}
    >
      {t(`achievementDetail.rarity.${rarity}`)}
    </span>
  );
}

const RARITY_TONE: Record<AchievementRarity, string> = {
  common: "bg-white/[0.06] text-white/82",
  uncommon: "bg-[#34D399]/14 text-[#34D399]",
  rare: "bg-[var(--gc-brand)]/16 text-[var(--gc-brand)]",
  epic: "bg-[#A78BFA]/16 text-[#A78BFA]",
  legendary: "bg-[#FBBF24]/16 text-[#FBBF24]",
};

function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
