"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import { AchievementArtifact3D } from "./design-system";
import {
  countEarnedAchievements,
  getAchievementCompositeId,
  getAllAchievements,
  getNextAchievement,
  suggestFeaturedAchievements,
  type Achievement,
  type AchievementKind,
} from "./social/achievements";
import {
  loadUserAchievementMeta,
  type UserAchievementMeta,
} from "./social/achievementsStats";
import type { MonthlyChallengeData } from "./social/monthlyChallenges";
import type { EnrichedPost, EnrichedUser } from "./social/types";

/**
 * AchievementsSheet (Hall da Fama) — Sprint 15.
 *
 * Redesign estilo "Prêmios" do Apple Fitness, com os artefatos 3D do
 * AchievementArtifact3D (port da release/codex) e os nomes/cores Gym Circle:
 *
 *   OVERVIEW (vista inicial):
 *     A. Header — título central + X; sub-linha "X de Y conquistadas".
 *     B. Hero "Próxima conquista" — a mais perto de sair (getNextAchievement)
 *        com artefato pequeno + barra de progresso.
 *     C. Destaque — a conquista earned mais rara (suggestFeatured[0]) GRANDE
 *        flutuando + strip de minis recentes + "Mostrar tudo".
 *     D. Grid 2-col de categorias (Badges/Medalhas/Troféus/Relíquias/
 *        Desafios) — cada card com o melhor artefato, último ganho com data
 *        e "+N Mostrar tudo".
 *
 *   CATEGORIA (tap num card — troca de conteúdo no MESMO sheet, sem overlay
 *   novo): back ← + título + descrição + grid 3-col com TODAS (earned
 *   coloridas, locked acinzentadas, secrets como "???" por último).
 *
 * Datas/contagens vêm de user_achievements (loadUserAchievementMeta, RLS
 * public_read) — fetch fire-and-forget; sem dados a UI degrada pra "X de Y".
 *
 * Privacy: abre só pelo MyCircleSheet que já checa canSeeDetails.
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
  /**
   * Sprint 15 — desafios do mês (só quando o hall é do PRÓPRIO user, igual
   * regra do MyCircleSheet). Sem isso a categoria Desafios mostra empty.
   */
  monthlyChallenges?: ReadonlyArray<MonthlyChallengeData>;
};

type SheetView = "overview" | "all" | AchievementKind;

