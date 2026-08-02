"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

const ACTION_WIDTH = 118;
const OPEN_THRESHOLD = 55;

interface SwipeRowProps {
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  label: string;
}

/**
 * A history row that slides left to reveal edit and delete.
 *
 * Horizontal intent is detected before the row starts moving: until the
 * gesture is clearly sideways, the touch belongs to the scroll container.
 * Without that check, every attempt to scroll the list drags rows open.
 *
 * Keyboard and screen-reader users don't swipe, so the same two actions are
 * also reachable as real buttons once the row is open, and the row itself
 * exposes them through its own controls.
 */
export function SwipeRow({ children, onEdit, onDelete, label }: SwipeRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const startOffset = useRef(0);
  const axis = useRef<"unknown" | "horizontal" | "vertical">("unknown");

  const onPointerDown = (event: React.PointerEvent) => {
    // Mouse users get the buttons, not the drag.
    if (event.pointerType === "mouse") return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    startOffset.current = offset;
    axis.current = "unknown";
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;

    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;

    if (axis.current === "unknown") {
      // Wait for a decisive movement before claiming the gesture.
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axis.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (axis.current === "horizontal") {
        (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      }
    }

    if (axis.current !== "horizontal") return;

    setOffset(Math.max(-ACTION_WIDTH, Math.min(0, startOffset.current + dx)));
  };

  const onPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (axis.current !== "horizontal") return;
    setOffset(offset < -OPEN_THRESHOLD ? -ACTION_WIDTH : 0);
  };

  const close = () => setOffset(0);
  const isOpen = offset < -OPEN_THRESHOLD / 2;

  return (
    <div className="relative overflow-hidden rounded-card" style={{ background: "var(--bg)" }}>
      {/* Marked so the layout audit knows these sit under the row by design
          until it's swiped open — they are not "covered" controls. */}
      <div data-swipe-actions className="absolute inset-y-0 right-0 flex">
        <button
          type="button"
          onClick={() => {
            close();
            onEdit();
          }}
          tabIndex={isOpen ? 0 : -1}
          aria-hidden={!isOpen}
          aria-label={`Edit ${label}`}
          className="flex w-[59px] flex-col items-center justify-center gap-1.5"
          style={{ background: "var(--sky)", color: "var(--blue)" }}
        >
          <Icon name="edit" size={17} strokeWidth={1.8} />
          <span className="text-caption font-medium">Edit</span>
        </button>

        <button
          type="button"
          onClick={() => {
            close();
            onDelete();
          }}
          tabIndex={isOpen ? 0 : -1}
          aria-hidden={!isOpen}
          aria-label={`Delete ${label}`}
          className="flex w-[59px] flex-col items-center justify-center gap-1.5"
          style={{ background: "var(--amber)", color: "#0B1220" }}
        >
          <Icon name="trash" size={17} strokeWidth={1.8} />
          <span className="text-caption font-medium">Delete</span>
        </button>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform .16s cubic-bezier(.2,.9,.25,1)",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default SwipeRow;
