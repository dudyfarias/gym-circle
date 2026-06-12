import { describe, expect, it } from "vitest";
import {
  buildConsistencyRings,
  buildMonthWorkoutDays,
  calculateWorkoutStats,
  formatStreakDays,
  formatTrainingStreakText,
  getConsistencyProgress,
  getMondayOfWeek,
  getTotalDaysInMonth,
  getTotalDaysInYear,
} from "./streak";

describe("streak copy helpers", () => {
  it("usa singular para 1 dia", () => {
    expect(formatStreakDays(1)).toBe("1 dia");
    expect(formatTrainingStreakText("Dudy", 1)).toBe("Dudy está há 1 dia treinando");
  });

  it("usa plural para 0 ou 2+ dias", () => {
    expect(formatStreakDays(0)).toBe("0 dias");
    expect(formatStreakDays(2)).toBe("2 dias");
    expect(formatTrainingStreakText("Dudy", 7)).toBe("Dudy está há 7 dias treinando");
  });
});

describe("getMondayOfWeek", () => {
  it("retorna a própria segunda quando date é segunda", () => {
    // 2026-05-18 é uma segunda-feira
    const monday = getMondayOfWeek(new Date(2026, 4, 18));
    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(4);
    expect(monday.getDate()).toBe(18);
  });

  it("retorna a segunda anterior quando date é quarta", () => {
    // 2026-05-20 é uma quarta
    const monday = getMondayOfWeek(new Date(2026, 4, 20));
    expect(monday.getDate()).toBe(18);
  });

  it("retorna a segunda anterior quando date é domingo (ISO week ends Sunday)", () => {
    // 2026-05-24 é um domingo — semana ISO começa em 18 (segunda)
    const monday = getMondayOfWeek(new Date(2026, 4, 24));
    expect(monday.getDate()).toBe(18);
  });

  it("cruza meses corretamente", () => {
    // 2026-06-01 é uma segunda — sua "segunda da semana" é ela própria
    const monday = getMondayOfWeek(new Date(2026, 5, 1));
    expect(monday.getMonth()).toBe(5);
    expect(monday.getDate()).toBe(1);
    // 2026-06-03 (quarta) — segunda foi 2026-06-01
    const monday2 = getMondayOfWeek(new Date(2026, 5, 3));
    expect(monday2.getMonth()).toBe(5);
    expect(monday2.getDate()).toBe(1);
  });
});

describe("getTotalDaysInMonth", () => {
  it("janeiro tem 31 dias", () => {
    expect(getTotalDaysInMonth(new Date(2026, 0, 15))).toBe(31);
  });

  it("fevereiro em ano comum tem 28 dias", () => {
    expect(getTotalDaysInMonth(new Date(2026, 1, 15))).toBe(28);
  });

  it("fevereiro em ano bissexto (2024) tem 29 dias", () => {
    expect(getTotalDaysInMonth(new Date(2024, 1, 15))).toBe(29);
  });

  it("abril tem 30 dias", () => {
    expect(getTotalDaysInMonth(new Date(2026, 3, 15))).toBe(30);
  });

  it("dezembro tem 31 dias", () => {
    expect(getTotalDaysInMonth(new Date(2026, 11, 15))).toBe(31);
  });
});

describe("getTotalDaysInYear", () => {
  it("ano comum tem 365 dias", () => {
    expect(getTotalDaysInYear(new Date(2026, 5, 15))).toBe(365);
    expect(getTotalDaysInYear(new Date(2025, 0, 1))).toBe(365);
  });

  it("ano bissexto múltiplo de 4 tem 366", () => {
    expect(getTotalDaysInYear(new Date(2024, 5, 15))).toBe(366);
  });

  it("anos centenários NÃO bissextos (1900) têm 365", () => {
    expect(getTotalDaysInYear(new Date(1900, 5, 15))).toBe(365);
  });

  it("anos divisíveis por 400 (2000) são bissextos", () => {
    expect(getTotalDaysInYear(new Date(2000, 5, 15))).toBe(366);
  });
});

