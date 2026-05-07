import {
  LocateFixed,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  DiscoveryUserCard,
  EmptyState,
  SocialPostCard,
  StoryBubbles,
} from "../design-system";
import type { EnrichedPost, EnrichedStory, EnrichedUser } from "../social/types";
import type { ViewerLocationStatus } from "../social/useViewerLocation";
import { TopBar } from "../TopBar";

type FeedScreenProps = {
  currentUser: EnrichedUser;
  feedPosts: EnrichedPost[];
  stories: EnrichedStory[];
  suggestedUsers: EnrichedUser[];
  formatTime: (createdAt: string) => string;
  onCreatePost: () => void;
  onLikePost: (postId: string) => void;
  onCommentPost: (postId: string, body: string) => void;
  onToggleFollow: (userId: string) => void;
  onOpenStory: (storyId: string) => void;
  onRequestViewerLocation?: () => void;
  onSelectUser?: (userId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  onOpenPostMenu?: (postId: string) => void;
  viewerLocationError?: string | null;
  viewerLocationStatus?: ViewerLocationStatus;
  hasDistancePosts?: boolean;
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
  onToggleFollow,
  onOpenStory,
  onRequestViewerLocation,
  onSelectUser,
  resolveUser,
  onOpenPostMenu,
  viewerLocationError,
  viewerLocationStatus = "idle",
  hasDistancePosts = false,
}: FeedScreenProps) {
  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Gym Circle" title="Hoje" />
      <StoryBubbles onOpenStory={onOpenStory} stories={stories} />
      <DistancePermissionCard
        error={viewerLocationError}
        hasDistancePosts={hasDistancePosts}
        onRequest={onRequestViewerLocation}
        status={viewerLocationStatus}
      />

      {feedPosts.length > 0 ? (
        <div className="space-y-5">
          {feedPosts.map((post) => (
            <div key={post.id}>
              <SocialPostCard
                currentUserId={currentUser.id}
                formatTime={formatTime}
                onComment={onCommentPost}
                onLike={onLikePost}
                onOpenPostMenu={onOpenPostMenu}
                onSelectUser={onSelectUser}
                onToggleFollow={onToggleFollow}
                post={post}
                resolveUser={resolveUser}
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

type DistancePermissionCardProps = {
  error?: string | null;
  hasDistancePosts: boolean;
  onRequest?: () => void;
  status: ViewerLocationStatus;
};

function DistancePermissionCard({
  error,
  hasDistancePosts,
  onRequest,
  status,
}: DistancePermissionCardProps) {
  if (!hasDistancePosts || !onRequest || status === "granted") return null;

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
