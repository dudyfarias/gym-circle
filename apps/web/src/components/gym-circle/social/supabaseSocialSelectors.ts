import type {
  ConversationParticipantRow,
  PostCommentLikeRow,
  PostCommentRow,
  PostLikeRow,
  PostMediaRow,
  PostParticipantRow,
  StoryParticipantRow,
  UserGymRow,
  UserStatsRow,
} from "@gym-circle/core";
import {
  calculateAgeFromBirthDate,
  isBirthdayFromBirthDate,
} from "./profile";
import {
  getMainUserGymForProfile,
  getOrderedGymNamesForProfile,
} from "./profileRows";
import { sortStoriesNewestFirst } from "./stories";
import {
  countStoryLikes,
  filterMutedStories,
  hasUserLikedStory,
} from "./storyInteractions";
import { buildMonthWorkoutDays, calculateWorkoutStats } from "./streak";
import {
  accentForId,
  deriveAchievements,
  getDailyPresenceFromStats,
  getSharedGymCount,
  getSmartReason,
  getSmartScore,
  mergeRowsByKey,
  mergeUserStatsRow,
} from "./supabaseSocialMappers";
import type {
  AggregateState,
  ProfileRowWithRecapCovers,
} from "./supabaseSocialTypes";
import type {
  ChatConversation,
  ChatMessage,
  EnrichedPost,
  EnrichedStory,
  EnrichedUser,
  GymLocationOption,
  GymPost,
  GymUser,
  PostMediaType,
} from "./types";

/**
 * Seletores derivados do useSupabaseSocial — extraídos do hook na Sprint 21.4
 * Fase 2. São a computação PURA que vivia dentro dos useMemo gigantes
 * (enrichedAll, profilePosts, storyItems): `AggregateState` cru → modelos de
 * domínio (EnrichedUser/Post/Story). No hook viraram wrappers finos, com os
 * MESMOS dependency arrays. Pura e determinística → testável em isolamento.
 */

/**
 * Map user_id → EnrichedUser a partir do AggregateState. Aplica o smart merge
 * de stats (Sprint 3.6.1), counts de follow só com aceitos, e a regra de
 * "current user vs. visitado vs. nunca-visto" pros campos que só o
 * profileExtras/myActivityDates preenchem.
 */
