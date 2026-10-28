"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createEntranceLog, lateDelayMs } from "@/lib/entrance";
import { cn } from "@/lib/utils";

/** What the `stagger` rules in globals.css rise in: a page's sections, cards and rows of cards. */
const BLOCK = ".stagger > :not(.stagger, [role='status'])";

/** The keyframes of an entrance in globals.css: a block rising in, and the charts in it drawing. */
const ENTRANCE = new Set(["enter", "grow", "fill", "wipe"]);

/**
 * A block held out of view, with the animations it will play: `reported` once the viewport has
 * said it is not there yet. "playing" is a block from the server's HTML, left alone until then.
 */
type Watch = { animations: CSSAnimation[]; reported: boolean } | "playing";

/** A block's own entrance and its charts' — not a nested block's, which is watched on its own. */
function entranceOf(block: HTMLElement): CSSAnimation[] {
  return block
    .getAnimations({ subtree: true })
    .filter(
      (animation): animation is CSSAnimation =>
        animation instanceof CSSAnimation &&
        ENTRANCE.has(animation.animationName) &&
        animation.effect instanceof KeyframeEffect &&
        animation.effect.target?.closest(BLOCK) === block,
    );
}

/** Stopped on its first frame — the block invisible, its charts undrawn — until it is played. */
function hold(animations: CSSAnimation[]) {
  for (const animation of animations) {
    animation.pause();
    animation.currentTime = 0;
  }
}

const inDocumentOrder = (a: Node, b: Node) =>
  a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;

/**
 * The console's <main>, deciding when the blocks of the page in it rise in: only the first time the
 * page is shown in this visit (`lib/entrance.ts`), and each block only once it is in the viewport.
 *
 * Inserted blocks are decided from a MutationObserver, whose callback runs before the browser renders
 * the commit that inserted them, so not one frame of an animation that should not play is painted.
 * A page already shown gets `data-entrance="still"`, which globals.css draws with no animation at all.
 * A block out of view keeps its animation stopped on the first frame, through the Web Animations API
 * rather than a mark: the server's HTML can be held before React has hydrated it, and an attribute
 * React did not render is a hydration mismatch.
 *
 * The server's HTML does not wait for this script: it plays from the first paint, as it always has.
 * Its blocks out of view when the script starts are rewound then — off screen, where nobody sees it.
 */
export function EntranceMain({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const main = ref.current;
    if (!main) return;

    const log = createEntranceLog();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const watching = new Map<HTMLElement, Watch>();

    const viewport = new IntersectionObserver((entries) => {
      const late: HTMLElement[] = [];
      for (const { target, isIntersecting } of entries) {
        const block = target as HTMLElement;
        const watch = watching.get(block);
        if (watch === undefined) continue;
        if (watch === "playing") {
          // Left alone in view; rewound out of it, unless it has already played to the end.
          const animations = isIntersecting ? [] : entranceOf(block);
          if (animations.length === 0) {
            forget(block);
            continue;
          }
          hold(animations);
          watching.set(block, { animations, reported: true });
        } else if (!isIntersecting) {
          watch.reported = true;
        } else if (watch.reported) {
          late.push(block);
        } else {
          // In view as it arrived: the page's own cascade, from globals.css, plays it.
          for (const animation of watch.animations) animation.play();
          forget(block);
        }
      }
      // Blocks that scroll in together fan out from the first of them, not from where they stand
      // in the page's cascade: that is up to a third of a second of empty space at the bottom edge.
      late.sort(inDocumentOrder).forEach((block, order) => {
        const watch = watching.get(block);
        if (watch === undefined || watch === "playing") return;
        for (const animation of watch.animations) {
          if (animation.effect instanceof KeyframeEffect && animation.effect.target === block) {
            animation.effect.updateTiming({ delay: lateDelayMs(order) });
          }
          animation.play();
        }
        forget(block);
      });
    });

    const watch = (block: HTMLElement, state: Watch) => {
      watching.set(block, state);
      // Observing a target twice is a no-op, and a block moved in the DOM still needs a first report.
      viewport.unobserve(block);
      viewport.observe(block);
    };
    const forget = (block: HTMLElement) => {
      watching.delete(block);
      viewport.unobserve(block);
    };

    const mutations = new MutationObserver((records) => {
      // Next has pushed the new URL by now: it does so while committing, before this callback runs.
      log.at(location.pathname, location.search);
      for (const block of watching.keys()) if (!block.isConnected) forget(block);

      const arrived = new Set<HTMLElement>();
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLElement) || !node.isConnected) continue;
          if (node.matches(BLOCK)) arrived.add(node);
          for (const block of node.querySelectorAll<HTMLElement>(BLOCK)) arrived.add(block);
        }
      }
      if (arrived.size === 0) return;

      const plays = log.arrive() && !reduced.matches;
      for (const block of arrived) {
        if (!plays) {
          block.dataset.entrance = "still";
          continue;
        }
        const animations = entranceOf(block);
        if (animations.length === 0) continue;
        hold(animations);
        watch(block, { animations, reported: false });
      }
    });

    log.at(location.pathname, location.search);
    const present = main.querySelectorAll<HTMLElement>(BLOCK);
    if (present.length > 0) log.arrive();
    if (!reduced.matches) {
      // "still" is left by an earlier run of this effect: Fast Refresh, or a remount in development.
      for (const block of present) if (block.dataset.entrance !== "still") watch(block, "playing");
    }
    mutations.observe(main, { childList: true, subtree: true });

    return () => {
      mutations.disconnect();
      viewport.disconnect();
      // Nothing may stay stopped on its first frame once nobody is watching for it to come into view.
      for (const watch of watching.values()) {
        if (watch !== "playing") for (const animation of watch.animations) animation.play();
      }
    };
  }, []);

  return (
    <main ref={ref} className={cn("stagger", className)}>
      {children}
    </main>
  );
}
