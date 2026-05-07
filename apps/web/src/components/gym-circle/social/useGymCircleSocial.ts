"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import { createInitialSocialState, workoutImagePool } from "./mock-data";
import { simulateHaptic } from "./haptics";
import {
  buildMonthWorkoutDays,
  calculateWorkoutStats,
  formatDateKey,
  getDailyStreakPresence,
} from "./streak";
import type {
  CreateWorkoutPostInput,
  EnrichedUser,
  EnrichedPost,
  EnrichedStory,
  FeedbackMessage,
  FeedbackTone,
  GymComment,
  GymPost,
  GymStory,
  GymUser,
  SocialState,
} from "./types";

type SocialAction =
  | { type: "like-post"; postId: string }
  | { type: "comment-post"; postId: string; body: string }
  | { type: "toggle-follow"; userId: string }
  | { type: "view-story"; storyId: string }
  | { type: "publish-workout"; input: CreateWorkoutPostInput }
  | { type: "check-in"; gymName: string };

function formatPostClock(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getSharedGymCount(currentUser: GymUser, user: GymUser) {
  return user.gyms.filter((gym) => currentUser.gyms.includes(gym)).length;
}

function getSmartReason(post: GymPost, author: GymUser, currentUser: GymUser) {
  if (post.userId === currentUser.id) {
    return "Seu treino";
  }

  if (author.isFollowing) {
    return "Seguindo";
  }

  if (getSharedGymCount(currentUser, author) > 0) {
    return "Mesma academia";
  }

  if (post.streakAtPost >= 10) {
    return "Streak em alta";
  }

  return "Descoberta";
}

function getSmartScore(post: GymPost, author: GymUser, currentUser: GymUser) {
  const createdAt = new Date(post.createdAt).getTime();
  const recency = createdAt / 100000000000;
  const freshBoost = Date.now() - createdAt < 60000 ? 600 : 0;
  const ownPost = post.userId === currentUser.id ? 160 : 0;
  const socialAffinity = author.isFollowing ? 80 : 0;
  const sharedGym = getSharedGymCount(currentUser, author) * 26;
  const streak = Math.min(post.streakAtPost * 3, 60);
  const engagement = Math.min(post.likesCount / 18 + post.comments.length * 5, 80);

  return recency + freshBoost + ownPost + socialAffinity + sharedGym + streak + engagement;
}

function withStreakPresence(
  user: GymUser,
  state: SocialState,
  todayKey = formatDateKey(new Date()),
): EnrichedUser {
  return {
    ...user,
    ...getDailyStreakPresence(user.id, state.posts, state.stories, todayKey),
  };
}

function createComment(postId: string, userId: string, body: string): GymComment {
  return {
    id: `comment-${Date.now()}`,
    postId,
    userId,
    body,
    createdAt: new Date().toISOString(),
  };
}

function getLikedByPreview(
  post: GymPost,
  users: Record<string, GymUser>,
  currentUser: EnrichedUser,
  state: SocialState,
) {
  const candidates = Object.values(users)
    .filter((user) => user.id !== post.userId && user.id !== currentUser.id)
    .map((user) => withStreakPresence(user, state))
    .sort((a, b) => {
      const aScore =
        (a.streakLitToday ? 25 : 0) +
        (a.isFollowing ? 40 : 0) +
        a.currentStreak +
        a.followersCount / 120;
      const bScore =
        (b.streakLitToday ? 25 : 0) +
        (b.isFollowing ? 40 : 0) +
        b.currentStreak +
        b.followersCount / 120;

      return bScore - aScore;
    });

  return [
    ...(post.likedByCurrentUser ? [currentUser] : []),
    ...candidates,
  ].slice(0, 3);
}

function socialReducer(state: SocialState, action: SocialAction): SocialState {
  switch (action.type) {
    case "like-post": {
      return {
        ...state,
        posts: state.posts.map((post) => {
          if (post.id !== action.postId) {
            return post;
          }

          const likedByCurrentUser = !post.likedByCurrentUser;

          return {
            ...post,
            likedByCurrentUser,
            likesCount: post.likesCount + (likedByCurrentUser ? 1 : -1),
          };
        }),
      };
    }

    case "comment-post": {
      const body = action.body.trim();

      if (!body) {
        return state;
      }

      return {
        ...state,
        posts: state.posts.map((post) =>
          post.id === action.postId
            ? {
                ...post,
                comments: [
                  ...post.comments,
                  createComment(action.postId, state.currentUserId, body),
                ],
              }
            : post,
        ),
      };
    }

    case "toggle-follow": {
      const user = state.users[action.userId];

      if (!user || user.id === state.currentUserId) {
        return state;
      }

      const isFollowing = !user.isFollowing;

      return {
        ...state,
        users: {
          ...state.users,
          [action.userId]: {
            ...user,
            isFollowing,
            followersCount: user.followersCount + (isFollowing ? 1 : -1),
          },
          [state.currentUserId]: {
            ...state.users[state.currentUserId],
            followingCount:
              state.users[state.currentUserId].followingCount +
              (isFollowing ? 1 : -1),
          },
        },
      };
    }

    case "view-story": {
      return {
        ...state,
        stories: state.stories.map((story) =>
          story.id === action.storyId ? { ...story, viewed: true } : story,
        ),
      };
    }

    case "publish-workout": {
      const currentUser = state.users[state.currentUserId];
      const todayKey = formatDateKey(new Date());
      const isNewWorkoutDay = !currentUser.workoutDays.includes(todayKey);
      const workoutDays = Array.from(new Set([...currentUser.workoutDays, todayKey]));
      const stats = calculateWorkoutStats(workoutDays, todayKey);
      const createdAt = new Date().toISOString();
      const postId = `post-${Date.now()}`;

      const post: GymPost = {
        id: postId,
        userId: currentUser.id,
        imageUrl: action.input.imageUrl,
        caption: action.input.caption.trim() || "Treino concluido.",
        workoutType: action.input.workoutType,
        gymName: action.input.gymName,
        gymId: action.input.gymId,
        createdAt,
        workoutDate: todayKey,
        isWorkoutPost: true,
        streakAtPost: stats.currentStreak,
        likesCount: 0,
        likedByCurrentUser: false,
        comments: [],
      };

      const story: GymStory = {
        id: `story-${postId}`,
        userId: currentUser.id,
        imageUrl: action.input.imageUrl,
        title: action.input.workoutType,
        caption: `${stats.currentStreak} dias de streak`,
        createdAt,
        viewed: false,
        kind: "workout",
      };

      return {
        ...state,
        users: {
          ...state.users,
          [currentUser.id]: {
            ...currentUser,
            workoutDays,
            activeDaysCount: currentUser.activeDaysCount + (isNewWorkoutDay ? 1 : 0),
            ...stats,
          },
        },
        posts: [post, ...state.posts],
        stories: [story, ...state.stories.filter((item) => item.userId !== currentUser.id)],
      };
    }

    case "check-in": {
      const currentUser = state.users[state.currentUserId];
      const createdAt = new Date().toISOString();
      const checkedInAlready = state.checkInsToday.includes(currentUser.id);
      const story: GymStory = {
        id: `story-checkin-${Date.now()}`,
        userId: currentUser.id,
        imageUrl: workoutImagePool[1],
        title: "Check-in",
        caption: `${currentUser.currentStreak}d · ${action.gymName}`,
        createdAt,
        viewed: false,
        kind: "checkin",
      };

      return {
        ...state,
        users: {
          ...state.users,
          [currentUser.id]: {
            ...currentUser,
            checkInsCount: currentUser.checkInsCount + (checkedInAlready ? 0 : 1),
          },
        },
        checkInsToday: Array.from(new Set([currentUser.id, ...state.checkInsToday])),
        stories: [story, ...state.stories.filter((item) => item.userId !== currentUser.id)],
      };
    }

    default:
      return state;
  }
}

export function useGymCircleSocial() {
  const [state, dispatch] = useReducer(socialReducer, undefined, createInitialSocialState);
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  const currentUser = useMemo(
    () => withStreakPresence(state.users[state.currentUserId], state),
    [state],
  );

  const showFeedback = useCallback((tone: FeedbackTone, title: string, detail?: string) => {
    simulateHaptic(tone);
    const id = Date.now();
    setFeedback({ id, tone, title, detail });
    window.setTimeout(() => {
      setFeedback((current) => (current?.id === id ? null : current));
    }, 2200);
  }, []);

  const feedPosts = useMemo<EnrichedPost[]>(() => {
    return state.posts
      .map((post) => {
        const author = withStreakPresence(state.users[post.userId], state);
        const smartScore = getSmartScore(post, author, currentUser);

        return {
          ...post,
          author,
          commentPreviews: post.comments.slice(-2).map((comment) => ({
            ...comment,
            author: withStreakPresence(state.users[comment.userId], state),
          })),
          likedByPreview: getLikedByPreview(post, state.users, currentUser, state),
          smartScore,
          smartReason: getSmartReason(post, author, currentUser),
        };
      })
      .sort((a, b) => b.smartScore - a.smartScore);
  }, [currentUser, state]);

  const storyBubbles = useMemo<EnrichedStory[]>(() => {
    return state.stories.map((story) => ({
      ...story,
      author: withStreakPresence(state.users[story.userId], state),
    }));
  }, [state]);

  const selectedStory = useMemo(() => {
    if (!selectedStoryId) {
      return null;
    }

    return storyBubbles.find((story) => story.id === selectedStoryId) ?? null;
  }, [selectedStoryId, storyBubbles]);

  const suggestedUsers = useMemo(() => {
    return Object.values(state.users)
      .filter((user) => user.id !== state.currentUserId)
      .map((user) => withStreakPresence(user, state))
      .sort((a, b) => {
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
  }, [currentUser, state]);

  const nearbyUsers = useMemo(() => {
    return suggestedUsers.filter((user) => getSharedGymCount(currentUser, user) > 0);
  }, [currentUser, suggestedUsers]);

  const socialStats = useMemo(() => {
    return {
      trainedToday: new Set(state.posts.filter((post) => post.workoutDate === formatDateKey(new Date())).map((post) => post.userId)).size,
      checkInsToday: state.checkInsToday.length,
      monthDays: buildMonthWorkoutDays(currentUser.workoutDays),
    };
  }, [currentUser.workoutDays, state.checkInsToday.length, state.posts]);

  const actions = useMemo(
    () => ({
      likePost(postId: string) {
        dispatch({ type: "like-post", postId });
        showFeedback("like", "Curtida enviada");
      },
      commentPost(postId: string, body: string) {
        dispatch({ type: "comment-post", postId, body });
        showFeedback("comment", "Comentario publicado");
      },
      toggleFollow(userId: string) {
        const user = state.users[userId];
        dispatch({ type: "toggle-follow", userId });
        showFeedback(
          "follow",
          user?.isFollowing ? "Voce deixou de seguir" : "Agora no seu circle",
          user?.name,
        );
      },
      openStory(storyId: string) {
        dispatch({ type: "view-story", storyId });
        setSelectedStoryId(storyId);
        simulateHaptic("brand");
      },
      closeStory() {
        setSelectedStoryId(null);
      },
      publishWorkout(input: CreateWorkoutPostInput) {
        dispatch({ type: "publish-workout", input });
        showFeedback("success", "Treino publicado", "Streak atualizado");
      },
      checkIn(gymName: string) {
        dispatch({ type: "check-in", gymName });
        showFeedback("brand", "Check-in ativo", gymName);
      },
    }),
    [showFeedback, state.users],
  );

  return {
    currentUser,
    users: state.users,
    feedPosts,
    storyBubbles,
    selectedStory,
    suggestedUsers,
    nearbyUsers,
    socialStats,
    feedback,
    formatPostClock,
    actions,
  };
}
