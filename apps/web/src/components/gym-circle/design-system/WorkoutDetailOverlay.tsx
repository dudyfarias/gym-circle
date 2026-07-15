"use client";

import { Bike, Dumbbell, Footprints, MapPin, Play, Trophy, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { WorkoutDetail } from "../social/types";
import {
  normalizeActivitySource,
  normalizedMovingSeconds,
  resolveActivityRoute,
  resolveActivityTime,
} from "../workout/activityDetail";
import {
  formatApplePace,
  formatElapsed,
  formatKm,
  paceFromDistance,
} from "../workout/workoutElapsed";
import { ActivityMetricGrid } from "./ActivityMetricGrid";
import { ActivitySourceBadge } from "./ActivitySourceBadge";
import { OutdoorActivityHero } from "./OutdoorActivityHero";

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

const OUTDOOR_TYPES = new Set(["run", "walk", "ride"]);

const TONE = {
  time: "#FFD60A",
  distance: "#33C7FF",
  calories: "#FF3B5F",
  pace: "#65E8F4",
  heart: "#FF5A49",
  elevation: "#5DE17E",
} as const;

function longDate(
  iso: string | null,
  locale: string,
  timeZone: string,
): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone,
  }).format(date);
}

function formatRecordValue(value: number, unit: string): string {
  if (unit === "seconds") return formatElapsed(Math.round(value));
  const formatted = new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: unit === "kg" ? 1 : 2,
  }).format(value);
  return `${formatted} ${unit}`.trim();
}

