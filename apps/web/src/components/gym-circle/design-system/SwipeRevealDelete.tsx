"use client";

import {
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
  useRef,
  useState,
} from "react";
import { Trash2 } from "lucide-react";

type SwipeRevealDeleteProps = {
  children: ReactNode;
  deleteLabel: string;
  onDelete: () => void | Promise<void>;
  actionClassName?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  revealWidth?: number;
};

const DEFAULT_REVEAL_WIDTH = 76;

export function SwipeRevealDelete({
  children,
  deleteLabel,
  onDelete,
  actionClassName = "",
  className = "",
  contentClassName = "",
  disabled = false,
  revealWidth = DEFAULT_REVEAL_WIDTH,
}: SwipeRevealDeleteProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const dragRef = useRef({
    activeTouchId: -1,
    pointerId: -1,
    startOffset: 0,
    startX: 0,
    startY: 0,
    tracking: false,
    dragging: false,
  });
  const suppressClickRef = useRef(false);

  const isOpen = offset < 0;

  function setClampedOffset(nextOffset: number) {
    const clamped = Math.min(0, Math.max(-revealWidth, nextOffset));
    offsetRef.current = clamped;
    setOffset(clamped);
  }

  function beginDrag(clientX: number, clientY: number, pointerId = -1, touchId = -1) {
    dragRef.current = {
      activeTouchId: touchId,
      pointerId,
      startOffset: offsetRef.current,
      startX: clientX,
      startY: clientY,
      tracking: true,
      dragging: false,
    };
  }

  function moveDrag(clientX: number, clientY: number, preventDefault: () => void) {
    const drag = dragRef.current;
    if (!drag.tracking || disabled) return;

    const dx = clientX - drag.startX;
    const dy = clientY - drag.startY;

    if (!drag.dragging) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.tracking = false;
        setDragging(false);
        return;
      }
      drag.dragging = true;
      setDragging(true);
    }

    preventDefault();
    suppressClickRef.current = true;
    setClampedOffset(drag.startOffset + dx);
  }

  function endDrag() {
    const drag = dragRef.current;
    if (!drag.tracking) return;

    const shouldOpen = offsetRef.current <= -revealWidth * 0.42;
    setClampedOffset(shouldOpen ? -revealWidth : 0);
    setDragging(false);
    dragRef.current = {
      ...drag,
      activeTouchId: -1,
      pointerId: -1,
      tracking: false,
      dragging: false,
    };

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 120);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      disabled ||
      event.pointerType === "touch" ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }
    beginDrag(event.clientX, event.clientY, event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    moveDrag(event.clientX, event.clientY, () => event.preventDefault());
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag.pointerId !== event.pointerId) return;
    endDrag();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }
  }

  function getTouch(event: TouchEvent<HTMLDivElement>) {
    const touchId = dragRef.current.activeTouchId;
    const touches = Array.from(event.touches);
    return (
      touches.find((touch) => touch.identifier === touchId) ??
      touches[0] ??
      Array.from(event.changedTouches).find((touch) => touch.identifier === touchId) ??
      event.changedTouches[0] ??
      null
    );
  }

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (disabled || event.touches.length !== 1) return;
    const touch = event.touches[0];
    beginDrag(touch.clientX, touch.clientY, -1, touch.identifier);
  }

  function handleTouchMove(event: TouchEvent<HTMLDivElement>) {
    const touch = getTouch(event);
    if (!touch) return;
    moveDrag(touch.clientX, touch.clientY, () => event.preventDefault());
  }

  function handleTouchEnd() {
    endDrag();
  }

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (isOpen) {
      setClampedOffset(0);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  }

  async function handleDelete() {
    if (disabled) return;
    setClampedOffset(0);
    await onDelete();
  }

  return (
    <div
      className={["relative overflow-hidden", className].join(" ")}
      data-gc-no-screen-swipe
    >
      <div
        aria-hidden={!isOpen}
        className={[
          "absolute inset-y-0 right-0 flex items-center justify-center",
          actionClassName,
        ].join(" ")}
        style={{ width: revealWidth }}
      >
        <button
          aria-label={deleteLabel}
          className="gc-pressable grid size-12 place-items-center rounded-full bg-[var(--gc-pink)]/18 text-[var(--gc-pink)] shadow-[0_0_24px_rgba(255,45,85,0.16)] disabled:opacity-45"
          disabled={disabled}
          onClick={handleDelete}
          tabIndex={isOpen ? 0 : -1}
          type="button"
        >
          <Trash2 size={18} strokeWidth={2.6} />
        </button>
      </div>
      <div
        className={contentClassName}
        onClickCapture={handleClickCapture}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onTouchCancel={handleTouchEnd}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        onTouchStart={handleTouchStart}
        style={{
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging
            ? "none"
            : "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
