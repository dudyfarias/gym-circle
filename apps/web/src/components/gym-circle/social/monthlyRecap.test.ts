import { describe, expect, it } from "vitest";
import {
  buildMonthlyRecap,
  getRecapPeriodKey,
  getRecapPeriodOptions,
  isMonthlyRecapReleaseDay,
} from "./monthlyRecap";
import type { EnrichedPost, EnrichedUser } from "./types";

const user = {
  id: "u1",
  name: "Eduardo",
  username: "edu.fit",
  accent: "var(--gc-brand)",
  avatarUrl: null,
  bio: "",
  goal: "",
  location: "",
  gyms: [],
  preferredTimes: [],
  currentStreak: 7,
  longestStreak: 12,
  lastWorkoutDate: "2026-05-20",
  workoutsThisWeek: 0,
  workoutsThisMonth: 3,
  activeDaysCount: 10,
  streakRestoresAvailable: 0,
  checkInsCount: 2,
  achievements: [],
  followersCount: 0,
  followingCount: 0,
  isFollowing: false,
  followStatus: "none",
  isPrivate: false,
  workoutDays: [],
  streakLitToday: false,
  streakPresenceSource: "none",
} satisfies EnrichedUser;

function post(input: Partial<EnrichedPost> & Pick<EnrichedPost, "id" | "workoutDate">): EnrichedPost {
  return {
    id: input.id,
    userId: input.userId ?? user.id,
    imageUrl: input.imageUrl ?? "https://example.com/photo.jpg",
    mediaType: input.mediaType ?? "image",
    caption: input.caption ?? "",
    workoutType: input.workoutType ?? "Força",
    gymName: input.gymName ?? "",
    gymId: input.gymId ?? "",
    locationSource: input.locationSource ?? "gym",
    locationName: input.locationName ?? "Pulse Club",
    locationLatitude: input.locationLatitude ?? null,
    locationLongitude: input.locationLongitude ?? null,
    locationGoogleMapsUrl: input.locationGoogleMapsUrl ?? null,
    createdAt: input.createdAt ?? `${input.workoutDate}T12:00:00.000Z`,
    workoutDate: input.workoutDate,
    isWorkoutPost: true,
    streakAtPost: input.streakAtPost ?? 1,
    likesCount: input.likesCount ?? 0,
    likedByCurrentUser: input.likedByCurrentUser ?? false,
    comments: input.comments ?? [],
    author: input.author ?? user,
    commentPreviews: input.commentPreviews ?? [],
    likedByPreview: input.likedByPreview ?? [],
    smartScore: input.smartScore ?? 0,
    smartReason: input.smartReason ?? "",
  };
}

describe("monthly recap", () => {
  it("fica disponível no último dia do mês em America/Sao_Paulo", () => {
    expect(isMonthlyRecapReleaseDay(new Date("2026-06-01T02:30:00.000Z"))).toBe(true);
    expect(isMonthlyRecapReleaseDay(new Date("2026-05-30T15:00:00.000Z"))).toBe(false);
  });

  it("conta dias únicos de treino no mês atual", () => {
    const recap = buildMonthlyRecap({
      user,
      now: new Date("2026-05-31T15:00:00.000Z"),
      posts: [
        post({ id: "p1", workoutDate: "2026-05-01" }),
        post({ id: "p2", workoutDate: "2026-05-01", workoutType: "Corrida" }),
        post({ id: "p3", workoutDate: "2026-05-12" }),
        post({ id: "p4", workoutDate: "2026-04-30" }),
      ],
    });

    expect(recap.trainedDays).toBe(2);
    expect(recap.totalPosts).toBe(3);
    expect(recap.isAvailable).toBe(true);
  });

  it("usa os dias oficiais do streak mesmo quando o feed visível não tem todos os posts", () => {
    const recap = buildMonthlyRecap({
      user: {
        ...user,
        workoutDays: ["2026-05-01", "2026-05-05", "2026-05-09"],
      },
      now: new Date("2026-05-31T15:00:00.000Z"),
      posts: [post({ id: "p1", workoutDate: "2026-05-01" })],
    });

    expect(recap.trainedDays).toBe(3);
    expect(recap.trainedDaysLabel).toBe("3 dias");
  });

  it("descobre o tipo de treino e local mais frequentes", () => {
    const recap = buildMonthlyRecap({
      user,
      now: new Date("2026-05-31T15:00:00.000Z"),
      posts: [
        post({ id: "p1", workoutDate: "2026-05-01", workoutType: "Força", locationName: "Parque da Jaqueira" }),
        post({ id: "p2", workoutDate: "2026-05-02", workoutType: "Corrida", locationName: "Parque da Jaqueira" }),
        post({ id: "p3", workoutDate: "2026-05-03", workoutType: "Corrida", locationName: "Pulse Club" }),
      ],
    });

    expect(recap.topWorkoutType).toBe("Corrida");
    expect(recap.topLocation).toBe("Parque da Jaqueira");
  });
});