export function WorkoutDetailOverlay({
  workout,
  onClose,
}: WorkoutDetailOverlayProps) {
  const { i18n, t } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "pt-BR";
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  const meta = TYPE_META[workout.activityType] ?? TYPE_META.other;
  const Icon = meta.icon;
  const typeLabel = t(meta.key);
  const isOutdoor = OUTDOOR_TYPES.has(workout.activityType);
  const start = workout.startedAt ?? workout.endedAt;
  const locationLabel = workout.gymName ?? workout.locationName;
  const routeResolution = resolveActivityRoute({
    route: workout.route,
    distanceM: workout.distanceM,
  });
  const time = resolveActivityTime({
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    elapsedS: workout.elapsedS,
    locale,
    timeZone,
  });
  const timeLabel = time.rangeIsConsistent && time.startLabel && time.endLabel
    ? `${time.startLabel} – ${time.endLabel}`
    : time.startLabel
      ? t("workoutDetail.startedAt", { time: time.startLabel })
      : null;
  const movingS = normalizedMovingSeconds(workout.movingS, workout.elapsedS);
  const pace = routeResolution.distanceM
    ? paceFromDistance(
        routeResolution.distanceM,
        movingS ?? workout.elapsedS,
      )
    : null;
  const sourceKind = normalizeActivitySource({
    origin: workout.origin,
    sourceApp: workout.sourceApp,
  });
  const sourceBadge = (
    <ActivitySourceBadge
      externalLabel={workout.sourceApp}
      kind={sourceKind}
      labels={{
        gym_circle: t("workoutDetail.sources.gymCircle"),
        apple_watch: t("workoutDetail.sources.appleWatch"),
        apple_health: t("workoutDetail.sources.appleHealth"),
        external_app: t("workoutDetail.sources.externalApp"),
        imported: t("workoutDetail.sources.imported"),
      }}
    />
  );

  const stats: Array<{
    label: string;
    value: string;
    color: string;
    hint?: string | null;
  }> = [
    {
      label: t("workoutDetail.duration"),
      value: formatElapsed(workout.elapsedS),
      color: TONE.time,
    },
  ];
  if (routeResolution.distanceM) {
    stats.push({
      label: t("workoutDetail.distance"),
      value: formatKm(routeResolution.distanceM),
      color: TONE.distance,
      hint: routeResolution.distanceDerivedFromRoute
        ? t("workoutDetail.derivedFromRoute")
        : null,
    });
  }
  if (pace != null) {
    stats.push({
      label: t("workoutDetail.avgPace"),
      value: formatApplePace(pace),
      color: TONE.pace,
    });
  }
  if (movingS && Math.abs(movingS - workout.elapsedS) >= 30) {
    stats.push({
      label: t("workoutDetail.movingTime"),
      value: formatElapsed(movingS),
      color: TONE.time,
    });
  }
  if ((workout.elevationGainM ?? 0) >= 1) {
    stats.push({
      label: t("workoutDetail.elevation"),
      value: `${Math.round(workout.elevationGainM ?? 0)} m`,
      color: TONE.elevation,
    });
  }
  if ((workout.activeCalories ?? 0) > 0) {
    stats.push({
      label: t("workoutDetail.activeCalories"),
      value: `${Math.round(workout.activeCalories ?? 0)} kcal`,
      color: TONE.calories,
    });
  }
  if ((workout.totalCalories ?? 0) > 0) {
    stats.push({
      label: t("workoutDetail.totalCalories"),
      value: `${Math.round(workout.totalCalories ?? 0)} kcal`,
      color: TONE.calories,
    });
  }
  if ((workout.avgHr ?? 0) > 0) {
    stats.push({
      label: t("workoutDetail.avgHeartRate"),
      value: `${Math.round(workout.avgHr ?? 0)} bpm`,
      color: TONE.heart,
    });
  }
  if ((workout.maxHr ?? 0) > 0) {
    stats.push({
      label: t("workoutDetail.maxHeartRate"),
      value: `${Math.round(workout.maxHr ?? 0)} bpm`,
      color: TONE.heart,
    });
  }

  return (
    <div
      aria-label={t("workoutDetail.title")}
      aria-modal="true"
      className="fixed inset-0 z-[96] flex justify-center overflow-y-auto overscroll-contain bg-black/94 backdrop-blur-md"
      role="dialog"
    >
      <div className="relative flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+24px)] pt-[calc(var(--gc-safe-top)+14px)]">
        <button
          aria-label={t("common.close")}
          className="gc-pressable fixed right-[max(20px,calc((100vw_-_480px)/2_+_20px))] top-[calc(var(--gc-safe-top)+14px)] z-10 grid size-10 place-items-center rounded-full border border-white/[0.12] bg-black/55 text-white/88 backdrop-blur-xl"
          onClick={onClose}
          type="button"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        {isOutdoor ? (
          <OutdoorActivityHero
            activityType={workout.activityType}
            dateLabel={longDate(start, locale, timeZone)}
            distanceLabel={
              routeResolution.distanceM
                ? formatKm(routeResolution.distanceM)
                : null
            }
            locationLabel={locationLabel}
            mapLabel={t("workoutDetail.mapTitle")}
            mapUnavailableLabel={t("workoutDetail.routeUnavailable")}
            route={routeResolution.route}
            sourceBadge={sourceBadge}
            timeLabel={timeLabel}
            title={typeLabel}
          />
        ) : (
          <header className="mb-6 mt-10 flex items-center gap-3.5">
            <div className="grid size-16 shrink-0 place-items-center rounded-full bg-[var(--gc-blue)]/14 text-[var(--gc-blue)]">
              <Icon size={26} strokeWidth={2.6} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-black leading-tight text-white">
                {typeLabel}
              </p>
              {timeLabel ? (
                <p className="text-[13px] font-semibold text-white/50">{timeLabel}</p>
              ) : null}
              {locationLabel ? (
                <p className="flex items-center gap-1 text-[12px] font-semibold text-white/50">
                  <MapPin size={11} strokeWidth={2.6} />
                  <span className="truncate">{locationLabel}</span>
                </p>
              ) : null}
              <div className="mt-2">{sourceBadge}</div>
            </div>
          </header>
        )}

        <section className="mt-6">
          <h3 className="mb-3 text-[18px] font-black text-white">
            {t("workoutDetail.detailsTitle")}
          </h3>
          <ActivityMetricGrid metrics={stats} />
        </section>

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

        {workout.strengthSets && workout.strengthSets.length > 0 ? (
          <section className="mt-6">
            <h3 className="mb-3 text-[18px] font-black text-white">
              {t("workoutDetail.setsTitle")}
            </h3>
            <div className="overflow-hidden rounded-[22px] bg-white/[0.04]">
              {workout.strengthSets.map((set, index) => {
                const sets = workout.strengthSets ?? [];
                const showExercise =
                  set.exercise != null &&
                  set.exercise !== (sets[index - 1]?.exercise ?? null);
                const setNum = set.exercise
                  ? sets
                      .slice(0, index + 1)
                      .filter((item) => item.exercise === set.exercise).length
                  : index + 1;
                const loadLabel = set.weightKg
                  ? `${set.weightKg} kg`
                  : set.loadType === "bodyweight"
                    ? t("workoutDetail.bodyweight")
                    : t("workoutDetail.loadNotProvided");
                return (
                  <div key={set.setId ?? `${index}-${set.reps}-${loadLabel}`}>
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
                        {set.targetKind === "duration"
                          ? formatElapsed(set.durationSeconds ?? 0)
                          : t("workoutDetail.setReps", { reps: set.reps })}
                        <span className="text-[var(--gc-blue)]">{` · ${loadLabel}`}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {workout.caption ? (
          <section className="mt-6 rounded-[22px] border border-white/[0.055] bg-white/[0.035] p-5">
            <h3 className="text-[11px] font-black uppercase tracking-[0.11em] text-white/42">
              {t("workoutDetail.howItWent")}
            </h3>
            <p className="mt-2 whitespace-pre-wrap text-[14px] font-semibold leading-relaxed text-white/82">
              {workout.caption}
            </p>
          </section>
        ) : null}

        {isOutdoor && !routeResolution.route ? (
          <p className="mt-5 rounded-[18px] border border-white/[0.05] bg-white/[0.025] px-4 py-3 text-[11px] font-semibold leading-relaxed text-white/42">
            {t("workoutDetail.routeUnavailableDetail")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
