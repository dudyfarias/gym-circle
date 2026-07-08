export type ReminderCandidate = {
  user_id: string;
};

export type ActivityDayRow = {
  user_id: string;
};

export type ReminderLogRow = {
  user_id: string;
  target_id: string | null;
  created_at: string;
};

export function uniqueCandidateUserIds(
  candidates: ReminderCandidate[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const candidate of candidates) {
    if (!candidate.user_id || seen.has(candidate.user_id)) continue;
    seen.add(candidate.user_id);
    out.push(candidate.user_id);
  }
  return out;
}

export function filterUsersNeedingReminder(args: {
  candidateUserIds: string[];
  activityRows: ActivityDayRow[];
  recentReminderRows: ReminderLogRow[];
  activityDate: string;
}): string[] {
  const activeToday = new Set(args.activityRows.map((row) => row.user_id));
  const remindedRecently = new Set(
    args.recentReminderRows.map((row) => row.user_id),
  );

  return args.candidateUserIds.filter(
    (userId) => !activeToday.has(userId) && !remindedRecently.has(userId),
  );
}
