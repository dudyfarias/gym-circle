"use client";

import { CloudSun, Gauge, Trophy, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getSportDefinition,
  getSportLocalizedName,
} from "@gym-circle/core/domain";
import type { WorkoutDetail } from "../social/types";
import {
  normalizeActivitySource,
  mergeHydratedWorkoutDetail,
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
import { ActivityHeartRateSection } from "./ActivityHeartRateSection";
import { ActivityHero } from "./ActivityHero";

type WorkoutDetailOverlayProps = {
  workout: WorkoutDetail;
  onClose: () => void;
  loadWorkoutDetail?: (input: {
    activityId?: string | null;
    postId?: string | null;
  }) => Promise<WorkoutDetail | null>;
  loadPostWorkoutDetails?: (postId: string) => Promise<WorkoutDetail[]>;
};

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
  workout: initialWorkout,
  onClose,
  loadWorkoutDetail,
  loadPostWorkoutDetails,
}: WorkoutDetailOverlayProps) {
  const [workouts, setWorkouts] = useState<WorkoutDetail[]>([initialWorkout]);
  const [activeActivityId, setActiveActivityId] = useState(
    initialWorkout.activityId ?? null,
  );
  const requestedDetailKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const key = initialWorkout.activityId
      ? `activity:${initialWorkout.activityId}`
      : initialWorkout.postId
        ? `post:${initialWorkout.postId}`
        : null;
    if (
      !key ||
      requestedDetailKeyRef.current === key ||
      (!loadWorkoutDetail && !loadPostWorkoutDetails)
    ) {
      return;
    }
    requestedDetailKeyRef.current = key;
    let cancelled = false;
    const request = initialWorkout.postId && loadPostWorkoutDetails
      ? loadPostWorkoutDetails(initialWorkout.postId)
      : loadWorkoutDetail?.({
          activityId: initialWorkout.activityId,
          postId: initialWorkout.postId,
        }).then((hydrated) => (hydrated ? [hydrated] : []));
    void request
      ?.then((hydrated) => {
        if (!hydrated.length || cancelled) return;
        const merged = hydrated.map((detail) =>
          mergeHydratedWorkoutDetail(initialWorkout, detail),
        );
        setWorkouts(merged);
        setActiveActivityId((current) =>
          current && merged.some((detail) => detail.activityId === current)
            ? current
            : (merged[0]?.activityId ?? null),
        );
      })
      .catch(() => {
        // O resumo já possui os campos leves do feed. Falha de hidratação não
        // bloqueia fechar/navegar e não agenda retry automático.
      });
    return () => {
      cancelled = true;
    };
  }, [initialWorkout, loadPostWorkoutDetails, loadWorkoutDetail]);

  const workout =
    workouts.find((detail) => detail.activityId === activeActivityId) ??
    workouts[0] ??
    initialWorkout;

  const { i18n, t } = useTranslation();
  const locale = i18n.language?.startsWith("en") ? "en-US" : "pt-BR";
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  const fallbackTypeLabel = getSportLocalizedName(
    workout.activityType,
    i18n.language,
  );
  const healthWorkoutType = workout.healthMetadata?.workoutType;
  const typeLabel = healthWorkoutType
    ? t(`healthImport.types.${healthWorkoutType}`, {
        defaultValue: fallbackTypeLabel,
      })
    : fallbackTypeLabel;
  const isOutdoor =
    getSportDefinition(workout.activityType).trackingCapabilities.supportsRoute;
  const start = workout.startedAt ?? workout.endedAt;
  const locationLabel = workout.gymName ?? workout.locationName;
  const locationCoordinate =
    typeof workout.locationLatitude === "number" &&
    Number.isFinite(workout.locationLatitude) &&
    typeof workout.locationLongitude === "number" &&
    Number.isFinite(workout.locationLongitude)
      ? ([workout.locationLatitude, workout.locationLongitude] as [number, number])
      : null;
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
  const healthMetadata = workout.healthMetadata ?? null;
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
      hint: healthMetadata?.totalCaloriesEstimated
        ? t("workoutDetail.estimatedFromHealth")
        : null,
    });
  }

  const primaryMetric = routeResolution.distanceM
    ? formatKm(routeResolution.distanceM)
    : (workout.activeCalories ?? 0) > 0
      ? `${Math.round(workout.activeCalories ?? 0)} kcal`
      : formatElapsed(workout.elapsedS);
  const hasConditions = Boolean(
    healthMetadata?.weatherCondition ||
      healthMetadata?.temperatureC != null ||
      healthMetadata?.humidityPercent != null,
  );
  const hasContext = Boolean(
    healthMetadata?.isIndoor != null ||
      healthMetadata?.averageMets != null ||
      healthMetadata?.sourceDevice ||
      healthMetadata?.workoutBrandName,
  );
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

        <ActivityHero
          activityType={workout.activityType}
          dateLabel={longDate(start, locale, timeZone)}
          locationCoordinate={locationCoordinate}
          locationLabel={locationLabel}
          mapLabel={t("workoutDetail.mapTitle")}
          mapUnavailableLabel={t("workoutDetail.mapUnavailable")}
          primaryMetric={primaryMetric}
          route={routeResolution.route}
          sourceBadge={sourceBadge}
          timeLabel={timeLabel}
          title={typeLabel}
        />

        {workouts.length > 1 ? (
          <section className="relative z-20 -mx-5 mt-4 isolate border-y border-white/[0.055] bg-black px-5 py-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-white/42">
              {t("workoutDetail.integratedWorkouts")}
            </p>
            <nav
              aria-label={t("workoutDetail.integratedWorkouts")}
              className="flex min-h-[54px] snap-x items-stretch gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {workouts.map((detail) => {
                const fallbackLabel = getSportLocalizedName(
                  detail.activityType,
                  i18n.language,
                );
                const label = detail.healthMetadata?.workoutType
                  ? t(`healthImport.types.${detail.healthMetadata.workoutType}`, {
                      defaultValue: fallbackLabel,
                    })
                  : fallbackLabel;
                const selected = detail.activityId === workout.activityId;
                return (
                  <button
                    aria-pressed={selected}
                    className={`min-h-[50px] shrink-0 snap-start rounded-[16px] border px-4 py-2 text-left transition-colors active:scale-[0.98] ${
                      selected
                        ? "border-[var(--gc-blue)]/55 bg-[var(--gc-blue)]/16 text-white"
                        : "border-white/[0.08] bg-white/[0.035] text-white/58"
                    }`}
                    key={detail.activityId ?? `${detail.startedAt}-${label}`}
                    onClick={() => setActiveActivityId(detail.activityId ?? null)}
                    type="button"
                  >
                    <span className="block text-[12px] font-black">{label}</span>
                    <span className="mt-0.5 block text-[10px] font-bold tabular-nums opacity-65">
                      {formatElapsed(detail.elapsedS)}
                    </span>
                  </button>
                );
              })}
            </nav>
          </section>
        ) : null}

        <section className="mt-6">
          <h3 className="mb-3 text-[18px] font-black text-white">
            {t("workoutDetail.detailsTitle")}
          </h3>
          <ActivityMetricGrid metrics={stats} />
        </section>

        {healthMetadata?.workoutEffort ? (
          <section className="mt-4 flex items-center justify-between gap-4 rounded-[24px] border border-white/[0.055] bg-white/[0.045] px-5 py-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.11em] text-white/42">
                {t("workoutDetail.effort")}
              </p>
              <p className="mt-1 text-[22px] font-black text-[var(--gc-blue)]">
                {healthMetadata.workoutEffort.toLocaleString(locale, {
                  maximumFractionDigits: 1,
                })}
                <span className="ml-2 text-[15px] text-white/62">
                  {effortLabel(healthMetadata.workoutEffort, t)}
                </span>
              </p>
            </div>
            <Gauge className="text-[var(--gc-blue)]" size={32} strokeWidth={2.2} />
          </section>
        ) : null}

        {healthMetadata?.heartRateSamples &&
        healthMetadata.heartRateSamples.length >= 2 ? (
          <ActivityHeartRateSection
            average={workout.avgHr}
            labels={{
              title: t("workoutDetail.heartRateTitle"),
              average: t("workoutDetail.averageShort"),
              minimum: t("workoutDetail.minimumShort"),
              maximum: t("workoutDetail.maximumShort"),
            }}
            locale={locale}
            maximum={workout.maxHr ?? null}
            minimum={healthMetadata.minHr}
            samples={healthMetadata.heartRateSamples}
            timeZone={timeZone}
          />
        ) : null}

        {hasConditions || hasContext ? (
          <section className="mt-6 rounded-[24px] border border-white/[0.055] bg-white/[0.035] p-5">
            <div className="flex items-center gap-2">
              <CloudSun className="text-[var(--gc-blue)]" size={18} />
              <h3 className="text-[17px] font-black text-white">
                {t("workoutDetail.contextTitle")}
              </h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
              {healthMetadata?.temperatureC != null ? (
                <ContextValue
                  label={t("workoutDetail.temperature")}
                  value={`${Math.round(healthMetadata.temperatureC)}°C`}
                />
              ) : null}
              {healthMetadata?.humidityPercent != null ? (
                <ContextValue
                  label={t("workoutDetail.humidity")}
                  value={`${Math.round(healthMetadata.humidityPercent)}%`}
                />
              ) : null}
              {healthMetadata?.weatherCondition ? (
                <ContextValue
                  label={t("workoutDetail.weather")}
                  value={humanizeHealthValue(healthMetadata.weatherCondition)}
                />
              ) : null}
              {healthMetadata?.isIndoor != null ? (
                <ContextValue
                  label={t("workoutDetail.environment")}
                  value={t(
                    healthMetadata.isIndoor
                      ? "workoutDetail.indoor"
                      : "workoutDetail.outdoor",
                  )}
                />
              ) : null}
              {healthMetadata?.averageMets != null ? (
                <ContextValue
                  label={t("workoutDetail.averageMets")}
                  value={healthMetadata.averageMets.toLocaleString(locale, {
                    maximumFractionDigits: 1,
                  })}
                />
              ) : null}
              {healthMetadata?.sourceDevice ? (
                <ContextValue
                  label={t("workoutDetail.device")}
                  value={healthMetadata.sourceDevice}
                />
              ) : null}
              {healthMetadata?.workoutBrandName ? (
                <ContextValue
                  label={t("workoutDetail.source")}
                  value={healthMetadata.workoutBrandName}
                />
              ) : null}
            </div>
          </section>
        ) : null}

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

function ContextValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-white/38">
        {label}
      </p>
      <p className="mt-1 break-words text-[14px] font-black text-white/82">
        {value}
      </p>
    </div>
  );
}

function effortLabel(value: number, translate: (key: string) => string) {
  if (value <= 3) return translate("workoutDetail.effortEasy");
  if (value <= 5) return translate("workoutDetail.effortModerate");
  if (value <= 7) return translate("workoutDetail.effortHard");
  return translate("workoutDetail.effortVeryHard");
}

function humanizeHealthValue(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
