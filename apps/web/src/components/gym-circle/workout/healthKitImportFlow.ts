import type {
  FinishedWebActivity,
  WebActivityInput,
} from "../social/types";
import type { HealthKitWorkout } from "../native/HealthKitBridge";
import { healthKitWorkoutToActivityInput } from "./healthKitImport";

type ImportHealthKitWorkoutOptions = {
  workout: HealthKitWorkout;
  importActivity: (input: WebActivityInput) => Promise<FinishedWebActivity>;
  afterImport?: (
    activity: FinishedWebActivity,
    workout: HealthKitWorkout,
  ) => Promise<void>;
};

export type ImportedHealthKitWorkout = {
  activity: FinishedWebActivity;
  workout: HealthKitWorkout;
};

export class HealthKitPostIntegrationError extends Error {
  readonly imported: ImportedHealthKitWorkout;

  constructor(imported: ImportedHealthKitWorkout, cause: unknown) {
    super("The HealthKit workout was imported but could not be linked", {
      cause,
    });
    this.name = "HealthKitPostIntegrationError";
    this.imported = imported;
  }
}

/**
 * Persiste primeiro e só então executa o vínculo opcional com o post. Se o
 * segundo passo falhar, preserva a atividade importada no erro para que a UI
 * não tente importá-la de novo e possa oferecê-la na lista do Gym Circle.
 */
export async function importHealthKitWorkout({
  workout,
  importActivity,
  afterImport,
}: ImportHealthKitWorkoutOptions): Promise<ImportedHealthKitWorkout> {
  const activity = await importActivity(
    healthKitWorkoutToActivityInput(workout),
  );
  const imported = { activity, workout };

  if (afterImport) {
    try {
      await afterImport(activity, workout);
    } catch (cause) {
      throw new HealthKitPostIntegrationError(imported, cause);
    }
  }

  return imported;
}