export function buildEnrichedUsers(
  agg: AggregateState,
  currentUserId: string,
  blockedSet: Set<string>,
): Map<string, EnrichedUser> {
  // Sprint 3.6.1 bug fix: defense in depth. `agg.stats` chega
  // DEDUPLICADO via `mergeStatsArrays` em todos os `setAgg` que tocam
  // stats, então este loop normalmente não vê conflitos. Mas se algum
  // call site no futuro voltar a usar `mergeRowsByKey` genérico (last
  // wins) por engano, o smart merge aqui ainda recupera. O Map manda
  // (chave única = user_id) e `mergeUserStatsRow` resolve conflitos
  // com Math.max nos contadores, preservando valores reais sobre
  // partials zerados.
  const statsByUser = new Map<string, UserStatsRow>();
  for (const incoming of agg.stats) {
    const existing = statsByUser.get(incoming.user_id);
    statsByUser.set(
      incoming.user_id,
      existing ? mergeUserStatsRow(existing, incoming) : incoming,
    );
  }
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
  // Sprint 3.6.2: deriva `workoutsThisWeek` do current user diretamente
  // de `user_activity_days` (Set `myActivityDates`). Sem essa derivação o
  // ring de Semana do `AvatarConsistencyRings` ficava sempre vazio
  // (`workoutsThisWeek: 0` hardcoded antes), e o usuário via apenas 2 dos
  // 3 rings (mês + ano stub). Outros users do feed continuam com 0
  // porque não temos `user_activity_days` deles sem RPC adicional —
  // limitação conhecida da Sprint 3.5 pendente pra GamificationService.
  const myWorkoutStats =
    myActivityDates.size > 0
      ? calculateWorkoutStats(Array.from(myActivityDates))
      : null;

  const map = new Map<string, EnrichedUser>();
  for (const profile of agg.profiles) {
    const accountStatus = profile.account_status ?? "active";
    // Bloqueio mútuo: o app de A não vê B, e o app de B não vê A.
    // Eu mantenho o próprio usuário fora dessa filtragem (preciso me
    // ver pra saber meu badge/streak).
    if (
      profile.user_id !== currentUserId &&
      (blockedSet.has(profile.user_id) || accountStatus !== "active")
    ) {
      continue;
    }
    const stats = statsByUser.get(profile.user_id);
    const birthDate = profile.birth_date ?? null;
    const userGyms = userGymsByUser.get(profile.user_id) ?? [];
    const gymNames = getOrderedGymNamesForProfile(profile, userGyms, gymsById);
    const mainUserGym = getMainUserGymForProfile(profile, userGyms);
    const preferredTimes =
      profile.preferred_training_times?.length
        ? profile.preferred_training_times
        : mainUserGym?.preferred_times ?? [];
    const followStatus =
      myFollowStatusByTarget.get(profile.user_id) ?? "none";
    const enriched: EnrichedUser = {
      id: profile.user_id,
      createdAt: profile.created_at,
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
      onboardingCompletedAt: profile.onboarding_completed_at ?? null,
      profileCompletionNoticeDismissed:
        profile.profile_completion_notice_dismissed ?? false,
      monthlyRecapCovers:
        (profile as ProfileRowWithRecapCovers).monthly_recap_covers ?? undefined,
      alphaTermsAcceptedAt: profile.alpha_terms_accepted_at ?? null,
      privacyPolicyAcceptedAt: profile.privacy_policy_accepted_at ?? null,
      accountStatus,
      suspendedAt: profile.suspended_at ?? null,
      reactivationSentAt: profile.reactivation_sent_at ?? null,
      reactivationExpiresAt: profile.reactivation_expires_at ?? null,
      mainGymId: profile.main_gym_id ?? null,
      location: gymsById.get(profile.main_gym_id ?? "")?.city ?? "",
      gyms: gymNames,
      preferredTimes,
      currentStreak: stats?.current_streak ?? 0,
      longestStreak: stats?.best_streak ?? 0,
      lastWorkoutDate: stats?.last_active_date ?? "",
      // Sprint 3.6.2 + 3.6.3:
      // - current user → derivado de myActivityDates (já carregado em
      //   refreshHomeCritical).
      // - outro user já visitado via ProfileSheet → vem de
      //   profileExtras[user_id] (carregado em refreshProfilePosts).
      // - outro user nunca visitado → 0 (ring vazio até abrir o perfil).
      workoutsThisWeek:
        profile.user_id === currentUserId
          ? myWorkoutStats?.workoutsThisWeek ?? 0
          : agg.profileExtras[profile.user_id]?.workoutsThisWeek ?? 0,
      workoutsThisMonth: stats?.workouts_this_month ?? 0,
      activeDaysCount: stats?.active_days_this_year ?? 0,
      streakRestoresAvailable:
        profile.user_id === currentUserId ? stats?.streak_restores_available ?? 3 : 0,
      lastStreakRestoreUsedAt:
        profile.user_id === currentUserId ? stats?.last_streak_restore_used_at ?? null : null,
      lastStreakRestoreEarnedAt:
        profile.user_id === currentUserId ? stats?.last_streak_restore_earned_at ?? null : null,
      streakRestoreDeadlineAt:
        profile.user_id === currentUserId ? stats?.streak_restore_deadline_at ?? null : null,
      streakRestoreMissedDate:
        profile.user_id === currentUserId ? stats?.streak_restore_missed_date ?? null : null,
      streakRestoreStatus:
        profile.user_id === currentUserId ? stats?.streak_restore_status ?? null : null,
      checkInsCount: profile.user_id === currentUserId ? agg.myActivityDays.length : 0,
      achievements: deriveAchievements(stats),
      // Sprint 3.6.3: pra current user, derivamos de agg.follows (que
      // está completo — refreshHomeCritical busca todas as relações
      // do currentUser). Pra outros users, agg.follows não tem dado
      // representativo (só conexões com currentUser), então pegamos
      // de profileExtras quando disponível (= o user visitou o
      // ProfileSheet desse user). Fallback 0 enquanto perfil não foi
      // aberto — momento em que refreshProfilePosts hidrata.
      followersCount:
        profile.user_id === currentUserId
          ? followersCountByUser.get(profile.user_id) ?? 0
          : agg.profileExtras[profile.user_id]?.followersCount ??
            (followersCountByUser.get(profile.user_id) ?? 0),
      followingCount:
        profile.user_id === currentUserId
          ? followingCountByUser.get(profile.user_id) ?? 0
          : agg.profileExtras[profile.user_id]?.followingCount ??
            (followingCountByUser.get(profile.user_id) ?? 0),
      isFollowing: followStatus === "accepted",
      followStatus,
      isPrivate: profile.is_private ?? false,
      // Sprint 3.6.5: pro current user, vem do myActivityDates (já em
      // memória completo via refreshHomeSecondary). Pra outros users,
      // pega do profileExtras (populado pelo bulk refreshUsersExtras ou
      // refreshProfilePosts on-demand). Sem dados ainda = `[]` =
      // calendário vazio até hidratação.
      workoutDays:
        profile.user_id === currentUserId
          ? Array.from(myActivityDates)
          : agg.profileExtras[profile.user_id]?.activityDates ?? [],
      ...getDailyPresenceFromStats(stats),
    };
    map.set(profile.user_id, enriched);
  }
  return map;
}

