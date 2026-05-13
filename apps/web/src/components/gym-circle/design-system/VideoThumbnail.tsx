"use client";

import { useRef } from "react";

type VideoThumbnailProps = {
  src: string;
  className?: string;
};

export function VideoThumbnail({ src, className = "" }: VideoThumbnailProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  function seekFirstFrame() {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;

    const target = Math.min(0.12, Math.max(0.01, video.duration - 0.01));
    if (Math.abs(video.currentTime - target) < 0.01) return;

    try {
      video.currentTime = target;
    } catch {
      // Algumas versões do iOS ignoram seek antes do buffer inicial.
      // O fallback é o próprio primeiro frame carregado pelo <video>.
    }
  }

  return (
    <video
      ref={videoRef}
      className={className}
      muted
      onCanPlay={seekFirstFrame}
      onLoadedMetadata={seekFirstFrame}
      playsInline
      preload="auto"
      src={src}
    />
  );
}
