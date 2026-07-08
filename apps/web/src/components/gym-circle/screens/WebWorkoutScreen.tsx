"use client";

import {
  type ComponentType,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  Bike,
  ChevronDown,
  Dumbbell,
  Footprints,
  Gauge,
  Info,
  MapPinned,
  Minus,
  MoveRight,
  Pause,
  Play,
  Plus,
  Square,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmSheet } from "../ConfirmSheet";
import type {
  ComposerActivityContext,
  FinishedWebActivity,
  StrengthSet,
  WebActivityInput,
  WorkoutPlan,
} from "../social/types";
import {
  REST_TIMER_INITIAL,
  restTimerReducer,
} from "../workout/restTimer";
import { formatElapsed } from "../workout/workoutElapsed";
import { WorkoutPlansFabControlled } from "../workout/WorkoutPlansFab";
import {
  exerciseCatalogInfo,
  techniqueCatalogInfo,
  WorkoutCatalogInfoSheet,
  type WorkoutCatalogInfo,
} from "../workout/WorkoutCatalogSheets";
import { useWorkoutCatalog } from "../workout/useWorkoutCatalog";
import { useWorkoutPlans } from "../workout/useWorkoutPlans";
import {
  appendWorkoutRoutePoint,
  clearStoredWorkoutSession,
  formatAveragePace,
  formatAverageSpeed,
  formatDistance,
  pauseWorkoutSession,
  readStoredWorkoutSession,
  resumeWorkoutSession,
  type StoredWorkoutSession,
  type WorkoutRoutePoint,
  workoutElapsedSeconds,
  workoutPausedSeconds,
  workoutRouteCoordinates,
  writeStoredWorkoutSession,
} from "../workout/workoutSession";

type WorkoutType = WebActivityInput["activityType"];
type RouteWorkoutType = Extract<WorkoutType, "run" | "walk" | "ride">;
type GpsStatus = "off" | "requesting" | "strong" | "weak" | "denied";
type GpsEngine = "checking" | "native" | "web";

type WebWorkoutScreenProps = {
  open: boolean;
  onClose: () => void;
  onFinish: (input: WebActivityInput) => Promise<FinishedWebActivity>;
  onCompose: (activity: ComposerActivityContext) => void;
  onSessionChange?: (active: boolean) => void;
};

type StrengthExerciseGroup = {
  completed: boolean;
  completedCount: number;
  exerciseId: string | null;
  key: string;
  name: string;
  sets: Array<{ index: number; set: StrengthSet }>;
  techniqueId: string | null;
  techniqueName: string | null;
  techniqueNotes: string | null;
  totalCount: number;
};

function newStrengthSetFromTemplate(
  template?: StrengthSet | null,
): StrengthSet {
  return {
    reps: template?.reps ?? 0,
    weightKg: null,
    exercise: template?.exercise ?? null,
    exerciseId: template?.exerciseId ?? null,
    targetKind: template?.targetKind ?? null,
    durationSeconds: template?.durationSeconds ?? null,
    techniqueId: template?.techniqueId ?? null,
    techniqueName: template?.techniqueName ?? null,
    techniqueNotes: template?.techniqueNotes ?? null,
  };
}

const TYPE_CARDS: Array<{
  type: WorkoutType;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}> = [
  { type: "strength", icon: Dumbbell },
  { type: "run", icon: MoveRight },
  { type: "walk", icon: Footprints },
  { type: "ride", icon: Bike },
  { type: "other", icon: Play },
];

function isRouteWorkout(type: WorkoutType): type is RouteWorkoutType {
  return type === "run" || type === "walk" || type === "ride";
}

