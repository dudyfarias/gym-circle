"use client";

import Image from "next/image";
import {
  type FormEvent,
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Flag,
  Heart,
  Loader2,
  MoreHorizontal,
  Send,
  Share2,
  Trash2,
  UserMinus,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedStory, EnrichedUser } from "../social/types";
import { formatStoryLikesCount } from "../social/likes";
import { formatStoryAge } from "../social/storyInteractions";
import { hasImageLoaded, markImageLoaded } from "./imageCache";
import { StreakBadge } from "./StreakBadge";

const STORY_DURATION_MS = 5200;
const STORY_SWIPE_THRESHOLD = 54;

type StoryViewerProps = {
  story: EnrichedStory | null;
  currentUserId?: string;
  shareTargets?: EnrichedUser[];
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSelectUser?: (userId: string) => void;
  onReplyStory?: (storyId: string, body: string) => Promise<void> | void;
  onLikeStory?: (storyId: string) => Promise<void> | void;
  onShareStoryToChat?: (storyId: string, receiverId: string) => Promise<void> | void;
  onDeleteStory?: (storyId: string) => Promise<void> | void;
  onReportStory?: (storyId: string, authorId: string) => Promise<void> | void;
  onMuteStoryAuthor?: (authorId: string) => Promise<void> | void;
  onUnfollowUser?: (authorId: string) => Promise<void> | void;
  hasNext?: boolean;
  hasPrevious?: boolean;
};

type ActiveStoryViewerProps = Omit<StoryViewerProps, "story"> & {
  story: EnrichedStory;
};

export function StoryViewer(props: StoryViewerProps) {
  if (!props.story) {
    return null;
  }

  // Sprint 1 v1.1.1 B2: sem key={story.id} pro StoryViewerContent.
  // Antes forçava re-mount a cada story change, destruindo o <img> e
  // re-decodificando do zero — causava flicker visível entre stories
  // cross-author. Agora mantemos o DOM e usamos useEffect lá dentro
  // pra resetar state local + pre-decode swap (decode JS antes do
  // src trocar visualmente).
  return <StoryViewerContent {...props} story={props.story} />;
}

