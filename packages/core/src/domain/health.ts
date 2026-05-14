export type TrainingHealthProvider = "apple-healthkit" | "google-health-connect" | "manual";

export type TrainingHealthPermissionState =
  | "unsupported"
  | "not-requested"
  | "granted"
  | "denied";

export type TrainingHealthWorkoutType =
  | "strength"
  | "running"
  | "cycling"
  | "walking"
  | "hiit"
  | "mobility"
  | "other";

export type TrainingHealthWorkoutSummary = {
  provider: TrainingHealthProvider;
  externalId: string;
  startedAt: string;
  endedAt?: string | null;
  workoutType: TrainingHealthWorkoutType;
  durationMinutes?: number | null;
  caloriesKcal?: number | null;
  distanceKm?: number | null;
  averageHeartRate?: number | null;
  steps?: number | null;
};

export interface TrainingHealthAdapter {
  provider: TrainingHealthProvider;
  getPermissionState(): Promise<TrainingHealthPermissionState>;
  requestPermissions(): Promise<TrainingHealthPermissionState>;
  listWorkoutSummaries(input: {
    from: string;
    to: string;
  }): Promise<TrainingHealthWorkoutSummary[]>;
}

export function createUnsupportedTrainingHealthAdapter(
  provider: TrainingHealthProvider = "manual",
): TrainingHealthAdapter {
  return {
    provider,
    async getPermissionState() {
      return "unsupported";
    },
    async requestPermissions() {
      return "unsupported";
    },
    async listWorkoutSummaries() {
      return [];
    },
  };
}
