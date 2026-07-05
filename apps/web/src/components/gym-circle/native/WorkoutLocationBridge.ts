import { Capacitor, registerPlugin } from "@capacitor/core";

export type NativeWorkoutLocationSnapshot = {
  isRecording: boolean;
  hasSession: boolean;
  distanceM: number;
  movingS: number;
  elevationGainM: number;
  route: number[][];
};

type ActivityType = "run" | "walk" | "ride";

interface WorkoutLocationPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  startTracking(options: {
    activityType: ActivityType;
  }): Promise<NativeWorkoutLocationSnapshot>;
  pauseTracking(): Promise<NativeWorkoutLocationSnapshot>;
  resumeTracking(options: {
    activityType: ActivityType;
  }): Promise<NativeWorkoutLocationSnapshot>;
  stopTracking(): Promise<NativeWorkoutLocationSnapshot>;
  snapshot(): Promise<NativeWorkoutLocationSnapshot>;
  addListener(
    eventName: "workoutLocationUpdate" | "workoutLocationError",
    listener: (data: NativeWorkoutLocationSnapshot) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

const NativeWorkoutLocation =
  registerPlugin<WorkoutLocationPlugin>("GymCircleWorkoutLocation");

export const WorkoutLocationBridge = {
  async isAvailable() {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "ios") {
      return false;
    }
    try {
      return (await NativeWorkoutLocation.isAvailable()).available;
    } catch {
      return false;
    }
  },
  start(activityType: ActivityType) {
    return NativeWorkoutLocation.startTracking({ activityType });
  },
  pause() {
    return NativeWorkoutLocation.pauseTracking();
  },
  resume(activityType: ActivityType) {
    return NativeWorkoutLocation.resumeTracking({ activityType });
  },
  stop() {
    return NativeWorkoutLocation.stopTracking();
  },
  snapshot() {
    return NativeWorkoutLocation.snapshot();
  },
  addUpdateListener(
    listener: (data: NativeWorkoutLocationSnapshot) => void,
  ) {
    return NativeWorkoutLocation.addListener("workoutLocationUpdate", listener);
  },
};
