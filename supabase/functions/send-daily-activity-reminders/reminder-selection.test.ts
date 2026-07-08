import { describe, expect, it } from "vitest";
import {
  filterUsersNeedingReminder,
  uniqueCandidateUserIds,
} from "./reminder-selection";

describe("daily activity reminder selection", () => {
  it("deduplicates users with multiple active devices", () => {
    expect(
      uniqueCandidateUserIds([
        { user_id: "user-1" },
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]),
    ).toEqual(["user-1", "user-2"]);
  });

  it("excludes active users and users already reminded for the day", () => {
    expect(
      filterUsersNeedingReminder({
        candidateUserIds: ["user-1", "user-2", "user-3"],
        activityDate: "2026-07-08",
        activityRows: [{ user_id: "user-1" }],
        recentReminderRows: [
          {
            user_id: "user-2",
            target_id: "2026-07-08",
            created_at: "2026-07-08T20:00:00.000Z",
          },
          {
            user_id: "user-3",
            target_id: "2026-07-07",
            created_at: "2026-07-08T20:00:00.000Z",
          },
        ],
      }),
    ).toEqual([]);
  });
});
