"use client";

import { useCallback, useMemo, useReducer, useState } from "react";
import { createInitialSocialState, workoutImagePool } from "./mock-data";
import { simulateHaptic } from "./haptics";
import {
  buildMonthWorkoutDays,
  calculateWorkoutStats,
  formatDateKey,
  formatStreakDays,
  getDailyStreakPresence,
} from "./streak";
import {
  calculateAgeFromBirthDate,
  isBirthdayFromBirthDate,
} from "./profile";
import { sortStoriesNewestFirst } from "./stories";
import type {
  ChatMessage,
  CreateWorkoutPostInput,
  EditPostInput,
  EnrichedUser,
  EnrichedPost,
  EnrichedStory,
  FeedbackMessage,
  FeedbackTone,
  GymLocationOption,
  GymComment,
  GymPost,
  GymStory,
  GymUser,
  ProfileEditInput,
  SendChatMessageInput,
  SocialState,
} from "./types";

type SocialAction =
  | { type: "like-post"; postId: string }
  | { type: "comment-post"; postId: string; body: string }
  | { type: "delete-comment"; postId: string; commentId: string }
  | { type: "like-comment"; postId: string; commentId: string }
  | { type: "toggle-follow"; userId: string }
  | { type: "view-story"; storyId: string }
  | { type: "like-story"; storyId: string }
  | { type: "delete-story"; storyId: string }
  | { type: "mute-story-author"; authorId: string }
  | { type: "publish-workout"; input: CreateWorkoutPostInput }
  | { type: "check-in"; gymName: string }
  | { type: "edit-post"; postId: string; input: EditPostInput }
  | { type: "delete-post"; postId: string }
  | { type: "accept-follow-request"; requesterId: string }
  | { type: "reject-follow-request"; requesterId: string }
  | { type: "update-profile"; input: ProfileEditInput }
  | { type: "send-chat-message"; input: SendChatMessageInput }
  | { type: "mark-chat-thread-read"; userId: string }
  | { type: "delete-chat-conversation"; userId: string };

