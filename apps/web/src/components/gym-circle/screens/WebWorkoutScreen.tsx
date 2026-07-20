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
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Footprints,
  Gauge,
  History,
  Info,
  MapPinned,
  Minus,
  MoveRight,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Square,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ConfirmSheet } from "../ConfirmSheet";
import type {
  ComposerActivityContext,
  FinishedWebActivity,
  WebActivityInput,
  WorkoutExerciseCatalogItem,
  WorkoutPlan,
} from "../social/types";
import {
  buildWorkoutComparison,
  exerciseHistoryKey,
  lastPerformanceLabel,
  type ExerciseHistoryEntry,
} from "../workout/exerciseHistory";
import { REST_TIMER_INITIAL, restTimerReducer } from "../workout/restTimer";
import { useExerciseHistory } from "../workout/useExerciseHistory";
import { formatElapsed } from "../workout/workoutElapsed";
import { WorkoutPlansFabControlled } from "../workout/WorkoutPlansFab";
import { HealthKitImportSheet } from "../workout/HealthKitImportSheet";
import { WorkoutPlanDetailSheet } from "../workout/WorkoutPlanDetailSheet";
import {
  WorkoutCompletionSummary,
  type FinishedWorkoutSummary,
} from "../workout/WorkoutCompletionSummary";
import {
  exerciseCatalogInfo,
  techniqueCatalogInfo,
  WorkoutCatalogInfoSheet,
  WorkoutExercisePicker,
  type WorkoutCatalogInfo,
} from "../workout/WorkoutCatalogSheets";
import { useWorkoutCatalog } from "../workout/useWorkoutCatalog";
import { useWorkoutPlanExecutions } from "../workout/useWorkoutPlanExecutions";
import { useWorkoutPlans } from "../workout/useWorkoutPlans";
import { WorkoutSetAdvancedFields } from "../workout/WorkoutSetAdvancedFields";
import {
  applyExerciseLoadType,
  inferExerciseLoadType,
  resolveExerciseLoadType,
  type ExerciseLoadType,
} from "../workout/exerciseLoadType";
import {
  appendWorkoutRoutePoint,
  bestWorkoutRouteSummary,
  clearStoredWorkoutSession,
  createAddedStrengthExerciseSet,
  createWorkoutClientSessionId,
  formatAveragePace,
  formatAverageSpeed,
  formatDistance,
  mergeWorkoutRouteSnapshot,
  pauseWorkoutSession,
  readStoredWorkoutSession,
  recordStrengthSetActualRest,
  resumeWorkoutSession,
  shouldAutoCompleteStrengthSet,
  type LiveStrengthSet,
  type StoredWorkoutSession,
  type WorkoutRoutePoint,
  workoutElapsedSeconds,
  workoutPausedSeconds,
  workoutRestElapsedSeconds,
  writeStoredWorkoutSession,
} from "../workout/workoutSession";
import {
  buildWorkoutSummaryMetrics,
  getWorkoutPlanDisplayName,
  isVeryShortWorkout,
  normalizeStrengthSetsForSave,
  parseOptionalWeightKg,
} from "../workout/workoutSummary";
import {
  finishWithTimeout,
  withRequestTimeout,
} from "../workout/workoutFinish";

type WorkoutType = WebActivityInput["activityType"];
type RouteWorkoutType = Extract<WorkoutType, "run" | "walk" | "ride">;
type GpsStatus = "off" | "requesting" | "strong" | "weak" | "denied";
type GpsEngine = "checking" | "native" | "web";

type WebWorkoutScreenProps = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onFinish: (input: WebActivityInput) => Promise<FinishedWebActivity>;
  onUpdateWorkoutNotes?: (
    activityId: string,
    input: {
      workoutNote?: string | null;
      workoutExerciseContext?: WebActivityInput["workoutExerciseContext"];
    },
  ) => Promise<void>;
  onCompose: (activity: ComposerActivityContext) => void;
  onSessionChange?: (active: boolean) => void;
};

type StrengthExerciseGroup = {
  completed: boolean;
  completedCount: number;
  exerciseId: string | null;
  key: string;
  loadType: ExerciseLoadType;
  name: string;
  sets: Array<{ index: number; set: LiveStrengthSet }>;
  targetKind: "reps" | "failure" | "duration";
  techniqueId: string | null;
  techniqueName: string | null;
  techniqueNotes: string | null;
  totalCount: number;
};

let liveStrengthSetSequence = 0;

function nextLiveStrengthSetId() {
  liveStrengthSetSequence += 1;
  return `live-strength-set-${Date.now()}-${liveStrengthSetSequence}`;
}

function newStrengthSetFromTemplate(
  template?: LiveStrengthSet | null,
): LiveStrengthSet {
  const clientId = nextLiveStrengthSetId();
  return {
    clientId,
    setId: clientId,
    setStatus: "added",
    setOrigin: "added",
    loadType: template?.loadType ?? "not_provided",
    reps: 0,
    weightKg: null,
    exercise: template?.exercise ?? null,
    exerciseId: template?.exerciseId ?? null,
    targetKind: template?.targetKind ?? null,
    durationSeconds: null,
    plannedReps: template?.plannedReps ?? template?.reps ?? null,
    plannedDurationSeconds:
      template?.plannedDurationSeconds ?? template?.durationSeconds ?? null,
    techniqueId: template?.techniqueId ?? null,
    techniqueName: template?.techniqueName ?? null,
    techniqueNotes: template?.techniqueNotes ?? null,
  };
}

