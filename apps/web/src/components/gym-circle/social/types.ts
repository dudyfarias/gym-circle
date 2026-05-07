export type GymUser = {
  id: string;
  name: string;
  username: string;
  accent: string;
  bio: string;
  goal: string;
  location: string;
  gyms: string[];
  preferredTimes: string[];
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string;
  workoutsThisMonth: number;
  activeDaysCount: number;
  checkInsCount: number;
  achievements: string[];
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  workoutDays: string[];
};

export type StreakPresenceSource = "feed-photo" | "fitness-story" | "none";

export type StreakPresence = {
  streakLitToday: boolean;
  streakPresenceSource: StreakPresenceSource;
};

export type EnrichedUser = GymUser & StreakPresence;

export type GymComment = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
};

export type GymPost = {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string;
  workoutType: string;
  gymName: string;
  gymId: string;
  createdAt: string;
  workoutDate: string;
  isWorkoutPost: true;
  streakAtPost: number;
  likesCount: number;
  likedByCurrentUser: boolean;
  comments: GymComment[];
};

export type GymStory = {
  id: string;
  userId: string;
  imageUrl: string;
  title: string;
  caption: string;
  createdAt: string;
  viewed: boolean;
  kind: "workout" | "checkin" | "milestone";
};

export type SocialState = {
  currentUserId: string;
  users: Record<string, GymUser>;
  posts: GymPost[];
  stories: GymStory[];
  checkInsToday: string[];
};

export type EnrichedComment = GymComment & {
  author: EnrichedUser;
};

export type EnrichedPost = GymPost & {
  author: EnrichedUser;
  commentPreviews: EnrichedComment[];
  likedByPreview: EnrichedUser[];
  smartScore: number;
  smartReason: string;
};

export type EnrichedStory = GymStory & {
  author: EnrichedUser;
};

export type CreateWorkoutPostInput = {
  caption: string;
  workoutType: string;
  gymName: string;
  gymId: string;
  imageUrl: string;
};

export type FeedbackTone = "brand" | "success" | "like" | "comment" | "follow";

export type FeedbackMessage = {
  id: number;
  tone: FeedbackTone;
  title: string;
  detail?: string;
};
