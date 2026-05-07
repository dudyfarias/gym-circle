"use client";

import Image from "next/image";
import { Heart, MessageCircle } from "lucide-react";
import { useAuth, useFeed, useStories } from "@gym-circle/core/hooks";
import { getStreakLevel } from "@gym-circle/core/domain";
import { Avatar } from "@/components/ui/Avatar";
import { TopBar } from "./TopBar";
import { LiveAuthGate } from "./LiveAuthGate";

export function LiveGymCirclePreview() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <FullScreenStatus message="Carregando sessão..." />;
  }

  if (!user) {
    return <LiveAuthGate />;
  }

  return <LiveFeedScreen userId={user.id} />;
}

function LiveFeedScreen({ userId }: { userId: string }) {
  const { posts, loading, error, like, unlike } = useFeed(userId);
  const { stories } = useStories(userId);

  return (
    <main className="min-h-screen bg-black text-white lg:bg-[#050505]">
      <div className="relative mx-auto min-h-screen w-full max-w-[480px] overflow-hidden border-white/[0.06] bg-black shadow-[0_0_90px_rgba(0,0,0,0.92)] lg:border-x">
        <div className="gc-phone-shell flex min-h-screen flex-col px-5 pb-12">
          <TopBar eyebrow="Gym Circle · Live" title="Feed" />

          {stories.length > 0 ? (
            <div className="gc-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 py-4">
              {stories.map((story) => (
                <div className="w-[70px] shrink-0 text-center" key={story.id}>
                  <div className="relative mx-auto grid size-[66px] place-items-center rounded-full p-[2px] gc-story-ring">
                    <div className="rounded-full bg-black p-[3px]">
                      <Avatar
                        accent="var(--gc-brand)"
                        name={story.author_display_name}
                        size="md"
                        src={story.author_avatar_url ?? undefined}
                      />
                    </div>
                  </div>
                  <p className="mt-3 truncate text-[12px] font-bold text-white/62">
                    {story.author_display_name.split(" ")[0]}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-[20px] border border-[var(--gc-pink)]/30 bg-[var(--gc-pink)]/10 p-4 text-[13px] font-bold text-[var(--gc-pink)]">
              {error.message}
            </div>
          ) : null}

          {loading ? (
            <FullScreenStatus message="Carregando feed..." />
          ) : posts.length === 0 ? (
            <div className="mt-10 rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 text-center">
              <p className="text-[16px] font-black">Sem treinos por aqui ainda.</p>
              <p className="mt-2 text-[13px] font-bold text-white/50">
                Aplique a seed em <code className="rounded bg-white/[0.08] px-1">supabase/seed.sql</code>{" "}
                ou publique seu primeiro post.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {posts.map((post) => {
                const level = getStreakLevel(post.author_current_streak ?? 0);
                return (
                  <article
                    className="overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#0c0d0e] shadow-[0_24px_64px_rgba(0,0,0,0.48)]"
                    key={post.id}
                  >
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <Avatar
                        accent="var(--gc-brand)"
                        name={post.display_name}
                        src={post.avatar_url ?? undefined}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h2 className="truncate text-[15px] font-black">{post.display_name}</h2>
                          <span
                            className={`inline-flex h-6 items-center gap-1.5 rounded-full border border-white/8 px-2 text-[10px] font-black ${
                              post.author_badge_active
                                ? "gc-streak-badge-lit"
                                : "gc-streak-badge-dim"
                            }`}
                          >
                            {level.shortLabel} · {post.author_current_streak ?? 0}d
                          </span>
                        </div>
                        <p className="truncate text-[12px] font-bold text-white/46">
                          @{post.username} · {post.workout_type}
                        </p>
                      </div>
                    </div>

                    <div className="relative aspect-[4/5] overflow-hidden bg-zinc-950">
                      <Image
                        alt={`Treino de ${post.display_name}`}
                        className="object-cover"
                        fill
                        sizes="(max-width: 480px) 100vw, 480px"
                        src={post.image_url}
                      />
                    </div>

                    <div className="space-y-2 px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          aria-label={post.liked_by_me ? "Descurtir" : "Curtir"}
                          className={`gc-pressable grid size-11 place-items-center rounded-full border border-white/[0.08] bg-white/[0.04] ${
                            post.liked_by_me ? "text-[var(--gc-pink)]" : "text-white"
                          }`}
                          onClick={() =>
                            post.liked_by_me ? unlike(post.id) : like(post.id)
                          }
                          type="button"
                        >
                          <Heart
                            fill={post.liked_by_me ? "currentColor" : "none"}
                            size={18}
                            strokeWidth={2.4}
                          />
                        </button>
                        <span className="text-[12px] font-black text-white/68">
                          {post.likes_count} curtidas
                        </span>
                        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-black text-white/52">
                          <MessageCircle size={14} />
                          {post.comments_count}
                        </span>
                      </div>
                      {post.caption ? (
                        <p className="text-[14px] font-semibold leading-5 text-white/82">
                          <span className="text-white">@{post.username}</span> {post.caption}
                        </p>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function FullScreenStatus({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-black text-white">
      <p className="text-[14px] font-bold text-white/60">{message}</p>
    </main>
  );
}
