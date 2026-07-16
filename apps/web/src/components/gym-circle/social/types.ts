import type { MergeableActivity } from "@gym-circle/core";
import type {
  CircleRankingRow,
  RankingPeriod,
  RankingScope,
} from "./supabaseSocialTypes";
import type { CatalogPlaceInput } from "./placeProvider";

export type { MergeableActivity };

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
  profileCompletionNoticeDismissed?: boolean;
  alphaTermsAcceptedAt?: string | null;
  privacyPolicyAcceptedAt?: string | null;
  accountStatus?: string;
  suspendedAt?: string | null;
  reactivationSentAt?: string | null;
  reactivationExpiresAt?: string | null;
  mainGymId?: string | null;
  location: string;
  gyms: string[];
  preferredTimes: string[];
  currentStreak: number;
  longestStreak: number;
  lastWorkoutDate: string;
  /** Sprint 3.5: contagem de dias treinados na semana corrente (segunda→domingo). */
  workoutsThisWeek: number;
  /** Sprint 3.5: contagem de dias treinados no mês corrente. */
  workoutsThisMonth: number;
  /**
   * Sprint 3.5: contagem de dias treinados no ano corrente.
   * No Supabase vem de `user_stats.active_days_this_year`. Mantemos o nome
   * original `activeDaysCount` por compat — tratado como year-scoped no
   * `buildConsistencyRings` via `workoutsThisYear` derivado.
   */
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
  /**
   * Sprint 5.5a — Capa do recap mensal escolhida pelo user.
   * Shape: { "YYYY-MM": "post_uuid", ... }. Quando key ausente, builder
   * cai pro auto-pick. Map vazio (default DB) e undefined são equivalentes.
   */
  monthlyRecapCovers?: Record<string, string>;
  /**
   * Sprint 7C.1 — Hints contextuais dispensados pelo user.
   * Shape: { "hintId": "ISO8601 timestamp", ... }. Persistido no DB
   * (cross-device) + localStorage (instant local). Map vazio e undefined
   * são equivalentes.
   */
  contextualHintsSeen?: Record<string, string>;
  /**
   * Sprint 7.5.1 — Achievements equipados no perfil (Section 13 do brief).
   * Array de até 3 composite IDs ("kind:id" — ex: "trophy:perfect-month").
   * Frontend valida que cada ID está em user_achievements do user.
   */
  featuredAchievements?: string[];
};

export type StreakPresenceSource = "feed-photo" | "fitness-story" | "none";

export type StreakPresence = {
  streakLitToday: boolean;
  streakPresenceSource: StreakPresenceSource;
};

export type EnrichedUser = GymUser & StreakPresence;

export type PostMediaType = "image" | "video";

/**
 * Sprint 13 — um item de mídia do carrossel (foto ou vídeo). O feed renderiza
 * `EnrichedPost.media[]` (sempre ≥1; cai na capa quando o post é single).
 */
export type PostMediaItem = {
  mediaType: PostMediaType;
  imageUrl: string;
  thumbnailUrl?: string | null;
  posterUrl?: string | null;
  blurDataUrl?: string | null;
  mediaWidth?: number | null;
  mediaHeight?: number | null;
  mediaDurationSeconds?: number | null;
};

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
  /** Sprint 12.1 — threading 1 nível (estilo Instagram). null = comentário de topo. */
  parentCommentId?: string | null;
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
  // Sprint 13 — até 5 tags (workoutType = primeira, retrocompat).
  workoutTypes?: string[] | null;
  // Sprint 13 — carrossel: lista ordenada de mídias (≥1; 1 = post single).
  media?: PostMediaItem[];
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
  // P0.1 — post promovido de treino: métricas da activity de origem, pro
  // overlay de detalhes abrir do header (get_home_feed via source_activity_id).
  workout?: WorkoutDetail | null;
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
  /**
   * Sprint 12.1 — lista COMPLETA de comentários já enriquecidos (com author),
   * usada pelo CommentsBottomSheet pra render threaded (top-level + replies).
   * Diferente de `commentPreviews` (capado em ~3 pro preview inline do feed).
   * Populada pelo hook real (useSupabaseSocial); o mock cai de volta em
   * commentPreviews.
   */
  commentThread?: EnrichedComment[];
  likedByPreview: EnrichedUser[];
  likedByUsers?: EnrichedUser[];
  acceptedParticipants?: EnrichedUser[];
  pendingParticipants?: EnrichedUser[];
  smartScore: number;
  smartReason: string;
  distanceKm?: number | null;
  distanceLabel?: string | null;
};

