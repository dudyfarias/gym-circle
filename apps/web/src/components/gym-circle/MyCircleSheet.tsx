"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Trophy, X } from "lucide-react";
import {
  AvatarConsistencyRings,
  StreakBadge,
} from "./design-system";
import { simulateHaptic } from "./social/haptics";
import {
  countEarnedBadges,
  getEarnedBadges,
  getNextBadge,
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
  onClose: () => void;
  onOpenStory?: () => void;
};

export function MyCircleSheet({
  open,
  user,
  posts,
  isOwn,
  hasStory = false,
  storyViewed = false,
  onClose,
  onOpenStory,
}: MyCircleSheetProps) {
  // Mês exibido no calendário (default = mês atual). Navegação ← / →.
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });

  useEffect(() => {
    if (!open) {
      setCalendarMonth({
        year: today.getFullYear(),
        month: today.getMonth(),
      });
    }
  }, [open, today]);

  if (!open || !user) return null;

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
  const badges = getEarnedBadges({
    user,
    postsCount: posts.length,
    hasUsedStreakRestore: Boolean(user.lastStreakRestoreUsedAt),
  });
  const earnedCount = countEarnedBadges(badges);
  const nextBadge = getNextBadge(badges);

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
    onClose();
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

  const monthLabel = new Intl.DateTimeFormat("pt-BR", {
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
        aria-label="Fechar Meu Circle"
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
            {isOwn ? "Meu Circle" : `Circle de ${user.name.split(" ")[0] ?? user.username}`}
          </h2>
          <button
            aria-label="Fechar"
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
                  aria-label="Perfil privado"
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
              <p className="text-[15px] font-black text-white">Perfil privado</p>
              <p className="mt-2 text-[12px] font-bold text-white/56">
                Detalhes de gamificação só ficam visíveis para quem segue.
              </p>
            </section>
          ) : (
            <>
              {/* B. Resumo principal — grid 2x3 */}
              <section className="mt-8 grid grid-cols-2 gap-2">
                <SummaryCard label="Streak atual" value={`${user.currentStreak}d`} />
                <SummaryCard label="Maior streak" value={`${user.longestStreak}d`} />
                <SummaryCard label="Treinos no mês" value={user.workoutsThisMonth.toLocaleString("pt-BR")} />
                <SummaryCard label="Dias no ano" value={user.activeDaysCount.toLocaleString("pt-BR")} />
                <SummaryCard label="Posts" value={posts.length.toLocaleString("pt-BR")} />
                <SummaryCard
                  label="Restauradores"
                  value={(user.streakRestoresAvailable ?? 0).toLocaleString("pt-BR")}
                />
              </section>

              {/* C. Explicação dos rings */}
              <section className="mt-8">
                <h4 className="mb-3 text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                  Sua consistência
                </h4>
                <div className="space-y-3 rounded-[20px] bg-white/[0.035] p-4">
                  <RingProgressRow
                    color="var(--gc-consistency-week, var(--gc-consistency-daily))"
                    label="Semana"
                    progressPct={progress.week}
                    value={`${consistencyInput.workoutsThisWeek}/7 dias`}
                  />
                  <RingProgressRow
                    color="var(--gc-consistency-month)"
                    label="Mês"
                    progressPct={progress.month}
                    value={`${consistencyInput.workoutsThisMonth}/${getTotalDaysInMonth(today)} dias`}
                  />
                  <RingProgressRow
                    color="var(--gc-consistency-year)"
                    label="Ano"
                    progressPct={progress.year}
                    value={`${consistencyInput.workoutsThisYear}/${getTotalDaysInYear(today)} dias`}
                  />
                </div>
              </section>

              {/* D. Calendário mensal */}
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                    Calendário
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      aria-label="Mês anterior"
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
                      aria-label="Próximo mês"
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
                              ? `Dia ${day} treinou`
                              : `Dia ${day} sem treino`
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
                  Níveis de consistência
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
                          <span className="text-[14px] font-black">{lv.label}</span>
                        </div>
                        <span className="text-[11px] font-bold opacity-72">
                          {lv.nextLevelAt
                            ? `${lv.minDays}–${lv.nextLevelAt - 1} dias`
                            : `${lv.minDays}+ dias`}
                          {isCurrent ? " · você está aqui" : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* F. Badges */}
              <section className="mt-8">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-[13px] font-black uppercase tracking-[0.06em] text-white/44">
                    Badges
                  </h4>
                  <span className="text-[11px] font-black text-white/52">
                    {earnedCount}/{badges.length}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-white/[0.035] p-3 sm:grid-cols-4">
                  {badges.map((badge) => (
                    <BadgeChip badge={badge} key={badge.id} />
                  ))}
                </div>
                {nextBadge ? (
                  <p className="mt-3 text-center text-[11px] font-bold text-white/52">
                    Falta pouco pra <span className="font-black text-white">{nextBadge.label}</span>{" "}
                    — {nextBadge.description.toLowerCase()}
                  </p>
                ) : null}
              </section>

              {/* G. Competição (placeholder) */}
              <section className="mt-8 rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.02] p-5 text-center">
                <Trophy className="mx-auto text-white/32" size={28} strokeWidth={2} />
                <p className="mt-3 text-[14px] font-black text-white">Competição em breve</p>
                <p className="mt-1.5 text-[12px] font-bold text-white/52">
                  Ranking semanal, desafios e comparação com amigos chegam na próxima sprint.
                </p>
              </section>
            </>
          )}
        </div>
      </div>
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

function BadgeChip({ badge }: { badge: ReturnType<typeof getEarnedBadges>[number] }) {
  return (
    <div
      aria-label={`${badge.label} — ${badge.earned ? "conquistada" : "bloqueada"}`}
      className={[
        "flex aspect-square flex-col items-center justify-center gap-1 rounded-[14px] p-2 text-center transition-colors",
        badge.earned
          ? "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
          : "bg-white/[0.03] text-white/26",
      ].join(" ")}
      title={badge.description}
    >
      {badge.earned ? (
        <Trophy fill="currentColor" size={20} strokeWidth={2} />
      ) : (
        <Lock size={18} strokeWidth={2.4} />
      )}
      <span className="line-clamp-2 text-[9.5px] font-black leading-[1.1]">
        {badge.label}
      </span>
    </div>
  );
}

export type { MyCircleSheetProps };
