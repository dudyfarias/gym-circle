"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import { hasImageLoaded, markImageLoaded } from "./imageCache";

/**
 * GCImage — Sprint 2.1 (Native Feel).
 *
 * Abstração centralizada de mídia rasterizada do Gym Circle. Wrappa
 * `next/image` adicionando comportamento native-like:
 *
 *  1. **Crossfade controlado**: opacity 0 → 1 em 280ms quando o decode
 *     termina. Sem flash preto, sem troca seca.
 *  2. **Cache tracking**: se o src já foi mostrado nesta sessão
 *     (`imageCache`), inicia direto com `loaded=true` (sem fade-in).
 *     Sensação instant ao reabrir feed/stories.
 *  3. **Placeholder inteligente**: usa `blurDataURL` quando disponível
 *     (gerado no upload — Sprint 2.4 vai garantir isso); fallback solid
 *     dark `#0c0d0e` que combina com o tema. NUNCA tela preta vazia.
 *  4. **Callback `onReady`**: dispara depois do decode pra sincronizar
 *     animações externas (ex.: stories progress bar só começa quando a
 *     mídia tá pronta).
 *
 * Quando NÃO usar:
 *  - Vídeos (use `<video>` direto ou `VideoThumbnail`).
 *  - SVGs de ícone (use `lucide-react`).
 *  - Imagens decorativas sem semântica (use `<img>` simples).
 *
 * Decisão: por baixo é `next/image` pra ganhar de graça responsive
 * srcset, lazy loading, `fetchPriority`, e o blur nativo. Não
 * reinventamos esses.
 */

type GCImageBaseProps = Omit<
  ImageProps,
  "onLoad" | "onError" | "placeholder" | "blurDataURL" | "alt"
>;

export type GCImageProps = GCImageBaseProps & {
  alt: string;
  /** Base64 data URL pra blur placeholder. Quando ausente, fallback solid dark. */
  blurDataURL?: string | null;
  /** Callback após o `onLoad` do <img> nativo + cache marcado. */
  onReady?: () => void;
  /**
   * Cor de fundo enquanto a mídia carrega — fallback quando `blurDataURL`
   * não existir. Default `#0c0d0e` (matches o `bg-[#0c0d0e]` do tema).
   */
  fallbackColor?: string;
  /** Desabilita o crossfade (raramente útil — debug ou casos low-end). */
  disableFade?: boolean;
};

const FALLBACK_COLOR = "#0c0d0e";

export function GCImage({
  src,
  alt,
  blurDataURL,
  onReady,
  fallbackColor = FALLBACK_COLOR,
  disableFade = false,
  className = "",
  ...next
}: GCImageProps) {
  const srcKey = typeof src === "string" ? src : "";
  // Se já foi mostrado nesta sessão, pula o fade-in — render instant.
  const [loaded, setLoaded] = useState(() => hasImageLoaded(srcKey));
  const onReadyRef = useRef(onReady);

  // Mantém a ref atualizada sem disparar re-render
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // Se o src trocar, ajusta `loaded` DURANTE o render (padrão React
  // "adjusting state when props change"). Sprint 16: antes era um
  // useEffect — que roda DEPOIS do paint, deixando 1 frame com o
  // `loaded` da imagem anterior aplicado ao src novo (o flash
  // preto/imagem errada relatado no app). Ajuste em render re-renderiza
  // ANTES de pintar: zero frame stale.
  const [prevSrcKey, setPrevSrcKey] = useState(srcKey);
  if (srcKey !== prevSrcKey) {
    setPrevSrcKey(srcKey);
    setLoaded(hasImageLoaded(srcKey));
  }

  // O side effect (callback do caller) continua em effect — mas sem
  // mexer em state. Dispara no mount e a cada src que já está no cache.
  useEffect(() => {
    if (hasImageLoaded(srcKey)) {
      onReadyRef.current?.();
    }
  }, [srcKey]);

  function handleLoad() {
    markImageLoaded(srcKey);
    setLoaded(true);
    onReadyRef.current?.();
  }

  // Estilo do crossfade: opacity controla a transição da MÍDIA por cima
  // do placeholder. Quando `disableFade`, salta direto pra 1.
  const imageOpacity = disableFade || loaded ? 1 : 0;

  // Próprio placeholder (renderizado por baixo da Image via z-index do
  // wrapper). Quando há blurDataURL, deixamos o `next/image` cuidar via
  // `placeholder="blur"`. Quando não há, mostramos solid fallback.
  const useBlurPlaceholder = Boolean(blurDataURL);

  return (
    <span
      className={["relative block overflow-hidden", className].join(" ").trim()}
      style={{
        backgroundColor: fallbackColor,
        // O backgroundColor cobre o caso "sem blurDataURL". Quando há
        // blur, ele fica por cima via next/image até o decode terminar.
      }}
    >
      <Image
        {...next}
        alt={alt}
        src={src}
        placeholder={useBlurPlaceholder ? "blur" : "empty"}
        blurDataURL={useBlurPlaceholder ? blurDataURL ?? undefined : undefined}
        onLoad={handleLoad}
        // O <Image> do Next aplica seus próprios styles inline.
        // Adicionamos opacity via style merged pra controlar o fade.
        style={{
          ...(next.style ?? {}),
          opacity: imageOpacity,
          transition: disableFade
            ? undefined
            : "opacity 280ms var(--gc-ease-ios, ease-out)",
        }}
      />
    </span>
  );
}