export type ProfilePostsContext = {
  agg: AggregateState;
  enrichedAll: Map<string, EnrichedUser>;
  currentUser: EnrichedUser;
  currentUserId: string;
  blockedSet: Set<string>;
  postParticipantsByPost: Map<string, PostParticipantRow[]>;
};

/**
 * Lista de posts enriquecidos (histórico de perfil — o feed filtra seguir-only
 * por cima disso). Junta feedPosts + profileFeedPosts, hidrata carrossel
 * (post_media), comentários threaded, likes, participantes e smart-score.
 */
export function buildProfilePosts(ctx: ProfilePostsContext): EnrichedPost[] {
  const {
    agg,
    enrichedAll,
    currentUser,
    currentUserId,
    blockedSet,
    postParticipantsByPost,
  } = ctx;
  const visibleRows = mergeRowsByKey(
    agg.feedPosts,
    agg.profileFeedPosts,
    (post) => post.id,
  );
  if (!visibleRows.length) return [];
  const myLikedSet = new Set(
    agg.postLikes.filter((l) => l.user_id === currentUserId).map((l) => l.post_id),
  );
  const commentsByPost = new Map<string, PostCommentRow[]>();
  for (const c of agg.postComments) {
    const list = commentsByPost.get(c.post_id) ?? [];
    list.push(c);
    commentsByPost.set(c.post_id, list);
  }
  const commentLikesByComment = new Map<string, PostCommentLikeRow[]>();
  for (const like of agg.postCommentLikes) {
    const list = commentLikesByComment.get(like.comment_id) ?? [];
    list.push(like);
    commentLikesByComment.set(like.comment_id, list);
  }
  const enrichComment = (c: PostCommentRow, fallbackAuthor: EnrichedUser) => {
    const commentLikes = commentLikesByComment.get(c.id) ?? [];
    return {
      id: c.id,
      postId: c.post_id,
      userId: c.user_id,
      body: c.body,
      createdAt: c.created_at,
      // parent_comment_id ainda não está no Database type gerado (coluna nova
      // da Sprint 12.1) — cast localizado até o próximo generate de tipos.
      parentCommentId:
        (c as { parent_comment_id?: string | null }).parent_comment_id ?? null,
      likesCount: commentLikes.length,
      likedByCurrentUser: commentLikes.some((like) => like.user_id === currentUserId),
      author: enrichedAll.get(c.user_id) ?? fallbackAuthor,
    };
  };
  const likesByPost = new Map<string, PostLikeRow[]>();
  for (const l of agg.postLikes) {
    const list = likesByPost.get(l.post_id) ?? [];
    list.push(l);
    likesByPost.set(l.post_id, list);
  }
  // Sprint 13 — carrossel: agrupa post_media por post (já vem ordenado por
  // position do fetch).
  const mediaByPost = new Map<string, PostMediaRow[]>();
  for (const m of agg.postMedia) {
    const list = mediaByPost.get(m.post_id) ?? [];
    list.push(m);
    mediaByPost.set(m.post_id, list);
  }

  return visibleRows
    // Histórico de perfil usa tudo que a RLS/view deixa o usuário ver.
    // O home feed continua filtrado abaixo para seguir-only.
    .filter((row) => {
      if (row.user_id === currentUserId) return true;
      if (blockedSet.has(row.user_id)) return false;
      return Boolean(enrichedAll.get(row.user_id));
    })
    .map((row) => {
      const author = enrichedAll.get(row.user_id) ?? currentUser;
      const likesCount = row.likes_count ?? 0;
      // Sprint 13 — carrossel: media[] sempre ≥1. Usa post_media (ordenado por
      // position) quando existe; senão cai na capa (posts.*), idêntico a antes.
      const mediaRows = mediaByPost.get(row.id) ?? [];
      const media: GymPost["media"] =
        mediaRows.length > 0
          ? mediaRows.map((m) => ({
              mediaType: (m.media_type ?? "image") as PostMediaType,
              imageUrl: m.image_url,
              thumbnailUrl: m.thumbnail_url ?? null,
              posterUrl: m.poster_url ?? null,
              blurDataUrl: m.blur_data_url ?? null,
              mediaWidth: m.media_width ?? null,
              mediaHeight: m.media_height ?? null,
              mediaDurationSeconds: m.media_duration_seconds ?? null,
            }))
          : [
              {
                mediaType: (row.media_type ?? "image") as PostMediaType,
                imageUrl: row.image_url,
                thumbnailUrl: row.thumbnail_url ?? null,
                posterUrl: row.poster_url ?? null,
                blurDataUrl: row.blur_data_url ?? null,
                mediaWidth: row.media_width ?? null,
                mediaHeight: row.media_height ?? null,
                mediaDurationSeconds: row.media_duration_seconds ?? null,
              },
            ];
      const postComments = commentsByPost.get(row.id) ?? [];
      // Sprint 12.1 — o preview inline do feed mostra só comentários de TOPO
      // (sem replies órfãs). O sheet usa commentThread (lista completa).
      const topLevelPostComments = postComments.filter(
        (c) =>
          !(c as { parent_comment_id?: string | null }).parent_comment_id,
      );
      const latestCommentPreviews = topLevelPostComments.slice(-2);
      const ownOlderPreview = [...topLevelPostComments]
        .reverse()
        .find(
          (comment) =>
            comment.user_id === currentUserId &&
            !latestCommentPreviews.some((preview) => preview.id === comment.id),
        );
      const commentPreviews = (ownOlderPreview
        ? [ownOlderPreview, ...latestCommentPreviews]
        : latestCommentPreviews
      ).map((c) => enrichComment(c, author));
      const likedByPreview = (likesByPost.get(row.id) ?? [])
        .map((l) => enrichedAll.get(l.user_id))
        .filter((u): u is EnrichedUser => Boolean(u))
        .slice(0, row.user_id === currentUserId ? 3 : 0);
      const likedByUsers =
        row.user_id === currentUserId
          ? (likesByPost.get(row.id) ?? [])
              .map((l) => enrichedAll.get(l.user_id))
              .filter((u): u is EnrichedUser => Boolean(u))
          : [];
      const participantRows = postParticipantsByPost.get(row.id) ?? [];
      const participants = participantRows.map((participant) => ({
        id: participant.id,
        targetId: participant.post_id,
        taggedUserId: participant.tagged_user_id,
        taggedByUserId: participant.tagged_by_user_id,
        status: participant.status as "pending" | "accepted" | "rejected",
        acceptedAt: participant.accepted_at,
        rejectedAt: participant.rejected_at,
        createdAt: participant.created_at,
      }));
      const acceptedParticipants = participantRows
        .filter((participant) => participant.status === "accepted")
        .map((participant) => enrichedAll.get(participant.tagged_user_id))
        .filter((user): user is EnrichedUser => Boolean(user));
      const pendingParticipants =
        row.user_id === currentUserId
          ? participantRows
              .filter((participant) => participant.status === "pending")
              .map((participant) => enrichedAll.get(participant.tagged_user_id))
              .filter((user): user is EnrichedUser => Boolean(user))
          : [];
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
        thumbnailUrl: row.thumbnail_url ?? null,
        posterUrl: row.poster_url ?? null,
        mediaWidth: row.media_width ?? null,
        mediaHeight: row.media_height ?? null,
        mediaDurationSeconds: row.media_duration_seconds ?? null,
        blurDataUrl: row.blur_data_url ?? null,
        mediaType: row.media_type ?? "image",
        caption: row.caption ?? "",
        workoutType: row.workout_type ?? null,
        // Sprint 13 — até 5 tags (primária acima); carrossel media[] (≥1).
        workoutTypes:
          (row as { workout_types?: string[] | null }).workout_types ?? null,
        media,
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
        commentsCount: row.comments_count ?? postComments.length,
        comments: postComments.map((c) => ({
          ...enrichComment(c, author),
        })),
        author,
        commentPreviews,
        // Sprint 12.1 — lista completa enriquecida pro CommentsBottomSheet
        // (threaded). Mesma fonte de `comments` acima, mas tipada como
        // EnrichedComment[] (com author) pra render de replies + likes.
        commentThread: postComments.map((c) => enrichComment(c, author)),
        likedByPreview,
        likedByUsers,
        participants,
        acceptedParticipants,
        pendingParticipants,
        smartScore,
        smartReason: getSmartReason(row, author, currentUser),
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type StoryItemsContext = {
  agg: AggregateState;
  enrichedAll: Map<string, EnrichedUser>;
  currentUserId: string;
  storyParticipantsByStory: Map<string, StoryParticipantRow[]>;
  viewedStoryIds: Set<string>;
};

/**
 * Lista de stories enriquecidos (tray + viewer). Aplica mutes, filtro de
 * seguir-only (exceto marcados), marca `viewed` cruzando viewedStoryIds +
 * agg.storyViews, e mescla as trayRows não-hidratadas no fim.
 */
export function buildStoryItems(ctx: StoryItemsContext): EnrichedStory[] {
  const {
    agg,
    enrichedAll,
    currentUserId,
    storyParticipantsByStory,
    viewedStoryIds,
  } = ctx;
  const out: EnrichedStory[] = [];
  const viewedSet = new Set(viewedStoryIds);
  for (const view of agg.storyViews) viewedSet.add(view.story_id);
  const hydratedAuthors = new Set(agg.stories.map((story) => story.user_id));
  const visibleStories = filterMutedStories(
    agg.stories.map((story) => ({ ...story, userId: story.user_id })),
    agg.storyMutes.map((mute) => ({ mutedUserId: mute.muted_user_id })),
  );
  for (const row of visibleStories) {
    const author = enrichedAll.get(row.user_id);
    if (!author) continue;
    const participantRows = storyParticipantsByStory.get(row.id) ?? [];
    const acceptedForCurrentUser = participantRows.some(
      (participant) =>
        participant.status === "accepted" && participant.tagged_user_id === currentUserId,
    );
    if (
      row.user_id !== currentUserId &&
      author.followStatus !== "accepted" &&
      !acceptedForCurrentUser
    ) {
      continue;
    }
    const participants = participantRows.map((participant) => ({
      id: participant.id,
      targetId: participant.story_id,
      taggedUserId: participant.tagged_user_id,
      taggedByUserId: participant.tagged_by_user_id,
      status: participant.status as "pending" | "accepted" | "rejected",
      acceptedAt: participant.accepted_at,
      rejectedAt: participant.rejected_at,
      createdAt: participant.created_at,
    }));
    const acceptedParticipants = participantRows
      .filter((participant) => participant.status === "accepted")
      .map((participant) => enrichedAll.get(participant.tagged_user_id))
      .filter((user): user is EnrichedUser => Boolean(user));
    const pendingParticipants =
      row.user_id === currentUserId
        ? participantRows
            .filter((participant) => participant.status === "pending")
            .map((participant) => enrichedAll.get(participant.tagged_user_id))
            .filter((user): user is EnrichedUser => Boolean(user))
        : [];
    out.push({
      id: row.id,
      userId: row.user_id,
      imageUrl: row.media_url,
      thumbnailUrl: row.thumbnail_url ?? null,
      posterUrl: row.poster_url ?? null,
      mediaWidth: row.media_width ?? null,
      mediaHeight: row.media_height ?? null,
      mediaDurationSeconds: row.media_duration_seconds ?? null,
      blurDataUrl: row.blur_data_url ?? null,
      mediaType: row.media_type ?? "image",
      title: row.workout_type ?? "Treino",
      caption: `${author.currentStreak}d · ${author.gyms[0] ?? ""}`,
      createdAt: row.created_at,
      viewed: viewedSet.has(row.id),
      likedByCurrentUser: hasUserLikedStory(
        agg.storyLikes.map((like) => ({
          storyId: like.story_id,
          userId: like.user_id,
        })),
        row.id,
        currentUserId,
      ),
      likesCount: countStoryLikes(
        agg.storyLikes.map((like) => ({
          storyId: like.story_id,
          userId: like.user_id,
        })),
        row.id,
      ),
      kind: "workout",
      participants,
      acceptedParticipants,
      pendingParticipants,
      author,
    });
  }
  for (const trayRow of agg.storyTrayRows) {
    const authorId = trayRow.author_id ?? trayRow.user_id;
    const storyId = trayRow.first_unseen_story_id ?? trayRow.first_story_id ?? trayRow.id;
    if (!authorId || !storyId || hydratedAuthors.has(authorId)) continue;
    if (agg.storyMutes.some((mute) => mute.muted_user_id === authorId)) continue;
    const author = enrichedAll.get(authorId);
    if (!author) continue;
    const viewed = trayRow.has_unseen === false || viewedSet.has(storyId);
    out.push({
      id: storyId,
      userId: authorId,
      imageUrl: trayRow.avatar_url ?? "",
      thumbnailUrl: trayRow.avatar_url ?? null,
      posterUrl: null,
      mediaWidth: null,
      mediaHeight: null,
      mediaDurationSeconds: null,
      blurDataUrl: null,
      mediaType: "image",
      title: "Treino",
      caption: `${author.currentStreak}d · ${author.gyms[0] ?? ""}`,
      createdAt: trayRow.latest_story_at ?? new Date().toISOString(),
      viewed,
      likedByCurrentUser: false,
      likesCount: 0,
      kind: "workout",
      participants: [],
      acceptedParticipants: [],
      pendingParticipants: [],
      author,
    });
  }
  return sortStoriesNewestFirst(out);
}

/**
 * EnrichedUser do usuário logado, com fallback "vazio" quando o profile ainda
 * não hidratou (boot frio antes do refreshHomeCritical).
 */
export function buildCurrentUser(
  enrichedAll: Map<string, EnrichedUser>,
  currentUserId: string,
): EnrichedUser {
  return (
    enrichedAll.get(currentUserId) ?? {
      id: currentUserId,
      createdAt: undefined,
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
      onboardingCompletedAt: null,
      profileCompletionNoticeDismissed: false,
      alphaTermsAcceptedAt: null,
      privacyPolicyAcceptedAt: null,
      accountStatus: "active",
      suspendedAt: null,
      reactivationSentAt: null,
      reactivationExpiresAt: null,
      mainGymId: null,
      location: "",
      gyms: [],
      preferredTimes: [],
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: "",
      workoutsThisWeek: 0,
      workoutsThisMonth: 0,
      activeDaysCount: 0,
      streakRestoresAvailable: 3,
      lastStreakRestoreUsedAt: null,
      lastStreakRestoreEarnedAt: null,
      streakRestoreDeadlineAt: null,
      streakRestoreMissedDate: null,
      streakRestoreStatus: null,
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
}

/** Record id → user (lookup O(1) pros componentes que recebem mapa). */
export function buildUsersRecord(
  enrichedAll: Map<string, EnrichedUser>,
): Record<string, GymUser> {
  const record: Record<string, GymUser> = {};
  enrichedAll.forEach((user, id) => {
    record[id] = user;
  });
  return record;
}

/** Opções de academia (gyms) pro seletor de localização do composer. */
export function buildGymOptions(
  gyms: AggregateState["gyms"],
): GymLocationOption[] {
  return gyms.map((gym) => ({
    id: gym.id,
    name: gym.name,
    address: gym.address,
    city: gym.city,
    state: gym.state,
    latitude: gym.latitude,
    longitude: gym.longitude,
  }));
}

export type SuggestedUsersContext = {
  suggestedUserIds: string[];
  enrichedAll: Map<string, EnrichedUser>;
  currentUser: EnrichedUser;
  currentUserId: string;
};

/**
 * Sugestões de pessoas: usa os IDs do RPC get_user_suggestions quando existem;
 * senão cai num ranking client-side (academia em comum > aceso hoje > streak).
 */
export function buildSuggestedUsers(ctx: SuggestedUsersContext): EnrichedUser[] {
  const { suggestedUserIds, enrichedAll, currentUser, currentUserId } = ctx;
  if (suggestedUserIds.length > 0) {
    return suggestedUserIds
      .map((userId) => enrichedAll.get(userId))
      .filter((user): user is EnrichedUser => Boolean(user));
  }
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
}

export type SocialStatsContext = {
  feedPosts: AggregateState["feedPosts"];
  stories: AggregateState["stories"];
  checkinsToday: AggregateState["checkinsToday"];
  currentUser: EnrichedUser;
};

/** Stats da home: quantos treinaram hoje, check-ins de hoje, dias do mês. */
export function buildSocialStats(ctx: SocialStatsContext) {
  const { feedPosts, stories, checkinsToday, currentUser } = ctx;
  return {
    trainedToday: new Set(
      [
        ...feedPosts
          .filter((p) => p.workout_date === new Date().toISOString().slice(0, 10))
          .map((p) => p.user_id),
        ...stories
          .filter((story) => story.created_at.slice(0, 10) === new Date().toISOString().slice(0, 10))
          .map((story) => story.user_id),
      ],
    ).size,
    checkInsToday: checkinsToday.length,
    monthDays: buildMonthWorkoutDays(currentUser.workoutDays),
  };
}

export type ChatMessagesContext = {
  chatMessages: AggregateState["chatMessages"];
  conversationParticipants: ConversationParticipantRow[];
  blockedSet: Set<string>;
  currentUserId: string;
};

/**
 * Mensagens do chat em modelo de domínio. Esconde mensagens de/para bloqueados
 * e as anteriores ao "apagar pra mim" (deleted_at do participante).
 */
export function buildChatMessages(ctx: ChatMessagesContext): ChatMessage[] {
  const { chatMessages, conversationParticipants, blockedSet, currentUserId } = ctx;
  const deletedByConversation = new Map(
    conversationParticipants
      .filter(
        (participant) =>
          participant.user_id === currentUserId && Boolean(participant.deleted_at),
      )
      .map((participant) => [
        participant.conversation_id,
        new Date(participant.deleted_at as string).getTime(),
      ]),
  );

  return chatMessages
    // Mensagens de/para usuários bloqueados não aparecem no chat.
    // Eu também não consigo enviar — RPC do server bloqueia (já tratado
    // em outros lugares por RLS de safety/messages). Aqui só hide UI.
    .filter((message) => {
      if (
        blockedSet.has(message.sender_id) ||
        (message.receiver_id ? blockedSet.has(message.receiver_id) : false)
      ) {
        return false;
      }
      const deletedAt = message.conversation_id
        ? deletedByConversation.get(message.conversation_id)
        : null;
      return !deletedAt || new Date(message.created_at).getTime() > deletedAt;
    })
    .map((message) => ({
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        receiverId: message.receiver_id,
        body: message.body,
        mediaUrl: message.media_url,
        thumbnailUrl: message.thumbnail_url ?? null,
        posterUrl: message.poster_url ?? null,
        mediaWidth: message.media_width ?? null,
        mediaHeight: message.media_height ?? null,
        mediaDurationSeconds: message.media_duration_seconds ?? null,
        blurDataUrl: message.blur_data_url ?? null,
        mediaType: message.media_type,
        storyId: message.story_id,
        replyToStory: message.reply_to_story,
        storyPreviewUrl: message.story_preview_url,
        createdAt: message.created_at,
        readAt: message.read_at,
      }));
}

export type ChatConversationsContext = {
  conversations: AggregateState["conversations"];
  conversationParticipants: ConversationParticipantRow[];
  conversationUnreadCounts: Record<string, number>;
  chatMessages: ChatMessage[];
  currentUserId: string;
};

/**
 * Conversas em modelo de domínio. Exclui as que o usuário apagou (a menos que
 * tenha mensagem nova depois do delete) e anexa unread count + membros.
 */
export function buildChatConversations(
  ctx: ChatConversationsContext,
): ChatConversation[] {
  const {
    conversations,
    conversationParticipants,
    conversationUnreadCounts,
    chatMessages,
    currentUserId,
  } = ctx;
  const participantsByConversation = new Map<string, ConversationParticipantRow[]>();
  for (const participant of conversationParticipants) {
    const list = participantsByConversation.get(participant.conversation_id) ?? [];
    list.push(participant);
    participantsByConversation.set(participant.conversation_id, list);
  }
  const messagesByConversation = new Map<string, ChatMessage[]>();
  for (const message of chatMessages) {
    if (!message.conversationId) continue;
    const list = messagesByConversation.get(message.conversationId) ?? [];
    list.push(message);
    messagesByConversation.set(message.conversationId, list);
  }

  return conversations
    .map<ChatConversation | null>((conversation) => {
      const participants = participantsByConversation.get(conversation.id) ?? [];
      const currentParticipant = participants.find((p) => p.user_id === currentUserId);
      if (!currentParticipant) return null;
      if (currentParticipant.deleted_at) {
        const lastVisibleMessage = messagesByConversation.get(conversation.id)?.at(-1);
        if (
          !lastVisibleMessage ||
          new Date(lastVisibleMessage.createdAt).getTime() <=
            new Date(currentParticipant.deleted_at).getTime()
        ) {
          return null;
        }
      }
      return {
        id: conversation.id,
        type: conversation.type === "group" ? "group" : "direct",
        name: conversation.name,
        imageUrl: conversation.image_url,
        memberIds: participants.map((participant) => participant.user_id),
        role: currentParticipant.role,
        lastReadAt: currentParticipant.last_read_at,
        deletedAt: currentParticipant.deleted_at,
        lastMessageAt: conversation.last_message_at,
        unreadCount: conversationUnreadCounts[conversation.id] ?? 0,
      } satisfies ChatConversation;
    })
    .filter((conversation): conversation is ChatConversation => Boolean(conversation));
}
