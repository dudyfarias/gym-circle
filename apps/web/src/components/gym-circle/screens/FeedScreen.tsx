import {
  Camera,
  Clock3,
  Dumbbell,
  LocateFixed,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import {
  DiscoveryUserCard,
  EmptyState,
  SocialPostCard,
  StoryBubbles,
} from "../design-system";
import { calculateProfileCompletion, type ProfileCompletion } from "../social/profile";
import type { EnrichedPost, EnrichedUser, StoryGroup } from "../social/types";
import {
  shouldShowViewerLocationPrompt,
  type ViewerLocationStatus,
} from "../social/useViewerLocation";
import { TopBar } from "../TopBar";

type FeedScreenProps = {
  currentUser: EnrichedUser;
  feedPosts: EnrichedPost[];
  stories: StoryGroup[];
  suggestedUsers: EnrichedUser[];
  formatTime: (createdAt: string) => string;
  onCreatePost: () => void;
  onLikePost: (postId: string) => void;
  onCommentPost: (postId: string, body: string) => void;
  onOpenPostDetails?: (postId: string) => void;
  onDeleteComment?: (postId: string, commentId: string) => void;
  onLikeComment?: (postId: string, commentId: string) => void;
  onSharePostToChat?: (postId: string, receiverId: string) => Promise<void> | void;
  onToggleFollow: (userId: string) => void;
  onOpenStory: (storyGroupId: string) => void;
  onEditProfile?: () => void;
  onFindPeople?: () => void;
  onRequestViewerLocation?: () => void;
  onDismissViewerLocationPrompt?: () => void;
  onSelectUser?: (userId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  onOpenPostMenu?: (postId: string) => void;
  onOpenLikes?: (postId: string) => void;
  commentMentionUsers?: EnrichedUser[];
  postShareTargets?: EnrichedUser[];
  viewerLocationError?: string | null;
  viewerLocationStatus?: ViewerLocationStatus;
  hasDistancePosts?: boolean;
  headerHidden?: boolean;
  loading?: boolean;
};

function getSharedGymCount(currentUser: EnrichedUser, user: EnrichedUser) {
  return user.gyms.filter((gym) => currentUser.gyms.includes(gym)).length;
}

export function FeedScreen({
  currentUser,
  feedPosts,
  stories,
  suggestedUsers,
  formatTime,
  onCreatePost,
  onLikePost,
  onCommentPost,
  onOpenPostDetails,
  onDeleteComment,
  onLikeComment,
  onSharePostToChat,
  onToggleFollow,
  onOpenStory,
  onEditProfile,
  onFindPeople,
  onRequestViewerLocation,
  onDismissViewerLocationPrompt,
  onSelectUser,
  resolveUser,
  onOpenPostMenu,
  onOpenLikes,
  commentMentionUsers = [],
  postShareTargets = [],
  viewerLocationError,
  viewerLocationStatus = "idle",
  hasDistancePosts = false,
  headerHidden = false,
  loading = false,
}: FeedScreenProps) {
  const profileCompletion = calculateProfileCompletion(currentUser);
  const hasFirstPost = feedPosts.some((post) => post.userId === currentUser.id);

  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Gym Circle" hidden={headerHidden} title="Hoje" />
      <StoryBubbles onOpenStory={onOpenStory} stories={stories} />
      <ProgressiveOnboardingCard
        completion={profileCompletion}
        followingCount={currentUser.followingCount}
        hasFirstPost={hasFirstPost}
        hasSuggestedUsers={suggestedUsers.length > 0}
        onCreatePost={onCreatePost}
        onEditProfile={onEditProfile}
        onFindPeople={onFindPeople}
      />
      <DistancePermissionCard
        error={viewerLocationError}
        hasDistancePosts={hasDistancePosts}
        onDismiss={onDismissViewerLocationPrompt}
        onRequest={onRequestViewerLocation}
        status={viewerLocationStatus}
      />

      {loading && feedPosts.length === 0 ? (
        <FeedSkeleton />
      ) : feedPosts.length > 0 ? (
        <div className="space-y-5">
          {feedPosts.map((post) => (
            <div key={post.id}>
              <SocialPostCard
                currentUserId={currentUser.id}
                formatTime={formatTime}
                onComment={onCommentPost}
                onDeleteComment={onDeleteComment}
                onLike={onLikePost}
                onLikeComment={onLikeComment}
                onOpenLikes={onOpenLikes}
                onOpenComments={onOpenPostDetails}
                onOpenPostMenu={onOpenPostMenu}
                onSelectUser={onSelectUser}
                onShareToChat={onSharePostToChat}
                onToggleFollow={onToggleFollow}
                mentionUsers={commentMentionUsers}
                post={post}
                resolveUser={resolveUser}
                shareTargets={postShareTargets}
              />
              {post === feedPosts[1] && suggestedUsers.length > 0 ? (
                <section className="mt-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-[17px] font-black">Pessoas perto de voce</h3>
                    <span className="text-[12px] font-black text-white/36">
                      mesmas academias
                    </span>
                  </div>
                  <div className="gc-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5">
                    {suggestedUsers.slice(0, 5).map((user) => (
                      <DiscoveryUserCard
                        key={user.id}
                        onSelectUser={onSelectUser}
                        onToggleFollow={onToggleFollow}
                        sharedGymCount={getSharedGymCount(currentUser, user)}
                        user={user}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          action={
            <button
              className="gc-pressable h-12 rounded-full bg-[var(--gc-brand)] px-5 text-[14px] font-black text-black"
              onClick={onCreatePost}
              type="button"
            >
              Postar primeiro treino
            </button>
          }
          detail="Quando seu circle publicar treinos, eles aparecem aqui com streak, curtidas e comentários."
          title="Seu feed está quieto"
        />
      )}
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-5" aria-label="Carregando feed">
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

type ProgressiveOnboardingCardProps = {
  completion: ProfileCompletion;
  followingCount: number;
  hasFirstPost: boolean;
  hasSuggestedUsers: boolean;
  onCreatePost: () => void;
  onEditProfile?: () => void;
  onFindPeople?: () => void;
};

const completionCopy: Record<string, string> = {
  avatar: "Adicione uma foto para ganhar mais destaque.",
  gym: "Escolha sua academia para encontrar gente do mesmo circle.",
  goal: "Conte seu objetivo fitness em uma linha.",
  bio: "Uma bio curta ajuda as pessoas a entenderem seu ritmo.",
  preferredTimes: "Mostre quando você costuma treinar.",
  identity: "Finalize seu nome público.",
};

function ProgressiveOnboardingCard({
  completion,
  followingCount,
  hasFirstPost,
  hasSuggestedUsers,
  onCreatePost,
  onEditProfile,
  onFindPeople,
}: ProgressiveOnboardingCardProps) {
  const shouldSuggestPeople = followingCount === 0 && hasSuggestedUsers;
  const shouldShow =
    completion.percentage < 100 || !hasFirstPost || shouldSuggestPeople;

  if (!shouldShow) return null;

  const nextMissing = completion.missing[0];
  const detail = !hasFirstPost
    ? "Fez seu treino hoje? Poste para acender seu círculo."
    : nextMissing
      ? completionCopy[nextMissing.id]
      : "Siga pessoas para deixar seu feed mais vivo.";

  return (
    <section className="mb-5 rounded-[30px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(140,251,255,0.12),rgba(255,255,255,0.045)_42%,rgba(0,0,0,0.2))] p-4 shadow-[0_22px_64px_rgba(0,0,0,0.38)] backdrop-blur-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)] shadow-[0_0_24px_rgba(92,232,255,0.14)]">
              <Sparkles size={16} strokeWidth={2.6} />
            </span>
            <p className="text-[12px] font-black uppercase tracking-[0.02em] text-white/42">
              Comece leve
            </p>
          </div>
          <h2 className="mt-3 text-[19px] font-black leading-tight text-white">
            Seu perfil está {completion.percentage}% completo
          </h2>
          <p className="mt-1 text-[13px] font-bold leading-5 text-white/52">
            {detail}
          </p>
        </div>
        <div className="grid size-14 shrink-0 place-items-center rounded-full border border-[var(--gc-brand)]/18 bg-black/40 text-[15px] font-black text-[var(--gc-brand)] shadow-[0_0_28px_rgba(48,213,255,0.12)]">
          {completion.percentage}%
        </div>
      </div>

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#8CFBFF,#30D5FF,#0066FF)] transition-all duration-500"
          style={{ width: `${completion.percentage}%` }}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!hasFirstPost ? (
          <button
            className="gc-pressable flex h-11 items-center gap-2 rounded-full bg-[var(--gc-brand)] px-4 text-[13px] font-black text-black"
            onClick={onCreatePost}
            type="button"
          >
            <Camera size={15} strokeWidth={2.7} />
            Postar treino
          </button>
        ) : null}
        {completion.percentage < 100 && onEditProfile ? (
          <button
            className="gc-pressable flex h-11 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] px-4 text-[13px] font-black text-white"
            onClick={onEditProfile}
            type="button"
          >
            {nextMissing?.id === "gym" ? (
              <MapPin size={15} strokeWidth={2.7} />
            ) : nextMissing?.id === "preferredTimes" ? (
              <Clock3 size={15} strokeWidth={2.7} />
            ) : (
              <Dumbbell size={15} strokeWidth={2.7} />
            )}
            Completar perfil
          </button>
        ) : null}
        {shouldSuggestPeople && onFindPeople ? (
          <button
            className="gc-pressable flex h-11 items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.06] px-4 text-[13px] font-black text-white"
            onClick={onFindPeople}
            type="button"
          >
            <UserPlus size={15} strokeWidth={2.7} />
            Seguir pessoas
          </button>
        ) : null}
      </div>
    </section>
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
              Ver distância aproximada
            </p>
            <ShieldCheck size={14} className="text-white/36" />
          </div>
          <p className="mt-1 text-[12px] font-bold leading-4 text-white/46">
            Mostramos só km aproximado. Suas coordenadas não aparecem no feed.
          </p>
          {error ? (
            <p className="mt-2 text-[12px] font-bold text-[var(--gc-pink)]">
              {error}
            </p>
          ) : null}
        </div>
        {onDismiss ? (
          <button
            aria-label="Ocultar localização"
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
        {isRequesting ? "Localizando..." : "Permitir localização"}
      </button>
    </section>
  );
}
