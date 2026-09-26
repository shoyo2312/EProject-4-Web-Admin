"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRefreshScheduler } from "@/lib/live-refresh";

/**
 * Re-renders the current page when the backend says something changed. Only a visible tab holds a
 * stream: hidden tabs would otherwise use up the browser's six connections per origin, and the
 * refresh on return catches up on anything missed, including the trash expiry warning, which is a
 * date passing rather than an event.
 *
 * A catch-up refresh waits for the stream to open: after a long absence the access cookie has
 * lapsed, and a refresh sent alongside the stream request would race it for the middleware's
 * single-use token rotation. An error cancels a refresh still pending, because while chat-service
 * is down the relay opens and fails within a second, and each retry would otherwise re-render.
 */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const scheduler = createRefreshScheduler({ refresh: () => router.refresh() });
    let source: EventSource | null = null;
    let stale = false;

    const connect = () => {
      source = new EventSource("/api/live");
      source.onmessage = () => scheduler.request();
      source.onerror = () => {
        stale = true;
        scheduler.cancel();
      };
      source.onopen = () => {
        if (!stale) return;
        stale = false;
        scheduler.request();
      };
    };

    const disconnect = () => {
      source?.close();
      source = null;
      scheduler.cancel();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        disconnect();
        return;
      }
      if (source && source.readyState !== EventSource.CLOSED) return;
      stale = true;
      connect();
    };

    if (document.visibilityState === "visible") connect();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      disconnect();
    };
  }, [router]);

  return null;
}