const CATEGORY_ORDER: ReadonlyArray<AchievementKind> = [
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
  monthlyChallenges,
}: AchievementsSheetProps) {
  const { t, i18n } = useTranslation();
  const services = useGymCircleServices();
  const [view, setView] = useState<SheetView>("overview");
  const [earnedMeta, setEarnedMeta] = useState<Map<string, UserAchievementMeta> | null>(
    null,
  );

  // Reset pra overview + fetch das datas/contagens ao abrir. setTimeout evita
  // o lint set-state-in-effect (mesmo padrão do EditPostSheet); o fetch é
  // fire-and-forget — UI degrada pra "X de Y" enquanto não chega.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    const id = window.setTimeout(() => setView("overview"), 0);
    void loadUserAchievementMeta(services.client, user.id).then((meta) => {
      if (!cancelled) setEarnedMeta(meta);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [open, user, services.client]);

  const achievements = useMemo<Achievement[]>(() => {
    if (!user) return [];
    return getAllAchievements({
      user,
      postsCount: posts.length,
      hasUsedStreakRestore: Boolean(user.lastStreakRestoreUsedAt),
      posts: posts.map((post) => ({
        createdAt: post.createdAt,
        workoutType: post.workoutType ?? null,
        workoutTypes: post.workoutTypes ?? null,
        gymId: post.gymId,
      })),
      monthlyChallenges,
    });
  }, [user, posts, monthlyChallenges]);

  const earnedCount = countEarnedAchievements(achievements);
  const totalCount = achievements.length;

  const metaFor = (achievement: Achievement): UserAchievementMeta | undefined =>
    earnedMeta?.get(getAchievementCompositeId(achievement));

  const formatDate = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat(i18n.language, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(iso));
    } catch {
      return null;
    }
  };

  /** Earned ordenadas por recência (lastEarnedAt desc; sem meta vão pro fim na ordem estável). */
  const sortEarnedByRecency = (list: Achievement[]): Achievement[] =>
    [...list].sort((a, b) => {
      const ta = metaFor(a)?.lastEarnedAt ?? "";
      const tb = metaFor(b)?.lastEarnedAt ?? "";
      return tb.localeCompare(ta);
    });

  const nextAchievement = useMemo(
    () => getNextAchievement(achievements),
    [achievements],
  );
  const featured = useMemo(
    () => suggestFeaturedAchievements(achievements, 7),
    [achievements],
  );

  if (!open) return null;

  const inCategory = view !== "overview";
  const categoryItems =
    view === "overview"
      ? []
      : view === "all"
        ? achievements
        : achievements.filter((a) => a.kind === view);

  // Ordenação Apple-like da vista de categoria: earned (recentes primeiro) →
  // em progresso (% desc) → locked → secrets misteriosos por último.
  const orderedCategoryItems = inCategory
    ? [
        ...sortEarnedByRecency(categoryItems.filter((a) => a.earned)),
        ...categoryItems
          .filter((a) => !a.earned && !a.secret && a.progress)
          .sort((a, b) => {
            const pa = a.progress ? a.progress.current / a.progress.target : 0;
            const pb = b.progress ? b.progress.current / b.progress.target : 0;
            return pb - pa;
          }),
        ...categoryItems.filter((a) => !a.earned && !a.secret && !a.progress),
        ...categoryItems.filter((a) => !a.earned && a.secret),
      ]
    : [];

  function openDetail(achievement: Achievement) {
    onOpenAchievementDetail?.(achievement);
  }

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

        {/* Header — back na vista de categoria, X sempre fecha o sheet */}
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5 pb-3 pt-1">
          {inCategory ? (
            <button
              aria-label={t("common.back")}
              className="gc-pressable grid size-9 place-items-center rounded-full bg-white/[0.06] text-white"
              onClick={() => setView("overview")}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div />
          )}
          <h2 className="text-center text-[15px] font-black text-white">
            {inCategory
              ? t(`achievementsSheet.tabs.${view}`)
              : t("achievementsSheet.title")}
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

        {/* Body */}
        <div className="gc-scrollbar flex-1 overflow-y-auto px-5 py-4">
          {achievements.length === 0 ? (
            <div className="grid place-items-center pb-12 pt-16 text-center">
              <p className="text-[14px] font-bold text-white/52">
                {t("achievementsSheet.empty")}
              </p>
            </div>
          ) : inCategory ? (
            <CategoryView
              description={
                view === "all" ? null : t(`achievementsSheet.categoryDescription.${view}`)
              }
              earnedLabel={t("achievementsSheet.categoryCount", {
                earned: orderedCategoryItems.filter((a) => a.earned).length,
                total: orderedCategoryItems.length,
              })}
              emptyLabel={t("achievementsSheet.empty")}
              formatDate={formatDate}
              items={orderedCategoryItems}
              metaFor={metaFor}
              onOpenDetail={openDetail}
              progressLabel={(current, target) =>
                t("achievementsSheet.progressOf", { current, target })
              }
              title={t(`achievementsSheet.tabs.${view}`)}
            />
          ) : (
            <div className="flex flex-col gap-5 pb-4">
              {/* Sub-linha global */}
              <p className="text-[12px] font-bold text-white/46">
                {t("achievementsSheet.hero", {
                  earned: earnedCount,
                  total: totalCount,
                })}
              </p>

              {/* B. Hero — próxima conquista em progresso */}
              {nextAchievement ? (
                <button
                  className="gc-pressable flex w-full items-center gap-3 rounded-[20px] bg-white/[0.05] p-3 text-left"
                  onClick={() => openDetail(nextAchievement)}
                  type="button"
                >
                  <AchievementArtifact3D achievement={nextAchievement} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-black uppercase tracking-[0.08em] text-white/42">
                      {t("achievementsSheet.nextUp")}
                    </p>
                    <p className="mt-0.5 truncate text-[14px] font-black text-white">
                      {nextAchievement.secret && !nextAchievement.earned
                        ? "???"
                        : nextAchievement.label}
                    </p>
                    {nextAchievement.progress ? (
                      <>
                        <p className="mt-0.5 text-[11px] font-bold text-white/52">
                          {t("achievementsSheet.progressOf", {
                            current: nextAchievement.progress.current,
                            target: nextAchievement.progress.target,
                          })}
                        </p>
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                          <div
                            className="h-full rounded-full bg-[var(--gc-brand)] transition-[width] duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  (nextAchievement.progress.current /
                                    nextAchievement.progress.target) *
                                    100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                  <ChevronRight className="shrink-0 text-white/28" size={16} />
                </button>
              ) : null}

              {/* C. Destaque — earned mais rara, grande e flutuando */}
              {featured.length > 0 ? (
                <div className="rounded-[24px] bg-white/[0.04] px-4 pb-4 pt-6">
                  <p className="text-center text-[10.5px] font-black uppercase tracking-[0.08em] text-white/42">
                    {t("achievementsSheet.featuredTitle")}
                  </p>
                  <button
                    className="gc-pressable mx-auto mt-3 flex w-full flex-col items-center gap-3"
                    onClick={() => openDetail(featured[0])}
                    type="button"
                  >
                    <AchievementArtifact3D achievement={featured[0]} float size="lg" />
                    <div className="text-center">
                      <p className="text-[17px] font-black text-white">
                        {featured[0].label}
                      </p>
                      <FeaturedSubline
                        formatDate={formatDate}
                        meta={metaFor(featured[0])}
                        t={t}
                      />
                    </div>
                  </button>
                  {featured.length > 1 ? (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        {sortEarnedByRecency(featured.slice(1)).slice(0, 3).map(
                          (item) => (
                            <button
                              className="gc-pressable"
                              key={`${item.kind}-${item.id}`}
                              onClick={() => openDetail(item)}
                              type="button"
                            >
                              <AchievementArtifact3D
                                achievement={item}
                                glow={false}
                                size="sm"
                              />
                            </button>
                          ),
                        )}
                      </div>
                      <button
                        className="gc-pressable shrink-0 text-right text-[12px] font-black text-[var(--gc-brand)]"
                        onClick={() => setView("all")}
                        type="button"
                      >
                        {earnedCount > 4 ? `+${earnedCount - 4} · ` : ""}
                        {t("achievementsSheet.showAll")}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="gc-pressable mt-3 w-full text-center text-[12px] font-black text-[var(--gc-brand)]"
                      onClick={() => setView("all")}
                      type="button"
                    >
                      {t("achievementsSheet.showAll")}
                    </button>
                  )}
                </div>
              ) : null}

              {/* D. Grid 2-col de categorias */}
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORY_ORDER.map((kind) => {
                  const items = achievements.filter((a) => a.kind === kind);
                  const earnedInKind = sortEarnedByRecency(
                    items.filter((a) => a.earned),
                  );
                  const heroItem = earnedInKind[0] ?? items[0] ?? null;
                  const latest = earnedInKind[0] ?? null;
                  const latestDate = latest
                    ? formatDate(metaFor(latest)?.lastEarnedAt ?? null)
                    : null;
                  return (
                    <button
                      className="gc-pressable flex flex-col items-center gap-2 rounded-[20px] bg-white/[0.04] px-3 pb-3 pt-4 text-center"
                      key={kind}
                      onClick={() => setView(kind)}
                      type="button"
                    >
                      <p className="w-full text-left text-[13px] font-black text-white">
                        {t(`achievementsSheet.tabs.${kind}`)}
                      </p>
                      {heroItem ? (
                        <AchievementArtifact3D
                          achievement={heroItem}
                          glow={false}
                          muted={!heroItem.earned}
                          size="md"
                        />
                      ) : (
                        <span className="grid size-20 place-items-center text-[12px] font-bold text-white/30">
                          —
                        </span>
                      )}
                      <div className="min-h-[30px]">
                        {latest ? (
                          <>
                            <p className="line-clamp-1 text-[10.5px] font-bold text-white/72">
                              {latest.secret && !latest.earned ? "???" : latest.label}
                            </p>
                            {latestDate ? (
                              <p className="text-[10px] font-bold text-white/40">
                                {latestDate}
                              </p>
                            ) : null}
                          </>
                        ) : items.length === 0 ? (
                          <p className="line-clamp-2 text-[10px] font-bold text-white/36">
                            {t("achievementsSheet.empty")}
                          </p>
                        ) : (
                          <p className="text-[10.5px] font-bold text-white/46">
                            {t("achievementsSheet.categoryCount", {
                              earned: earnedInKind.length,
                              total: items.length,
                            })}
                          </p>
                        )}
                      </div>
                      {earnedInKind.length > 1 ? (
                        <div className="flex items-center gap-1">
                          {earnedInKind.slice(1, 4).map((item) => (
                            <AchievementArtifact3D
                              achievement={item}
                              glow={false}
                              key={`${item.kind}-${item.id}`}
                              size="sm"
                            />
                          ))}
                        </div>
                      ) : null}
                      <span className="text-[11px] font-black text-[var(--gc-brand)]">
                        {items.length > 0
                          ? `+${items.length} · ${t("achievementsSheet.showAll")}`
                          : t("achievementsSheet.showAll")}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturedSubline({
  meta,
  formatDate,
  t,
}: {
  meta: UserAchievementMeta | undefined;
  formatDate: (iso: string | null | undefined) => string | null;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  if (!meta) return null;
  if (meta.count > 1) {
    return (
      <p className="mt-0.5 text-[11.5px] font-bold text-white/52">
        {t("achievementsSheet.timesEarned", { count: meta.count })}
      </p>
    );
  }
  const date = formatDate(meta.earnedAt);
  if (!date) return null;
  return <p className="mt-0.5 text-[11.5px] font-bold text-white/52">{date}</p>;
}

/**
 * Vista de categoria — grid 3-col estilo Apple Fitness: tudo junto, earned
 * coloridas no topo (recentes primeiro), locked acinzentadas, secrets "???"
 * por último.
 */
function CategoryView({
  title,
  description,
  earnedLabel,
  emptyLabel,
  items,
  metaFor,
  formatDate,
  progressLabel,
  onOpenDetail,
}: {
  title: string;
  description: string | null;
  earnedLabel: string;
  emptyLabel: string;
  items: Achievement[];
  metaFor: (a: Achievement) => UserAchievementMeta | undefined;
  formatDate: (iso: string | null | undefined) => string | null;
  progressLabel: (current: number, target: number) => string;
  onOpenDetail: (a: Achievement) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="grid place-items-center pb-12 pt-16 text-center">
        <p className="text-[14px] font-bold text-white/52">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="pb-4">
      <h3 className="text-[22px] font-black text-white">{title}</h3>
      {description ? (
        <p className="mt-1 text-[12.5px] font-bold leading-5 text-white/52">
          {description}
        </p>
      ) : null}
      <p className="mt-1 text-[11px] font-black text-white/40">{earnedLabel}</p>

      <div className="mt-5 grid grid-cols-3 gap-x-2 gap-y-5">
        {items.map((achievement) => {
          const isMystery = Boolean(achievement.secret && !achievement.earned);
          const meta = metaFor(achievement);
          const subline = achievement.earned
            ? formatDate(meta?.lastEarnedAt ?? meta?.earnedAt)
            : !isMystery && achievement.progress
              ? progressLabel(
                  achievement.progress.current,
                  achievement.progress.target,
                )
              : null;
          return (
            <button
              className="gc-pressable flex flex-col items-center gap-1.5 text-center"
              key={`${achievement.kind}-${achievement.id}`}
              onClick={() => onOpenDetail(achievement)}
              type="button"
            >
              <AchievementArtifact3D
                achievement={achievement}
                glow={false}
                size="md"
              />
              <p
                className={[
                  "line-clamp-2 w-full text-[10px] font-black leading-[13px]",
                  achievement.earned ? "text-white" : "text-white/56",
                ].join(" ")}
              >
                {isMystery ? "???" : achievement.label}
              </p>
              {subline ? (
                <p className="text-[9.5px] font-bold text-white/40">{subline}</p>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export type { AchievementsSheetProps };
