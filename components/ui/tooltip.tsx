"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A hover/focus label for controls that show only an icon.
 *
 * Rendered through a portal with `position: fixed` on purpose: the places that need it — the
 * collapsed sidebar rail, an icon button in a scrolling table — sit inside an `overflow` box that
 * would clip a normal CSS flyout. Coordinates are read from the wrapped element on enter, so there
 * is nothing to keep in sync while it is hidden.
 *
 * The wrapper is `display: contents`, so it adds no box of its own; the rect comes from the single
 * child it wraps.
 */
export function Tooltip({
  label,
  placement = "top",
  children,
}: {
  label: string;
  placement?: "top" | "right";
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  function show() {
    const el = ref.current?.firstElementChild ?? ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords(
      placement === "right"
        ? { x: r.right + 8, y: r.top + r.height / 2 }
        : { x: r.left + r.width / 2, y: r.top - 8 },
    );
  }

  const hide = () => setCoords(null);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="contents"
    >
      {children}
      {coords && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{ left: coords.x, top: coords.y }}
              className={cn(
                "pointer-events-none fixed z-[60] whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-surface shadow-md",
                placement === "right"
                  ? "-translate-y-1/2"
                  : "-translate-x-1/2 -translate-y-full",
              )}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
