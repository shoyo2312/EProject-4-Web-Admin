/** The first request opens a window; everything inside it becomes the one refresh at its end. */
export function createRefreshScheduler({
  refresh,
  windowMs = 1000,
}: {
  refresh: () => void;
  windowMs?: number;
}) {
  let timer: ReturnType<typeof setTimeout> | null = null;

  return {
    request() {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        refresh();
      }, windowMs);
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/** The pages that show likes, comments and shares: the only ones an engagement frame refreshes. */
const ENGAGEMENT_PAGES = /^\/(analytics|dashboard|videos\/[^/]+)\/?$/;

/**
 * Engagement frames come at the pace people like and comment, so a page that shows none of it
 * ignores them rather than re-reading its own data every second. Every other frame refreshes.
 */
export function refreshesPage(data: string, pathname: string): boolean {
  let type = "";
  try {
    type = String(JSON.parse(data)?.type ?? "");
  } catch {
    // Not a frame we know: refresh, as before the filter.
  }
  return !type.startsWith("interaction.") || ENGAGEMENT_PAGES.test(pathname);
}
