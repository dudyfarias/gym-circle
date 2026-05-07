import { describe, expect, it } from "vitest";
import {
  addDays,
  buildMonthCalendar,
  calcStreakSnapshot,
  formatDateKey,
  getStreakLevel,
} from "./streak";

const TODAY = "2026-05-06";

describe("getStreakLevel", () => {
  it("retorna iniciante para 0 dias", () => {
    expect(getStreakLevel(0).id).toBe("iniciante");
  });

  it("retorna consistente a partir de 4 dias", () => {
    expect(getStreakLevel(4).id).toBe("consistente");
    expect(getStreakLevel(13).id).toBe("consistente");
  });

  it("retorna elite a partir de 14 dias", () => {
    expect(getStreakLevel(14).id).toBe("elite");
    expect(getStreakLevel(29).id).toBe("elite");
  });

  it("retorna lendario a partir de 30 dias", () => {
    expect(getStreakLevel(30).id).toBe("lendario");
    expect(getStreakLevel(120).id).toBe("lendario");
  });
});

describe("calcStreakSnapshot — regras", () => {
  it("zera quando não há atividade", () => {
    const s = calcStreakSnapshot([], TODAY);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(0);
    expect(s.badgeIsActiveToday).toBe(false);
    expect(s.lastActiveDate).toBeNull();
  });

  it("acende o badge quando há foto hoje", () => {
    const s = calcStreakSnapshot([{ date: TODAY, hasPhoto: true }], TODAY);
    expect(s.badgeIsActiveToday).toBe(true);
    expect(s.currentStreak).toBe(1);
  });

  it("não acende o badge quando o post de hoje não tem foto", () => {
    const s = calcStreakSnapshot([{ date: TODAY, hasPhoto: false }], TODAY);
    expect(s.badgeIsActiveToday).toBe(false);
    expect(s.currentStreak).toBe(0);
  });

  it("mantém streak ancorado em ontem se hoje ainda não rolou", () => {
    const s = calcStreakSnapshot(
      [
        { date: addDays(TODAY, -1), hasPhoto: true },
        { date: addDays(TODAY, -2), hasPhoto: true },
        { date: addDays(TODAY, -3), hasPhoto: true },
      ],
      TODAY,
    );
    expect(s.badgeIsActiveToday).toBe(false);
    expect(s.currentStreak).toBe(3);
  });

  it("conta múltiplos posts no mesmo dia como 1", () => {
    const s = calcStreakSnapshot(
      [
        { date: TODAY, hasPhoto: true },
        { date: TODAY, hasPhoto: true },
        { date: TODAY, hasPhoto: true },
        { date: addDays(TODAY, -1), hasPhoto: true },
      ],
      TODAY,
    );
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(2);
  });

  it("quebra o streak quando há gap de 1 dia", () => {
    const s = calcStreakSnapshot(
      [
        { date: TODAY, hasPhoto: true },
        // sem ontem
        { date: addDays(TODAY, -2), hasPhoto: true },
        { date: addDays(TODAY, -3), hasPhoto: true },
      ],
      TODAY,
    );
    expect(s.currentStreak).toBe(1);
    expect(s.bestStreak).toBe(2);
  });

  it("best_streak é a maior sequência histórica (mesmo se atual é menor)", () => {
    const days: { date: string; hasPhoto: boolean }[] = [];
    // bloco antigo de 7 dias consecutivos
    for (let i = 30; i <= 36; i++) days.push({ date: addDays(TODAY, -i), hasPhoto: true });
    // bloco recente: hoje + ontem
    days.push({ date: TODAY, hasPhoto: true });
    days.push({ date: addDays(TODAY, -1), hasPhoto: true });

    const s = calcStreakSnapshot(days, TODAY);
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(7);
  });

  it("workouts_this_month conta apenas dias do mês atual", () => {
    const s = calcStreakSnapshot(
      [
        { date: "2026-04-30", hasPhoto: true },
        { date: "2026-05-01", hasPhoto: true },
        { date: "2026-05-02", hasPhoto: true },
        { date: "2026-05-06", hasPhoto: true },
      ],
      "2026-05-06",
    );
    expect(s.workoutsThisMonth).toBe(3);
  });

  it("active_days_this_year ignora outro ano", () => {
    const s = calcStreakSnapshot(
      [
        { date: "2025-12-31", hasPhoto: true },
        { date: "2026-01-01", hasPhoto: true },
        { date: "2026-05-06", hasPhoto: true },
      ],
      "2026-05-06",
    );
    expect(s.activeDaysThisYear).toBe(2);
  });

  it("ignora dias sem foto no streak", () => {
    const s = calcStreakSnapshot(
      [
        { date: TODAY, hasPhoto: false }, // não conta
        { date: addDays(TODAY, -1), hasPhoto: true },
      ],
      TODAY,
    );
    expect(s.badgeIsActiveToday).toBe(false);
    expect(s.currentStreak).toBe(1); // conta ontem
  });

  it("lastActiveDate é o dia mais recente com foto", () => {
    const s = calcStreakSnapshot(
      [
        { date: addDays(TODAY, -10), hasPhoto: true },
        { date: addDays(TODAY, -1),  hasPhoto: true },
      ],
      TODAY,
    );
    expect(s.lastActiveDate).toBe(addDays(TODAY, -1));
  });
});

describe("formatDateKey / addDays", () => {
  it("formata em UTC", () => {
    const d = new Date(Date.UTC(2026, 4, 6, 12, 0, 0));
    expect(formatDateKey(d)).toBe("2026-05-06");
  });

  it("addDays vai para frente e para trás", () => {
    expect(addDays("2026-05-06", 1)).toBe("2026-05-07");
    expect(addDays("2026-05-06", -1)).toBe("2026-05-05");
    expect(addDays("2026-05-01", -1)).toBe("2026-04-30");
  });
});

describe("buildMonthCalendar", () => {
  it("retorna o número correto de dias e marca treinados", () => {
    const days = buildMonthCalendar(["2026-05-01", "2026-05-06"], "2026-05-06");
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ day: 1, dateKey: "2026-05-01", trained: true });
    expect(days[5]).toEqual({ day: 6, dateKey: "2026-05-06", trained: true });
    expect(days[1].trained).toBe(false);
  });
});
