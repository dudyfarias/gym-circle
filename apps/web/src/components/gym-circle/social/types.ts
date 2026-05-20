export type FollowStatus = "none" | "pending" | "accepted";
export type FollowActionResult = { followStatus: FollowStatus };

export type GymUser = {
  id: string;
  createdAt?: string;
  name: string;
  username: string;
  accent: string;
  avatarUrl: string | null;
  bio: string;
  goal: string;
  instagramUsername?: string | null;
  birthDate?: string | null;
  age?: number | null;
  isBirthday?: boolean;
  sports?: string[];
  onboardingCompletedAt?: string | null;
  alphaTermsAcceptedAt?: string | null;
  privacyPolicyAcceptedAt?: string | null;
  accountStatus?: string;
  suspendedAt?: string | null;
  reactivationSentAt?: string | null;
  reactivationExpiresAt?: string | null;
  location: string;
  gyms: string[];
  preferredTimes: string[];
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string;
  workoutsThisMonth: number;
  activeDaysCount: number;
  streakRestoresAvailable: number;
  lastStreakRestoreUsedAt?: string | null;
  lastStreakRestoreEarnedAt?: string | null;
  streakRestoreDeadlineAt?: string | null;
  streakRestoreMissedDate?: string | null;
  streakRestoreStatus?: string | null;
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

export type GymLocationOption = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type GymComment = {
  id: string;
  postId: string;
  userId: string;
  body: string;
  createdAt: string;
  likesCount?: number;
  likedByCurrentUser?: boolean;
};

export type ParticipantStatus = "pending" | "accepted" | "rejected";

export type GymParticipant = {
  id: string;
  targetId: string;
  taggedUserId: string;
  taggedByUserId: string;
  status: ParticipantStatus;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
};

export type GymPost = {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
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
  commentsCount?: number;
  comments: GymComment[];
  participants?: GymParticipant[];
};

export type GymStory = {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
  mediaType: PostMediaType;
  title: string;
  caption: string;
  createdAt: string;
  viewed: boolean;
  likedByCurrentUser: boolean;
  likesCount: number;
  kind: "workout" | "checkin" | "milestone";
  participants?: GymParticipant[];
};

export type SocialState = {
  currentUserId: string;
  users: Record<string, GymUser>;
  posts: GymPost[];
  stories: GymStory[];
  chatMessages: ChatMessage[];
  checkInsToday: string[];
};

export type EnrichedComment = GymComment & {
  author: EnrichedUser;
};

export type EnrichedPost = GymPost & {
  author: EnrichedUser;
  commentPreviews: EnrichedComment[];
  likedByPreview: EnrichedUser[];
  likedByUsers?: EnrichedUser[];
  acceptedParticipants?: EnrichedUser[];
  pendingParticipants?: EnrichedUser[];
  smartScore: number;
  smartReason: string;
  distanceKm?: number | null;
  distanceLabel?: string | null;
};

export type EnrichedStory = GymStory & {
  author: EnrichedUser;
  acceptedParticipants?: EnrichedUser[];
  pendingParticipants?: EnrichedUser[];
};

export type StoryGroup = {
  id: string;
  author: EnrichedUser;
  stories: EnrichedStory[];
  viewed: boolean;
  latestCreatedAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId?: string | null;
  senderId: string;
  receiverId: string | null;
  body: string | null;
  mediaUrl: string | null;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
  mediaType: "image" | "video" | null;
  storyId?: string | null;
  replyToStory?: boolean;
  storyPreviewUrl?: string | null;
  createdAt: string;
  readAt: string | null;
};

export type ChatConversation = {
  id: string;
  type: "direct" | "group";
  name: string | null;
  imageUrl: string | null;
  memberIds: string[];
  role?: string | null;
  lastReadAt: string | null;
  deletedAt?: string | null;
  lastMessageAt: string | null;
  unreadCount?: number;
};

export type SendChatMessageInput = {
  receiverId?: string;
  conversationId?: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  storyId?: string | null;
  replyToStory?: boolean;
  storyPreviewUrl?: string | null;
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
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
  blurDataUrl?: string | null;
  mediaType: PostMediaType;
  locationSource?: PostLocationSource;
  locationName?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationGoogleMapsUrl?: string | null;
  taggedUserIds?: string[];
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
  instagramUsername?: string | null;
  birthDate?: string | null;
  sports?: string[];
  mainGymId?: string | null;
  preferredTimes?: string[];
};

export type EditPostInput = {
  caption?: string | null;
  workoutType?: string | null;
  taggedUserIds?: string[];
};

export type SocialActions = {
  likePost: (postId: string) => void | Promise<void>;
  commentPost: (postId: string, body: string) => void | Promise<void>;
  deleteComment?: (postId: string, commentId: string) => void | Promise<void>;
  likeComment?: (postId: string, commentId: string) => void | Promise<void>;
  sharePostToChat?: (postId: string, receiverId: string) => Promise<void>;
  toggleFollow: (userId: string) => void | FollowActionResult | Promise<void | FollowActionResult>;
  openStory: (storyId: string) => void;
  closeStory: () => void;
  publishWorkout: (input: CreateWorkoutPostInput) => void | Promise<void>;
  checkIn: (gymName: string) => void | Promise<void>;
  signOut?: () => Promise<void>;
  updateProfile?: (input: ProfileEditInput) => Promise<void>;
  editPost?: (postId: string, input: EditPostInput) => Promise<void>;
  deletePost?: (postId: string) => Promise<void>;
  sendChatMessage?: (input: SendChatMessageInput) => Promise<void>;
  refreshChat?: () => Promise<void>;
  refreshPostDetails?: (postId: string) => Promise<void>;
  refreshProfilePosts?: (userId: string) => Promise<void>;
  markChatThreadRead?: (userId: string) => Promise<void>;
  markChatConversationRead?: (conversationId: string) => Promise<void>;
  deleteChatConversation?: (userId: string) => Promise<void>;
  deleteChatConversationById?: (conversationId: string) => Promise<void>;
  createGroupConversation?: (input: {
    name: string;
    memberIds: string[];
    imageUrl?: string | null;
  }) => Promise<string>;
  acceptFollowRequest?: (requesterId: string) => Promise<void>;
  rejectFollowRequest?: (requesterId: string) => Promise<void>;
  blockUser?: (userId: string) => Promise<void>;
  reportUser?: (userId: string, reason?: string) => Promise<void>;
  reportPost?: (postId: string, authorId: string, reason?: string) => Promise<void>;
  replyToStory?: (storyId: string, body: string) => Promise<void>;
  likeStory?: (storyId: string) => Promise<void>;
  deleteStory?: (storyId: string) => Promise<void>;
  reportStory?: (storyId: string, authorId: string, reason?: string) => Promise<void>;
  muteStoryAuthor?: (authorId: string) => Promise<void>;
  /** Silencia posts desse autor no feed. Stories e perfil continuam acessíveis. */
  mutePostAuthor?: (authorId: string) => Promise<void>;
  shareStoryToChat?: (storyId: string, receiverId: string) => Promise<void>;
  acceptPostTag?: (postId: string) => Promise<void>;
  rejectPostTag?: (postId: string) => Promise<void>;
  acceptStoryTag?: (storyId: string) => Promise<void>;
  rejectStoryTag?: (storyId: string) => Promise<void>;
  useStreakRestore?: () => Promise<void>;
  /**
   * Cataloga um lugar (academia/parque/etc) vindo da busca via Maps no
   * banco — dedup por coords + nome. Vincula ao perfil do user. Retorna
   * o registro da academia pra uso imediato (selecionar no PostScreen,
   * mostrar no CheckInScreen, etc).
   */
  catalogPlace?: (place: {
    name: string;
    address?: string | null;
    neighborhood?: string | null;
    city: string;
    state?: string | null;
    latitude: number;
    longitude: number;
  }) => Promise<GymLocationOption>;
  requestAccountDeletion?: (reason?: string) => Promise<void>;
  suspendAccount?: () => Promise<void>;
  sendReactivationEmail?: () => Promise<void>;
  completeOnboarding?: () => Promise<void>;
  searchProfiles?: (query: string) => Promise<EnrichedUser[]>;
  loadMoreFeed?: () => Promise<void>;
};

export type SocialBundle = {
  currentUser: EnrichedUser;
  users?: Record<string, GymUser>;
  gyms?: GymLocationOption[];
  feedPosts: EnrichedPost[];
  profilePosts?: EnrichedPost[];
  storyBubbles: EnrichedStory[];
  storyGroups?: StoryGroup[];
  selectedStoryGroup?: StoryGroup | null;
  selectedStory: EnrichedStory | null;
  suggestedUsers: EnrichedUser[];
  nearbyUsers: EnrichedUser[];
  chatMessages?: ChatMessage[];
  chatConversations?: ChatConversation[];
  socialStats: {
    trainedToday: number;
    checkInsToday: number;
    monthDays: Array<{ day: number; dateKey: string; trained: boolean }>;
  };
  feedback: FeedbackMessage | null;
  formatPostClock: (createdAt: string) => string;
  actions: SocialActions;
  unreadNotifications?: number;
  unreadMessages?: number;
  homeLoading?: boolean;
  secondaryLoading?: boolean;
  chatLoading?: boolean;
  feedLoadingMore?: boolean;
  feedHasMore?: boolean;
  refresh?: () => void | Promise<void>;
};
