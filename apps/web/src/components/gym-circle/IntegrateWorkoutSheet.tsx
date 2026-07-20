"use client";

import { ChevronRight, HeartPulse, Loader2, Route, Timer, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MergeableActivity } from "@gym-circle/core";
import {
  formatElapsed,
  formatKm,
  formatPace,
  paceFromDistance,
} from "./workout/workoutElapsed";

type IntegrateWorkoutSheetProps = {
  open: boolean;
  loading: boolean;
  activities: MergeableActivity[];
  integratedActivities: MergeableActivity[];
  error: string | null;
  /** id da atividade sendo integrada (spinner na linha). */
  integratingId: string | null;
  onSelect: (activityId: string) => void;
  onImportFromAppleHealth?: () => void;
  onClose: () => void;
};

const TYPE_LABEL_KEY: Record<string, string> = {
  strength: "workout.types.strength",
  run: "workout.types.run",
  walk: "workout.types.walk",
  ride: "workout.types.ride",
  other: "workout.types.other",
};

/**
 * "Integrar treino" — lista os treinos do mesmo dia do post que ainda podem
 * ser juntados. Selecionar adiciona um vínculo em post_activities; o primeiro
 * também permanece em source_activity_id por compatibilidade com o feed.
 */
export function IntegrateWorkoutSheet({
  open,
  loading,
  activities,
  integratedActivities,
  error,
  integratingId,
  onSelect,
  onImportFromAppleHealth,
  onClose,
}: IntegrateWorkoutSheetProps) {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div
      aria-label={t("postMenu.integrateWorkout")}
      aria-modal="true"
      className="fixed inset-0 z-[94] flex items-end justify-center bg-black/66 backdrop-blur-md"
      role="dialog"
    >
      <button
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="gc-screen-enter relative w-full max-w-[480px] rounded-t-[32px] border border-white/[0.09] bg-[#090a0b]/98 px-5 pb-[calc(var(--gc-safe-bottom)+20px)] pt-3 shadow-[0_-28px_90px_rgba(0,0,0,0.72)]">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/18" />
        <header className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <h2 className="text-[21px] font-black leading-tight text-white">
              {t("integrateWorkout.title")}
            </h2>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-white/48">
              {t("integrateWorkout.subtitle")}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.055] text-white/82"
            onClick={onClose}
            type="button"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </header>

        {integratedActivities.length > 0 ? (
          <div className="mb-4 rounded-[18px] border border-[var(--gc-blue)]/22 bg-[var(--gc-blue)]/[0.08] px-4 py-3">
            <p className="text-[13px] font-black text-[var(--gc-blue)]">
              {t("integrateWorkout.integratedCount", {
                count: integratedActivities.length,
              })}
            </p>
            <p className="mt-0.5 text-[11.5px] font-semibold leading-snug text-white/48">
              {t("integrateWorkout.integratedDetail")}
            </p>
          </div>
        ) : null}

        {error ? (
          <p
            className="mb-4 rounded-[18px] border border-[#ff375f]/22 bg-[#ff375f]/[0.08] px-4 py-3 text-[12px] font-bold leading-snug text-[#ff6b84]"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-[var(--gc-blue)]" size={26} />
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Timer className="text-white/30" size={30} strokeWidth={2.2} />
            <p className="text-[14px] font-bold text-white/54">
              {t("integrateWorkout.empty")}
            </p>
          </div>
        ) : (
          <div className="max-h-[45vh] space-y-2.5 overflow-y-auto pb-1">
            <p className="pb-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/36">
              {t("integrateWorkout.available")}
            </p>
            {activities.map((activity) => {
              const hasRoute = (activity.distanceM ?? 0) > 0;
              const pace = hasRoute
                ? paceFromDistance(
                    activity.distanceM ?? 0,
                    activity.movingS ?? activity.elapsedS,
                  )
                : null;
              const meta = [
                pace != null ? formatPace(pace) : null,
                activity.avgHr ? `${activity.avgHr} bpm` : null,
                activity.totalCalories
                  ? `${Math.round(activity.totalCalories)} kcal`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <button
                  className="gc-pressable flex w-full items-center gap-3.5 rounded-[20px] border border-white/[0.08] bg-white/[0.035] p-3.5 text-left disabled:opacity-60"
                  disabled={integratingId !== null}
                  key={activity.id}
                  onClick={() => onSelect(activity.id)}
                  type="button"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--gc-blue)] text-black">
                    {hasRoute ? (
                      <Route size={19} strokeWidth={2.8} />
                    ) : (
                      <Timer size={19} strokeWidth={2.8} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-black text-white">
                      {t(
                        TYPE_LABEL_KEY[activity.activityType] ??
                          "workout.types.other",
                      )}
                    </span>
                    <span className="block text-[12.5px] font-bold text-white/48">
                      {hasRoute
                        ? formatKm(activity.distanceM ?? 0)
                        : formatElapsed(activity.elapsedS)}
                      {meta ? ` · ${meta}` : ""}
                    </span>
                  </span>
                  {integratingId === activity.id ? (
                    <Loader2
                      className="animate-spin text-[var(--gc-blue)]"
                      size={20}
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {!loading && onImportFromAppleHealth ? (
          <div className="mt-4 border-t border-white/[0.07] pt-4">
            <button
              className="gc-pressable flex w-full items-center gap-3.5 rounded-[20px] border border-[#ff375f]/18 bg-[#ff375f]/[0.07] p-3.5 text-left"
              onClick={onImportFromAppleHealth}
              type="button"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#ff375f]/15 text-[#ff5b77]">
                <HeartPulse size={20} strokeWidth={2.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-white">
                  {t("integrateWorkout.importAppleHealth")}
                </span>
                <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-white/46">
                  {t("integrateWorkout.importAppleHealthDetail")}
                </span>
              </span>
              <ChevronRight className="shrink-0 text-white/30" size={18} />
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
