"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, Share2, Trophy, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AvatarConsistencyRings,
  ContextualHint,
  FeaturedAchievementsRow,
  StreakBadge,
} from "./design-system";
import { simulateHaptic } from "./social/haptics";
import {
  getAllAchievements,
  resolveFeaturedAchievements,
  type Achievement,
} from "./social/achievements";
import type { MonthlyRecap } from "./social/monthlyRecap";
import type { MonthlyChallengeData } from "./social/monthlyChallenges";
import { MonthlyChallengesCard } from "./MonthlyChallengesCard";
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
  /**
   * Sprint 5.1 — Monthly Recap entrou no hub MyCircle. Quando `isOwn` for
   * true E `monthlyRecap` for fornecido, mostramos um botão "Compartilhar
   * resumo" entre as seções Badges e Competição. Em perfil de outros users
   * o botão fica oculto (recap é um asset social do próprio user).
   */
  monthlyRecap?: MonthlyRecap | null;
  onOpenMonthlyRecap?: () => void;
  /**
   * Sprint 5.4 — abre o BadgesSheet (página dedicada). Wire-up no
   * GymCirclePreview. Quando ausente, o MyCircle não mostra o botão
   * "Ver todos →" nem torna os badges clicáveis.
   */
  onOpenBadges?: () => void;
  /**
   * Sprint 5.8 — abre o PostDetail do post correspondente ao mini-foto do
   * calendar. Quando ausente, as cells do calendário não viram tappable
   * (apenas decoração). Wire-up vem do GymCirclePreview, mesmo handler
   * usado pelo ProfilePostsGrid pra consistência de UX.
   */
  onOpenPost?: (postId: string) => void;
  /**
   * Sprint 5.10 — abre o RecapPeriodPickerSheet pra escolher qual mês ou
   * ano compartilhar. Aparece como CTA secundário abaixo do "Compartilhar
   * resumo de {mês}". Quando ausente, só o caminho rápido (mês corrente)
   * fica disponível.
   */
  onOpenRecapPeriodPicker?: () => void;
  /**
   * Sprint 7C.3 — marca hint contextual como visto (cross-device). Usada
   * pelo banner "primeira visita" do hub que explica rings/badges/calendar.
   * Quando ausente, hint não renderiza (sem persistência = não mostra).
   */
  onMarkContextualHintSeen?: (hintId: string) => Promise<void>;
  /**
   * Sprint 7.5.6 — desafios mensais do período corrente. Carregados no
   * GymCirclePreview via loadMonthlyChallenges. Array vazio (ou ausente)
   * → card simplesmente não renderiza.
   */
  monthlyChallenges?: ReadonlyArray<MonthlyChallengeData>;
  /**
   * Sprint 15.5 — tap num card das Conquistas em destaque abre o
   * AchievementDetailOverlay (mesmo handler do perfil/hall).
   */
  onOpenAchievementDetail?: (achievement: Achievement) => void;
  /**
   * Fix calendário — avisa o parent qual mês (YYYY-MM) ficou visível
   * (abertura do sheet + navegação ← →). O parent garante os posts desse
   * mês hidratados (ensureProfilePostsForMonth) pras mini-fotos de meses
   * antigos não sumirem em users com 50+ posts. Os dias marcados não
   * dependem disso (user_activity_days é fetch completo).
   */
  onVisibleMonthChange?: (monthKey: string) => void;
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
  monthlyRecap,
  onOpenMonthlyRecap,
  onOpenBadges,
  onOpenPost,
  onOpenRecapPeriodPicker,
  onMarkContextualHintSeen,
  monthlyChallenges,
  onOpenAchievementDetail,
  onVisibleMonthChange,
}: MyCircleSheetProps) {
  const { t, i18n } = useTranslation();
  // Mês exibido no calendário (default = mês atual). Navegação ← / →.
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => formatDateKey(today), [today]);
  const [calendarMonth, setCalendarMonth] = useState<{ year: number; month: number }>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const visibleMonthKey = `${calendarMonth.year}-${String(
    calendarMonth.month + 1,
  ).padStart(2, "0")}`;

  useEffect(() => {
    if (
      open &&
      user &&
      (isOwn || !user.isPrivate || user.followStatus === "accepted")
    ) {
      onVisibleMonthChange?.(visibleMonthKey);
    }
  }, [isOwn, onVisibleMonthChange, open, user, visibleMonthKey]);

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
  // Sprint 15.5 — seção F agora é a MESMA "Conquistas em destaque" do perfil
  // (achievements v2 + artefatos 3D), com a mesma regra equipped → suggest.
  const allAchievements = getAllAchievements({
    user,
    postsCount: posts.length,
    hasUsedStreakRestore: Boolean(user.lastStreakRestoreUsedAt),
    posts: posts.map((post) => ({
      createdAt: post.createdAt,
      workoutType: post.workoutType ?? null,
      workoutTypes: post.workoutTypes ?? null,
      gymId: post.gymId,
    })),
  });
  const featuredAchievements = resolveFeaturedAchievements(
    allAchievements,
    user.featuredAchievements,
  );

  const calendarDate = new Date(calendarMonth.year, calendarMonth.month, 1);
  const totalDaysInCalendarMonth = getTotalDaysInMonth(calendarDate);
  // Sprint 5.2 — passa posts pro builder linkar thumbnail por workoutDate.
  // Posts vêm do parent já filtrados pelo user dono do MyCircleSheet
  // (pode ser próprio ou outro user — privacy já checada lá em cima
  // via canSeeDetails). Quando não há foto, builder retorna thumbnailUrl null
  // e a UI cai pro estilo sólido anterior — fully back-compat.
  const monthDays = buildMonthWorkoutDays(
    user.workoutDays ?? [],
    formatDateKey(calendarDate),
    posts,
  );

  // Cabeçalho do calendário: posição do primeiro dia da semana
  const firstDayOfWeek = new Date(
    calendarMonth.year,
    calendarMonth.month,
    1,
  ).getDay(); // 0=dom, 1=seg, ..., 6=sáb
  const leadingBlanks = (firstDayOfWeek + 6) % 7; // converte pra base segunda (0=seg, 6=dom)

  function resetCalendarMonth() {
    setCalendarMonth({
      year: today.getFullYear(),
      month: today.getMonth(),
    });
  }

  function handleClose() {
    resetCalendarMonth();
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
          {/* Sprint 7C.3 — Banner de boas-vindas na primeira visita do hub.
              Explica os 3 pilares (rings, badges, calendar). Persiste seen
              cross-device via ContextualHint (DB JSONB + localStorage).
              Só mostra pro próprio user (`isOwn`) — hub de outros users
              não precisa de tutorial. */}
          {isOwn && canSeeDetails ? (
            <div className="mb-5">
              <ContextualHint
                hintId="myCircle-firstVisit"
                markSeen={onMarkContextualHintSeen}
                seenHints={user.contextualHintsSeen}
                variant="banner"
              >
                <p className="text-[12.5px] font-bold leading-[1.45] text-white/86">
                  {t("myCircle.firstVisitHint")}
                </p>
              </ContextualHint>
            </div>
          ) : null}

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
                      const thumbnailUrl = dayInfo?.thumbnailUrl ?? null;
                      const postId = dayInfo?.postId ?? null;
                      // Sprint 5.2 — Gym Rats style: cell quadrada com
                      // background-image quando há foto do treino daquele dia.
                      // Numero do dia em overlay branco com text-shadow pra
                      // legibilidade sobre qualquer foto. Cells sem foto OU
                      // dias não treinados caem no estilo sólido original.
                      const hasPhoto = trained && thumbnailUrl;
                      // Sprint 5.8 — cell tappable só quando há post + handler
                      // fornecido. Mantém back-compat: cells sem postId continuam
                      // sendo decoração (div).
                      const isTappable = Boolean(postId && onOpenPost);
                      const sharedClass = [
                        "relative grid aspect-square place-items-center overflow-hidden rounded-[10px] text-[11px] font-black transition-colors",
                        hasPhoto
                          ? "text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                          : trained
                            ? "bg-[var(--gc-consistency-month)]/22 text-[var(--gc-consistency-month)]"
                            : "bg-white/[0.04] text-white/36",
                        isToday
                          ? "ring-2 ring-[var(--gc-brand)]/72 ring-offset-2 ring-offset-[#101214]"
                          : "",
                        isTappable ? "gc-pressable cursor-pointer" : "",
                      ].join(" ");
                      const sharedAria = trained
                        ? t("myCircle.calendar.trained", { day })
                        : t("myCircle.calendar.notTrained", { day });
                      const sharedStyle = hasPhoto
                        ? {
                            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.36)), url(${thumbnailUrl})`,
                            backgroundSize: "cover" as const,
                            backgroundPosition: "center" as const,
                          }
                        : undefined;
                      const dayLabel = (
                        <span
                          className={
                            hasPhoto
                              ? "relative text-shadow-[0_1px_3px_rgba(0,0,0,0.72)] [text-shadow:0_1px_3px_rgba(0,0,0,0.72)]"
                              : "relative"
                          }
                        >
                          {day}
                        </span>
                      );

                      if (isTappable && postId && onOpenPost) {
                        return (
                          <button
                            aria-label={sharedAria}
                            className={sharedClass}
                            key={`day-${day}`}
                            onClick={() => {
                              simulateHaptic("brand");
                              onOpenPost(postId);
                            }}
                            style={sharedStyle}
                            type="button"
                          >
                            {dayLabel}
                          </button>
                        );
                      }

                      return (
                        <div
                          aria-label={sharedAria}
                          className={sharedClass}
                          key={`day-${day}`}
                          style={sharedStyle}
                        >
                          {dayLabel}
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

              {/* F. Conquistas em destaque — Sprint 15.5: a MESMA seção do
                  perfil (artefatos 3D, regra equipped → suggest), com o botão
                  pill cinza no canto superior direito abrindo o Hall da Fama
                  (overlay por cima deste sheet). Tap num artefato abre o
                  AchievementDetailOverlay. */}
              <FeaturedAchievementsRow
                achievements={featuredAchievements}
                className="mt-8"
                onOpenDetail={onOpenAchievementDetail}
                onOpenHall={onOpenBadges}
              />

              {/* G. Monthly Challenges — Sprint 7.5.6.
                  Listagem dos 4 desafios do mês corrente com progresso
                  real-time. Só renderiza pro próprio user e quando há
                  desafios carregados. */}
              {isOwn && monthlyChallenges && monthlyChallenges.length > 0 ? (
                <MonthlyChallengesCard
                  challenges={monthlyChallenges}
                  monthLabel={monthLabel}
                />
              ) : null}

              {/* H. Monthly Recap — Sprint 5.1 + 5.10.
                  CTA principal: abre o MonthlyRecapSheet pro mês corrente.
                  CTA secundário (Sprint 5.10): "Outro período" abre picker
                  pra escolher mês passado OU ano inteiro. */}
              {isOwn && monthlyRecap && onOpenMonthlyRecap ? (
                <section className="mt-8 flex flex-col gap-2">
                  <button
                    aria-label={t("myCircle.recap.cta", {
                      month: monthlyRecap.shortMonthLabel,
                    })}
                    className="gc-pressable flex w-full items-center gap-3 rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(48,213,255,0.08),rgba(255,255,255,0.02)_50%,transparent)] p-4 text-left"
                    onClick={onOpenMonthlyRecap}
                    type="button"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
                      <Share2 size={18} strokeWidth={2.4} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-black text-white">
                        {t("myCircle.recap.cta", {
                          month: monthlyRecap.shortMonthLabel,
                        })}
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] font-bold text-white/52">
                        {t("myCircle.recap.hint")}
                      </span>
                    </span>
                    <span className="text-[18px] font-black text-white/42">→</span>
                  </button>
                  {onOpenRecapPeriodPicker ? (
                    <button
                      aria-label={t("myCircle.recap.pickPeriod")}
                      className="gc-pressable rounded-[14px] bg-white/[0.04] px-4 py-2.5 text-center text-[12px] font-black text-[var(--gc-brand)]"
                      onClick={onOpenRecapPeriodPicker}
                      type="button"
                    >
                      {t("myCircle.recap.pickPeriod")} →
                    </button>
                  ) : null}
                </section>
              ) : null}

              {/* G. Competição (placeholder) */}
              <section className="mt-8 rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.02] p-5 text-center">
                <Trophy className="mx-auto text-white/32" size={28} strokeWidth={2} />
                <p className="mt-3 text-[14px] font-black text-white">
                  {t("myCircle.competition.title")} · {t("common.comingSoon")}
                </p>
                <p className="mt-1.5 text-[12px] font-bold text-white/52">
                  {t("myCircle.competition.description")}
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

export type { MyCircleSheetProps };