describe("Sprint 5.10 — recap multi-período", () => {
  it("aceita period kind=month explícito pra mês passado", () => {
    const recap = buildMonthlyRecap({
      user,
      now: new Date("2026-06-15T15:00:00.000Z"),
      period: { kind: "month", year: 2026, month: 5 },
      posts: [
        post({ id: "p1", workoutDate: "2026-05-01" }),
        post({ id: "p2", workoutDate: "2026-05-15" }),
        post({ id: "p3", workoutDate: "2026-06-10" }), // outro mês — ignorado
      ],
    });
    expect(recap.periodKind).toBe("month");
    expect(recap.monthKey).toBe("2026-05");
    expect(recap.trainedDays).toBe(2);
    // Mês já passou → isAvailable true sem precisar esperar fim do mês
    expect(recap.isAvailable).toBe(true);
    expect(recap.daysUntilRelease).toBe(0);
  });

  it("aceita period kind=year e agrega o ano inteiro", () => {
    const recap = buildMonthlyRecap({
      user: { ...user, workoutDays: ["2026-01-05", "2026-03-10", "2026-05-01"] },
      now: new Date("2026-12-31T15:00:00.000Z"),
      period: { kind: "year", year: 2026 },
      posts: [
        post({ id: "p1", workoutDate: "2026-01-05", workoutType: "Corrida" }),
        post({ id: "p2", workoutDate: "2026-05-01", workoutType: "Força" }),
        post({ id: "p3", workoutDate: "2025-12-30" }), // ano anterior — ignorado
      ],
    });
    expect(recap.periodKind).toBe("year");
    expect(recap.monthKey).toBe("2026");
    expect(recap.monthLabel).toBe("2026");
    expect(recap.trainedDays).toBe(3); // workoutDays do user
    expect(recap.totalPosts).toBe(2);
    expect(recap.isAvailable).toBe(true); // 31 dez
  });

  it("ano corrente fora do último dia: isAvailable false + daysUntilRelease > 0", () => {
    const recap = buildMonthlyRecap({
      user,
      now: new Date("2026-06-15T15:00:00.000Z"),
      period: { kind: "year", year: 2026 },
      posts: [],
    });
    expect(recap.isAvailable).toBe(false);
    expect(recap.daysUntilRelease).toBeGreaterThan(0);
  });

  it("getRecapPeriodOptions devolve mês atual + 5 anteriores + ano corrente", () => {
    const options = getRecapPeriodOptions(new Date("2026-06-15T15:00:00.000Z"));
    expect(options).toHaveLength(7);
    expect(options[0]).toEqual({ kind: "month", year: 2026, month: 6 });
    expect(options[5]).toEqual({ kind: "month", year: 2026, month: 1 });
    expect(options[6]).toEqual({ kind: "year", year: 2026 });
  });

  it("getRecapPeriodOptions atravessa virada de ano corretamente", () => {
    // Janeiro 2026 → meses anteriores são dez/2025, nov/2025, etc
    const options = getRecapPeriodOptions(new Date("2026-01-15T15:00:00.000Z"));
    expect(options[0]).toEqual({ kind: "month", year: 2026, month: 1 });
    expect(options[1]).toEqual({ kind: "month", year: 2025, month: 12 });
    expect(options[2]).toEqual({ kind: "month", year: 2025, month: 11 });
  });

  it("getRecapPeriodKey gera key correto pra mês e ano", () => {
    expect(getRecapPeriodKey({ kind: "month", year: 2026, month: 5 })).toBe("2026-05");
    expect(getRecapPeriodKey({ kind: "month", year: 2026, month: 12 })).toBe("2026-12");
    expect(getRecapPeriodKey({ kind: "year", year: 2026 })).toBe("2026");
  });

  it("usa monthly_recap_covers[periodKey] do user pra cover override", () => {
    const recap = buildMonthlyRecap({
      user: {
        ...user,
        monthlyRecapCovers: { "2026-05": "p2" },
      },
      now: new Date("2026-05-31T15:00:00.000Z"),
      posts: [
        post({ id: "p1", workoutDate: "2026-05-01", imageUrl: "https://cdn/a.jpg" }),
        post({ id: "p2", workoutDate: "2026-05-15", imageUrl: "https://cdn/b.jpg" }),
      ],
    });
    expect(recap.coverImageUrl).toBe("https://cdn/b.jpg");
  });

  it("usa monthly_recap_covers['2026'] pra override do ano inteiro", () => {
    const recap = buildMonthlyRecap({
      user: {
        ...user,
        monthlyRecapCovers: { "2026": "p3" },
      },
      now: new Date("2026-12-31T15:00:00.000Z"),
      period: { kind: "year", year: 2026 },
      posts: [
        post({ id: "p1", workoutDate: "2026-01-01", imageUrl: "https://cdn/jan.jpg" }),
        post({ id: "p2", workoutDate: "2026-06-01", imageUrl: "https://cdn/jun.jpg" }),
        post({ id: "p3", workoutDate: "2026-11-01", imageUrl: "https://cdn/nov.jpg" }),
      ],
    });
    expect(recap.coverImageUrl).toBe("https://cdn/nov.jpg");
  });
});
