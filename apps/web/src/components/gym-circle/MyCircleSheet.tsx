"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AchievementArtifact3D,
  AvatarConsistencyRings,
  StreakBadge,
} from "./design-system";
import { simulateHaptic } from "./social/haptics";
import {
  countEarnedAchievements,
  equippedAchievementStorageKey,
  getAchievementsV2,
  getFeaturedAchievementsWithEquipped,
  type AchievementRarityStats,
  type AchievementCategory,
  type AchievementV2,
} from "./social/gamification";
import {
  buildMonthWorkoutDays,
  formatDateKey,
  getAllStreakLevels,
  getConsistencyProgress,
  getStreakLevel,
  getTotalDaysInMonth,
  getTotalDaysInYear,
} from "./social/streak";
import type { EnrichedPost, EnrichedUser } from "./social/types";

/**
 * MyCircleSheet — Sprint 3.5.3.
 *
 * Tela de gamificação rica do Gym Circle. Aberta via tap nos rings do
 * `AvatarConsistencyRings` no `ProfileIdentity` (header do perfil).
 *
 * Estrutura (top → bottom):
 *
 *   A. Header — avatar+rings menor + nome + username + chip nível + chip streak.
 *   B. Resumo — grid 2x3 com counts (streak, maior streak, treinos mês,
 *      dias ano, posts, recuperações de streak).
 *   C. Explicação dos rings — semana/mês/ano em texto + mini-progress bar.
 *   D. Calendário mensal — dias treinados em ciano, dias sem treino em
 *      cinza, hoje em destaque, navegação ← / →.
 *   E. Níveis — Iniciante / Consistente / Elite / Lendário com nível atual
 *      destacado e progresso até o próximo.
 *   F. Badges — derivados de dados reais (sem inventar). Bloqueados em
 *      cinza com cadeado.
 *   G. Competição (placeholder) — "Em breve".
 *
 * Privacidade:
 * - Próprio perfil: tudo visível.
 * - Outro user privado + não follow: mostra só A+C (resumo público).
 *
 * Performance:
 * - Sheet só renderiza quando `open === true` (dynamic import lazy).
 * - Tudo é derivado client-side de dados já hidratados — zero rede.
 * - 3.5.4 vai trazer GamificationService com cache + `user_activity_days`
 *   pra calendário mais preciso.
 */

type MyCircleSheetProps = {
  open: boolean;
  user: EnrichedUser | null;
  posts: EnrichedPost[];
  isOwn: boolean;
  hasStory?: boolean;
  storyViewed?: boolean;
  rarityStats?: Record<string, AchievementRarityStats>;
  onClose: () => void;
  onOpenStory?: () => void;
};

const ACHIEVEMENT_SECTIONS: Array<{
  label: string;
  category: AchievementCategory | "secret";
}> = [
  { label: "Badges", category: "badge" },
  { label: "Medalhas", category: "medal" },
  { label: "Troféus", category: "trophy" },
  { label: "Relíquias", category: "relic" },
  { label: "Desafios", category: "challenge" },
  { label: "Secretos", category: "secret" },
];

