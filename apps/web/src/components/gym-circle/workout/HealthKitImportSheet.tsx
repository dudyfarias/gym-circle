"use client";

import {
  Activity,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  HeartPulse,
  MapPinned,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  ComposerActivityContext,
  FinishedWebActivity,
  WebActivityInput,
} from "../social/types";
import {
  HealthKitBridge,
  type HealthKitPermissionState,
  type HealthKitWorkout,
} from "../native/HealthKitBridge";
import { formatElapsed } from "./workoutElapsed";
import { formatDistance } from "./workoutSession";
import { healthKitWorkoutToActivityInput } from "./healthKitImport";

type HealthKitImportSheetProps = {
  open: boolean;
  onClose: () => void;
  onImport: (input: WebActivityInput) => Promise<FinishedWebActivity>;
  onShare: (activity: ComposerActivityContext) => void;
};

type ImportedResult = {
  activity: FinishedWebActivity;
  workout: HealthKitWorkout;
};

export function HealthKitImportSheet({
  open,
  onClose,
  onImport,
  onShare,
}: HealthKitImportSheetProps) {
  const { i18n, t } = useTranslation();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] =
    useState<HealthKitPermissionState>("not-requested");
  const [workouts, setWorkouts] = useState<HealthKitWorkout[]>([]);
  const [selected, setSelected] = useState<HealthKitWorkout | null>(null);
  const [loading, setLoading] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ImportedResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const to = new Date();
      const from = new Date(to);
      from.setDate(from.getDate() - 30);
      setWorkouts(
        await HealthKitBridge.listWorkouts({
          from: from.toISOString(),
          to: to.toISOString(),
          limit: 50,
        }),
      );
    } catch {
      setError(t("healthImport.errors.load"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void (async () => {
      const available = await HealthKitBridge.isAvailable();
      if (!active) return;
      setSelected(null);
      setImported(null);
      setError(null);
      setSupported(available);
      if (!available) {
        setPermission("unsupported");
        return;
      }
      try {
        const state = await HealthKitBridge.permissionState();
        if (!active) return;
        setPermission(state);
        if (state === "granted") await loadWorkouts();
      } catch {
        if (active) setError(t("healthImport.errors.permission"));
      }
    })();
    return () => {
      active = false;
    };
  }, [loadWorkouts, open, t]);

  const requestPermission = useCallback(async () => {
    setRequesting(true);
    setError(null);
    try {
      const state = await HealthKitBridge.requestPermissions();
      setPermission(state);
      if (state === "granted") await loadWorkouts();
      if (state === "denied") setError(t("healthImport.errors.denied"));
    } catch {
      setError(t("healthImport.errors.permission"));
    } finally {
      setRequesting(false);
    }
  }, [loadWorkouts, t]);

  const selectWorkout = useCallback(
    async (workout: HealthKitWorkout) => {
      setLoadingDetails(true);
      setError(null);
      try {
        setSelected(await HealthKitBridge.getWorkout(workout.externalId));
      } catch {
        setSelected(workout);
        setError(t("healthImport.errors.details"));
      } finally {
        setLoadingDetails(false);
      }
    },
    [t],
  );

  const importSelected = useCallback(async () => {
    if (!selected || importing) return;
    setImporting(true);
    setError(null);
    try {
      const activity = await onImport(
        healthKitWorkoutToActivityInput(selected),
      );
      setImported({ activity, workout: selected });
    } catch (caught) {
      setError(
        isDuplicateError(caught)
          ? t("healthImport.errors.duplicate")
          : t("healthImport.errors.import"),
      );
    } finally {
      setImporting(false);
    }
  }, [importing, onImport, selected, t]);

  const selectedMetrics = useMemo(
    () => (selected ? workoutMetrics(selected, t) : []),
    [selected, t],
  );

  if (!open) return null;

  return (
    <div
      aria-label={t("healthImport.title")}
      aria-modal="true"
      className="fixed inset-0 z-[96] flex items-end justify-center bg-black/72 backdrop-blur-md"
      role="dialog"
    >
      <button
        aria-label={t("common.close")}
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        type="button"
      />
      <section className="gc-screen-enter relative flex max-h-[88dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[32px] border border-white/[0.09] bg-[#090b0c] pb-[var(--gc-safe-bottom)] shadow-[0_-30px_90px_rgba(0,0,0,0.75)]">
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-white/18" />
        <header className="flex shrink-0 items-start gap-4 px-5 pb-4 pt-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[#ff375f]/14 text-[#ff5b77]">
            <HeartPulse size={22} strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[21px] font-black leading-tight text-white">
              {t("healthImport.title")}
            </h2>
            <p className="mt-1 text-[12.5px] font-semibold leading-snug text-white/48">
              {t("healthImport.subtitle")}
            </p>
          </div>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.055] text-white/78"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {supported === null ? (
            <LoadingState label={t("healthImport.checking")} />
          ) : !supported || permission === "unsupported" ? (
            <MessageState
              detail={t("healthImport.unsupportedDetail")}
              title={t("healthImport.unsupported")}
            />
          ) : permission === "not-requested" || permission === "denied" ? (
            <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-5">
              <ShieldCheck
                className="text-[var(--gc-brand)]"
                size={28}
                strokeWidth={2.2}
              />
              <h3 className="mt-4 text-[18px] font-black text-white">
                {t("healthImport.permissionTitle")}
              </h3>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-white/52">
                {t("healthImport.permissionDetail")}
              </p>
              <button
                className="gc-pressable mt-5 h-13 w-full rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-[var(--gc-brand-ink)] disabled:opacity-50"
                disabled={requesting}
                onClick={() => void requestPermission()}
                type="button"
              >
                {requesting
                  ? t("healthImport.authorizing")
                  : t("healthImport.authorize")}
              </button>
            </div>
          ) : imported ? (
            <div className="rounded-[26px] border border-[var(--gc-brand)]/24 bg-[var(--gc-brand)]/[0.07] p-5">
              <span className="grid size-12 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]">
                <Check size={24} strokeWidth={3} />
              </span>
              <h3 className="mt-4 text-[20px] font-black text-white">
                {t("healthImport.successTitle")}
              </h3>
              <p className="mt-1 text-[13px] font-semibold text-white/52">
                {t("healthImport.successDetail", {
                  source: imported.workout.sourceApp,
                })}
              </p>
              <button
                className="gc-pressable mt-5 h-13 w-full rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-[var(--gc-brand-ink)]"
                onClick={() => {
                  onShare(
                    composerActivity(imported.activity, imported.workout),
                  );
                }}
                type="button"
              >
                {t("healthImport.share")}
              </button>
              <button
                className="gc-pressable mt-2 h-12 w-full rounded-full border border-white/[0.09] text-[13px] font-black text-white/78"
                onClick={onClose}
                type="button"
              >
                {t("healthImport.done")}
              </button>
            </div>
          ) : selected ? (
            <div>
              <button
                className="gc-pressable mb-3 text-[12px] font-black text-[var(--gc-brand)]"
                onClick={() => setSelected(null)}
                type="button"
              >
                {t("healthImport.back")}
              </button>
              <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.035] p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#ff5b77]">
                  {selected.sourceApp}
                </p>
                <h3 className="mt-2 text-[21px] font-black text-white">
                  {t(`healthImport.types.${selected.workoutType}`)}
                </h3>
                <p className="mt-1 text-[12px] font-bold text-white/44">
                  {formatWorkoutDate(selected.startedAt, i18n.language)}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {selectedMetrics.map((metric) => (
                    <div
                      className="rounded-[18px] bg-black/28 px-3 py-3"
                      key={metric.label}
                    >
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/38">
                        {metric.label}
                      </p>
                      <p className="mt-1 text-[17px] font-black text-white">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-[11.5px] font-semibold leading-relaxed text-white/42">
                  {t("healthImport.reviewPrivacy")}
                </p>
                <button
                  className="gc-pressable mt-5 h-13 w-full rounded-full bg-[var(--gc-brand)] text-[14px] font-black text-[var(--gc-brand-ink)] disabled:opacity-50"
                  disabled={importing || loadingDetails}
                  onClick={() => void importSelected()}
                  type="button"
                >
                  {importing
                    ? t("healthImport.importing")
                    : t("healthImport.import")}
                </button>
              </div>
            </div>
          ) : loading ? (
            <LoadingState label={t("healthImport.loading")} />
          ) : workouts.length === 0 ? (
            <MessageState
              action={
                <button
                  className="gc-pressable mt-4 inline-flex items-center gap-2 rounded-full border border-white/[0.1] px-4 py-2 text-[12px] font-black text-white/78"
                  onClick={() => void loadWorkouts()}
                  type="button"
                >
                  <RefreshCw size={14} />
                  {t("healthImport.refresh")}
                </button>
              }
              detail={t("healthImport.emptyDetail")}
              title={t("healthImport.empty")}
            />
          ) : (
            <div className="space-y-2">
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-white/38">
                {t("healthImport.recent")}
              </p>
              {workouts.map((workout) => (
                <button
                  className="gc-pressable flex w-full items-center gap-3 rounded-[21px] border border-white/[0.07] bg-white/[0.03] p-3.5 text-left"
                  key={workout.externalId}
                  onClick={() => void selectWorkout(workout)}
                  type="button"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[#ff375f]/12 text-[#ff5b77]">
                    <Activity size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-black text-white">
                      {t(`healthImport.types.${workout.workoutType}`)}
                    </span>
                    <span className="mt-0.5 block truncate text-[11.5px] font-bold text-white/45">
                      {workout.sourceApp} · {formatWorkoutDate(workout.startedAt, i18n.language)}
                    </span>
                    <span className="mt-1 block text-[11px] font-bold text-white/58">
                      {formatElapsed(workout.elapsedS)}
                      {workout.distanceM
                        ? ` · ${formatDistance(workout.distanceM)} km`
                        : ""}
                    </span>
                  </span>
                  <ChevronRight className="shrink-0 text-white/30" size={18} />
                </button>
              ))}
            </div>
          )}

          {error ? (
            <p className="mt-3 rounded-[17px] border border-[#ff375f]/22 bg-[#ff375f]/10 px-4 py-3 text-[12px] font-bold leading-snug text-[#ff708b]">
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="grid min-h-52 place-items-center text-center">
      <div>
        <RefreshCw
          className="mx-auto animate-spin text-[var(--gc-brand)]"
          size={24}
        />
        <p className="mt-3 text-[12px] font-bold text-white/48">{label}</p>
      </div>
    </div>
  );
}

function MessageState({
  action,
  detail,
  title,
}: {
  action?: React.ReactNode;
  detail: string;
  title: string;
}) {
  return (
    <div className="rounded-[25px] border border-white/[0.08] bg-white/[0.035] p-5 text-center">
      <HeartPulse className="mx-auto text-white/35" size={28} />
      <h3 className="mt-3 text-[17px] font-black text-white">{title}</h3>
      <p className="mx-auto mt-1 max-w-[320px] text-[12.5px] font-semibold leading-relaxed text-white/46">
        {detail}
      </p>
      {action}
    </div>
  );
}

function workoutMetrics(
  workout: HealthKitWorkout,
  t: (key: string) => string,
) {
  const metrics = [
    {
      icon: Clock3,
      label: t("healthImport.metrics.duration"),
      value: formatElapsed(workout.elapsedS),
    },
  ];
  if (workout.distanceM) {
    metrics.push({
      icon: MapPinned,
      label: t("healthImport.metrics.distance"),
      value: `${formatDistance(workout.distanceM)} km`,
    });
  }
  if (workout.activeCalories) {
    metrics.push({
      icon: Flame,
      label: t("healthImport.metrics.calories"),
      value: `${Math.round(workout.activeCalories)} kcal`,
    });
  }
  if (workout.avgHr) {
    metrics.push({
      icon: HeartPulse,
      label: t("healthImport.metrics.heartRate"),
      value: `${Math.round(workout.avgHr)} bpm`,
    });
  }
  return metrics;
}

function formatWorkoutDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function composerActivity(
  activity: FinishedWebActivity,
  workout: HealthKitWorkout,
): ComposerActivityContext {
  const input = healthKitWorkoutToActivityInput(workout);
  return {
    id: activity.id,
    activityType: input.activityType,
    elapsedS: activity.elapsedS,
    movingS: input.movingS,
    distanceM: input.distanceM,
    elevationGainM: input.elevationGainM,
    route: input.route,
    workoutDate: activity.workoutDate,
    initialComposerStep: "details",
  };
}

function isDuplicateError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code === "23505" || message.includes("activities_user_external_uidx");
}
