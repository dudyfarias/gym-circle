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

  it("entende falha, duração e técnicas dos treinos salvos", () => {
    const parsed = parseWorkoutPlanText(`
      Treino D
      Mergulho 4xF
      Alongamento 3x30s
      Elevação Lateral 10x10 GVT
      Tríceps Polia 3x12 + 3 Drops nas 3 ult.
    `);

    expect(parsed.exercises).toEqual([
      {
        name: "Mergulho",
        sets: 4,
        reps: null,
        targetKind: "failure",
        techniqueName: "Até a falha",
      },
      {
        name: "Alongamento",
        sets: 3,
        reps: null,
        targetKind: "duration",
        durationSeconds: 30,
        techniqueName: "Por tempo",
      },
      {
        name: "Elevação Lateral",
        sets: 10,
        reps: 10,
        techniqueName: "GVT",
        techniqueNotes: "GVT",
      },
      {
        name: "Tríceps Polia",
        sets: 3,
        reps: 12,
        techniqueName: "Drop-Set",
        techniqueNotes: "3 Drops nas 3 ult.",
      },
    ]);
  });

  it("reúne nome e prescrição quando o OCR quebra a linha", () => {
    const parsed = parseWorkoutPlanText(
      "Treino B\nSupino Máquina\n4x12 + 3 Drops na ult.",
    );

    expect(parsed.exercises[0]).toMatchObject({
      name: "Supino Máquina",
      sets: 4,
      reps: 12,
      techniqueName: "Drop-Set",
    });
  });
});
