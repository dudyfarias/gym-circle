"use client";

import { useState } from "react";
import { Camera, Check, Share2, Trophy, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { WorkoutRouteMap } from "../design-system/WorkoutRouteMap";
import type { ComposerActivityContext } from "../social/types";
import type { WorkoutComparison } from "./exerciseHistory";
import { formatElapsed } from "./workoutElapsed";
import { formatDistance } from "./workoutSession";
import type { WorkoutSummaryMetrics } from "./workoutSummary";
import { useActivityRecordHighlights } from "./useActivityRecordHighlights";

export type FinishedWorkoutSummary = {
  context: ComposerActivityContext;
  metrics: WorkoutSummaryMetrics;
  workoutNote?: string;
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
  onSaveWorkoutNote?: (note: string) => Promise<void>;
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

function recordValue(value: number, unit: string, language: string) {
  if (unit === "seconds") return formatElapsed(Math.round(value));
  return `${value.toLocaleString(language, { maximumFractionDigits: 2 })} ${unit}`.trim();
}

export function WorkoutCompletionSummary({
  data,
  onAddPhoto,
  onClose,
  onSaveWorkoutNote,
  onShare,
}: WorkoutCompletionSummaryProps) {
  const { i18n, t } = useTranslation();
  const { context, metrics, comparison } = data;
  const [workoutNote, setWorkoutNote] = useState(data.workoutNote ?? "");
  const [savedWorkoutNote, setSavedWorkoutNote] = useState(
    data.workoutNote ?? "",
  );
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState(false);
  const recordHighlights = useActivityRecordHighlights(context.id);
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
      comparison.deltaDurationSeconds !== 0 ||
      comparison.improvedExercises.length > 0);
  const volumeLabel = metrics.totalVolumeKg.toLocaleString(i18n.language, {
    maximumFractionDigits: 1,
  });
  const persistWorkoutNote = async () => {
    const normalized = workoutNote.trim();
    if (normalized === savedWorkoutNote.trim()) return true;
    if (!onSaveWorkoutNote) {
      setSavedWorkoutNote(normalized);
      return true;
    }
    setNoteSaving(true);
    setNoteError(false);
    try {
      await onSaveWorkoutNote(normalized);
      setSavedWorkoutNote(normalized);
      return true;
    } catch {
      setNoteError(true);
      return false;
    } finally {
      setNoteSaving(false);
    }
  };
  const continueAfterSaving = async (action: () => void) => {
    if (await persistWorkoutNote()) action();
  };

  return (
    <div className="flex min-h-full flex-1 flex-col pb-3">
      <header className="flex justify-end">
        <button
          aria-label={t("common.close")}
          className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.07] text-white/75"
          onClick={() => void continueAfterSaving(onClose)}
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
            {comparison.deltaDurationSeconds !== 0 ? (
              <span className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-black tabular-nums text-white">
                {deltaLabel(
                  comparison.deltaDurationSeconds,
                  t("workout.summary.secondsUnit"),
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

      {recordHighlights.length > 0 ? (
        <section className="mt-3 rounded-[20px] border border-[#FFD60A]/18 bg-[#FFD60A]/[0.055] p-4">
          <div className="flex items-center gap-2 text-[#FFD60A]">
            <Trophy size={17} strokeWidth={2.7} />
            <p className="text-[10px] font-black uppercase tracking-[0.14em]">
              {t("workout.records.newRecords")}
            </p>
          </div>
          <div className="mt-3 grid gap-2">
            {recordHighlights.slice(0, 3).map((highlight) => (
              <div
                className="flex items-center justify-between gap-3 rounded-[15px] bg-black/18 px-3.5 py-3"
                key={highlight.id}
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-white">
                    {highlight.exerciseName ?? t("workout.records.workoutRecord")}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/42">
                    {t(`workout.records.metrics.${highlight.metricKey}`, {
                      defaultValue: highlight.metricKey,
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-[16px] font-black tabular-nums text-[#FFD60A]">
                  {recordValue(highlight.value, highlight.unit, i18n.language)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {route ? (
        <WorkoutRouteMap
          className="mt-3 h-[180px] rounded-[24px] border border-white/[0.08]"
          label={t("workout.summary.route")}
          route={route}
        />
      ) : null}

      <section className="mt-3 rounded-[20px] border border-white/[0.06] bg-white/[0.035] p-4">
        <label className="block">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/42">
            {t("workout.summary.noteTitle")}
          </span>
          <textarea
            className="mt-2 min-h-[84px] w-full resize-none rounded-[15px] border border-white/[0.06] bg-black/20 px-3.5 py-3 text-[13px] font-semibold leading-snug text-white outline-none placeholder:text-white/28 focus:border-[var(--gc-brand)]/45"
            maxLength={5000}
            onChange={(event) => setWorkoutNote(event.target.value)}
            placeholder={t("workout.summary.notePlaceholder")}
            value={workoutNote}
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[10.5px] font-bold text-white/34">
            {noteError
              ? t("workout.summary.noteError")
              : savedWorkoutNote.trim() === workoutNote.trim()
                ? t("workout.summary.noteSaved")
                : t("workout.summary.noteHint")}
          </p>
          <button
            className="gc-pressable shrink-0 rounded-full bg-white/[0.07] px-3.5 py-2 text-[11px] font-black text-white disabled:opacity-35"
            disabled={
              noteSaving || savedWorkoutNote.trim() === workoutNote.trim()
            }
            onClick={() => void persistWorkoutNote()}
            type="button"
          >
            {noteSaving
              ? t("workout.summary.noteSaving")
              : t("workout.summary.noteSave")}
          </button>
        </div>
      </section>

      <div className="mt-auto grid gap-2.5 pt-8">
        <button
          className="gc-pressable flex h-14 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[15px] font-black text-[var(--gc-brand-ink)]"
          onClick={() => void continueAfterSaving(onShare)}
          type="button"
        >
          <Share2 size={19} strokeWidth={2.6} />
          {t("workout.summary.share")}
        </button>
        <button
          className="gc-pressable flex h-13 items-center justify-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.055] text-[14px] font-black text-white"
          onClick={() => void continueAfterSaving(onAddPhoto)}
          type="button"
        >
          <Camera size={18} strokeWidth={2.5} />
          {t("workout.summary.addPhoto")}
        </button>
        <button
          className="gc-pressable py-2 text-[12px] font-black text-white/40"
          onClick={() => void continueAfterSaving(onClose)}
          type="button"
        >
          {t("workout.summary.finishLater")}
        </button>
      </div>
    </div>
  );
}
