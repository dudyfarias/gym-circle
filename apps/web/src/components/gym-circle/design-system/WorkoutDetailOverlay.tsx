"use client";

import { Bike, Dumbbell, Footprints, MapPin, Play, Trophy, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkoutDetail } from "../social/types";
import {
  formatApplePace,
  formatElapsed,
  formatKm,
  paceFromDistance,
} from "../workout/workoutElapsed";
import { WorkoutRouteMap } from "./WorkoutRouteMap";

type WorkoutDetailOverlayProps = {
  workout: WorkoutDetail;
  onClose: () => void;
};

const TYPE_META: Record<string, { key: string; icon: LucideIcon }> = {
  strength: { key: "workout.types.strength", icon: Dumbbell },
  run: { key: "workout.types.run", icon: Footprints },
  walk: { key: "workout.types.walk", icon: Footprints },
  ride: { key: "workout.types.ride", icon: Bike },
  other: { key: "workout.types.other", icon: Play },
};

// Paleta Apple Atividades (número colorido por métrica).
const TONE = {
  time: "#FFD60A",
  distance: "#33C7FF",
  calories: "#FF3B5F",
  pace: "var(--gc-blue)",
  heart: "#FF453A",
  elevation: "#4CD964",
} as const;

function spTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function spLongDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Sao_Paulo",
  }).format(d);
}

function formatRecordValue(value: number, unit: string): string {
  if (unit === "seconds") return formatElapsed(Math.round(value));
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: unit === "kg" ? 1 : 2,
  }).format(value);
  return `${formatted} ${unit}`.trim();
}

/**
 * Detalhe do treino estilo Apple Atividades — abre ao tocar nos stats de uma
 * entrada de atividade OU no header de um post promovido de treino. Mostra o
 * que temos (grid de métricas coloridas + mini-mapa da rota). Parciais/
 * segmentos/série de FC ficam de fora (não gravamos série temporal).
 */
