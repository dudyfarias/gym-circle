"use client";

import Image from "next/image";
import { type MouseEvent, type TouchEvent, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { EnrichedStory } from "../social/types";
import { StreakBadge } from "./StreakBadge";

const STORY_DURATION_MS = 4600;
const STORY_SWIPE_THRESHOLD = 54;

type StoryViewerProps = {
  story: EnrichedStory | null;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  onSelectUser?: (userId: string) => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
};

export function StoryViewer({
  story,
  onClose,
  onNext,
  onPrevious,
  onSelectUser,
  hasNext = false,
  hasPrevious = false,
}: StoryViewerProps) {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  const goNext = useCallback(() => {
    if (hasNext) {
      onNext?.();
      return;
    }
    onClose();
  }, [hasNext, onClose, onNext]);

  const goPrevious = useCallback(() => {
    if (hasPrevious) onPrevious?.();
  }, [hasPrevious, onPrevious]);

  useEffect(() => {
    if (!story) return;

    const timeout = window.setTimeout(goNext, STORY_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [goNext, story]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    touchStartXRef.current = touch?.clientX ?? null;
    touchStartYRef.current = touch?.clientY ?? null;
  }, []);

  const handleTouchEnd = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      const startX = touchStartXRef.current;
      const startY = touchStartYRef.current;
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      if (!touch || startX === null || startY === null) return;

      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (
        Math.abs(deltaX) < STORY_SWIPE_THRESHOLD ||
        Math.abs(deltaX) < Math.abs(deltaY) * 1.15
      ) {
        return;
      }

      suppressClickRef.current = true;
      if (deltaX < 0) goNext();
      else goPrevious();
    },
    [goNext, goPrevious],
  );

  const handleViewerClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("button,a,video,[data-gc-story-control]")
      ) {
        return;
      }

      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < rect.width * 0.36) goPrevious();
      else goNext();
    },
    [goNext, goPrevious],
  );

  if (!story) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-50 bg-black/94 px-4 py-4 backdrop-blur-2xl"
      data-gc-no-screen-swipe
    >
      <div
        className="relative mx-auto flex h-full max-h-[840px] min-h-[620px] flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#090A0B] shadow-[0_28px_72px_rgba(0,0,0,0.7)]"
        onClick={handleViewerClick}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
      >
        <div className="absolute inset-x-4 top-4 z-20 h-1 overflow-hidden rounded-full bg-white/18">
          <div
            className="h-full rounded-full bg-white"
            key={story.id}
            style={{ animation: "gc-story-progress 4.6s linear both" }}
          />
        </div>

        {story.mediaType === "video" ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            src={story.imageUrl}
          />
        ) : (
          <Image
            alt={story.title}
            className="object-cover"
            fill
            sizes="(max-width: 480px) 100vw, 480px"
            src={story.imageUrl}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/72 via-transparent to-black/82" />

        <div className="relative z-10 flex items-center justify-between gap-3 p-5 pt-8">
          <button
            className="gc-pressable flex min-w-0 items-center gap-3 text-left"
            onClick={(event) => {
              event.stopPropagation();
              onSelectUser?.(story.author.id);
            }}
            type="button"
          >
            <Avatar
              accent={story.author.accent}
              name={story.author.name}
              src={story.author.avatarUrl ?? undefined}
            />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-[15px] font-black">{story.author.name}</p>
                <StreakBadge
                  isLit={story.author.streakLitToday}
                  size="xs"
                  streak={story.author.currentStreak}
                />
              </div>
              <p className="truncate text-[12px] font-bold text-white/52">
                {story.caption}
              </p>
            </div>
          </button>
          <button
            aria-label="Fechar story"
            className="gc-pressable grid size-11 place-items-center rounded-full bg-black/52 text-white backdrop-blur-xl"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            type="button"
          >
            <X size={19} />
          </button>
        </div>

        <div className="relative z-10 mt-auto p-5">
          <p className="text-[13px] font-black uppercase text-white/48">
            {story.kind === "checkin" ? "Check-in" : "Treino"}
          </p>
          <h2 className="mt-1 text-[34px] font-black leading-tight">{story.title}</h2>
          <button
            className="gc-pressable mt-2 text-left text-[15px] font-bold text-white/68"
            onClick={(event) => {
              event.stopPropagation();
              onSelectUser?.(story.author.id);
            }}
            type="button"
          >
            {story.author.username}
          </button>
        </div>
      </div>
    </div>
  );
}
