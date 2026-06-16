import { describe, expect, it } from "vitest";
import {
  shouldShowRankingEmpty,
  shouldShowRankingSkeleton,
} from "./CompetitionSection";

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

  it("does not treat a single ranking row as empty because it still contains the viewer score", () => {
    expect(
      shouldShowRankingEmpty({ loading: false }, true, 1),
    ).toBe(false);
  });

  it("shows the empty state only when the selected ranking has no rows", () => {
    expect(
      shouldShowRankingEmpty({ loading: false }, true, 0),
    ).toBe(true);
  });
});
