import Image from "next/image";
import { useEffect, useRef } from "react";
import { Camera, Play } from "lucide-react";
import type { EnrichedPost } from "../social/types";
import { VideoThumbnail } from "./VideoThumbnail";

/**
 * ProfilePostsGrid — Sprint 3 / pós-3.4.
 *
 * Grid de posts compartilhado por `ProfileScreen` (aba) e `ProfileSheet`
 * (overlay). Layout Instagram-like full-bleed:
 *
 *   [post][post][post]
 *   [post][post][post]
 *
 * - `-mx-5` extende pra fora do padding horizontal do screen/sheet.
 * - `gap-[2px]` em vez de spacing maior — denso, igual ao IG.
 * - Sem `border-radius` no thumb (full-bleed visual).
 * - Play overlay pra vídeos.
 * - Empty state com Camera icon.
 *
 * `emptyTitle` permite caller customizar a copy (ex.: "Nenhum treino
 * publicado ainda" no Sheet vs "Seus treinos vão aparecer aqui" no Screen).
 */

type ProfilePostsGridProps = {
  posts: EnrichedPost[];
  onOpenPost?: (postId: string) => void;
  emptyTitle?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

export function ProfilePostsGrid({
  posts,
  onOpenPost,
  emptyTitle = "Os treinos vão aparecer aqui",
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: ProfilePostsGridProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hasMore || loadingMore || !onLoadMore) return;
    if (typeof IntersectionObserver === "undefined") return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) onLoadMore();
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, onLoadMore]);

  if (posts.length === 0) {
    return (
      <div className="mt-6 grid place-items-center rounded-[20px] border border-dashed border-white/[0.08] bg-white/[0.02] py-14 text-center">
        <Camera className="text-white/32" size={28} strokeWidth={2} />
        <p className="mt-3 text-[13px] font-bold text-white/52">{emptyTitle}</p>
        {loadingMore ? (
          <span className="mt-4 size-5 animate-spin rounded-full border-2 border-white/12 border-t-[var(--gc-brand)]" />
        ) : null}
      </div>
    );
  }

  return (
    <div className="-mx-5 mt-6">
      <div className="grid grid-cols-3 gap-[2px]">
        {posts.map((post) => (
          <PostThumb key={post.id} onOpenPost={onOpenPost} post={post} />
        ))}
      </div>
      {hasMore || loadingMore ? (
        <div ref={sentinelRef} className="grid min-h-16 place-items-center py-5">
          {loadingMore ? (
            <span className="size-5 animate-spin rounded-full border-2 border-white/12 border-t-[var(--gc-brand)]" />
          ) : (
            <span className="h-px w-px opacity-0" />
          )}
        </div>
      ) : null}
    </div>
  );
}

function PostThumb({
  post,
  onOpenPost,
}: {
  post: EnrichedPost;
  onOpenPost?: (postId: string) => void;
}) {
  return (
    <button
      aria-label={`Abrir post ${post.mediaType === "video" ? "em vídeo" : "com foto"}`}
      className="gc-pressable relative aspect-square w-full overflow-hidden bg-zinc-950 text-left"
      onClick={() => onOpenPost?.(post.id)}
      type="button"
    >
      {post.mediaType === "video" ? (
        <VideoThumbnail
          className="h-full w-full object-cover"
          poster={post.posterUrl ?? post.thumbnailUrl}
          src={post.imageUrl}
        />
      ) : (
        <Image
          alt={post.workoutType || "Treino"}
          className="object-cover"
          fill
          sizes="(max-width: 480px) 33vw, 160px"
          src={post.thumbnailUrl ?? post.imageUrl}
        />
      )}
      {post.mediaType === "video" ? (
        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/58 text-white backdrop-blur-md">
          <Play size={12} fill="currentColor" strokeWidth={2.4} />
        </span>
      ) : null}
    </button>
  );
}
