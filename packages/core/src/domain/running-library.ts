import {
  estimateRunningPlanTotals,
  type RunningPlanGoal,
  type RunningPlanLevel,
  type RunningPlanSource,
  type RunningRecoveryType,
  type RunningStepType,
  type RunningTargetBasis,
  type RunningWorkoutPlan,
  type RunningWorkoutPlanDraft,
  type RunningWorkoutPlanStepDraft,
} from "./running";

/**
 * Running Coach Library (Sprint D1) — tipos de domínio + mappers row→domain.
 *
 * Espelha a migração 20260730174204_running_coach_library.sql: templates de
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

// ---------------------------------------------------------------------------
// Lógica pura (Sprint D1) — sem I/O, sem React, sem efeitos colaterais.
// ---------------------------------------------------------------------------

/**
 * Próxima sessão a fazer num programa: a de menor (weekIndex, orderInWeek)
 * ainda NÃO concluída, ou null quando todas já foram feitas. Busca o mínimo
 * real, então independe da ordem do array de entrada.
 */
export function resolveNextProgramSession(
  sessions: RunningProgramSession[],
  completedSessionIds: Set<string>,
): RunningProgramSession | null {
  let next: RunningProgramSession | null = null;
  for (const session of sessions) {
    if (completedSessionIds.has(session.id)) continue;
    if (
      next === null ||
      session.weekIndex < next.weekIndex ||
      (session.weekIndex === next.weekIndex &&
        session.orderInWeek < next.orderInWeek)
    ) {
      next = session;
    }
  }
  return next;
}

export type RunningProgramProgress = {
  done: number;
  total: number;
  pct: number;
};

/**
 * Progresso de um programa: sessões feitas / total, com porcentagem
 * arredondada. Protege total=0 → pct 0 (evita divisão por zero).
 */
export function computeProgramProgress(
  total: number,
  done: number,
): RunningProgramProgress {
  const pct = total <= 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

/**
 * Projeta os steps de um template no array de blocos que o engine guiado já
 * consome. Como RunningSessionTemplateStep É RunningWorkoutPlanStepDraft, isto
 * é uma projeção 1:1 — o mesmo shape que expandRunningPlanSegments /
 * createRunningSessionState leem (o engine já trata valores crus de forma
 * defensiva, então nenhuma normalização é necessária). Empacotar esses blocos
 * num RunningWorkoutPlan sintético + chamar createRunningSessionState é a
 * Task 2.3, não aqui — esta função só produz os blocos.
 */
export function sessionTemplateToEngineBlocks(
  template: Pick<RunningSessionTemplate, "steps">,
): RunningSessionTemplateStep[] {
  return [...template.steps];
}

/**
 * Origem da biblioteca → `source` do RunningWorkoutPlan. `source` é só
 * metadado de proveniência (não afeta o engine); mapeamos para o valor mais
 * próximo do enum existente para não precisar estender `RUNNING_PLAN_SOURCES`.
 */
const ORIGIN_TO_PLAN_SOURCE: Record<RunningLibraryOrigin, RunningPlanSource> = {
  official: "manual",
  professional: "professional",
  imported: "text",
  ai: "ai",
};

/**
 * Empacota um template da biblioteca num RunningWorkoutPlan sintético — o shape
 * que `createRunningSessionState` / `RunningPlanPreview` consomem. É efêmero
 * (não é uma linha de running_workout_plans): o `id` é o do template para que
 * planId/planName nos resultados apontem à sessão-farol de origem. Nível/meta
 * default (template é por-sessão, não tem faceta); estimativas caem para o
 * cálculo por steps quando a coluna vem nula.
 */
export function sessionTemplateToRunningPlan(
  template: RunningSessionTemplate,
): RunningWorkoutPlan {
  const draft: RunningWorkoutPlanDraft = {
    name: template.title,
    description: template.description,
    level: "beginner",
    goal: "general",
    source: ORIGIN_TO_PLAN_SOURCE[template.origin] ?? "manual",
    sourceMetadata: {
      sessionTemplateId: template.id,
      slug: template.slug,
      origin: template.origin,
    },
    steps: [...template.steps],
  };
  const estimate = estimateRunningPlanTotals(draft);
  return {
    ...draft,
    id: template.id,
    userId: template.ownerUserId ?? "",
    sportType: "run",
    planVersion: 1,
    isFavorite: false,
    estimatedDurationS: template.estimatedDurationS ?? estimate.durationS,
    estimatedDistanceM: template.estimatedDistanceM ?? estimate.distanceM,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export type RunningTimelineColorToken =
  | "start"
  | "work"
  | "recovery"
  | "end"
  | "neutral";

export type RunningTimelineNode = {
  stepType: RunningStepType;
  label: string;
  repetitions: number;
  effort: number | null;
  zone: number | null;
  colorToken: RunningTimelineColorToken;
};

const TIMELINE_COLOR_TOKENS: Partial<
  Record<RunningStepType, RunningTimelineColorToken>
> = {
  warmup: "start",
  interval: "work",
  recovery: "recovery",
  cooldown: "end",
};

function timelineColorToken(
  stepType: RunningStepType,
): RunningTimelineColorToken {
  return TIMELINE_COLOR_TOKENS[stepType] ?? "neutral";
}

/**
 * Nós de timeline para renderização (UI-agnóstico). Um step repetido
 * (repetitions > 1) vira UM nó carregando suas repetições — não expande em N.
 * O colorToken é um token semântico (não hex); a UI mapeia token → CSS var.
 */
export function buildRunningTimeline(
  steps: RunningSessionTemplateStep[],
): RunningTimelineNode[] {
  return steps.map((step) => ({
    stepType: step.stepType,
    label: step.title,
    repetitions: step.repetitions,
    effort: step.targetEffort ?? null,
    zone: step.heartRateZone ?? null,
    colorToken: timelineColorToken(step.stepType),
  }));
}
