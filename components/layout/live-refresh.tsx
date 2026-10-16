"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRefreshScheduler } from "@/lib/live-refresh";
import { createLiveStream } from "@/lib/live-stream";

/** Re-renders the current page when the backend says something changed; see lib/live-stream.ts. */
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const stream = createLiveStream({
      open: () => new EventSource("/api/live"),
      scheduler: createRefreshScheduler({ refresh: () => router.refresh() }),
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") stream.show(true);
      else stream.hide();
    };

    if (document.visibilityState === "visible") stream.show(false);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stream.hide();
    };
  }, [router]);

  return null;
}
