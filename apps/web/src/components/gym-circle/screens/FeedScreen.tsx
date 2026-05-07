import {
  DiscoveryUserCard,
  EmptyState,
  SocialPostCard,
  StoryBubbles,
} from "../design-system";
import type { EnrichedPost, EnrichedStory, EnrichedUser } from "../social/types";
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
  onSelectUser?: (userId: string) => void;
  resolveUser?: (username: string) => { id: string } | undefined;
  onOpenPostMenu?: (postId: string) => void;
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
  onSelectUser,
  resolveUser,
  onOpenPostMenu,
}: FeedScreenProps) {
  return (
    <section className="gc-screen-enter min-h-screen px-5 pb-6">
      <TopBar eyebrow="Gym Circle" title="Hoje" />
      <StoryBubbles onOpenStory={onOpenStory} stories={stories} />

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
