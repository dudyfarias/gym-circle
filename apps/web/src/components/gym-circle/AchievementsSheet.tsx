"use client";

import { HelpCircle, Lock, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BadgeIcon } from "./design-system";
import {
  countEarnedAchievements,
  getAllAchievements,
  type Achievement,
  type AchievementKind,
} from "./social/achievements";
import type { EnrichedPost, EnrichedUser } from "./social/types";

/**
 * Sprint 7.5.4 — AchievementsSheet (Hall da Fama).
 *
 * Substitui BadgesSheet. Sheet full-height com 6 tabs por categoria + sub-
 * grupos por estado (Conquistados / Próximos / Bloqueados). Cada card
 * abre AchievementDetailOverlay full-screen.
 *
 * Estrutura (top → bottom):
 *   A. Header — X close + título "Hall da Fama".
 *   B. Hero — barra de progresso "{earned}/{total} conquistadas".
 *   C. Tab chips — Tudo / Badges / Medalhas / Troféus / Relíquias /
 *      Desafios / Secretos.
 *   D. Sub-seções por estado dentro do tab ativo:
 *      - Conquistados (badges/medals/trophies/relics earned)
 *      - Próximos (não-earned, não-secret, com progress)
 *      - Bloqueados (não-earned restantes, sem progress)
 *      Tab "Secretos" lista todos secret achievements (revelados e
 *      misteriosos juntos).
 *   E. Grid 2-col de cards.
 *
 * Privacy: opens só pelo MyCircleSheet que já checa canSeeDetails. Logo,
 * achievements aqui são sempre do user dono do MyCircle aberto (próprio
 * ou outro com follow).
 */

type AchievementsSheetProps = {
  open: boolean;
  user: EnrichedUser | null;
  posts: EnrichedPost[];
  onClose: () => void;
  /**
   * Sprint 7.5.2 — abre AchievementDetailOverlay. Quando ausente, cards
   * ficam decorativos (back-compat).
   */
  onOpenAchievementDetail?: (achievement: Achievement) => void;
};

type TabKey = "all" | AchievementKind;

const TAB_KEYS: ReadonlyArray<TabKey> = [
  "all",
  "badge",
  "medal",
  "trophy",
  "relic",
  "challenge",
];