function MetricTile({
  label,
  suffix,
  value,
}: {
  label: string;
  suffix?: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-white/42">
        {label}
      </p>
      <p className="mt-1 truncate text-[29px] font-black leading-none tracking-[-0.04em] text-white tabular-nums">
        {value}
        {suffix ? (
          <span className="ml-1 text-[12px] font-black tracking-normal text-white/54">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

export function WebWorkoutScreen({
  open,
  onClose,
  onFinish,
  onCompose,
  onSessionChange,
}: WebWorkoutScreenProps) {
  const { i18n, t } = useTranslation();
  const [stage, setStage] = useState<"pick" | "live">("pick");
  const [session, setSession] = useState<StoredWorkoutSession | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rest, dispatchRest] = useReducer(restTimerReducer, REST_TIMER_INITIAL);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("off");
  const [gpsEngine, setGpsEngine] = useState<GpsEngine>("checking");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [setsInputFocused, setSetsInputFocused] = useState(false);
  // Séries de musculação da sessão atual (só treino de força). Linhas
  // editáveis (reps × carga); treino salvo pré-carrega exercício + reps alvo.
  const [strengthSets, setStrengthSets] = useState<StrengthSet[]>([]);
  const [catalogInfo, setCatalogInfo] = useState<WorkoutCatalogInfo | null>(null);
  const workoutCatalog = useWorkoutCatalog();
  const {
    exercises: catalogExercises,
    techniques,
    muscleGroups,
  } = workoutCatalog;
  const workoutPlansController = useWorkoutPlans(open);
  const { plans: savedWorkoutPlans, touchPlan } = workoutPlansController;
  const quickWorkoutPlans = useMemo(
    () =>
      savedWorkoutPlans
        .filter((plan) => plan.exercises.length > 0)
        .slice(0, 5),
    [savedWorkoutPlans],
  );
  const hasSession = session !== null;
  const sessionPausedAtMs = session?.pausedAtMs;
  const nativeSessionAttachedRef = useRef(false);
  const setsSectionRef = useRef<HTMLElement>(null);
  const exerciseCarouselRef = useRef<HTMLDivElement>(null);
  const exerciseCardRefs = useRef<Array<HTMLElement | null>>([]);
  const lastAutoAdvancedExerciseKeyRef = useRef<string | null>(null);
  const [activeStrengthExerciseIndex, setActiveStrengthExerciseIndex] =
    useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const stored = readStoredWorkoutSession();
      setFinishError(null);
      setFinishConfirmOpen(false);
      setDiscardConfirmOpen(false);
      setNowMs(Date.now());
      if (stored) {
        setSession(stored);
        setStage("live");
        onSessionChange?.(true);
      } else {
        setSession(null);
        setStage("pick");
        dispatchRest({ type: "reset" });
        onSessionChange?.(false);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [onSessionChange, open]);

  useEffect(() => {
    if (!open || stage !== "live" || !hasSession) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      if (sessionPausedAtMs === null) dispatchRest({ type: "tick" });
    }, 1_000);
    return () => window.clearInterval(id);
  }, [hasSession, open, sessionPausedAtMs, stage]);

  const persistSession = useCallback(
    (
      updater: (
        current: StoredWorkoutSession,
      ) => StoredWorkoutSession,
    ) => {
      setSession((current) => {
        if (!current) return current;
        const next = updater(current);
        if (next === current) return current;
        writeStoredWorkoutSession(next);
        return next;
      });
    },
    [],
  );

  const applyNativeSnapshot = useCallback(
    (snapshot: {
      distanceM: number;
      movingS: number;
      elevationGainM: number;
    }) => {
      setGpsStatus("strong");
      persistSession((current) => ({
        ...current,
        distanceM: snapshot.distanceM,
        movingS: snapshot.movingS,
        elevationGainM: snapshot.elevationGainM,
      }));
    },
    [persistSession],
  );

  useEffect(() => {
    let cancelled = false;
    let removeListener: (() => Promise<void>) | undefined;
    void import("../native/WorkoutLocationBridge").then(
      async ({ WorkoutLocationBridge }) => {
        const available = await WorkoutLocationBridge.isAvailable();
        if (cancelled) return;
        if (!available) {
          setGpsEngine("web");
          return;
        }
        setGpsEngine("native");
        const handle = await WorkoutLocationBridge.addUpdateListener(
          applyNativeSnapshot,
        );
        if (cancelled) {
          await handle.remove();
          return;
        }
        removeListener = handle.remove;
      },
    );
    return () => {
      cancelled = true;
      if (removeListener) void removeListener();
    };
  }, [applyNativeSnapshot]);

  useEffect(() => {
    const routeActivityType =
      session && isRouteWorkout(session.activityType)
        ? session.activityType
        : null;
    if (
      gpsEngine !== "native" ||
      stage !== "live" ||
      !session ||
      !routeActivityType ||
      nativeSessionAttachedRef.current
    ) {
      return;
    }
    nativeSessionAttachedRef.current = true;
    void import("../native/WorkoutLocationBridge").then(
      async ({ WorkoutLocationBridge }) => {
        try {
          const snapshot = await WorkoutLocationBridge.snapshot();
          applyNativeSnapshot(snapshot);
          if (
            (!snapshot.hasSession || !snapshot.isRecording) &&
            session.pausedAtMs === null
          ) {
            applyNativeSnapshot(
              await WorkoutLocationBridge.resume(routeActivityType),
            );
          }
        } catch {
          nativeSessionAttachedRef.current = false;
          setGpsEngine("web");
        }
      },
    );
  }, [applyNativeSnapshot, gpsEngine, session, stage]);

  useEffect(() => {
    const routeActivityType = session?.activityType;
    const pausedAtMs = session?.pausedAtMs;
    if (
      gpsEngine !== "web" ||
      stage !== "live" ||
      !routeActivityType ||
      !isRouteWorkout(routeActivityType)
    ) {
      return;
    }
    if (pausedAtMs !== null) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const statusId = window.setTimeout(() => setGpsStatus("denied"), 0);
      return () => window.clearTimeout(statusId);
    }

    const statusId = window.setTimeout(() => setGpsStatus("requesting"), 0);
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        setGpsStatus(accuracy <= 30 ? "strong" : "weak");
        if (accuracy > 100) return;

        const point: WorkoutRoutePoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          altitude:
            typeof position.coords.altitude === "number"
              ? position.coords.altitude
              : null,
          accuracyM: position.coords.accuracy,
          altitudeAccuracyM:
            typeof position.coords.altitudeAccuracy === "number"
              ? position.coords.altitudeAccuracy
              : null,
          timestampMs: position.timestamp || Date.now(),
        };

        persistSession((current) => appendWorkoutRoutePoint(current, point));
      },
      (error) => {
        setGpsStatus(error.code === error.PERMISSION_DENIED ? "denied" : "weak");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3_000,
        timeout: 15_000,
      },
    );
    return () => {
      window.clearTimeout(statusId);
      navigator.geolocation.clearWatch(watchId);
    };
  }, [
    gpsEngine,
    persistSession,
    session?.activityType,
    session?.pausedAtMs,
    stage,
  ]);

  const startWorkout = useCallback(
    (activityType: WorkoutType) => {
      const next: StoredWorkoutSession = {
        version: 3,
        startedAtMs: Date.now(),
        activityType,
        pausedAtMs: null,
        pausedTotalMs: 0,
        distanceM: 0,
        movingS: 0,
        elevationGainM: 0,
        restCount: 0,
        routePoints: [],
        lastRoutePoint: null,
      };
      writeStoredWorkoutSession(next);
      setSession(next);
      setNowMs(next.startedAtMs);
      setStage("live");
      dispatchRest({ type: "reset" });
      onSessionChange?.(true);
      navigator.vibrate?.(60);
      nativeSessionAttachedRef.current = false;
      if (isRouteWorkout(activityType) && gpsEngine === "native") {
        nativeSessionAttachedRef.current = true;
        void import("../native/WorkoutLocationBridge").then(
          async ({ WorkoutLocationBridge }) => {
            try {
              applyNativeSnapshot(await WorkoutLocationBridge.start(activityType));
            } catch {
              nativeSessionAttachedRef.current = false;
              setGpsEngine("web");
            }
          },
        );
      }
    },
    [applyNativeSnapshot, gpsEngine, onSessionChange],
  );

  const startWorkoutPlan = useCallback(
    (plan: WorkoutPlan) => {
      // Cada exercício vira N linhas (séries alvo) já rotuladas; a pessoa
      // preenche reps × carga durante a sessão.
      const seeded: StrengthSet[] = plan.exercises.flatMap((ex) => {
        const count = Math.min(Math.max(ex.sets ?? 1, 1), 12);
        return Array.from({ length: count }, () => ({
          reps: ex.reps ?? 0,
          weightKg: null as number | null,
          exercise: ex.name,
          exerciseId: ex.exerciseId ?? null,
          targetKind: ex.targetKind ?? "reps",
          durationSeconds: ex.durationSeconds ?? null,
          techniqueId: ex.techniqueId ?? null,
          techniqueName: ex.techniqueName ?? null,
          techniqueNotes: ex.techniqueNotes ?? null,
        }));
      });
      void touchPlan(plan.id).catch(() => undefined);
      setStrengthSets(seeded);
      startWorkout("strength");
    },
    [startWorkout, touchPlan],
  );

  const togglePause = useCallback(() => {
    if (!session) return;
    const routeActivityType = isRouteWorkout(session.activityType)
      ? session.activityType
      : null;
    const actionNow = Date.now();
    if (session.pausedAtMs === null) {
      persistSession((current) => pauseWorkoutSession(current, actionNow));
      if (routeActivityType && gpsEngine === "native") {
        void import("../native/WorkoutLocationBridge").then(
          ({ WorkoutLocationBridge }) => WorkoutLocationBridge.pause(),
        );
      }
      if (rest.status === "running") dispatchRest({ type: "pause" });
    } else {
      persistSession((current) => resumeWorkoutSession(current, actionNow));
      if (routeActivityType && gpsEngine === "native") {
        void import("../native/WorkoutLocationBridge").then(
          ({ WorkoutLocationBridge }) =>
            WorkoutLocationBridge.resume(routeActivityType),
        );
      }
      if (rest.status === "paused") dispatchRest({ type: "resume" });
    }
    setNowMs(actionNow);
    navigator.vibrate?.(45);
  }, [gpsEngine, persistSession, rest.status, session]);

  const handleFinish = useCallback(async () => {
    if (!session || finishing) return;
    setFinishing(true);
    setFinishError(null);
    setFinishConfirmOpen(false);
    try {
      const endedMs = Date.now();
      const elapsedS = workoutElapsedSeconds(session, endedMs);
      let nativeSummary:
        | {
            distanceM: number;
            movingS: number;
            elevationGainM: number;
            route: number[][];
          }
        | undefined;
      if (isRouteWorkout(session.activityType) && gpsEngine === "native") {
        const { WorkoutLocationBridge } = await import(
          "../native/WorkoutLocationBridge"
        );
        nativeSummary = await WorkoutLocationBridge.stop();
      }
      const activity = await onFinish({
        activityType: session.activityType,
        startedAt: new Date(session.startedAtMs).toISOString(),
        endedAt: new Date(endedMs).toISOString(),
        elapsedS,
        movingS: isRouteWorkout(session.activityType)
          ? Math.round(nativeSummary?.movingS ?? session.movingS)
          : elapsedS,
        distanceM: isRouteWorkout(session.activityType)
          ? (nativeSummary?.distanceM ?? session.distanceM)
          : null,
        elevationGainM: isRouteWorkout(session.activityType)
          ? (nativeSummary?.elevationGainM ?? session.elevationGainM)
          : null,
        route: isRouteWorkout(session.activityType)
          ? (nativeSummary?.route ?? workoutRouteCoordinates(session))
          : null,
        strengthSets:
          session.activityType === "strength" && strengthSets.length > 0
            ? strengthSets
            : null,
      });
      clearStoredWorkoutSession();
      setSession(null);
      setStage("pick");
      setStrengthSets([]);
      dispatchRest({ type: "reset" });
      onSessionChange?.(false);
      nativeSessionAttachedRef.current = false;
      onCompose({
        id: activity.id,
        activityType: session.activityType,
        elapsedS: activity.elapsedS,
        movingS: isRouteWorkout(session.activityType)
          ? Math.round(nativeSummary?.movingS ?? session.movingS)
          : activity.elapsedS,
        distanceM: isRouteWorkout(session.activityType)
          ? (nativeSummary?.distanceM ?? session.distanceM)
          : null,
        elevationGainM: isRouteWorkout(session.activityType)
          ? (nativeSummary?.elevationGainM ?? session.elevationGainM)
          : null,
        route: isRouteWorkout(session.activityType)
          ? (nativeSummary?.route ?? workoutRouteCoordinates(session))
          : null,
        workoutDate: activity.workoutDate,
      });
    } catch (error) {
      setFinishError(
        error instanceof Error ? error.message : t("workout.errors.finish"),
      );
    } finally {
      setFinishing(false);
    }
  }, [
    finishing,
    gpsEngine,
    onCompose,
    onFinish,
    onSessionChange,
    session,
    strengthSets,
    t,
  ]);

  const handleDiscard = useCallback(() => {
    clearStoredWorkoutSession();
    dispatchRest({ type: "reset" });
    setSession(null);
    setStrengthSets([]);
    setDiscardConfirmOpen(false);
    onSessionChange?.(false);
    nativeSessionAttachedRef.current = false;
    if (
      session &&
      isRouteWorkout(session.activityType) &&
      gpsEngine === "native"
    ) {
      void import("../native/WorkoutLocationBridge").then(
        ({ WorkoutLocationBridge }) => WorkoutLocationBridge.stop(),
      );
    }
    onClose();
  }, [gpsEngine, onClose, onSessionChange, session]);

  const startRest = useCallback(() => {
    if (!session || session.pausedAtMs !== null) return;
    dispatchRest({ type: "start" });
    persistSession((current) => ({
      ...current,
      restCount: current.restCount + 1,
    }));
    navigator.vibrate?.(40);
  }, [persistSession, session]);

  const addStrengthSet = useCallback(() => {
    setStrengthSets((prev) => [
      ...prev,
      newStrengthSetFromTemplate(prev[prev.length - 1]),
    ]);
    // O dock de pausar/encerrar é fixo. Leva a nova linha ao centro para que
    // ela nunca nasça escondida atrás dos controles em telas estreitas.
    window.requestAnimationFrame(() => {
      setsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }, []);

  const addStrengthSetForGroup = useCallback(
    (group: StrengthExerciseGroup) => {
      setStrengthSets((prev) => {
        const lastEntry = group.sets[group.sets.length - 1];
        const template = lastEntry ? prev[lastEntry.index] : null;
        const insertAt =
          group.sets.length > 0
            ? Math.max(...group.sets.map((entry) => entry.index)) + 1
            : prev.length;
        const nextSet = newStrengthSetFromTemplate(template);
        return [...prev.slice(0, insertAt), nextSet, ...prev.slice(insertAt)];
      });
      window.requestAnimationFrame(() => {
        exerciseCardRefs.current[activeStrengthExerciseIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      });
    },
    [activeStrengthExerciseIndex],
  );

  const updateStrengthSetReps = useCallback((index: number, raw: string) => {
    const value = raw.replace(/[^0-9]/g, "");
    setStrengthSets((prev) =>
      prev.map((set, i) =>
        i === index
          ? { ...set, reps: Number.parseInt(value, 10) || 0 }
          : set,
      ),
    );
  }, []);

  const updateStrengthSetWeight = useCallback((index: number, raw: string) => {
    const value = raw.replace(/[^0-9.,]/g, "");
    const weight = Number.parseFloat(value.replace(",", "."));
    setStrengthSets((prev) =>
      prev.map((set, i) =>
        i === index
          ? { ...set, weightKg: Number.isFinite(weight) ? weight : null }
          : set,
      ),
    );
  }, []);

  const removeStrengthSet = useCallback((index: number) => {
    setStrengthSets((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleStrengthExerciseCarouselScroll = useCallback(() => {
    const scroller = exerciseCarouselRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let nextIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;
    exerciseCardRefs.current.forEach((card, index) => {
      if (!card) return;
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(center - cardCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        nextIndex = index;
      }
    });
    setActiveStrengthExerciseIndex(nextIndex);
  }, []);

  const handleStrengthSetInputBlur = useCallback(() => {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement &&
        active.dataset.workoutSetInput === "true"
      ) {
        return;
      }
      setSetsInputFocused(false);
    }, 0);
  }, []);

  const openExerciseInfo = useCallback(
    (exerciseId: string | null) => {
      if (!exerciseId) return;
      const exercise = catalogExercises.find((item) => item.id === exerciseId);
      if (!exercise) return;
      const group = muscleGroups.find(
        (item) => item.slug === exercise.primaryMuscleGroupSlug,
      );
      setCatalogInfo(
        exerciseCatalogInfo(
          exercise,
          i18n.language,
          i18n.language.startsWith("en") ? group?.nameEn : group?.namePt,
        ),
      );
    },
    [catalogExercises, i18n.language, muscleGroups],
  );

  const openTechniqueInfo = useCallback(
    (techniqueId: string | null) => {
      if (!techniqueId) return;
      const technique = techniques.find((item) => item.id === techniqueId);
      if (technique) {
        setCatalogInfo(techniqueCatalogInfo(technique, i18n.language));
      }
    },
    [i18n.language, techniques],
  );

  const elapsedS = session ? workoutElapsedSeconds(session, nowMs) : 0;
  const pausedS = session ? workoutPausedSeconds(session, nowMs) : 0;
  const isPaused = Boolean(session && session.pausedAtMs !== null);
  const startedTime = useMemo(() => {
    if (!session) return "--";
    return new Intl.DateTimeFormat(i18n.language, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(session.startedAtMs));
  }, [i18n.language, session]);
  const metricItems = useMemo<
    Array<{ label: string; value: string; suffix?: string }>
  >(() => {
    if (!session) return [];
    if (isRouteWorkout(session.activityType)) {
      return [
        {
          label: t("workout.metrics.distance"),
          value: formatDistance(session.distanceM),
          suffix: "km",
        },
        session.activityType === "ride"
          ? {
              label: t("workout.metrics.speed"),
              value: formatAverageSpeed(elapsedS, session.distanceM),
              suffix: "km/h",
            }
          : {
              label: t("workout.metrics.pace"),
              value: formatAveragePace(elapsedS, session.distanceM),
              suffix: "/km",
            },
        {
          label: t("workout.metrics.elevation"),
          value: Math.round(session.elevationGainM).toString(),
          suffix: "m",
        },
      ];
    }
    return [
      {
        label: t("workout.metrics.started"),
        value: startedTime,
      },
      {
        label:
          session.activityType === "strength"
            ? t("workout.metrics.rests")
            : t("workout.metrics.paused"),
        value:
          session.activityType === "strength"
            ? session.restCount.toString()
            : formatElapsed(pausedS),
      },
      {
        label: t("workout.metrics.totalCalories"),
        value: "—",
      },
    ];
  }, [elapsedS, pausedS, session, startedTime, t]);

  const strengthExerciseGroups = useMemo<StrengthExerciseGroup[]>(() => {
    const groups: Array<
      Omit<
        StrengthExerciseGroup,
        "completed" | "completedCount" | "totalCount"
      >
    > = [];

    strengthSets.forEach((set, index) => {
      const name = set.exercise?.trim() || t("workout.sets.untitledExercise");
      const exerciseId = set.exerciseId ?? null;
      const techniqueId = set.techniqueId ?? null;
      const previous = groups[groups.length - 1];
      if (
        previous &&
        previous.name === name &&
        previous.exerciseId === exerciseId &&
        previous.techniqueId === techniqueId
      ) {
        previous.sets.push({ index, set });
        return;
      }
      groups.push({
        exerciseId,
        key: `${exerciseId ?? name}-${techniqueId ?? "plain"}-${index}`,
        name,
        sets: [{ index, set }],
        techniqueId,
        techniqueName: set.techniqueName ?? null,
        techniqueNotes: set.techniqueNotes ?? null,
      });
    });

    return groups.map((group) => {
      const completedCount = group.sets.filter(
        ({ set }) => set.weightKg !== null,
      ).length;
      return {
        ...group,
        completed: group.sets.length > 0 && completedCount === group.sets.length,
        completedCount,
        totalCount: group.sets.length,
      };
    });
  }, [strengthSets, t]);

  const safeActiveStrengthExerciseIndex =
    strengthExerciseGroups.length > 0
      ? Math.min(
          activeStrengthExerciseIndex,
          strengthExerciseGroups.length - 1,
        )
      : 0;

  useEffect(() => {
    if (session?.activityType !== "strength") return;
    const currentGroup = strengthExerciseGroups[safeActiveStrengthExerciseIndex];
    if (!currentGroup?.completed) return;
    if (safeActiveStrengthExerciseIndex >= strengthExerciseGroups.length - 1) {
      return;
    }
    if (lastAutoAdvancedExerciseKeyRef.current === currentGroup.key) return;
    lastAutoAdvancedExerciseKeyRef.current = currentGroup.key;
    const nextIndex = safeActiveStrengthExerciseIndex + 1;
    const timeout = window.setTimeout(() => {
      exerciseCardRefs.current[nextIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
      setActiveStrengthExerciseIndex(nextIndex);
    }, 240);
    return () => window.clearTimeout(timeout);
  }, [
    safeActiveStrengthExerciseIndex,
    session?.activityType,
    strengthExerciseGroups,
  ]);

  if (!open) return null;

  const restProgress =
    rest.presetS > 0
      ? Math.max(0, Math.min(100, (rest.remainingS / rest.presetS) * 100))
      : 0;
  const gpsLabel =
    gpsStatus === "strong"
      ? t("workout.gps.strong")
      : gpsStatus === "weak"
        ? t("workout.gps.weak")
        : gpsStatus === "denied"
          ? t("workout.gps.off")
          : t("workout.gps.searching");
  const filledStrengthSetCount = strengthSets.filter(
    (set) => set.weightKg !== null,
  ).length;

  return (
    <>
      {catalogInfo ? (
        <WorkoutCatalogInfoSheet
          info={catalogInfo}
          onClose={() => setCatalogInfo(null)}
        />
      ) : null}
      <div
        aria-label={t("workout.inProgress")}
        aria-modal="true"
        className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-black"
        role="dialog"
      >
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+18px)] pt-[calc(var(--gc-safe-top)+16px)]">
        {stage === "pick" ? (
          <>
            <header className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-[27px] font-black leading-tight text-white">
                  {t("workout.pickTitle")}
                </h2>
                <p className="mt-1 max-w-[330px] text-[13px] font-semibold leading-snug text-white/48">
                  {t("workout.pickHint")}
                </p>
              </div>
              <button
                aria-label={t("common.close")}
                className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-[#17191b] text-white/86"
                onClick={onClose}
                type="button"
              >
                <X size={18} strokeWidth={2.4} />
              </button>
            </header>
            <div className="mt-7 space-y-2.5 pb-6">
              {quickWorkoutPlans.length > 0 ? (
                <section className="mb-4">
                  <p className="mb-2 px-1 text-[10.5px] font-black uppercase tracking-[0.16em] text-white/38">
                    {t("workout.saved.quickTitle")}
                  </p>
                  <div className="space-y-2.5">
                    {quickWorkoutPlans.map((plan) => (
                      <button
                        className="gc-pressable flex w-full min-w-0 items-center gap-3.5 rounded-[22px] border border-[var(--gc-brand)]/16 bg-[linear-gradient(135deg,rgba(92,232,255,0.11),rgba(11,13,14,0.98)_44%,rgba(48,213,255,0.05))] p-3.5 text-left shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
                        key={plan.id}
                        onClick={() => startWorkoutPlan(plan)}
                        type="button"
                      >
                        <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                          <Dumbbell size={22} strokeWidth={2.4} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-black text-white">
                            {plan.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] font-bold leading-snug text-white/42">
                            {plan.exercises
                              .slice(0, 3)
                              .map((exercise) => exercise.name)
                              .join(" · ") || t("workoutPlans.noExercises")}
                          </span>
                        </span>
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]">
                          <Play className="ml-0.5" fill="currentColor" size={16} />
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}
              {TYPE_CARDS.map(({ type, icon: Icon }) => (
                <button
                  className="gc-pressable flex w-full items-center gap-3.5 rounded-[22px] border border-white/[0.07] bg-[#0b1012] p-3.5 text-left"
                  key={type}
                  onClick={() => startWorkout(type)}
                  type="button"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                    <Icon size={22} strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-black text-white">
                      {t(`workout.types.${type}`)}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-bold leading-snug text-white/42">
                      {t(`workout.typeHints.${type}`)}
                    </span>
                  </span>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]">
                    <Play className="ml-0.5" fill="currentColor" size={16} />
                  </span>
                </button>
              ))}
            </div>
            <WorkoutPlansFabControlled
              catalog={workoutCatalog}
              onStartPlan={startWorkoutPlan}
              plansController={workoutPlansController}
            />
          </>
        ) : session ? (
          <>
            <header className="flex items-center gap-3">
              <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-[#17191b] px-3.5 py-2 text-[14px] font-black text-white">
                {session.activityType === "strength" ? (
                  <Dumbbell className="text-[var(--gc-brand)]" size={15} />
                ) : (
                  <Footprints className="text-[var(--gc-brand)]" size={15} />
                )}
                <span className="truncate">
                  {t(`workout.types.${session.activityType}`)}
                </span>
              </span>
              <div className="ml-auto flex min-w-0 flex-col items-end gap-1">
                <span
                  className={[
                    "text-[11px] font-black uppercase tracking-[0.12em]",
                    isPaused ? "text-[#ffd60a]" : "text-[var(--gc-brand)]",
                  ].join(" ")}
                >
                  {isPaused ? t("workout.paused") : t("workout.active")}
                </span>
                {isRouteWorkout(session.activityType) ? (
                  <span
                    className={[
                      "inline-flex items-center gap-1 text-[10px] font-black",
                      gpsStatus === "strong"
                        ? "text-[var(--gc-brand)]"
                        : "text-white/42",
                    ].join(" ")}
                  >
                    <MapPinned size={12} />
                    {gpsLabel}
                  </span>
                ) : null}
              </div>
            </header>

            <main className="flex flex-1 flex-col pb-[150px]">
              <section className="pt-10 text-center">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/42">
                  {t("workout.elapsed")}
                </p>
                <p
                  aria-label={`${t("workout.elapsed")}: ${formatElapsed(elapsedS)}`}
                  className={[
                    "mt-1 text-[78px] font-black leading-none tracking-[-0.065em] tabular-nums",
                    isPaused ? "text-[#ffd60a]" : "text-[var(--gc-brand)]",
                  ].join(" ")}
                >
                  {formatElapsed(elapsedS)}
                </p>
              </section>

              <section className="mt-8 grid grid-cols-3 gap-x-5 border-y border-white/[0.07] py-5">
                {metricItems.map((item) => (
                  <MetricTile
                    key={item.label}
                    label={item.label}
                    suffix={item.suffix}
                    value={item.value}
                  />
                ))}
              </section>

              {session.activityType === "strength" ? (
                <section className="-mx-5 mt-5 scroll-mt-5" ref={setsSectionRef}>
                  <div className="flex items-end justify-between gap-3 px-5">
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--gc-brand)]">
                        {t("workout.sets.title")}
                      </p>
                      <h3 className="mt-1 truncate text-[22px] font-black leading-tight text-white">
                        {t("workout.sets.guideTitle")}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/[0.075] px-3 py-1.5 text-[10.5px] font-black text-white/62">
                      {t("workout.sets.progress", {
                        done: filledStrengthSetCount,
                        total: strengthSets.length,
                      })}
                    </span>
                  </div>

                  <div
                    className="gc-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-5 pb-2"
                    data-gc-no-screen-swipe
                    onScroll={handleStrengthExerciseCarouselScroll}
                    ref={exerciseCarouselRef}
                  >
                    {strengthExerciseGroups.length === 0 ? (
                      <article className="w-[88%] shrink-0 snap-center rounded-[28px] border border-[var(--gc-brand)]/22 bg-[linear-gradient(135deg,rgba(92,232,255,0.16),rgba(151,255,0,0.07)_42%,rgba(11,13,14,0.97))] p-4 shadow-[0_22px_70px_rgba(0,0,0,0.32)]">
                        <div className="flex items-start gap-3">
                          <span className="grid size-11 shrink-0 place-items-center rounded-[16px] bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]">
                            <Dumbbell size={19} strokeWidth={2.5} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[16px] font-black text-white">
                              {t("workout.sets.emptyTitle")}
                            </p>
                            <p className="mt-1 text-[12px] font-bold leading-snug text-white/55">
                              {t("workout.sets.emptyHint")}
                            </p>
                          </div>
                        </div>
                        <button
                          className="gc-pressable mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[13px] font-black text-black"
                          onClick={addStrengthSet}
                          type="button"
                        >
                          <Plus size={16} strokeWidth={2.8} />
                          {t("workout.sets.add")}
                        </button>
                      </article>
                    ) : (
                      strengthExerciseGroups.map((group, groupIndex) => (
                        <article
                          className="w-[88%] shrink-0 snap-center overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b0d0e] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
                          key={group.key}
                          ref={(node) => {
                            exerciseCardRefs.current[groupIndex] = node;
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={[
                                "grid size-11 shrink-0 place-items-center rounded-[16px]",
                                group.completed
                                  ? "bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]"
                                  : "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]",
                              ].join(" ")}
                            >
                              <Dumbbell size={19} strokeWidth={2.5} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                                {groupIndex + 1}/{strengthExerciseGroups.length}
                              </p>
                              <h4 className="mt-1 truncate text-[19px] font-black leading-tight text-white">
                                {group.name}
                              </h4>
                              {group.techniqueName ? (
                                <button
                                  className="gc-pressable mt-1 flex max-w-full items-center gap-1.5 text-left text-[11px] font-black text-[var(--gc-blue)]"
                                  onClick={() =>
                                    openTechniqueInfo(group.techniqueId)
                                  }
                                  type="button"
                                >
                                  <span className="truncate">
                                    {group.techniqueName}
                                    {group.techniqueNotes
                                      ? ` · ${group.techniqueNotes}`
                                      : ""}
                                  </span>
                                  {group.techniqueId ? (
                                    <Info
                                      className="shrink-0 text-white/42"
                                      size={13}
                                    />
                                  ) : null}
                                </button>
                              ) : null}
                            </div>
                            {group.exerciseId ? (
                              <button
                                aria-label={t("workoutCatalog.aboutExercise")}
                                className="gc-pressable grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[var(--gc-brand)]"
                                onClick={() => openExerciseInfo(group.exerciseId)}
                                type="button"
                              >
                                <Info size={15} />
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-[10.5px] font-black text-white/62">
                              {t("workout.sets.exerciseProgress", {
                                done: group.completedCount,
                                total: group.totalCount,
                              })}
                            </span>
                            {group.completed ? (
                              <span className="rounded-full bg-[var(--gc-brand)]/14 px-3 py-1.5 text-[10.5px] font-black text-[var(--gc-brand)]">
                                {t("workout.sets.completed")}
                              </span>
                            ) : (
                              <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-[10.5px] font-black text-white/42">
                                {t("workout.sets.swipeHint")}
                              </span>
                            )}
                          </div>

                          <div
                            aria-hidden="true"
                            className="mt-4 grid grid-cols-[24px_minmax(0,1fr)_12px_minmax(0,1fr)_28px] gap-2 px-0.5 text-center text-[9px] font-black uppercase tracking-[0.12em] text-white/35"
                          >
                            <span />
                            <span>{t("workout.sets.reps")}</span>
                            <span />
                            <span>kg</span>
                            <span />
                          </div>

                          <div className="mt-2 grid gap-2">
                            {group.sets.map(({ index, set }, setIndex) => (
                              <div
                                className="grid grid-cols-[24px_minmax(0,1fr)_12px_minmax(0,1fr)_28px] items-center gap-2"
                                key={`${group.key}-${index}`}
                              >
                                <span className="w-6 shrink-0 text-[12px] font-black tabular-nums text-white/40">
                                  {setIndex + 1}
                                </span>
                                <input
                                  aria-label={t("workout.sets.reps")}
                                  className="min-w-0 flex-1 rounded-[14px] border border-white/[0.06] bg-white/[0.075] px-3 py-3 text-center text-[16px] font-black tabular-nums text-white outline-none placeholder:text-white/30 focus:border-[var(--gc-brand)] focus:bg-white/[0.11]"
                                  data-workout-set-input="true"
                                  inputMode="numeric"
                                  onBlur={handleStrengthSetInputBlur}
                                  onChange={(event) =>
                                    updateStrengthSetReps(
                                      index,
                                      event.target.value,
                                    )
                                  }
                                  onFocus={() => setSetsInputFocused(true)}
                                  placeholder={t("workout.sets.reps")}
                                  value={set.reps ? String(set.reps) : ""}
                                />
                                <span className="shrink-0 text-[13px] font-black text-white/30">
                                  ×
                                </span>
                                <input
                                  aria-label={t("workout.sets.weight")}
                                  className="min-w-0 flex-1 rounded-[14px] border border-white/[0.06] bg-white/[0.075] px-3 py-3 text-center text-[16px] font-black tabular-nums text-white outline-none placeholder:text-white/30 focus:border-[var(--gc-brand)] focus:bg-white/[0.11]"
                                  data-workout-set-input="true"
                                  inputMode="decimal"
                                  onBlur={handleStrengthSetInputBlur}
                                  onChange={(event) =>
                                    updateStrengthSetWeight(
                                      index,
                                      event.target.value,
                                    )
                                  }
                                  onFocus={() => setSetsInputFocused(true)}
                                  placeholder="0"
                                  value={
                                    set.weightKg != null
                                      ? String(set.weightKg)
                                      : ""
                                  }
                                />
                                <button
                                  aria-label={t("workout.sets.remove")}
                                  className="gc-pressable shrink-0 text-white/35"
                                  onClick={() => removeStrengthSet(index)}
                                  type="button"
                                >
                                  <X size={16} strokeWidth={2.6} />
                                </button>
                              </div>
                            ))}
                          </div>

                          <button
                            className="gc-pressable mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/[0.075] text-[13px] font-black text-[var(--gc-brand)]"
                            onClick={() => addStrengthSetForGroup(group)}
                            type="button"
                          >
                            <Plus size={16} strokeWidth={2.8} />
                            {t("workout.sets.addToExercise")}
                          </button>
                        </article>
                      ))
                    )}
                  </div>

                  {strengthExerciseGroups.length > 1 ? (
                    <div className="mt-1 flex justify-center gap-1.5 px-5">
                      {strengthExerciseGroups.map((group, index) => (
                        <span
                          aria-hidden="true"
                          className={[
                            "h-1.5 rounded-full transition-all",
                            index === safeActiveStrengthExerciseIndex
                              ? "w-6 bg-[var(--gc-brand)]"
                              : group.completed
                                ? "w-1.5 bg-[var(--gc-brand)]/75"
                                : "w-1.5 bg-white/18",
                          ].join(" ")}
                          key={group.key}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {session.activityType === "strength" ? (
                <section className="mt-6 rounded-[28px] border border-white/[0.08] bg-[#0b0d0e] p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-[14px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                      <Timer size={19} strokeWidth={2.4} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-black text-white">
                        {t("workout.rest.title")}
                      </p>
                      <p className="text-[11.5px] font-bold text-white/38">
                        {t("workout.rest.subtitle")}
                      </p>
                    </div>
                    {rest.status === "running" ||
                    rest.status === "paused" ? (
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--gc-brand)]">
                        {t("workout.rest.inProgress")}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-5 grid grid-cols-[54px_1fr_54px] items-center gap-3">
                    <button
                      aria-label={t("workout.rest.decrease")}
                      className="gc-pressable grid size-[54px] place-items-center rounded-full bg-white/[0.06] text-white disabled:opacity-35"
                      disabled={rest.presetS <= 10}
                      onClick={() =>
                        dispatchRest({ type: "adjust", deltaS: -10 })
                      }
                      type="button"
                    >
                      <Minus size={21} strokeWidth={2.7} />
                    </button>
                    <p className="text-center text-[48px] font-black leading-none tracking-[-0.045em] text-white tabular-nums">
                      {formatElapsed(rest.remainingS)}
                    </p>
                    <button
                      aria-label={t("workout.rest.increase")}
                      className="gc-pressable grid size-[54px] place-items-center rounded-full bg-white/[0.06] text-white"
                      onClick={() =>
                        dispatchRest({ type: "adjust", deltaS: 10 })
                      }
                      type="button"
                    >
                      <Plus size={21} strokeWidth={2.7} />
                    </button>
                  </div>

                  {rest.status === "running" ||
                  rest.status === "paused" ? (
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="h-full rounded-full bg-[var(--gc-brand)] transition-[width] duration-500"
                        style={{ width: `${restProgress}%` }}
                      />
                    </div>
                  ) : null}

                  {rest.status === "running" ||
                  rest.status === "paused" ? (
                    <button
                      className="gc-pressable mt-4 flex h-12 w-full items-center justify-center rounded-full bg-white/[0.065] text-[13px] font-black text-white"
                      onClick={() => dispatchRest({ type: "reset" })}
                      type="button"
                    >
                      {t("workout.rest.cancel")}
                    </button>
                  ) : (
                    <button
                      className="gc-pressable mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-[var(--gc-brand-ink)] disabled:opacity-40"
                      disabled={isPaused}
                      onClick={startRest}
                      type="button"
                    >
                      <Timer size={17} />
                      {rest.status === "done"
                        ? t("workout.rest.restart")
                        : t("workout.rest.start")}
                    </button>
                  )}
                </section>
              ) : (
                <section className="mt-7 grid grid-cols-2 gap-3">
                  <div className="rounded-[22px] bg-[#0b0d0e] p-4">
                    <Gauge className="text-[var(--gc-brand)]" size={20} />
                    <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em] text-white/40">
                      {t("workout.metrics.moving")}
                    </p>
                    <p className="mt-1 text-[25px] font-black text-white tabular-nums">
                      {formatElapsed(elapsedS)}
                    </p>
                  </div>
                  <div className="rounded-[22px] bg-[#0b0d0e] p-4">
                    <TrendingUp className="text-[var(--gc-brand)]" size={20} />
                    <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em] text-white/40">
                      {t("workout.metrics.paused")}
                    </p>
                    <p className="mt-1 text-[25px] font-black text-white tabular-nums">
                      {formatElapsed(pausedS)}
                    </p>
                  </div>
                </section>
              )}

              {finishError ? (
                <p className="mt-4 text-center text-[12.5px] font-bold text-[var(--gc-pink)]">
                  {finishError}
                </p>
              ) : null}

              <footer
                className={[
                  "fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[480px] bg-gradient-to-t from-black via-black/96 to-black/0 px-5 pb-[calc(var(--gc-safe-bottom)+10px)] pt-7 backdrop-blur-xl transition-all duration-200",
                  setsInputFocused
                    ? "pointer-events-none translate-y-12 opacity-0"
                    : "translate-y-0 opacity-100",
                ].join(" ")}
              >
                <div className="grid grid-cols-3 items-end gap-4">
                  <button
                    aria-label={t("workout.finish")}
                    className="gc-pressable grid justify-items-center gap-1.5 text-[10.5px] font-black text-white/60"
                    disabled={finishing}
                    onClick={() => setFinishConfirmOpen(true)}
                    type="button"
                  >
                    <span className="grid size-14 place-items-center rounded-full bg-[#ff2d55] text-white">
                      {finishing ? (
                        <span className="size-5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                      ) : (
                        <Square fill="currentColor" size={18} />
                      )}
                    </span>
                    {t("workout.finishShort")}
                  </button>
                  <button
                    aria-label={
                      isPaused ? t("workout.resume") : t("workout.pause")
                    }
                    className="gc-pressable grid justify-items-center gap-1.5 text-[10.5px] font-black text-white"
                    onClick={togglePause}
                    type="button"
                  >
                    <span className="grid size-[66px] place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)] shadow-[0_0_28px_rgba(92,232,255,0.2)]">
                      {isPaused ? (
                        <Play fill="currentColor" size={25} />
                      ) : (
                        <Pause fill="currentColor" size={25} />
                      )}
                    </span>
                    {isPaused ? t("workout.resume") : t("workout.pause")}
                  </button>
                  <button
                    aria-label={t("workout.minimize")}
                    className="gc-pressable grid justify-items-center gap-1.5 text-[10.5px] font-black text-white/60"
                    onClick={onClose}
                    type="button"
                  >
                    <span className="grid size-14 place-items-center rounded-full bg-[#17191b] text-white">
                      <ChevronDown size={23} strokeWidth={2.5} />
                    </span>
                    {t("workout.minimizeShort")}
                  </button>
                </div>
                <button
                  className="gc-pressable mt-2 w-full py-1.5 text-center text-[11px] font-black text-white/28"
                  onClick={() => setDiscardConfirmOpen(true)}
                  type="button"
                >
                  {t("workout.discard")}
                </button>
              </footer>
            </main>

            <ConfirmSheet
              cancelLabel={t("common.cancel")}
              confirmLabel={t("workout.finish")}
              description={t("workout.finishConfirm.description", {
                duration: formatElapsed(elapsedS),
              })}
              onClose={() => setFinishConfirmOpen(false)}
              onConfirm={handleFinish}
              open={finishConfirmOpen}
              title={t("workout.finishConfirm.title")}
              tone="destructive"
            />
            <ConfirmSheet
              cancelLabel={t("common.cancel")}
              confirmLabel={t("workout.discardConfirm.confirm")}
              description={t("workout.discardConfirm.description")}
              onClose={() => setDiscardConfirmOpen(false)}
              onConfirm={handleDiscard}
              open={discardConfirmOpen}
              title={t("workout.discardConfirm.title")}
              tone="destructive"
            />
          </>
        ) : null}
      </div>
      </div>
    </>
  );
}
