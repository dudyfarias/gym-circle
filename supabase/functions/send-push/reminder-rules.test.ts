import { describe, expect, it } from "vitest";
import {
  activityDateForReminder,
  isActivityReminder,
} from "./reminder-rules";

describe("send-push activity reminder rules", () => {
  it("classifies only train/post reminder kinds", () => {
    expect(isActivityReminder({ kind: "training_reminder" })).toBe(true);
    expect(isActivityReminder({ kind: "post_reminder" })).toBe(true);
    expect(isActivityReminder({ kind: "new_message" })).toBe(false);
    expect(isActivityReminder({ kind: "like" })).toBe(false);
    expect(isActivityReminder({ kind: "comment" })).toBe(false);
  });

  it("allows future reminder senders to opt into the same suppression rule", () => {
    expect(
      isActivityReminder({
        kind: "campaign",
        data: { reminder_category: "training_or_post" },
      }),
    ).toBe(true);
    expect(
      isActivityReminder({
        kind: "campaign",
        data: { suppress_if_active_today: "true" },
      }),
    ).toBe(true);
  });

  it("uses the Gym Circle day boundary in Sao Paulo", () => {
    expect(
      activityDateForReminder(
        { kind: "training_reminder" },
        new Date("2026-07-07T02:30:00.000Z"),
      ),
    ).toBe("2026-07-06");
    expect(
      activityDateForReminder(
        { kind: "training_reminder" },
        new Date("2026-07-07T03:30:00.000Z"),
      ),
    ).toBe("2026-07-07");
  });

  it("honors an explicit activity date supplied by the scheduler", () => {
    expect(
      activityDateForReminder({
        kind: "training_reminder",
        data: { activity_date: "2026-07-06" },
      }),
    ).toBe("2026-07-06");
  });
});
