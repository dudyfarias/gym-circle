export type ReminderRulePayload = {
  kind: string;
  data?: Record<string, string>;
};

export const ACTIVITY_REMINDER_KINDS = new Set([
  "training_reminder",
  "workout_reminder",
  "post_reminder",
  "post_or_train_reminder",
  "daily_training_reminder",
  "daily_activity_reminder",
  "streak_reminder",
]);

const DEFAULT_ACTIVITY_TIME_ZONE = "America/Sao_Paulo";
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isActivityReminder(payload: ReminderRulePayload): boolean {
  return (
    ACTIVITY_REMINDER_KINDS.has(payload.kind) ||
    payload.data?.reminder_category === "training_or_post" ||
    payload.data?.suppress_if_active_today === "true"
  );
}

export function dateInTimeZone(
  now: Date,
  timeZone = DEFAULT_ACTIVITY_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

export function activityDateForReminder(
  payload: ReminderRulePayload,
  now = new Date(),
): string {
  const requestedDate = payload.data?.activity_date;
  if (requestedDate && ISO_DATE_PATTERN.test(requestedDate)) {
    return requestedDate;
  }
  return dateInTimeZone(now);
}
