"use client";

import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SocialPostCard } from "./design-system";
import type { EnrichedPost, EnrichedUser, WorkoutDetail } from "./social/types";

/**
 * PostDetailOverlay — Sprint 5.11.
 *
 * Fix de UX reportado pelo user no smoke iPhone:
 *
 *   "Quando clico em uma foto no meu perfil aparece o mesmo overlay
 *    dos comentários e não leva para uma pagina só do post,
 *    tem que ser igual no instagram."
 *
 * Histórico: na Sprint 3.3 o `PostDetailSheet` foi substituído por
 * `CommentsBottomSheet` pra que o tap no ÍCONE de comentários parasse
 * de abrir o post inteiro. Lateral effect: o tap na FOTO do grid do
 * perfil também passou a abrir só comentários — e isso é errado.
 *
 * Solução: separar os 2 estados.
 *   - `postDetailId` → CommentsBottomSheet (tap no ícone 💬 no feed)
 *   - `postDetailFullId` → PostDetailOverlay (tap em foto no grid)
 *
 * Layout (mobile-first, estilo Instagram nativo):
 *   - Backdrop blur escuro full-screen
 *   - Header sticky com ← (close) + "Post"
 *   - Body scrollable com `SocialPostCard` renderizado inteiro
 *   - Quando o user toca em "Comentários" dentro do post, abre o
 *     CommentsBottomSheet por cima — z-index maior que do overlay.
 *
 * Performance: overlay é dynamic-imported no GymCirclePreview, então
 * só carrega quando o user abre o primeiro post. Card reusa SocialPostCard
 * que já tem PinchZoomImage + LRU media cache.
 */

type PostDetailOverlayProps = {
  open: boolean;
  post: EnrichedPost | null;
  currentUser: EnrichedUser;
  formatTime: (createdAt: string) => string;
  shareTargets?: EnrichedUser[];
  resolveUser?: (username: string) => { id: string } | undefined;
  onClose: () => void;
  onLikePost: (postId: string) => void;
  onOpenComments: (postId: string) => void;
  onOpenLikes: (postId: string) => void;
  onOpenPostMenu: (postId: string) => void;
  onEditPost: (postId: string) => void;
  onOpenWorkoutDetail: (workout: WorkoutDetail) => void;
  onSelectUser: (userId: string) => void;
  onSharePostToChat?: (postId: string, receiverId: string) => Promise<void> | void;
  onToggleFollow: (userId: string) => void;
};

export function PostDetailOverlay({
  open,
  post,
  currentUser,
  formatTime,
  shareTargets,
  resolveUser,
  onClose,
  onLikePost,
  onOpenComments,
  onOpenLikes,
  onOpenPostMenu,
  onEditPost,
  onOpenWorkoutDetail,
  onSelectUser,
  onSharePostToChat,
  onToggleFollow,
}: PostDetailOverlayProps) {
  const { t } = useTranslation();

  // Defensive: se o post sumiu (apagado em outra session) e o overlay tá
  // aberto, fecha automaticamente em vez de mostrar tela em branco.
  if (!open || !post) return null;

  return (
    <div
      aria-hidden={!open}
      className={[
        "absolute inset-0 z-[72] flex flex-col bg-[#0a0b0c] transition-opacity duration-200",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      role="dialog"
      aria-modal="true"
      aria-label={t("postDetail.title")}
    >
      {/* Header sticky com ← close + título "Post" */}
      <header className="grid shrink-0 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/[0.06] px-3 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button
          aria-label={t("common.close")}
          className="gc-pressable grid size-10 place-items-center rounded-full bg-white/[0.06] text-white"
          onClick={onClose}
          type="button"
        >
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>
        <h2 className="truncate text-[15px] font-black text-white">
          {t("postDetail.title")}
        </h2>
        <div className="size-10" /> {/* spacer pra balancear grid */}
      </header>

      {/* Body scrollable — SocialPostCard renderiza foto + caption + likes
          + comentários preview + ações. Tap em "Comentários" abre o
          CommentsBottomSheet por cima (z-index maior). */}
      <div className="gc-scrollbar flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-[480px] px-3 py-4">
          <SocialPostCard
            currentUserId={currentUser.id}
            formatTime={formatTime}
            onLike={onLikePost}
            onOpenComments={onOpenComments}
            onEditPost={onEditPost}
            onOpenLikes={onOpenLikes}
            onOpenPostMenu={onOpenPostMenu}
            onOpenWorkoutDetail={onOpenWorkoutDetail}
            onSelectUser={onSelectUser}
            onShareToChat={onSharePostToChat}
            onToggleFollow={onToggleFollow}
            post={post}
            resolveUser={resolveUser}
            shareTargets={shareTargets}
          />
        </div>
      </div>
    </div>
  );
}