export function WorkoutDetailOverlay({
  workout,
  onClose,
}: WorkoutDetailOverlayProps) {
  const { t } = useTranslation();
  const meta = TYPE_META[workout.activityType] ?? TYPE_META.other;
  const Icon = meta.icon;
  const typeLabel = t(meta.key);
  const start = workout.startedAt ?? workout.endedAt;
  const timeRange = [spTime(workout.startedAt), spTime(workout.endedAt)]
    .filter(Boolean)
    .join(" – ");
  const locationLabel = workout.gymName ?? workout.locationName;

  const pace =
    (workout.distanceM ?? 0) > 0
      ? paceFromDistance(
          workout.distanceM ?? 0,
          workout.movingS ?? workout.elapsedS,
        )
      : null;

  const stats: Array<{ label: string; value: string; color: string }> = [];
  if (workout.movingS && workout.movingS > 0) {
    stats.push({
      label: t("workoutDetail.workoutTime"),
      value: formatElapsed(workout.movingS),
      color: TONE.time,
    });
  }
  stats.push({
    label: t("workoutDetail.duration"),
    value: formatElapsed(workout.elapsedS),
    color: TONE.time,
  });
  if ((workout.distanceM ?? 0) > 0) {
    stats.push({
      label: t("workoutDetail.distance"),
      value: formatKm(workout.distanceM ?? 0),
      color: TONE.distance,
    });
  }
  if (workout.activeCalories != null) {
    stats.push({
      label: t("workoutDetail.activeCalories"),
      value: `${Math.round(workout.activeCalories)} cal`,
      color: TONE.calories,
    });
  }
  if (workout.totalCalories != null) {
    stats.push({
      label: t("workoutDetail.totalCalories"),
      value: `${Math.round(workout.totalCalories)} cal`,
      color: TONE.calories,
    });
  }
  if (pace != null) {
    stats.push({
      label: t("workoutDetail.avgPace"),
      value: formatApplePace(pace),
      color: TONE.pace,
    });
  }
  if ((workout.elevationGainM ?? 0) >= 1) {
    stats.push({
      label: t("workoutDetail.elevation"),
      value: `${Math.round(workout.elevationGainM ?? 0)} m`,
      color: TONE.elevation,
    });
  }
  if (workout.avgHr != null) {
    stats.push({
      label: t("workoutDetail.avgHeartRate"),
      value: `${workout.avgHr} bpm`,
      color: TONE.heart,
    });
  }

  return (
    <div
      aria-label={t("workoutDetail.title")}
      aria-modal="true"
      className="fixed inset-0 z-[96] flex justify-center overflow-y-auto bg-black/92 backdrop-blur-md"
      role="dialog"
    >
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+14px)]">
        <header className="mb-5 flex items-center justify-between">
          <p className="text-[15px] font-black text-white">
            {spLongDate(start)}
          </p>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-9 place-items-center rounded-full border border-white/[0.08] bg-white/[0.08] text-white/82"
            onClick={onClose}
            type="button"
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </header>

        {/* Cabeçalho: ícone + tipo + horário + local */}
        <div className="mb-6 flex items-center gap-3.5">
          <div className="grid size-16 shrink-0 place-items-center rounded-full bg-[var(--gc-blue)]/14 text-[var(--gc-blue)]">
            <Icon size={26} strokeWidth={2.6} />
          </div>
          <div className="min-w-0">
            <p className="text-[22px] font-black leading-tight text-white">
              {typeLabel}
            </p>
            {timeRange ? (
              <p className="text-[14px] font-semibold text-white/50">
                {timeRange}
              </p>
            ) : null}
            {locationLabel ? (
              <p className="flex items-center gap-1 text-[13px] font-semibold text-white/50">
                <MapPin size={11} strokeWidth={2.6} />
                <span className="truncate">{locationLabel}</span>
              </p>
            ) : null}
          </div>
        </div>

        {/* Grid de métricas (Detalhes do Exercício) */}
        <h3 className="mb-3 text-[19px] font-black text-white">
          {t("workoutDetail.detailsTitle")}
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-[22px] bg-white/[0.04] p-5">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-white/62">
                {stat.label}
              </p>
              <p
                className="text-[25px] font-black leading-tight"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {workout.recordHighlights && workout.recordHighlights.length > 0 ? (
          <section className="mt-4 rounded-[22px] border border-[#FFD60A]/18 bg-[#FFD60A]/[0.055] p-4">
            <div className="flex items-center gap-2 text-[#FFD60A]">
              <Trophy size={17} strokeWidth={2.6} />
              <p className="text-[11px] font-black uppercase tracking-[0.13em]">
                {t("workout.records.newRecords")}
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              {workout.recordHighlights.slice(0, 3).map((highlight) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-[16px] bg-black/18 px-3.5 py-3"
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
                    {formatRecordValue(highlight.value, highlight.unit)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Séries de musculação (só treino de força) */}
        {workout.strengthSets && workout.strengthSets.length > 0 ? (
          <>
            <h3 className="mb-3 mt-6 text-[19px] font-black text-white">
              {t("workoutDetail.setsTitle")}
            </h3>
            <div className="overflow-hidden rounded-[22px] bg-white/[0.04]">
              {workout.strengthSets.map((set, index) => {
                const sets = workout.strengthSets ?? [];
                const showExercise =
                  set.exercise != null &&
                  set.exercise !== (sets[index - 1]?.exercise ?? null);
                // Numeração por exercício quando há treino salvo; global senão.
                const setNum = set.exercise
                  ? sets
                      .slice(0, index + 1)
                      .filter((s) => s.exercise === set.exercise).length
                  : index + 1;
                return (
                  <div key={`${index}-${set.reps}-${set.weightKg ?? "bw"}`}>
                    {showExercise ? (
                      <p className="border-b border-white/[0.06] px-5 pb-1.5 pt-3.5 text-[13.5px] font-black text-white">
                        {set.exercise}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3 last:border-b-0">
                      <span className="text-[14px] font-bold text-white/62">
                        {t("workoutDetail.setNumber", { number: setNum })}
                      </span>
                      <span className="text-[15px] font-black text-white">
                        {t("workoutDetail.setReps", { reps: set.reps })}
                        {set.weightKg != null ? (
                          <span className="text-[var(--gc-blue)]">
                            {` · ${set.weightKg} kg`}
                          </span>
                        ) : (
                          <span className="text-white/50">
                            {` · ${t("workoutDetail.bodyweight")}`}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {/* Mapa geográfico da rota */}
        {workout.route && workout.route.length >= 2 ? (
          <>
            <h3 className="mb-3 mt-6 text-[19px] font-black text-white">
              {t("workoutDetail.mapTitle")}
            </h3>
            <div className="overflow-hidden rounded-[22px] border border-[var(--gc-blue)]/12 bg-[var(--gc-blue)]/[0.05]">
              <WorkoutRouteMap
                className="h-52 w-full"
                label={t("workoutDetail.mapTitle")}
                route={workout.route}
              />
            </div>
          </>
        ) : null}

        {workout.caption ? (
          <p className="mt-5 text-[14px] font-semibold leading-snug text-white/80">
            {workout.caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}