export type EnrichedCheckin = {
  id: string;
  userId: string;
  gymId: string;
  gymName: string;
  gymAddress: string | null;
  gymCity: string | null;
  gymState: string | null;
  gymLatitude: number | null;
  gymLongitude: number | null;
  checkinDate: string;
  createdAt: string;
  author: EnrichedUser;
};

/**
 * Rastreio de treino — atividade como ENTRADA do feed (modelo check-in↔post↔
 * carrossel, tudo mutável): treino sem foto aparece como entrada com as mesmas
 * infos de post (legenda/local/tags); com foto vira post (source_activity_id).
 */
export type EnrichedActivity = {
  id: string;
  userId: string;
  activityType: string;
  startedAt: string | null;
  endedAt: string | null;
  elapsedS: number;
  avgHr: number | null;
  maxHr: number | null;
  activeCalories: number | null;
  totalCalories: number | null;
  distanceM: number | null;
  movingS: number | null;
  elevationGainM: number | null;
  /** Polyline [[lat, lng], ...] downsampled — só pro sketch do mini-mapa. */
  route: number[][] | null;
  origin: string | null;
  sourceApp: string | null;
  strengthSets: StrengthSet[] | null;
  workoutDate: string;
  createdAt: string;
  caption: string | null;
  workoutTypes: string[] | null;
  gymId: string | null;
  gymName: string | null;
  locationName: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationGoogleMapsUrl: string | null;
  author: EnrichedUser;
};

/**
 * Métricas de treino pro overlay de detalhes (estilo Apple Atividades).
 * Fonte comum: a ENTRADA de atividade (EnrichedActivity satisfaz este shape)
 * e o POST promovido de treino (get_home_feed via source_activity_id).
 */
/** Uma série de musculação: repetições e carga (kg). weightKg null = peso do corpo. */
export type StrengthSet = {
  reps: number;
  weightKg: number | null;
  setId?: string | null;
  setIndex?: number | null;
  setStatus?: "planned" | "completed" | "skipped" | "added" | null;
  setOrigin?: "planned" | "added" | null;
  loadType?: "external" | "bodyweight" | "assisted" | "not_provided" | null;
  assistedWeightKg?: number | null;
  bodyweightKgSnapshot?: number | null;
  plannedRepsMin?: number | null;
  plannedRepsMax?: number | null;
  plannedDurationSeconds?: number | null;
  plannedWeightKg?: number | null;
  /** Exercício da série (quando o treino veio de um treino salvo). */
  exercise?: string | null;
  exerciseId?: string | null;
  targetKind?: "reps" | "failure" | "duration" | null;
  durationSeconds?: number | null;
  techniqueId?: string | null;
  techniqueName?: string | null;
  techniqueNotes?: string | null;
  note?: string | null;
  rpe?: number | null;
  rir?: number | null;
  targetRestS?: number | null;
  actualRestS?: number | null;
};

/** Um exercício dentro de um treino salvo: nome + séries/reps alvo. */
export type WorkoutPlanExercise = {
  name: string;
  sets: number | null;
  reps: number | null;
  exerciseId?: string | null;
  muscleGroupSlug?: string | null;
  targetKind?: "reps" | "failure" | "duration";
  durationSeconds?: number | null;
  techniqueId?: string | null;
  techniqueName?: string | null;
  techniqueNotes?: string | null;
  /** Default visual; séries continuam serializadas individualmente. */
  loadType?: "external" | "bodyweight" | "assisted" | "not_provided";
};

/** Treino salvo pelo usuário (workout_plans). */
export type WorkoutPlan = {
  id: string;
  name: string;
  exercises: WorkoutPlanExercise[];
  updatedAt: string;
  planVersion?: number;
  isFavorite?: boolean;
  stats?: WorkoutPlanStats | null;
};

export type WorkoutPlanStats = {
  workoutPlanId: string;
  timesUsed: number;
  lastUsedAt: string | null;
  averageDurationS: number | null;
  averageVolumeKg: number | null;
  maxVolumeKg: number | null;
  averageCompletionRate: number | null;
};

export type WorkoutPlanExecution = {
  activityId: string;
  workoutPlanId: string;
  workoutDate: string;
  startedAt: string | null;
  elapsedS: number;
  volumeKg: number;
  completionRate: number | null;
};

export type WorkoutMuscleGroup = {
  slug: string;
  namePt: string;
  nameEn: string;
  iconKey: string;
  sortOrder: number;
};

