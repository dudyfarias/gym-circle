"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGymCircleServices } from "@gym-circle/core/hooks";
import type {
  CheckinRow,
  DirectMessageRow,
  FeedPostRow,
  FollowRow,
  GymRow,
  NotificationRow,
  PostCommentRow,
  PostLikeRow,
  ProfileRow,
  StoryRow,
  UserActivityDayRow,
  UserGymRow,
  UserStatsRow,
} from "@gym-circle/core";
import { simulateHaptic } from "./haptics";
import {
  calculateAgeFromBirthDate,
  isBirthdayFromBirthDate,
} from "./profile";
import { buildMonthWorkoutDays } from "./streak";
import type {
  ChatMessage,
  CreateWorkoutPostInput,
  EditPostInput,
  EnrichedPost,
  EnrichedStory,
  EnrichedUser,
  FeedbackMessage,
  FeedbackTone,
  GymUser,
  ProfileEditInput,
  SendChatMessageInput,
  StreakPresence,
} from "./types";

const ACCENT_PALETTE = [
  "var(--gc-brand)",
  "var(--gc-consistency-month)",
  "var(--gc-blue)",
  "var(--gc-consistency-year)",
  "var(--gc-consistency-daily)",
  "var(--gc-consistency-mid)",
];

function accentForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return ACCENT_PALETTE[Math.abs(hash) % ACCENT_PALETTE.length];
}

function deriveAchievements(stats: UserStatsRow | undefined): string[] {
  if (!stats) return [];
  const out: string[] = [];
  if (stats.best_streak >= 30) out.push(`${stats.best_streak}d lendário`);
  else if (stats.best_streak >= 14) out.push(`${stats.best_streak}d elite`);
  else if (stats.best_streak >= 4) out.push(`${stats.best_streak}d consistente`);
  else if (stats.best_streak > 0) out.push(`${stats.best_streak}d`);
  if (stats.workouts_this_month >= 10) out.push("Mês forte");
  if (stats.active_days_this_year >= 30) out.push("Ano ativo");
  if (stats.badge_is_active_today) out.push("Aceso hoje");
  return out.slice(0, 3);
}

