import { describe, expect, it } from "vitest";
import { parseWorkoutPlanText } from "./workoutPlanParser";

describe("parseWorkoutPlanText", () => {
  it("reconhece padrões comuns em português", () => {
    const parsed = parseWorkoutPlanText(`
      Treino de peito
      Supino reto 4x10
      Supino inclinado — 3 séries de 12 repetições
      Crucifixo;3;15
    `);

    expect(parsed.name).toBe("Treino de peito");
    expect(parsed.exercises).toEqual([
      { name: "Supino reto", sets: 4, reps: 10 },
      { name: "Supino inclinado", sets: 3, reps: 12 },
      { name: "Crucifixo", sets: 3, reps: 15 },
    ]);
  });

  it("lê colunas de tabela extraídas de PDF", () => {
    const parsed = parseWorkoutPlanText(
      "Exercise  Sets  Reps\nBack squat  5  5\nRow  4  8",
      "strength-a.pdf",
    );

    expect(parsed.exercises).toEqual([
      { name: "Back squat", sets: 5, reps: 5 },
      { name: "Row", sets: 4, reps: 8 },
    ]);
  });

  it("usa o nome do arquivo quando não há título", () => {
    const parsed = parseWorkoutPlanText("Agachamento 4x8", "treino_pernas.png");
    expect(parsed.name).toBe("treino pernas");
  });

  it("ignora cabeçalhos e duplicatas", () => {
    const parsed = parseWorkoutPlanText(
      "Exercício Séries Reps\nSupino 4x10\nSupino 4x10",
    );
    expect(parsed.exercises).toHaveLength(1);
  });
});
