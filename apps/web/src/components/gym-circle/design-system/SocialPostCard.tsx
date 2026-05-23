"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeLocationLabel } from "@gym-circle/core";
import {
  Heart,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Send,
  Video,
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
import type { EnrichedPost, EnrichedUser } from "../social/types";
import { PinchZoomImage } from "./PinchZoomImage";
import { StreakBadge } from "./StreakBadge";

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
  resolveUser?: (username: string) => { id: string } | undefined;
  shareTargets?: EnrichedUser[];
  /** Abre o menu contextual: editar/apagar se for dono, denunciar/bloquear se for visitante. */
  onOpenPostMenu?: (postId: string) => void;
  onOpenLikes?: (postId: string) => void;
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

export function SocialPostCard({
  post,
  currentUserId,
  formatTime,
  onLike,
  onOpenComments,
  onShareToChat,
  onSelectUser,
  resolveUser,
  shareTargets = [],
  onOpenPostMenu,
  onOpenLikes,
  inCommentsSheet = false,
}: SocialPostCardProps) {
  // Sprint 3 — Fase 3.4: cleanup final do contrato. As props de comentário
  // (onComment, onDeleteComment, onLikeComment, mentionUsers) foram removidas
  // do type; o sheet em CommentsBottomSheet recebe essas callbacks diretamente
  // de GymCirclePreview. Sprint 5: onToggleFollow aceita mas não destructurada
  // — botão de seguir removido do card.
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [sharingToUserId, setSharingToUserId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const mediaType = post.mediaType ?? "image";
  // Sprint 3.6 bug fix (image quality):
  // - `imagePreviewUrl` = thumbnail 640px → paint imediato no scroll
  //   (combinado com blurDataUrl da Sprint 2.2 = transição super suave).
  // - `imageHqUrl` = imageUrl 1920px → decode em background no
  //   PinchZoomImage, troca quando pronto. Se não houver thumbnail (posts
  //   antigos sem pipeline da 2.4), `imageUrl` já é exibido direto e
  //   `hqSrc` fica `undefined` (no-op).
  const imagePreviewUrl = post.thumbnailUrl ?? post.imageUrl;
  const imageHqUrl =
    post.thumbnailUrl && post.imageUrl !== post.thumbnailUrl
      ? post.imageUrl
      : undefined;
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

  function handleLike() {
    // Haptic light pré-callback pra resposta tátil imediata mesmo se o callback
    // for assíncrono (mock vs Supabase otimista vs erro). Sprint 3 — Fase 3.2.
    simulateHaptic("like");
    onLike(post.id);
  }

  function handleOpenComments() {
    // Sprint 3 — Fase 3.3: abre o CommentsBottomSheet via callback do parent
    // (wire-up em GymCirclePreview.tsx). Não há mais toggle inline.
    simulateHaptic("comment");
    onOpenComments?.(post.id);
  }

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
        {/* Sprint 5 — Botão de seguir REMOVIDO do card.
            Pra seguir, user entra no perfil (tap no nome/avatar) — fluxo
            existente. Decisão de produto do Eduardo: card mais limpo,
            menos CTAs concorrendo. */}
        <div className="flex items-center gap-2">
          {onOpenPostMenu && !inCommentsSheet ? (
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
            blurDataUrl={post.blurDataUrl}
            className="w-full"
            hqSrc={imageHqUrl}
            priority={post.author.username === "edu.fit"}
            sizes="(max-width: 480px) 100vw, 480px"
            src={imagePreviewUrl}
          />
        )}
        {/* Sprint 5 — Streak overlay REMOVIDO. Antes tinha um gradient
            full-width na imagem com o flame chip "X está há N dias treinando"
            + Vídeo chip. Era o elemento mais "loud" do card. Movemos o
            sinal de streak pro StreakBadge xs no header e o badge de vídeo
            vira chip pequeno no canto. Resultado: imagem limpa, foco no
            conteúdo (igual Instagram). */}
        {mediaType === "video" ? (
          <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/56 px-2 py-1 text-[10px] font-black text-white/86 backdrop-blur-md">
            <Video size={11} strokeWidth={2.6} />
            Vídeo
          </div>
        ) : null}
      </div>

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
              label="Curtir"
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
                label="Comentar"
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
                label="Compartilhar"
                onClick={() => setShareOpen((value) => !value)}
              >
                <Send size={18} strokeWidth={2.4} />
              </IconButton>
            ) : null}
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

        {/* Likes summary — Instagram-style. Sprint 3 — Fase 3.2.
            Unifica branches owner/visitor: usa likeSummary ("Curtido por @ana e
            mais N pessoas") quando disponível, com fallback de contador puro.
            Clicável apenas pelo owner (UX existente — apenas o dono vê o sheet
            com lista completa). */}
        {post.likesCount > 0 ? (() => {
          const summaryText =
            likeSummary ??
            `${post.likesCount.toLocaleString("pt-BR")} ${
              post.likesCount === 1 ? "curtida" : "curtidas"
            }`;
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
            Seja o primeiro a curtir
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
                  aria-label="Expandir legenda"
                  className="gc-pressable text-[13px] font-semibold text-white/52"
                  onClick={() => setCaptionExpanded(true)}
                  type="button"
                >
                  mais
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
              aria-label={`Comentário de ${preview.author.username}: ${preview.body}`}
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
            {commentsCount === 1
              ? "Ver 1 comentário"
              : `Ver todos os ${commentsCount.toLocaleString("pt-BR")} comentários`}
          </button>
        ) : null}
      </div>
    </article>
  );
}
