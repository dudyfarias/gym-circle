import { describe, expect, it } from "vitest";
import {
  applyExerciseLoadType,
  resolveExerciseLoadType,
} from "./exerciseLoadType";
import type { LiveStrengthSet } from "./workoutSession";

function set(
  clientId: string,
  loadType: LiveStrengthSet["loadType"],
): LiveStrengthSet {
  return {
    clientId,
    loadType,
    reps: 10,
    weightKg: loadType === "external" ? 20 : null,
  };
}

describe("exercise load type", () => {
  it("usa o tipo mais frequente em sessões antigas com séries mistas", () => {
    expect(
      resolveExerciseLoadType([
        set("1", "bodyweight"),
        set("2", "assisted"),
        set("3", "bodyweight"),
      ]),
    ).toBe("bodyweight");
  });

  it("preserva o primeiro tipo quando há empate", () => {
    expect(
      resolveExerciseLoadType([set("1", "assisted"), set("2", "external")]),
    ).toBe("assisted");
  });

  it("altera apenas as séries do exercício selecionado", () => {
    const sets = [
      set("barra-1", "not_provided"),
      set("barra-2", "not_provided"),
      set("supino-1", "external"),
    ];

    const result = applyExerciseLoadType(
      sets,
      new Set(["barra-1", "barra-2"]),
      "bodyweight",
    );

    expect(result.map((item) => item.loadType)).toEqual([
      "bodyweight",
      "bodyweight",
      "external",
    ]);
    expect(result[2]).toBe(sets[2]);
  });

  it("preserva a carga temporária ao trocar o tipo", () => {
    const original = set("supino-1", "external");
    const [result] = applyExerciseLoadType(
      [original],
      new Set([original.clientId]),
      "bodyweight",
    );

    expect(result).toMatchObject({
      loadType: "bodyweight",
      weightKg: 20,
    });
  });
});