function formatPostClock(createdAt: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getSharedGymCount(currentUser: GymUser, user: GymUser) {
  return user.gyms.filter((gym) => currentUser.gyms.includes(gym)).length;
}

function slugGymId(name: string): string {
  return `mock-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
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
    age: calculateAgeFromBirthDate(user.birthDate),
    isBirthday: isBirthdayFromBirthDate(user.birthDate),
    sports: user.sports ?? [],
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
    likesCount: 0,
    likedByCurrentUser: false,
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

    case "delete-comment": {
      return {
        ...state,
        posts: state.posts.map((post) => {
          if (post.id !== action.postId) return post;
          return {
            ...post,
            comments: post.comments.filter(
              (comment) =>
                !(
                  comment.id === action.commentId &&
                  comment.userId === state.currentUserId
                ),
            ),
          };
        }),
      };
    }

    case "like-comment": {
      return {
        ...state,
        posts: state.posts.map((post) => {
          if (post.id !== action.postId) return post;
          return {
            ...post,
            comments: post.comments.map((comment) => {
              if (
                comment.id !== action.commentId ||
                comment.userId === state.currentUserId
              ) {
                return comment;
              }
              const nextLiked = !comment.likedByCurrentUser;
              return {
                ...comment,
                likedByCurrentUser: nextLiked,
                likesCount: Math.max(
                  0,
                  (comment.likesCount ?? 0) + (nextLiked ? 1 : -1),
                ),
              };
            }),
          };
        }),
      };
    }

    case "toggle-follow": {
      const user = state.users[action.userId];
      if (!user || user.id === state.currentUserId) return state;

      const current = user.followStatus ?? (user.isFollowing ? "accepted" : "none");
      let next: typeof current;
      if (current === "accepted" || current === "pending") {
        next = "none";
      } else {
        next = user.isPrivate ? "pending" : "accepted";
      }

      const followersDelta =
        (current === "accepted" ? -1 : 0) + (next === "accepted" ? 1 : 0);
      const followingDelta = followersDelta;

      return {
        ...state,
        users: {
          ...state.users,
          [action.userId]: {
            ...user,
            followStatus: next,
            isFollowing: next === "accepted",
            followersCount: user.followersCount + followersDelta,
          },
          [state.currentUserId]: {
            ...state.users[state.currentUserId],
            followingCount:
              state.users[state.currentUserId].followingCount + followingDelta,
          },
        },
      };
    }

    case "accept-follow-request": {
      const requester = state.users[action.requesterId];
      if (!requester || requester.followStatus !== "pending") return state;
      const me = state.users[state.currentUserId];
      return {
        ...state,
        users: {
          ...state.users,
          [requester.id]: {
            ...requester,
            followStatus: "accepted",
            isFollowing: true,
            followersCount: requester.followersCount + 1,
          },
          [state.currentUserId]: {
            ...me,
            followingCount: me.followingCount + 1,
          },
        },
      };
    }

    case "reject-follow-request": {
      const requester = state.users[action.requesterId];
      if (!requester || requester.followStatus !== "pending") return state;
      return {
        ...state,
        users: {
          ...state.users,
          [requester.id]: {
            ...requester,
            followStatus: "none",
            isFollowing: false,
          },
        },
      };
    }

    case "update-profile": {
      const me = state.users[state.currentUserId];
      if (!me) return state;
      return {
        ...state,
        users: {
          ...state.users,
          [state.currentUserId]: {
            ...me,
            ...(action.input.displayName !== undefined ? { name: action.input.displayName } : {}),
            ...(action.input.username !== undefined ? { username: action.input.username } : {}),
            ...(action.input.bio !== undefined ? { bio: action.input.bio ?? "" } : {}),
            ...(action.input.fitnessGoal !== undefined
              ? { goal: action.input.fitnessGoal ?? "" }
              : {}),
            ...(action.input.isPrivate !== undefined ? { isPrivate: action.input.isPrivate } : {}),
            ...(action.input.avatarUrl !== undefined ? { avatarUrl: action.input.avatarUrl } : {}),
            ...(action.input.instagramUsername !== undefined
              ? { instagramUsername: action.input.instagramUsername }
              : {}),
            ...(action.input.birthDate !== undefined ? { birthDate: action.input.birthDate } : {}),
            ...(action.input.sports !== undefined ? { sports: action.input.sports } : {}),
            ...(action.input.preferredTimes !== undefined
              ? { preferredTimes: action.input.preferredTimes }
              : {}),
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

    case "like-story": {
      return {
        ...state,
        stories: state.stories.map((story) => {
          if (story.id !== action.storyId || story.likedByCurrentUser) return story;
          return {
            ...story,
            likedByCurrentUser: true,
            likesCount: story.likesCount + 1,
          };
        }),
      };
    }

    case "delete-story": {
      const target = state.stories.find((story) => story.id === action.storyId);
      if (!target || target.userId !== state.currentUserId) return state;
      return {
        ...state,
        stories: state.stories.filter((story) => story.id !== action.storyId),
      };
    }

    case "mute-story-author": {
      if (action.authorId === state.currentUserId) return state;
      return {
        ...state,
        stories: state.stories.filter((story) => story.userId !== action.authorId),
      };
    }

    case "publish-workout": {
      const currentUser = state.users[state.currentUserId];
      const todayKey = formatDateKey(new Date());
      const destinations = action.input.destinations ?? { feed: true, story: true };
      const wantsFeed = destinations.feed;
      const wantsStory = destinations.story;

      // Sem destino selecionado, sem mudança (a UI não deveria deixar chegar aqui).
      if (!wantsFeed && !wantsStory) return state;

      const isNewWorkoutDay = !currentUser.workoutDays.includes(todayKey);
      const workoutDays = Array.from(new Set([...currentUser.workoutDays, todayKey]));
      const stats = calculateWorkoutStats(workoutDays, todayKey);
      const createdAt = new Date().toISOString();
      const postId = `post-${Date.now()}`;

      const newPost: GymPost | null = wantsFeed
        ? {
            id: postId,
            userId: currentUser.id,
            imageUrl: action.input.imageUrl,
            mediaType: action.input.mediaType,
            caption: action.input.caption.trim() || "Treino publicado.",
            workoutType: action.input.workoutType ?? null,
            gymName: action.input.locationName ?? action.input.gymName ?? "",
            gymId: action.input.gymId ?? "",
            locationSource: action.input.locationSource ?? "none",
            locationName: action.input.locationName ?? null,
            locationLatitude: action.input.locationLatitude ?? null,
            locationLongitude: action.input.locationLongitude ?? null,
            locationGoogleMapsUrl: action.input.locationGoogleMapsUrl ?? null,
            createdAt,
            workoutDate: todayKey,
            isWorkoutPost: true,
            streakAtPost: stats.currentStreak,
            likesCount: 0,
            likedByCurrentUser: false,
            comments: [],
          }
        : null;

      const newStory: GymStory | null = wantsStory
        ? {
            id: `story-${postId}`,
            userId: currentUser.id,
            imageUrl: action.input.imageUrl,
            mediaType: action.input.mediaType,
            title: action.input.workoutType ?? "Treino",
            caption: `${formatStreakDays(stats.currentStreak)} de streak`,
            createdAt,
            viewed: false,
            likedByCurrentUser: false,
            likesCount: 0,
            kind: "workout",
          }
        : null;

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
        posts: newPost ? [newPost, ...state.posts] : state.posts,
        // Se posta story, substitui o anterior do usuário; se não, mantém intactos.
        stories: newStory
          ? [newStory, ...state.stories.filter((item) => item.userId !== currentUser.id)]
          : state.stories,
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
        mediaType: "image",
        title: "Check-in",
        caption: `${currentUser.currentStreak}d · ${action.gymName}`,
        createdAt,
        viewed: false,
        likedByCurrentUser: false,
        likesCount: 0,
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

    case "edit-post": {
      // Mock só edita posts do dono atual; UI só expõe o menu para posts próprios.
      const target = state.posts.find((p) => p.id === action.postId);
      if (!target || target.userId !== state.currentUserId) return state;
      const requestedIds = Array.from(
        new Set(
          (action.input.taggedUserIds ?? []).filter(
            (id) => id && id !== state.currentUserId,
          ),
        ),
      );

      return {
        ...state,
        posts: state.posts.map((post) => {
          if (post.id !== action.postId) return post;
          const existingParticipants = post.participants ?? [];
          const activeIds = new Set(
            existingParticipants
              .filter((participant) => participant.status !== "rejected")
              .map((participant) => participant.taggedUserId),
          );
          const keptParticipants = existingParticipants.filter(
            (participant) =>
              !(
                participant.status === "rejected" &&
                requestedIds.includes(participant.taggedUserId)
              ),
          );
          const createdAt = new Date().toISOString();
          const newParticipants = requestedIds
            .filter((taggedUserId) => !activeIds.has(taggedUserId))
            .map((taggedUserId) => ({
              id: `mock-post-participant-${post.id}-${taggedUserId}`,
              targetId: post.id,
              taggedUserId,
              taggedByUserId: state.currentUserId,
              status: "pending" as const,
              acceptedAt: null,
              rejectedAt: null,
              createdAt,
            }));
          return {
            ...post,
            caption:
              action.input.caption !== undefined
                ? (action.input.caption?.trim() || "")
                : post.caption,
            workoutType:
              action.input.workoutType !== undefined
                ? action.input.workoutType
                : post.workoutType,
            participants: [...keptParticipants, ...newParticipants],
          };
        }),
      };
    }

    case "delete-post": {
      const target = state.posts.find((p) => p.id === action.postId);
      if (!target || target.userId !== state.currentUserId) return state;
      return {
        ...state,
        posts: state.posts.filter((p) => p.id !== action.postId),
      };
    }

    case "send-chat-message": {
      if (!action.input.receiverId) return state;
      const body = action.input.body?.trim() || null;
      const mediaUrl = action.input.mediaUrl?.trim() || null;
      if (!body && !mediaUrl) return state;
      const message: ChatMessage = {
        id: `msg-${Date.now()}`,
        conversationId: [state.currentUserId, action.input.receiverId].sort().join(":"),
        senderId: state.currentUserId,
        receiverId: action.input.receiverId,
        body,
        mediaUrl,
        mediaType: mediaUrl ? (action.input.mediaType ?? "image") : null,
        storyId: action.input.storyId ?? null,
        replyToStory: Boolean(action.input.replyToStory),
        storyPreviewUrl: action.input.storyPreviewUrl ?? null,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      return {
        ...state,
        chatMessages: [...state.chatMessages, message],
      };
    }

    case "mark-chat-thread-read": {
      return {
        ...state,
        chatMessages: state.chatMessages.map((message) =>
          message.senderId === action.userId &&
          message.receiverId === state.currentUserId &&
          !message.readAt
            ? { ...message, readAt: new Date().toISOString() }
            : message,
        ),
      };
    }

    case "delete-chat-conversation": {
      return {
        ...state,
        chatMessages: state.chatMessages.filter(
          (message) =>
            !(
              (message.senderId === state.currentUserId &&
                message.receiverId === action.userId) ||
              (message.senderId === action.userId &&
                message.receiverId === state.currentUserId)
            ),
        ),
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

  const profilePosts = useMemo<EnrichedPost[]>(() => {
    return state.posts
      .map((post) => {
        const author = withStreakPresence(state.users[post.userId], state);
        const smartScore = getSmartScore(post, author, currentUser);

        const latestCommentPreviews = post.comments.slice(-2);
        const ownOlderPreview = [...post.comments]
          .reverse()
          .find(
            (comment) =>
              comment.userId === state.currentUserId &&
              !latestCommentPreviews.some((preview) => preview.id === comment.id),
          );

        return {
          ...post,
          author,
          commentPreviews: (ownOlderPreview
            ? [ownOlderPreview, ...latestCommentPreviews]
            : latestCommentPreviews
          ).map((comment) => ({
            ...comment,
            author: withStreakPresence(state.users[comment.userId], state),
          })),
          likedByPreview: getLikedByPreview(post, state.users, currentUser, state),
          smartScore,
          smartReason: getSmartReason(post, author, currentUser),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentUser, state]);

  const feedPosts = useMemo<EnrichedPost[]>(
    () =>
      profilePosts.filter((post) => {
        if (post.userId === state.currentUserId) return true;
        return state.users[post.userId]?.followStatus === "accepted";
      }),
    [profilePosts, state.currentUserId, state.users],
  );

  const storyBubbles = useMemo<EnrichedStory[]>(() => {
    return sortStoriesNewestFirst(
      state.stories
        .filter((story) => {
          if (story.userId === state.currentUserId) return true;
          return state.users[story.userId]?.followStatus === "accepted";
        })
        .map((story) => ({
          ...story,
          author: withStreakPresence(state.users[story.userId], state),
        })),
    );
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

  const gyms = useMemo<GymLocationOption[]>(() => {
    const names = new Set<string>();
    for (const user of Object.values(state.users)) {
      for (const gym of user.gyms) names.add(gym);
    }
    return Array.from(names)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((name) => ({
        id: slugGymId(name),
        name,
        city: "Recife",
        state: "PE",
        address: null,
        latitude: null,
        longitude: null,
      }));
  }, [state.users]);

  const socialStats = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    return {
      trainedToday: new Set([
        ...state.posts
          .filter((post) => post.workoutDate === todayKey)
          .map((post) => post.userId),
        ...state.stories
          .filter((story) => formatDateKey(new Date(story.createdAt)) === todayKey)
          .map((story) => story.userId),
      ]).size,
      checkInsToday: state.checkInsToday.length,
      monthDays: buildMonthWorkoutDays(currentUser.workoutDays),
    };
  }, [currentUser.workoutDays, state.checkInsToday.length, state.posts, state.stories]);

  const actions = useMemo(
    () => ({
      likePost(postId: string) {
        dispatch({ type: "like-post", postId });
        showFeedback("like", "Curtida enviada");
      },
      commentPost(postId: string, body: string) {
        dispatch({ type: "comment-post", postId, body });
        showFeedback("comment", "Comentário publicado");
      },
      deleteComment(postId: string, commentId: string) {
        dispatch({ type: "delete-comment", postId, commentId });
        showFeedback("success", "Comentário apagado");
      },
      likeComment(postId: string, commentId: string) {
        dispatch({ type: "like-comment", postId, commentId });
        showFeedback("like", "Comentário curtido");
      },
      toggleFollow(userId: string) {
        const user = state.users[userId];
        const wasAccepted = user?.followStatus === "accepted";
        const wasPending = user?.followStatus === "pending";
        const nextStatus =
          wasAccepted || wasPending
            ? "none"
            : user?.isPrivate
              ? "pending"
              : "accepted";
        dispatch({ type: "toggle-follow", userId });
        let title: string;
        if (wasAccepted) title = "Você deixou de seguir";
        else if (wasPending) title = "Solicitação cancelada";
        else if (user?.isPrivate) title = "Solicitação enviada";
        else title = "Agora no seu circle";
        showFeedback("follow", title, user?.name);
        return { followStatus: nextStatus as "none" | "pending" | "accepted" };
      },
      openStory(storyId: string) {
        dispatch({ type: "view-story", storyId });
        setSelectedStoryId(storyId);
        simulateHaptic("brand");
      },
      closeStory() {
        setSelectedStoryId(null);
      },
      async replyToStory(storyId: string, body: string) {
        const story = state.stories.find((item) => item.id === storyId);
        const reply = body.trim();
        if (!story || !reply || story.userId === state.currentUserId) return;
        dispatch({
          type: "send-chat-message",
          input: {
            receiverId: story.userId,
            body: reply,
            storyId: story.id,
            replyToStory: true,
            storyPreviewUrl: story.imageUrl,
          },
        });
        showFeedback("comment", "Resposta enviada", state.users[story.userId]?.name);
      },
      async likeStory(storyId: string) {
        const story = state.stories.find((item) => item.id === storyId);
        dispatch({ type: "like-story", storyId });
        showFeedback(
          "like",
          story?.likedByCurrentUser ? "Story já curtido" : "Story curtido",
          story ? state.users[story.userId]?.name : undefined,
        );
      },
      async deleteStory(storyId: string) {
        dispatch({ type: "delete-story", storyId });
        setSelectedStoryId(null);
        showFeedback("success", "Story apagado");
      },
      async reportStory(storyId: string, authorId: string) {
        const author = state.users[authorId];
        showFeedback("brand", "Story denunciado", author?.name);
      },
      async muteStoryAuthor(authorId: string) {
        dispatch({ type: "mute-story-author", authorId });
        setSelectedStoryId(null);
        showFeedback("brand", "Stories silenciados", state.users[authorId]?.name);
      },
      async shareStoryToChat(storyId: string, receiverId: string) {
        const story = state.stories.find((item) => item.id === storyId);
        if (!story) return;
        dispatch({
          type: "send-chat-message",
          input: {
            receiverId,
            body: `Compartilhou um story de @${state.users[story.userId]?.username ?? "gymcircle"}`,
            storyId,
            replyToStory: false,
            storyPreviewUrl: story.imageUrl,
          },
        });
        showFeedback("comment", "Story enviado");
      },
      async sharePostToChat(postId: string, receiverId: string) {
        const post = state.posts.find((item) => item.id === postId);
        if (!post) return;
        dispatch({
          type: "send-chat-message",
          input: {
            receiverId,
            body:
              post.userId === state.currentUserId
                ? "Compartilhei meu treino no Gym Circle."
                : `Compartilhei o treino de @${state.users[post.userId]?.username ?? "gymcircle"} no Gym Circle.`,
            mediaUrl: post.imageUrl,
            mediaType: post.mediaType,
          },
        });
        showFeedback("comment", "Publicação enviada");
      },
      publishWorkout(input: CreateWorkoutPostInput) {
        dispatch({ type: "publish-workout", input });
        showFeedback("success", "Treino publicado", "Streak atualizado");
      },
      checkIn(gymName: string) {
        dispatch({ type: "check-in", gymName });
        showFeedback("brand", "Check-in ativo", gymName);
      },
      async editPost(postId: string, input: EditPostInput) {
        dispatch({ type: "edit-post", postId, input });
        showFeedback("success", "Post atualizado");
      },
      async deletePost(postId: string) {
        dispatch({ type: "delete-post", postId });
        showFeedback("success", "Post apagado");
      },
      async sendChatMessage(input: SendChatMessageInput) {
        dispatch({ type: "send-chat-message", input });
        showFeedback("comment", input.mediaUrl ? "Mídia enviada" : "Mensagem enviada");
      },
      async markChatThreadRead(userId: string) {
        dispatch({ type: "mark-chat-thread-read", userId });
      },
      async deleteChatConversation(userId: string) {
        dispatch({ type: "delete-chat-conversation", userId });
        showFeedback("success", "Conversa apagada", state.users[userId]?.name);
      },
      async acceptFollowRequest(requesterId: string) {
        const requester = state.users[requesterId];
        dispatch({ type: "accept-follow-request", requesterId });
        showFeedback("follow", "Solicitação aceita", requester?.name);
      },
      async rejectFollowRequest(requesterId: string) {
        dispatch({ type: "reject-follow-request", requesterId });
        showFeedback("brand", "Solicitação recusada");
      },
      async updateProfile(input: ProfileEditInput) {
        dispatch({ type: "update-profile", input });
        showFeedback("success", "Perfil atualizado");
      },
      async refresh() {
        showFeedback("brand", "Atualizado");
      },
    }),
    [showFeedback, state.currentUserId, state.posts, state.stories, state.users],
  );

  return {
    currentUser,
    users: state.users,
    gyms,
    feedPosts,
    profilePosts,
    storyBubbles,
    selectedStory,
    suggestedUsers,
    nearbyUsers,
    chatMessages: state.chatMessages,
    socialStats,
    feedback,
    formatPostClock,
    actions,
    unreadMessages: state.chatMessages.filter((m) => m.receiverId === state.currentUserId && !m.readAt).length,
    refresh: actions.refresh,
  };
}
