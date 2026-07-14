"use client";

import { CalendarClock, Play, Repeat2, TrendingUp, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  WorkoutPlan,
  WorkoutPlanExecution,
} from "../social/types";
import { formatElapsed } from "./workoutElapsed";
import { getWorkoutPlanDisplayName } from "./workoutSummary";

type WorkoutPlanDetailSheetProps = {
  executions: WorkoutPlanExecution[];
  loading?: boolean;
  onClose: () => void;
  onRepeat: () => void;
  plan: WorkoutPlan;
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.035] p-3.5">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/36">
        {label}
      </p>
      <p className="mt-1.5 text-[18px] font-black tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

function formatKg(value: number | null | undefined, language: string) {
  if (!value || value <= 0) return "—";
  return `${value.toLocaleString(language, { maximumFractionDigits: 1 })} kg`;
}

export function WorkoutPlanDetailSheet({
  executions,
  loading = false,
  onClose,
  onRepeat,
  plan,
}: WorkoutPlanDetailSheetProps) {
  const { i18n, t } = useTranslation();
  const stats = plan.stats;
  const recent = executions.slice(0, 6);
  const planName = getWorkoutPlanDisplayName(
    plan.name,
    t("workoutPlans.unnamed"),
  );

  return (
    <div
      aria-label={t("workout.planDetail.title")}
      aria-modal="true"
      className="fixed inset-0 z-[115] flex items-end justify-center bg-black/72 px-3 pt-[calc(var(--gc-safe-top)+20px)] backdrop-blur-sm"
      role="dialog"
    >
      <section className="max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[32px] border border-white/[0.09] bg-[#0b0d0e] px-5 pb-[calc(var(--gc-safe-bottom)+20px)] pt-5 shadow-[0_-24px_90px_rgba(0,0,0,0.48)]">
        <header className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
            <TrendingUp size={20} strokeWidth={2.5} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--gc-brand)]">
              {t("workout.planDetail.title")}
            </p>
            <h2 className="mt-1 truncate text-[22px] font-black tracking-[-0.025em] text-white">
              {planName}
            </h2>
            <p className="mt-1 text-[11.5px] font-bold text-white/42">
              {t("workout.sets.exerciseCount", {
                count: plan.exercises.length,
              })}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/70"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Metric
            label={t("workout.planDetail.timesUsed")}
            value={String(stats?.timesUsed ?? 0)}
          />
          <Metric
            label={t("workout.planDetail.lastExecution")}
            value={
              stats?.lastUsedAt
                ? new Intl.DateTimeFormat(i18n.language, {
                    day: "2-digit",
                    month: "short",
                    timeZone: "America/Sao_Paulo",
                  }).format(new Date(stats.lastUsedAt))
                : "—"
            }
          />
          <Metric
            label={t("workout.planDetail.averageDuration")}
            value={
              (stats?.averageDurationS ?? 0) > 0
                ? formatElapsed(Math.round(stats?.averageDurationS ?? 0))
                : "—"
            }
          />
          <Metric
            label={t("workout.planDetail.averageVolume")}
            value={formatKg(stats?.averageVolumeKg, i18n.language)}
          />
          <Metric
            label={t("workout.planDetail.maxVolume")}
            value={formatKg(stats?.maxVolumeKg, i18n.language)}
          />
          <Metric
            label={t("workout.planDetail.completionRate")}
            value={
              (stats?.timesUsed ?? 0) > 0 &&
              stats?.averageCompletionRate != null
                ? `${Math.round(stats.averageCompletionRate * 100)}%`
                : "—"
            }
          />
        </div>

        <section className="mt-5">
          <div className="flex items-center gap-2 text-white/76">
            <CalendarClock size={16} />
            <h3 className="text-[13px] font-black">
              {t("workout.planDetail.recentExecutions")}
            </h3>
          </div>
          {loading ? (
            <div className="mt-2.5 grid gap-2" role="status">
              {[0, 1].map((item) => (
                <div
                  className="h-[62px] animate-pulse rounded-[16px] border border-white/[0.05] bg-white/[0.025]"
                  key={item}
                />
              ))}
            </div>
          ) : recent.length > 0 ? (
            <div className="mt-2.5 grid gap-2">
              {recent.map((execution) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-[16px] border border-white/[0.055] bg-white/[0.025] px-3.5 py-3"
                  key={execution.activityId}
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-black text-white/82">
                      {new Intl.DateTimeFormat(i18n.language, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        timeZone: "America/Sao_Paulo",
                      }).format(
                        new Date(
                          execution.startedAt ?? `${execution.workoutDate}T12:00:00Z`,
                        ),
                      )}
                    </p>
                    <p className="mt-0.5 text-[10.5px] font-bold text-white/36">
                      {execution.completionRate == null
                        ? t("workout.planDetail.completionUnavailable")
                        : t("workout.planDetail.executionCompletion", {
                            percent: Math.round(
                              execution.completionRate * 100,
                            ),
                          })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-black tabular-nums text-white/76">
                      {formatElapsed(execution.elapsedS)}
                    </p>
                    <p className="mt-0.5 text-[10.5px] font-bold tabular-nums text-white/36">
                      {formatKg(execution.volumeKg, i18n.language)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-2.5 rounded-[18px] border border-dashed border-white/[0.08] px-4 py-5 text-center">
              <Repeat2 className="mx-auto text-white/24" size={20} />
              <p className="mt-2 text-[11.5px] font-bold text-white/38">
                {t("workout.planDetail.empty")}
              </p>
            </div>
          )}
        </section>

        <button
          className="gc-pressable mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-[var(--gc-brand-ink)]"
          onClick={onRepeat}
          type="button"
        >
          <Play fill="currentColor" size={16} />
          {t("workout.planDetail.repeat")}
        </button>
      </section>
    </div>
  );
}