export type WorkoutExerciseCatalogItem = {
  id: string;
  slug: string;
  namePt: string;
  nameEn: string;
  aliases: string[];
  aliasesPt: string[];
  aliasesEn: string[];
  primaryMuscleGroupSlug: string;
  secondaryMuscleGroupSlugs: string[];
  equipment: string[];
  /** Canonical equipment slug used by ranking and compact picker cards. */
  primaryEquipment: string | null;
  /** Canonical equipment slugs; legacy `equipment` remains for old clients. */
  compatibleEquipments: string[];
  requiredEquipment: string[];
  optionalEquipment: string[];
  descriptionPt: string;
  descriptionEn: string;
  instructionsPt: string[];
  instructionsEn: string[];
  commonMistakesPt: string[];
  commonMistakesEn: string[];
  videoUrl: string | null;
  videoSearchQuery: string | null;
  status: "approved" | "community";
  reviewStatus: "draft" | "needs_review" | "approved" | "deprecated";
  exerciseType:
    | "compound"
    | "isolation"
    | "conditioning"
    | "mobility"
    | "warmup"
    | null;
  defaultLoadType:
    | "external"
    | "bodyweight"
    | "assisted"
    | "not_provided"
    | null;
  difficulty: "beginner" | "intermediate" | "advanced" | null;
  exercisePriorityScore: number;
  defaultRestS: number | null;
  defaultRpe: number | null;
  defaultTargetKind: "reps" | "failure" | "duration" | "distance" | null;
  defaultReps: number | null;
  defaultDurationS: number | null;
  defaultDistanceM: number | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  /** Relação curada: null no exercício-base; aponta para a base nas variações. */
  parentExerciseId: string | null;
  /** Padrão biomecânico curado (ex.: horizontal_push, squat, hinge). */
  movementPattern: string | null;
  /** Variações reais ligadas pelo catálogo; nunca inferidas pelo nome. */
  variations: Array<{
    id: string;
    slug: string;
    namePt: string;
    nameEn: string;
    equipment: string[];
  }>;
};

export type WorkoutTechniqueCatalogItem = {
  id: string;
  slug: string;
  namePt: string;
  nameEn: string;
  aliases: string[];
  summaryPt: string;
  summaryEn: string;
  instructionsPt: string[];
  instructionsEn: string[];
  videoUrl: string | null;
  videoSearchQuery: string | null;
  status: "approved" | "community";
};

export type WorkoutDetail = {
  activityType: string;
  startedAt: string | null;
  endedAt: string | null;
  elapsedS: number;
  movingS: number | null;
  distanceM: number | null;
  elevationGainM: number | null;
  avgHr: number | null;
  maxHr?: number | null;
  activeCalories?: number | null;
  totalCalories: number | null;
  route: number[][] | null;
  origin?: string | null;
  sourceApp?: string | null;
  strengthSets: StrengthSet[] | null;
  gymName: string | null;
  locationName: string | null;
  caption: string | null;
  recordHighlights?: WorkoutRecordHighlight[] | null;
};

export type WorkoutRecordHighlight = {
  id: string;
  metricKey: string;
  exerciseId: string | null;
  exerciseName: string | null;
  value: number;
  unit: string;
  reps: number | null;
  isEstimated: boolean;
  achievedAt: string | null;
};

/** Infos de post salvas na ENTRADA de atividade (treino sem foto). */
export type ActivityEntryInput = {
  caption?: string | null;
  workoutTypes?: string[] | null;
  gymId?: string | null;
  locationSource?: PostLocationSource;
  locationName?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
  locationGoogleMapsUrl?: string | null;
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
  // Sprint 13 — até 5 tags; workoutType (singular) = primeira.
  workoutTypes?: string[] | null;
  // Sprint 13 — carrossel: lista ordenada COMPLETA (item 0 = capa = imageUrl
  // abaixo). >1 vira post_media. Ausente/1 = post single.
  media?: PostMediaItem[];
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
  /**
   * "Registrar treino" (post retroativo): YYYY-MM-DD de um dia já treinado mas
   * sem mídia. Quando presente, o post é gravado SÓ no feed com workout_date =
   * esse dia e created_at backdatado — não sobe no topo do feed; só preenche
   * calendário/perfil. Ausente = post normal de hoje.
   */
  workoutDate?: string;
  /** Atividade rastreada que este post compartilha (rastreio de treino). */
  sourceActivityId?: string | null;
};

