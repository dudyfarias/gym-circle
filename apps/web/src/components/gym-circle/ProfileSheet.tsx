"use client";

import Image from "next/image";
import {
  Ban,
  CheckCircle2,
  Clock3,
  Flag,
  Lock,
  MessageCircle,
  Play,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import {
  LatestPostPreview,
  ProfileHeader,
  VideoThumbnail,
} from "./design-system";
import type { EnrichedPost, EnrichedUser } from "./social/types";

type ProfileSheetProps = {
  open: boolean;
  user: EnrichedUser | null;
  posts: EnrichedPost[];
  currentUserId: string;
  onClose: () => void;
  onToggleFollow: (userId: string) => void | Promise<void>;
  onMessageUser?: (userId: string) => void;
  onBlockUser?: (userId: string) => void | Promise<void>;
  onReportUser?: (userId: string) => void | Promise<void>;
  onOpenPost?: (postId: string) => void;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
};

type FollowCtaState = {
  label: string;
  tone: "brand" | "white" | "muted";
  Icon: typeof UserPlus;
};

function getFollowCta(user: EnrichedUser): FollowCtaState {
  switch (user.followStatus) {
    case "accepted":
      return { label: "Seguindo", tone: "white", Icon: UserCheck };
    case "pending":
      return { label: "Solicitação enviada", tone: "muted", Icon: Clock3 };
    case "none":
    default:
      return user.isPrivate
        ? { label: "Solicitar para seguir", tone: "brand", Icon: Lock }
        : { label: "Seguir", tone: "brand", Icon: UserPlus };
  }
}

export function ProfileSheet({
  open,
  user,
  posts,
  currentUserId,
  onClose,
  onToggleFollow,
  onMessageUser,
  onBlockUser,
  onReportUser,
  onOpenPost,
  hasStory,
  storyViewed,
  onOpenStory,
}: ProfileSheetProps) {
  if (!open || !user) return null;

  const isMe = user.id === currentUserId;
  const cta = getFollowCta(user);
  const canSeePosts =
    isMe || !user.isPrivate || user.followStatus === "accepted";
  const latestPost = posts[0];
  const headerAvatar = (
    <div className={hasStory ? "rounded-full bg-black p-[2px]" : ""}>
      <Avatar
        accent={user.accent}
        name={user.name}
        src={user.avatarUrl ?? undefined}
      />
    </div>
  );

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 pb-4 pt-[calc(var(--gc-safe-top)+12px)]">
          <div className="flex min-w-0 items-center gap-3">
            {hasStory && onOpenStory ? (
              <button
                aria-label={`Ver story de ${user.name}`}
                className={[
                  "gc-pressable grid size-14 place-items-center rounded-full p-[2px]",
                  storyViewed ? "bg-white/[0.13]" : "gc-story-ring",
                ].join(" ")}
                onClick={onOpenStory}
                type="button"
              >
                {headerAvatar}
              </button>
            ) : (
              <div className="grid size-14 place-items-center">{headerAvatar}</div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[17px] font-black">{user.name}</p>
                {user.isPrivate ? (
                  <Lock
                    aria-label="Perfil privado"
                    className="text-white/52"
                    size={13}
                    strokeWidth={2.6}
                  />
                ) : null}
              </div>
              <p className="truncate text-[12px] font-bold text-white/52">@{user.username}</p>
            </div>
          </div>
          <button
            aria-label="Fechar perfil"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <ProfileHeader
            compact
            hasStory={hasStory}
            onOpenStory={onOpenStory}
            postsCount={posts.length}
            showIdentity={false}
            storyViewed={storyViewed}
            user={user}
          />

          {!isMe ? (
            <div className="mt-3 grid grid-cols-[1fr_1fr_auto_auto] gap-2">
              <button
                className={[
                  "gc-pressable flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-[13px] font-black",
                  cta.tone === "brand"
                    ? "bg-[var(--gc-brand)] text-black"
                    : cta.tone === "white"
                      ? "bg-white text-black"
                      : "border border-white/[0.12] bg-white/[0.04] text-white/72",
                ].join(" ")}
                onClick={() => onToggleFollow(user.id)}
                type="button"
              >
                <cta.Icon className="shrink-0" size={16} />
                <span className="truncate">{cta.label}</span>
              </button>
              <button
                className="gc-pressable flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] px-3 text-[13px] font-black text-white"
                onClick={() => onMessageUser?.(user.id)}
                type="button"
              >
                <MessageCircle className="shrink-0" size={16} />
                <span className="truncate">Mensagem</span>
              </button>
              <button
                aria-label="Denunciar usuário"
                className="gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/62"
                onClick={() => onReportUser?.(user.id)}
                type="button"
              >
                <Flag size={16} />
              </button>
              <button
                aria-label="Bloquear usuário"
                className="gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-[var(--gc-pink)]"
                onClick={() => onBlockUser?.(user.id)}
                type="button"
              >
                <Ban size={16} />
              </button>
            </div>
          ) : null}

          <div className="mt-5">
            {!canSeePosts ? (
              <PrivateLockedNotice latestPost={latestPost} userIsPrivate={user.isPrivate} />
            ) : (
              <>
                <LatestPostPreview post={latestPost} />
                <h3 className="mb-3 mt-5 text-[15px] font-extrabold text-white/82">
                  Treinos ({posts.length})
                </h3>
                {posts.length === 0 ? (
                  <p className="text-[13px] font-bold text-white/44">
                    Nenhum treino publicado ainda.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {posts.map((post) => (
                      <button
                        aria-label={`Abrir post ${post.mediaType === "video" ? "em vídeo" : "com foto"}`}
                        className="gc-pressable relative aspect-square w-full overflow-hidden rounded-[14px] bg-zinc-950 text-left"
                        key={post.id}
                        onClick={() => onOpenPost?.(post.id)}
                        type="button"
                      >
                        {post.mediaType === "video" ? (
                          <VideoThumbnail
                            className="h-full w-full object-cover"
                            src={post.imageUrl}
                          />
                        ) : (
                          <Image
                            alt={post.workoutType ?? "Treino"}
                            className="object-cover"
                            fill
                            sizes="120px"
                            src={post.imageUrl}
                          />
                        )}
                        {post.mediaType === "video" ? (
                          <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-black/58 text-white backdrop-blur-md">
                            <Play size={12} fill="currentColor" strokeWidth={2.4} />
                          </span>
                        ) : null}
                        <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 rounded-full bg-black/52 px-2 py-0.5 backdrop-blur-md">
                          <CheckCircle2 className="text-[var(--gc-brand)]" size={10} />
                          <span className="truncate text-[10px] font-black text-white/82">
                            {post.workoutType ?? "Treino"}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Quando o perfil é privado e ainda não fui aprovado, mostro só a foto do
 * último treino (regra do produto: "público a pessoa consegue ver a foto do
 * último treino" — para perfil privado, o usuário ainda enxerga apenas essa
 * prévia visual sem conseguir ver o resto do feed).
 */
function PrivateLockedNotice({
  latestPost,
  userIsPrivate,
}: {
  latestPost: EnrichedPost | undefined;
  userIsPrivate: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
        <Lock size={20} strokeWidth={2.4} />
      </div>
      <p className="text-[16px] font-black text-white">
        {userIsPrivate ? "Perfil privado" : "Conteúdo restrito"}
      </p>
      <p className="mt-2 text-[13px] font-bold text-white/56">
        {userIsPrivate
          ? "Envie uma solicitação para acompanhar este circle por dentro."
          : "Você ainda não tem acesso a este conteúdo."}
      </p>
      {latestPost ? (
        <div className="relative mx-auto mt-4 aspect-square w-full max-w-[220px] overflow-hidden rounded-[20px] border border-white/[0.08]">
          {latestPost.mediaType === "video" ? (
            <VideoThumbnail
              className="h-full w-full object-cover"
              src={latestPost.imageUrl}
            />
          ) : (
            <Image
              alt="Último treino"
              className="object-cover"
              fill
              sizes="220px"
              src={latestPost.imageUrl}
            />
          )}
          {latestPost.mediaType === "video" ? (
            <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/58 text-white backdrop-blur-md">
              <Play size={13} fill="currentColor" strokeWidth={2.4} />
            </span>
          ) : null}
          <div className="absolute bottom-2 left-2 rounded-full bg-black/64 px-2 py-1 text-[10px] font-black text-white/82 backdrop-blur-md">
            Último treino
          </div>
        </div>
      ) : null}
    </div>
  );
}
