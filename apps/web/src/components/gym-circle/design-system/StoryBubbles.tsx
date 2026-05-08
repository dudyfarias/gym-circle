"use client";

import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedStory } from "../social/types";
import { StreakBadge } from "./StreakBadge";

type StoryBubblesProps = {
  stories: EnrichedStory[];
  onOpenStory: (storyId: string) => void;
};

export function StoryBubbles({ stories, onOpenStory }: StoryBubblesProps) {
  return (
    <div
      className="gc-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 py-4"
      data-gc-no-screen-swipe
    >
      {stories.map((story) => (
        <button
          className="gc-pressable w-[70px] shrink-0 text-center"
          key={story.id}
          onClick={() => onOpenStory(story.id)}
          type="button"
        >
          <div
            className={[
              "relative mx-auto grid size-[66px] place-items-center rounded-full p-[2px]",
              story.viewed ? "bg-white/[0.12]" : "gc-story-ring",
            ].join(" ")}
          >
            <div className="rounded-full bg-black p-[3px]">
              <Avatar
                accent={story.author.accent}
                name={story.author.name}
                size="md"
                src={story.author.avatarUrl ?? undefined}
              />
            </div>
            <StreakBadge
              className="absolute -bottom-2 left-1/2 -translate-x-1/2"
              isLit={story.author.streakLitToday}
              size="xs"
              streak={story.author.currentStreak}
            />
          </div>
          <p className="mt-3 truncate text-[12px] font-bold text-white/62">
            {story.author.name.split(" ")[0]}
          </p>
        </button>
      ))}
    </div>
  );
}
