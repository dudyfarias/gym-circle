"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Dumbbell,
  Layers3,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkoutExerciseProgress } from "./workoutProgress";
import type { PersonalRecord } from "./usePersonalRecords";
import {
  WorkoutProgressChart,
  type WorkoutProgressChartPoint,
} from "./WorkoutProgressChart";

type ExerciseMetric = "weight" | "volume" | "reps" | "duration";

type ExerciseProgressDetailProps = {
  exercise: WorkoutExerciseProgress;
  onOpenLeaderboard?: (record: PersonalRecord) => void;
  record?: PersonalRecord | null;
};

function formatDuration(totalSeconds: number) {
  const rounded = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, "0")}`
    : `${seconds}s`;
}

function metricValue(
  metric: ExerciseMetric,
  point: WorkoutExerciseProgress["points"][number],
) {
  if (metric === "weight") return point.maxWeightKg;
  if (metric === "volume") return point.totalVolumeKg || null;
  if (metric === "duration") return point.totalDurationSeconds || null;
  return point.totalReps || null;
}

export function ExerciseProgressDetail({
  exercise,
  onOpenLeaderboard,
  record,
}: ExerciseProgressDetailProps) {
  const { i18n, t } = useTranslation();
  const availableMetrics = useMemo<ExerciseMetric[]>(() => {
    const metrics: ExerciseMetric[] = [];
    if (exercise.weightedSetCount > 0) metrics.push("weight", "volume");
    if (exercise.totalReps > 0) metrics.push("reps");
    if (exercise.totalDurationSeconds > 0) metrics.push("duration");
    return metrics.length > 0 ? metrics : ["reps"];
  }, [exercise]);
  const [selectedMetric, setSelectedMetric] = useState<ExerciseMetric>(
    availableMetrics[0],
  );
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }),
    [i18n.language],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "America/Sao_Paulo",
      }),
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
  const metricPoints = exercise.points.map((point) => ({
    id: point.activityId,
    label: shortDateFormatter.format(new Date(point.performedAt)),
    value: metricValue(selectedMetric, point),
  }));
  const usablePointCount = metricPoints.filter(
    (point) => point.value != null && Number.isFinite(point.value),
  ).length;
  const chartPoints: WorkoutProgressChartPoint[] =
    usablePointCount >= 2 ? metricPoints : [];

  function formatMetric(value: number) {
    if (selectedMetric === "duration") return formatDuration(value);
    if (selectedMetric === "weight") {
      return `${numberFormatter.format(value)} kg`;
    }
    if (selectedMetric === "volume") {
      return `${numberFormatter.format(value)} kg`;
    }
    return t("personalRecords.progress.repsValue", {
      count: Math.round(value),
    });
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-[24px] border border-[var(--gc-brand)]/16 bg-[linear-gradient(145deg,rgba(92,232,255,0.12),rgba(11,13,14,0.96)_58%)] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
          {t("personalRecords.progress.exerciseHistory")}
        </p>
        <h2 className="mt-1 text-[23px] font-black leading-tight text-white">
          {exercise.exerciseName}
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat
            icon={CalendarDays}
            label={t("personalRecords.progress.sessions")}
            value={String(exercise.sessionCount)}
          />
          <Stat
            icon={Dumbbell}
            label={t("personalRecords.progress.bestLoad")}
            value={
              exercise.maxWeightKg == null
                ? "—"
                : `${numberFormatter.format(exercise.maxWeightKg)} kg`
            }
          />
          <Stat
            icon={Layers3}
            label={t("personalRecords.progress.sets")}
            value={String(exercise.setCount)}
          />
          <Stat
            icon={Timer}
            label={t("personalRecords.progress.lastSession")}
            value={shortDateFormatter.format(
              new Date(exercise.lastPerformedAt),
            )}
          />
        </div>
      </section>

      {record ? (
        <section className="flex items-center gap-3 rounded-[20px] border border-[#ffd84d]/18 bg-[#ffd84d]/[0.06] p-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[#ffd84d]/12 text-[#ffd84d]">
            <Trophy size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#ffd84d]/72">
              {t("personalRecords.progress.personalBest")}
            </p>
            <p className="mt-0.5 truncate text-[18px] font-black tabular-nums text-white">
              {numberFormatter.format(record.value)} kg
              {record.reps
                ? ` × ${t("personalRecords.progress.repsShort", { count: record.reps })}`
                : ""}
            </p>
          </div>
          {onOpenLeaderboard ? (
            <button
              aria-label={t("personalRecords.openRanking")}
              className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/76"
              onClick={() => onOpenLeaderboard(record)}
              type="button"
            >
              <Users size={17} />
            </button>
          ) : null}
        </section>
      ) : null}

      <section>
        <div
          aria-label={t("personalRecords.progress.metricSelector")}
          className="gc-scrollbar flex gap-2 overflow-x-auto pb-2"
          role="tablist"
        >
          {availableMetrics.map((metric) => (
            <button
              aria-controls="exercise-progress-chart"
              aria-selected={selectedMetric === metric}
              className={[
                "gc-pressable min-h-11 shrink-0 rounded-full px-4 text-[12px] font-black",
                selectedMetric === metric
                  ? "bg-white text-black"
                  : "bg-white/[0.06] text-white/55",
              ].join(" ")}
              id={`exercise-metric-${metric}`}
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              role="tab"
              type="button"
            >
              {t(`personalRecords.progress.metrics.${metric}`)}
            </button>
          ))}
        </div>
        <div
          aria-labelledby={`exercise-metric-${selectedMetric}`}
          id="exercise-progress-chart"
          role="tabpanel"
        >
          <WorkoutProgressChart
            ariaLabel={t("personalRecords.progress.chartAria", {
              exercise: exercise.exerciseName,
              metric: t(`personalRecords.progress.metrics.${selectedMetric}`),
            })}
            emptyLabel={t("personalRecords.progress.moreData", {
              metric: t(
                `personalRecords.progress.metrics.${selectedMetric}`,
              ).toLocaleLowerCase(i18n.language),
            })}
            formatValue={formatMetric}
            points={chartPoints}
            title={t(`personalRecords.progress.metrics.${selectedMetric}`)}
          />
        </div>
      </section>

      <section>
        <h3 className="text-[12px] font-black uppercase tracking-[0.13em] text-white/46">
          {t("personalRecords.progress.sessionHistory")}
        </h3>
        <div className="mt-3 grid gap-2">
          {[...exercise.points].reverse().map((point) => (
            <article
              className="rounded-[18px] border border-white/[0.065] bg-white/[0.025] p-3.5"
              key={point.activityId}
            >
              <div className="flex items-center justify-between gap-3">
                <time
                  className="text-[12px] font-black text-white/72"
                  dateTime={point.performedAt}
                >
                  {dateFormatter.format(new Date(point.performedAt))}
                </time>
                <span className="text-[10px] font-black uppercase tracking-[0.1em] text-white/35">
                  {t("personalRecords.progress.setCount", {
                    count: point.setCount,
                  })}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] font-bold text-white/48">
                {point.maxWeightKg != null ? (
                  <span>
                    {t("personalRecords.progress.bestWeightValue", {
                      value: numberFormatter.format(point.maxWeightKg),
                    })}
                  </span>
                ) : null}
                {point.totalVolumeKg > 0 ? (
                  <span>
                    {t("personalRecords.progress.volumeValue", {
                      value: numberFormatter.format(point.totalVolumeKg),
                    })}
                  </span>
                ) : null}
                {point.totalReps > 0 ? (
                  <span>
                    {t("personalRecords.progress.repsValue", {
                      count: point.totalReps,
                    })}
                  </span>
                ) : null}
                {point.totalDurationSeconds > 0 ? (
                  <span>
                    {t("personalRecords.progress.durationValue", {
                      value: formatDuration(point.totalDurationSeconds),
                    })}
                  </span>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Dumbbell;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[17px] bg-black/28 p-3">
      <Icon className="text-[var(--gc-brand)]" size={15} />
      <p className="mt-2 text-[9px] font-black uppercase tracking-[0.11em] text-white/36">
        {label}
      </p>
      <p className="mt-1 truncate text-[17px] font-black tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}
