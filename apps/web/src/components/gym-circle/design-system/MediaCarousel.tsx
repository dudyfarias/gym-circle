"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PostMediaItem } from "../social/types";
import { PinchZoomImage } from "./PinchZoomImage";

// Som GLOBAL do feed (estilo Instagram): uma única fonte da verdade do "mudo?"
// pra TODOS os vídeos — ligar o som num vídeo liga pra os próximos. Vive no
// módulo (sessão): reseta ao recarregar a página, sem persistência.
let feedMuted = true;
const feedMutedListeners = new Set<() => void>();

function setFeedMuted(value: boolean) {
  if (value === feedMuted) return;
  feedMuted = value;
  feedMutedListeners.forEach((listener) => listener());
}

function useFeedMuted(): [boolean, (value: boolean) => void] {
  const muted = useSyncExternalStore(
    (cb) => {
      feedMutedListeners.add(cb);
      return () => {
        feedMutedListeners.delete(cb);
      };
    },
    () => feedMuted,
    () => true, // snapshot do SSR: começa mudo
  );
  return [muted, setFeedMuted];
}

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
    <div>
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

        {/* Contador i/N (canto, discreto) */}
        <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-black/56 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur-md">
          {active + 1}/{media.length}
        </div>
      </div>

      {/* Dots ABAIXO da mídia (estilo Instagram): azul = atual, cinza = resto.
          Quantidade = nº de mídias. */}
      <div className="flex items-center justify-center gap-1.5 pt-2.5">
        {media.map((_, index) => (
          <span
            className={[
              "size-1.5 rounded-full transition-colors duration-200",
              index === active ? "bg-[var(--gc-blue)]" : "bg-white/28",
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
  if (item.mediaType === "video") {
    return <VideoSlide isActive={isActive} item={item} />;
  }

  const previewSrc = item.thumbnailUrl ?? item.imageUrl;
  const hqSrc =
    item.thumbnailUrl && item.imageUrl !== item.thumbnailUrl ? item.imageUrl : undefined;

  // Dentro do carrossel: frame TRAVADO em 4:5 (mídias de aspectos
  // diferentes não fazem o trilho "pular" ao deslizar) — agora COM
  // pinch-zoom (Sprint 16.x: antes era <img> puro e o zoom não existia
  // no carrossel; fixedAspectRatio mantém o trilho estável e
  // allowHorizontalPan deixa o swipe entre slides vivo em repouso).
  if (inCarousel) {
    return (
      <PinchZoomImage
        allowHorizontalPan
        alt={altText}
        blurDataUrl={item.blurDataUrl ?? undefined}
        className="w-full"
        fixedAspectRatio={4 / 5}
        hqSrc={hqSrc}
        priority={priority}
        src={previewSrc}
      />
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

/**
 * VideoSlide — vídeo inline estilo Instagram:
 * - autoplay quando >50% visível na viewport (IntersectionObserver) e PAUSA ao
 *   sair da tela — antes o `autoPlay` tocava mesmo fora de vista;
 * - tap PAUSA/retoma (ícone de play quando pausado);
 * - começa MUDO; botão de som no canto liga/desliga (gesto do usuário libera
 *   o áudio no browser);
 * - loop infinito; no carrossel, só o slide ativo toca.
 */
function VideoSlide({ item, isActive }: { item: PostMediaItem; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [muted, setMuted] = useFeedMuted(); // som GLOBAL (sessão)
  const [paused, setPaused] = useState(false);

  // Visibilidade: toca só com >=50% na viewport (pausa ao rolar pra longe).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(Boolean(entry?.isIntersecting) && (entry?.intersectionRatio ?? 0) >= 0.5);
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Mantém o DOM `muted` em sincronia (o atributo React nem sempre aplica).
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Play/pause: ativo no carrossel + visível + não pausado manualmente.
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (isActive && inView && !paused) {
      void node.play().catch(() => undefined);
    } else {
      node.pause();
    }
  }, [isActive, inView, paused]);

  return (
    <div className="relative aspect-[4/5] bg-black" ref={containerRef}>
      <video
        className="h-full w-full object-cover"
        loop
        onClick={() => setPaused((p) => !p)}
        playsInline
        poster={item.posterUrl ?? item.thumbnailUrl ?? undefined}
        preload="metadata"
        ref={videoRef}
        src={item.imageUrl}
      />

      {paused ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg className="size-14 text-white/90 drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      ) : null}

      <button
        aria-label={muted ? "Ativar som" : "Silenciar"}
        className="absolute bottom-3 right-3 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-md transition-transform active:scale-90"
        onClick={(e) => {
          e.stopPropagation();
          setMuted(!muted);
        }}
        type="button"
      >
        {muted ? (
          <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3.63 3.63a1 1 0 0 0 0 1.41L7.29 8.7 7 9H4a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91a1 1 0 1 0 .76 1.85c.86-.35 1.65-.83 2.36-1.42l1.31 1.31a1 1 0 0 0 1.41-1.41L5.05 3.63a1 1 0 0 0-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53A8.93 8.93 0 0 0 21 12a8.99 8.99 0 0 0-6.71-8.71 1 1 0 1 0-.58 1.91A6.99 6.99 0 0 1 19 12zm-7-8-1.88 1.88L12 7.76V4zm4.5 8A4.5 4.5 0 0 0 14 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z" />
          </svg>
        ) : (
          <svg className="size-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 10v4a1 1 0 0 0 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4a1 1 0 0 0-1 1zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v.06a1 1 0 0 0 .67 1.31A6.99 6.99 0 0 1 19 12a6.99 6.99 0 0 1-4.33 6.4 1 1 0 0 0-.67 1.31v.06a1 1 0 0 0 1.3.95A8.99 8.99 0 0 0 21 12a8.99 8.99 0 0 0-5.7-8.72 1 1 0 0 0-1.3.95z" />
          </svg>
        )}
      </button>
    </div>
  );
}
