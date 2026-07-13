/**
 * Recomendador pessoal e determinístico de treino.
 *
 * Isto NÃO é um modelo de machine learning treinado. O ranking combina sinais
 * explicáveis do próprio usuário e mantém a confiança baixa enquanto o
 * histórico ligado a um treino salvo ainda é pequeno.
 */

export type WorkoutRecommendationPlan = {
  id: string;
  name: string;
  updatedAt?: string | null;
  isFavorite?: boolean;
};

export type WorkoutRecommendationHistoryItem = {
  activityId: string;
  workoutPlanId: string | null;
  /** Data local do treino no formato YYYY-MM-DD. */
  workoutDate: string;
  /** Usado somente para desempatar duas execuções no mesmo dia. */
  startedAt?: string | null;
};

export type WorkoutRecommendationReasonCode =
  | "weekday-pattern"
  | "sequence-pattern"
  | "favorite"
  | "frequent"
  | "well-rested"
  | "no-history-favorite"
  | "no-history-recent"
  | "limited-history";

export type WorkoutRecommendationConfidence = "low" | "medium" | "high";

export type WorkoutRecommendationComponents = {
  /** Padrão do mesmo dia da semana. Máximo: 44. */
  weekday: number;
  /** Plano que historicamente sucede o último plano. Máximo: 26. */
  sequence: number;
  /** Frequência geral de uso. Máximo: 14. */
  frequency: number;
  /** Evita repetir treino feito ontem e favorece um intervalo razoável. Máximo: 10. */
  recency: number;
  /** Preferência explícita do usuário. Máximo: 6. */
  favorite: number;
};

export type WorkoutRecommendationEvidence = {
  linkedSessionCount: number;
  weekdayUseCount: number;
  transitionCount: number;
  totalUseCount: number;
  daysSinceLastUse: number | null;
  isFavorite: boolean;
};

export type RankedWorkoutRecommendation = {
  planId: string;
  planName: string;
  score: number;
  confidence: number;
  confidenceLevel: WorkoutRecommendationConfidence;
  reasonCode: WorkoutRecommendationReasonCode;
  components: WorkoutRecommendationComponents;
  evidence: WorkoutRecommendationEvidence;
};

export type WorkoutRecommendationResult = {
  recommendation: RankedWorkoutRecommendation | null;
  rankedPlans: RankedWorkoutRecommendation[];
  linkedSessionCount: number;
  ignoredSessionCount: number;
};

export type BuildWorkoutRecommendationInput = {
  plans: WorkoutRecommendationPlan[];
  history: WorkoutRecommendationHistoryItem[];
  /** Data local de referência no formato YYYY-MM-DD. */
  today: string;
};

type NormalizedHistoryItem = WorkoutRecommendationHistoryItem & {
  dayNumber: number;
  weekday: number;
};

type PlanSignals = {
  weekdayUseCount: number;
  transitionCount: number;
  totalUseCount: number;
  daysSinceLastUse: number | null;
};

