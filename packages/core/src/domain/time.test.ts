import { describe, expect, it } from "vitest";
import { getGymCircleDateKey, getGymCircleHour } from "./time";

describe("Gym Circle civil time", () => {
  it("mantém o dia de São Paulo quando UTC já virou", () => {
    const instant = new Date("2026-07-01T00:07:32.429Z");

    expect(getGymCircleDateKey(instant)).toBe("2026-06-30");
    expect(getGymCircleHour(instant)).toBe(21);
  });

  it("vira o dia às 00h de São Paulo", () => {
    const instant = new Date("2026-07-01T03:00:00.000Z");

    expect(getGymCircleDateKey(instant)).toBe("2026-07-01");
    expect(getGymCircleHour(instant)).toBe(0);
  });
});
