"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeLocationLabel } from "@gym-circle/core";
import {
  Clock3,
  Flame,
  Heart,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Send,
  UserCheck,
  UserPlus,
  Video,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import { MentionText } from "../MentionText";
import { getPostLikeSummary } from "../social/likes";
import { formatTrainingStreakText } from "../social/streak";
import type { EnrichedPost, EnrichedUser } from "../social/types";
import { EmptyState } from "./EmptyState";
import { PinchZoomImage } from "./PinchZoomImage";
import { StreakBadge } from "./StreakBadge";
import { SwipeRevealDelete } from "./SwipeRevealDelete";

type SocialPostCardProps = {
  post: EnrichedPost;
  currentUserId: string;
  formatTime: (createdAt: string) => string;
  onLike: (postId: string) => void;
  onComment: (postId: string, body: string) => void;
  onOpenComments?: (postId: string) => void;
  onDeleteComment?: (postId: string, commentId: string) => void;
  onLikeComment?: (postId: string, commentId: string) => void;
  onShareToChat?: (postId: string, receiverId: string) => Promise<void> | void;
  onToggleFollow: (userId: string) => void;
  onSelectUser?: (userId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  mentionUsers?: EnrichedUser[];
  shareTargets?: EnrichedUser[];
  /** Abre o menu contextual: editar/apagar se for dono, denunciar/bloquear se for visitante. */
  onOpenPostMenu?: (postId: string) => void;
  onOpenLikes?: (postId: string) => void;
};

type MentionMatch = {
  start: number;
  end: number;
  query: string;
};

function getDraftMentionMatch(value: string, caretIndex: number): MentionMatch | null {
  const safeCaret = Math.max(0, Math.min(caretIndex, value.length));
  const prefix = value.slice(0, safeCaret);
  const start = prefix.lastIndexOf("@");
  if (start < 0) return null;

  const before = value[start - 1];
  if (before && !/[\s([]/.test(before)) return null;

  const query = prefix.slice(start + 1);
  if (!/^[a-zA-Z0-9_.]{0,32}$/.test(query)) return null;

  return {
    start,
    end: safeCaret,
    query: query.toLowerCase(),
  };
}

export function SocialPostCard({
  post,
  currentUserId,
  formatTime,
  onLike,
  onComment,
  onOpenComments,
  onDeleteComment,
  onLikeComment,
  onShareToChat,
  onToggleFollow,
  onSelectUser,
  resolveUser,
  mentionUsers = [],
  shareTargets = [],
  onOpenPostMenu,
  onOpenLikes,
}: SocialPostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(post.comments.length > 0);
  const [draft, setDraft] = useState("");
  const [caretIndex, setCaretIndex] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharingToUserId, setSharingToUserId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const canFollow = post.author.id !== currentUserId;
  const mediaType = post.mediaType ?? "image";
  const imagePreviewUrl = post.thumbnailUrl ?? post.imageUrl;
  const videoPosterUrl = post.posterUrl ?? post.thumbnailUrl ?? undefined;
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
  const mentionMatch = useMemo(
    () => getDraftMentionMatch(draft, caretIndex),
    [draft, caretIndex],
  );
  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    const query = mentionMatch.query;
    return mentionUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => user.followStatus === "accepted" || user.isFollowing)
      .filter((user) => {
        const username = user.username.toLowerCase();
        const name = user.name.toLowerCase();
        return username.includes(query) || name.includes(query);
      })
      .slice(0, 5);
  }, [currentUserId, mentionMatch, mentionUsers]);
  const directShareTargets = useMemo(
    () =>
      shareTargets
        .filter((user) => user.id !== currentUserId)
        .filter((user) => user.followStatus === "accepted" || user.isFollowing)
        .slice(0, 12),
    [currentUserId, shareTargets],
  );
  const commentsCount = post.commentsCount ?? post.comments.length;

  useEffect(() => {
    if (mediaType !== "video") return;
    const node = videoRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const active = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.65);
        setVideoVisible(active);
        if (active) {
          void node.play().catch(() => undefined);
        } else {
          node.pause();
        }
      },
      { threshold: [0, 0.65, 1] },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      node.pause();
    };
  }, [mediaType, post.id]);

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim()) {
      return;
    }

    onComment(post.id, draft);
    setDraft("");
    setCaretIndex(0);
    setCommentsOpen(true);
  }

  function updateCaret() {
    window.setTimeout(() => {
      setCaretIndex(inputRef.current?.selectionStart ?? draft.length);
    }, 0);
  }

  function selectMention(user: EnrichedUser) {
    if (!mentionMatch) return;
    const replacement = `@${user.username} `;
    const nextDraft =
      draft.slice(0, mentionMatch.start) +
      replacement +
      draft.slice(mentionMatch.end);
    const nextCaret = mentionMatch.start + replacement.length;
    setDraft(nextDraft);
    setCaretIndex(nextCaret);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
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
            aria-label={`Ver ${post.author.name}`}
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
                canOpenLocationMap ? (
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
        <div className="flex items-center gap-2">
          {canFollow ? (() => {
            const author = post.author;
            const status = author.followStatus ?? (author.isFollowing ? "accepted" : "none");
            let Icon = UserPlus;
            let title = "Seguir";
            let cls = "bg-[var(--gc-brand)] text-black";
            if (status === "accepted") {
              Icon = UserCheck;
              title = "Seguindo";
              cls = "bg-white text-black";
            } else if (status === "pending") {
              Icon = Clock3;
              title = "Solicitação enviada";
              cls = "border border-white/[0.16] bg-white/[0.05] text-white/72";
            } else if (author.isPrivate) {
              Icon = Lock;
              title = "Solicitar para seguir";
            }
            return (
              <button
                aria-label={`${title} ${author.name}`}
                className={[
                  "gc-pressable grid size-11 place-items-center rounded-full",
                  cls,
                ].join(" ")}
                onClick={() => onToggleFollow(author.id)}
                title={title}
                type="button"
              >
                <Icon size={17} />
              </button>
            );
          })() : null}
          {onOpenPostMenu ? (
            <IconButton
              className="size-11"
              label="Mais opções"
              onClick={() => onOpenPostMenu(post.id)}
            >
              <MoreHorizontal size={18} />
            </IconButton>
          ) : null}
        </div>
      </div>

      <div
        className={[
          "relative overflow-hidden bg-black",
          mediaType === "video" ? "aspect-[4/5]" : "",
        ].join(" ")}
      >
        {mediaType === "video" ? (
          <video
            // Toca só quando está visível para não carregar vários vídeos no boot do iOS WebView.
            autoPlay={videoVisible}
            className="h-full w-full object-cover"
            loop
            muted
            playsInline
            poster={videoPosterUrl}
            preload="metadata"
            ref={videoRef}
            src={post.imageUrl}
          />
        ) : (
          <PinchZoomImage
            alt={`Treino de ${post.author.name}`}
            className="w-full"
            priority={post.author.username === "edu.fit"}
            sizes="(max-width: 480px) 100vw, 480px"
            src={imagePreviewUrl}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/84 via-black/18 to-transparent p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/48 px-3 py-2 text-[12px] font-black backdrop-blur-xl">
            <Flame
              size={15}
              className="text-[var(--gc-consistency-daily)]"
              fill="currentColor"
            />
            {formatTrainingStreakText(post.author.name, post.streakAtPost)}
          </div>
          {mediaType === "video" ? (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/42 px-3 py-1.5 text-[11px] font-black text-white/72 backdrop-blur-xl">
              <Video size={13} />
              Vídeo
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <IconButton
              className={[
                "size-11",
                post.likedByCurrentUser
                  ? "gc-heart-pop text-[var(--gc-blue)] drop-shadow-[0_0_18px_rgba(48,213,255,0.55)]"
                  : "text-white",
              ].join(" ")}
              label="Curtir"
              onClick={() => onLike(post.id)}
            >
              <Heart
                fill={post.likedByCurrentUser ? "currentColor" : "none"}
                size={19}
                strokeWidth={post.likedByCurrentUser ? 2.4 : 2.4}
              />
            </IconButton>
            <IconButton
              className="size-11"
              label="Comentar"
              onClick={() => {
                onOpenComments?.(post.id);
                setCommentsOpen((value) => !value);
              }}
            >
              <MessageCircle size={19} strokeWidth={2.4} />
            </IconButton>
            <IconButton
              className={[
                "size-11",
                shareOpen ? "text-[var(--gc-blue)]" : "",
              ].join(" ")}
              disabled={!onShareToChat}
              label="Compartilhar"
              onClick={() => setShareOpen((value) => !value)}
            >
              <Send size={18} strokeWidth={2.4} />
            </IconButton>
          </div>
          {post.workoutType ? (
            <span className="rounded-full bg-white/[0.06] px-3 py-2 text-[12px] font-bold text-white/72">
              {post.workoutType}
            </span>
          ) : null}
        </div>

        {shareOpen ? (
          <div className="gc-screen-enter rounded-[24px] border border-white/[0.08] bg-white/[0.045] p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-black text-white">Enviar para</p>
              <button
                className="gc-pressable text-[12px] font-black text-white/42"
                onClick={() => setShareOpen(false)}
                type="button"
              >
                Fechar
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

        {!isPostOwner || post.likesCount > 0 || post.likedByCurrentUser ? (
          <div className="flex items-center gap-2">
            {isPostOwner && likeSummary ? (
              <>
                <div className="flex -space-x-2">
                  {post.likedByPreview.map((user) => (
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
                <button
                  className="gc-pressable min-w-0 flex-1 truncate text-left text-[12px] font-bold text-white/58"
                  onClick={() => onOpenLikes?.(post.id)}
                  type="button"
                >
                  {likeSummary}
                </button>
                {post.likedByPreview[0] ? (
                  <StreakBadge
                    isLit={post.likedByPreview[0].streakLitToday}
                    size="xs"
                    streak={post.likedByPreview[0].currentStreak}
                  />
                ) : null}
              </>
            ) : !isPostOwner ? (
              <div className="flex flex-1 items-center gap-2 rounded-full bg-white/[0.045] px-3 py-2">
                <Heart
                  className={post.likedByCurrentUser ? "text-[var(--gc-blue)]" : "text-white/42"}
                  fill={post.likedByCurrentUser ? "currentColor" : "none"}
                  size={14}
                  strokeWidth={2.4}
                />
                <span
                  className={[
                    "text-[12px] font-black",
                    post.likedByCurrentUser ? "text-[var(--gc-blue)]" : "text-white/58",
                  ].join(" ")}
                >
                  {post.likesCount.toLocaleString("pt-BR")}{" "}
                  {post.likesCount === 1 ? "curtida" : "curtidas"}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-full bg-white/[0.045] px-3 py-2">
                <span className="text-[12px] font-bold text-white/44">
                  {post.likesCount > 0
                    ? `${post.likesCount.toLocaleString("pt-BR")} ${
                        post.likesCount === 1 ? "curtida" : "curtidas"
                      }`
                    : "Seja o primeiro a curtir"}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-full bg-white/[0.045] px-3 py-2">
            <span className="text-[12px] font-bold text-white/44">
              Primeiro apoio ainda aberto
            </span>
            <StreakBadge
              isLit={post.author.streakLitToday}
              size="xs"
              streak={post.author.currentStreak}
            />
          </div>
        )}

        <p className="text-[14px] font-semibold leading-5 text-white/82">
          <button
            className="gc-pressable text-white"
            onClick={() => onSelectUser?.(post.author.id)}
            type="button"
          >
            {post.author.username}
          </button>{" "}
          <MentionText
            onSelectUser={onSelectUser}
            resolveUser={resolveUser}
            text={post.caption}
          />
        </p>
        <p className="text-[12px] font-bold text-white/38">
          {commentsCount} comentarios · {post.smartReason.toLowerCase()}
        </p>

        {commentsOpen ? (
          <div className="space-y-3 rounded-[24px] border border-white/[0.06] bg-white/[0.035] p-3">
            {post.commentPreviews.length > 0 ? (
              post.commentPreviews.map((comment) => {
                const commentLikesCount = comment.likesCount ?? 0;
                const commentLiked = Boolean(comment.likedByCurrentUser);
                const canLikeComment =
                  comment.userId !== currentUserId && Boolean(onLikeComment);
                const commentContent = (
                  <div className="flex items-start gap-2 rounded-[18px] px-1 py-1">
                    <div className="min-w-0 flex-1 text-[13px] font-semibold leading-5 text-white/70">
                      <div className="inline-flex min-w-0 items-center gap-1.5 align-middle">
                        <button
                          className="gc-pressable font-black text-white"
                          onClick={() => onSelectUser?.(comment.author.id)}
                          type="button"
                        >
                          {comment.author.username}
                        </button>
                        <StreakBadge
                          isLit={comment.author.streakLitToday}
                          size="xs"
                          streak={comment.author.currentStreak}
                        />
                      </div>{" "}
                      <MentionText
                        onSelectUser={onSelectUser}
                        resolveUser={resolveUser}
                        text={comment.body}
                      />
                    </div>
                    {canLikeComment ? (
                      <button
                        aria-label={
                          commentLiked ? "Remover curtida do comentário" : "Curtir comentário"
                        }
                        className={[
                          "gc-pressable mt-0.5 grid min-h-9 min-w-9 place-items-center rounded-full border border-white/[0.08] bg-black/24",
                          commentLiked
                            ? "text-[var(--gc-blue)] drop-shadow-[0_0_14px_rgba(48,213,255,0.42)]"
                            : "text-white/40",
                        ].join(" ")}
                        onClick={() => onLikeComment?.(post.id, comment.id)}
                        type="button"
                      >
                        <span className="flex items-center gap-1">
                          <Heart
                            fill={commentLiked ? "currentColor" : "none"}
                            size={14}
                            strokeWidth={2.4}
                          />
                          {commentLikesCount > 0 ? (
                            <span className="text-[10px] font-black">
                              {commentLikesCount}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    ) : commentLikesCount > 0 ? (
                      <span className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-full bg-black/20 px-2 text-[10px] font-black text-white/34">
                        <Heart size={12} strokeWidth={2.4} />
                        {commentLikesCount}
                      </span>
                    ) : null}
                  </div>
                );

                if (comment.userId !== currentUserId || !onDeleteComment) {
                  return <div key={comment.id}>{commentContent}</div>;
                }

                return (
                  <SwipeRevealDelete
                    className="rounded-[18px]"
                    contentClassName="rounded-[18px] bg-[#111214]"
                    deleteLabel="Apagar comentário"
                    key={comment.id}
                    onDelete={() => onDeleteComment(post.id, comment.id)}
                    revealWidth={58}
                  >
                    {commentContent}
                  </SwipeRevealDelete>
                );
              })
            ) : (
              <EmptyState
                detail="Comece a conversa com uma mensagem rápida."
                title="Nenhum comentário ainda"
              />
            )}
            <div className="relative">
              {mentionSuggestions.length > 0 ? (
                <div className="absolute inset-x-0 bottom-[calc(100%+8px)] z-20 overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#101214]/96 shadow-[0_18px_52px_rgba(0,0,0,0.46)] backdrop-blur-2xl">
                  {mentionSuggestions.map((user) => (
                    <button
                      className="gc-pressable flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/[0.06]"
                      key={user.id}
                      onClick={() => selectMention(user)}
                      onMouseDown={(event) => event.preventDefault()}
                      type="button"
                    >
                      <Avatar
                        accent={user.accent}
                        name={user.name}
                        size="sm"
                        src={user.avatarUrl ?? undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-black text-white">
                          @{user.username}
                        </p>
                        <p className="truncate text-[11px] font-bold text-white/42">
                          {user.name}
                        </p>
                      </div>
                      <StreakBadge
                        isLit={user.streakLitToday}
                        size="xs"
                        streak={user.currentStreak}
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              <form className="flex items-center gap-2" onSubmit={submitComment}>
                <input
                  className="h-11 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                  onChange={(event) => {
                    setDraft(event.target.value);
                    setCaretIndex(event.target.selectionStart ?? event.target.value.length);
                  }}
                  onClick={updateCaret}
                  onFocus={updateCaret}
                  onKeyUp={updateCaret}
                  placeholder="Comentar..."
                  ref={inputRef}
                  value={draft}
                />
                <button
                  aria-label="Enviar comentário"
                  className="gc-pressable grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black"
                  type="submit"
                >
                  <Send size={17} strokeWidth={2.6} />
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
}
