"use client";

import { Avatar } from "@/components/ui/Avatar";
import type { StoryGroup } from "../social/types";
import { StreakBadge } from "./StreakBadge";

type StoryBubblesProps = {
  stories: StoryGroup[];
  onOpenStory: (storyGroupId: string) => void;
};

export function StoryBubbles({ stories, onOpenStory }: StoryBubblesProps) {
  return (
    <div
      className="gc-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 py-4"
      data-gc-no-screen-swipe
    >
      {stories.map((group) => (
        <button
          className="gc-pressable w-[70px] shrink-0 text-center"
          key={group.id}
          onClick={() => onOpenStory(group.id)}
          type="button"
        >
          <div
            className={[
              "relative mx-auto grid size-[66px] place-items-center rounded-full p-[2px]",
              // Sprint 2: quando o group já foi visto, REMOVE o ring em
              // volta (padrão Instagram). Antes mostrava ring cinza
              // translúcido. User decision: "apagar o círculo em volta".
              // Bubble continua clicável pra rever — o background bg-black
              // do filho interno (`bg-black p-[3px]`) mantém o avatar
              // alinhado com o tamanho `size-[66px]` mesmo sem ring.
              group.viewed ? "" : "gc-story-ring",
            ].join(" ")}
          >
            <div className="rounded-full bg-black p-[3px]">
              <Avatar
                accent={group.author.accent}
                name={group.author.name}
                size="md"
                src={group.author.avatarUrl ?? undefined}
              />
            </div>
            <StreakBadge
              className="absolute -bottom-2 left-1/2 -translate-x-1/2"
              isLit={group.author.streakLitToday}
              size="xs"
              streak={group.author.currentStreak}
            />
          </div>
          <p className="mt-3 truncate text-[12px] font-bold text-white/62">
            {group.author.name.split(" ")[0]}
          </p>
        </button>
      ))}
    </div>
  );
}