const MAX_COMPONENTS = {
  weekday: 44,
  sequence: 26,
  frequency: 14,
  recency: 10,
  favorite: 6,
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDateKey(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.floor(timestamp / 86_400_000);
}

function normalizeHistory(
  history: WorkoutRecommendationHistoryItem[],
  planIds: Set<string>,
): { linked: NormalizedHistoryItem[]; ignoredSessionCount: number } {
  const linked: NormalizedHistoryItem[] = [];
  let ignoredSessionCount = 0;
  for (const item of history) {
    const dayNumber = parseDateKey(item.workoutDate);
    if (!item.workoutPlanId || !planIds.has(item.workoutPlanId) || dayNumber === null) {
      ignoredSessionCount += 1;
      continue;
    }
    linked.push({
      ...item,
      dayNumber,
      weekday: new Date(dayNumber * 86_400_000).getUTCDay(),
    });
  }
  linked.sort((left, right) => {
    if (left.dayNumber !== right.dayNumber) return left.dayNumber - right.dayNumber;
    const started = (left.startedAt ?? "").localeCompare(right.startedAt ?? "");
    return started !== 0 ? started : left.activityId.localeCompare(right.activityId);
  });
  return { linked, ignoredSessionCount };
}

function recencyPoints(daysSinceLastUse: number | null) {
  if (daysSinceLastUse === null) return 4;
  if (daysSinceLastUse <= 1) return 0;
  if (daysSinceLastUse === 2) return 3;
  if (daysSinceLastUse === 3) return 6;
  if (daysSinceLastUse <= 8) return MAX_COMPONENTS.recency;
  if (daysSinceLastUse <= 14) return 8;
  return 6;
}

function confidenceFor(
  linkedSessionCount: number,
  signals: PlanSignals,
): number {
  if (linkedSessionCount === 0) return 0.12;
  const sampleConfidence = clamp(linkedSessionCount / 12, 0, 1) * 0.55;
  const weekdayConfidence = clamp(signals.weekdayUseCount / 3, 0, 1) * 0.25;
  const sequenceConfidence = clamp(signals.transitionCount / 3, 0, 1) * 0.2;
  return rounded(clamp(0.1 + sampleConfidence + weekdayConfidence + sequenceConfidence, 0.1, 0.95));
}

function confidenceLevel(confidence: number): WorkoutRecommendationConfidence {
  if (confidence >= 0.72) return "high";
  if (confidence >= 0.42) return "medium";
  return "low";
}

function reasonFor(
  linkedSessionCount: number,
  components: WorkoutRecommendationComponents,
  evidence: WorkoutRecommendationEvidence,
): WorkoutRecommendationReasonCode {
  if (linkedSessionCount === 0) {
    return evidence.isFavorite ? "no-history-favorite" : "no-history-recent";
  }
  if (linkedSessionCount < 3 && evidence.weekdayUseCount === 0 && evidence.transitionCount === 0) {
    return "limited-history";
  }
  const ordered: Array<[WorkoutRecommendationReasonCode, number]> = [
    ["weekday-pattern", components.weekday],
    ["sequence-pattern", components.sequence],
    ["frequent", components.frequency],
    ["well-rested", components.recency],
    ["favorite", components.favorite],
  ];
  ordered.sort((left, right) => right[1] - left[1]);
  return ordered[0][1] > 0 ? ordered[0][0] : "limited-history";
}

function fallbackRank(
  plans: WorkoutRecommendationPlan[],
): WorkoutRecommendationPlan[] {
  return [...plans].sort((left, right) => {
    if (Boolean(left.isFavorite) !== Boolean(right.isFavorite)) {
      return left.isFavorite ? -1 : 1;
    }
    const updated = (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "");
    return updated !== 0 ? updated : left.id.localeCompare(right.id);
  });
}

/**
 * Produz um ranking determinístico. Para obter a mesma resposta, forneça o
 * mesmo histórico, planos e `today`; a função não usa relógio global nem rede.
 */
export function buildWorkoutRecommendation(
  input: BuildWorkoutRecommendationInput,
): WorkoutRecommendationResult {
  const uniquePlans = Array.from(
    new Map(input.plans.filter((plan) => plan.id.trim()).map((plan) => [plan.id, plan])).values(),
  );
  if (uniquePlans.length === 0) {
    return {
      recommendation: null,
      rankedPlans: [],
      linkedSessionCount: 0,
      ignoredSessionCount: input.history.length,
    };
  }

  const todayDayNumber = parseDateKey(input.today);
  const planIds = new Set(uniquePlans.map((plan) => plan.id));
  const { linked, ignoredSessionCount } = normalizeHistory(input.history, planIds);

  if (todayDayNumber === null || linked.length === 0) {
    const rankedPlans = fallbackRank(uniquePlans).map((plan) => {
      const evidence: WorkoutRecommendationEvidence = {
        linkedSessionCount: 0,
        weekdayUseCount: 0,
        transitionCount: 0,
        totalUseCount: 0,
        daysSinceLastUse: null,
        isFavorite: Boolean(plan.isFavorite),
      };
      const components: WorkoutRecommendationComponents = {
        weekday: 0,
        sequence: 0,
        frequency: 0,
        recency: 0,
        favorite: plan.isFavorite ? MAX_COMPONENTS.favorite : 0,
      };
      return {
        planId: plan.id,
        planName: plan.name,
        score: components.favorite,
        confidence: 0.12,
        confidenceLevel: "low" as const,
        reasonCode: reasonFor(0, components, evidence),
        components,
        evidence,
      };
    });
    return {
      recommendation: rankedPlans[0] ?? null,
      rankedPlans,
      linkedSessionCount: 0,
      ignoredSessionCount,
    };
  }

  const todayWeekday = new Date(todayDayNumber * 86_400_000).getUTCDay();
  const totalUses = new Map<string, number>();
  const weekdayUses = new Map<string, number>();
  const lastUseDay = new Map<string, number>();
  for (const item of linked) {
    const planId = item.workoutPlanId!;
    totalUses.set(planId, (totalUses.get(planId) ?? 0) + 1);
    if (item.weekday === todayWeekday) {
      weekdayUses.set(planId, (weekdayUses.get(planId) ?? 0) + 1);
    }
    lastUseDay.set(planId, Math.max(lastUseDay.get(planId) ?? item.dayNumber, item.dayNumber));
  }

  const lastPlanId = linked.at(-1)?.workoutPlanId ?? null;
  const transitions = new Map<string, number>();
  if (lastPlanId) {
    for (let index = 0; index < linked.length - 1; index += 1) {
      if (linked[index].workoutPlanId !== lastPlanId) continue;
      const nextPlanId = linked[index + 1].workoutPlanId!;
      if (nextPlanId === lastPlanId) continue;
      transitions.set(nextPlanId, (transitions.get(nextPlanId) ?? 0) + 1);
    }
  }

  const maxWeekdayUses = Math.max(1, ...weekdayUses.values());
  const maxTransitions = Math.max(1, ...transitions.values());
  const maxTotalUses = Math.max(1, ...totalUses.values());

  const rankedPlans = uniquePlans.map((plan) => {
    const weekdayUseCount = weekdayUses.get(plan.id) ?? 0;
    const transitionCount = transitions.get(plan.id) ?? 0;
    const totalUseCount = totalUses.get(plan.id) ?? 0;
    const lastDay = lastUseDay.get(plan.id);
    const daysSinceLastUse = lastDay === undefined ? null : Math.max(0, todayDayNumber - lastDay);
    const components: WorkoutRecommendationComponents = {
      weekday: rounded((weekdayUseCount / maxWeekdayUses) * MAX_COMPONENTS.weekday),
      sequence: rounded((transitionCount / maxTransitions) * MAX_COMPONENTS.sequence),
      frequency: rounded(Math.sqrt(totalUseCount / maxTotalUses) * MAX_COMPONENTS.frequency),
      recency: recencyPoints(daysSinceLastUse),
      favorite: plan.isFavorite ? MAX_COMPONENTS.favorite : 0,
    };
    const evidence: WorkoutRecommendationEvidence = {
      linkedSessionCount: linked.length,
      weekdayUseCount,
      transitionCount,
      totalUseCount,
      daysSinceLastUse,
      isFavorite: Boolean(plan.isFavorite),
    };
    const confidence = confidenceFor(linked.length, {
      weekdayUseCount,
      transitionCount,
      totalUseCount,
      daysSinceLastUse,
    });
    return {
      planId: plan.id,
      planName: plan.name,
      score: rounded(Object.values(components).reduce((sum, value) => sum + value, 0)),
      confidence,
      confidenceLevel: confidenceLevel(confidence),
      reasonCode: reasonFor(linked.length, components, evidence),
      components,
      evidence,
    };
  });

  rankedPlans.sort((left, right) => {
    if (left.score !== right.score) return right.score - left.score;
    if (left.evidence.weekdayUseCount !== right.evidence.weekdayUseCount) {
      return right.evidence.weekdayUseCount - left.evidence.weekdayUseCount;
    }
    if (left.evidence.transitionCount !== right.evidence.transitionCount) {
      return right.evidence.transitionCount - left.evidence.transitionCount;
    }
    if (left.evidence.totalUseCount !== right.evidence.totalUseCount) {
      return right.evidence.totalUseCount - left.evidence.totalUseCount;
    }
    if (left.evidence.isFavorite !== right.evidence.isFavorite) {
      return left.evidence.isFavorite ? -1 : 1;
    }
    return left.planId.localeCompare(right.planId);
  });

  return {
    recommendation: rankedPlans[0] ?? null,
    rankedPlans,
    linkedSessionCount: linked.length,
    ignoredSessionCount,
  };
}