export function MyCircleSheet({
  open,
  user,
  posts,
  isOwn,
  hasStory = false,
  storyViewed = false,
  rarityStats,
  onClose,
}: MyCircleSheetProps) {
  const { t, i18n } = useTranslation();
  // Mês exibido no calendário (default = mês atual). Navegação ← / →.
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementV2 | null>(null);
  const [equippedAchievementIds, setEquippedAchievementIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setCalendarMonth({
        year: today.getFullYear(),
        month: today.getMonth(),
      });
    }
  }, [open, today]);

  useEffect(() => {
    if (!open || !user?.id) return;
    try {
      const raw = window.localStorage.getItem(equippedAchievementStorageKey(user.id));
      const parsed = raw ? JSON.parse(raw) : [];
      setEquippedAchievementIds(Array.isArray(parsed) ? parsed.slice(0, 3) : []);
    } catch {
      setEquippedAchievementIds([]);
    }
  }, [open, user?.id]);

  if (!open || !user) return null;
  const userId = user.id;

  const canSeeDetails =
    isOwn || !user.isPrivate || user.followStatus === "accepted";

  const consistencyInput = {
    workoutsThisWeek: user.workoutsThisWeek ?? 0,
    workoutsThisMonth: user.workoutsThisMonth ?? 0,
    workoutsThisYear: user.activeDaysCount ?? 0,
  };
  const progress = getConsistencyProgress(consistencyInput);

  const level = getStreakLevel(user.currentStreak);
  const allLevels = getAllStreakLevels();
  const achievements = getAchievementsV2({
    user,
    posts,
    postsCount: posts.length,
    hasUsedStreakRestore: Boolean(user.lastStreakRestoreUsedAt),
    now: today,
    rarityStats,
  });
  const earnedCount = countEarnedAchievements(achievements);
  const featuredAchievements = getFeaturedAchievementsWithEquipped(
    achievements,
    equippedAchievementIds,
    3,
  );
  const nextAchievement = achievements.find((achievement) => !achievement.earned) ?? null;

  const calendarDate = new Date(calendarMonth.year, calendarMonth.month, 1);
  const totalDaysInCalendarMonth = getTotalDaysInMonth(calendarDate);
  const monthDays = buildMonthWorkoutDays(
    user.workoutDays ?? [],
    formatDateKey(calendarDate),
  );

  // Cabeçalho do calendário: posição do primeiro dia da semana
  const firstDayOfWeek = new Date(
    calendarMonth.year,
    calendarMonth.month,
    1,
  ).getDay(); // 0=dom, 1=seg, ..., 6=sáb
  const leadingBlanks = (firstDayOfWeek + 6) % 7; // converte pra base segunda (0=seg, 6=dom)

  function handleClose() {
    setSelectedAchievement(null);
    onClose();
  }

  function toggleEquippedAchievement(achievement: AchievementV2) {
    if (!achievement.earned) return;
    simulateHaptic("brand");
    setEquippedAchievementIds((current) => {
      const isEquipped = current.includes(achievement.id);
      const next = isEquipped
        ? current.filter((id) => id !== achievement.id)
        : [achievement.id, ...current.filter((id) => id !== achievement.id)].slice(0, 3);
      try {
        window.localStorage.setItem(
          equippedAchievementStorageKey(userId),
          JSON.stringify(next),
        );
      } catch {
        // Preferimos manter a UI responsiva mesmo se o storage do WebView falhar.
      }
      return next;
    });
  }

  function goPrevMonth() {
    simulateHaptic("brand"); // "selection"
    setCalendarMonth((prev) => {
      const m = prev.month - 1;
      return m < 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: m };
    });
  }

  function goNextMonth() {
    simulateHaptic("brand");
    setCalendarMonth((prev) => {
      const m = prev.month + 1;
      return m > 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: m };
    });
  }

  // Sprint 4.4 i18n: Intl.DateTimeFormat usa o locale do i18next pra
  // renderizar nomes de mês em PT-BR ("maio") ou EN ("May").
  const monthLabel = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
  }).format(calendarDate);

  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-[68] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
    >
      <button
        aria-label={t("myCircle.closeLabel")}
        className="absolute inset-0 bg-black/68 backdrop-blur-xl"
        onClick={handleClose}
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
        {/* Handle bar visual */}
        <div className="flex shrink-0 justify-center pb-1.5 pt-2.5">
          <div className="h-1 w-9 rounded-full bg-white/[0.18]" />
        </div>

        {/* Header com X */}
        <header className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-5 pb-3 pt-1">
          <div />
          <h2 className="text-center text-[15px] font-black text-white">
            {isOwn
              ? t("myCircle.title")
              : t("myCircle.titleOther", {
                  name: user.name.split(" ")[0] ?? user.username,
                })}
          </h2>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-9 justify-self-end place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={handleClose}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <div className="h-px shrink-0 bg-white/[0.06]" />

        {/* Conteúdo scrollável */}
        <div className="gc-scrollbar flex-1 overflow-y-auto px-5 pb-8 pt-6">
          {/* A. Header com rings + identidade */}
          <section className="flex flex-col items-center text-center">
            <AvatarConsistencyRings
              hasStory={hasStory}
              size={130}
              storyViewed={storyViewed}
              user={user}
            />
            <div className="mt-3 flex items-center gap-2">
              <h3 className="text-[20px] font-black leading-tight">{user.name}</h3>
              {user.isPrivate ? (
                <Lock
                  aria-label={t("profile.private")}
                  className="shrink-0 text-white/52"
                  size={14}
                  strokeWidth={2.6}
                />
              ) : null}
            </div>
            <p className="text-[13px] font-bold text-white/52">@{user.username}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              <StreakBadge
                best={user.longestStreak}
                isLit={user.streakLitToday}
                showLevel
                size="sm"
                streak={user.currentStreak}
              />
            </div>
          </section>

          {!canSeeDetails ? (
            <section className="mt-8 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 text-center">
              <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
                <Lock size={20} strokeWidth={2.4} />
              </div>
              <p className="text-[15px] font-black text-white">
                {t("profile.privateNotice.title")}
              </p>
              <p className="mt-2 text-[12px] font-bold text-white/56">
                {t("profile.privateNotice.body")}
              </p>
            </section>
          ) : (
            <>
              {/* B. Resumo principal — grid 2x3 */}
              <section className="mt-8 grid grid-cols-2 gap-2">
                <SummaryCard label={t("myCircle.currentStreak")} value={`${user.currentStreak}d`} />
                <SummaryCard label={t("myCircle.longestStreak")} value={`${user.longestStreak}d`} />
                <SummaryCard label={t("myCircle.monthWorkouts")} value={user.workoutsThisMonth.toLocaleString()} />
                <SummaryCard label={t("myCircle.yearDays")} value={user.activeDaysCount.toLocaleString()} />
                <SummaryCard label={t("myCircle.posts")} value={posts.length.toLocaleString()} />
                <SummaryCard
                  label={t("myCircle.restores")}
                  value={(user.streakRestoresAvailable ?? 0).toLocaleString()}
                />
              </section>

              {/* C. Explicação dos rings */}
              <section className="mt-8">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                  {t("myCircle.consistency.title")}
                </h4>
                <div className="space-y-3 rounded-[20px] bg-white/[0.035] p-4">
                  <RingProgressRow
                    color="var(--gc-consistency-week, var(--gc-consistency-daily))"
                    label={t("myCircle.consistency.week")}
                    progressPct={progress.week}
                    value={t("myCircle.consistency.unit", {
                      trained: consistencyInput.workoutsThisWeek,
                      total: 7,
                    })}
                  />
                  <RingProgressRow
                    color="var(--gc-consistency-month)"
                    label={t("myCircle.consistency.month")}
                    progressPct={progress.month}
                    value={t("myCircle.consistency.unit", {
                      trained: consistencyInput.workoutsThisMonth,
                      total: getTotalDaysInMonth(today),
                    })}
                  />
                  <RingProgressRow
                    color="var(--gc-consistency-year)"
                    label={t("myCircle.consistency.year")}
                    progressPct={progress.year}
                    value={t("myCircle.consistency.unit", {
                      trained: consistencyInput.workoutsThisYear,
                      total: getTotalDaysInYear(today),
                    })}
                  />
                </div>
              </section>

              {/* D. Calendário mensal */}
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                    {t("myCircle.calendar.title")}
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={t("myCircle.calendar.previousMonth")}
                      className="gc-pressable grid size-9 place-items-center rounded-full bg-white/[0.06] text-white/72"
                      onClick={goPrevMonth}
                      type="button"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="min-w-[110px] text-center text-[13px] font-black capitalize text-white">
                      {monthLabel}
                    </span>
                    <button
                      aria-label={t("myCircle.calendar.nextMonth")}
                      className="gc-pressable grid size-9 place-items-center rounded-full bg-white/[0.06] text-white/72"
                      onClick={goNextMonth}
                      type="button"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="rounded-[20px] bg-white/[0.035] p-3">
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-[0.06em] text-white/36">
                    <span>S</span>
                    <span>T</span>
                    <span>Q</span>
                    <span>Q</span>
                    <span>S</span>
                    <span>S</span>
                    <span>D</span>
                  </div>
                  <div className="mt-2 grid grid-cols-7 gap-1">
                    {Array.from({ length: leadingBlanks }).map((_, i) => (
                      <div key={`blank-${i}`} />
                    ))}
                    {Array.from({ length: totalDaysInCalendarMonth }).map((_, idx) => {
                      const dayInfo = monthDays[idx];
                      const day = idx + 1;
                      const isToday = dayInfo?.dateKey === todayKey;
                      const trained = Boolean(dayInfo?.trained);
                      return (
                        <div
                          aria-label={
                            trained
                              ? t("myCircle.calendar.trained", { day })
                              : t("myCircle.calendar.notTrained", { day })
                          }
                          className={[
                            "relative grid aspect-square place-items-center rounded-[10px] text-[11px] font-black transition-colors",
                            trained
                              ? "bg-[var(--gc-consistency-month)]/22 text-[var(--gc-consistency-month)]"
                              : "bg-white/[0.04] text-white/36",
                            isToday
                              ? "ring-2 ring-[var(--gc-brand)]/72 ring-offset-2 ring-offset-[#101214]"
                              : "",
                          ].join(" ")}
                          key={`day-${day}`}
                        >
                          {day}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>

              {/* E. Níveis */}
              <section className="mt-8">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                  {t("myCircle.levels.title")}
                </h4>
                <div className="space-y-2 rounded-[20px] bg-white/[0.035] p-3">
                  {allLevels.map((lv) => {
                    const isCurrent = lv.id === level.id;
                    const isPast = user.currentStreak >= lv.minDays;
                    return (
                      <div
                        className={[
                          "flex items-center justify-between rounded-[14px] px-3 py-2.5 transition-colors",
                          isCurrent
                            ? "bg-[var(--gc-brand)]/12 text-white ring-1 ring-[var(--gc-brand)]/32"
                            : isPast
                              ? "bg-white/[0.05] text-white/82"
                              : "bg-white/[0.025] text-white/42",
                        ].join(" ")}
                        key={lv.id}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={[
                              "inline-block size-2 shrink-0 rounded-full",
                              isCurrent
                                ? "bg-[var(--gc-brand)]"
                                : isPast
                                  ? "bg-white/72"
                                  : "bg-white/24",
                            ].join(" ")}
                          />
                          <span className="text-[14px] font-black">
                            {t(`myCircle.levels.names.${lv.id}`)}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold opacity-72">
                          {lv.nextLevelAt
                            ? t("myCircle.levels.range", {
                                min: lv.minDays,
                                max: lv.nextLevelAt - 1,
                              })
                            : t("myCircle.levels.rangeOpen", { min: lv.minDays })}
                          {isCurrent ? ` · ${t("myCircle.levels.youAreHere")}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* F. Conquistas em destaque */}
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                    Conquistas em destaque
                  </h4>
                  <span className="text-[11px] font-black text-white/52">
                    {earnedCount}/{achievements.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-[22px] bg-white/[0.035] p-3">
                  {(featuredAchievements.length ? featuredAchievements : achievements.slice(0, 3)).map(
                    (achievement) => (
                      <AchievementTile
                        achievement={achievement}
                        key={achievement.id}
                        onSelect={() => {
                          simulateHaptic("brand");
                          setSelectedAchievement(achievement);
                        }}
                      />
                    ),
                  )}
                </div>
                {nextAchievement ? (
                  <p className="mt-3 text-center text-[11px] font-bold text-white/52">
                    Falta pouco para {nextAchievement.label} — {nextAchievement.lockedDescription.toLowerCase()}
                  </p>
                ) : null}
              </section>

              {/* G. Hall da Fama */}
              <section className="mt-8">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                  Hall da Fama
                </h4>
                <div className="space-y-5">
                  {ACHIEVEMENT_SECTIONS.map((section) => {
                    const items = achievements.filter((achievement) =>
                      section.category === "secret"
                        ? achievement.isSecret
                        : achievement.category === section.category && !achievement.isSecret,
                    );
                    if (items.length === 0) return null;
                    const earnedInSection = items.filter((item) => item.earned).length;
                    return (
                      <div key={section.label}>
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-[12px] font-black text-white">
                            {section.label}
                          </p>
                          <p className="text-[11px] font-black text-white/40">
                            {earnedInSection}/{items.length}
                          </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {items.map((achievement) => (
                            <AchievementTile
                              achievement={achievement}
                              key={achievement.id}
                              onSelect={() => {
                                simulateHaptic(achievement.earned ? "success" : "brand");
                                setSelectedAchievement(achievement);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {selectedAchievement ? (
        <AchievementDetailModal
          achievement={selectedAchievement}
          canEquip={isOwn && selectedAchievement.earned}
          isEquipped={equippedAchievementIds.includes(selectedAchievement.id)}
          onClose={() => setSelectedAchievement(null)}
          onToggleEquip={() => toggleEquippedAchievement(selectedAchievement)}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white/[0.04] px-3 py-3 text-left">
      <p className="text-[22px] font-black leading-none text-white">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.04em] text-white/52">
        {label}
      </p>
    </div>
  );
}

function RingProgressRow({
  color,
  label,
  progressPct,
  value,
}: {
  color: string;
  label: string;
  progressPct: number;
  value: string;
}) {
  const pct = Math.max(0, Math.min(100, progressPct));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-black text-white">{label}</span>
        <span className="text-[12px] font-bold text-white/72">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ background: color, width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AchievementTile({
  achievement,
  onSelect,
}: {
  achievement: AchievementV2;
  onSelect: () => void;
}) {
  return (
    <button
      aria-label={`${achievement.label} — ${achievement.earned ? "conquistada" : "bloqueada"}`}
      className={[
        "gc-pressable flex min-h-[124px] flex-col items-center justify-center gap-2 rounded-[16px] border p-2 text-center transition-colors",
        achievement.earned
          ? "border-white/[0.08] bg-white/[0.055]"
          : "border-white/[0.045] bg-white/[0.025]",
      ].join(" ")}
      onClick={onSelect}
      title={achievement.earned ? achievement.description : achievement.lockedDescription}
      type="button"
    >
      <AchievementArtifact3D achievement={achievement} size="sm" />
      <span
        className={[
          "line-clamp-2 text-[10px] font-black leading-[1.12]",
          achievement.earned ? "text-white/88" : "text-white/34",
        ].join(" ")}
      >
        {achievement.isSecret && !achievement.earned ? "Conquista secreta" : achievement.label}
      </span>
    </button>
  );
}

function AchievementDetailModal({
  achievement,
  canEquip,
  isEquipped,
  onClose,
  onToggleEquip,
}: {
  achievement: AchievementV2;
  canEquip: boolean;
  isEquipped: boolean;
  onClose: () => void;
  onToggleEquip: () => void;
}) {
  const progress = achievement.progress;
  const progressPct = progress
    ? Math.max(0, Math.min(100, (progress.current / progress.target) * 100))
    : null;
  const earnedTimes = achievement.timesEarned ?? (achievement.earned ? 1 : 0);
  const earnedAt = formatAchievementDate(achievement.earnedAt);
  const lastEarnedAt = formatAchievementDate(achievement.lastEarnedAt);
  const periodStart = formatAchievementDate(achievement.periodStart);
  const periodEnd = formatAchievementDate(achievement.periodEnd);
  const showChallengeDetails = achievement.category === "challenge";

  return (
    <div className="gc-achievement-detail-modal absolute inset-0 z-[90] bg-black/88 backdrop-blur-2xl">
      <div className="relative flex h-full flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(140,251,255,0.18),rgba(0,0,0,0)_42%)]" />
        <div className="pointer-events-none absolute inset-x-10 top-[18%] h-56 rounded-full bg-[var(--gc-brand)]/10 blur-[80px]" />
        <header className="relative z-10 flex shrink-0 items-center justify-between px-5 pb-3 pt-[calc(var(--gc-safe-top)+12px)]">
          <button
            aria-label="Voltar"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.07] text-white"
            onClick={onClose}
            type="button"
          >
            <ChevronLeft size={22} strokeWidth={2.8} />
          </button>
          <p className="text-[13px] font-black uppercase tracking-[0.08em] text-white/42">
            {categoryLabel(achievement.category)}
          </p>
          <button
            aria-label="Compartilhar em breve"
            className="grid size-11 place-items-center rounded-full bg-white/[0.04] text-white/28"
            disabled
            type="button"
          >
            <span className="text-[15px] font-black">↗</span>
          </button>
        </header>

        <div className="relative z-10 flex flex-1 flex-col items-center overflow-y-auto px-6 pb-[calc(var(--gc-safe-bottom)+28px)] pt-8 text-center">
          <div className="gc-achievement-artifact-float">
            <AchievementArtifact3D achievement={achievement} size="lg" />
          </div>
          <div className="mt-9 max-w-[360px]">
            <h3 className="text-[28px] font-black leading-tight text-white">
              {achievement.isSecret && !achievement.earned
                ? "Conquista secreta"
                : achievement.label}
            </h3>
            <p className="mt-3 text-[14px] font-semibold leading-5 text-white/58">
              {achievement.earned
                ? achievement.description
                : achievement.lockedDescription}
            </p>
          </div>

          {canEquip ? (
            <button
              className={[
                "gc-pressable mt-5 h-11 rounded-full px-5 text-[13px] font-black transition-colors",
                isEquipped
                  ? "border border-[var(--gc-brand)]/28 bg-[var(--gc-brand)]/[0.09] text-[var(--gc-brand)]"
                  : "bg-white text-black",
              ].join(" ")}
              onClick={onToggleEquip}
              type="button"
            >
              {isEquipped ? "Remover destaque" : "Equipar no perfil"}
            </button>
          ) : null}

          {progress ? (
            <div className="mt-7 w-full max-w-[360px] rounded-[22px] border border-white/[0.07] bg-white/[0.045] p-4 text-left">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-black uppercase tracking-[0.06em] text-white/40">
                  Progresso
                </p>
                <p className="text-[13px] font-black text-white">
                  {progress.current}/{progress.target} {progress.unit}
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          ) : null}

          <div className="mt-3 grid w-full max-w-[360px] grid-cols-2 gap-2 text-left">
            <DetailStat label="Status" value={achievement.earned ? "Conquistada" : "Bloqueada"} />
            <DetailStat
              label="Raridade"
              value={rarityStatLabel(achievement) ?? rarityLabel(achievement.rarity)}
            />
            <DetailStat label="Total" value={formatTimesEarned(earnedTimes)} />
            <DetailStat label="Tipo" value={categoryLabel(achievement.category)} />
            {earnedAt ? <DetailStat label="Conquistado" value={earnedAt} /> : null}
            {lastEarnedAt && lastEarnedAt !== earnedAt ? (
              <DetailStat label="Última conquista" value={lastEarnedAt} />
            ) : null}
          </div>

          {!achievement.earned ? (
            <div className="mt-3 w-full max-w-[360px] rounded-[20px] border border-white/[0.07] bg-white/[0.04] p-4 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-white/36">
                Como desbloquear
              </p>
              <p className="mt-1 text-[14px] font-black leading-5 text-white">
                {achievement.lockedDescription}
              </p>
            </div>
          ) : null}

          {showChallengeDetails ? (
            <div className="mt-3 w-full max-w-[360px] rounded-[20px] border border-white/[0.07] bg-white/[0.04] p-4 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-white/36">
                Desafio mensal
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {periodStart ? <DetailStat label="Início" value={periodStart} /> : null}
                {periodEnd ? <DetailStat label="Termina em" value={periodEnd} /> : null}
              </div>
              {achievement.rewardLabel ? (
                <p className="mt-3 rounded-[14px] bg-[var(--gc-brand)]/[0.08] px-3 py-2 text-[12px] font-black leading-4 text-[var(--gc-brand)]">
                  Recompensa: {achievement.rewardLabel}
                </p>
              ) : null}
            </div>
          ) : null}

          {achievement.rarityStats ? (
            <div className="mt-3 w-full max-w-[360px] rounded-[20px] border border-[var(--gc-brand)]/12 bg-[var(--gc-brand)]/[0.055] p-4 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--gc-brand)]/72">
                Raridade global
              </p>
              <p className="mt-1 text-[15px] font-black text-white">
                {rarityOwnershipSentence(achievement.rarityStats)}
              </p>
              <p className="mt-1 text-[11px] font-bold text-white/42">
                Base atual: {achievement.rarityStats.totalUsers.toLocaleString("pt-BR")} usuários ativos.
              </p>
            </div>
          ) : null}

          {achievement.monthKey ? (
            <p className="mt-4 rounded-full bg-white/[0.05] px-4 py-2 text-[12px] font-bold text-white/52">
              Exclusiva de {achievement.monthKey}. Desafios mensais não voltam.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] bg-white/[0.045] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.06em] text-white/36">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-black text-white">{value}</p>
    </div>
  );
}

function formatAchievementDate(value?: string | null) {
  if (!value) return null;
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function formatTimesEarned(times: number) {
  if (times === 1) return "1 vez";
  return `${times.toLocaleString("pt-BR")} vezes`;
}

function categoryLabel(category: AchievementCategory) {
  const labels: Record<AchievementCategory, string> = {
    badge: "Badge",
    medal: "Medalha",
    trophy: "Troféu",
    relic: "Relíquia",
    challenge: "Desafio",
  };
  return labels[category];
}

function rarityLabel(rarity: AchievementV2["rarity"]) {
  const labels: Record<AchievementV2["rarity"], string> = {
    common: "Comum",
    uncommon: "Incomum",
    rare: "Raro",
    epic: "Épico",
    legendary: "Lendário",
  };
  return labels[rarity];
}

function formatOwnedPercent(stats: AchievementRarityStats) {
  if (stats.totalUsers <= 0 || stats.ownersCount <= 0) return "0%";
  const pct = stats.ownedPercent > 0 && stats.ownedPercent < 0.01 ? 0.01 : stats.ownedPercent;
  if (pct < 1) return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function rarityStatLabel(achievement: AchievementV2) {
  if (!achievement.rarityStats) return null;
  return `${formatOwnedPercent(achievement.rarityStats)} possuem`;
}

function rarityOwnershipSentence(stats: AchievementRarityStats) {
  const percent = formatOwnedPercent(stats);
  const people =
    stats.ownersCount === 1
      ? "1 pessoa possui"
      : `${stats.ownersCount.toLocaleString("pt-BR")} pessoas possuem`;
  return `${percent} dos usuários têm esta conquista · ${people}`;
}

export type { MyCircleSheetProps };