const TYPE_CARDS: Array<{
  type: WorkoutType;
  icon: ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
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
  userId,
  onClose,
  onFinish,
  onUpdateWorkoutNotes,
  onCompose,
  onSessionChange,
}: WebWorkoutScreenProps) {
  const { i18n, t } = useTranslation();
  const [stage, setStage] = useState<"pick" | "live">("pick");
  const [session, setSession] = useState<StoredWorkoutSession | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [rest, dispatchRest] = useReducer(restTimerReducer, REST_TIMER_INITIAL);
  const restRef = useRef(rest);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("off");
  const [gpsEngine, setGpsEngine] = useState<GpsEngine>("checking");
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [healthImportOpen, setHealthImportOpen] = useState(false);
  const [finishConfirmOpen, setFinishConfirmOpen] = useState(false);
  const [finishPromptElapsedS, setFinishPromptElapsedS] = useState<
    number | null
  >(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [setsInputFocused, setSetsInputFocused] = useState(false);
  // Séries de musculação da sessão atual (só treino de força). Linhas
  // editáveis (reps × carga); treino salvo pré-carrega exercício + reps alvo.
  const [strengthSets, setStrengthSets] = useState<LiveStrengthSet[]>([]);
  const [completedStrengthSetIds, setCompletedStrengthSetIds] = useState<
    Set<string>
  >(() => new Set());
  const [finishedSummary, setFinishedSummary] =
    useState<FinishedWorkoutSummary | null>(null);
  // Sprint 2 — histórico por exercício ("última vez", usar cargas, sheet).
  const [historySheetKey, setHistorySheetKey] = useState<string | null>(null);
  const [historyAppliedMessage, setHistoryAppliedMessage] = useState("");
  const [renameTarget, setRenameTarget] = useState<WorkoutPlan | null>(null);
  const [detailPlanId, setDetailPlanId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [createPlanRequestKey, setCreatePlanRequestKey] = useState(0);
  const [catalogInfo, setCatalogInfo] = useState<WorkoutCatalogInfo | null>(
    null,
  );
  const [liveExercisePickerOpen, setLiveExercisePickerOpen] = useState(false);
  const workoutCatalog = useWorkoutCatalog();
  const {
    exercises: catalogExercises,
    techniques,
    muscleGroups,
    loading: catalogLoading,
    error: catalogError,
    refresh: refreshCatalog,
    favoriteExerciseIds,
    recentExerciseIds,
    toggleFavoriteExercise,
  } = workoutCatalog;
  const workoutPlansController = useWorkoutPlans(open);
  // Sprint 2 — histórico do próprio user pra "última vez"/usar cargas/comparação.
  const strengthHistory = useExerciseHistory(
    open && stage === "live" && session?.activityType === "strength",
  );
  const {
    plans: savedWorkoutPlans,
    loading: workoutPlansLoading,
    error: workoutPlansError,
    refresh: refreshWorkoutPlans,
    savePlan,
    toggleFavorite,
    recommendation: workoutRecommendation,
  } = workoutPlansController;
  const workoutPlanExecutions = useWorkoutPlanExecutions(detailPlanId);
  const suggestedWorkoutPlan = useMemo(() => {
    const id = workoutRecommendation.recommendation?.planId;
    return id
      ? (savedWorkoutPlans.find((plan) => plan.id === id) ?? null)
      : null;
  }, [savedWorkoutPlans, workoutRecommendation.recommendation?.planId]);
  const quickWorkoutPlans = useMemo(() => {
    const suggestedId = workoutRecommendation.recommendation?.planId;
    return savedWorkoutPlans
      .filter((plan) => plan.exercises.length > 0)
      .sort((left, right) => {
        if ((left.id === suggestedId) !== (right.id === suggestedId)) {
          return left.id === suggestedId ? -1 : 1;
        }
        if (Boolean(left.isFavorite) !== Boolean(right.isFavorite)) {
          return left.isFavorite ? -1 : 1;
        }
        const lastUsed = (right.stats?.lastUsedAt ?? "").localeCompare(
          left.stats?.lastUsedAt ?? "",
        );
        return lastUsed || right.updatedAt.localeCompare(left.updatedAt);
      })
      .slice(0, 5);
  }, [savedWorkoutPlans, workoutRecommendation.recommendation?.planId]);
  const detailWorkoutPlan = detailPlanId
    ? (savedWorkoutPlans.find((plan) => plan.id === detailPlanId) ?? null)
    : null;
  const hasSession = session !== null;
  const sessionPausedAtMs = session?.pausedAtMs;
  const nativeSessionAttachedRef = useRef(false);
  const finishingRef = useRef(false);
  const setsSectionRef = useRef<HTMLElement>(null);
  const exerciseCarouselRef = useRef<HTMLDivElement>(null);
  const workoutDialogRef = useRef<HTMLDivElement>(null);
  const exerciseCardRefs = useRef<Array<HTMLElement | null>>([]);
  const exerciseScrollFrameRef = useRef<number | null>(null);
  const autoAdvancedExerciseKeysRef = useRef<Set<string>>(new Set());
  const pendingStrengthExerciseIndexRef = useRef<number | null>(null);
  const [activeStrengthExerciseIndex, setActiveStrengthExerciseIndex] =
    useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => {
      const stored = readStoredWorkoutSession(userId);
      setFinishedSummary(null);
      finishingRef.current = false;
      setFinishing(false);
      setFinishError(null);
      setFinishConfirmOpen(false);
      setFinishPromptElapsedS(null);
      setDiscardConfirmOpen(false);
      setLiveExercisePickerOpen(false);
      pendingStrengthExerciseIndexRef.current = null;
      setNowMs(Date.now());
      if (stored) {
        autoAdvancedExerciseKeysRef.current.clear();
        setSession(stored);
        setStrengthSets(stored.strengthSets);
        setCompletedStrengthSetIds(new Set(stored.completedStrengthSetIds));
        dispatchRest({
          type: "restore",
          state: stored.restTimer,
          nowMs: Date.now(),
        });
        setStage("live");
        onSessionChange?.(true);
      } else {
        autoAdvancedExerciseKeysRef.current.clear();
        setSession(null);
        setStrengthSets([]);
        setCompletedStrengthSetIds(new Set());
        setStage("pick");
        dispatchRest({ type: "reset" });
        onSessionChange?.(false);
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [onSessionChange, open, userId]);

  useEffect(() => {
    if (!finishedSummary) return;
    const id = window.requestAnimationFrame(() => {
      workoutDialogRef.current?.scrollTo({ top: 0 });
    });
    return () => window.cancelAnimationFrame(id);
  }, [finishedSummary]);

  useEffect(
    () => () => {
      if (exerciseScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(exerciseScrollFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || stage !== "live" || !hasSession) return;
    const id = window.setInterval(() => {
      setNowMs(Date.now());
      if (sessionPausedAtMs === null) {
        dispatchRest({ type: "tick", nowMs: Date.now() });
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [hasSession, open, sessionPausedAtMs, stage]);

  const persistSession = useCallback(
    (updater: (current: StoredWorkoutSession) => StoredWorkoutSession) => {
      setSession((current) => {
        if (!current) return current;
        const updated = updater(current);
        const next =
          updated.restTimer === restRef.current
            ? updated
            : { ...updated, restTimer: restRef.current };
        if (next === current) return current;
        writeStoredWorkoutSession(userId, next);
        return next;
      });
    },
    [userId],
  );

  useEffect(() => {
    restRef.current = rest;
  }, [rest]);

  useEffect(() => {
    if (!session || stage !== "live") return;
    writeStoredWorkoutSession(userId, { ...session, restTimer: rest });
  }, [rest, session, stage, userId]);

  useEffect(() => {
    if (session?.activityType !== "strength" || stage !== "live") return;
    // Sincroniza o rascunho completo para sobreviver a minimizar/reabrir.
    persistSession((current) => ({
      ...current,
      strengthSets,
      completedStrengthSetIds: Array.from(completedStrengthSetIds),
    }));
  }, [
    completedStrengthSetIds,
    persistSession,
    session?.activityType,
    stage,
    strengthSets,
  ]);

  const applyNativeSnapshot = useCallback(
    (snapshot: {
      distanceM: number;
      movingS: number;
      elevationGainM: number;
    }) => {
      if (snapshot.distanceM > 0 || snapshot.movingS > 0) {
        setGpsStatus("strong");
      }
      persistSession((current) =>
        mergeWorkoutRouteSnapshot(current, snapshot),
      );
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
        const handle =
          await WorkoutLocationBridge.addUpdateListener(applyNativeSnapshot);
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
        setGpsStatus(
          error.code === error.PERMISSION_DENIED ? "denied" : "weak",
        );
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
    persistSession,
    session?.activityType,
    session?.pausedAtMs,
    stage,
  ]);

  const startWorkout = useCallback(
    (
      activityType: WorkoutType,
      initialStrengthSets: LiveStrengthSet[] = [],
      workoutPlan: StoredWorkoutSession["workoutPlan"] = null,
    ) => {
      const next: StoredWorkoutSession = {
        version: 5,
        ownerUserId: userId,
        clientSessionId: createWorkoutClientSessionId(),
        startedAtMs: Date.now(),
        activityType,
        workoutPlan,
        pausedAtMs: null,
        pausedTotalMs: 0,
        distanceM: 0,
        movingS: 0,
        elevationGainM: 0,
        restCount: 0,
        restTimer: REST_TIMER_INITIAL,
        restSetClientId: null,
        workoutNote: "",
        exerciseNotes: {},
        strengthSets: initialStrengthSets,
        completedStrengthSetIds: [],
        routePoints: [],
        lastRoutePoint: null,
      };
      writeStoredWorkoutSession(userId, next);
      setSession(next);
      setStrengthSets(initialStrengthSets);
      setCompletedStrengthSetIds(new Set());
      setActiveStrengthExerciseIndex(0);
      autoAdvancedExerciseKeysRef.current.clear();
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
              applyNativeSnapshot(
                await WorkoutLocationBridge.start(activityType),
              );
            } catch {
              nativeSessionAttachedRef.current = false;
              setGpsEngine("web");
            }
          },
        );
      }
    },
    [applyNativeSnapshot, gpsEngine, onSessionChange, userId],
  );

  const startWorkoutPlan = useCallback(
    (
      plan: WorkoutPlan,
      startedFrom: "saved_plan" | "suggested" = "saved_plan",
    ) => {
      // Cada exercício vira N linhas (séries alvo) já rotuladas; a pessoa
      // preenche reps × carga durante a sessão.
      const seeded: LiveStrengthSet[] = plan.exercises
        .flatMap((ex) => {
          const catalogExercise = ex.exerciseId
            ? catalogExercises.find((item) => item.id === ex.exerciseId)
            : null;
          const inferredLoadType =
            ex.loadType ??
            inferExerciseLoadType({
              equipment: catalogExercise?.equipment,
              exerciseName: ex.name,
            });
          const count = Math.min(Math.max(ex.sets ?? 1, 1), 12);
          return Array.from({ length: count }, () => {
            const clientId = nextLiveStrengthSetId();
            return {
              clientId,
              setId: clientId,
              setStatus: "planned" as const,
              setOrigin: "planned" as const,
              loadType: inferredLoadType,
              reps: 0,
              weightKg: null as number | null,
              exercise: ex.name,
              exerciseId: ex.exerciseId ?? null,
              targetKind: ex.targetKind ?? "reps",
              durationSeconds: null,
              plannedReps: ex.reps ?? null,
              plannedRepsMin: ex.reps ?? null,
              plannedRepsMax: ex.reps ?? null,
              plannedDurationSeconds: ex.durationSeconds ?? null,
              techniqueId: ex.techniqueId ?? null,
              techniqueName: ex.techniqueName ?? null,
              techniqueNotes: ex.techniqueNotes ?? null,
            };
          });
        })
        .map((set, index) => ({ ...set, setIndex: index + 1 }));
      startWorkout("strength", seeded, {
        id: plan.id,
        name: plan.name,
        exercisesSnapshot: plan.exercises,
        version: plan.planVersion ?? 1,
        startedFrom,
      });
    },
    [catalogExercises, startWorkout],
  );

  const openRenameWorkoutPlan = useCallback((plan: WorkoutPlan) => {
    setRenameTarget(plan);
    setRenameValue(
      plan.name.trim().toLocaleLowerCase("pt-BR") === "planilha"
        ? ""
        : plan.name,
    );
    setRenameError(null);
  }, []);

  const handleRenameWorkoutPlan = useCallback(async () => {
    if (!renameTarget || renameSaving || !renameValue.trim()) return;
    setRenameSaving(true);
    setRenameError(null);
    try {
      await savePlan({
        id: renameTarget.id,
        name: renameValue.trim(),
        exercises: renameTarget.exercises,
      });
      setRenameTarget(null);
      setRenameValue("");
    } catch {
      setRenameError(t("workoutPlans.errors.save"));
    } finally {
      setRenameSaving(false);
    }
  }, [renameTarget, renameSaving, renameValue, savePlan, t]);

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
      if (rest.status === "running") {
        dispatchRest({ type: "pause", nowMs: actionNow });
      }
    } else {
      persistSession((current) => resumeWorkoutSession(current, actionNow));
      if (routeActivityType && gpsEngine === "native") {
        void import("../native/WorkoutLocationBridge").then(
          ({ WorkoutLocationBridge }) =>
            WorkoutLocationBridge.resume(routeActivityType),
        );
      }
      if (rest.status === "paused") {
        dispatchRest({ type: "resume", nowMs: actionNow });
      }
    }
    setNowMs(actionNow);
    navigator.vibrate?.(45);
  }, [gpsEngine, persistSession, rest.status, session]);

  const handleFinish = useCallback(async () => {
    if (!session || finishingRef.current) return;
    finishingRef.current = true;
    setFinishing(true);
    setFinishError(null);
    setFinishConfirmOpen(false);
    setFinishPromptElapsedS(null);
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
        const { WorkoutLocationBridge } =
          await import("../native/WorkoutLocationBridge");
        try {
          nativeSummary = await withRequestTimeout(
            WorkoutLocationBridge.stop(),
            5_000,
            "workout_location_stop_timeout",
          );
        } catch {
          // O snapshot persistido da sessão continua sendo uma fonte válida.
          // Uma ponte nativa lenta não pode impedir a gravação da atividade.
          nativeSummary = undefined;
        }
      }
      const routeSummary = isRouteWorkout(session.activityType)
        ? bestWorkoutRouteSummary(session, nativeSummary)
        : null;
      const route = routeSummary?.route ?? null;
      const finalizedStrengthSets = normalizeStrengthSetsForSave(
        strengthSets.map((set, index) => {
          const completed = completedStrengthSetIds.has(set.clientId);
          return {
            ...set,
            setIndex: index + 1,
            setStatus: completed
              ? set.setOrigin === "added"
                ? ("added" as const)
                : ("completed" as const)
              : set.setStatus === "skipped"
                ? ("skipped" as const)
                : ("planned" as const),
          };
        }),
      );
      const completedStrengthSets = finalizedStrengthSets.filter(
        (set) => set.setStatus === "completed" || set.setStatus === "added",
      );
      const workoutExerciseContext = Array.from(
        new Map(
          finalizedStrengthSets.map((set) => {
            const key =
              exerciseHistoryKey(set.exerciseId, set.exercise) ??
              `name:${(
                set.exercise?.trim() || t("workout.sets.untitledExercise")
              ).toLocaleLowerCase()}`;
            return [
              key,
              {
                exerciseId: set.exerciseId ?? null,
                exercise: set.exercise ?? null,
                note: session.exerciseNotes[key]?.trim() || null,
                targetRestS: set.targetRestS ?? null,
              },
            ] as const;
          }),
        ).values(),
      ).filter((item) => item.note || item.targetRestS != null);
      const activity = await finishWithTimeout(
        onFinish({
          clientSessionId: session.clientSessionId,
          activityType: session.activityType,
          startedAt: new Date(session.startedAtMs).toISOString(),
          endedAt: new Date(endedMs).toISOString(),
          elapsedS,
          movingS: isRouteWorkout(session.activityType)
            ? Math.round(routeSummary?.movingS ?? session.movingS)
            : elapsedS,
          distanceM: isRouteWorkout(session.activityType)
            ? (routeSummary?.distanceM ?? session.distanceM)
            : null,
          elevationGainM: isRouteWorkout(session.activityType)
            ? (routeSummary?.elevationGainM ?? session.elevationGainM)
            : null,
          route,
          strengthSets:
            session.activityType === "strength" &&
            finalizedStrengthSets.length > 0
              ? finalizedStrengthSets
              : null,
          workoutPlanId: session.workoutPlan?.id ?? null,
          workoutPlanNameSnapshot: session.workoutPlan?.name ?? null,
          workoutPlanExercisesSnapshot:
            session.workoutPlan?.exercisesSnapshot ?? null,
          workoutPlanVersionSnapshot: session.workoutPlan?.version ?? null,
          workoutPlanStartedFrom: session.workoutPlan?.startedFrom ?? "free",
          workoutNote: session.workoutNote.trim() || null,
          workoutExerciseContext,
        }),
      );
      const context: ComposerActivityContext = {
        id: activity.id,
        activityType: session.activityType,
        elapsedS: activity.elapsedS,
        movingS: isRouteWorkout(session.activityType)
          ? Math.round(routeSummary?.movingS ?? session.movingS)
          : activity.elapsedS,
        distanceM: isRouteWorkout(session.activityType)
          ? (routeSummary?.distanceM ?? session.distanceM)
          : null,
        elevationGainM: isRouteWorkout(session.activityType)
          ? (routeSummary?.elevationGainM ?? session.elevationGainM)
          : null,
        route,
        workoutDate: activity.workoutDate,
      };
      setFinishedSummary({
        context,
        workoutNote: session.workoutNote,
        metrics: buildWorkoutSummaryMetrics(
          completedStrengthSets,
          strengthSets.length,
        ),
        comparison:
          session.activityType === "strength"
            ? buildWorkoutComparison(
                completedStrengthSets,
                strengthHistory.latestActivity,
              )
            : null,
      });
      clearStoredWorkoutSession(userId);
      setSession(null);
      setStage("pick");
      setStrengthSets([]);
      setLiveExercisePickerOpen(false);
      pendingStrengthExerciseIndexRef.current = null;
      setCompletedStrengthSetIds(new Set());
      dispatchRest({ type: "reset" });
      onSessionChange?.(false);
      nativeSessionAttachedRef.current = false;
      void refreshWorkoutPlans();
    } catch (error) {
      setFinishError(
        error instanceof Error && error.message === "workout_finish_timeout"
          ? t("workout.errors.finishTimeout")
          : error instanceof Error
            ? error.message
            : t("workout.errors.finish"),
      );
    } finally {
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [
    gpsEngine,
    completedStrengthSetIds,
    onFinish,
    onSessionChange,
    refreshWorkoutPlans,
    session,
    strengthHistory.latestActivity,
    strengthSets,
    t,
    userId,
  ]);

  const handleDiscard = useCallback(() => {
    clearStoredWorkoutSession(userId);
    dispatchRest({ type: "reset" });
    setSession(null);
    setStrengthSets([]);
    setLiveExercisePickerOpen(false);
    pendingStrengthExerciseIndexRef.current = null;
    setCompletedStrengthSetIds(new Set());
    setFinishedSummary(null);
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
  }, [gpsEngine, onClose, onSessionChange, session, userId]);

  const startRest = useCallback(
    (restSetClientId: string | null) => {
    if (!session || session.pausedAtMs !== null) return;
    dispatchRest({ type: "start", nowMs: Date.now() });
    persistSession((current) => ({
      ...current,
      restCount: current.restCount + 1,
        restSetClientId,
    }));
    navigator.vibrate?.(40);
    },
    [persistSession, session],
  );

  const finishTrackedRest = useCallback(
    (timer: typeof rest) => {
      const restSetClientId = session?.restSetClientId ?? null;
      if (!restSetClientId) return;
      const actualRestS = workoutRestElapsedSeconds(timer);
      setStrengthSets((current) =>
        recordStrengthSetActualRest(current, restSetClientId, actualRestS),
      );
      persistSession((current) =>
        current.restSetClientId === restSetClientId
          ? { ...current, restSetClientId: null }
          : current,
      );
    },
    [persistSession, session?.restSetClientId],
  );

  useEffect(() => {
    if (rest.status !== "done" || !session?.restSetClientId) return;
    const id = window.setTimeout(() => finishTrackedRest(rest), 0);
    return () => window.clearTimeout(id);
  }, [finishTrackedRest, rest, session?.restSetClientId]);

  const skipRest = useCallback(() => {
    finishTrackedRest(rest);
    dispatchRest({ type: "reset" });
  }, [finishTrackedRest, rest]);

  const addStrengthSetForGroup = useCallback((group: StrengthExerciseGroup) => {
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
  }, []);

  const setStrengthSetCompleted = useCallback(
    (clientId: string, completed: boolean) => {
      setCompletedStrengthSetIds((current) => {
        const next = new Set(current);
        if (completed) next.add(clientId);
        else next.delete(clientId);
        return next;
      });
      if (!completed) {
        setStrengthSets((current) =>
          current.map((set) =>
            set.clientId === clientId && set.actualRestS != null
              ? { ...set, actualRestS: null }
              : set,
          ),
        );
      }
    },
    [],
  );

  const updateStrengthSetReps = useCallback(
    (index: number, raw: string) => {
      const value = raw.replace(/[^0-9]/g, "");
      const reps = Number.parseInt(value, 10) || 0;
      const current = strengthSets[index];
      setStrengthSets((prev) =>
        prev.map((set, i) =>
          i === index
            ? {
                ...set,
                reps,
                setStatus:
                  set.setStatus === "skipped" ? "planned" : set.setStatus,
              }
            : set,
        ),
      );
      if (!current) return;
      const wasCompleted = completedStrengthSetIds.has(current.clientId);
      const autoComplete = shouldAutoCompleteStrengthSet({
        reps,
        targetKind: current.targetKind,
        weightKg: current.weightKg,
        wasCompleted,
      });
      setStrengthSetCompleted(current.clientId, autoComplete);
    },
    [completedStrengthSetIds, setStrengthSetCompleted, strengthSets],
  );

  const updateStrengthSetWeight = useCallback(
    (index: number, raw: string, loadType: ExerciseLoadType) => {
      const weightKg = parseOptionalWeightKg(raw);
      const current = strengthSets[index];
      setStrengthSets((prev) =>
        prev.map((set, i) =>
          i === index
            ? {
                ...set,
                loadType,
                weightKg: loadType === "external" ? weightKg : set.weightKg,
                assistedWeightKg:
                  loadType === "assisted" ? weightKg : set.assistedWeightKg,
                setStatus:
                  set.setStatus === "skipped" ? "planned" : set.setStatus,
              }
            : set,
        ),
      );
      if (!current) return;
      const wasCompleted = completedStrengthSetIds.has(current.clientId);
      setStrengthSetCompleted(
        current.clientId,
        shouldAutoCompleteStrengthSet({
          reps: current.reps,
          targetKind: current.targetKind,
          weightKg,
          wasCompleted,
        }),
      );
    },
    [completedStrengthSetIds, setStrengthSetCompleted, strengthSets],
  );

  const updateStrengthExerciseLoadType = useCallback(
    (group: StrengthExerciseGroup, loadType: ExerciseLoadType) => {
      const setClientIds = new Set(group.sets.map(({ set }) => set.clientId));
      setStrengthSets((current) =>
        applyExerciseLoadType(current, setClientIds, loadType),
      );
    },
    [],
  );

  const patchStrengthSet = useCallback(
    (index: number, patch: Partial<LiveStrengthSet>) => {
      setStrengthSets((current) =>
        current.map((set, setIndex) =>
          setIndex === index ? { ...set, ...patch } : set,
        ),
      );
    },
    [],
  );

  const updateStrengthSetDuration = useCallback(
    (index: number, raw: string) => {
      const value = raw.replace(/[^0-9]/g, "");
      const durationSeconds = Number.parseInt(value, 10) || null;
      const current = strengthSets[index];
      setStrengthSets((prev) =>
        prev.map((set, i) =>
          i === index
            ? {
                ...set,
                durationSeconds,
                setStatus:
                  set.setStatus === "skipped" ? "planned" : set.setStatus,
              }
            : set,
        ),
      );
      if (current && durationSeconds === null) {
        setStrengthSetCompleted(current.clientId, false);
      }
    },
    [setStrengthSetCompleted, strengthSets],
  );

  const completeDurationSet = useCallback(
    (index: number) => {
      const current = strengthSets[index];
      if (!current) return;
      const durationSeconds =
        current.durationSeconds ?? current.plannedDurationSeconds;
      if (!durationSeconds || durationSeconds <= 0) return;
      setStrengthSets((sets) =>
        sets.map((set, i) => (i === index ? { ...set, durationSeconds } : set)),
      );
      setStrengthSetCompleted(current.clientId, true);
      navigator.vibrate?.(35);
    },
    [setStrengthSetCompleted, strengthSets],
  );

  const toggleDurationSetCompleted = useCallback(
    (index: number) => {
      const current = strengthSets[index];
      if (!current) return;
      if (completedStrengthSetIds.has(current.clientId)) {
        setStrengthSetCompleted(current.clientId, false);
        return;
      }
      completeDurationSet(index);
    },
    [
      completedStrengthSetIds,
      completeDurationSet,
      setStrengthSetCompleted,
      strengthSets,
    ],
  );

  const toggleStrengthSetCompleted = useCallback(
    (index: number) => {
      const current = strengthSets[index];
      if (!current) return;
      setStrengthSetCompleted(
        current.clientId,
        !completedStrengthSetIds.has(current.clientId),
      );
    },
    [completedStrengthSetIds, setStrengthSetCompleted, strengthSets],
  );

  const removeStrengthSet = useCallback(
    (index: number) => {
      const clientId = strengthSets[index]?.clientId;
      setStrengthSets((prev) => prev.filter((_, i) => i !== index));
      if (clientId) setStrengthSetCompleted(clientId, false);
    },
    [setStrengthSetCompleted, strengthSets],
  );

  // Sprint 2 — reaplica somente as cargas da execução anterior.
  // Repetições continuam sendo o resultado real de hoje, especialmente em
  // séries até a falha. Campos já digitados nunca são sobrescritos.
  const applyHistoryEntryToExercise = useCallback(
    (exerciseKey: string, entry: ExerciseHistoryEntry) => {
      setStrengthSets((prev) => {
        let position = 0;
        return prev.map((set) => {
          if (
            exerciseHistoryKey(set.exerciseId, set.exercise) !== exerciseKey
          ) {
            return set;
          }
          const source =
            entry.sets[position] ?? entry.sets[entry.sets.length - 1] ?? null;
          position += 1;
          if (!source) return set;
          const next = { ...set };
          if (next.weightKg == null && source.weightKg != null) {
            next.weightKg = source.weightKg;
          }
          return next;
        });
      });
      setHistoryAppliedMessage(t("workout.history.applied"));
      navigator.vibrate?.(30);
    },
    [t],
  );

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
  const finishPromptIsVeryShort = isVeryShortWorkout(
    finishPromptElapsedS ?? elapsedS,
  );
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
        "completed" | "completedCount" | "loadType" | "totalCount"
      >
    > = [];

    strengthSets.forEach((set, index) => {
      const name = set.exercise?.trim() || t("workout.sets.untitledExercise");
      const exerciseId = set.exerciseId ?? null;
      const techniqueId = set.techniqueId ?? null;
      const targetKind = set.targetKind ?? "reps";
      const previous = groups[groups.length - 1];
      if (
        previous &&
        previous.name === name &&
        previous.exerciseId === exerciseId &&
        previous.techniqueId === techniqueId &&
        previous.targetKind === targetKind
      ) {
        previous.sets.push({ index, set });
        return;
      }
      groups.push({
        exerciseId,
        key: `${exerciseId ?? name}-${techniqueId ?? "plain"}-${index}`,
        name,
        sets: [{ index, set }],
        targetKind,
        techniqueId,
        techniqueName: set.techniqueName ?? null,
        techniqueNotes: set.techniqueNotes ?? null,
      });
    });

    return groups.map((group) => {
      const completedCount = group.sets.filter(({ set }) =>
        completedStrengthSetIds.has(set.clientId),
      ).length;
      return {
        ...group,
        completed:
          group.sets.length > 0 && completedCount === group.sets.length,
        completedCount,
        loadType: resolveExerciseLoadType(group.sets.map(({ set }) => set)),
        totalCount: group.sets.length,
      };
    });
  }, [completedStrengthSetIds, strengthSets, t]);

  const safeActiveStrengthExerciseIndex =
    strengthExerciseGroups.length > 0
      ? Math.min(activeStrengthExerciseIndex, strengthExerciseGroups.length - 1)
      : 0;

  const goToStrengthExercise = useCallback(
    (requestedIndex: number) => {
      const lastIndex = strengthExerciseGroups.length - 1;
      if (lastIndex < 0) return;
      const nextIndex = Math.max(0, Math.min(requestedIndex, lastIndex));
      const scroller = exerciseCarouselRef.current;
      const card = exerciseCardRefs.current[nextIndex];
      if (scroller && card) {
        scroller.scrollTo({
          behavior: "smooth",
          left: card.offsetLeft - (scroller.clientWidth - card.offsetWidth) / 2,
        });
      }
      setActiveStrengthExerciseIndex(nextIndex);

      if (exerciseScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(exerciseScrollFrameRef.current);
      }
      exerciseScrollFrameRef.current = window.requestAnimationFrame(() => {
        exerciseScrollFrameRef.current = window.requestAnimationFrame(() => {
          const dialog = workoutDialogRef.current;
          const section = setsSectionRef.current;
          exerciseScrollFrameRef.current = null;
          if (!dialog || !section) return;
          const targetTop =
            dialog.scrollTop +
            section.getBoundingClientRect().top -
            dialog.getBoundingClientRect().top -
            12;
          dialog.scrollTo({
            behavior: "smooth",
            top: Math.max(0, targetTop),
          });
        });
      });
    },
    [strengthExerciseGroups.length],
  );

  const addCatalogExerciseToLiveWorkout = useCallback(
    (exercise: WorkoutExerciseCatalogItem) => {
      const exerciseName = i18n.language.toLowerCase().startsWith("en")
        ? exercise.nameEn
        : exercise.namePt;
      const existingGroupIndex = strengthExerciseGroups.findIndex(
        (group) => group.exerciseId === exercise.id,
      );

      if (existingGroupIndex >= 0) {
        const existingGroup = strengthExerciseGroups[existingGroupIndex];
        addStrengthSetForGroup(existingGroup);
        setLiveExercisePickerOpen(false);
        window.requestAnimationFrame(() =>
          goToStrengthExercise(existingGroupIndex),
        );
        return;
      }

      const targetKind =
        exercise.defaultTargetKind === "duration"
          ? "duration"
          : exercise.defaultTargetKind === "failure"
            ? "failure"
            : "reps";
      const loadType =
        exercise.defaultLoadType ??
        inferExerciseLoadType({
          equipment: exercise.equipment,
          exerciseName,
        });
      const clientId = nextLiveStrengthSetId();
      const nextSet = createAddedStrengthExerciseSet({
        clientId,
        exerciseId: exercise.id,
        exerciseName,
        loadType,
        targetKind,
        plannedReps:
          targetKind === "duration" ? null : exercise.defaultReps,
        plannedDurationSeconds:
          targetKind === "duration" ? exercise.defaultDurationS : null,
        targetRestS: exercise.defaultRestS,
      });

      pendingStrengthExerciseIndexRef.current = strengthExerciseGroups.length;
      setStrengthSets((current) => [...current, nextSet]);
      setLiveExercisePickerOpen(false);
    },
    [
      addStrengthSetForGroup,
      goToStrengthExercise,
      i18n.language,
      strengthExerciseGroups,
    ],
  );

  useEffect(() => {
    const pendingIndex = pendingStrengthExerciseIndexRef.current;
    if (
      pendingIndex === null ||
      pendingIndex >= strengthExerciseGroups.length
    ) {
      return;
    }
    pendingStrengthExerciseIndexRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      goToStrengthExercise(pendingIndex);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [goToStrengthExercise, strengthExerciseGroups.length]);

  const completeStrengthExercise = useCallback(
    (group: StrengthExerciseGroup, groupIndex: number) => {
      const durationById = new Map<string, number>();
      const completedIds = new Set(
        group.sets.flatMap(({ set }) => {
          if (set.targetKind === "duration") {
            const durationSeconds =
              set.durationSeconds ?? set.plannedDurationSeconds;
            if (!durationSeconds || durationSeconds <= 0) return [];
            durationById.set(set.clientId, durationSeconds);
            return [set.clientId];
          }
          return set.reps > 0 ? [set.clientId] : [];
        }),
      );
      if (durationById.size > 0) {
        setStrengthSets((current) =>
          current.map((set) => {
            const durationSeconds = durationById.get(set.clientId);
            return durationSeconds ? { ...set, durationSeconds } : set;
          }),
        );
      }
      if (completedIds.size > 0) {
        setCompletedStrengthSetIds((current) => {
          const next = new Set(current);
          completedIds.forEach((id) => next.add(id));
          return next;
        });
        navigator.vibrate?.(45);
      }
      if (groupIndex < strengthExerciseGroups.length - 1) {
        autoAdvancedExerciseKeysRef.current.add(group.key);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        window.setTimeout(() => goToStrengthExercise(groupIndex + 1), 120);
      }
    },
    [goToStrengthExercise, strengthExerciseGroups.length],
  );

  const skipStrengthExercise = useCallback(
    (group: StrengthExerciseGroup, groupIndex: number) => {
      const groupIds = new Set(group.sets.map(({ set }) => set.clientId));
      setStrengthSets((current) =>
        current.map((set) =>
          groupIds.has(set.clientId)
            ? { ...set, setStatus: "skipped" as const }
            : set,
        ),
      );
      setCompletedStrengthSetIds((current) => {
        const next = new Set(current);
        groupIds.forEach((id) => next.delete(id));
        return next;
      });
      if (groupIndex < strengthExerciseGroups.length - 1) {
        goToStrengthExercise(groupIndex + 1);
      }
    },
    [goToStrengthExercise, strengthExerciseGroups.length],
  );

  const handleStrengthExercisePrimaryAction = useCallback(
    (group: StrengthExerciseGroup, groupIndex: number) => {
      if (group.completed && groupIndex < strengthExerciseGroups.length - 1) {
        goToStrengthExercise(groupIndex + 1);
        return;
      }
      completeStrengthExercise(group, groupIndex);
    },
    [
      completeStrengthExercise,
      goToStrengthExercise,
      strengthExerciseGroups.length,
    ],
  );

  useEffect(() => {
    if (session?.activityType !== "strength") return;
    const currentGroup =
      strengthExerciseGroups[safeActiveStrengthExerciseIndex];
    if (!currentGroup?.completed) return;
    if (safeActiveStrengthExerciseIndex >= strengthExerciseGroups.length - 1) {
      return;
    }
    if (autoAdvancedExerciseKeysRef.current.has(currentGroup.key)) return;
    autoAdvancedExerciseKeysRef.current.add(currentGroup.key);
    const nextIndex = safeActiveStrengthExerciseIndex + 1;
    const timeout = window.setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      goToStrengthExercise(nextIndex);
    }, 240);
    return () => window.clearTimeout(timeout);
  }, [
    safeActiveStrengthExerciseIndex,
    goToStrengthExercise,
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
  const filledStrengthSetCount = strengthSets.filter((set) =>
    completedStrengthSetIds.has(set.clientId),
  ).length;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {historyAppliedMessage}
      </p>
      {catalogInfo ? (
        <WorkoutCatalogInfoSheet
          info={catalogInfo}
          onClose={() => setCatalogInfo(null)}
        />
      ) : null}
      {liveExercisePickerOpen &&
      stage === "live" &&
      session?.activityType === "strength" ? (
        <WorkoutExercisePicker
          error={catalogError}
          exercises={catalogExercises}
          favoriteExerciseIds={favoriteExerciseIds}
          loading={catalogLoading}
          muscleGroups={muscleGroups}
          onClose={() => setLiveExercisePickerOpen(false)}
          onRetry={() => void refreshCatalog()}
          onSelect={addCatalogExerciseToLiveWorkout}
          onToggleFavorite={(exerciseId) =>
            void toggleFavoriteExercise(exerciseId)
          }
          recentExerciseIds={recentExerciseIds}
        />
      ) : null}
      {detailWorkoutPlan ? (
        <WorkoutPlanDetailSheet
          executions={workoutPlanExecutions.executions}
          loading={workoutPlanExecutions.loading}
          onClose={() => setDetailPlanId(null)}
          onRepeat={() => {
            setDetailPlanId(null);
            startWorkoutPlan(detailWorkoutPlan, "saved_plan");
          }}
          plan={detailWorkoutPlan}
        />
      ) : null}
      {historySheetKey ? (
        <div
          aria-label={t("workout.history.title")}
          aria-modal="true"
          className="fixed inset-0 z-[99] flex items-end justify-center bg-black/72 px-4 pb-[calc(var(--gc-safe-bottom)+16px)] backdrop-blur-md"
          role="dialog"
        >
          <button
            aria-label={t("common.close")}
            className="absolute inset-0"
            onClick={() => setHistorySheetKey(null)}
            type="button"
          />
          <div className="relative w-full max-w-[448px] rounded-[26px] border border-white/[0.09] bg-[#101214] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-black text-white">
                {t("workout.history.title")}
              </h3>
              <button
                aria-label={t("common.close")}
                className="gc-pressable grid size-9 place-items-center rounded-full bg-white/[0.07] text-white/75"
                onClick={() => setHistorySheetKey(null)}
                type="button"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>
            <div className="mt-4 grid max-h-[46vh] gap-2 overflow-y-auto">
              {(strengthHistory.historyByKey.get(historySheetKey) ?? [])
                .slice(0, 10)
                .map((entry) => (
                  <div
                    className="flex items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-3"
                    key={entry.activityId}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white/40">
                        {new Intl.DateTimeFormat(i18n.language, {
                          day: "numeric",
                          month: "short",
                          timeZone: "America/Sao_Paulo",
                        }).format(new Date(entry.performedAt))}
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-black tabular-nums text-white">
                        {lastPerformanceLabel(entry)}
                      </p>
                      {entry.totalVolumeKg > 0 ? (
                        <p className="text-[11.5px] font-bold text-white/45">
                          {t("workout.history.volume", {
                            value: entry.totalVolumeKg.toLocaleString(
                              i18n.language,
                              { maximumFractionDigits: 1 },
                            ),
                          })}
                        </p>
                      ) : entry.totalDurationSeconds > 0 ? (
                        <p className="text-[11.5px] font-bold text-white/45">
                          {t("workout.history.duration", {
                            value: entry.totalDurationSeconds,
                          })}
                        </p>
                      ) : null}
                    </div>
                    {entry.totalReps > 0 ? (
                      <button
                        className="gc-pressable shrink-0 rounded-full bg-[var(--gc-brand)]/12 px-3.5 py-2 text-[11px] font-black text-[var(--gc-brand)]"
                        onClick={() => {
                          applyHistoryEntryToExercise(historySheetKey, entry);
                          setHistorySheetKey(null);
                        }}
                        type="button"
                      >
                        {t("workout.history.use")}
                      </button>
                    ) : null}
                  </div>
                ))}
              {(strengthHistory.historyByKey.get(historySheetKey) ?? [])
                .length === 0 ? (
                <p className="py-8 text-center text-[13px] font-semibold text-white/45">
                  {t("workout.history.empty")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {renameTarget ? (
        <div
          aria-label={t("workoutPlans.rename")}
          aria-modal="true"
          className="fixed inset-0 z-[99] flex items-end justify-center bg-black/72 px-4 pb-[calc(var(--gc-safe-bottom)+16px)] backdrop-blur-md"
          role="dialog"
        >
          <button
            aria-label={t("common.close")}
            className="absolute inset-0"
            onClick={() => setRenameTarget(null)}
            type="button"
          />
          <div className="relative w-full max-w-[448px] rounded-[24px] border border-white/[0.08] bg-[#101214] p-5">
            <h3 className="text-[18px] font-black text-white">
              {t("workoutPlans.rename")}
            </h3>
            <p className="mt-1 text-[12px] font-bold text-white/42">
              {t("workoutPlans.renameHint")}
            </p>
            <input
              autoFocus
              className="mt-4 w-full rounded-[15px] border border-white/[0.07] bg-white/[0.06] px-4 py-3 text-[16px] font-black text-white outline-none placeholder:text-white/28 focus:border-[var(--gc-brand)]"
              maxLength={80}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder={t("workoutPlans.namePlaceholder")}
              value={renameValue}
            />
            {renameError ? (
              <p className="mt-3 text-[11.5px] font-bold text-[var(--gc-pink)]">
                {renameError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="gc-pressable h-12 rounded-full bg-white/[0.07] text-[13px] font-black text-white"
                onClick={() => setRenameTarget(null)}
                type="button"
              >
                {t("common.cancel")}
              </button>
              <button
                className="gc-pressable h-12 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-[var(--gc-brand-ink)] disabled:opacity-40"
                disabled={!renameValue.trim() || renameSaving}
                onClick={() => void handleRenameWorkoutPlan()}
                type="button"
              >
                {renameSaving ? t("workoutPlans.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div
        aria-label={
          finishedSummary
            ? t("workout.summary.title")
            : stage === "pick"
              ? t("workout.pickTitle")
              : t("workout.inProgress")
        }
        aria-modal="true"
        className="fixed inset-0 z-[95] flex justify-center overflow-y-auto bg-black"
        ref={workoutDialogRef}
        role="dialog"
      >
      <div className="flex min-h-full w-full max-w-[480px] flex-col px-5 pb-[calc(var(--gc-safe-bottom)+18px)] pt-[calc(var(--gc-safe-top)+16px)]">
        {finishedSummary ? (
          <WorkoutCompletionSummary
            data={finishedSummary}
            onAddPhoto={() =>
              onCompose({
                ...finishedSummary.context,
                initialComposerStep: "media",
              })
            }
            onClose={() => {
              setFinishedSummary(null);
              onClose();
            }}
            onSaveWorkoutNote={
              onUpdateWorkoutNotes
                ? (note) =>
                    onUpdateWorkoutNotes(finishedSummary.context.id, {
                      workoutNote: note,
                    })
                : undefined
            }
            onShare={() =>
              onCompose({
                ...finishedSummary.context,
                initialComposerStep: "details",
              })
            }
          />
        ) : stage === "pick" ? (
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
            <div className="mt-7 pb-24">
              <section className="h-[198px]">
                <div className="flex items-end justify-between gap-3 px-1">
                  <div>
                    <h3 className="text-[16px] font-black text-white">
                      {t("workout.saved.title")}
                    </h3>
                    <p className="mt-0.5 text-[11.5px] font-bold text-white/42">
                      {t("workout.saved.subtitle")}
                    </p>
                  </div>
                  <button
                    className="gc-pressable text-[11.5px] font-black text-[var(--gc-brand)]"
                      onClick={() =>
                        setCreatePlanRequestKey((value) => value + 1)
                      }
                    type="button"
                  >
                    {t("workout.saved.create")}
                  </button>
                </div>

                {workoutPlansLoading && savedWorkoutPlans.length === 0 ? (
                  <div
                    aria-label={t("common.loading")}
                    className="mt-3 h-[136px] w-[78%] animate-pulse rounded-[24px] border border-white/[0.06] bg-white/[0.045] p-4"
                  >
                    <div className="h-4 w-2/3 rounded bg-white/[0.08]" />
                    <div className="mt-3 h-3 w-1/2 rounded bg-white/[0.06]" />
                    <div className="mt-7 h-10 w-full rounded-full bg-white/[0.07]" />
                  </div>
                ) : workoutPlansError && quickWorkoutPlans.length === 0 ? (
                  <div className="mt-3 flex h-[136px] items-center justify-center rounded-[24px] border border-white/[0.07] bg-[#0b0d0e] px-5 text-center">
                    <div>
                      <p className="text-[12px] font-bold text-white/48">
                        {t("workout.saved.loadError")}
                      </p>
                      <button
                        className="gc-pressable mt-3 rounded-full bg-white/[0.07] px-4 py-2 text-[12px] font-black text-white"
                        onClick={() => void refreshWorkoutPlans()}
                        type="button"
                      >
                        {t("common.retry")}
                      </button>
                    </div>
                  </div>
                ) : quickWorkoutPlans.length === 0 ? (
                  <button
                    className="gc-pressable mt-3 flex h-[136px] w-full items-center gap-4 rounded-[24px] border border-dashed border-[var(--gc-brand)]/22 bg-[var(--gc-brand)]/[0.045] p-4 text-left"
                      onClick={() =>
                        setCreatePlanRequestKey((value) => value + 1)
                      }
                    type="button"
                  >
                    <span className="grid size-12 shrink-0 place-items-center rounded-[16px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                      <Plus size={21} strokeWidth={2.7} />
                    </span>
                    <span>
                      <span className="block text-[14px] font-black text-white">
                        {t("workout.saved.emptyTitle")}
                      </span>
                      <span className="mt-1 block text-[11.5px] font-bold leading-snug text-white/42">
                        {t("workout.saved.emptyHint")}
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className="gc-scrollbar -mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
                    {quickWorkoutPlans.map((plan) => {
                      const isLegacyName =
                        getWorkoutPlanDisplayName(plan.name, "") === "";
                        const isSuggested =
                          suggestedWorkoutPlan?.id === plan.id;
                      const planStats = [
                        plan.stats?.timesUsed
                          ? t("workout.saved.timesUsed", {
                              count: plan.stats.timesUsed,
                            })
                          : null,
                        (plan.stats?.averageDurationS ?? 0) > 0
                          ? t("workout.saved.averageDuration", {
                              duration: formatElapsed(
                                Math.round(plan.stats?.averageDurationS ?? 0),
                              ),
                            })
                          : null,
                        (plan.stats?.averageCompletionRate ?? 0) > 0
                          ? t("workout.saved.averageCompletion", {
                              percent: Math.round(
                                  (plan.stats?.averageCompletionRate ?? 0) *
                                    100,
                              ),
                            })
                          : null,
                      ].filter(Boolean);
                      return (
                        <article
                          className="h-[136px] w-[78%] min-w-[272px] shrink-0 snap-start rounded-[24px] border border-[var(--gc-brand)]/16 bg-[linear-gradient(135deg,rgba(92,232,255,0.11),rgba(11,13,14,0.98)_52%,rgba(48,213,255,0.04))] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
                          key={plan.id}
                        >
                          <div className="flex items-start gap-3">
                            <span className="grid size-10 shrink-0 place-items-center rounded-[14px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                              {isSuggested ? (
                                <Sparkles size={19} strokeWidth={2.4} />
                              ) : (
                                <Dumbbell size={19} strokeWidth={2.4} />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              {isSuggested ? (
                                <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-[var(--gc-brand)]">
                                  {t("workout.recommendation.title")}
                                </p>
                              ) : null}
                              <h4 className="truncate text-[15px] font-black text-white">
                                {getWorkoutPlanDisplayName(
                                  plan.name,
                                  t("workoutPlans.unnamed"),
                                )}
                              </h4>
                              <p className="mt-1 truncate text-[11px] font-bold text-white/42">
                                {isSuggested &&
                                workoutRecommendation.recommendation
                                  ? `${t(`workout.recommendation.reasons.${workoutRecommendation.recommendation.reasonCode}`)} · `
                                  : ""}
                                {t("workout.sets.exerciseCount", {
                                  count: plan.exercises.length,
                                })}
                                {planStats.length > 0
                                  ? ` · ${planStats.join(" · ")}`
                                  : ""}
                              </p>
                            </div>
                            <button
                              aria-label={
                                plan.isFavorite
                                  ? t("workout.saved.removeFavorite")
                                  : t("workout.saved.addFavorite")
                              }
                              aria-pressed={Boolean(plan.isFavorite)}
                              className="gc-pressable grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/55"
                              onClick={() => void toggleFavorite(plan.id)}
                              type="button"
                            >
                              <Star
                                  className={
                                    plan.isFavorite ? "text-[#ffd60a]" : ""
                                  }
                                  fill={
                                    plan.isFavorite ? "currentColor" : "none"
                                  }
                                size={14}
                              />
                            </button>
                            {isLegacyName ? (
                              <button
                                aria-label={t("workoutPlans.rename")}
                                className="gc-pressable grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/55"
                                onClick={() => openRenameWorkoutPlan(plan)}
                                type="button"
                              >
                                <Pencil size={14} />
                              </button>
                            ) : null}
                          </div>
                          <div className="mt-3 grid grid-cols-[0.8fr_1.2fr] gap-2">
                            <button
                              className="gc-pressable flex h-10 items-center justify-center rounded-full bg-white/[0.07] text-[11.5px] font-black text-white/72"
                              onClick={() => setDetailPlanId(plan.id)}
                              type="button"
                            >
                              {t("workout.planDetail.open")}
                            </button>
                            <button
                              className="gc-pressable flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[12px] font-black text-[var(--gc-brand-ink)]"
                              onClick={() =>
                                startWorkoutPlan(
                                  plan,
                                  isSuggested ? "suggested" : "saved_plan",
                                )
                              }
                              type="button"
                            >
                              <Play fill="currentColor" size={14} />
                              {t("workoutPlans.start")}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="mt-8 space-y-2.5">
                <div className="mb-3 px-1">
                  <h3 className="text-[16px] font-black text-white">
                    {t("workout.modalities.title")}
                  </h3>
                  <p className="mt-0.5 text-[11.5px] font-bold text-white/42">
                    {t("workout.modalities.subtitle")}
                  </p>
                </div>
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
                        <Play
                          className="ml-0.5"
                          fill="currentColor"
                          size={16}
                        />
                  </span>
                </button>
              ))}
              </section>
            </div>
            <WorkoutPlansFabControlled
              catalog={workoutCatalog}
              createRequestKey={createPlanRequestKey}
              onImport={() => setHealthImportOpen(true)}
              onStartPlan={startWorkoutPlan}
              plansController={workoutPlansController}
              triggerPlacement="inline"
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

            <main className="flex flex-1 flex-col pb-[118px]">
              <section
                className={[
                  "text-center",
                  session.activityType === "strength" ? "pt-6" : "pt-10",
                ].join(" ")}
              >
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/42">
                  {t("workout.elapsed")}
                </p>
                <p
                  aria-label={`${t("workout.elapsed")}: ${formatElapsed(elapsedS)}`}
                  className={[
                    "mt-1 font-black leading-none tracking-[-0.065em] tabular-nums",
                    session.activityType === "strength"
                      ? "text-[58px]"
                      : "text-[78px]",
                    isPaused ? "text-[#ffd60a]" : "text-[var(--gc-brand)]",
                  ].join(" ")}
                >
                  {formatElapsed(elapsedS)}
                </p>
              </section>

              <section
                className={[
                  "grid grid-cols-3 gap-x-5 border-y border-white/[0.07]",
                  session.activityType === "strength"
                    ? "mt-5 py-4"
                    : "mt-8 py-5",
                ].join(" ")}
              >
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
                  <section
                    className="-mx-5 mt-5 scroll-mt-5"
                    ref={setsSectionRef}
                  >
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
                          aria-haspopup="dialog"
                          onClick={() => setLiveExercisePickerOpen(true)}
                          type="button"
                        >
                          <Plus size={16} strokeWidth={2.8} />
                          {t("workout.sets.addExercise")}
                        </button>
                      </article>
                    ) : (
                      strengthExerciseGroups.map((group, groupIndex) => {
                        const remainingSets = Math.max(
                          0,
                          group.totalCount - group.completedCount,
                        );
                          const showsWeightInput =
                            group.loadType === "external" ||
                            group.loadType === "assisted";
                          const canCompleteGroup = group.sets.every(
                            ({ set }) =>
                          group.targetKind === "duration"
                            ? Boolean(
                                set.durationSeconds ??
                                  set.plannedDurationSeconds,
                              )
                            : set.reps > 0,
                        );
                        const isCurrentGroup =
                          groupIndex === safeActiveStrengthExerciseIndex;
                          const restSetClientId =
                            [...group.sets]
                              .reverse()
                              .find(
                                ({ set }) =>
                                  completedStrengthSetIds.has(set.clientId) &&
                                  set.actualRestS == null,
                              )?.set.clientId ?? null;
                        const historyKey = exerciseHistoryKey(
                          group.exerciseId,
                          group.name,
                        );
                        const lastEntry = historyKey
                            ? (strengthHistory.historyByKey.get(
                                historyKey,
                              )?.[0] ?? null)
                          : null;
                        return (
                        <article
                          className="flex w-[calc(100%_-_40px)] min-w-[calc(100%_-_40px)] shrink-0 snap-center flex-col overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b0d0e] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]"
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
                              <p className="text-[11px] font-black uppercase tracking-[0.13em] text-[var(--gc-brand)]">
                                {t("workout.sets.exercisePosition", {
                                  current: groupIndex + 1,
                                  total: strengthExerciseGroups.length,
                                })}
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
                                    aria-label={t(
                                      "workoutCatalog.aboutExercise",
                                    )}
                                className="gc-pressable grid size-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[var(--gc-brand)]"
                                    onClick={() =>
                                      openExerciseInfo(group.exerciseId)
                                    }
                                type="button"
                              >
                                <Info size={15} />
                              </button>
                            ) : null}
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-[var(--gc-brand)]/10 px-3 py-1.5 text-[11px] font-black text-[var(--gc-brand)]">
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
                              <span className="rounded-full bg-white/[0.055] px-3 py-1.5 text-[10.5px] font-black text-white/50">
                                {t("workout.sets.remaining", {
                                  count: remainingSets,
                                })}
                              </span>
                            )}
                            <span className="rounded-full bg-white/[0.045] px-3 py-1.5 text-[10px] font-black text-white/35">
                              {group.targetKind === "duration"
                                ? t("workout.sets.durationMode")
                                : group.targetKind === "failure"
                                  ? t("workout.sets.failureMode")
                                  : t("workout.sets.swipeHint")}
                            </span>
                          </div>

                              {group.targetKind !== "duration" ? (
                                <label className="mt-3 flex items-center justify-between gap-3 rounded-[15px] border border-white/[0.055] bg-white/[0.025] px-3 py-2.5">
                                  <span className="text-[10px] font-black uppercase tracking-[0.11em] text-white/38">
                                    {t("workout.sets.exerciseLoadType")}
                                  </span>
                                  <select
                                    aria-label={t(
                                      "workout.sets.exerciseLoadType",
                                    )}
                                    className="min-w-0 max-w-[58%] rounded-full border border-white/[0.07] bg-white/[0.07] px-3 py-2 text-right text-[11px] font-black text-white outline-none focus:border-[var(--gc-brand)]"
                                    onChange={(event) =>
                                      updateStrengthExerciseLoadType(
                                        group,
                                        event.target.value as ExerciseLoadType,
                                      )
                                    }
                                    value={group.loadType}
                                  >
                                    <option value="external">
                                      {t("workout.sets.loadTypes.external")}
                                    </option>
                                    <option value="bodyweight">
                                      {t("workout.sets.loadTypes.bodyweight")}
                                    </option>
                                    <option value="assisted">
                                      {t("workout.sets.loadTypes.assisted")}
                                    </option>
                                    <option value="not_provided">
                                      {t("workout.sets.loadTypes.notProvided")}
                                    </option>
                                  </select>
                                </label>
                              ) : null}

                          {strengthHistory.loading && isCurrentGroup ? (
                            <div
                              aria-label={t("common.loading")}
                              className="mt-3 h-[52px] animate-pulse rounded-[16px] border border-white/[0.05] bg-white/[0.025]"
                              role="status"
                            />
                          ) : strengthHistory.error && isCurrentGroup ? (
                            <button
                              className="gc-pressable mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] border border-white/[0.06] bg-white/[0.03] px-3 py-3 text-[11.5px] font-black text-white/65"
                              onClick={strengthHistory.refresh}
                              type="button"
                            >
                              <RefreshCw size={14} />
                                  {t("workout.history.loadError")}{" "}
                                  {t("common.retry")}
                            </button>
                          ) : lastEntry && historyKey ? (
                            <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-2 pl-3">
                              <button
                                aria-label={t("workout.history.title")}
                                className="gc-pressable flex min-w-0 flex-1 items-center gap-2 text-left"
                                    onClick={() =>
                                      setHistorySheetKey(historyKey)
                                    }
                                type="button"
                              >
                                <History
                                  className="shrink-0 text-white/40"
                                  size={15}
                                />
                                <span className="min-w-0">
                                  <span className="block text-[9.5px] font-black uppercase tracking-[0.12em] text-white/38">
                                    {t("workout.history.lastTime")}
                                  </span>
                                  <span className="block truncate text-[13px] font-black tabular-nums text-white/85">
                                    {lastPerformanceLabel(lastEntry)}
                                  </span>
                                </span>
                              </button>
                              {group.targetKind !== "duration" ? (
                                <button
                                  className="gc-pressable shrink-0 rounded-full bg-[var(--gc-brand)]/12 px-3 py-2 text-[11px] font-black text-[var(--gc-brand)]"
                                  onClick={() =>
                                    applyHistoryEntryToExercise(
                                      historyKey,
                                      lastEntry,
                                    )
                                  }
                                  type="button"
                                >
                                  {t("workout.history.usePrevious")}
                                </button>
                              ) : null}
                            </div>
                          ) : null}

                          {group.targetKind === "duration" ? (
                            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.12em] text-white/35">
                              {t("workout.sets.duration")}
                            </p>
                          ) : (
                            <div
                              aria-hidden="true"
                                  className={[
                                    "mt-4 grid gap-2 px-0.5 text-center text-[9px] font-black uppercase tracking-[0.12em] text-white/35",
                                    showsWeightInput
                                      ? "grid-cols-[24px_minmax(0,1fr)_12px_minmax(0,0.82fr)_58px]"
                                      : "grid-cols-[24px_minmax(0,1fr)_58px]",
                                  ].join(" ")}
                            >
                              <span />
                              <span>{t("workout.sets.reps")}</span>
                                  {showsWeightInput ? <span /> : null}
                                  {showsWeightInput ? (
                                    <span>
                                      {group.loadType === "assisted"
                                        ? t("workout.sets.assistanceKg")
                                        : t("workout.sets.kg")}
                                    </span>
                                  ) : null}
                              <span />
                            </div>
                          )}

                          {group.targetKind === "failure" ? (
                            <p className="mt-2 px-1 text-[11px] font-semibold leading-snug text-white/46">
                              {t("workout.sets.failureWeightHint")}
                            </p>
                          ) : null}

                          <div className="mt-2 grid gap-2">
                            {group.sets.map(({ index, set }, setIndex) => {
                                  const setCompleted =
                                    completedStrengthSetIds.has(set.clientId);
                              if (group.targetKind === "duration") {
                                return (
                                  <div
                                    className={[
                                      "grid grid-cols-[24px_minmax(0,1fr)_88px_28px] items-center gap-2 rounded-[16px] border p-2",
                                      setCompleted
                                        ? "border-[var(--gc-brand)]/35 bg-[var(--gc-brand)]/[0.06]"
                                        : "border-white/[0.06] bg-white/[0.025]",
                                    ].join(" ")}
                                    key={set.clientId}
                                  >
                                    <span className="w-6 text-[12px] font-black tabular-nums text-white/40">
                                      {setIndex + 1}
                                    </span>
                                    <label className="min-w-0">
                                      <span className="sr-only">
                                        {t("workout.sets.duration")}
                                      </span>
                                      <div className="flex items-center rounded-[13px] bg-white/[0.07] px-3">
                                        <input
                                              aria-label={t(
                                                "workout.sets.duration",
                                              )}
                                          className="min-w-0 flex-1 bg-transparent py-3 text-center text-[17px] font-black tabular-nums text-white outline-none placeholder:text-white/30"
                                          data-workout-set-input="true"
                                          inputMode="numeric"
                                              onBlur={
                                                handleStrengthSetInputBlur
                                              }
                                          onChange={(event) =>
                                            updateStrengthSetDuration(
                                              index,
                                              event.target.value,
                                            )
                                          }
                                              onFocus={() =>
                                                setSetsInputFocused(true)
                                              }
                                          placeholder={String(
                                            set.plannedDurationSeconds ??
                                              t(
                                                "workout.sets.durationPlaceholder",
                                              ),
                                          )}
                                          value={
                                            set.durationSeconds
                                              ? String(set.durationSeconds)
                                              : ""
                                          }
                                        />
                                        <span className="text-[11px] font-black text-white/35">
                                          s
                                        </span>
                                      </div>
                                    </label>
                                    <button
                                      aria-label={
                                        setCompleted
                                          ? t("workout.sets.markIncomplete")
                                          : t("workout.sets.completeSet")
                                      }
                                      aria-pressed={setCompleted}
                                      className={[
                                        "gc-pressable h-10 rounded-full text-[10px] font-black",
                                        setCompleted
                                          ? "bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]"
                                          : "bg-white/[0.07] text-white",
                                      ].join(" ")}
                                      disabled={
                                        !setCompleted &&
                                        !set.durationSeconds &&
                                        !set.plannedDurationSeconds
                                      }
                                      onClick={() =>
                                        toggleDurationSetCompleted(index)
                                      }
                                      type="button"
                                    >
                                      {setCompleted
                                        ? t("workout.sets.completed")
                                        : t("workout.sets.completeSet")}
                                    </button>
                                    <button
                                      aria-label={t("workout.sets.remove")}
                                      className="gc-pressable text-white/35"
                                          onClick={() =>
                                            removeStrengthSet(index)
                                          }
                                      type="button"
                                    >
                                      <X size={16} strokeWidth={2.6} />
                                    </button>
                                  </div>
                                );
                              }

                              return (
                                    <div
                                      className="grid gap-1"
                                      key={set.clientId}
                                    >
                                  <div
                                    className={[
                                          "grid items-center gap-2 rounded-[15px] border p-2",
                                          showsWeightInput
                                            ? "grid-cols-[24px_minmax(0,1fr)_12px_minmax(0,0.82fr)_58px]"
                                            : "grid-cols-[24px_minmax(0,1fr)_58px]",
                                      setCompleted
                                        ? "border-[var(--gc-brand)]/30 bg-[var(--gc-brand)]/[0.05]"
                                        : "border-white/[0.055] bg-white/[0.02]",
                                    ].join(" ")}
                                  >
                                  <span className="w-6 text-[12px] font-black tabular-nums text-white/40">
                                    {setIndex + 1}
                                  </span>
                                  <input
                                    aria-label={t("workout.sets.reps")}
                                          className="min-w-0 rounded-[12px] border border-white/[0.05] bg-white/[0.07] px-2.5 py-2.5 text-center text-[16px] font-black tabular-nums text-white outline-none placeholder:text-white/28 focus:border-[var(--gc-brand)] focus:bg-white/[0.11]"
                                    data-workout-set-input="true"
                                    inputMode="numeric"
                                    onBlur={handleStrengthSetInputBlur}
                                    onChange={(event) =>
                                      updateStrengthSetReps(
                                        index,
                                        event.target.value,
                                      )
                                    }
                                          onFocus={() =>
                                            setSetsInputFocused(true)
                                          }
                                          placeholder={String(
                                            set.plannedReps ??
                                              t("workout.sets.reps"),
                                          )}
                                          value={
                                            set.reps > 0 ? String(set.reps) : ""
                                          }
                                  />
                                        {showsWeightInput ? (
                                  <span className="text-center text-[13px] font-black text-white/30">
                                    ×
                                  </span>
                                        ) : null}
                                        {showsWeightInput ? (
                                          <input
                                            aria-label={
                                              group.loadType === "assisted"
                                                ? t(
                                                    "workout.sets.assistanceWeight",
                                        )
                                                : t("workout.sets.weight")
                                      }
                                            className="min-w-0 rounded-[12px] border border-white/[0.05] bg-white/[0.07] px-2 py-2.5 text-center text-[15px] font-black tabular-nums text-white outline-none placeholder:text-white/28 focus:border-[var(--gc-brand)] focus:bg-white/[0.11]"
                                        data-workout-set-input="true"
                                        inputMode="decimal"
                                        onBlur={handleStrengthSetInputBlur}
                                        onChange={(event) =>
                                          updateStrengthSetWeight(
                                            index,
                                            event.target.value,
                                                group.loadType,
                                              )
                                            }
                                            onFocus={() =>
                                              setSetsInputFocused(true)
                                            }
                                            placeholder={
                                              group.loadType === "assisted"
                                                ? t(
                                                    "workout.sets.assistancePlaceholder",
                                                  )
                                                : t(
                                                    "workout.sets.weightPlaceholder",
                                          )
                                        }
                                        value={
                                              group.loadType === "assisted"
                                                ? set.assistedWeightKg !=
                                                    null &&
                                              set.assistedWeightKg > 0
                                              ? String(set.assistedWeightKg)
                                              : ""
                                            : set.weightKg != null &&
                                                set.weightKg > 0
                                              ? String(set.weightKg)
                                              : ""
                                        }
                                      />
                                        ) : null}
                                    <div className="flex items-center justify-end gap-1">
                                    <button
                                      aria-label={
                                        setCompleted
                                                ? t(
                                                    "workout.sets.markIncomplete",
                                                  )
                                          : t("workout.sets.completeSet")
                                      }
                                      aria-pressed={setCompleted}
                                      className={[
                                        "gc-pressable grid size-7 place-items-center rounded-full disabled:opacity-30",
                                        setCompleted
                                          ? "bg-[var(--gc-brand)] text-[var(--gc-brand-ink)]"
                                          : "bg-white/[0.07] text-white/55",
                                      ].join(" ")}
                                      disabled={set.reps <= 0}
                                      onClick={() =>
                                        toggleStrengthSetCompleted(index)
                                      }
                                      type="button"
                                    >
                                      <Check size={14} strokeWidth={3} />
                                    </button>
                                    <button
                                            aria-label={t(
                                              "workout.sets.remove",
                                            )}
                                      className="gc-pressable text-white/32"
                                            onClick={() =>
                                              removeStrengthSet(index)
                                            }
                                      type="button"
                                    >
                                      <X size={14} strokeWidth={2.6} />
                                    </button>
                                    </div>
                                  </div>
                                  <WorkoutSetAdvancedFields
                                    onPatch={(patch) =>
                                      patchStrengthSet(index, patch)
                                    }
                                    set={set}
                                    setNumber={setIndex + 1}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          <button
                            className="gc-pressable order-2 mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white/[0.075] text-[13px] font-black text-[var(--gc-brand)]"
                            onClick={() => addStrengthSetForGroup(group)}
                            type="button"
                          >
                            <Plus size={16} strokeWidth={2.8} />
                            {t("workout.sets.addToExercise")}
                          </button>

                          {!group.completed ? (
                            <button
                              className="gc-pressable order-2 mt-2 flex h-10 w-full items-center justify-center rounded-full text-[11.5px] font-black text-white/42"
                              onClick={() =>
                                skipStrengthExercise(group, groupIndex)
                              }
                              type="button"
                            >
                              {t("workout.sets.skipExercise")}
                            </button>
                          ) : null}

                          <button
                            className="gc-pressable order-2 mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-[var(--gc-brand-ink)] disabled:opacity-35"
                            disabled={
                              (group.completed &&
                                groupIndex ===
                                  strengthExerciseGroups.length - 1) ||
                              (!group.completed && !canCompleteGroup)
                            }
                            onClick={() =>
                              handleStrengthExercisePrimaryAction(
                                group,
                                groupIndex,
                              )
                            }
                            type="button"
                          >
                            <Check size={17} strokeWidth={2.8} />
                            {group.completed
                              ? groupIndex <
                                strengthExerciseGroups.length - 1
                                ? t("workout.sets.nextExercise")
                                : t("workout.sets.exerciseCompleted")
                              : t("workout.sets.completeExercise")}
                          </button>

                          {strengthExerciseGroups.length > 1 ? (
                            <div className="order-2 mt-2 grid grid-cols-2 gap-2">
                              <button
                                className="gc-pressable flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/[0.055] text-[11.5px] font-black text-white/65 disabled:opacity-25"
                                disabled={groupIndex === 0}
                                onClick={() =>
                                  goToStrengthExercise(groupIndex - 1)
                                }
                                type="button"
                              >
                                <ChevronLeft size={16} />
                                {t("workout.sets.previousExercise")}
                              </button>
                              <button
                                className="gc-pressable flex h-10 items-center justify-center gap-1.5 rounded-full bg-white/[0.055] text-[11.5px] font-black text-white/65 disabled:opacity-25"
                                disabled={
                                  groupIndex ===
                                  strengthExerciseGroups.length - 1
                                }
                                onClick={() =>
                                  goToStrengthExercise(groupIndex + 1)
                                }
                                type="button"
                              >
                                {t("workout.sets.nextExercise")}
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          ) : null}

                          {isCurrentGroup &&
                          (group.completedCount > 0 ||
                            rest.status === "running" ||
                            rest.status === "paused") ? (
                            <div className="order-1 mt-3 rounded-[20px] border border-white/[0.07] bg-black/30 p-3">
                              <div className="flex items-center gap-2.5">
                                <span className="grid size-9 place-items-center rounded-[13px] bg-[var(--gc-brand)]/12 text-[var(--gc-brand)]">
                                  <Timer size={17} strokeWidth={2.4} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[13px] font-black text-white">
                                    {t("workout.rest.title")}
                                  </p>
                                  <p className="text-[10.5px] font-bold text-white/38">
                                    {t("workout.rest.nextSetHint", {
                                      count: remainingSets,
                                    })}
                                  </p>
                                </div>
                                <p className="text-[28px] font-black tabular-nums text-white">
                                  {formatElapsed(rest.remainingS)}
                                </p>
                              </div>
                              <div className="mt-2.5 grid grid-cols-[38px_1fr_38px] items-center gap-2">
                                <button
                                  aria-label={t("workout.rest.decrease")}
                                  className="gc-pressable grid size-[38px] place-items-center rounded-full bg-white/[0.06] text-white disabled:opacity-30"
                                  disabled={rest.presetS <= 10}
                                  onClick={() =>
                                    dispatchRest({
                                      type: "adjust",
                                      deltaS: -10,
                                      nowMs: Date.now(),
                                    })
                                  }
                                  type="button"
                                >
                                  <Minus size={18} strokeWidth={2.7} />
                                </button>
                                {rest.status === "running" ||
                                rest.status === "paused" ? (
                                  <button
                                    className="gc-pressable h-10 rounded-full bg-white/[0.07] text-[12px] font-black text-white"
                                        onClick={skipRest}
                                    type="button"
                                  >
                                    {t("workout.rest.skip")}
                                  </button>
                                ) : (
                                  <button
                                    className="gc-pressable h-10 rounded-full bg-[var(--gc-brand)] text-[12px] font-black text-[var(--gc-brand-ink)] disabled:opacity-35"
                                    disabled={isPaused}
                                        onClick={() =>
                                          startRest(restSetClientId)
                                        }
                                    type="button"
                                  >
                                    {rest.status === "done"
                                      ? t("workout.rest.restart")
                                      : t("workout.rest.start")}
                                  </button>
                                )}
                                <button
                                  aria-label={t("workout.rest.increase")}
                                  className="gc-pressable grid size-[38px] place-items-center rounded-full bg-white/[0.06] text-white"
                                  onClick={() =>
                                    dispatchRest({
                                      type: "adjust",
                                      deltaS: 10,
                                      nowMs: Date.now(),
                                    })
                                  }
                                  type="button"
                                >
                                  <Plus size={18} strokeWidth={2.7} />
                                </button>
                              </div>
                              {rest.status === "running" ||
                              rest.status === "paused" ? (
                                <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.07]">
                                  <div
                                    className="h-full rounded-full bg-[var(--gc-brand)] transition-[width] duration-500"
                                    style={{ width: `${restProgress}%` }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                        );
                      })
                    )}
                  </div>

                  {strengthExerciseGroups.length > 1 ? (
                    <div className="mt-1 flex justify-center gap-1.5 px-5">
                      {strengthExerciseGroups.map((group, index) => (
                        <button
                          aria-label={t("workout.sets.goToExercise", {
                            current: index + 1,
                          })}
                          className="gc-pressable grid size-8 place-items-center rounded-full"
                          key={group.key}
                          onClick={() => goToStrengthExercise(index)}
                          type="button"
                        >
                          <span
                            className={[
                              "h-1.5 rounded-full transition-all",
                              index === safeActiveStrengthExerciseIndex
                                ? "w-6 bg-[var(--gc-brand)]"
                                : group.completed
                                  ? "w-1.5 bg-[var(--gc-brand)]/75"
                                  : "w-1.5 bg-white/18",
                            ].join(" ")}
                          />
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {strengthExerciseGroups.length > 0 ? (
                    <div className="px-5 pt-2">
                      <button
                        aria-haspopup="dialog"
                        className="gc-pressable flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--gc-brand)]/22 bg-[var(--gc-brand)]/[0.08] px-4 text-[13px] font-black text-[var(--gc-brand)]"
                        onClick={() => setLiveExercisePickerOpen(true)}
                        type="button"
                      >
                        <Plus size={17} strokeWidth={2.8} />
                        {t("workout.sets.addExercise")}
                      </button>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {session.activityType !== "strength" ? (
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
                      <TrendingUp
                        className="text-[var(--gc-brand)]"
                        size={20}
                      />
                    <p className="mt-5 text-[11px] font-black uppercase tracking-[0.14em] text-white/40">
                      {t("workout.metrics.paused")}
                    </p>
                    <p className="mt-1 text-[25px] font-black text-white tabular-nums">
                      {formatElapsed(pausedS)}
                    </p>
                  </div>
                </section>
              ) : null}

              {finishError ? (
                <p className="mt-4 text-center text-[12.5px] font-bold text-[var(--gc-pink)]">
                  {finishError}
                </p>
              ) : null}

              <footer
                className={[
                  "fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[480px] border-t border-white/[0.05] bg-black/94 px-6 pb-[calc(var(--gc-safe-bottom)+7px)] pt-3 backdrop-blur-xl transition-all duration-200",
                  setsInputFocused
                    ? "pointer-events-none translate-y-12 opacity-0"
                    : "translate-y-0 opacity-100",
                ].join(" ")}
              >
                <div className="grid grid-cols-3 items-end gap-5">
                  <button
                    aria-label={t("workout.finish")}
                    className="gc-pressable grid justify-items-center gap-1 text-[10px] font-black text-white/52"
                    disabled={finishing}
                    onClick={() => {
                      setFinishPromptElapsedS(elapsedS);
                      setFinishConfirmOpen(true);
                    }}
                    type="button"
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-[#ff2d55] text-white">
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
                    className="gc-pressable grid justify-items-center gap-1 text-[10px] font-black text-white"
                    onClick={togglePause}
                    type="button"
                  >
                    <span className="grid size-14 place-items-center rounded-full bg-[var(--gc-brand)] text-[var(--gc-brand-ink)] shadow-[0_0_22px_rgba(92,232,255,0.16)]">
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
                    className="gc-pressable grid justify-items-center gap-1 text-[10px] font-black text-white/52"
                    onClick={onClose}
                    type="button"
                  >
                    <span className="grid size-12 place-items-center rounded-full bg-[#17191b] text-white">
                      <ChevronDown size={23} strokeWidth={2.5} />
                    </span>
                    {t("workout.minimizeShort")}
                  </button>
                </div>
                <button
                  className="gc-pressable mt-1 w-full py-1 text-center text-[10px] font-black text-white/24"
                  onClick={() => setDiscardConfirmOpen(true)}
                  type="button"
                >
                  {t("workout.discard")}
                </button>
              </footer>
            </main>

            <ConfirmSheet
              cancelLabel={
                finishPromptIsVeryShort
                  ? t("workout.shortWorkout.continue")
                  : t("common.cancel")
              }
              confirmLabel={
                finishPromptIsVeryShort
                  ? t("workout.shortWorkout.saveAnyway")
                  : t("workout.finish")
              }
              description={
                finishPromptIsVeryShort
                  ? t("workout.shortWorkout.description")
                  : t("workout.finishConfirm.description", {
                      duration: formatElapsed(
                        finishPromptElapsedS ?? elapsedS,
                      ),
                    })
              }
              onClose={() => {
                setFinishConfirmOpen(false);
                setFinishPromptElapsedS(null);
              }}
              onConfirm={handleFinish}
              open={finishConfirmOpen}
              title={
                finishPromptIsVeryShort
                  ? t("workout.shortWorkout.title")
                  : t("workout.finishConfirm.title")
              }
              tone={finishPromptIsVeryShort ? "default" : "destructive"}
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
      <HealthKitImportSheet
        onClose={() => setHealthImportOpen(false)}
        onImport={onFinish}
        onShare={(activity) => {
          setHealthImportOpen(false);
          onCompose(activity);
        }}
        open={healthImportOpen}
      />
    </>
  );
}
