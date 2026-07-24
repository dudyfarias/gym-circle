import type {
  RunningPlanGoal,
  RunningPlanLevel,
  RunningRecoveryType,
  RunningStepType,
  RunningTargetBasis,
  RunningWorkoutPlanStepDraft,
} from "./running";

/**
 * Running Coach Library (Sprint D1) — tipos de domínio + mappers row→domain.
 *
 * Espelha a migração 20260724120000_running_coach_library.sql: templates de
 * sessão reutilizáveis (com steps), programas multi-semana, e o estado por
 * usuário (matrícula + conclusão de sessão). As colunas snake_case viram
 * objetos camelCase 1:1.
 */

export type RunningLibraryOrigin =
  | "official"
  | "professional"
  | "imported"
  | "ai";

export type RunningLibraryVisibility = "public" | "assigned" | "private";

export type RunningEnrollmentStatus = "active" | "completed" | "abandoned";

/**
 * running_session_template_step é um espelho verbatim de workout_plan_steps,
 * então seu step de domínio é o MESMO shape que o engine já consome.
 */
export type RunningSessionTemplateStep = RunningWorkoutPlanStepDraft;

export type RunningSessionTemplate = {
  id: string;
  slug: string;
  ownerUserId: string | null;
  origin: RunningLibraryOrigin;
  visibility: RunningLibraryVisibility;
  title: string;
  description: string | null;
  estimatedDurationS: number | null;
  estimatedDistanceM: number | null;
  primaryStepType: RunningStepType | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  steps: RunningSessionTemplateStep[];
};

