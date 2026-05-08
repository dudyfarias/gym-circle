import { describe, expect, it } from "vitest";
import { buildMonthlyRecap, isMonthlyRecapReleaseDay } from "./monthlyRecap";
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
  workoutsThisMonth: 3,
  activeDaysCount: 10,
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
