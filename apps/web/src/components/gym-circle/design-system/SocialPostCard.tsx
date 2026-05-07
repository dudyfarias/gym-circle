"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import {
  Flame,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Send,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { IconButton } from "@/components/ui/IconButton";
import type { EnrichedPost } from "../social/types";
import { EmptyState } from "./EmptyState";
import { StreakBadge } from "./StreakBadge";

type SocialPostCardProps = {
  post: EnrichedPost;
  currentUserId: string;
  formatTime: (createdAt: string) => string;
  onLike: (postId: string) => void;
  onComment: (postId: string, body: string) => void;
  onToggleFollow: (userId: string) => void;
};

export function SocialPostCard({
  post,
  currentUserId,
  formatTime,
  onLike,
  onComment,
  onToggleFollow,
}: SocialPostCardProps) {
  const [commentsOpen, setCommentsOpen] = useState(post.comments.length > 0);
  const [draft, setDraft] = useState("");
  const canFollow = post.author.id !== currentUserId;

  function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.trim()) {
      return;
    }

    onComment(post.id, draft);
    setDraft("");
    setCommentsOpen(true);
  }

  return (
    <article className="gc-screen-enter overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0c0d0e] shadow-[0_24px_64px_rgba(0,0,0,0.48)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar accent={post.author.accent} name={post.author.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[15px] font-black">{post.author.name}</h2>
              <StreakBadge
                best={post.author.longestStreak}
                isLit={post.author.streakLitToday}
                size="xs"
                streak={post.author.currentStreak}
              />
            </div>
            <p className="truncate text-[12px] font-bold text-white/46">
              {post.gymName} · {formatTime(post.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canFollow ? (
            <button
              aria-label={
                post.author.isFollowing
                  ? `Seguindo ${post.author.name}`
                  : `Seguir ${post.author.name}`
              }
              className={[
                "gc-pressable grid size-10 place-items-center rounded-full",
                post.author.isFollowing
                  ? "bg-white text-black"
                  : "bg-[var(--gc-brand)] text-black",
              ].join(" ")}
              onClick={() => onToggleFollow(post.author.id)}
              title={post.author.isFollowing ? "Seguindo" : "Seguir"}
              type="button"
            >
              {post.author.isFollowing ? <UserCheck size={17} /> : <UserPlus size={17} />}
            </button>
          ) : null}
          <IconButton className="size-10" label="Mais opções">
            <MoreHorizontal size={18} />
          </IconButton>
        </div>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
        <Image
          alt={`Treino de ${post.author.name}`}
          className="object-cover"
          fill
          priority={post.author.username === "edu.fit"}
          sizes="(max-width: 480px) 100vw, 480px"
          src={post.imageUrl}
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/84 via-black/18 to-transparent p-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/48 px-3 py-2 text-[12px] font-black backdrop-blur-xl">
            <Flame
              size={15}
              className="text-[var(--gc-consistency-daily)]"
              fill="currentColor"
            />
            {post.author.name} esta ha {post.streakAtPost} dias treinando
          </div>
        </div>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <IconButton
              className={[
                "size-11",
                post.likedByCurrentUser ? "gc-heart-pop text-[var(--gc-pink)]" : "",
              ].join(" ")}
              label="Curtir"
              onClick={() => onLike(post.id)}
            >
              <Heart
                fill={post.likedByCurrentUser ? "currentColor" : "none"}
                size={19}
                strokeWidth={2.4}
              />
            </IconButton>
            <IconButton
              className="size-11"
              label="Comentar"
              onClick={() => setCommentsOpen((value) => !value)}
            >
              <MessageCircle size={19} strokeWidth={2.4} />
            </IconButton>
            <IconButton className="size-11" label="Compartilhar">
              <Send size={18} strokeWidth={2.4} />
            </IconButton>
          </div>
          <span className="rounded-full bg-white/[0.06] px-3 py-2 text-[12px] font-bold text-white/72">
            {post.workoutType}
          </span>
        </div>

        {post.likesCount > 0 || post.likedByCurrentUser ? (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {post.likedByPreview.map((user) => (
                <div
                  className="rounded-full border-2 border-[#0c0d0e]"
                  key={user.id}
                  title={user.name}
                >
                  <Avatar accent={user.accent} name={user.name} size="sm" />
                </div>
              ))}
            </div>
            <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-white/58">
              Curtido por{" "}
              <span className="text-white">
                {post.likedByPreview[0]?.username ?? "seu circle"}
              </span>{" "}
              e {post.likesCount.toLocaleString("pt-BR")} pessoas
            </p>
            {post.likedByPreview[0] ? (
              <StreakBadge
                isLit={post.likedByPreview[0].streakLitToday}
                size="xs"
                streak={post.likedByPreview[0].currentStreak}
              />
            ) : null}
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
          <span className="text-white">{post.author.username}</span> {post.caption}
        </p>
        <p className="text-[12px] font-bold text-white/38">
          {post.comments.length} comentarios · {post.smartReason.toLowerCase()}
        </p>

        {commentsOpen ? (
          <div className="space-y-3 rounded-[24px] border border-white/[0.06] bg-white/[0.035] p-3">
            {post.commentPreviews.length > 0 ? (
              post.commentPreviews.map((comment) => (
                <div className="text-[13px] font-semibold leading-5 text-white/70" key={comment.id}>
                  <div className="inline-flex min-w-0 items-center gap-1.5 align-middle">
                    <span className="font-black text-white">{comment.author.username}</span>
                    <StreakBadge
                      isLit={comment.author.streakLitToday}
                      size="xs"
                      streak={comment.author.currentStreak}
                    />
                  </div>{" "}
                  {comment.body}
                </div>
              ))
            ) : (
              <EmptyState
                detail="Comece a conversa com uma mensagem rapida."
                title="Nenhum comentario ainda"
              />
            )}
            <form className="flex items-center gap-2" onSubmit={submitComment}>
              <input
                className="h-11 min-w-0 flex-1 rounded-full border border-white/[0.08] bg-black/40 px-4 text-[14px] font-bold text-white outline-none placeholder:text-white/28"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Comentar..."
                value={draft}
              />
              <button
                aria-label="Enviar comentario"
                className="gc-pressable grid size-11 place-items-center rounded-full bg-[var(--gc-brand)] text-black"
                type="submit"
              >
                <Send size={17} strokeWidth={2.6} />
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </article>
  );
}