export type RunningProgram = {
  id: string;
  slug: string;
  ownerUserId: string | null;
  origin: RunningLibraryOrigin;
  visibility: RunningLibraryVisibility;
  title: string;
  description: string | null;
  level: RunningPlanLevel | null;
  goal: RunningPlanGoal | null;
  weeks: number;
  sessionsPerWeek: number;
  timeBucket: number | null;
  suggestedSpacing: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RunningProgramSession = {
  id: string;
  programId: string;
  weekIndex: number;
  orderInWeek: number;
  sessionTemplateId: string;
  notes: string | null;
};

export type RunningProgramEnrollment = {
  id: string;
  userId: string;
  programId: string;
  status: RunningEnrollmentStatus;
  startedAt: string;
  completedAt: string | null;
};

export type RunningProgramSessionCompletion = {
  id: string;
  enrollmentId: string;
  programSessionId: string;
  activityId: string;
  completedAt: string;
};

export type RunningSessionTemplateRow = {
  id: string;
  slug: string;
  owner_user_id: string | null;
  origin: RunningLibraryOrigin;
  visibility: RunningLibraryVisibility;
  title: string;
  description: string | null;
  estimated_duration_s: number | null;
  estimated_distance_m: number | string | null;
  primary_step_type: RunningStepType | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type RunningSessionTemplateStepRow = {
  id: string;
  session_template_id: string;
  position: number;
  step_type: RunningStepType;
  title: string;
  instructions: string | null;
  repetitions: number;
  repetitions_min: number | null;
  repetitions_max: number | null;
  target_basis: RunningTargetBasis;
  distance_m: number | string | null;
  distance_min_m: number | string | null;
  distance_max_m: number | string | null;
  duration_s: number | null;
  duration_min_s: number | null;
  duration_max_s: number | null;
  pace_min_s_per_km: number | null;
  pace_max_s_per_km: number | null;
  heart_rate_zone: number | null;
  recovery_type: RunningRecoveryType;
  recovery_duration_s: number | null;
  recovery_distance_m: number | string | null;
  target_effort: number | string | null;
  metadata: Record<string, unknown> | null;
};

export type RunningProgramRow = {
  id: string;
  slug: string;
  owner_user_id: string | null;
  origin: RunningLibraryOrigin;
  visibility: RunningLibraryVisibility;
  title: string;
  description: string | null;
  level: RunningPlanLevel | null;
  goal: RunningPlanGoal | null;
  weeks: number;
  sessions_per_week: number;
  time_bucket: number | null;
  suggested_spacing: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type RunningProgramSessionRow = {
  id: string;
  program_id: string;
  week_index: number;
  order_in_week: number;
  session_template_id: string;
  notes: string | null;
};

export type RunningProgramEnrollmentRow = {
  id: string;
  user_id: string;
  program_id: string;
  status: RunningEnrollmentStatus;
  started_at: string;
  completed_at: string | null;
};

export type RunningProgramSessionCompletionRow = {
  id: string;
  enrollment_id: string;
  program_session_id: string;
  activity_id: string;
  completed_at: string;
};

function numberOrNull(value: number | string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function runningSessionTemplateStepFromRow(
  row: RunningSessionTemplateStepRow,
): RunningSessionTemplateStep {
  return {
    id: row.id,
    position: row.position,
    stepType: row.step_type,
    title: row.title,
    instructions: row.instructions,
    repetitions: row.repetitions,
    repetitionsMin: row.repetitions_min,
    repetitionsMax: row.repetitions_max,
    targetBasis: row.target_basis,
    distanceM: numberOrNull(row.distance_m),
    distanceMinM: numberOrNull(row.distance_min_m),
    distanceMaxM: numberOrNull(row.distance_max_m),
    durationS: row.duration_s,
    durationMinS: row.duration_min_s,
    durationMaxS: row.duration_max_s,
    paceMinSPerKm: row.pace_min_s_per_km,
    paceMaxSPerKm: row.pace_max_s_per_km,
    heartRateZone: row.heart_rate_zone,
    recoveryType: row.recovery_type,
    recoveryDurationS: row.recovery_duration_s,
    recoveryDistanceM: numberOrNull(row.recovery_distance_m),
    targetEffort: numberOrNull(row.target_effort),
    metadata: row.metadata ?? {},
  };
}

export function runningSessionTemplateFromRow(
  row: RunningSessionTemplateRow,
  stepRows: RunningSessionTemplateStepRow[] = [],
): RunningSessionTemplate {
  return {
    id: row.id,
    slug: row.slug,
    ownerUserId: row.owner_user_id,
    origin: row.origin,
    visibility: row.visibility,
    title: row.title,
    description: row.description,
    estimatedDurationS: row.estimated_duration_s,
    estimatedDistanceM: numberOrNull(row.estimated_distance_m),
    primaryStepType: row.primary_step_type,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps: stepRows.map(runningSessionTemplateStepFromRow),
  };
}

export function runningProgramFromRow(
  row: RunningProgramRow,
): RunningProgram {
  return {
    id: row.id,
    slug: row.slug,
    ownerUserId: row.owner_user_id,
    origin: row.origin,
    visibility: row.visibility,
    title: row.title,
    description: row.description,
    level: row.level,
    goal: row.goal,
    weeks: row.weeks,
    sessionsPerWeek: row.sessions_per_week,
    timeBucket: row.time_bucket,
    suggestedSpacing: row.suggested_spacing,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function runningProgramSessionFromRow(
  row: RunningProgramSessionRow,
): RunningProgramSession {
  return {
    id: row.id,
    programId: row.program_id,
    weekIndex: row.week_index,
    orderInWeek: row.order_in_week,
    sessionTemplateId: row.session_template_id,
    notes: row.notes,
  };
}

export function runningProgramEnrollmentFromRow(
  row: RunningProgramEnrollmentRow,
): RunningProgramEnrollment {
  return {
    id: row.id,
    userId: row.user_id,
    programId: row.program_id,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function runningProgramSessionCompletionFromRow(
  row: RunningProgramSessionCompletionRow,
): RunningProgramSessionCompletion {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    programSessionId: row.program_session_id,
    activityId: row.activity_id,
    completedAt: row.completed_at,
  };
}
