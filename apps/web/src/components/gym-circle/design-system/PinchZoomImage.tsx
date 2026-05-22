"use client";

import { type TouchEvent, useRef, useState } from "react";

/**
 * PinchZoomImage — Sprint 3 / pós-3.4.
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
  src: string;
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

function getDistance(touches: TouchEvent<HTMLDivElement>["touches"]) {
  const a = touches[0];
  const b = touches[1];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function getMidpoint(touches: TouchEvent<HTMLDivElement>["touches"]) {
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
  className = "",
  priority = false,
  src,
}: PinchZoomImageProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [gesture, setGesture] = useState<"none" | "pinch" | "pan">("none");
  const [aspectRatio, setAspectRatio] = useState(4 / 5);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pinchRef = useRef<PinchState | null>(null);
  const panRef = useRef<PanState | null>(null);

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

  function startGesture(event: TouchEvent<HTMLDivElement>) {
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

  function moveGesture(event: TouchEvent<HTMLDivElement>) {
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

  function endGesture(event: TouchEvent<HTMLDivElement>) {
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
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return;
    // Limites tipo Instagram: portrait até 4:5, landscape até 1.91:1.
    setAspectRatio(clamp(width / height, 4 / 5, 1.91));
  }

  // touch-action:
  // - durante gesture (pinch/pan): "none" — bloqueia scroll do feed pra que
  //   o WebView não roube o movimento de pan.
  // - com zoom ativo (scale > 1) mas sem gesto: "none" — user vai mover.
  // - sem zoom e sem gesto: "pan-y" — deixa scroll vertical natural.
  const touchAction =
    gesture !== "none" || scale > MIN_SCALE ? "none" : "pan-y";

  return (
    <div
      ref={containerRef}
      className={[
        "relative w-full overflow-hidden bg-black",
        "select-none",
        className,
      ].join(" ")}
      data-gc-no-screen-swipe
      onTouchCancel={endGesture}
      onTouchEnd={endGesture}
      onTouchMove={moveGesture}
      onTouchStart={startGesture}
      style={{ aspectRatio, touchAction }}
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
          onLoad={(event) => updateAspectRatio(event.currentTarget)}
          loading={priority ? "eager" : "lazy"}
          src={src}
        />
      </div>
    </div>
  );
}
