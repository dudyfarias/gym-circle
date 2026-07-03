import type { CreateWorkoutPostInput } from "./social/types";

type PublishDestinations = NonNullable<CreateWorkoutPostInput["destinations"]>;

export type WorkoutPublishPlan = {
  workoutDate: string | null;
  createdAt: string | undefined;
  destinations: PublishDestinations;
  isManualBackdate: boolean;
};

/**
 * Um post ligado a uma atividade precisa herdar o workout_date da atividade
 * para passar pela validação do banco, mas continua sendo uma publicação
 * normal (pode ir para story e usa created_at atual).
 *
 * Só "Registrar treino" sem sourceActivityId é retroativo: força feed e
 * backdata created_at para não subir no topo como conteúdo novo.
 */
export function buildWorkoutPublishPlan(
  input: Pick<
    CreateWorkoutPostInput,
    "destinations" | "sourceActivityId" | "workoutDate"
  >,
): WorkoutPublishPlan {
  const workoutDate = input.workoutDate?.trim() || null;
  const isManualBackdate = Boolean(workoutDate && !input.sourceActivityId);

  return {
    workoutDate,
    createdAt:
      isManualBackdate && workoutDate
        ? `${workoutDate}T12:00:00-03:00`
        : undefined,
    destinations: isManualBackdate
      ? { feed: true, story: false }
      : input.destinations ?? { feed: true, story: true },
    isManualBackdate,
  };
}
