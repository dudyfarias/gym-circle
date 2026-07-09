"use client";

import { memo, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { sanitizeLocationLabel } from "@gym-circle/core";
import {
  ChevronRight,
  Heart,
  ImagePlus,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Route,
  Send,
  Timer,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { MentionText } from "../MentionText";
import {
  CAPTION_TRUNCATE_THRESHOLD,
  truncateCaptionText,
} from "../social/caption";
import { simulateHaptic } from "../social/haptics";
import { getPostLikeSummary } from "../social/likes";
import type { EnrichedPost, EnrichedUser, WorkoutDetail } from "../social/types";
import {
  formatElapsed,
  formatKm,
  formatPace,
  paceFromDistance,
} from "../workout/workoutElapsed";
import { MediaCarousel } from "./MediaCarousel";
import { StreakBadge } from "./StreakBadge";
import { WorkoutRouteMap } from "./WorkoutRouteMap";

type SocialPostCardProps = {
  post: EnrichedPost;
  currentUserId: string;
  formatTime: (createdAt: string) => string;
  onLike: (postId: string) => void;
  /** Sprint 3 — Fase 3.3+: abre o `CommentsBottomSheet` (escrita, like e
   *  delete de comentário moram no sheet, não no card). */
  onOpenComments?: (postId: string) => void;
  onShareToChat?: (postId: string, receiverId: string) => Promise<void> | void;
  /** Sprint 5: prop ainda aceita pra retrocompat com call sites (FeedScreen
   *  passa o handler), mas o BOTÃO de seguir foi removido do card.
   *  Pra seguir, user entra no perfil. Marcado opcional. */
  onToggleFollow?: (userId: string) => void;
  onSelectUser?: (userId: string) => void;
  onSelectGym?: (gymId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  shareTargets?: EnrichedUser[];
  /** Abre o menu contextual: editar/apagar se for dono, denunciar/bloquear se for visitante. */
  onOpenPostMenu?: (postId: string) => void;
  /** Abre o editor diretamente (usado no CTA "Adicionar fotos" de treino sem mídia real). */
  onEditPost?: (postId: string) => void;
  onOpenLikes?: (postId: string) => void;
  /** P0.1 — post promovido de treino: abre o overlay de detalhes (Apple). */
  onOpenWorkoutDetail?: (workout: WorkoutDetail) => void;
  /**
   * Sprint 5 — quando true, o card é renderizado embebido dentro do
   * `CommentsBottomSheet` (profile post-open ou tap "Comentar" no feed).
   * Esconde:
   *   - O preview do último comentário (a sheet já lista TODOS os
   *     comentários abaixo).
   *   - O link "Ver N comentários" (idem).
   *   - O botão de share/chat (evita sheet aninhado feio).
   *   - O botão de "3 pontos" / menu contextual (já tem opções no parent).
   * MANTÉM: imagem, header, like, likes summary, caption. UX igual ao
   * feed pra contexto + interação básica (like).
   */
  inCommentsSheet?: boolean;
};

const WORKOUT_TYPE_LABEL_KEY: Record<string, string> = {
  strength: "workout.types.strength",
  run: "workout.types.run",
  walk: "workout.types.walk",
  ride: "workout.types.ride",
  other: "workout.types.other",
};

function isAutomaticWorkoutCover(
  post: EnrichedPost,
  mediaItems: Array<{
    mediaType?: string | null;
    mediaWidth?: number | null;
    mediaHeight?: number | null;
  }>,
) {
  const media = mediaItems[0];
  return Boolean(
    post.workout &&
      mediaItems.length === 1 &&
      media?.mediaType === "image" &&
      media.mediaWidth === 1200 &&
      media.mediaHeight === 1500,
  );
}

function SocialPostCardComponent({
  post,
  currentUserId,
  formatTime,
  onLike,
  onOpenComments,
  onShareToChat,
  onSelectUser,
  onSelectGym,
  resolveUser,
  shareTargets = [],
  onOpenPostMenu,
  onEditPost,
  onOpenLikes,
  onOpenWorkoutDetail,
  inCommentsSheet = false,
}: SocialPostCardProps) {
  const { t } = useTranslation();
  // Sprint 3 — Fase 3.4: cleanup final do contrato. As props de comentário
  // (onComment, onDeleteComment, onLikeComment, mentionUsers) foram removidas
  // do type; o sheet em CommentsBottomSheet recebe essas callbacks diretamente
  // de GymCirclePreview. Sprint 5: onToggleFollow aceita mas não destructurada
  // — botão de seguir removido do card.
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharingToUserId, setSharingToUserId] = useState<string | null>(null);
  // Double-tap-to-like (gesto do Instagram): coração estoura no centro da mídia.
  const [heartBurst, setHeartBurst] = useState(false);
  const lastTapRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const mediaItems =
    post.media && post.media.length > 0
      ? post.media
      : [
          {
            mediaType: post.mediaType ?? "image",
            imageUrl: post.imageUrl,
            thumbnailUrl: post.thumbnailUrl ?? null,
            posterUrl: post.posterUrl ?? null,
            blurDataUrl: post.blurDataUrl ?? null,
            mediaWidth: post.mediaWidth ?? null,
            mediaHeight: post.mediaHeight ?? null,
            mediaDurationSeconds: post.mediaDurationSeconds ?? null,
          },
        ];
  const hideAutomaticWorkoutCover = isAutomaticWorkoutCover(post, mediaItems);
  const hasRealMedia = mediaItems.some(
    (media) =>
      Boolean(media.imageUrl || media.thumbnailUrl || media.posterUrl) &&
      !hideAutomaticWorkoutCover,
  );
  const isPostOwner = post.userId === currentUserId;
  const acceptedParticipants = post.acceptedParticipants ?? [];
  const pendingParticipants = post.pendingParticipants ?? [];
  const isCurrentLocation = post.locationSource === "current";
  const locationLabel = sanitizeLocationLabel(
    post.locationSource,
    post.locationName,
    post.gymName,
  );
  const likeSummary = getPostLikeSummary({
    currentUserId,
    likedByCurrentUser: post.likedByCurrentUser,
    likedByPreview: post.likedByPreview,
    likedByUsers: post.likedByUsers,
    likesCount: post.likesCount,
  });
  const canOpenLocationMap =
    Boolean(post.locationGoogleMapsUrl) && (!isCurrentLocation || isPostOwner);
  const canOpenGymDetail = Boolean(post.gymId && onSelectGym);
  const directShareTargets = useMemo(
    () =>
      shareTargets
        .filter((user) => user.id !== currentUserId)
        .filter((user) => user.followStatus === "accepted" || user.isFollowing)
        .slice(0, 12),
    [currentUserId, shareTargets],
  );
  const commentsCount = post.commentsCount ?? post.comments.length;
  const isCaptionLong = post.caption.length > CAPTION_TRUNCATE_THRESHOLD;
  const showFullCaption = captionExpanded || !isCaptionLong;
  const captionToShow = showFullCaption
    ? post.caption
    : truncateCaptionText(post.caption, CAPTION_TRUNCATE_THRESHOLD);
  const workoutRoute = useMemo(
    () =>
      (post.workout?.route ?? []).filter(
        (point) =>
          Array.isArray(point) &&
          point.length >= 2 &&
          Number.isFinite(point[0]) &&
          Number.isFinite(point[1]),
      ),
    [post.workout?.route],
  );
  const hasWorkoutRoute = workoutRoute.length >= 2;
  const workoutSummary = post.workout
    ? (() => {
        const isRouteWorkout = (post.workout.distanceM ?? 0) > 0;
        const movingS = post.workout.movingS ?? post.workout.elapsedS;
        const pace = isRouteWorkout
          ? paceFromDistance(post.workout.distanceM ?? 0, movingS)
          : null;
        const secondaryStats = [
          isRouteWorkout ? formatElapsed(post.workout.elapsedS) : null,
          pace != null ? formatPace(pace) : null,
          isRouteWorkout && (post.workout.elevationGainM ?? 0) >= 1
            ? `${Math.round(post.workout.elevationGainM ?? 0)} m`
            : null,
          post.workout.avgHr ? `${post.workout.avgHr} bpm` : null,
          post.workout.totalCalories
            ? `${Math.round(post.workout.totalCalories)} kcal`
            : null,
        ].filter((value): value is string => Boolean(value));
        return {
          isRouteWorkout,
          label: t(
            WORKOUT_TYPE_LABEL_KEY[post.workout.activityType] ??
              "workout.types.other",
          ),
          primary: isRouteWorkout
            ? formatKm(post.workout.distanceM ?? 0)
            : formatElapsed(post.workout.elapsedS),
          secondary: secondaryStats.join(" · "),
        };
      })()
    : null;
  const shouldShowWorkoutSummaryCard = Boolean(workoutSummary && !hasRealMedia);
  const workoutChipDetail =
    workoutSummary && hasRealMedia
      ? [
          workoutSummary.primary,
          workoutSummary.isRouteWorkout
            ? workoutSummary.secondary
                .split(" · ")
                .find((value) => value.includes("/"))
            : null,
        ]
          .filter((value): value is string => Boolean(value))
          .join(" · ")
      : null;

  function handleLike() {
    // Haptic light pré-callback pra resposta tátil imediata mesmo se o callback
    // for assíncrono (mock vs Supabase otimista vs erro). Sprint 3 — Fase 3.2.
    simulateHaptic("like");
    onLike(post.id);
  }

  // Double-tap na mídia = curtir (estilo Instagram). SÓ curte, nunca descurte
  // (o duplo-toque nunca remove o like); o coração estoura sempre como feedback.
  function likeFromDoubleTap() {
    setHeartBurst(true);
    window.setTimeout(() => setHeartBurst(false), 700);
    simulateHaptic("like");
    if (!post.likedByCurrentUser) onLike(post.id);
  }

  function handleMediaTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  // Detecta duplo-toque sem quebrar swipe do carrossel nem pinch-zoom: ignora se
  // o dedo se moveu (swipe) ou se há multitouch (pinch). preventDefault no 2º
  // toque evita o "click" sintético (que pausaria o vídeo).
  function handleMediaTouchEnd(event: React.TouchEvent) {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch || event.touches.length > 0) {
      lastTapRef.current = 0;
      return;
    }
    const moved = Math.hypot(touch.clientX - start.x, touch.clientY - start.y);
    if (moved > 12) {
      lastTapRef.current = 0;
      return;
    }
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      event.preventDefault();
      lastTapRef.current = 0;
      likeFromDoubleTap();
    } else {
      lastTapRef.current = now;
    }
  }

  function handleOpenComments() {
    // Sprint 3 — Fase 3.3: abre o CommentsBottomSheet via callback do parent
    // (wire-up em GymCirclePreview.tsx). Não há mais toggle inline.
    simulateHaptic("comment");
    onOpenComments?.(post.id);
  }

  async function sharePost(receiverId: string) {
    if (!onShareToChat || sharingToUserId) return;
    setSharingToUserId(receiverId);
    try {
      await onShareToChat(post.id, receiverId);
      setShareOpen(false);
    } finally {
      setSharingToUserId(null);
    }
  }

  return (
    <article className="gc-screen-enter overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0c0d0e] shadow-[0_24px_64px_rgba(0,0,0,0.48)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <button
            aria-label={t("feed.post.openProfile", { name: post.author.name })}
            className="gc-pressable shrink-0"
            onClick={() => onSelectUser?.(post.author.id)}
            type="button"
          >
            <Avatar
              accent={post.author.accent}
              name={post.author.name}
              src={post.author.avatarUrl ?? undefined}
            />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                className="gc-pressable min-w-0 truncate text-[15px] font-black"
                onClick={() => onSelectUser?.(post.author.id)}
                type="button"
              >
                {post.author.name}
              </button>
              <StreakBadge
                best={post.author.longestStreak}
                isLit={post.author.streakLitToday}
                size="xs"
                streak={post.author.currentStreak}
              />
            </div>
            <p className="flex min-w-0 items-center gap-1 truncate text-[12px] font-bold text-white/46">
              {locationLabel ? (
                canOpenGymDetail ? (
                  <button
                    className="gc-pressable inline-flex min-w-0 items-center gap-1 truncate hover:text-[var(--gc-brand)]"
                    onClick={() => onSelectGym?.(post.gymId)}
                    type="button"
                  >
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{locationLabel}</span>
                  </button>
                ) : canOpenLocationMap ? (
                  <a
                    className="gc-pressable inline-flex min-w-0 items-center gap-1 truncate hover:text-[var(--gc-brand)]"
                    href={post.locationGoogleMapsUrl ?? undefined}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{locationLabel}</span>
                  </a>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-1 truncate">
                    <MapPin size={12} className="shrink-0" />
                    <span className="truncate">{locationLabel}</span>
                  </span>
                )
              ) : null}
              {post.distanceLabel ? (
                <>
                  <span className="shrink-0 text-white/28">·</span>
                  <span className="shrink-0 text-[var(--gc-brand)]">
                    {post.distanceLabel}
                  </span>
                </>
              ) : null}
              {locationLabel ? <span className="shrink-0">·</span> : null}
              <span className="shrink-0">{formatTime(post.createdAt)}</span>
            </p>
            {acceptedParticipants.length > 0 || (isPostOwner && pendingParticipants.length > 0) ? (
              <p className="mt-0.5 truncate text-[12px] font-bold text-white/42">
                {acceptedParticipants.length > 0 ? (
                  <>
                    com{" "}
                    {acceptedParticipants.slice(0, 3).map((user, index) => (
                      <span key={user.id}>
                        {index > 0 ? ", " : ""}
                        <button
                          className="gc-pressable text-white/72"
                          onClick={() => onSelectUser?.(user.id)}
                          type="button"
                        >
                          @{user.username}
                        </button>
                      </span>
                    ))}
                  </>
                ) : null}
                {isPostOwner && pendingParticipants.length > 0 ? (
                  <span className={acceptedParticipants.length > 0 ? "ml-1" : ""}>
                    {acceptedParticipants.length > 0 ? "· " : ""}
                    {pendingParticipants.length} pendente
                    {pendingParticipants.length > 1 ? "s" : ""}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>
        {/* Sprint 5 — Botão de seguir REMOVIDO do card.
            Pra seguir, user entra no perfil (tap no nome/avatar) — fluxo
            existente. Decisão de produto do Eduardo: card mais limpo,
            menos CTAs concorrendo. */}
        <div className="flex items-center gap-2">
          {onOpenPostMenu && !inCommentsSheet ? (
            <IconButton
              className="size-11"
              label={t("feed.post.menuOpenLabel")}
              onClick={() => onOpenPostMenu(post.id)}
            >
              <MoreHorizontal size={18} />
            </IconButton>
          ) : null}
        </div>
      </div>

      {shouldShowWorkoutSummaryCard && workoutSummary ? (
        <button
          className="gc-pressable mx-4 mb-3 flex w-[calc(100%_-_2rem)] items-center gap-3 rounded-[20px] border border-[var(--gc-blue)]/12 bg-[var(--gc-blue)]/[0.055] p-4 text-left disabled:cursor-default"
          disabled={!post.workout || !onOpenWorkoutDetail}
          onClick={() => post.workout && onOpenWorkoutDetail?.(post.workout)}
          type="button"
        >
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--gc-blue)] text-black shadow-[0_0_28px_rgba(48,213,255,0.2)]">
            {workoutSummary.isRouteWorkout ? (
              <Route size={21} strokeWidth={2.8} />
            ) : (
              <Timer size={21} strokeWidth={2.8} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.08em] text-white/38">
              {workoutSummary.label}
            </p>
            <p className="text-[20px] font-black leading-tight text-white">
              {workoutSummary.primary}
            </p>
            {workoutSummary.secondary ? (
              <p className="mt-0.5 truncate text-[11.5px] font-bold text-white/42">
                {workoutSummary.secondary}
              </p>
            ) : null}
          </div>
        </button>
      ) : null}

      {!hideAutomaticWorkoutCover ? (
        // Double-tap-to-like (Instagram): wrapper em volta da mídia (carrossel
        // OU single) detecta o duplo-toque e mostra o coração. Não bloqueia
        // swipe/pinch/tap-de-vídeo (ver handlers).
        <div
          className="relative"
          onDoubleClick={likeFromDoubleTap}
          onTouchStart={handleMediaTouchStart}
          onTouchEnd={handleMediaTouchEnd}
        >
          {/* Sprint 13 — carrossel/mídia unificados.
              Importante para vídeo único: antes ele caía num `<video muted>` antigo
              sem controle de som; agora passa pelo mesmo player de carrossel. */}
          <MediaCarousel
            altText={t("feed.post.openProfile", { name: post.author.name })}
            media={mediaItems}
            priority={post.author.username === "edu.fit"}
          />

          {/* Coração do duplo-toque — estoura no centro da mídia (~520ms). Mesmo
              visual do StoryViewer (azul + glow), pointer-events-none. */}
          {heartBurst ? (
            <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
              <Heart
                className="gc-heart-burst text-[var(--gc-blue)] drop-shadow-[0_0_32px_rgba(48,213,255,0.65)]"
                fill="currentColor"
                size={96}
                strokeWidth={2.4}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {hasWorkoutRoute ? (
        <div className="mx-4 mt-3 overflow-hidden rounded-[22px] border border-[var(--gc-blue)]/12 bg-[var(--gc-blue)]/[0.045]">
          <button
            aria-label={t("workoutDetail.mapTitle")}
            className="gc-pressable block w-full"
            disabled={!post.workout || !onOpenWorkoutDetail}
            onClick={() => post.workout && onOpenWorkoutDetail?.(post.workout)}
            type="button"
          >
            <WorkoutRouteMap
              className="h-40 w-full"
              label={t("workoutDetail.mapTitle")}
              route={workoutRoute}
              showAttribution={false}
            />
          </button>
          <a
            className="block bg-black/35 px-2 py-1 text-right text-[8px] font-bold text-white/46"
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer"
            target="_blank"
          >
            © OpenStreetMap
          </a>
        </div>
      ) : null}

      {hideAutomaticWorkoutCover && isPostOwner && onEditPost && !inCommentsSheet ? (
        <button
          className="gc-pressable mx-4 mt-3 flex h-12 w-[calc(100%_-_2rem)] items-center justify-center gap-2 rounded-full bg-[var(--gc-blue)] text-[14px] font-black text-black"
          onClick={() => onEditPost(post.id)}
          type="button"
        >
          <ImagePlus size={18} strokeWidth={2.7} />
          {t("feedScreen.activity.addPhoto")}
        </button>
      ) : null}

      <div className="space-y-3 px-4 py-3.5">
        {/* Sprint 5 — Action row. Quando embebido no CommentsBottomSheet
            (`inCommentsSheet`), só o Like sobrevive: o botão de comentar
            seria redundante (já estamos NO sheet), e o share/menu abriria
            sheet aninhado. */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <IconButton
              className={[
                "size-11",
                post.likedByCurrentUser
                  ? "gc-heart-pop text-[var(--gc-blue)] drop-shadow-[0_0_18px_rgba(48,213,255,0.55)]"
                  : "text-white",
              ].join(" ")}
              label={
                post.likedByCurrentUser
                  ? t("feed.post.unlike")
                  : t("feed.post.like")
              }
              onClick={handleLike}
            >
              <Heart
                fill={post.likedByCurrentUser ? "currentColor" : "none"}
                size={19}
                strokeWidth={post.likedByCurrentUser ? 2.4 : 2.4}
              />
            </IconButton>
            {!inCommentsSheet ? (
              <IconButton
                className="size-11"
                label={t("feed.post.comment")}
                onClick={handleOpenComments}
              >
                <MessageCircle size={19} strokeWidth={2.4} />
              </IconButton>
            ) : null}
            {!inCommentsSheet ? (
              <IconButton
                className={[
                  "size-11",
                  shareOpen ? "text-[var(--gc-blue)]" : "",
                ].join(" ")}
                disabled={!onShareToChat}
                label={t("feed.post.share")}
                onClick={() => setShareOpen((value) => !value)}
              >
                <Send size={18} strokeWidth={2.4} />
              </IconButton>
            ) : null}
          </div>
          {post.workoutType ? (
            post.workout && onOpenWorkoutDetail ? (
              // Post com treino integrado: a tag da modalidade abre o overlay
              // de detalhes (estilo Apple) — sem faixa extra, menos poluído.
              <button
                aria-label={t("workoutDetail.title")}
                className={[
                  "gc-pressable flex min-w-0 max-w-[58%] items-center rounded-full bg-[var(--gc-blue)]/12 px-3 text-[var(--gc-blue)]",
                  workoutChipDetail
                    ? "gap-2 py-2 text-left"
                    : "gap-1.5 py-2 text-[12px] font-black",
                ].join(" ")}
                onClick={() => post.workout && onOpenWorkoutDetail(post.workout)}
                type="button"
              >
                <span className="min-w-0">
                  <span
                    className={[
                      "block truncate",
                      workoutChipDetail
                        ? "text-[9.5px] font-black uppercase tracking-[0.08em] text-[var(--gc-blue)]/72"
                        : "",
                    ].join(" ")}
                  >
                    {post.workoutType}
                  </span>
                  {workoutChipDetail ? (
                    <span className="mt-0.5 block truncate text-[12px] font-black leading-none text-[var(--gc-blue)]">
                      {workoutChipDetail}
                    </span>
                  ) : null}
                </span>
                <ChevronRight className="shrink-0" size={13} strokeWidth={3} />
              </button>
            ) : (
              <span className="rounded-full bg-white/[0.06] px-3 py-2 text-[12px] font-bold text-white/72">
                {post.workoutType}
              </span>
            )
          ) : null}
        </div>

        {shareOpen ? (
          <div className="gc-screen-enter rounded-[24px] border border-white/[0.08] bg-white/[0.045] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-black text-white">
                {t("feed.post.shareTo")}
              </p>
              <button
                className="gc-pressable text-[12px] font-black text-white/42"
                onClick={() => setShareOpen(false)}
                type="button"
              >
                {t("common.close")}
              </button>
            </div>
            {directShareTargets.length > 0 ? (
              <div className="gc-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {directShareTargets.map((user) => (
                  <button
                    className="gc-pressable flex w-[76px] shrink-0 flex-col items-center gap-2 rounded-[20px] bg-black/32 p-2 text-center"
                    disabled={sharingToUserId !== null}
                    key={user.id}
                    onClick={() => {
                      void sharePost(user.id);
                    }}
                    type="button"
                  >
                    <div className="relative">
                      <Avatar
                        accent={user.accent}
                        name={user.name}
                        size="sm"
                        src={user.avatarUrl ?? undefined}
                      />
                      <span className="absolute -bottom-1 -right-1">
                        <StreakBadge
                          isLit={user.streakLitToday}
                          size="xs"
                          streak={user.currentStreak}
                        />
                      </span>
                    </div>
                    <span className="w-full truncate text-[11px] font-black text-white/72">
                      {sharingToUserId === user.id ? (
                        <Loader2 className="mx-auto animate-spin" size={14} />
                      ) : (
                        user.username
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="rounded-[18px] bg-black/28 px-3 py-3 text-[12px] font-bold text-white/44">
                Siga pessoas para enviar treinos por mensagem.
              </p>
            )}
          </div>
        ) : null}

        {/* Likes summary — Instagram-style. Sprint 3 — Fase 3.2.
            Unifica branches owner/visitor: usa likeSummary ("Curtido por @ana e
            mais N pessoas") quando disponível, com fallback de contador puro.
            Clicável apenas pelo owner (UX existente — apenas o dono vê o sheet
            com lista completa). */}
        {post.likesCount > 0 ? (() => {
          // Sprint 4.4 i18n: likeSummary já vem traduzido do helper (caller
          // passa). Fallback usa contagem com plural via i18next.
          const summaryText =
            likeSummary ??
            t("feed.post.likesCount", { count: post.likesCount });
          const summaryContent = (
            <>
              {post.likedByPreview.length > 0 ? (
                <div className="flex -space-x-2">
                  {post.likedByPreview.slice(0, 3).map((user) => (
                    <div
                      className="rounded-full border-2 border-[#0c0d0e]"
                      key={user.id}
                      title={user.name}
                    >
                      <Avatar
                        accent={user.accent}
                        name={user.name}
                        size="sm"
                        src={user.avatarUrl ?? undefined}
                      />
                    </div>
                  ))}
                </div>
              ) : null}
              <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">
                {summaryText}
              </span>
            </>
          );
          return isPostOwner && onOpenLikes ? (
            <button
              aria-label="Ver quem curtiu"
              className="gc-pressable flex items-center gap-2 text-left"
              onClick={() => onOpenLikes(post.id)}
              type="button"
            >
              {summaryContent}
            </button>
          ) : (
            <div className="flex items-center gap-2">{summaryContent}</div>
          );
        })() : isPostOwner ? (
          <p className="text-[13px] font-bold text-white/44">
            {t("feed.post.beFirstToLike")}
          </p>
        ) : null}

        {/* Sprint 5 — Typography padronizada Instagram-like:
            - Caption e comment preview compartilham a MESMA escala
              (text-[14px] font-semibold leading-5 text-white/92).
            - Username em font-black + text-white em AMBOS (era inconsistente:
              o caption username herdava font-semibold enquanto o do comment
              tinha font-black explícito → comment parecia maior).
            - Link "Ver N comentários" subtler (white/48) pra ficar abaixo da
              hierarquia de body text. */}
        {post.caption ? (
          <p className="text-[14px] font-semibold leading-5 text-white/92">
            <button
              className="gc-pressable font-black text-white"
              onClick={() => onSelectUser?.(post.author.id)}
              type="button"
            >
              {post.author.username}
            </button>{" "}
            <MentionText
              onSelectUser={onSelectUser}
              resolveUser={resolveUser}
              text={captionToShow}
            />
            {!showFullCaption ? (
              <>
                …{" "}
                <button
                  aria-label={t("common.more")}
                  className="gc-pressable text-[13px] font-semibold text-white/52"
                  onClick={() => setCaptionExpanded(true)}
                  type="button"
                >
                  {t("common.more")}
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        {!inCommentsSheet && post.commentPreviews.length > 0 ? (() => {
          const preview = post.commentPreviews[post.commentPreviews.length - 1];
          if (!preview) return null;
          return (
            <button
              aria-label={`${preview.author.username}: ${preview.body}`}
              className="gc-pressable block w-full text-left text-[14px] font-semibold leading-5 text-white/92"
              onClick={handleOpenComments}
              type="button"
            >
              <span className="font-black text-white">{preview.author.username}</span>{" "}
              <MentionText
                onSelectUser={onSelectUser}
                resolveUser={resolveUser}
                text={preview.body}
              />
            </button>
          );
        })() : null}

        {!inCommentsSheet && commentsCount > 0 ? (
          <button
            className="gc-pressable block text-left text-[13px] font-semibold text-white/48"
            onClick={handleOpenComments}
            type="button"
          >
            {t("feed.post.viewComments", { count: commentsCount })}
          </button>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Sprint 2.5: `React.memo` com shallow compare default.
 *
 * Justificativa: `SocialPostCard` é renderizado N vezes no feed
 * (potencialmente 20-50 posts). Cada um carrega `<PinchZoomImage>` com
 * decode, `<MentionText>` parser, vídeo observer, vários `useMemo`.
 * Sem memo, qualquer re-render do `FeedScreen` (ex.: chega novo post,
 * scroll state muda, viewer location update) refaz tudo.
 *
 * Shallow compare cobre o caso comum: `post` object só muda quando o
 * conteúdo real muda (like, comment count, etc. — graças à imutabilidade
 * do reducer). Callbacks vêm do `GymCirclePreview` já estáveis via
 * `useCallback`. Props como `currentUserId` e `formatTime` são
 * referencialmente estáveis.
 *
 * Trade-off: se algum caller passar callback inline (closure nova a
 * cada render), o memo fica ineficaz mas não dá bug. Próxima audit
 * vale verificar com React DevTools Profiler.
 */
export const SocialPostCard = memo(SocialPostCardComponent);