export function AchievementsSheet({
  open,
  user,
  posts,
  onClose,
  onOpenAchievementDetail,
}: AchievementsSheetProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // Computa achievements. Quando user é null, devolve array vazio que
  // ativa o empty state.
  const achievements = useMemo<Achievement[]>(() => {
    if (!user) return [];
    return getAllAchievements({
      user,
      postsCount: posts.length,
      hasUsedStreakRestore: Boolean(user.lastStreakRestoreUsedAt),
      posts: posts.map((post) => ({
        createdAt: post.createdAt,
        workoutType: post.workoutType ?? null,
        gymId: post.gymId,
      })),
    });
  }, [user, posts]);

  const earnedCount = countEarnedAchievements(achievements);
  const totalCount = achievements.length;
  const progressPct = totalCount === 0 ? 0 : (earnedCount / totalCount) * 100;

  // Filter por tab. "Tudo" mostra TODAS achievements (inclusive secret
  // earned reveladas). Tab específico filtra por kind. Não mostramos
  // secret não-earned fora da tab "Tudo" exceto na própria sub-seção
  // "Bloqueados" — bloqueados secret aparecem como "???".
  const filteredByTab = useMemo(() => {
    if (activeTab === "all") return achievements;
    return achievements.filter((a) => a.kind === activeTab);
  }, [achievements, activeTab]);

  // Sub-grupos: Conquistados, Próximos (com progress), Bloqueados (sem
  // progress ou secret).
  const grouped = useMemo(() => {
    const earned = filteredByTab.filter((a) => a.earned);
    const next = filteredByTab.filter(
      (a) => !a.earned && !a.secret && a.progress,
    );
    const locked = filteredByTab.filter(
      (a) => !a.earned && (a.secret || !a.progress),
    );
    return { earned, next, locked };
  }, [filteredByTab]);

  if (!open) return null;

  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-[69] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <button
        aria-label={t("common.close")}
        className="absolute inset-0 bg-black/68 backdrop-blur-xl"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        type="button"
      />

      <div
        className={[
          "absolute inset-x-0 bottom-0 mx-auto flex max-w-[480px] flex-col overflow-hidden rounded-t-[32px] border-t border-white/[0.08] bg-[#0a0b0c] shadow-[0_-24px_72px_rgba(0,0,0,0.6)] transition-transform duration-300",
          open ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ height: "min(92dvh, 880px)" }}
      >
        {/* Handle bar */}
        <div className="flex shrink-0 justify-center pb-1.5 pt-2.5">
          <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
        </div>

        {/* Header */}
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5 pb-3 pt-1">
          <div />
          <h2 className="text-center text-[15px] font-black text-white">
            {t("achievementsSheet.title")}
          </h2>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-9 justify-self-end place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <div className="h-px shrink-0 bg-white/[0.06]" />

        {/* Hero: progress bar */}
        <div className="shrink-0 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] font-black text-white">
              {t("achievementsSheet.hero", {
                earned: earnedCount,
                total: totalCount,
              })}
            </span>
            <span className="text-[11px] font-black tabular-nums text-white/52">
              {Math.round(progressPct)}%
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="gc-scrollbar shrink-0 overflow-x-auto border-b border-white/[0.06] px-5 pb-3">
          <div className="flex gap-1.5">
            {TAB_KEYS.map((key) => {
              const isActive = key === activeTab;
              return (
                <button
                  className={[
                    "gc-pressable shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.04em] transition-colors",
                    isActive
                      ? "bg-[var(--gc-brand)] text-black"
                      : "bg-white/[0.04] text-white/68",
                  ].join(" ")}
                  key={key}
                  onClick={() => setActiveTab(key)}
                  type="button"
                >
                  {t(`achievementsSheet.tabs.${key}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="gc-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {filteredByTab.length === 0 ? (
            <div className="grid place-items-center pb-12 pt-16 text-center">
              <p className="text-[14px] font-bold text-white/52">
                {t("achievementsSheet.empty")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {grouped.earned.length > 0 ? (
                <Section
                  achievements={grouped.earned}
                  onOpenDetail={onOpenAchievementDetail}
                  title={t("achievementsSheet.section.earned", {
                    count: grouped.earned.length,
                  })}
                />
              ) : null}

              {grouped.next.length > 0 ? (
                <Section
                  achievements={grouped.next}
                  onOpenDetail={onOpenAchievementDetail}
                  title={t("achievementsSheet.section.next", {
                    count: grouped.next.length,
                  })}
                />
              ) : null}

              {grouped.locked.length > 0 ? (
                <Section
                  achievements={grouped.locked}
                  onOpenDetail={onOpenAchievementDetail}
                  title={t("achievementsSheet.section.locked", {
                    count: grouped.locked.length,
                  })}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  achievements,
  onOpenDetail,
}: {
  title: string;
  achievements: Achievement[];
  onOpenDetail?: (achievement: Achievement) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.06em] text-white/44">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {achievements.map((achievement) => (
          <AchievementCard
            achievement={achievement}
            key={`${achievement.kind}-${achievement.id}`}
            onTap={
              onOpenDetail ? () => onOpenDetail(achievement) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Card visual de achievement. 4 estados:
 *   1. earned + public → ícone único colorido + label + description
 *   2. !earned + public → ícone dim + label + description + progress
 *   3. !earned + secret → cadeado misterioso + "???" + hint
 *   4. earned + secret → ícone único + label real (revealed)
 *
 * Tag dinâmico (button | div) baseado em onTap (gc-pressable cursor
 * só quando tappable — mesmo padrão da Sprint 7.5.2 BadgeCard).
 */
function AchievementCard({
  achievement,
  onTap,
}: {
  achievement: Achievement;
  onTap?: () => void;
}) {
  const { t } = useTranslation();
  const isMystery = Boolean(achievement.secret && !achievement.earned);
  const Tag = onTap ? "button" : "div";

  return (
    <Tag
      aria-label={
        isMystery
          ? t("achievementsSheet.secretMystery")
          : `${achievement.label} — ${achievement.description}`
      }
      className={[
        "flex w-full flex-col gap-2 rounded-[18px] p-3 text-left transition-colors",
        isMystery
          ? "bg-white/[0.03] text-white/36"
          : achievement.earned
            ? "bg-white/[0.05]"
            : "bg-white/[0.025] text-white/68",
        onTap ? "gc-pressable" : "",
      ].join(" ")}
      onClick={onTap}
      type={onTap ? "button" : undefined}
    >
      {isMystery ? (
        <span className="grid size-10 place-items-center rounded-[14px] bg-white/[0.06] text-white/40">
          <HelpCircle size={20} strokeWidth={2.4} />
        </span>
      ) : achievement.earned ? (
        <BadgeIcon
          className="size-10"
          earned
          iconKey={achievement.iconKey}
          size={22}
        />
      ) : (
        <span className="grid size-10 place-items-center rounded-[14px] bg-white/[0.04] text-white/40">
          <Lock size={18} strokeWidth={2.4} />
        </span>
      )}

      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          <p
            className={[
              "truncate text-[13px] font-black",
              achievement.earned ? "text-white" : "text-white/72",
            ].join(" ")}
          >
            {isMystery ? "???" : achievement.label}
          </p>
          <KindBadge kind={achievement.kind} />
        </div>
        <p className="line-clamp-2 text-[11px] font-bold leading-4 text-white/52">
          {isMystery
            ? t("achievementsSheet.secretHint")
            : achievement.description}
        </p>
      </div>

      {!isMystery && !achievement.earned && achievement.progress ? (
        <div className="mt-1">
          <div className="mb-1 flex items-baseline justify-between text-[10px] font-black text-white/42">
            <span>
              {t("achievementsSheet.progress", {
                current: achievement.progress.current,
                target: achievement.progress.target,
              })}
            </span>
            <span>
              {Math.min(
                100,
                Math.round(
                  (achievement.progress.current / achievement.progress.target) *
                    100,
                ),
              )}
              %
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[var(--gc-brand)]/72 transition-[width] duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (achievement.progress.current / achievement.progress.target) *
                      100,
                  ),
                )}%`,
              }}
            />
          </div>
        </div>
      ) : null}
    </Tag>
  );
}

/**
 * Chip pequeno discriminando a categoria pra reduzir ambiguidade entre
 * achievements similares (ex: "Streak 7" pode ser medal ou trophy).
 */
function KindBadge({ kind }: { kind: AchievementKind }) {
  const { t } = useTranslation();
  const tone = KIND_TONE[kind];
  return (
    <span
      className={[
        "shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-[0.04em]",
        tone,
      ].join(" ")}
    >
      {t(`achievementsSheet.tabs.${kind}`)}
    </span>
  );
}

const KIND_TONE: Record<AchievementKind, string> = {
  badge: "bg-white/[0.06] text-white/68",
  medal: "bg-[#FBBF24]/16 text-[#FBBF24]",
  trophy: "bg-[var(--gc-brand)]/16 text-[var(--gc-brand)]",
  relic: "bg-[#A78BFA]/16 text-[#A78BFA]",
  challenge: "bg-[#34D399]/16 text-[#34D399]",
};

export type { AchievementsSheetProps };
