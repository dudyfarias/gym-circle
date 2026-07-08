"use client";

import Image from "next/image";
import {
  Ban,
  Clock3,
  Flag,
  Lock,
  MessageCircle,
  Play,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LatestPostPreview,
  ProfileIdentity,
  ProfilePostsGrid,
  VideoThumbnail,
} from "./design-system";
import type { EnrichedPost, EnrichedUser } from "./social/types";

/**
 * ProfileSheet — overlay ao clicar em outro user no feed/etc.
 *
 * Sprint 3 / pós-3.4: refatorado pra usar `ProfileIdentity` e
 * `ProfilePostsGrid` compartilhados com a aba "Perfil" (`ProfileScreen`).
 * Antes, o sheet usava o `ProfileHeader` velho (ActivityCircle gigante,
 * sports list, instagramUsername inline) e tinha um grid próprio com
 * workout badge sobreposto. Agora ambas as views espelham o layout limpo
 * Instagram-like do Screen.
 *
 * Diferenças que sobrevivem (legítimas pro cenário "visitando perfil de
 * outro user"):
 * - Header overlay com botão "X" pra fechar (UI de modal).
 * - Action row 4 botões: Follow/Mensagem/Flag/Block.
 * - `LatestPostPreview` em destaque antes do grid (decisão de UX —
 *   conhecer alguém pelo último treino antes de scroll no grid).
 * - `PrivateLockedNotice` se conta privada + ainda não fui aprovado.
 */

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
  onOpenFollowers?: () => void;
  onOpenFollowing?: () => void;
  /** Sprint 3.5.3: tap nos rings do ProfileIdentity → abre MyCircleSheet. */
  onOpenMyCircle?: () => void;
  hasStory?: boolean;
  storyViewed?: boolean;
  onOpenStory?: () => void;
  postsHasMore?: boolean;
  postsLoadingMore?: boolean;
  onLoadMorePosts?: () => void;
};

type FollowCtaState = {
  /** i18n key — resolvido com `t()` no consumer pra reagir a mudança de idioma. */
  labelKey: "common.following" | "common.followRequested" | "common.requestFollow" | "common.follow";
  tone: "brand" | "white" | "muted";
  Icon: typeof UserPlus;
};

function getFollowCta(user: EnrichedUser): FollowCtaState {
  switch (user.followStatus) {
    case "accepted":
      return { labelKey: "common.following", tone: "white", Icon: UserCheck };
    case "pending":
      return { labelKey: "common.followRequested", tone: "muted", Icon: Clock3 };
    case "none":
    default:
      return user.isPrivate
        ? { labelKey: "common.requestFollow", tone: "brand", Icon: Lock }
        : { labelKey: "common.follow", tone: "brand", Icon: UserPlus };
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
  onOpenFollowers,
  onOpenFollowing,
  onOpenMyCircle,
  hasStory,
  storyViewed,
  onOpenStory,
  postsHasMore,
  postsLoadingMore,
  onLoadMorePosts,
}: ProfileSheetProps) {
  const { t } = useTranslation();
  if (!open || !user) return null;

  const isMe = user.id === currentUserId;
  const cta = getFollowCta(user);
  const canSeePosts =
    isMe || !user.isPrivate || user.followStatus === "accepted";
  const latestPost = posts[0];

  return (
    <div className="gc-safe-overlay absolute inset-0 z-50 bg-black/94 backdrop-blur-2xl">
      <div className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#0a0b0c] shadow-[0_28px_72px_rgba(0,0,0,0.7)]">
        {/* Header minimal — só @username + botão fechar. Identidade completa
            mora dentro do scroll, no `ProfileIdentity`. */}
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <p className="truncate text-[14px] font-black text-white/82">
            @{user.username}
          </p>
          <button
            aria-label={t("common.close")}
            className="gc-pressable grid size-11 place-items-center rounded-full bg-white/[0.06] text-white"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-5">
          <ProfileIdentity
            user={user}
            postsCount={posts.length}
            hasStory={hasStory}
            storyViewed={storyViewed}
            onOpenStory={onOpenStory}
            onOpenFollowers={onOpenFollowers}
            onOpenFollowing={onOpenFollowing}
            onOpenMyCircle={onOpenMyCircle}
            actions={
              !isMe ? (
                <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2">
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
                    <span className="truncate">{t(cta.labelKey)}</span>
                  </button>
                  <button
                    className="gc-pressable flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] px-3 text-[13px] font-black text-white"
                    onClick={() => onMessageUser?.(user.id)}
                    type="button"
                  >
                    <MessageCircle className="shrink-0" size={16} />
                    <span className="truncate">{t("common.message")}</span>
                  </button>
                  <button
                    aria-label={t("common.report")}
                    className="gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-white/62"
                    onClick={() => onReportUser?.(user.id)}
                    type="button"
                  >
                    <Flag size={16} />
                  </button>
                  <button
                    aria-label={t("common.block")}
                    className="gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04] text-[var(--gc-pink)]"
                    onClick={() => onBlockUser?.(user.id)}
                    type="button"
                  >
                    <Ban size={16} />
                  </button>
                </div>
              ) : undefined
            }
          />

          {!canSeePosts ? (
            <div className="mt-6">
              <PrivateLockedNotice
                latestPost={latestPost}
                userIsPrivate={user.isPrivate}
              />
            </div>
          ) : (
            <>
              {latestPost ? (
                <div className="mt-5">
                  <LatestPostPreview post={latestPost} />
                </div>
              ) : null}
              <ProfilePostsGrid
                emptyTitle={t("profile.emptyPosts")}
                hasMore={postsHasMore}
                loadingMore={postsLoadingMore}
                onLoadMore={onLoadMorePosts}
                onOpenPost={onOpenPost}
                posts={posts}
              />
            </>
          )}
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
  const { t } = useTranslation();
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-5 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
        <Lock size={20} strokeWidth={2.4} />
      </div>
      <p className="text-[16px] font-black text-white">
        {userIsPrivate
          ? t("profile.privateNotice.title")
          : t("profile.privateNotice.restrictedTitle")}
      </p>
      <p className="mt-2 text-[13px] font-bold text-white/56">
        {userIsPrivate
          ? t("profile.privateNotice.body")
          : t("profile.privateNotice.restrictedBody")}
      </p>
      {latestPost ? (
        <div className="relative mx-auto mt-4 aspect-square w-full max-w-[220px] overflow-hidden rounded-[20px] border border-white/[0.08]">
          {latestPost.mediaType === "video" ? (
            <VideoThumbnail
              className="h-full w-full object-cover"
              poster={latestPost.posterUrl ?? latestPost.thumbnailUrl}
              src={latestPost.imageUrl}
            />
          ) : (
            <Image
              alt={t("profile.privateNotice.latestPost")}
              className="object-cover"
              fill
              sizes="220px"
              src={latestPost.thumbnailUrl ?? latestPost.imageUrl}
            />
          )}
          {latestPost.mediaType === "video" ? (
            <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/58 text-white backdrop-blur-md">
              <Play size={13} fill="currentColor" strokeWidth={2.4} />
            </span>
          ) : null}
          <div className="absolute bottom-2 left-2 rounded-full bg-black/64 px-2 py-1 text-[10px] font-black text-white/82 backdrop-blur-md">
            {t("profile.privateNotice.latestPost")}
          </div>
        </div>
      ) : null}
    </div>
  );
}
