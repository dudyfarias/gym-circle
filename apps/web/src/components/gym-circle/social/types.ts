export type FollowStatus = "none" | "pending" | "accepted";

export type GymUser = {
  id: string;
  name: string;
  username: string;
  accent: string;
  avatarUrl: string | null;
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
  /** @deprecated derive from `followStatus === "accepted"` */
  isFollowing: boolean;
  followStatus: FollowStatus;
  isPrivate: boolean;
  workoutDays: string[];
};

export type StreakPresenceSource = "feed-photo" | "fitness-story" | "none";

export type StreakPresence = {
  streakLitToday: boolean;
  streakPresenceSource: StreakPresenceSource;
};

export type EnrichedUser = GymUser & StreakPresence;

export type PostMediaType = "image" | "video";

export type PostLocationSource = "none" | "gym" | "current" | "custom";

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
  mediaType: PostMediaType;
  caption: string;
  workoutType: string | null;
  gymName: string;
  gymId: string;
  locationSource: PostLocationSource;
  locationName: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationGoogleMapsUrl: string | null;
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
  mediaType: PostMediaType;
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

export type PostDestinations = {
  feed: boolean;
  story: boolean;
};

export type CreateWorkoutPostInput = {
  caption: string;
  workoutType?: string | null;
  gymName?: string;
  gymId?: string | null;
  imageUrl: string;
  mediaType: PostMediaType;
  locationSource?: PostLocationSource;
  locationName?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationGoogleMapsUrl?: string | null;
  /**
   * Onde a postagem deve aparecer.
   * - feed=true: cria post no feed
   * - story=true: cria/substitui story do usuário
   * Pelo menos um precisa ser true. Default no UI: ambos.
   */
  destinations?: PostDestinations;
};

export type FeedbackTone = "brand" | "success" | "like" | "comment" | "follow";

export type FeedbackMessage = {
  id: number;
  tone: FeedbackTone;
  title: string;
  detail?: string;
};

export type ProfileEditInput = {
  displayName?: string;
  username?: string;
  bio?: string | null;
  fitnessGoal?: string | null;
  avatarUrl?: string | null;
  isPrivate?: boolean;
};

export type EditPostInput = {
  caption?: string | null;
  workoutType?: string | null;
};

export type SocialActions = {
  likePost: (postId: string) => void | Promise<void>;
  commentPost: (postId: string, body: string) => void | Promise<void>;
  toggleFollow: (userId: string) => void | Promise<void>;
  openStory: (storyId: string) => void;
  closeStory: () => void;
  publishWorkout: (input: CreateWorkoutPostInput) => void | Promise<void>;
  checkIn: (gymName: string) => void | Promise<void>;
  signOut?: () => Promise<void>;
  updateProfile?: (input: ProfileEditInput) => Promise<void>;
  editPost?: (postId: string, input: EditPostInput) => Promise<void>;
  deletePost?: (postId: string) => Promise<void>;
  acceptFollowRequest?: (requesterId: string) => Promise<void>;
  rejectFollowRequest?: (requesterId: string) => Promise<void>;
};

export type SocialBundle = {
  currentUser: EnrichedUser;
  users?: Record<string, GymUser>;
  feedPosts: EnrichedPost[];
  storyBubbles: EnrichedStory[];
  selectedStory: EnrichedStory | null;
  suggestedUsers: EnrichedUser[];
  nearbyUsers: EnrichedUser[];
  socialStats: {
    trainedToday: number;
    checkInsToday: number;
    monthDays: Array<{ day: number; dateKey: string; trained: boolean }>;
  };
  feedback: FeedbackMessage | null;
  formatPostClock: (createdAt: string) => string;
  actions: SocialActions;
  unreadNotifications?: number;
};