/**
 * Rastreio de treino no web/Capacitor. Modalidades de rota podem enviar
 * distância/elevação calculadas com posições reais do dispositivo; dados de
 * Saúde (FC/calorias) continuam exclusivos das APIs nativas.
 */
export type WebActivityInput = {
  /** ID estável criado no começo da sessão para finalização idempotente. */
  clientSessionId?: string;
  activityType: "strength" | "run" | "walk" | "ride" | "other";
  /** Importações do Apple Saúde usam a mesma persistência, mas outra origem. */
  origin?: "web_timer" | "imported";
  externalId?: string | null;
  sourceApp?: string | null;
  startedAt: string;
  endedAt: string;
  elapsedS: number;
  movingS?: number | null;
  distanceM?: number | null;
  elevationGainM?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  activeCalories?: number | null;
  totalCalories?: number | null;
  /** Polyline reduzida no formato persistido em activities.route. */
  route?: number[][] | null;
  /** Séries de musculação (só treino de força). */
  strengthSets?: StrengthSet[] | null;
  workoutPlanId?: string | null;
  workoutPlanNameSnapshot?: string | null;
  workoutPlanExercisesSnapshot?: WorkoutPlanExercise[] | null;
  workoutPlanVersionSnapshot?: number | null;
  workoutPlanStartedFrom?:
    | "saved_plan"
    | "free"
    | "suggested"
    | "duplicate"
    | "imported"
    | null;
  workoutNote?: string | null;
  workoutExerciseContext?: Array<{
    exerciseId?: string | null;
    exercise?: string | null;
    note?: string | null;
    targetRestS?: number | null;
  }>;
};

export type FinishedWebActivity = {
  id: string;
  workoutDate: string;
  elapsedS: number;
};

/**
 * Contexto do treino recém-encerrado dentro do composer: encerrar → legenda/
 * local/tags → post no feed MESMO SEM FOTO (capa de stats gerada em canvas).
 */
export type ComposerActivityContext = {
  id: string;
  activityType: WebActivityInput["activityType"];
  elapsedS: number;
  movingS?: number | null;
  distanceM?: number | null;
  elevationGainM?: number | null;
  route?: number[][] | null;
  workoutDate: string;
  /** Resumo pós-treino pode abrir direto em mídia ou nos detalhes do post. */
  initialComposerStep?: "media" | "details";
  caption?: string | null;
  workoutTypes?: string[] | null;
  gymId?: string | null;
  locationName?: string | null;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
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
  workoutTypes?: string[] | null;
  gymId?: string | null;
  taggedUserIds?: string[];
  // Sprint 14 — lista COMPLETA de mídias desejada (add/remover, até 10). Quando
  // presente, substitui as mídias do post (capa = item 0).
  media?: PostMediaItem[];
};

export type PromoteCheckinInput = {
  caption?: string | null;
  workoutType?: string | null;
  workoutTypes?: string[] | null;
  gymId?: string;
  taggedUserIds?: string[];
  media: PostMediaItem[];
};