describe("calculateWorkoutStats — Gym Circle Sprint 3.5", () => {
  // 2026-05-22 (sexta-feira). Semana ISO = seg 2026-05-18 → dom 2026-05-24.
  const todayKey = "2026-05-22";

  it("conta workoutsThisWeek (segunda → domingo da semana corrente)", () => {
    const workoutDays = [
      "2026-05-17", // domingo anterior — NÃO entra (semana passada)
      "2026-05-18", // segunda (esta semana)
      "2026-05-19", // terça
      "2026-05-20", // quarta
      "2026-05-25", // segunda seguinte — não entra
    ];
    const stats = calculateWorkoutStats(workoutDays, todayKey);
    expect(stats.workoutsThisWeek).toBe(3);
  });

  it("conta workoutsThisMonth (todos do mês corrente)", () => {
    const workoutDays = [
      "2026-04-30", // mês anterior
      "2026-05-01",
      "2026-05-10",
      "2026-05-22",
      "2026-06-01", // mês seguinte
    ];
    const stats = calculateWorkoutStats(workoutDays, todayKey);
    expect(stats.workoutsThisMonth).toBe(3);
  });

  it("conta workoutsThisYear (todos do ano corrente)", () => {
    const workoutDays = [
      "2025-12-31",
      "2026-01-01",
      "2026-05-22",
      "2026-12-31",
      "2027-01-01",
    ];
    const stats = calculateWorkoutStats(workoutDays, todayKey);
    expect(stats.workoutsThisYear).toBe(3);
  });

  it("preserva currentStreak e longestStreak", () => {
    const workoutDays = ["2026-05-20", "2026-05-21", "2026-05-22"];
    const stats = calculateWorkoutStats(workoutDays, todayKey);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it("retorna zeros quando workoutDays vazio", () => {
    const stats = calculateWorkoutStats([], todayKey);
    expect(stats.workoutsThisWeek).toBe(0);
    expect(stats.workoutsThisMonth).toBe(0);
    expect(stats.workoutsThisYear).toBe(0);
  });
});

describe("getConsistencyProgress + buildConsistencyRings — Sprint 3.5", () => {
  // 2026-05-22 (sexta). Maio tem 31 dias. 2026 = ano comum (365 dias).
  const today = new Date(2026, 4, 22);

  it("calcula progresso com denominadores corretos (total do período)", () => {
    const progress = getConsistencyProgress(
      {
        workoutsThisWeek: 3, // 3/7 ≈ 42.86%
        workoutsThisMonth: 10, // 10/31 ≈ 32.26%
        workoutsThisYear: 50, // 50/365 ≈ 13.70%
      },
      today,
    );
    expect(progress.week).toBeCloseTo((3 / 7) * 100, 1);
    expect(progress.month).toBeCloseTo((10 / 31) * 100, 1);
    expect(progress.year).toBeCloseTo((50 / 365) * 100, 1);
  });

  it("clampa em 100% quando workoutsThisWeek excede 7 (caso impossível mas defensivo)", () => {
    const progress = getConsistencyProgress(
      {
        workoutsThisWeek: 9,
        workoutsThisMonth: 50,
        workoutsThisYear: 500,
      },
      today,
    );
    expect(progress.week).toBe(100);
    expect(progress.month).toBe(100);
    expect(progress.year).toBe(100);
  });

  it("clampa em 0% quando valores negativos", () => {
    const progress = getConsistencyProgress(
      {
        workoutsThisWeek: -1,
        workoutsThisMonth: 0,
        workoutsThisYear: 0,
      },
      today,
    );
    expect(progress.week).toBe(0);
    expect(progress.month).toBe(0);
    expect(progress.year).toBe(0);
  });

  it("buildConsistencyRings retorna 3 anéis na ordem externo→interno (ano, mês, semana)", () => {
    const rings = buildConsistencyRings({
      workoutsThisWeek: 3,
      workoutsThisMonth: 10,
      workoutsThisYear: 50,
    });
    expect(rings).toHaveLength(3);
    expect(rings[0]!.id).toBe("year");
    expect(rings[1]!.id).toBe("month");
    expect(rings[2]!.id).toBe("week");
    expect(rings[0]!.label).toBe("Ano");
    expect(rings[1]!.label).toBe("Mês");
    expect(rings[2]!.label).toBe("Semana");
  });

  it("buildConsistencyRings não inclui streak/dia (streak vira chip separado — Sprint 3.5)", () => {
    const rings = buildConsistencyRings({
      workoutsThisWeek: 0,
      workoutsThisMonth: 0,
      workoutsThisYear: 0,
    });
    expect(rings.find((r) => r.id === "day")).toBeUndefined();
    expect(rings.find((r) => r.id === "streak")).toBeUndefined();
  });
});

describe("buildMonthWorkoutDays — Sprint 5.2 calendar mini-fotos", () => {
  // Today key controlado pra determinismo: 15 de Maio 2026 → mês com 31 dias
  const todayKey = "2026-05-15";

  it("retorna array com todos os dias do mês, trained derivado de workoutDays", () => {
    const result = buildMonthWorkoutDays(["2026-05-01", "2026-05-15"], todayKey);
    expect(result).toHaveLength(31);
    expect(result[0]).toEqual({
      day: 1,
      dateKey: "2026-05-01",
      trained: true,
      thumbnailUrl: null,
      postId: null,
      postCount: 0,
    });
    expect(result[14]).toEqual({
      day: 15,
      dateKey: "2026-05-15",
      trained: true,
      thumbnailUrl: null,
      postId: null,
      postCount: 0,
    });
    expect(result[5].trained).toBe(false);
    expect(result[5].postId).toBe(null);
  });

  it("linka thumbnailUrl do post quando workoutDate bate com o dia", () => {
    const posts = [
      {
        workoutDate: "2026-05-01",
        thumbnailUrl: "https://cdn/thumb-1.jpg",
        imageUrl: "https://cdn/img-1.jpg",
      },
      {
        workoutDate: "2026-05-15",
        thumbnailUrl: null,
        imageUrl: "https://cdn/img-2.jpg",
      },
    ];
    const result = buildMonthWorkoutDays(
      ["2026-05-01", "2026-05-15"],
      todayKey,
      posts,
    );
    // Dia 1: usa thumbnailUrl direto
    expect(result[0].thumbnailUrl).toBe("https://cdn/thumb-1.jpg");
    // Dia 15: thumbnailUrl null no post → cai pro imageUrl
    expect(result[14].thumbnailUrl).toBe("https://cdn/img-2.jpg");
    // Dia 6: não treinou, sem thumb
    expect(result[5].thumbnailUrl).toBe(null);
  });

  it("ignora posts cujo workoutDate não bate em nenhum dia trained", () => {
    const posts = [
      {
        workoutDate: "2026-04-30",
        thumbnailUrl: "https://cdn/should-be-ignored.jpg",
        imageUrl: null,
      },
    ];
    const result = buildMonthWorkoutDays(["2026-05-01"], todayKey, posts);
    // Nenhum dia ganhou thumb (post é de outro mês)
    expect(result.every((d) => d.thumbnailUrl === null)).toBe(true);
  });

  it("usa primeiro post quando há múltiplos no mesmo dia", () => {
    const posts = [
      {
        workoutDate: "2026-05-10",
        thumbnailUrl: "https://cdn/first.jpg",
        imageUrl: null,
      },
      {
        workoutDate: "2026-05-10",
        thumbnailUrl: "https://cdn/second.jpg",
        imageUrl: null,
      },
    ];
    const result = buildMonthWorkoutDays(["2026-05-10"], todayKey, posts);
    expect(result[9].thumbnailUrl).toBe("https://cdn/first.jpg");
  });

  it("back-compat: sem posts param, thumbnailUrl é sempre null", () => {
    const result = buildMonthWorkoutDays(["2026-05-01"], todayKey);
    expect(result[0].thumbnailUrl).toBe(null);
    expect(result[0].postId).toBe(null);
    expect(result[0].trained).toBe(true);
  });

  it("Sprint 5.8 — linka postId quando o post tem id", () => {
    const posts = [
      {
        id: "post-uuid-001",
        workoutDate: "2026-05-01",
        thumbnailUrl: "https://cdn/thumb-1.jpg",
        imageUrl: null,
      },
      {
        // Sem id → postId fica null mesmo com match de workoutDate
        workoutDate: "2026-05-15",
        thumbnailUrl: "https://cdn/thumb-2.jpg",
        imageUrl: null,
      },
    ];
    const result = buildMonthWorkoutDays(
      ["2026-05-01", "2026-05-15"],
      todayKey,
      posts,
    );
    expect(result[0].postId).toBe("post-uuid-001");
    expect(result[0].thumbnailUrl).toBe("https://cdn/thumb-1.jpg");
    // Dia 15: id ausente → postId null, mas thumbnail ainda funciona
    expect(result[14].postId).toBe(null);
    expect(result[14].thumbnailUrl).toBe("https://cdn/thumb-2.jpg");
  });

  it("vídeo sem thumbnail/poster: cell sólida (sem <img src=video>) mas tappable", () => {
    const posts = [
      {
        id: "video-uuid",
        workoutDate: "2026-05-08",
        thumbnailUrl: null,
        posterUrl: null,
        imageUrl: "https://cdn/workout.mp4",
        mediaType: "video",
      },
    ];
    const result = buildMonthWorkoutDays(["2026-05-08"], todayKey, posts);
    // imageUrl é o ARQUIVO de vídeo — não pode virar thumbnail
    expect(result[7].thumbnailUrl).toBe(null);
    // mas o dia continua tappable pro post detail
    expect(result[7].postId).toBe("video-uuid");
    expect(result[7].trained).toBe(true);
  });

  it("vídeo com poster usa o poster como mini-foto", () => {
    const posts = [
      {
        id: "video-poster-uuid",
        workoutDate: "2026-05-08",
        thumbnailUrl: null,
        posterUrl: "https://cdn/poster.jpg",
        imageUrl: "https://cdn/workout.mp4",
        mediaType: "video",
      },
    ];
    const result = buildMonthWorkoutDays(["2026-05-08"], todayKey, posts);
    expect(result[7].thumbnailUrl).toBe("https://cdn/poster.jpg");
    expect(result[7].postId).toBe("video-poster-uuid");
  });

  it("dia com vídeo sem foto + post de imagem depois: imagem vence (foto e tap juntos)", () => {
    const posts = [
      {
        id: "video-uuid",
        workoutDate: "2026-05-08",
        thumbnailUrl: null,
        posterUrl: null,
        imageUrl: "https://cdn/workout.mp4",
        mediaType: "video",
      },
      {
        id: "image-uuid",
        workoutDate: "2026-05-08",
        thumbnailUrl: "https://cdn/photo.jpg",
        imageUrl: "https://cdn/photo-full.jpg",
        mediaType: "image",
      },
    ];
    const result = buildMonthWorkoutDays(["2026-05-08"], todayKey, posts);
    expect(result[7].thumbnailUrl).toBe("https://cdn/photo.jpg");
    // tap abre o post DA FOTO exibida, não o vídeo que veio antes
    expect(result[7].postId).toBe("image-uuid");
  });

  it("Sprint 17 — postCount conta TODOS os posts do dia (badge +N)", () => {
    const posts = [
      { id: "a", workoutDate: "2026-05-10", thumbnailUrl: "https://cdn/a.jpg", imageUrl: null },
      { id: "b", workoutDate: "2026-05-10", thumbnailUrl: "https://cdn/b.jpg", imageUrl: null },
      { id: "c", workoutDate: "2026-05-10", thumbnailUrl: null, imageUrl: null, mediaType: "video" },
      { id: "d", workoutDate: "2026-05-11", thumbnailUrl: "https://cdn/d.jpg", imageUrl: null },
    ];
    const result = buildMonthWorkoutDays(["2026-05-10", "2026-05-11"], todayKey, posts);
    expect(result[9].postCount).toBe(3);
    expect(result[10].postCount).toBe(1);
    // foto exibida continua sendo a primeira renderizável
    expect(result[9].thumbnailUrl).toBe("https://cdn/a.jpg");
  });
});
