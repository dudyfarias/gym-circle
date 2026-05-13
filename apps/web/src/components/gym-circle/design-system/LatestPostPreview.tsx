"use client";

import Image from "next/image";
import { Camera, MapPin, Video } from "lucide-react";
import type { EnrichedPost } from "../social/types";
import { AchievementBadge } from "./AchievementBadge";
import { VideoThumbnail } from "./VideoThumbnail";

type LatestPostPreviewProps = {
  post?: EnrichedPost;
  title?: string;
};

export function LatestPostPreview({
  post,
  title = "Último post",
}: LatestPostPreviewProps) {
  if (!post) {
    return (
      <section className="gc-ios-sheet rounded-[28px] p-5">
        <div className="grid aspect-[4/3] place-items-center rounded-[24px] border border-white/[0.08] bg-white/[0.035] text-center">
          <div>
            <div className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--gc-brand)]/14 text-[var(--gc-brand)]">
              <Camera size={20} strokeWidth={2.5} />
            </div>
            <p className="mt-3 text-[15px] font-black text-white">Nenhum post ainda</p>
            <p className="mt-1 text-[12px] font-bold text-white/44">
              O último treino aparece aqui.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const location = post.locationName || post.gymName;

  return (
    <section className="gc-ios-sheet overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.035]">
      <div className="relative aspect-[4/5] bg-zinc-950">
        {post.mediaType === "video" ? (
          <VideoThumbnail
            className="h-full w-full object-cover"
            src={post.imageUrl}
          />
        ) : (
          <Image
            alt={title}
            className="object-cover"
            fill
            sizes="(max-width: 480px) 100vw, 480px"
            src={post.imageUrl}
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/88 via-black/24 to-transparent p-4">
          <div className="mb-2 flex flex-wrap gap-2">
            <AchievementBadge
              icon={post.mediaType === "video" ? <Video size={13} /> : <Camera size={13} />}
              label={title}
              tone="brand"
            />
            {post.workoutType ? (
              <AchievementBadge label={post.workoutType} tone="blue" />
            ) : null}
          </div>
          {post.caption ? (
            <p className="line-clamp-2 text-[15px] font-bold leading-5 text-white">
              {post.caption}
            </p>
          ) : null}
          {location ? (
            <p className="mt-2 flex items-center gap-1 text-[12px] font-black text-white/56">
              <MapPin size={13} />
              <span className="truncate">{location}</span>
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