export type SocialActions = {
  likePost: (postId: string) => void | Promise<void>;
  // Sprint 12.1 — parentCommentId opcional: quando presente, é uma resposta
  // (threading 1 nível). O trigger no DB direciona a notificação.
  commentPost: (
    postId: string,
    body: string,
    parentCommentId?: string | null,
  ) => void | Promise<void>;
  deleteComment?: (postId: string, commentId: string) => void | Promise<void>;
  likeComment?: (postId: string, commentId: string) => void | Promise<void>;
  sharePostToChat?: (postId: string, receiverId: string) => Promise<void>;
  toggleFollow: (userId: string) => void | FollowActionResult | Promise<void | FollowActionResult>;
  openStory: (storyId: string) => void;
  closeStory: () => void;
  publishWorkout: (input: CreateWorkoutPostInput) => void | Promise<void>;
  /** Rastreio de treino (Fase 1): fecha o treino cronometrado do web. */
  finishWebActivity?: (input: WebActivityInput) => Promise<FinishedWebActivity>;
  updateWorkoutNotes?: (
    activityId: string,
    input: {
      workoutNote?: string | null;
      workoutExerciseContext?: WebActivityInput["workoutExerciseContext"];
    },
  ) => Promise<void>;
  /** Salva legenda/local/tags na ENTRADA de atividade (treino sem foto). */
  saveActivityEntry?: (
    activityId: string,
    input: ActivityEntryInput,
  ) => Promise<void>;
  /** "Integrar treino": treinos do dia do post disponíveis pra juntar. */
  fetchMergeableActivities?: (
    workoutDate: string,
  ) => Promise<MergeableActivity[]>;
  /** Vincula o treino ao post (source_activity_id); some do feed. */
  integrateWorkoutIntoPost?: (
    postId: string,
    activityId: string,
  ) => Promise<void>;
  checkIn: (gymName: string) => void | Promise<void>;
  createCheckin?: (gymId: string, workoutDate?: string) => Promise<void>;
  signOut?: () => Promise<void>;
  updateProfile?: (input: ProfileEditInput) => Promise<void>;
  dismissProfileCompletionNotice?: () => Promise<void>;
  /** Sprint 5.5a — salva foto de capa do recap mensal por monthKey. */
  setMonthlyRecapCover?: (monthKey: string, postId: string | null) => Promise<void>;
  /**
   * Sprint 7C.1 — marca hint contextual como visto (cross-device sync).
   * Best-effort: caller pode awaitar mas falha não bloqueia UX (localStorage
   * já absorveu o dismiss local). Idempotente — chamar 2x não duplica.
   */
  markContextualHintSeen?: (hintId: string) => Promise<void>;
  /**
   * Sprint 7.5.1 — persiste array de achievements equipados no perfil.
   * Frontend valida que cada ID é earned ANTES de chamar — backend só
   * salva o array como está.
   */
  setFeaturedAchievements?: (achievementIds: string[]) => Promise<void>;
  editPost?: (postId: string, input: EditPostInput) => Promise<void>;
  promoteCheckin?: (
    checkinId: string,
    input: PromoteCheckinInput,
  ) => Promise<void>;
  updateCheckin?: (checkinId: string, gymId: string) => Promise<void>;
  convertPostToCheckin?: (postId: string, gymId: string) => Promise<void>;
  deletePost?: (postId: string) => Promise<void>;
  deleteCheckin?: (checkinId: string) => Promise<void>;
  deleteActivity?: (activityId: string) => Promise<void>;
  sendChatMessage?: (input: SendChatMessageInput) => Promise<void>;
  refreshChat?: () => Promise<void>;
  refreshPostDetails?: (postId: string) => Promise<void>;
  markNotificationsRead?: () => Promise<void>;
  refreshProfilePosts?: (
    userId: string,
    options?: {
      cursorCreatedAt?: string | null;
      force?: boolean;
      limit?: number;
    },
  ) => Promise<void>;
  loadMoreProfilePosts?: (userId: string) => Promise<void>;
  /**
   * Fix calendário — busca posts do mês visível (YYYY-MM) do MyCircle
   * diretamente por workout_date, garantindo mini-fotos de meses antigos
   * pra users com 50+ posts. Idempotente por user+mês.
   */
  ensureProfilePostsForMonth?: (userId: string, monthKey: string) => Promise<void>;
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
  catalogPlace?: (place: CatalogPlaceInput) => Promise<GymLocationOption>;
  requestAccountDeletion?: (reason?: string) => Promise<void>;
  suspendAccount?: () => Promise<void>;
  sendReactivationEmail?: () => Promise<void>;
  completeOnboarding?: () => Promise<void>;
  searchProfiles?: (query: string) => Promise<EnrichedUser[]>;
  listFollowUsers?: (
    userId: string,
    kind: "followers" | "following",
  ) => Promise<EnrichedUser[]>;
  loadMoreFeed?: () => Promise<void>;
};

export type SocialBundle = {
  currentUser: EnrichedUser;
  users?: Record<string, GymUser>;
  gyms?: GymLocationOption[];
  feedPosts: EnrichedPost[];
  feedCheckins?: EnrichedCheckin[];
  feedActivities?: EnrichedActivity[];
  profilePosts?: EnrichedPost[];
  profilePostsPageInfo?: Record<
    string,
    { hasMore: boolean; loading: boolean; nextCursor: string | null }
  >;
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
  chatHydrated?: boolean;
  feedLoadingMore?: boolean;
  feedHasMore?: boolean;
  refresh?: () => void | Promise<void>;
  /** Sprint 19 — Competição: ranking sob demanda (escopo × período). */
  ranking?: {
    rows: CircleRankingRow[];
    scope: RankingScope;
    period: RankingPeriod;
    loading: boolean;
  };
  loadRanking?: (
    scope: RankingScope,
    period: RankingPeriod,
  ) => void | Promise<void>;
};
