import type { WebActivityInput } from "../social/types";
import type { HealthKitWorkout } from "../native/HealthKitBridge";

export function healthKitWorkoutActivityType(
  workoutType: HealthKitWorkout["workoutType"],
): WebActivityInput["activityType"] {
  switch (workoutType) {
    case "strength":
      return "strength";
    case "running":
      return "run";
    case "walking":
      return "walk";
    case "cycling":
      return "ride";
    default:
      return "other";
  }
}

export function sanitizeHealthKitRoute(route: number[][] | null | undefined) {
  if (!Array.isArray(route)) return null;
  const valid = route.filter(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      point.length >= 2 &&
      Number.isFinite(point[0]) &&
      Number.isFinite(point[1]) &&
      Math.abs(point[0]) <= 90 &&
      Math.abs(point[1]) <= 180,
  );
  return valid.length >= 2 ? valid : null;
}

export function healthKitWorkoutToActivityInput(
  workout: HealthKitWorkout,
): WebActivityInput {
  const activityType = healthKitWorkoutActivityType(workout.workoutType);
  const isRoute =
    activityType === "run" ||
    activityType === "walk" ||
    activityType === "ride";
  const elapsedS = finitePositiveInteger(workout.elapsedS);
  const distanceM = finitePositiveNumber(workout.distanceM);

  return {
    activityType,
    origin: "imported",
    externalId: workout.externalId.trim(),
    sourceApp: workout.sourceApp.trim() || "Apple Saúde",
    startedAt: workout.startedAt,
    endedAt: workout.endedAt,
    elapsedS,
    movingS: isRoute ? elapsedS : null,
    distanceM,
    elevationGainM: null,
    route: sanitizeHealthKitRoute(workout.route),
    avgHr: finitePositiveIntegerOrNull(workout.avgHr),
    maxHr: finitePositiveIntegerOrNull(workout.maxHr),
    activeCalories: finitePositiveNumber(workout.activeCalories),
    totalCalories: null,
  };
}

function finitePositiveInteger(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : 0;
}

function finitePositiveIntegerOrNull(value: number | null | undefined) {
  const normalized = finitePositiveInteger(value);
  return normalized > 0 ? normalized : null;
}

function finitePositiveNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}
