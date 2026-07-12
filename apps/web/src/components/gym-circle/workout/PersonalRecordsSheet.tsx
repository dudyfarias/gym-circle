"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Dumbbell,
  History,
  Medal,
  RefreshCw,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExerciseProgressDetail } from "./ExerciseProgressDetail";
import { usePersonalRecords } from "./usePersonalRecords";
import type {
  PersonalRecord,
  PersonalRecordLeaderboardRow,
} from "./usePersonalRecords";
import { useWorkoutProgress } from "./useWorkoutProgress";
import type { WorkoutExerciseProgress } from "./workoutProgress";
import { WorkoutProgressChart } from "./WorkoutProgressChart";

type PersonalRecordsSheetProps = {
  onClose: () => void;
};

type ProgressTab = "overview" | "history" | "records";

function formatDuration(totalSeconds: number): string {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatValue(record: Pick<PersonalRecord, "unit" | "value" | "reps">) {
  if (record.unit === "seconds") return formatDuration(record.value);
  const weight = Number.isInteger(record.value)
    ? String(record.value)
    : record.value.toFixed(1).replace(".", ",");
  return record.reps ? `${weight} kg × ${record.reps}` : `${weight} kg`;
}

function normalizedName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function recordForExercise(
  exercise: WorkoutExerciseProgress,
  records: PersonalRecord[],
) {
  const nameKey = normalizedName(exercise.exerciseName);
  return (
    records.find(
      (record) =>
        record.metricKey === "strength_weight" &&
        (record.exerciseKey === exercise.key ||
          normalizedName(record.exerciseName || record.exerciseKey) === nameKey),
    ) ?? null
  );
}

export function PersonalRecordsSheet({ onClose }: PersonalRecordsSheetProps) {
  const { i18n, t } = useTranslation();
  const {
    records,
    loading: recordsLoading,
    error: recordsError,
    refresh: refreshRecords,
    loadLeaderboard,
  } = usePersonalRecords();
  const progress = useWorkoutProgress(true);
  const [tab, setTab] = useState<ProgressTab>("overview");
  const [selectedExerciseKey, setSelectedExerciseKey] = useState<string | null>(
    null,
  );
  const [selectedRanking, setSelectedRanking] = useState<PersonalRecord | null>(
    null,
  );
  const [leaders, setLeaders] = useState<PersonalRecordLeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const selectedExercise = selectedExerciseKey
    ? (progress.exercises.find((exercise) => exercise.key === selectedExerciseKey) ??
      null)
    : null;
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );
  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "short",
        timeZone: "America/Sao_Paulo",
      }),
    [i18n.language],
  );

  async function openLeaderboard(record: PersonalRecord) {
    setSelectedRanking(record);
    setLeaderboardLoading(true);
    try {
      setLeaders(await loadLeaderboard(record));
    } catch {
      setLeaders([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  function goBack() {
    if (selectedRanking) {
      setSelectedRanking(null);
      return;
    }
    setSelectedExerciseKey(null);
  }

  const hasNestedView = Boolean(selectedRanking || selectedExercise);
  const title = selectedRanking
    ? t("personalRecords.rankingTitle")
    : selectedExercise
      ? selectedExercise.exerciseName
      : t("personalRecords.title");
  const subtitle = selectedRanking
    ? t("personalRecords.rankingSubtitle")
    : selectedExercise
      ? t("personalRecords.progress.exerciseDetailSubtitle")
      : t("personalRecords.subtitle");

  return (
    <div
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-[96] flex justify-center overflow-y-auto bg-black/94 backdrop-blur-md"
      role="dialog"
    >
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+14px)]">
        <header className="mb-4 flex items-center gap-3">
          {hasNestedView ? (
            <button
              aria-label={t("common.back")}
              className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.07] text-white"
              onClick={goBack}
              type="button"
            >
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className="grid size-11 place-items-center rounded-[15px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
              <BarChart3 size={20} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[19px] font-black text-white">{title}</h1>
            <p className="mt-0.5 truncate text-[11.5px] font-bold text-white/48">
              {subtitle}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.07] text-white/82"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        {selectedRanking ? (
          <LeaderboardView
            leaders={leaders}
            loading={leaderboardLoading}
            record={selectedRanking}
          />
        ) : selectedExercise ? (
          <ExerciseProgressDetail
            exercise={selectedExercise}
            key={selectedExercise.key}
            onOpenLeaderboard={(record) => void openLeaderboard(record)}
            record={recordForExercise(selectedExercise, records)}
          />
        ) : (
          <>
            <div
              aria-label={t("personalRecords.progress.navigation")}
              className="mb-5 grid grid-cols-3 gap-1 rounded-[17px] bg-white/[0.055] p-1"
              role="tablist"
            >
              {(["overview", "history", "records"] as const).map((item) => (
                <button
                  aria-controls={`progress-panel-${item}`}
                  aria-selected={tab === item}
                  className={[
                    "gc-pressable min-h-11 rounded-[14px] px-2 text-[11.5px] font-black",
                    tab === item
                      ? "bg-white text-black shadow-sm"
                      : "text-white/48",
                  ].join(" ")}
                  id={`progress-tab-${item}`}
                  key={item}
                  onClick={() => setTab(item)}
                  role="tab"
                  type="button"
                >
                  {t(`personalRecords.progress.tabs.${item}`)}
                </button>
              ))}
            </div>

            <div
              aria-labelledby={`progress-tab-${tab}`}
              id={`progress-panel-${tab}`}
              role="tabpanel"
            >
              {tab === "overview" ? (
                <OverviewTab
                  loaded={progress.updatedAt !== null}
                  loading={progress.loading}
                  muscleGroups={progress.muscleGroups}
                  numberFormatter={numberFormatter}
                  progressError={progress.error}
                  records={records}
                  recordsError={recordsError}
                  recordsLoading={recordsLoading}
                  retry={() => {
                    void Promise.allSettled([
                      progress.retry(),
                      refreshRecords(),
                    ]);
                  }}
                  weeks={progress.weeks}
                />
              ) : tab === "history" ? (
                <HistoryTab
                  error={progress.error}
                  exercises={progress.exercises}
                  loaded={progress.updatedAt !== null}
                  loading={progress.loading}
                  numberFormatter={numberFormatter}
                  onOpenExercise={setSelectedExerciseKey}
                  retry={() => void progress.retry()}
                  shortDateFormatter={shortDateFormatter}
                />
              ) : (
                <RecordsTab
                  error={recordsError}
                  loading={recordsLoading}
                  onOpenLeaderboard={(record) => void openLeaderboard(record)}
                  records={records}
                  retry={() => void refreshRecords()}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

type OverviewTabProps = {
  loaded: boolean;
  loading: boolean;
  muscleGroups: ReturnType<typeof useWorkoutProgress>["muscleGroups"];
  numberFormatter: Intl.NumberFormat;
  progressError: string | null;
  records: PersonalRecord[];
  recordsError: string | null;
  recordsLoading: boolean;
  retry: () => void;
  weeks: ReturnType<typeof useWorkoutProgress>["weeks"];
};

function OverviewTab({
  loaded,
  loading,
  muscleGroups,
  numberFormatter,
  progressError,
  records,
  recordsError,
  recordsLoading,
  retry,
  weeks,
}: OverviewTabProps) {
  const { i18n, t } = useTranslation();
  const currentWeek = weeks.at(-1);
  const maximumGroupSets = Math.max(
    1,
    ...muscleGroups.map((group) => group.setCount),
  );
  const recentWeeks = weeks.slice(-8);

  if (!loaded && loading) {
    return <ProgressSkeleton />;
  }
  if (progressError && !loaded) {
    return <RetryState onRetry={retry} />;
  }

  return (
    <div className="grid gap-5">
      <section className="grid grid-cols-2 gap-2">
        <OverviewMetric
          icon={CalendarDays}
          label={t("personalRecords.progress.thisWeek")}
          value={t("personalRecords.progress.workoutCount", {
            count: currentWeek?.sessionCount ?? 0,
          })}
        />
        <OverviewMetric
          icon={History}
          label={t("personalRecords.progress.frequency")}
          value={t("personalRecords.progress.activeDayCount", {
            count: currentWeek?.activeDays ?? 0,
          })}
        />
        <OverviewMetric
          icon={Dumbbell}
          label={t("personalRecords.progress.weeklyVolume")}
          value={
            (currentWeek?.totalVolumeKg ?? 0) > 0
              ? `${numberFormatter.format(currentWeek?.totalVolumeKg ?? 0)} kg`
              : "—"
          }
        />
        <OverviewMetric
          icon={Trophy}
          label={t("personalRecords.progress.records")}
          value={String(records.length)}
        />
      </section>

      <section>
        <WorkoutProgressChart
          ariaLabel={t("personalRecords.progress.weeklyChartAria")}
          emptyLabel={t("personalRecords.progress.weeklyEmpty")}
          formatValue={(value) =>
            t("personalRecords.progress.workoutCount", {
              count: Math.round(value),
            })
          }
          points={
            recentWeeks.some((week) => week.sessionCount > 0)
              ? recentWeeks.map((week) => ({
                  id: week.weekStart,
                  label: new Intl.DateTimeFormat(i18n.language, {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(`${week.weekStart}T12:00:00.000Z`)),
                  value: week.sessionCount,
                }))
              : []
          }
          title={t("personalRecords.progress.weeklyFrequency")}
        />
      </section>

      <section>
        <SectionHeading
          subtitle={t("personalRecords.progress.muscleGroupsSubtitle")}
          title={t("personalRecords.progress.muscleGroups")}
        />
        {muscleGroups.length === 0 ? (
          <EmptyState
            body={t("personalRecords.progress.muscleGroupsEmpty")}
            title={t("personalRecords.progress.noStrengthData")}
          />
        ) : (
          <div className="mt-3 grid gap-2">
            {muscleGroups.slice(0, 6).map((group) => (
              <div
                className="rounded-[17px] border border-white/[0.055] bg-white/[0.025] p-3"
                key={group.slug}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[12.5px] font-black text-white/78">
                    {t(`personalRecords.progress.muscleGroupNames.${group.slug}`, {
                      defaultValue: group.slug,
                    })}
                  </p>
                  <p className="shrink-0 text-[11px] font-black tabular-nums text-white/42">
                    {t("personalRecords.progress.setCount", {
                      count: group.setCount,
                    })}
                  </p>
                </div>
                <div
                  aria-label={t("personalRecords.progress.muscleGroupAria", {
                    group: t(
                      `personalRecords.progress.muscleGroupNames.${group.slug}`,
                      { defaultValue: group.slug },
                    ),
                    sets: group.setCount,
                  })}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.065]"
                  role="img"
                >
                  <div
                    className="h-full rounded-full bg-[var(--gc-brand)]"
                    style={{ width: `${Math.max(8, (group.setCount / maximumGroupSets) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeading
          subtitle={t("personalRecords.progress.recentRecordsSubtitle")}
          title={t("personalRecords.progress.recentRecords")}
        />
        {recordsLoading ? (
          <ProgressSkeleton compact />
        ) : recordsError ? (
          <RetryState onRetry={retry} />
        ) : records.length === 0 ? (
          <EmptyState
            body={t("personalRecords.emptyBody")}
            title={t("personalRecords.emptyTitle")}
          />
        ) : (
          <div className="mt-3 grid gap-2">
            {records.slice(0, 3).map((record) => (
              <RecordSummary key={record.id} record={record} />
            ))}
          </div>
        )}
      </section>

      {progressError ? <RetryState onRetry={retry} /> : null}
    </div>
  );
}

function HistoryTab({
  error,
  exercises,
  loaded,
  loading,
  numberFormatter,
  onOpenExercise,
  retry,
  shortDateFormatter,
}: {
  error: string | null;
  exercises: WorkoutExerciseProgress[];
  loaded: boolean;
  loading: boolean;
  numberFormatter: Intl.NumberFormat;
  onOpenExercise: (key: string) => void;
  retry: () => void;
  shortDateFormatter: Intl.DateTimeFormat;
}) {
  const { t } = useTranslation();
  if ((!loaded || loading) && exercises.length === 0) return <ProgressSkeleton />;
  if (error && exercises.length === 0) return <RetryState onRetry={retry} />;
  if (exercises.length === 0) {
    return (
      <EmptyState
        body={t("personalRecords.progress.historyEmptyBody")}
        title={t("personalRecords.progress.historyEmptyTitle")}
      />
    );
  }

  return (
    <div className="grid gap-2.5">
      {exercises.map((exercise) => (
        <button
          className="gc-pressable flex min-h-[86px] w-full items-center gap-3 rounded-[20px] border border-white/[0.065] bg-[#0b0d0e] p-3.5 text-left"
          key={exercise.key}
          onClick={() => onOpenExercise(exercise.key)}
          type="button"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]">
            <Dumbbell size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-black text-white">
              {exercise.exerciseName}
            </span>
            <span className="mt-1 block truncate text-[11px] font-bold text-white/42">
              {t("personalRecords.progress.lastSessionValue", {
                date: shortDateFormatter.format(
                  new Date(exercise.lastPerformedAt),
                ),
              })}
            </span>
            <span className="mt-1 block text-[10.5px] font-black text-[var(--gc-brand)]">
              {t("personalRecords.progress.sessionAndSetCount", {
                sessions: exercise.sessionCount,
                sets: exercise.setCount,
              })}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-[15px] font-black tabular-nums text-white">
              {exercise.maxWeightKg == null
                ? "—"
                : `${numberFormatter.format(exercise.maxWeightKg)} kg`}
            </span>
            <span className="mt-1 block text-[9px] font-black uppercase tracking-[0.1em] text-white/32">
              {t("personalRecords.progress.bestLoad")}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function RecordsTab({
  error,
  loading,
  onOpenLeaderboard,
  records,
  retry,
}: {
  error: string | null;
  loading: boolean;
  onOpenLeaderboard: (record: PersonalRecord) => void;
  records: PersonalRecord[];
  retry: () => void;
}) {
  const { t } = useTranslation();
  if (loading && records.length === 0) return <ProgressSkeleton />;
  if (error && records.length === 0) return <RetryState onRetry={retry} />;
  if (records.length === 0) {
    return (
      <EmptyState
        body={t("personalRecords.emptyBody")}
        title={t("personalRecords.emptyTitle")}
      />
    );
  }

  return (
    <div className="grid gap-3">
      {records.map((record) => (
        <article
          className="rounded-[22px] border border-white/[0.07] bg-[#0b0d0e] p-4"
          key={record.id}
        >
          <RecordSummary record={record} />
          <button
            className="gc-pressable mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white/[0.055] px-3 text-[12.5px] font-black text-white/76"
            onClick={() => onOpenLeaderboard(record)}
            type="button"
          >
            <Users size={15} />
            {t("personalRecords.openRanking")}
          </button>
        </article>
      ))}
    </div>
  );
}

function LeaderboardView({
  leaders,
  loading,
  record,
}: {
  leaders: PersonalRecordLeaderboardRow[];
  loading: boolean;
  record: PersonalRecord;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="mb-4 rounded-[22px] border border-[var(--gc-brand)]/16 bg-[var(--gc-brand)]/[0.06] p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
          {record.exerciseName ??
            t(`personalRecords.metrics.${record.metricKey}`)}
        </p>
        <p className="mt-1 text-[34px] font-black tracking-[-0.04em] text-white tabular-nums">
          {formatValue(record)}
        </p>
      </div>
      {loading ? (
        <ProgressSkeleton />
      ) : leaders.length === 0 ? (
        <EmptyState
          body={t("personalRecords.rankingEmpty")}
          title={t("personalRecords.rankingTitle")}
        />
      ) : (
        <div className="grid gap-2">
          {leaders.map((leader) => (
            <div
              className="flex items-center gap-3 rounded-[18px] bg-white/[0.045] px-4 py-3"
              key={leader.userId}
            >
              <span className="grid size-8 place-items-center rounded-full bg-white/[0.07] text-[12px] font-black text-white/72">
                {leader.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-black text-white">
                  {leader.displayName}
                </p>
                <p className="truncate text-[11px] font-bold text-white/42">
                  @{leader.username}
                </p>
              </div>
              <p className="text-[15px] font-black text-white tabular-nums">
                {formatValue(leader)}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function RecordSummary({ record }: { record: PersonalRecord }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[var(--gc-brand)]/10 text-[var(--gc-brand)]">
        {record.unit === "kg" ? <Dumbbell size={19} /> : <Timer size={19} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-black text-white">
          {record.exerciseName ?? t(`personalRecords.metrics.${record.metricKey}`)}
        </p>
        <p className="mt-1 text-[25px] font-black tracking-[-0.04em] text-white tabular-nums">
          {formatValue(record)}
        </p>
        {record.isEstimated ? (
          <p className="mt-1 text-[10.5px] font-bold text-white/42">
            {t("personalRecords.estimated")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[19px] border border-white/[0.06] bg-white/[0.03] p-3.5">
      <Icon className="text-[var(--gc-brand)]" size={17} />
      <p className="mt-3 text-[9px] font-black uppercase tracking-[0.12em] text-white/38">
        {label}
      </p>
      <p className="mt-1 truncate text-[18px] font-black tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

function SectionHeading({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-black text-white">{title}</h2>
      <p className="mt-0.5 text-[11.5px] font-bold text-white/44">{subtitle}</p>
    </div>
  );
}

function EmptyState({ body, title }: { body: string; title: string }) {
  return (
    <div className="mt-3 rounded-[22px] border border-white/[0.075] bg-white/[0.03] p-5 text-center">
      <Medal className="mx-auto text-white/32" size={27} />
      <p className="mt-3 text-[15px] font-black text-white">{title}</p>
      <p className="mx-auto mt-1 max-w-[300px] text-[12px] font-bold leading-5 text-white/45">
        {body}
      </p>
    </div>
  );
}

function RetryState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-[22px] border border-[var(--gc-pink)]/12 bg-[var(--gc-pink)]/[0.04] p-5 text-center">
      <p className="text-[12.5px] font-bold text-white/55">
        {t("personalRecords.progress.loadError")}
      </p>
      <button
        className="gc-pressable mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-full bg-white/[0.08] px-4 text-[13px] font-black text-white"
        onClick={onRetry}
        type="button"
      >
        <RefreshCw size={15} />
        {t("common.retry")}
      </button>
    </div>
  );
}

function ProgressSkeleton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  return (
    <div aria-label={t("common.loading")} className="grid gap-2" role="status">
      {Array.from({ length: compact ? 2 : 4 }, (_, index) => (
        <div
          className="h-[82px] animate-pulse rounded-[20px] bg-white/[0.045]"
          key={index}
        />
      ))}
    </div>
  );
}
