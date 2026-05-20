"use client";

import { type TouchEvent, useRef, useState } from "react";

type PinchZoomImageProps = {
  alt: string;
  className?: string;
  priority?: boolean;
  sizes?: string;
  src: string;
};

function getTouchDistance(touches: TouchEvent<HTMLDivElement>["touches"]) {
  const first = touches[0];
  const second = touches[1];
  if (!first || !second) return 0;
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
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
  const [pinching, setPinching] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(4 / 5);
  const gestureRef = useRef({ distance: 0, scale: 1 });

  function startPinch(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) return;
    gestureRef.current = {
      distance: getTouchDistance(event.touches),
      scale,
    };
    setPinching(true);
  }

  function movePinch(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2 || gestureRef.current.distance <= 0) {
      endPinch();
      return;
    }
    const nextScale =
      gestureRef.current.scale * (getTouchDistance(event.touches) / gestureRef.current.distance);
    setScale(clamp(nextScale, 1, 3));
  }

  function endPinch() {
    setPinching(false);
    gestureRef.current = { distance: 0, scale: 1 };
    setScale(1);
  }

  function updateAspectRatio(image: HTMLImageElement) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return;
    // Instagram-like feed bounds: portrait up to 4:5, landscape up to 1.91:1.
    setAspectRatio(clamp(width / height, 4 / 5, 1.91));
  }

  return (
    <div
      className={[
        "relative w-full overflow-hidden bg-black",
        "select-none",
        className,
      ].join(" ")}
      data-gc-no-screen-swipe
      onTouchCancel={endPinch}
      onTouchEnd={endPinch}
      onTouchMove={movePinch}
      onTouchStart={startPinch}
      style={{ aspectRatio, touchAction: pinching ? "none" : "pan-y" }}
    >
      <div
        className="absolute inset-0 will-change-transform"
        style={{
          transform: `scale(${scale})`,
          transition: pinching ? "none" : "transform 220ms var(--gc-ease-ios)",
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
