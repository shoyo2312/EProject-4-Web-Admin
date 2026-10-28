"use client";

import { useLayoutEffect, useRef } from "react";
import { figureAt, parseFigure, sameShape } from "@/lib/figure";
import { cn } from "@/lib/utils";

/** How long a figure takes to move to a value that arrives while its page is open. */
const CHANGE_MS = 700;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** The figure lit up where it stands, fading back to its own colours. */
function light(span: HTMLElement) {
  const style = getComputedStyle(span);
  const tint = style.getPropertyValue("--accent-soft").trim();
  span.animate(
    [
      {
        color: style.getPropertyValue("--accent").trim(),
        backgroundColor: tint,
        boxShadow: `0 0 0 4px ${tint}`,
      },
    ],
    { duration: 1400, easing: "ease-out" },
  );
}

/**
 * A figure that counts up from zero as its card rises in, and across to a new value — lit up where
 * it stands — when one arrives while the page is open: a live refresh, another period picked.
 *
 * The count-up is globals.css's `count` animation, so it plays when its card's entrance does and
 * never otherwise: once a page, in view (`EntranceMain`). This only writes out the number its
 * `--count` has reached. The real value is what the server renders, and what stays when nothing
 * runs: reduced motion, a page already seen, a script not loaded yet.
 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);

  useLayoutEffect(() => {
    const span = ref.current;
    if (!span) return;
    const figure = parseFigure(value);
    const before = shown.current === value ? null : parseFigure(shown.current);
    const changed = shown.current !== value;
    shown.current = value;
    let frame = 0;

    const reached = () => {
      const progress = Number.parseFloat(getComputedStyle(span).getPropertyValue("--count"));
      return Number.isFinite(progress) ? progress : 1;
    };
    const follow = () => {
      if (figure) span.textContent = figureAt(figure, reached());
      frame = requestAnimationFrame(follow);
    };
    const isCount = (event: AnimationEvent) =>
      event.target === span && event.animationName === "count";
    const start = (event: AnimationEvent) => {
      if (!isCount(event)) return;
      cancelAnimationFrame(frame);
      follow();
    };
    const end = (event: AnimationEvent) => {
      if (!isCount(event)) return;
      cancelAnimationFrame(frame);
      span.textContent = value;
    };
    span.addEventListener("animationstart", start);
    span.addEventListener("animationend", end);
    span.addEventListener("animationcancel", end);

    // A count already under way is picked up — after a new value, or on the first render while it
    // has barely begun. Further in, the jump from the value shown to the count's would show.
    const counting = span
      .getAnimations()
      .some((a) => a instanceof CSSAnimation && a.animationName === "count" && a.playState === "running");
    const progress = reached();
    if (counting && progress > 0 && progress < (changed ? 1 : 0.2)) {
      follow();
    } else if (changed) {
      light(span);
      const moves = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (figure && before && sameShape(before, figure) && moves) {
        const began = performance.now();
        const step = (now: number) => {
          const t = Math.min((now - began) / CHANGE_MS, 1);
          span.textContent = t < 1 ? figureAt(figure, easeOut(t), before) : value;
          if (t < 1) frame = requestAnimationFrame(step);
        };
        span.textContent = figureAt(figure, 0, before);
        frame = requestAnimationFrame(step);
      }
    }

    return () => {
      span.removeEventListener("animationstart", start);
      span.removeEventListener("animationend", end);
      span.removeEventListener("animationcancel", end);
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <span ref={ref} className={cn("animate-count rounded-sm", className)}>
      {value}
    </span>
  );
}