function formatPostClock(createdAt: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getDailyPresenceFromStats(stats: UserStatsRow | undefined): StreakPresence {
  return {
    streakLitToday: stats?.badge_is_active_today ?? false,
    streakPresenceSource: stats?.badge_is_active_today ? "feed-photo" : "none",
  };
}

function getSharedGymCount(a: EnrichedUser, b: EnrichedUser): number {
  return b.gyms.filter((gym) => a.gyms.includes(gym)).length;
}

function getSmartReason(post: FeedPostRow, author: EnrichedUser, currentUser: EnrichedUser): string {
  if (post.user_id === currentUser.id) return "Seu treino";
  if (author.isFollowing) return "Seguindo";
  if (getSharedGymCount(currentUser, author) > 0) return "Mesma academia";
  if ((post.author_current_streak ?? 0) >= 10) return "Streak em alta";
  return "Descoberta";
}

function getSmartScore(
  post: FeedPostRow,
  likesCount: number,
  commentsCount: number,
  author: EnrichedUser,
  currentUser: EnrichedUser,
): number {
  const createdAt = new Date(post.created_at).getTime();
  const recency = createdAt / 100000000000;
  const freshBoost = Date.now() - createdAt < 60000 ? 600 : 0;
  const ownPost = post.user_id === currentUser.id ? 160 : 0;
  const socialAffinity = author.isFollowing ? 80 : 0;
  const sharedGym = getSharedGymCount(currentUser, author) * 26;
  const streak = Math.min((post.author_current_streak ?? 0) * 3, 60);
  const engagement = Math.min(likesCount / 18 + commentsCount * 5, 80);
  return recency + freshBoost + ownPost + socialAffinity + sharedGym + streak + engagement;
}

type AggregateState = {
  profiles: ProfileRow[];
  stats: UserStatsRow[];
  gyms: GymRow[];
  userGyms: UserGymRow[];
  follows: FollowRow[];
  feedPosts: FeedPostRow[];
  stories: StoryRow[];
  postLikes: PostLikeRow[];
  postComments: PostCommentRow[];
  checkinsToday: CheckinRow[];
  myActivityDays: UserActivityDayRow[];
  myNotifications: NotificationRow[];
  chatMessages: DirectMessageRow[];
};

const EMPTY: AggregateState = {
  profiles: [],
  stats: [],
  gyms: [],
  userGyms: [],
  follows: [],
  feedPosts: [],
  stories: [],
  postLikes: [],
  postComments: [],
  checkinsToday: [],
  myActivityDays: [],
  myNotifications: [],
  chatMessages: [],
};

export type SupabaseSocialActions = {
  likePost: (postId: string) => Promise<void>;
  commentPost: (postId: string, body: string) => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;
  openStory: (storyId: string) => void;
  closeStory: () => void;
  publishWorkout: (input: CreateWorkoutPostInput) => Promise<void>;
  checkIn: (gymName: string) => Promise<void>;
  editPost: (postId: string, input: EditPostInput) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  sendChatMessage: (input: SendChatMessageInput) => Promise<void>;
  markChatThreadRead: (userId: string) => Promise<void>;
  acceptFollowRequest: (requesterId: string) => Promise<void>;
  rejectFollowRequest: (requesterId: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: ProfileEditInput) => Promise<void>;
};

export type SupabaseSocialResult = {
  currentUser: EnrichedUser;
  users: Record<string, GymUser>;
  feedPosts: EnrichedPost[];
  storyBubbles: EnrichedStory[];
  selectedStory: EnrichedStory | null;
  suggestedUsers: EnrichedUser[];
  nearbyUsers: EnrichedUser[];
  chatMessages: ChatMessage[];
  socialStats: {
    trainedToday: number;
    checkInsToday: number;
    monthDays: ReturnType<typeof buildMonthWorkoutDays>;
  };
  feedback: FeedbackMessage | null;
  formatPostClock: typeof formatPostClock;
  actions: SupabaseSocialActions;
  unreadNotifications: number;
  unreadMessages: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function useSupabaseSocial(currentUserId: string): SupabaseSocialResult {
  const services = useGymCircleServices();
  const [agg, setAgg] = useState<AggregateState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [viewedStoryIds, setViewedStoryIds] = useState<Set<string>>(() => new Set());
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [
        profilesRes,
        statsRes,
        gymsRes,
        userGymsRes,
        followsRes,
        feedRes,
        storiesRes,
        myActivityRes,
        checkinsTodayRes,
        myNotificationsRes,
        chatMessagesRes,
      ] = await Promise.all([
        services.client.from("profiles").select("*"),
        services.client.from("user_stats_live").select("*"),
        services.client.from("gyms").select("*"),
        services.client.from("user_gyms").select("*"),
        services.client.from("follows").select("*"),
        services.client.from("feed_posts").select("*").order("created_at", { ascending: false }).limit(40),
        services.client.from("stories").select("*").gt("expires_at", new Date().toISOString()),
        services.client
          .from("user_activity_days")
          .select("*")
          .eq("user_id", currentUserId)
          .order("activity_date", { ascending: true }),
        services.client
          .from("checkins")
          .select("*")
          .eq("checkin_date", new Date().toISOString().slice(0, 10)),
        services.client
          .from("notifications")
          .select("*")
          .eq("user_id", currentUserId)
          .order("created_at", { ascending: false })
          .limit(50),
        services.client
          .from("direct_messages")
          .select("*")
          .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
          .order("created_at", { ascending: true })
          .limit(200),
      ]);

      for (const r of [
        profilesRes,
        statsRes,
        gymsRes,
        userGymsRes,
        followsRes,
        feedRes,
        storiesRes,
        myActivityRes,
        checkinsTodayRes,
        myNotificationsRes,
        chatMessagesRes,
      ]) {
        if (r.error) throw r.error;
      }

      const feedPosts = (feedRes.data ?? []) as FeedPostRow[];
      const postIds = feedPosts.map((p) => p.id);
      const [likesRes, commentsRes] = await Promise.all([
        postIds.length > 0
          ? services.client.from("post_likes").select("*").in("post_id", postIds)
          : Promise.resolve({ data: [] as PostLikeRow[], error: null }),
        postIds.length > 0
          ? services.client
              .from("post_comments")
              .select("*")
              .in("post_id", postIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: [] as PostCommentRow[], error: null }),
      ]);
      if (likesRes.error) throw likesRes.error;
      if (commentsRes.error) throw commentsRes.error;

      if (!mountedRef.current) return;
      setAgg({
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        stats: (statsRes.data ?? []) as UserStatsRow[],
        gyms: (gymsRes.data ?? []) as GymRow[],
        userGyms: (userGymsRes.data ?? []) as UserGymRow[],
        follows: (followsRes.data ?? []) as FollowRow[],
        feedPosts,
        stories: (storiesRes.data ?? []) as StoryRow[],
        postLikes: (likesRes.data ?? []) as PostLikeRow[],
        postComments: (commentsRes.data ?? []) as PostCommentRow[],
        checkinsToday: (checkinsTodayRes.data ?? []) as CheckinRow[],
        myActivityDays: (myActivityRes.data ?? []) as UserActivityDayRow[],
        myNotifications: (myNotificationsRes.data ?? []) as NotificationRow[],
        chatMessages: (chatMessagesRes.data ?? []) as DirectMessageRow[],
      });
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err as Error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [services, currentUserId]);

  useEffect(() => {
    mountedRef.current = true;
    const refreshId = window.setTimeout(() => {
      void refresh();
    }, 0);
    const channel = services.client
      .channel("supabase-social")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "stories" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_stats" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_messages" }, () => refresh())
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => refresh(),
      )
      .subscribe();
    return () => {
      window.clearTimeout(refreshId);
      mountedRef.current = false;
      services.client.removeChannel(channel);
    };
  }, [services, refresh, currentUserId]);

  const showFeedback = useCallback(
    (tone: FeedbackTone, title: string, detail?: string) => {
      simulateHaptic(tone);
      const id = Date.now();
      setFeedback({ id, tone, title, detail });
      window.setTimeout(() => {
        setFeedback((curr) => (curr?.id === id ? null : curr));
      }, 2200);
    },
    [],
  );

  // ---- Derivações memoizadas ----
  const enrichedAll = useMemo(() => {
    const statsByUser = new Map(agg.stats.map((s) => [s.user_id, s]));
    const gymsById = new Map(agg.gyms.map((g) => [g.id, g]));
    const userGymsByUser = new Map<string, UserGymRow[]>();
    for (const ug of agg.userGyms) {
      const list = userGymsByUser.get(ug.user_id) ?? [];
      list.push(ug);
      userGymsByUser.set(ug.user_id, list);
    }
    // Counts só consideram relações aceitas. Pending fica fora.
    const followersCountByUser = new Map<string, number>();
    const followingCountByUser = new Map<string, number>();
    for (const f of agg.follows) {
      if (f.status !== "accepted") continue;
      followersCountByUser.set(f.following_id, (followersCountByUser.get(f.following_id) ?? 0) + 1);
      followingCountByUser.set(f.follower_id, (followingCountByUser.get(f.follower_id) ?? 0) + 1);
    }
    // Para o usuário atual: mapa user_id → status do follow que parto pra esse user.
    const myFollowStatusByTarget = new Map<string, "pending" | "accepted">();
    for (const f of agg.follows) {
      if (f.follower_id === currentUserId) {
        myFollowStatusByTarget.set(f.following_id, f.status);
      }
    }
    const checkinsCountByUser = new Map<string, number>();
    for (const c of agg.checkinsToday) {
      checkinsCountByUser.set(c.user_id, (checkinsCountByUser.get(c.user_id) ?? 0) + 1);
    }
    const myActivityDates = new Set(agg.myActivityDays.map((d) => d.activity_date));

    const map = new Map<string, EnrichedUser>();
    for (const profile of agg.profiles) {
      const stats = statsByUser.get(profile.user_id);
      const birthDate = profile.birth_date ?? null;
      const userGyms = userGymsByUser.get(profile.user_id) ?? [];
      const gymNames = userGyms
        .map((ug) => gymsById.get(ug.gym_id)?.name)
        .filter((n): n is string => Boolean(n));
      const mainUserGym = userGyms.find((ug) => ug.is_main);
      const followStatus =
        myFollowStatusByTarget.get(profile.user_id) ?? "none";
      const enriched: EnrichedUser = {
        id: profile.user_id,
        name: profile.display_name,
        username: profile.username,
        accent: accentForId(profile.user_id),
        avatarUrl: profile.avatar_url ?? null,
        bio: profile.bio ?? "",
        goal: profile.fitness_goal ?? "",
        instagramUsername: profile.instagram_username ?? null,
        birthDate,
        age: calculateAgeFromBirthDate(birthDate),
        isBirthday: isBirthdayFromBirthDate(birthDate),
        sports: profile.sports ?? [],
        location: gymsById.get(profile.main_gym_id ?? "")?.city ?? "",
        gyms: gymNames,
        preferredTimes: mainUserGym?.preferred_times ?? [],
        currentStreak: stats?.current_streak ?? 0,
        longestStreak: stats?.best_streak ?? 0,
        lastWorkoutDate: stats?.last_active_date ?? "",
        workoutsThisMonth: stats?.workouts_this_month ?? 0,
        activeDaysCount: stats?.active_days_this_year ?? 0,
        checkInsCount: profile.user_id === currentUserId ? agg.myActivityDays.length : 0,
        achievements: deriveAchievements(stats),
        followersCount: followersCountByUser.get(profile.user_id) ?? 0,
        followingCount: followingCountByUser.get(profile.user_id) ?? 0,
        isFollowing: followStatus === "accepted",
        followStatus,
        isPrivate: profile.is_private ?? false,
        workoutDays: profile.user_id === currentUserId ? Array.from(myActivityDates) : [],
        ...getDailyPresenceFromStats(stats),
      };
      map.set(profile.user_id, enriched);
    }
    return map;
  }, [agg, currentUserId]);

  const currentUser = useMemo<EnrichedUser>(() => {
    return (
      enrichedAll.get(currentUserId) ?? {
        id: currentUserId,
        name: "—",
        username: "—",
        accent: "var(--gc-brand)",
        avatarUrl: null,
        bio: "",
        goal: "",
        instagramUsername: null,
        birthDate: null,
        age: null,
        isBirthday: false,
        sports: [],
        location: "",
        gyms: [],
        preferredTimes: [],
        currentStreak: 0,
        longestStreak: 0,
        lastWorkoutDate: "",
        workoutsThisMonth: 0,
        activeDaysCount: 0,
        checkInsCount: 0,
        achievements: [],
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
        followStatus: "none",
        isPrivate: false,
        workoutDays: [],
        streakLitToday: false,
        streakPresenceSource: "none",
      }
    );
  }, [enrichedAll, currentUserId]);

  const usersRecord = useMemo<Record<string, GymUser>>(() => {
    const record: Record<string, GymUser> = {};
    enrichedAll.forEach((user, id) => {
      record[id] = user;
    });
    return record;
  }, [enrichedAll]);

  const feedPosts = useMemo<EnrichedPost[]>(() => {
    if (!agg.feedPosts.length) return [];
    const myLikedSet = new Set(
      agg.postLikes.filter((l) => l.user_id === currentUserId).map((l) => l.post_id),
    );
    const commentsByPost = new Map<string, PostCommentRow[]>();
    for (const c of agg.postComments) {
      const list = commentsByPost.get(c.post_id) ?? [];
      list.push(c);
      commentsByPost.set(c.post_id, list);
    }
    const likesByPost = new Map<string, PostLikeRow[]>();
    for (const l of agg.postLikes) {
      const list = likesByPost.get(l.post_id) ?? [];
      list.push(l);
      likesByPost.set(l.post_id, list);
    }

    return agg.feedPosts
      .map((row) => {
        const author = enrichedAll.get(row.user_id) ?? currentUser;
        const likesCount = row.likes_count ?? 0;
        const postComments = commentsByPost.get(row.id) ?? [];
        const commentPreviews = postComments.slice(-2).map((c) => ({
          id: c.id,
          postId: c.post_id,
          userId: c.user_id,
          body: c.body,
          createdAt: c.created_at,
          author: enrichedAll.get(c.user_id) ?? author,
        }));
        const likedByPreview = (likesByPost.get(row.id) ?? [])
          .map((l) => enrichedAll.get(l.user_id))
          .filter((u): u is EnrichedUser => Boolean(u))
          .slice(0, row.user_id === currentUserId ? 3 : 0);
        const smartScore = getSmartScore(
          row,
          likesCount,
          row.comments_count ?? 0,
          author,
          currentUser,
        );
        return {
          id: row.id,
          userId: row.user_id,
          imageUrl: row.image_url,
          mediaType: row.media_type ?? "image",
          caption: row.caption ?? "",
          workoutType: row.workout_type ?? null,
          gymName: row.location_name ?? agg.gyms.find((g) => g.id === row.gym_id)?.name ?? "",
          gymId: row.gym_id ?? "",
          locationSource: row.location_source ?? "none",
          locationName: row.location_name ?? null,
          locationLatitude: row.location_latitude ?? null,
          locationLongitude: row.location_longitude ?? null,
          locationGoogleMapsUrl: row.location_google_maps_url ?? null,
          createdAt: row.created_at,
          workoutDate: row.workout_date,
          isWorkoutPost: true as const,
          streakAtPost: row.author_current_streak ?? 0,
          likesCount,
          likedByCurrentUser: myLikedSet.has(row.id),
          comments: postComments.map((c) => ({
            id: c.id,
            postId: c.post_id,
            userId: c.user_id,
            body: c.body,
            createdAt: c.created_at,
          })),
          author,
          commentPreviews,
          likedByPreview,
          smartScore,
          smartReason: getSmartReason(row, author, currentUser),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [agg, enrichedAll, currentUser, currentUserId]);

  const storyBubbles = useMemo<EnrichedStory[]>(() => {
    const out: EnrichedStory[] = [];
    for (const row of agg.stories) {
      const author = enrichedAll.get(row.user_id);
      if (!author) continue;
      out.push({
        id: row.id,
        userId: row.user_id,
        imageUrl: row.media_url,
        mediaType: row.media_type ?? "image",
        title: row.workout_type ?? "Treino",
        caption: `${author.currentStreak}d · ${author.gyms[0] ?? ""}`,
        createdAt: row.created_at,
        viewed: viewedStoryIds.has(row.id),
        kind: "workout",
        author,
      });
    }
    return out;
  }, [agg.stories, enrichedAll, viewedStoryIds]);

  const selectedStory = useMemo(
    () => storyBubbles.find((s) => s.id === selectedStoryId) ?? null,
    [storyBubbles, selectedStoryId],
  );

  const suggestedUsers = useMemo<EnrichedUser[]>(() => {
    const list: EnrichedUser[] = [];
    enrichedAll.forEach((u) => {
      if (u.id !== currentUserId) list.push(u);
    });
    return list.sort((a, b) => {
      const aScore =
        getSharedGymCount(currentUser, a) * 10 +
        (a.streakLitToday ? 5 : 0) +
        a.currentStreak;
      const bScore =
        getSharedGymCount(currentUser, b) * 10 +
        (b.streakLitToday ? 5 : 0) +
        b.currentStreak;
      return bScore - aScore;
    });
  }, [enrichedAll, currentUser, currentUserId]);

  const nearbyUsers = useMemo<EnrichedUser[]>(
    () => suggestedUsers.filter((u) => getSharedGymCount(currentUser, u) > 0),
    [suggestedUsers, currentUser],
  );

  const socialStats = useMemo(
    () => ({
      trainedToday: new Set(
        [
          ...agg.feedPosts
            .filter((p) => p.workout_date === new Date().toISOString().slice(0, 10))
            .map((p) => p.user_id),
          ...agg.stories
            .filter((story) => story.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10))
            .map((story) => story.user_id),
        ],
      ).size,
      checkInsToday: agg.checkinsToday.length,
      monthDays: buildMonthWorkoutDays(currentUser.workoutDays),
    }),
    [agg.feedPosts, agg.stories, agg.checkinsToday, currentUser.workoutDays],
  );

  const chatMessages = useMemo<ChatMessage[]>(
    () =>
      agg.chatMessages.map((message) => ({
        id: message.id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        body: message.body,
        mediaUrl: message.media_url,
        mediaType: message.media_type,
        createdAt: message.created_at,
        readAt: message.read_at,
      })),
    [agg.chatMessages],
  );

  const actions = useMemo<SupabaseSocialActions>(
    () => ({
      async likePost(postId: string) {
        const post = feedPosts.find((p) => p.id === postId);
        const liked = post?.likedByCurrentUser ?? false;
        if (liked) {
          await services.posts.unlike(postId, currentUserId);
        } else {
          await services.posts.like(postId, currentUserId);
          showFeedback("like", "Curtida enviada");
        }
      },
      async commentPost(postId: string, body: string) {
        await services.posts.comment(postId, currentUserId, body);
        showFeedback("comment", "Comentário publicado");
      },
      async toggleFollow(userId: string) {
        const target = enrichedAll.get(userId);
        const result = await services.follows.toggle(currentUserId, userId);
        let title: string;
        switch (result.followStatus) {
          case "accepted":
            title = "Agora no seu circle";
            break;
          case "pending":
            title = "Solicitação enviada";
            break;
          case "none":
          default:
            title = target?.followStatus === "pending"
              ? "Solicitação cancelada"
              : "Você deixou de seguir";
            break;
        }
        showFeedback("follow", title, target?.name);
        await refresh();
      },
      openStory(storyId: string) {
        setViewedStoryIds((current) => {
          const next = new Set(current);
          next.add(storyId);
          return next;
        });
        setSelectedStoryId(storyId);
        simulateHaptic("brand");
      },
      closeStory() {
        setSelectedStoryId(null);
      },
      async publishWorkout(input: CreateWorkoutPostInput) {
        const destinations = input.destinations ?? { feed: true, story: true };
        const wantsFeed = destinations.feed;
        const wantsStory = destinations.story;
        if (!wantsFeed && !wantsStory) {
          showFeedback("brand", "Escolha onde postar", "Feed, Story, ou ambos");
          return;
        }

        if (wantsFeed) {
          await services.posts.create(currentUserId, {
            imageUrl: input.imageUrl,
            mediaType: input.mediaType,
            caption: input.caption,
            gymId: input.gymId ?? null,
            workoutType: input.workoutType ?? null,
            locationSource: input.locationSource ?? "none",
            locationName: input.locationName ?? null,
            locationLatitude: input.locationLatitude ?? null,
            locationLongitude: input.locationLongitude ?? null,
            locationGoogleMapsUrl: input.locationGoogleMapsUrl ?? null,
          });
        }

        if (wantsStory) {
          // Garante só 1 story ativo por usuário — substitui o anterior, se houver.
          await services.client
            .from("stories")
            .delete()
            .eq("user_id", currentUserId);
          await services.stories.create(currentUserId, {
            mediaUrl: input.imageUrl,
            mediaType: input.mediaType,
            gymId: input.gymId ?? null,
            workoutType: input.workoutType ?? null,
          });
        }

        await services.stats.refreshMine();
        await refresh();

        const detail = wantsFeed && wantsStory
          ? "Feed + story atualizados"
          : wantsFeed
            ? "Postado no feed"
            : "Story publicado";
        showFeedback("success", "Treino publicado", detail);
      },
      async checkIn(gymName: string) {
        const gym = agg.gyms.find((g) => g.name === gymName);
        if (!gym) {
          showFeedback("brand", "Academia não encontrada", gymName);
          return;
        }
        await services.checkins.checkIn(currentUserId, gym.id);
        showFeedback("brand", "Check-in ativo", gymName);
      },
      async editPost(postId: string, input: EditPostInput) {
        const patch: { caption?: string | null; workout_type?: string | null } = {};
        if (input.caption !== undefined) patch.caption = input.caption;
        if (input.workoutType !== undefined) patch.workout_type = input.workoutType;
        await services.posts.update(postId, patch);
        await refresh();
        showFeedback("success", "Post atualizado");
      },
      async deletePost(postId: string) {
        await services.posts.remove(postId);
        await refresh();
        showFeedback("success", "Post apagado");
      },
      async sendChatMessage(input: SendChatMessageInput) {
        const body = input.body?.trim() || null;
        const mediaUrl = input.mediaUrl?.trim() || null;
        if (!body && !mediaUrl) return;
        const { error } = await services.client.from("direct_messages").insert({
          sender_id: currentUserId,
          receiver_id: input.receiverId,
          body,
          media_url: mediaUrl,
          media_type: mediaUrl ? (input.mediaType ?? "image") : null,
        });
        if (error) throw error;
        await refresh();
        showFeedback("comment", mediaUrl ? "Mídia enviada" : "Mensagem enviada");
      },
      async markChatThreadRead(userId: string) {
        const { error } = await services.client
          .from("direct_messages")
          .update({ read_at: new Date().toISOString() })
          .eq("sender_id", userId)
          .eq("receiver_id", currentUserId)
          .is("read_at", null);
        if (error) throw error;
        await refresh();
      },
      async signOut() {
        await services.auth.signOut();
      },
      async updateProfile(input: ProfileEditInput) {
        await services.profiles.update(currentUserId, {
          ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
          ...(input.username !== undefined ? { username: input.username } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.fitnessGoal !== undefined ? { fitness_goal: input.fitnessGoal } : {}),
          ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
          ...(input.isPrivate !== undefined ? { is_private: input.isPrivate } : {}),
          ...(input.instagramUsername !== undefined
            ? { instagram_username: input.instagramUsername }
            : {}),
          ...(input.birthDate !== undefined ? { birth_date: input.birthDate } : {}),
          ...(input.sports !== undefined ? { sports: input.sports } : {}),
        });
        await refresh();
        showFeedback("success", "Perfil atualizado");
      },
      async acceptFollowRequest(requesterId: string) {
        const requester = enrichedAll.get(requesterId);
        await services.follows.acceptRequest(currentUserId, requesterId);
        await refresh();
        showFeedback("follow", "Solicitação aceita", requester?.name);
      },
      async rejectFollowRequest(requesterId: string) {
        await services.follows.rejectRequest(currentUserId, requesterId);
        await refresh();
        showFeedback("brand", "Solicitação recusada");
      },
    }),
    [services, currentUserId, feedPosts, enrichedAll, agg.gyms, refresh, showFeedback],
  );

  const unreadNotifications = useMemo(
    () => agg.myNotifications.filter((n) => !n.read_at).length,
    [agg.myNotifications],
  );

  const unreadMessages = useMemo(
    () => agg.chatMessages.filter((m) => m.receiver_id === currentUserId && !m.read_at).length,
    [agg.chatMessages, currentUserId],
  );

  return {
    currentUser,
    users: usersRecord,
    feedPosts,
    storyBubbles,
    selectedStory,
    suggestedUsers,
    nearbyUsers,
    chatMessages,
    socialStats,
    feedback,
    formatPostClock,
    actions,
    unreadNotifications,
    unreadMessages,
    loading,
    error,
    refresh,
  };
}
