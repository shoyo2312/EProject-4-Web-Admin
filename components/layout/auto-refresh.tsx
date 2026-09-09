"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Background re-fetch for every admin page. The pages are server components that
 * read once at request time, so a change made elsewhere — another admin taking a
 * video down, a moderation event landing in the backend — is invisible until a
 * manual reload. This fires `router.refresh()` on an interval instead.
 *
 * It re-runs the server render only; client state (search box, sort, an open
 * reason form) is preserved. Paused while the tab is hidden so a backgrounded
 * console is not polling the gateway every few seconds forever.
 *
 * This is deliberately dumb polling, not a live channel: an admin console with a
 * handful of viewers does not need push, and 15s stale is fine for moderation
 * work. ponytail: swap for SSE only if the row count or viewer count makes the
 * poll cost real.
 */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    // Catch up immediately on returning to the tab rather than waiting out the
    // rest of the interval on stale data.
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);

  return null;
}
