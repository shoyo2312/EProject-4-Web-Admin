/**
 * Whether a page's blocks rise in as they arrive: only the first time the page is shown in this
 * visit to the console. Coming back to it — from the sidebar, the back button, another filter, the
 * next page of a table — finds it already standing. A visit is one load of the console, so a reload
 * plays the page again.
 *
 * A page counts as shown once some of its blocks were inserted, not when its URL was: leaving a page
 * while its loading state is still up keeps its entrance for the next time.
 */
export function createEntranceLog() {
  const shown = new Set<string>();
  let url: string | undefined;
  let path = "";
  let plays = true;

  return {
    /**
     * The console is at this URL now. A URL other than last time's starts a new view, and the view
     * plays only if its path has not been shown: the query is a filter, not another page.
     */
    at(pathname: string, search: string) {
      if (pathname + search === url) return;
      url = pathname + search;
      path = pathname;
      plays = !shown.has(pathname);
    },

    /** Blocks of the current view were inserted: whether they play. The page now counts as shown. */
    arrive(): boolean {
      shown.add(path);
      return plays;
    },
  };
}

/** The beat between two blocks, as `--beat` steps in globals.css: change both together. */
export const BEAT_MS = 70;

/**
 * When the `order`-th of the blocks that scrolled into view together starts, counting from 0 in
 * document order. Capped like the page's own cascade, so a long jump down does not leave the last
 * block waiting.
 */
export function lateDelayMs(order: number): number {
  return Math.min(order, 5) * BEAT_MS;
}

/**
 * How long after its chart starts the `index`-th of `count` marks draws — bars, rows — so they go in
 * one after another, left to right. The whole run fits in about a third of a second, however many
 * marks there are; a short run keeps a readable step between them instead of spreading it out.
 */
export function spreadMs(index: number, count: number): number {
  const step = Math.min(45, 360 / Math.max(count - 1, 1));
  return Math.round(index * step);
}

/** How long `--animate-wipe` in globals.css takes to draw a line across its chart: change both together. */
export const DRAW_MS = 1200;

/**
 * When a line being drawn reaches `fraction` of the way across its chart, 0 to 1, so a point on it
 * can appear as the line gets there rather than waiting on the empty chart ahead of it. The inverse
 * of `--ease-draw`, which an ease-out cubic matches closely enough for the eye.
 */
export function drawnAtMs(fraction: number): number {
  return Math.round(DRAW_MS * (1 - Math.cbrt(1 - fraction)));
}
