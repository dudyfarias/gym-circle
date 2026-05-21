import { describe, expect, it } from "vitest";
import {
  type ProfileCompletion,
  shouldShowProfileCompletionNotice,
} from "./profile";

function completion(percentage: number): ProfileCompletion {
  return {
    percentage,
    completedWeight: percentage,
    totalWeight: 100,
    items: [],
    missing: percentage < 100
      ? [{ id: "bio", label: "Bio", complete: false, weight: 10 }]
      : [],
  };
}

describe("shouldShowProfileCompletionNotice", () => {
  it("shows the notice for incomplete profiles that were not dismissed", () => {
    expect(
      shouldShowProfileCompletionNotice(
        { profileCompletionNoticeDismissed: false },
        completion(70),
      ),
    ).toBe(true);
  });

  it("does not show the notice after the user dismisses it", () => {
    expect(
      shouldShowProfileCompletionNotice(
        { profileCompletionNoticeDismissed: true },
        completion(70),
      ),
    ).toBe(false);
  });

  it("does not show the notice for complete profiles", () => {
    expect(
      shouldShowProfileCompletionNotice(
        { profileCompletionNoticeDismissed: false },
        completion(100),
      ),
    ).toBe(false);
  });
});
