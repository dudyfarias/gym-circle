import { describe, expect, it } from "vitest";
import { shouldShowRankingSkeleton } from "./CompetitionSection";

describe("CompetitionSection ranking loading state", () => {
  it("shows a skeleton on the first load for the selected ranking", () => {
    expect(
      shouldShowRankingSkeleton({ loading: true }, true, 0),
    ).toBe(true);
  });

  it("keeps visible ranking rows while refreshing the same selection", () => {
    expect(
      shouldShowRankingSkeleton({ loading: true }, true, 3),
    ).toBe(false);
  });

  it("shows a skeleton while a different scope or period is loading", () => {
    expect(
      shouldShowRankingSkeleton({ loading: true }, false, 3),
    ).toBe(true);
  });
});
