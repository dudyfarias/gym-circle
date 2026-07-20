import { Capacitor, registerPlugin } from "@capacitor/core";
import { withRequestTimeout } from "../workout/workoutFinish";

const HEALTHKIT_QUERY_TIMEOUT_MS = 20_000;

export type HealthKitPermissionState =
  | "unsupported"
  | "not-requested"
  | "granted"
  | "denied";

export type HealthKitWorkoutType =
  | "strength"
  | "running"
  | "cycling"
  | "walking"
  | "hiit"
  | "mobility"
  | "other";

export type HealthKitWorkout = {
  provider: "apple-healthkit";
  externalId: string;
  sourceApp: string;
  sourceBundleId: string;
  startedAt: string;
  endedAt: string;
  workoutType: HealthKitWorkoutType;
  elapsedS: number;
  distanceM?: number | null;
  activeCalories?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  minHr?: number | null;
  heartRateSamples?: Array<{ timestamp: string; bpm: number }> | null;
  workoutEffort?: number | null;
  temperatureC?: number | null;
  humidityPercent?: number | null;
  weatherCondition?: string | null;
  averageMets?: number | null;
  isIndoor?: boolean | null;
  sourceDevice?: string | null;
  workoutBrandName?: string | null;
  totalCalories?: number | null;
  totalCaloriesEstimated?: boolean;
  elevationGainM?: number | null;
  route?: number[][] | null;
};

interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  permissionState(): Promise<{ state: HealthKitPermissionState }>;
  requestHealthPermissions(): Promise<{ state: HealthKitPermissionState }>;
  listWorkouts(options: {
    from: string;
    to: string;
    limit?: number;
  }): Promise<{ workouts: HealthKitWorkout[] }>;
  getWorkout(options: { externalId: string }): Promise<HealthKitWorkout>;
}

const NativeHealthKit = registerPlugin<HealthKitPlugin>("GymCircleHealthKit");

export const HealthKitBridge = {
  async isAvailable() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      return false;
    }
    try {
      return (await NativeHealthKit.isAvailable()).available;
    } catch {
      return false;
    }
  },
  async permissionState() {
    if (!(await this.isAvailable())) return "unsupported" as const;
    return (await NativeHealthKit.permissionState()).state;
  },
  async requestPermissions() {
    if (!(await this.isAvailable())) return "unsupported" as const;
    return (await NativeHealthKit.requestHealthPermissions()).state;
  },
  async listWorkouts(input: { from: string; to: string; limit?: number }) {
    if (!(await this.isAvailable())) return [];
    return (
      await withRequestTimeout(
        NativeHealthKit.listWorkouts(input),
        HEALTHKIT_QUERY_TIMEOUT_MS,
        "healthkit_request_timeout",
      )
    ).workouts;
  },
  getWorkout(externalId: string) {
    return withRequestTimeout(
      NativeHealthKit.getWorkout({ externalId }),
      HEALTHKIT_QUERY_TIMEOUT_MS,
      "healthkit_request_timeout",
    );
  },
};
