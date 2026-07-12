"use client";

import { Camera, Check, Share2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkoutRouteMap } from "../design-system/WorkoutRouteMap";
import type { ComposerActivityContext } from "../social/types";
import type { WorkoutComparison } from "./exerciseHistory";
import { formatElapsed } from "./workoutElapsed";
import { formatDistance } from "./workoutSession";
import type { WorkoutSummaryMetrics } from "./workoutSummary";

export type FinishedWorkoutSummary = {
  context: ComposerActivityContext;
  metrics: WorkoutSummaryMetrics;
  /** Sprint 2 — comparação com a última sessão de força (null sem histórico). */
  comparison?: WorkoutComparison | null;
};

function deltaLabel(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} ${unit}`;
}

type WorkoutCompletionSummaryProps = {
  data: FinishedWorkoutSummary;
  onAddPhoto: () => void;
  onClose: () => void;
  onShare: () => void;
};

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-black leading-none tracking-[-0.035em] text-white tabular-nums">
        {value}
      </p>
    </div>
  );
}

export function WorkoutCompletionSummary({
  data,
  onAddPhoto,
  onClose,
  onShare,
}: WorkoutCompletionSummaryProps) {
  const { i18n, t } = useTranslation();
  const { context, metrics, comparison } = data;
  const route = context.route?.length && context.route.length > 1 ? context.route : null;
  const comparisonDate = comparison
    ? new Intl.DateTimeFormat(i18n.language, {
        day: "numeric",
        month: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(comparison.previousDate))
    : null;
  const showComparison =
    comparison != null &&
    (comparison.deltaReps !== 0 ||
      comparison.deltaVolumeKg !== 0 ||
      comparison.improvedExercises.length > 0);
  const volumeLabel = metrics.totalVolumeKg.toLocaleString(i18n.language, {
    maximumFractionDigits: 1,
  });

  return (
    <div className="flex min-h-full flex-1 flex-col pb-3">
      <header className="flex justify-end">
        <button
          aria-label={t("common.close")}
          className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.07] text-white/75"
          onClick={onClose}
          type="button"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </header>

      <section className="pt-4 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)] shadow-[0_0_36px_rgba(92,232,255,0.2)]">
          <Check size={30} strokeWidth={3} />
        </span>
        <p className="mt-5 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--gc-brand)]">
          {t(`workout.types.${context.activityType}`)}
        </p>
        <h2 className="mt-1 text-[30px] font-black tracking-[-0.035em] text-white">
          {t("workout.summary.title")}
        </h2>
        <p className="mt-2 text-[13px] font-bold text-white/48">
          {t("workout.summary.reviewHint")}
        </p>
      </section>

      <section className="mt-7 grid grid-cols-2 gap-2.5">
        <SummaryMetric
          label={t("workout.summary.duration")}
          value={formatElapsed(context.elapsedS)}
        />
        {context.activityType === "strength" ? (
          <SummaryMetric
            label={t("workout.summary.exercises")}
            value={String(metrics.exerciseCount)}
          />
        ) : (
          <SummaryMetric
            label={t("workout.metrics.distance")}
            value={
              typeof context.distanceM === "number"
                ? `${formatDistance(context.distanceM)} km`
                : "—"
            }
          />
        )}
        {context.activityType === "strength" ? (
          <>
            <SummaryMetric
              label={t("workout.summary.sets")}
              value={`${metrics.completedSets}/${metrics.plannedSets}`}
            />
            <SummaryMetric
              label={t("workout.summary.reps")}
              value={String(metrics.totalReps)}
            />
            <div className="col-span-2">
              <SummaryMetric
                label={t("workout.summary.volume")}
                value={metrics.totalVolumeKg > 0 ? `${volumeLabel} kg` : "—"}
              />
            </div>
          </>
        ) : null}
      </section>

      {showComparison && comparison ? (
        <section className="mt-3 rounded-[20px] border border-[var(--gc-brand)]/16 bg-[var(--gc-brand)]/[0.05] p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
            {t("workout.summary.vsPrevious", { date: comparisonDate })}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {comparison.deltaReps !== 0 ? (
              <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-black tabular-nums text-white">
                {deltaLabel(comparison.deltaReps, t("workout.summary.repsUnit"))}
              </span>
            ) : null}
            {comparison.deltaVolumeKg !== 0 ? (
              <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-black tabular-nums text-white">
                {deltaLabel(
                  comparison.deltaVolumeKg,
                  t("workout.summary.volumeUnit"),
                )}
              </span>
            ) : null}
          </div>
          {comparison.improvedExercises.length > 0 ? (
            <p className="mt-2.5 text-[12.5px] font-bold leading-snug text-white/72">
              {t("workout.summary.improvedIn", {
                names: comparison.improvedExercises.slice(0, 3).join(", "),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      {route ? (
        <WorkoutRouteMap
          className="mt-3 h-[180px] rounded-[24px] border border-white/[0.08]"
          label={t("workout.summary.route")}
          route={route}
        />
      ) : null}

      <div className="mt-auto grid gap-2.5 pt-8">
        <button
          className="gc-pressable flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-[var(--gc-brand-ink)]"
          onClick={onShare}
          type="button"
        >
          <Share2 size={19} strokeWidth={2.6} />
          {t("workout.summary.share")}
        </button>
        <button
          className="gc-pressable flex h-13 items-center justify-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] text-[14px] font-black text-white"
          onClick={onAddPhoto}
          type="button"
        >
          <Camera size={18} strokeWidth={2.5} />
          {t("workout.summary.addPhoto")}
        </button>
        <button
          className="gc-pressable py-2 text-[12px] font-black text-white/40"
          onClick={onClose}
          type="button"
        >
          {t("workout.summary.finishLater")}
        </button>
      </div>
    </div>
  );
}
