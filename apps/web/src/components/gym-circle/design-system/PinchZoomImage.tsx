"use client";

import { useEffect, useRef, useState } from "react";
import { hasImageLoaded, markImageLoaded } from "./imageCache";

/**
 * PinchZoomImage — Sprint 3 / pós-3.4 (+ Sprint 2.2 crossfade).
 *
 * Antes: `transform: scale(${scale})` puro, sem `transform-origin` dinâmico
 * nem pan. O zoom sempre escalava a partir do centro (default CSS), por isso
 * "travava no centro" e não havia como mover pra ver outras partes.
 *
 * Agora: pinch-to-zoom com anchor no midpoint dos dois dedos + pan com um
 * dedo enquanto `scale > 1`. Reset suave ao soltar todos os dedos.
 *
 * Matemática do anchor (pra manter midpoint fixo na tela durante zoom):
 *   mRel = midpoint na viewport − centro do container
 *   r    = nextScale / initialScale
 *   nextX = mRel.x * (1 − r) + initialX * r
 *   nextY = mRel.y * (1 − r) + initialY * r
 * Derivado de "ponto do conteúdo sob o dedo permanece sob o dedo".
 *
 * Clamp do offset (não passar das bordas escaladas):
 *   maxX = (containerWidth  * (scale − 1)) / 2
 *   maxY = (containerHeight * (scale − 1)) / 2
 */

type PinchZoomImageProps = {
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  /**
   * Versão exibida inicialmente. No feed isso é tipicamente o
   * `thumbnailUrl` (640px) — paint rápido, baixa banda. Pode ser a única
   * fonte se `hqSrc` não for passado.
   */
  src: string;
  /**
   * Sprint 2.2: base64 data URL pra fundo blur enquanto a imagem
   * decodifica. Quando ausente, fallback solid `#0c0d0e` (tema dark)
   * já cobre — nunca tela preta vazia.
   */
  blurDataUrl?: string | null;
  /**
   * Sprint 3.6 bug fix: versão de alta resolução (1920px no nosso pipeline
   * da Sprint 2.4). Quando passada e diferente de `src`, é decodificada em
   * background via `HTMLImageElement.decode()` (API canônica pra garantir
   * bitmap no GPU buffer antes da troca) e troca o `<img>` exibido só
   * depois que o navegador terminou de processar — sem flash, sem layout
   * shift, sem regredir o crossfade da Sprint 2.2.
   *
   * Reportado pelo Eduardo: "A imagem postada ainda ta muito ruim,
   * precisamos que ela seja carregada no final com a resolução igual de
   * quando ela é postada." A Sprint 2.2 deu blur + paint suave, mas o
   * feed nunca chegava na HQ — sempre parava no thumb.
   *
   * Decisão: sem crossfade ADICIONAL na troca thumb→HQ. Thumbnail e HQ
   * vêm do mesmo upload (cropped igual, mesma proporção), então a troca
   * de buffer GPU é visualmente indistinguível — o user só percebe ganho
   * de nitidez. Crossfade aqui custaria GPU sem ganho perceptível.
   */
  hqSrc?: string;
  /**
   * Sprint 16.x (zoom no carrossel) — trava o aspect ratio do frame em
   * vez de adotar o natural da imagem no load. O carrossel usa 4/5 fixo
   * pra mídias de aspectos diferentes não fazerem o trilho "pular" ao
   * deslizar entre slides.
   */
  fixedAspectRatio?: number;
  /**
   * Sprint 16.x — quando o componente vive dentro de um scroller
   * HORIZONTAL (carrossel scroll-snap), o touch-action em repouso vira
   * "pan-x pan-y" (swipe entre slides + scroll do feed seguem livres).
   * Default false = "pan-y" (comportamento original do feed vertical).
   */
  allowHorizontalPan?: boolean;
};

type PinchState = {
  initialDistance: number;
  initialScale: number;
  // Midpoint do pinch relativo ao centro do container (não muda durante o
  // gesto — é o anchor capturado no início).
  anchorRelX: number;
  anchorRelY: number;
  initialX: number;
  initialY: number;
};

