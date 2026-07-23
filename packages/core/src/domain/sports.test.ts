import { describe, expect, it } from "vitest";
import {
  SPORT_CATALOG,
  getSportDefinition,
  getSportLocalizedName,
  rankSports,
  searchSports,
} from "./sports";
import { activityInputToRow } from "./activity";

describe("sports catalog", () => {
  it("offers at least 25 enabled modalities with unique ids", () => {
    const enabled = SPORT_CATALOG.filter((sport) => sport.enabled);
    expect(enabled.length).toBeGreaterThanOrEqual(25);
    expect(new Set(enabled.map((sport) => sport.id)).size).toBe(enabled.length);
  });

  it("keeps current workout capabilities compatible", () => {
    expect(getSportDefinition("strength").trackingCapabilities).toMatchObject({
      supportsStrengthSets: true,
      supportsWorkoutPlan: true,
      supportsGPS: false,
    });
    for (const id of ["run", "walk", "ride"]) {
      expect(getSportDefinition(id).trackingCapabilities).toMatchObject({
        supportsGPS: true,
        supportsRoute: true,
        supportsDistance: true,
      });
    }
  });

  it("searches names and aliases without accents or case", () => {
    expect(searchSports("tenis").map((sport) => sport.id)).toContain("tennis");
    expect(searchSports("TÊNIS").map((sport) => sport.id)).toContain("tennis");
    expect(searchSports("running").map((sport) => sport.id)).toContain("run");
    expect(searchSports("soccer").map((sport) => sport.id)).toContain(
      "football",
    );
    expect(searchSports("martial").map((sport) => sport.id)).toContain(
      "martial-arts",
    );
  });

  it("returns localized names and a safe fallback", () => {
    expect(getSportLocalizedName("ride", "pt-BR")).toBe("Bike");
    expect(getSportLocalizedName("ride", "en-US")).toBe("Cycling");
    expect(getSportDefinition("legacy-unknown").id).toBe("other");
  });

  it("persists a new modality through the existing activity contract", () => {
    const row = activityInputToRow(
      {
        activityType: "tennis",
        mode: "session",
        origin: "web_timer",
        startedAt: "2026-07-23T12:00:00.000Z",
        endedAt: "2026-07-23T12:42:00.000Z",
        elapsedS: 2_520,
      },
      "user-1",
    );
    expect(row).toMatchObject({
      activity_type: "tennis",
      mode: "session",
      elapsed_s: 2_520,
    });
  });
});

describe("sport ranking", () => {
  it("prioritizes active, favorites, frequency and recency in that order", () => {
    const selected = SPORT_CATALOG.filter((sport) =>
      ["strength", "run", "pilates", "tennis"].includes(sport.id),
    );
    const ranked = rankSports(selected, {
      activeSportId: "tennis",
      favoriteSportIds: new Set(["pilates"]),
      usageCountBySport: new Map([
        ["strength", 20],
        ["run", 3],
      ]),
      lastUsedAtBySport: new Map([
        ["strength", "2026-07-01T12:00:00Z"],
        ["run", "2026-07-22T12:00:00Z"],
      ]),
    });
    expect(ranked.map((sport) => sport.id)).toEqual([
      "tennis",
      "pilates",
      "strength",
      "run",
    ]);
  });

  it("uses recency before editorial recommendation when usage is tied", () => {
    const selected = SPORT_CATALOG.filter((sport) =>
      ["run", "pilates"].includes(sport.id),
    );
    const ranked = rankSports(selected, {
      usageCountBySport: new Map([
        ["run", 1],
        ["pilates", 1],
      ]),
      lastUsedAtBySport: new Map([
        ["run", "2026-07-01T12:00:00Z"],
        ["pilates", "2026-07-20T12:00:00Z"],
      ]),
      recommendedSportIds: ["run"],
    });
    expect(ranked.map((sport) => sport.id)).toEqual(["pilates", "run"]);
  });
});