function StoryViewerContent({
  story,
  currentUserId,
  shareTargets = [],
  onClose,
  onNext,
  onPrevious,
  onSelectUser,
  onReplyStory,
  onLikeStory,
  onShareStoryToChat,
  onDeleteStory,
  onReportStory,
  onMuteStoryAuthor,
  onUnfollowUser,
  hasNext = false,
  hasPrevious = false,
}: ActiveStoryViewerProps) {
  const { t } = useTranslation();
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [liking, setLiking] = useState(false);
  const [heartBurst, setHeartBurst] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharingToUserId, setSharingToUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  // Sprint 2.3: crossfade da imagem da story. Init com hasImageLoaded
  // pra render instant em re-mounts (cache da sessão).
  const [mediaLoaded, setMediaLoaded] = useState(() =>
    hasImageLoaded(story.imageUrl),
  );

  // Sprint 1 v1.1.1 B2: sem re-mount entre stories → state local
  // persiste por default. Resetamos manualmente o que precisa zerar
  // quando a story muda (replyDraft, menus abertos, flags transitórias).
  // `mediaLoaded` segue cache da sessão (hasImageLoaded).
  //
  // Sprint 16: o reset agora roda DURANTE o render (padrão React
  // "adjusting state when props change") em vez de useEffect — o effect
  // rodava DEPOIS do paint, então ao avançar de story havia 1 frame com
  // o estado da story ANTERIOR (draft, coração, menu, mediaLoaded stale)
  // por cima da nova — provável raiz dos glitches relatados no viewer.
  const storyKey = `${story.id}|${story.imageUrl}`;
  const [prevStoryKey, setPrevStoryKey] = useState(storyKey);
  if (storyKey !== prevStoryKey) {
    setPrevStoryKey(storyKey);
    setReplyDraft("");
    setSendingReply(false);
    setLiking(false);
    setHeartBurst(false);
    setMenuOpen(false);
    setShareOpen(false);
    setSharingToUserId(null);
    setCopied(false);
    setInputFocused(false);
    setMediaLoaded(hasImageLoaded(story.imageUrl));
  }

  // Sprint 1 v1.1.1 B2: pre-decode swap. Decode JS via HTMLImageElement.decode()
  // ANTES de marcar mediaLoaded — quando o <Image> do Next pinta com a nova src,
  // ela já está pronta no cache do browser, swap visual é instantâneo (sem flash).
  // Skippa se mediaType === 'video' (video tem fluxo próprio via poster).
  useEffect(() => {
    if (!story.imageUrl || story.mediaType === "video") return;
    if (hasImageLoaded(story.imageUrl)) return;
    let cancelled = false;
    const img = new window.Image();
    img.src = story.imageUrl;
    img
      .decode()
      .then(() => {
        if (cancelled) return;
        markImageLoaded(story.imageUrl);
        setMediaLoaded(true);
      })
      .catch(() => {
        // Decode falhou (CORS, formato exótico). onLoad do <Image>
        // ainda vai disparar com o fallback comum — sem regredir UX.
      });
    return () => {
      cancelled = true;
    };
  }, [story.imageUrl, story.mediaType]);

  const isOwner = Boolean(story && currentUserId === story.userId);
  const isInteracting =
    inputFocused || menuOpen || shareOpen || sendingReply || sharingToUserId !== null;

  const storyUrl = useMemo(() => {
    if (!story || typeof window === "undefined") return "";
    return `${window.location.origin}/?story=${story.id}`;
  }, [story]);

  const goNext = useCallback(() => {
    if (hasNext) {
      onNext?.();
      return;
    }
    onClose();
  }, [hasNext, onClose, onNext]);

  const goPrevious = useCallback(() => {
    if (hasPrevious) onPrevious?.();
  }, [hasPrevious, onPrevious]);

  useEffect(() => {
    if (!story || isInteracting) return;

    const timeout = window.setTimeout(goNext, STORY_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [goNext, isInteracting, story]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch?.clientX ?? null;
    touchStartYRef.current = touch?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      if (!touch || startX === null || startY === null) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (
        Math.abs(deltaX) < STORY_SWIPE_THRESHOLD ||
        Math.abs(deltaX) < Math.abs(deltaY) * 1.15
      ) {
        return;
      }

      suppressClickRef.current = true;
      if (deltaX < 0) goNext();
      else goPrevious();
    },
    [goNext, goPrevious],
  );

  const handleViewerClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("button,a,video,input,form,[data-gc-story-control]")
      ) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < rect.width * 0.36) goPrevious();
      else goNext();
    },
    [goNext, goPrevious],
  );

  const handleReply = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!story || isOwner || !replyDraft.trim() || sendingReply) return;
      setSendingReply(true);
      try {
        await onReplyStory?.(story.id, replyDraft.trim());
        setReplyDraft("");
      } finally {
        setSendingReply(false);
      }
    },
    [isOwner, onReplyStory, replyDraft, sendingReply, story],
  );

  const handleLike = useCallback(async () => {
    if (!story || isOwner || liking) return;
    setLiking(true);
    if (!story.likedByCurrentUser) {
      setHeartBurst(true);
      window.setTimeout(() => setHeartBurst(false), 480);
    }
    try {
      await onLikeStory?.(story.id);
    } finally {
      setLiking(false);
    }
  }, [isOwner, liking, onLikeStory, story]);

  const copyStoryLink = useCallback(async () => {
    if (!storyUrl) return;
    await navigator.clipboard?.writeText(storyUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }, [storyUrl]);

  const nativeShare = useCallback(async () => {
    if (!story || !storyUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: t("storyViewer.share.nativeTitle", { name: story.author.name }),
        text: t("storyViewer.share.nativeText", { username: story.author.username }),
        url: storyUrl,
      });
      return;
    }
    await copyStoryLink();
  }, [copyStoryLink, story, storyUrl, t]);

  const shareToUser = useCallback(
    async (userId: string) => {
      if (!story || sharingToUserId) return;
      setSharingToUserId(userId);
      try {
        await onShareStoryToChat?.(story.id, userId);
        setShareOpen(false);
      } finally {
        setSharingToUserId(null);
      }
    },
    [onShareStoryToChat, sharingToUserId, story],
  );

  const deleteStory = useCallback(async () => {
    if (!story) return;
    await onDeleteStory?.(story.id);
  }, [onDeleteStory, story]);

  const reportStory = useCallback(async () => {
    if (!story) return;
    await onReportStory?.(story.id, story.author.id);
    setMenuOpen(false);
  }, [onReportStory, story]);

  const muteStoryAuthor = useCallback(async () => {
    if (!story) return;
    await onMuteStoryAuthor?.(story.author.id);
    setMenuOpen(false);
  }, [onMuteStoryAuthor, story]);

  const unfollowUser = useCallback(async () => {
    if (!story) return;
    await onUnfollowUser?.(story.author.id);
    setMenuOpen(false);
    onClose();
  }, [onClose, onUnfollowUser, story]);

  return (
    <div
      className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl"
      data-gc-no-screen-swipe
    >
      <div
        className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] shadow-[0_28px_72px_rgba(0,0,0,0.7)]"
        onClick={handleViewerClick}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
        style={{
          // Sprint 2.3: fundo blur + solid fallback. Quando a story tem
          // blurDataUrl, o blur cobre o gap visual durante o decode da
          // mídia HQ. Senão, solid #090A0B (tema dark) — NUNCA tela
          // preta vazia.
          backgroundColor: "#090A0B",
          ...(story.blurDataUrl
            ? {
                backgroundImage: `url(${story.blurDataUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}),
        }}
      >
        <div className="absolute inset-x-4 top-3 z-20 h-1 overflow-hidden rounded-full bg-white/18">
          <div
            className="h-full rounded-full bg-white"
            key={story.id}
            style={{ animation: "gc-story-progress 5.2s linear both" }}
          />
        </div>

        {story.mediaType === "video" ? (
          <video
            // Story plays automatically. Começa muted para garantir auto-play
            // em qualquer browser; o user pode dar tap pra ativar som
            // (handled em outro lugar quando implementar mute toggle).
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            loop
            muted
            playsInline
            poster={story.posterUrl ?? story.thumbnailUrl ?? undefined}
            preload="metadata"
            src={story.imageUrl}
          />
        ) : (
          <Image
            alt={story.title}
            className="object-cover"
            fill
            priority
            sizes="(max-width: 480px) 100vw, 480px"
            src={story.imageUrl}
            onLoad={() => {
              markImageLoaded(story.imageUrl);
              setMediaLoaded(true);
            }}
            style={{
              // Sprint 2.3: crossfade — opacity 0 enquanto decode, 1
              // quando onLoad dispara. Background blur do container já
              // cobre o gap visual.
              opacity: mediaLoaded ? 1 : 0,
              transition: "opacity 280ms var(--gc-ease-ios, ease-out)",
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/72 via-transparent to-black/86" />

        {heartBurst ? (
          <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
            <Heart
              className="gc-heart-pop text-[var(--gc-blue)] drop-shadow-[0_0_32px_rgba(48,213,255,0.65)]"
              fill="currentColor"
              size={96}
              strokeWidth={2.4}
            />
          </div>
        ) : null}

        <div className="relative z-10 flex items-center justify-between gap-3 p-5 pt-7">
          <button
            className="gc-pressable flex min-w-0 items-center gap-3 text-left"
            onClick={(event) => {
              event.stopPropagation();
              onSelectUser?.(story.author.id);
            }}
            type="button"
          >
            <Avatar
              accent={story.author.accent}
              name={story.author.name}
              src={story.author.avatarUrl ?? undefined}
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-[15px] font-black">{story.author.username}</p>
                <span className="shrink-0 text-[12px] font-black text-white/52">
                  {formatStoryAge(story.createdAt)}
                </span>
                <StreakBadge
                  isLit={story.author.streakLitToday}
                  size="xs"
                  streak={story.author.currentStreak}
                />
              </div>
              <p className="truncate text-[12px] font-bold text-white/52">
                {story.caption}
              </p>
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-2" data-gc-story-control>
            <button
              aria-label={t("storyViewer.header.menuAria")}
              className="gc-pressable grid size-11 place-items-center rounded-full bg-black/46 text-white backdrop-blur-xl"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((value) => !value);
                setShareOpen(false);
              }}
              type="button"
            >
              <MoreHorizontal size={19} />
            </button>
            <button
              aria-label={t("storyViewer.header.closeAria")}
              className="gc-pressable grid size-11 place-items-center rounded-full bg-black/46 text-white backdrop-blur-xl"
              onClick={(event) => {
                event.stopPropagation();
                onClose();
              }}
              type="button"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <StoryOptionsMenu
            isOwner={isOwner}
            onCancel={() => setMenuOpen(false)}
            onDelete={deleteStory}
            onMute={muteStoryAuthor}
            onReport={reportStory}
            onUnfollow={unfollowUser}
          />
        ) : null}

        <div className="relative z-10 mt-auto space-y-4 p-5 pb-5">
          <div>
            <p className="text-[13px] font-black uppercase text-white/48">
              {t(story.kind === "checkin" ? "storyViewer.kind.checkin" : "storyViewer.kind.workout")}
            </p>
            <h2 className="mt-1 text-[30px] font-black leading-tight">{story.title}</h2>
          </div>

          {shareOpen ? (
            <div
              className="rounded-[28px] border border-white/[0.08] bg-black/58 p-3 backdrop-blur-2xl"
              data-gc-story-control
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-black uppercase text-white/44">
                  {t("storyViewer.share.sheetTitle")}
                </p>
                <button
                  className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.08] text-white/72"
                  onClick={() => setShareOpen(false)}
                  type="button"
                >
                  <X size={15} />
                </button>
              </div>
              {shareTargets.length > 0 ? (
                <div className="gc-scrollbar mt-3 flex gap-3 overflow-x-auto pb-1">
                  {shareTargets.slice(0, 10).map((user) => (
                    <button
                      className="gc-pressable w-[64px] shrink-0 text-center disabled:opacity-55"
                      disabled={sharingToUserId === user.id}
                      key={user.id}
                      onClick={() => shareToUser(user.id)}
                      type="button"
                    >
                      <div className="mx-auto grid size-12 place-items-center rounded-full bg-white/[0.08] p-[2px]">
                        <Avatar
                          accent={user.accent}
                          name={user.name}
                          size="md"
                          src={user.avatarUrl ?? undefined}
                        />
                      </div>
                      <p className="mt-1 truncate text-[10px] font-black text-white/54">
                        {sharingToUserId === user.id ? "..." : user.name.split(" ")[0]}
                      </p>
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <StoryActionButton
                  icon={<Share2 size={16} />}
                  label={t("storyViewer.share.system")}
                  onClick={nativeShare}
                />
                <StoryActionButton
                  icon={<Copy size={16} />}
                  label={copied ? t("storyViewer.share.copied") : t("storyViewer.share.copy")}
                  onClick={copyStoryLink}
                />
              </div>
            </div>
          ) : null}

          <div
            className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
            data-gc-story-control
          >
            {isOwner ? (
              <div className="flex h-12 items-center rounded-full border border-white/[0.1] bg-black/38 px-4 text-[13px] font-black text-white/64 backdrop-blur-2xl">
                {t("storyViewer.owner.label", {
                  likes: formatStoryLikesCount(story.likesCount),
                })}
              </div>
            ) : (
              <form
                className="flex h-12 min-w-0 items-center rounded-full border border-white/[0.12] bg-black/38 px-3 backdrop-blur-2xl"
                onSubmit={handleReply}
              >
                <input
                  className="h-full min-w-0 flex-1 bg-transparent px-2 text-[14px] font-bold text-white outline-none placeholder:text-white/48"
                  disabled={sendingReply}
                  onBlur={() => setInputFocused(false)}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  onFocus={() => setInputFocused(true)}
                  placeholder={t("storyViewer.reply.placeholder")}
                  value={replyDraft}
                />
                {replyDraft.trim() ? (
                  <button
                    aria-label={t("storyViewer.reply.sendAria")}
                    className="gc-pressable grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black disabled:opacity-50"
                    disabled={sendingReply}
                    type="submit"
                  >
                    {sendingReply ? <Loader2 className="animate-spin" size={15} /> : <Send size={15} />}
                  </button>
                ) : null}
              </form>
            )}
            <button
              aria-label={t("storyViewer.actions.likeAria")}
              className={[
                "gc-pressable grid size-12 place-items-center rounded-full border backdrop-blur-2xl disabled:opacity-60",
                story.likedByCurrentUser
                  ? "border-[var(--gc-blue)]/34 bg-[var(--gc-blue)]/14 text-[var(--gc-blue)] shadow-[0_0_24px_rgba(48,213,255,0.42)]"
                  : "border-white/[0.1] bg-black/38 text-white",
              ].join(" ")}
              disabled={isOwner || liking}
              onClick={handleLike}
              type="button"
            >
              {liking ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <Heart
                  fill={story.likedByCurrentUser ? "currentColor" : "none"}
                  size={19}
                  strokeWidth={2.4}
                />
              )}
            </button>
            <button
              aria-label={t("storyViewer.actions.shareAria")}
              className="gc-pressable grid size-12 place-items-center rounded-full border border-white/[0.1] bg-black/38 text-white backdrop-blur-2xl"
              onClick={() => {
                setShareOpen((value) => !value);
                setMenuOpen(false);
              }}
              type="button"
            >
              <Share2 size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StoryOptionsMenu({
  isOwner,
  onCancel,
  onDelete,
  onMute,
  onReport,
  onUnfollow,
}: {
  isOwner: boolean;
  onCancel: () => void;
  onDelete: () => void | Promise<void>;
  onMute: () => void | Promise<void>;
  onReport: () => void | Promise<void>;
  onUnfollow: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="absolute right-4 top-[88px] z-30 w-[224px] overflow-hidden rounded-[26px] border border-white/[0.1] bg-[#151719]/92 p-1 shadow-[0_24px_70px_rgba(0,0,0,0.52)] backdrop-blur-2xl"
      data-gc-story-control
    >
      {isOwner ? (
        <MenuButton
          danger
          icon={<Trash2 size={16} />}
          label={t("storyViewer.menu.deleteStory")}
          onClick={onDelete}
        />
      ) : (
        <>
          <MenuButton
            icon={<Flag size={16} />}
            label={t("storyViewer.menu.reportStory")}
            onClick={onReport}
          />
          <MenuButton
            icon={<VolumeX size={16} />}
            label={t("storyViewer.menu.muteUser")}
            onClick={onMute}
          />
          <MenuButton
            icon={<UserMinus size={16} />}
            label={t("storyViewer.menu.unfollow")}
            onClick={onUnfollow}
          />
        </>
      )}
      <MenuButton icon={<X size={16} />} label={t("common.cancel")} onClick={onCancel} />
    </div>
  );
}

function MenuButton({
  danger = false,
  icon,
  label,
  onClick,
}: {
  danger?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      className={[
        "gc-pressable flex h-11 w-full items-center gap-2 rounded-[20px] px-3 text-left text-[13px] font-black",
        danger ? "text-[var(--gc-pink)]" : "text-white/78 hover:bg-white/[0.06]",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function StoryActionButton({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      className="gc-pressable flex h-11 items-center justify-center gap-2 rounded-full bg-white/[0.08] text-[12px] font-black text-white"
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
