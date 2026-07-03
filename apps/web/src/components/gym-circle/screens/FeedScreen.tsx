"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  LocateFixed,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  DiscoveryUserCard,
  EmptyState,
  FeedActivityCard,
  FeedCheckinCard,
  SocialPostCard,
  StoryBubbles,
} from "../design-system";
import {
  getPreloadCount,
  pinSource,
  preloadImages,
  unpinSource,
} from "../design-system/imageCache";
import { MediaLoadingService } from "../media/MediaLoadingService";
import type {
  EnrichedActivity,
  EnrichedCheckin,
  EnrichedPost,
  EnrichedUser,
  StoryGroup,
} from "../social/types";
import {
  shouldShowViewerLocationPrompt,
  type ViewerLocationStatus,
} from "../social/useViewerLocation";
import { TopBar } from "../TopBar";

type FeedScreenProps = {
  currentUser: EnrichedUser;
  feedPosts: EnrichedPost[];
  feedCheckins?: EnrichedCheckin[];
  feedActivities?: EnrichedActivity[];
  stories: StoryGroup[];
  suggestedUsers: EnrichedUser[];
  formatTime: (createdAt: string) => string;
  onCreatePost: () => void;
  onLikePost: (postId: string) => void;
  /** Sprint 3 — Fase 3.3+: abre o CommentsBottomSheet (carrega detalhes via
   *  `refreshPostDetails`). Escrita/like/delete de comentários moram no sheet. */
  onOpenPostDetails?: (postId: string) => void;
  onSharePostToChat?: (postId: string, receiverId: string) => Promise<void> | void;
  onToggleFollow: (userId: string) => void;
  onOpenStory: (storyGroupId: string) => void;
  onRequestViewerLocation?: () => void;
  onDismissViewerLocationPrompt?: () => void;
  onSelectUser?: (userId: string) => void;
  onSelectGym?: (gymId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  onOpenPostMenu?: (postId: string) => void;
  onOpenCheckinMenu?: (checkinId: string) => void;
  onOpenActivityMenu?: (activityId: string) => void;
  onEditCheckin?: (checkinId: string) => void;
  /** Dono da atividade: adicionar foto → composer promove a entrada a post. */
  onAddActivityPhoto?: (activity: EnrichedActivity) => void;
  onOpenLikes?: (postId: string) => void;
  postShareTargets?: EnrichedUser[];
  viewerLocationError?: string | null;
  viewerLocationStatus?: ViewerLocationStatus;
  hasDistancePosts?: boolean;
  headerHidden?: boolean;
  loading?: boolean;
  feedHasMore?: boolean;
  feedLoadingMore?: boolean;
  onLoadMoreFeed?: () => void | Promise<void>;
};

export function FeedScreen({
  currentUser,
  feedPosts,
  feedCheckins = [],
  feedActivities = [],
  stories,
  suggestedUsers,
  formatTime,
  onCreatePost,
  onLikePost,
  onOpenPostDetails,
  onSharePostToChat,
  onToggleFollow,
  onOpenStory,
  onRequestViewerLocation,
  onDismissViewerLocationPrompt,
  onSelectUser,
  onSelectGym,
  resolveUser,
  onOpenPostMenu,
  onOpenCheckinMenu,
  onOpenActivityMenu,
  onEditCheckin,
  onAddActivityPhoto,
  onOpenLikes,
  postShareTargets = [],
  viewerLocationError,
  viewerLocationStatus = "idle",
  hasDistancePosts = false,
  headerHidden = false,
  loading = false,
  feedHasMore = false,
  feedLoadingMore = false,
  onLoadMoreFeed,
}: FeedScreenProps) {
  const { t } = useTranslation();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const feedItems = useMemo(
    () =>
      [
        ...feedPosts.map((post) => ({
          createdAt: post.createdAt,
          id: post.id,
          kind: "post" as const,
          post,
        })),
        ...feedCheckins.map((checkin) => ({
          checkin,
          createdAt: checkin.createdAt,
          id: checkin.id,
          kind: "checkin" as const,
        })),
        ...feedActivities.map((activity) => ({
          activity,
          createdAt: activity.createdAt,
          id: activity.id,
          kind: "activity" as const,
        })),
      ].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [feedActivities, feedCheckins, feedPosts],
  );

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !onLoadMoreFeed || !feedHasMore || feedLoadingMore) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void onLoadMoreFeed();
      },
      { rootMargin: "640px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [feedHasMore, feedLoadingMore, feedPosts.length, onLoadMoreFeed]);

  // Sprint 1 v1.1.1 C1+C2: top-N preload com pin-protect + métricas.
  //
  // Estende o preload original da Sprint 2.2 com 2 ganhos:
  //
  // 1. **pin-protect** via `pinSource()` — protege os top-N da eviction
  //    do LRU da Phase A. Sem isso, scroll longe + voltar ao topo
  //    poderia re-decodar imagens que acabamos de cachear.
  // 2. **Métrica `feed_first_paint_ms`** — log `[gc-metrics]` cronometra
  //    do mount do efeito até o primeiro decode resolver. Debug-only
  //    (sem backend nesta sprint).
  //
  // `MediaLoadingService.getBestMediaUrl(post, "feed")` escolhe HQ
  // (imageUrl 1920px) > thumbnail. Damos prioridade pro HQ porque é
  // o que o user VAI ver — o thumb só serve como blur placeholder.
  // `getPreloadCount(3)` continua adapting por connection.
  useEffect(() => {
    if (typeof window === "undefined" || feedPosts.length === 0) return;
    const count = getPreloadCount(3);
    if (count <= 0) return;
    const topN = feedPosts
      .slice(0, count)
      // Pula vídeos — poster já carrega via `<video poster>` nativo,
      // e o arquivo do vídeo é grande demais pra pre-fetch agressivo.
      .filter((post) => (post.mediaType ?? "image") !== "video");
    const srcs = topN
      .map((post) =>
        MediaLoadingService.getBestMediaUrl(
          {
            imageUrl: post.imageUrl,
            thumbnailUrl: post.thumbnailUrl ?? undefined,
            blurDataUrl: post.blurDataUrl ?? undefined,
          },
          "feed",
        ),
      )
      .filter((src): src is string => Boolean(src));
    if (srcs.length === 0) return;

    // Pin antes do preload — garante que a LRU não evict esses URLs
    // mesmo se outras imagens entrarem em volume durante o scroll.
    for (const src of srcs) pinSource(src);

    const startedAt = performance.now();
    let firstPaintLogged = false;
    void preloadImages(srcs, count).then(() => {
      if (firstPaintLogged) return;
      firstPaintLogged = true;
      // Métrica debug: tempo total até todos os top-N decodificarem.
      // Em produção essa linha vira no-op se o console for filtrado.
      const elapsed = Math.round(performance.now() - startedAt);
      console.log(`[gc-metrics] feed_first_paint_ms=${elapsed} count=${srcs.length}`);
    });

    // Cleanup: quando os top-N mudarem (novo feed após refresh ou load
    // more reordenar), unpin os anteriores antes de pin dos novos.
    return () => {
      for (const src of srcs) unpinSource(src);
    };
  }, [feedPosts]);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar
        eyebrow={t("feedScreen.topBar.eyebrow")}
        hidden={headerHidden}
        title={t("feedScreen.topBar.title")}
      />
      <StoryBubbles onOpenStory={onOpenStory} stories={stories} />
      <DistancePermissionCard
        error={viewerLocationError}
        hasDistancePosts={hasDistancePosts}
        onDismiss={onDismissViewerLocationPrompt}
        onRequest={onRequestViewerLocation}
        status={viewerLocationStatus}
      />

      {loading && feedItems.length === 0 ? (
        <FeedSkeleton />
      ) : feedItems.length > 0 ? (
        <div className="space-y-5">
          {feedItems.map((item) => (
            // gc-feed-cell (Sprint 21.3): content-visibility pula
            // render/paint dos posts fora da viewport — a WebView não
            // paga pelos cards já scrollados.
            <div className="gc-feed-cell" key={`${item.kind}:${item.id}`}>
              {item.kind === "post" ? (
                <SocialPostCard
                  currentUserId={currentUser.id}
                  formatTime={formatTime}
                  onLike={onLikePost}
                  onOpenLikes={onOpenLikes}
                  onOpenComments={onOpenPostDetails}
                  onOpenPostMenu={onOpenPostMenu}
                  onSelectGym={onSelectGym}
                  onSelectUser={onSelectUser}
                  onShareToChat={onSharePostToChat}
                  onToggleFollow={onToggleFollow}
                  post={item.post}
                  resolveUser={resolveUser}
                  shareTargets={postShareTargets}
                />
              ) : item.kind === "checkin" ? (
                <FeedCheckinCard
                  checkin={item.checkin}
                  formatTime={formatTime}
                  onEdit={
                    item.checkin.userId === currentUser.id
                      ? onEditCheckin
                      : undefined
                  }
                  onOpenMenu={
                    item.checkin.userId === currentUser.id
                      ? onOpenCheckinMenu
                      : undefined
                  }
                  onSelectGym={onSelectGym}
                  onSelectUser={onSelectUser}
                />
              ) : (
                <FeedActivityCard
                  activity={item.activity}
                  formatTime={formatTime}
                  onAddPhoto={
                    item.activity.userId === currentUser.id
                      ? onAddActivityPhoto
                      : undefined
                  }
                  onOpenMenu={
                    item.activity.userId === currentUser.id
                      ? onOpenActivityMenu
                      : undefined
                  }
                  onSelectGym={onSelectGym}
                  onSelectUser={onSelectUser}
                />
              )}
              {item.kind === "post" &&
              item.post === feedPosts[1] &&
              suggestedUsers.length > 0 ? (
                <section className="mt-5">
                  <div className="mb-3 flex items-center">
                    <h3 className="text-[17px] font-black">{t("feed.suggestions.title")}</h3>
                  </div>
                  <div className="gc-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
                    {suggestedUsers.slice(0, 5).map((user) => (
                      <DiscoveryUserCard
                        key={user.id}
                        onSelectUser={onSelectUser}
                        onToggleFollow={onToggleFollow}
                        user={user}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ))}
          <div ref={loadMoreRef} className="min-h-6 py-2 text-center">
            {feedLoadingMore ? (
              <span className="inline-flex items-center rounded-full bg-white/[0.05] px-3 py-2 text-[12px] font-black text-white/44">
                {t("feedScreen.loadingMore")}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState
          action={
            <button
              className="gc-pressable h-12 rounded-full bg-[var(--gc-brand)] px-5 text-[14px] font-black text-black"
              onClick={onCreatePost}
              type="button"
            >
              {t("feed.empty.action")}
            </button>
          }
          detail={t("feed.empty.body")}
          title={t("feed.empty.title")}
        />
      )}
    </section>
  );
}

function FeedSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5" aria-label={t("feedScreen.skeletonAria")}>
      {Array.from({ length: 3 }).map((_, index) => (
        <article
          className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0c0d0e]"
          key={index}
        >
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="size-12 animate-pulse rounded-full bg-white/[0.08]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-full bg-white/[0.08]" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-white/[0.05]" />
            </div>
            <div className="size-11 animate-pulse rounded-full bg-white/[0.06]" />
          </div>
          <div className="aspect-[4/5] animate-pulse bg-white/[0.045]" />
          <div className="space-y-3 px-4 py-4">
            <div className="h-11 w-36 animate-pulse rounded-full bg-white/[0.06]" />
            <div className="h-4 w-full animate-pulse rounded-full bg-white/[0.05]" />
            <div className="h-4 w-2/3 animate-pulse rounded-full bg-white/[0.04]" />
          </div>
        </article>
      ))}
    </div>
  );
}

type DistancePermissionCardProps = {
  error?: string | null;
  hasDistancePosts: boolean;
  onRequest?: () => void;
  onDismiss?: () => void;
  status: ViewerLocationStatus;
};

function DistancePermissionCard({
  error,
  hasDistancePosts,
  onDismiss,
  onRequest,
  status,
}: DistancePermissionCardProps) {
  const { t } = useTranslation();
  if (!onRequest || !shouldShowViewerLocationPrompt(status, hasDistancePosts)) {
    return null;
  }

  const isRequesting = status === "requesting";
  const isProblem =
    status === "denied" || status === "error" || status === "unsupported";

  return (
    <section className="mb-5 rounded-[28px] border border-white/[0.08] bg-white/[0.045] p-4 shadow-[0_18px_54px_rgba(0,0,0,0.26)] backdrop-blur-2xl">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--gc-brand)]/12 text-[var(--gc-brand)] shadow-[0_0_24px_rgba(92,232,255,0.14)]">
          {isProblem ? <MapPin size={18} /> : <LocateFixed size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-[14px] font-black text-white">
              {t("feedScreen.distance.title")}
            </p>
            <ShieldCheck size={14} className="text-white/36" />
          </div>
          <p className="mt-1 text-[12px] font-bold leading-4 text-white/46">
            {t("feedScreen.distance.hint")}
          </p>
          {error ? (
            <p className="mt-2 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            aria-label={t("feedScreen.distance.dismissAria")}
            className="gc-pressable grid size-11 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/46"
            onClick={onDismiss}
            type="button"
          >
            <X size={14} strokeWidth={2.6} />
          </button>
        ) : null}
      </div>
      <button
        className="gc-pressable mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--gc-brand)] text-[13px] font-black text-black shadow-[0_0_24px_rgba(92,232,255,0.18)] disabled:opacity-60"
        disabled={isRequesting}
        onClick={onRequest}
        type="button"
      >
        {isRequesting ? (
          <RefreshCw className="animate-spin" size={15} />
        ) : (
          <Sparkles size={15} />
        )}
        {isRequesting
          ? t("feedScreen.distance.locating")
          : t("feedScreen.distance.cta")}
      </button>
    </section>
  );
}
