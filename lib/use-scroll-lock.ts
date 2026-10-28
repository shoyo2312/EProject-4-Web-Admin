"use client";

import { useEffect, type RefObject } from "react";
import { hasRoomToScroll } from "@/lib/scroll-lock";

const SCROLLS = /auto|scroll/;

/** Whether the event lands on a box inside `overlay` that can still move `dx`/`dy` itself. */
function scrollsInside(target: EventTarget | null, overlay: HTMLElement, dx: number, dy: number) {
  let node = target instanceof Element ? target : null;
  while (node && overlay.contains(node)) {
    const style = getComputedStyle(node);
    if (
      (SCROLLS.test(style.overflowY) &&
        hasRoomToScroll(node.scrollTop, node.scrollHeight, node.clientHeight, dy)) ||
      (SCROLLS.test(style.overflowX) &&
        hasRoomToScroll(node.scrollLeft, node.scrollWidth, node.clientWidth, dx))
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

/**
 * Keeps the page behind a modal still while it is open. A wheel or a swipe over the backdrop — or
 * over any part of the dialog that does not scroll — otherwise falls through to the page, which
 * then moves under a modal that is supposed to have the whole screen.
 *
 * Not `overflow: hidden` on the page: the console keeps its scrollbar track up at all times
 * (globals.css), and taking it away for a modal shifts everything behind the backdrop sideways.
 * The events are cancelled instead, unless something inside the modal still has room to scroll
 * the way they go. Pinch-to-zoom — a wheel with ctrl held, on a trackpad — is left to the browser.
 */
export function useScrollLock(overlay: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = overlay.current;
    if (!element) return;
    let x = 0;
    let y = 0;

    function onWheel(event: WheelEvent) {
      if (event.ctrlKey || !element) return;
      if (!scrollsInside(event.target, element, event.deltaX, event.deltaY)) event.preventDefault();
    }
    function onTouchStart(event: TouchEvent) {
      x = event.touches[0].clientX;
      y = event.touches[0].clientY;
    }
    function onTouchMove(event: TouchEvent) {
      if (event.touches.length > 1 || !element) return;
      const touch = event.touches[0];
      // A finger moving up scrolls the content down.
      const dx = x - touch.clientX;
      const dy = y - touch.clientY;
      x = touch.clientX;
      y = touch.clientY;
      if (!scrollsInside(event.target, element, dx, dy)) event.preventDefault();
    }

    // Not React's onWheel: React listens passively, and a passive listener cannot cancel anything.
    element.addEventListener("wheel", onWheel, { passive: false });
    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      element.removeEventListener("wheel", onWheel);
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
    };
  }, [overlay]);
}
