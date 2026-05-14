"use client";

import { X } from "lucide-react";
import { SocialPostCard } from "./design-system";
import type { EnrichedPost, EnrichedUser } from "./social/types";

type PostDetailSheetProps = {
  currentUserId: string;
  formatTime: (createdAt: string) => string;
  onClose: () => void;
  onCommentPost: (postId: string, body: string) => void | Promise<void>;
  onDeleteComment?: (postId: string, commentId: string) => void | Promise<void>;
  onLikeComment?: (postId: string, commentId: string) => void | Promise<void>;
  onSharePostToChat?: (postId: string, receiverId: string) => Promise<void> | void;
  onLikePost: (postId: string) => void | Promise<void>;
  onOpenLikes?: (postId: string) => void;
  onOpenPostMenu?: (postId: string) => void;
  onSelectUser?: (userId: string) => void;
  onToggleFollow: (userId: string) => void | Promise<void>;
  open: boolean;
  post: EnrichedPost | null;
  resolveUser?: (username: string) => { id: string } | undefined;
  mentionUsers?: EnrichedUser[];
  shareTargets?: EnrichedUser[];
};

export function PostDetailSheet({
  currentUserId,
  formatTime,
  onClose,
  onCommentPost,
  onDeleteComment,
  onLikeComment,
  onSharePostToChat,
  onLikePost,
  onOpenLikes,
  onOpenPostMenu,
  onSelectUser,
  onToggleFollow,
  open,
  post,
  resolveUser,
  mentionUsers = [],
  shareTargets = [],
}: PostDetailSheetProps) {
  if (!open || !post) return null;

  return (
    <div className="gc-safe-overlay absolute inset-0 z-[65] bg-black/96 backdrop-blur-2xl">
      <div className="mx-auto flex h-full max-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-black">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.07] bg-black/84 px-4 py-3 backdrop-blur-2xl">
          <div className="min-w-0">
            <p className="truncate text-[17px] font-black text-white">Publicação</p>
            <p className="truncate text-[12px] font-bold text-white/46">
              @{post.author.username}
            </p>
          </div>
          <button
            aria-label="Fechar publicação"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>
        <div className="gc-scrollbar flex-1 overflow-y-auto px-3 py-4 pb-6">
          <SocialPostCard
            currentUserId={currentUserId}
            formatTime={formatTime}
            onComment={(postId, body) => {
              void onCommentPost(postId, body);
            }}
            onDeleteComment={
              onDeleteComment
                ? (postId, commentId) => {
                    void onDeleteComment(postId, commentId);
                  }
                : undefined
            }
            onLikeComment={
              onLikeComment
                ? (postId, commentId) => {
                    void onLikeComment(postId, commentId);
                  }
                : undefined
            }
            onLike={(postId) => {
              void onLikePost(postId);
            }}
            onOpenLikes={onOpenLikes}
            onOpenPostMenu={onOpenPostMenu}
            onSelectUser={onSelectUser}
            onShareToChat={onSharePostToChat}
            onToggleFollow={(userId) => {
              void onToggleFollow(userId);
            }}
            mentionUsers={mentionUsers}
            post={post}
            resolveUser={resolveUser}
            shareTargets={shareTargets}
          />
        </div>
      </div>
    </div>
  );
}
