"use client";

import { Bike, Dumbbell, Footprints, MapPin, Play, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EnrichedActivity } from "../social/types";
import {
  formatApplePace,
  formatElapsed,
  formatKm,
  paceFromDistance,
} from "../workout/workoutElapsed";
import { RouteSketch } from "./RouteSketch";

type WorkoutDetailOverlayProps = {
  activity: EnrichedActivity;
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

/**
 * Detalhe do treino estilo Apple Atividades — abre ao tocar nos stats de uma
 * entrada de atividade. Mostra o que temos (grid de métricas coloridas +
 * mini-mapa da rota). Parciais/segmentos/série de FC ficam de fora (não
 * gravamos série temporal).
 */
export function WorkoutDetailOverlay({
  activity,
  onClose,
}: WorkoutDetailOverlayProps) {
  const { t } = useTranslation();
  const meta = TYPE_META[activity.activityType] ?? TYPE_META.other;
  const Icon = meta.icon;
  const typeLabel = t(meta.key);
  const start = activity.startedAt ?? activity.endedAt;
  const timeRange = [spTime(activity.startedAt), spTime(activity.endedAt)]
    .filter(Boolean)
    .join(" – ");
  const locationLabel = activity.gymName ?? activity.locationName;

  const pace =
    (activity.distanceM ?? 0) > 0
      ? paceFromDistance(
          activity.distanceM ?? 0,
          activity.movingS ?? activity.elapsedS,
        )
      : null;

  const stats: Array<{ label: string; value: string; color: string }> = [];
  if (activity.movingS && activity.movingS > 0) {
    stats.push({
      label: t("workoutDetail.workoutTime"),
      value: formatElapsed(activity.movingS),
      color: TONE.time,
    });
  }
  stats.push({
    label: t("workoutDetail.duration"),
    value: formatElapsed(activity.elapsedS),
    color: TONE.time,
  });
  if ((activity.distanceM ?? 0) > 0) {
    stats.push({
      label: t("workoutDetail.distance"),
      value: formatKm(activity.distanceM ?? 0),
      color: TONE.distance,
    });
  }
  if (activity.totalCalories != null) {
    stats.push({
      label: t("workoutDetail.totalCalories"),
      value: `${Math.round(activity.totalCalories)} cal`,
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
  if ((activity.elevationGainM ?? 0) >= 1) {
    stats.push({
      label: t("workoutDetail.elevation"),
      value: `${Math.round(activity.elevationGainM ?? 0)} m`,
      color: TONE.elevation,
    });
  }
  if (activity.avgHr != null) {
    stats.push({
      label: t("workoutDetail.avgHeartRate"),
      value: `${activity.avgHr} bpm`,
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

        {/* Mapa (sketch da rota) */}
        {activity.route && activity.route.length >= 2 ? (
          <>
            <h3 className="mb-3 mt-6 text-[19px] font-black text-white">
              {t("workoutDetail.mapTitle")}
            </h3>
            <div className="overflow-hidden rounded-[22px] border border-[var(--gc-blue)]/12 bg-[var(--gc-blue)]/[0.05]">
              <RouteSketch route={activity.route} className="h-52 w-full" />
            </div>
          </>
        ) : null}

        {activity.caption ? (
          <p className="mt-5 text-[14px] font-semibold leading-snug text-white/80">
            {activity.caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}