type PanState = {
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

function getDistance(touches: TouchList) {
  const a = touches[0];
  const b = touches[1];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function getMidpoint(touches: TouchList) {
  const a = touches[0];
  const b = touches[1];
  if (!a || !b) return { x: 0, y: 0 };
  return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function PinchZoomImage({
  alt,
  blurDataUrl,
  className = "",
  priority = false,
  src,
  hqSrc,
  fixedAspectRatio,
  allowHorizontalPan = false,
}: PinchZoomImageProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gesture, setGesture] = useState<"none" | "pinch" | "pan">("none");
  const [aspectRatio, setAspectRatio] = useState(fixedAspectRatio ?? 4 / 5);
  // Sprint 2.2: se o src já foi visto nesta sessão, pula o fade-in.
  // Sensação instant ao rever um post (ex.: reabrir feed após sair).
  const [loaded, setLoaded] = useState(() => hasImageLoaded(src));
  // Sprint 3.6 bug fix: começa exibindo o `src` (thumb 640px → paint
  // imediato). Quando `hqSrc` (1920px) decodificar em background, faz
  // upgrade automático sem flash. Cooperativo com o `loaded` da 2.2 —
  // ambos sobrevivem.
  const [displayedSrc, setDisplayedSrc] = useState(src);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const panRef = useRef<PanState | null>(null);

  // Quando o src trocar (ex.: edit de post), reseta loaded check e
  // volta a exibir o thumb (recomeça o upgrade pra HQ no próximo effect).
  // Sprint 16: ajuste DURANTE o render (padrão "adjusting state when
  // props change") em vez de useEffect pós-paint — elimina o frame com
  // a imagem anterior aplicada ao src novo.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setLoaded(hasImageLoaded(src));
    setDisplayedSrc(src);
  }

  // Sprint 3.6: progressive HQ swap. `Image.decode()` é a API canônica pra
  // evitar flash — o browser garante que o bitmap está pronto antes da
  // promessa resolver. Se o user já estava vendo `src` (thumb), a troca
  // pro `hqSrc` é uma trocada de buffer GPU (mesmo cropped, mesma
  // proporção, só mais nítido). Sem race condition: `cancelled` flag
  // cobre o caso do user scrollar pra outro post antes do decode terminar.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hqSrc || hqSrc === src) return;
    let cancelled = false;
    const img = new window.Image();
    img.decoding = "async";
    img.src = hqSrc;
    img
      .decode()
      .then(() => {
        if (cancelled) return;
        // Adiciona ao cache global pra próximas montagens pularem o thumb.
        markImageLoaded(hqSrc);
        setDisplayedSrc(hqSrc);
      })
      .catch(() => {
        // CORS, 404, etc — mantém o thumb. Sem ruído no console porque o
        // feed continua funcional e o user nem percebe.
      });
    return () => {
      cancelled = true;
    };
  }, [src, hqSrc]);

  function getRect() {
    return (
      containerRef.current?.getBoundingClientRect() ?? {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
      }
    );
  }

  function clampOffset(x: number, y: number, currentScale: number) {
    const rect = getRect();
    const maxX = Math.max(0, (rect.width * (currentScale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (currentScale - 1)) / 2);
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  }

  function startGesture(event: globalThis.TouchEvent) {
    if (event.touches.length === 2) {
      // Inicia pinch — captura anchor no midpoint dos 2 dedos.
      const rect = getRect();
      const mid = getMidpoint(event.touches);
      pinchRef.current = {
        initialDistance: getDistance(event.touches),
        initialScale: scale,
        anchorRelX: mid.x - rect.left - rect.width / 2,
        anchorRelY: mid.y - rect.top - rect.height / 2,
        initialX: offset.x,
        initialY: offset.y,
      };
      panRef.current = null;
      setGesture("pinch");
    } else if (event.touches.length === 1 && scale > MIN_SCALE) {
      // Pan só faz sentido com zoom aplicado.
      const touch = event.touches[0]!;
      panRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        initialX: offset.x,
        initialY: offset.y,
      };
      pinchRef.current = null;
      setGesture("pan");
    }
  }

  function moveGesture(event: globalThis.TouchEvent) {
    if (event.touches.length === 2 && pinchRef.current) {
      const distance = getDistance(event.touches);
      if (distance <= 0) return;
      const ratio = distance / pinchRef.current.initialDistance;
      const nextScale = clamp(
        pinchRef.current.initialScale * ratio,
        MIN_SCALE,
        MAX_SCALE,
      );
      // Anchor math: mantém midpoint capturado fixo na tela.
      const r = nextScale / pinchRef.current.initialScale;
      const rawX =
        pinchRef.current.anchorRelX * (1 - r) + pinchRef.current.initialX * r;
      const rawY =
        pinchRef.current.anchorRelY * (1 - r) + pinchRef.current.initialY * r;
      const clamped = clampOffset(rawX, rawY, nextScale);
      setScale(nextScale);
      setOffset(clamped);
    } else if (event.touches.length === 1 && panRef.current && scale > MIN_SCALE) {
      const touch = event.touches[0]!;
      const dx = touch.clientX - panRef.current.startX;
      const dy = touch.clientY - panRef.current.startY;
      const clamped = clampOffset(
        panRef.current.initialX + dx,
        panRef.current.initialY + dy,
        scale,
      );
      setOffset(clamped);
    }
  }

  function endGesture(event: globalThis.TouchEvent) {
    if (event.touches.length === 0) {
      // Soltou tudo — reset suave (volta pra scale=1 e centraliza). A
      // transição CSS (220ms ease iOS) anima o retorno.
      pinchRef.current = null;
      panRef.current = null;
      setGesture("none");
      setScale(MIN_SCALE);
      setOffset({ x: 0, y: 0 });
      return;
    }
    if (event.touches.length === 1 && gesture === "pinch") {
      // Transição pinch → pan: o user soltou um dedo mas continua tocando.
      // Trocamos pra pan mantendo scale atual, sem reset.
      pinchRef.current = null;
      const touch = event.touches[0]!;
      if (scale > MIN_SCALE) {
        panRef.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          initialX: offset.x,
          initialY: offset.y,
        };
        setGesture("pan");
      } else {
        setGesture("none");
      }
    }
  }

  function updateAspectRatio(image: HTMLImageElement) {
    // Frame travado (carrossel): não adota o aspecto natural — slides de
    // aspectos diferentes manteriam o trilho estável.
    if (fixedAspectRatio != null) return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return;
    // Limites tipo Instagram: portrait até 4:5, landscape até 1.91:1.
    setAspectRatio(clamp(width / height, 4 / 5, 1.91));
  }

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    updateAspectRatio(event.currentTarget);
    // Sprint 2.2: marca no cache global + dispara crossfade local. Usa
    // `displayedSrc` (não `src`) pra que, quando a HQ rolar via Sprint 3.6,
    // o cache fique com a chave do que está REALMENTE no DOM.
    markImageLoaded(displayedSrc);
    setLoaded(true);
  }

  // touch-action:
  // - durante gesture (pinch/pan): "none" — bloqueia scroll do feed pra que
  //   o WebView não roube o movimento de pan.
  // - com zoom ativo (scale > 1) mas sem gesto: "none" — user vai mover.
  // - sem zoom e sem gesto: "pan-y" no feed vertical; "pan-x pan-y" dentro
  //   do carrossel (senão o swipe horizontal entre slides morre — era o
  //   "zoom não funciona no carrossel": pan-y bloqueava o trilho E o
  //   scroll-snap roubava a pinça).
  const restTouchAction = allowHorizontalPan ? "pan-x pan-y" : "pan-y";
  const touchAction =
    gesture !== "none" || scale > MIN_SCALE ? "none" : restTouchAction;

  // Sprint 2.2: fundo do container vira o blur placeholder enquanto
  // a imagem decode. Quando há blurDataUrl, usa como background-image;
  // sem ele, o solid #0c0d0e do tema cobre. NUNCA tela preta vazia.
  const containerStyle: React.CSSProperties = {
    aspectRatio,
    touchAction,
    backgroundColor: "#0c0d0e",
    ...(blurDataUrl
      ? {
          backgroundImage: `url(${blurDataUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
  };

  // Sprint 16.x (zoom no carrossel) — listeners NATIVOS não-passivos em
  // vez dos props onTouch* do React (que são passivos: preventDefault não
  // funciona). Dentro do scroll-snap horizontal, sem preventDefault o
  // container ROUBA o gesto de pinça como scroll — era por isso que o
  // zoom "não funcionava" no carrossel. preventDefault só dispara com
  // 2 dedos ou gesto ativo; toque/swipe de 1 dedo segue natural.
  // Ref-delegation: bind 1x, handlers sempre frescos (closures do render).
  const startGestureRef = useRef(startGesture);
  const moveGestureRef = useRef(moveGesture);
  const endGestureRef = useRef(endGesture);
  // Sincroniza pós-render (mutar ref DURANTE o render viola
  // react-hooks/refs); eventos de toque só disparam depois do paint,
  // então o effect sem deps mantém os handlers sempre frescos.
  useEffect(() => {
    startGestureRef.current = startGesture;
    moveGestureRef.current = moveGesture;
    endGestureRef.current = endGesture;
  });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const hasActiveGesture = () =>
      pinchRef.current !== null || panRef.current !== null;
    const onStart = (e: globalThis.TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
      startGestureRef.current(e);
    };
    const onMove = (e: globalThis.TouchEvent) => {
      if (e.touches.length >= 2 || hasActiveGesture()) e.preventDefault();
      moveGestureRef.current(e);
    };
    const onEnd = (e: globalThis.TouchEvent) => {
      endGestureRef.current(e);
    };
    node.addEventListener("touchstart", onStart, { passive: false });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd, { passive: true });
    node.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={[
        "relative w-full overflow-hidden",
        "select-none",
        className,
      ].join(" ")}
      data-gc-no-screen-swipe
      style={containerStyle}
    >
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transition:
            gesture !== "none"
              ? "none"
              : "transform 220ms var(--gc-ease-ios)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className="h-full w-full object-cover"
          draggable={false}
          onLoad={handleImageLoad}
          loading={priority ? "eager" : "lazy"}
          src={displayedSrc}
          style={{
            // Sprint 2.2: crossfade — opacity 0 enquanto decode, 1 quando
            // onLoad dispara. Background do container (blur ou solid)
            // cobre o gap visual. Sprint 3.6: `displayedSrc` faz o upgrade
            // pro 1920px após o thumb (640px) entrar — sem flash porque
            // `Image.decode()` garante GPU buffer pronto antes da troca.
            opacity: loaded ? 1 : 0,
            transition: "opacity 280ms var(--gc-ease-ios, ease-out)",
          }}
        />
      </div>
    </div>
  );
}
