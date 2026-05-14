import {
  createUnsupportedTrainingHealthAdapter,
  type TrainingHealthAdapter,
} from "../domain/health";

export function healthService(adapter?: TrainingHealthAdapter) {
  const activeAdapter = adapter ?? createUnsupportedTrainingHealthAdapter();

  return {
    provider: activeAdapter.provider,

    getPermissionState() {
      return activeAdapter.getPermissionState();
    },

    requestPermissions() {
      return activeAdapter.requestPermissions();
    },

    listWorkoutSummaries(input: { from: string; to: string }) {
      return activeAdapter.listWorkoutSummaries(input);
    },
  };
}

export type HealthService = ReturnType<typeof healthService>;
