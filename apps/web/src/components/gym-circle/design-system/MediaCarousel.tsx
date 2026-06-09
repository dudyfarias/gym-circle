"use client";

import { useEffect, useRef, useState } from "react";
import type { PostMediaItem } from "../social/types";
import { PinchZoomImage } from "./PinchZoomImage";

/**
 * MediaCarousel — Sprint 13.
 *
 * Carrossel de mídias estilo Instagram. Usa CSS scroll-snap nativo (momentum
 * do iOS, SEM lib de gesto — lição da Sprint 12.3: gesto custom no WKWebView
 * dá race). `data-gc-no-screen-swipe` impede o swipe-de-borda do app de
 * sequestrar o arraste horizontal.
 *
 * - 1 mídia → render direto, aspecto natural (idêntico ao feed de antes).
 * - N mídias → trilho horizontal aspecto 4:5 (object-cover, frame consistente
 *   pra mídias de tamanhos diferentes), dots + contador "i/N", e vídeo só dá
 *   autoplay no slide ATIVO (os outros pausam).
 */
type MediaCarouselProps = {
  media: PostMediaItem[];
  altText: string;
  priority?: boolean;
};

export function MediaCarousel({ media, altText, priority }: MediaCarouselProps) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);

  if (media.length === 0) return null;

  // 1 mídia: sem overhead de carrossel — comportamento idêntico ao de antes.
  if (media.length === 1) {
    return (
      <MediaSlide
        altText={altText}
        inCarousel={false}
        isActive
        item={media[0]}
        priority={priority}
      />
    );
  }

  function handleScroll() {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive((prev) => (idx !== prev ? Math.max(0, Math.min(idx, media.length - 1)) : prev));
  }

  return (
    <div className="relative">
      <div
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-gc-no-screen-swipe
        onScroll={handleScroll}
        ref={trackRef}
      >
        {media.map((item, index) => (
          <div className="w-full shrink-0 snap-center snap-always" key={index}>
            <MediaSlide
              altText={altText}
              inCarousel
              isActive={index === active}
              item={item}
              priority={priority && index === 0}
            />
          </div>
        ))}
      </div>

      {/* Contador i/N */}
      <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/56 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur-md">
        {active + 1}/{media.length}
      </div>

      {/* Dots */}
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
        {media.map((_, index) => (
          <span
            className={[
              "h-1.5 rounded-full transition-all duration-200",
              index === active ? "w-4 bg-white" : "w-1.5 bg-white/45",
            ].join(" ")}
            key={index}
          />
        ))}
      </div>
    </div>
  );
}

type MediaSlideProps = {
  item: PostMediaItem;
  isActive: boolean;
  inCarousel: boolean;
  altText: string;
  priority?: boolean;
};

function MediaSlide({ item, isActive, inCarousel, altText, priority }: MediaSlideProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (item.mediaType !== "video") return;
    const node = videoRef.current;
    if (!node) return;
    // Só o slide ativo toca — evita N vídeos rodando juntos no WebView.
    if (isActive) {
      void node.play().catch(() => undefined);
    } else {
      node.pause();
    }
  }, [isActive, item.mediaType]);

  if (item.mediaType === "video") {
    return (
      <div className="relative aspect-[4/5] bg-black">
        <video
          autoPlay={isActive}
          className="h-full w-full object-cover"
          loop
          muted
          playsInline
          poster={item.posterUrl ?? item.thumbnailUrl ?? undefined}
          preload="metadata"
          ref={videoRef}
          src={item.imageUrl}
        />
      </div>
    );
  }

  const previewSrc = item.thumbnailUrl ?? item.imageUrl;
  const hqSrc =
    item.thumbnailUrl && item.imageUrl !== item.thumbnailUrl ? item.imageUrl : undefined;

  // Dentro do carrossel: frame fixo 4:5 object-cover (mídias de aspectos
  // diferentes não fazem o trilho "pular" ao deslizar). Single: aspecto natural
  // com pinch-zoom (comportamento original do feed).
  if (inCarousel) {
    return (
      <div className="relative aspect-[4/5] bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={altText}
          className="h-full w-full object-cover"
          loading={priority ? "eager" : "lazy"}
          src={previewSrc}
        />
      </div>
    );
  }

  return (
    <PinchZoomImage
      alt={altText}
      blurDataUrl={item.blurDataUrl ?? undefined}
      className="w-full"
      hqSrc={hqSrc}
      priority={priority}
      sizes="(max-width: 480px) 100vw, 480px"
      src={previewSrc}
    />
  );
}
