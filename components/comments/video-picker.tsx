"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MessageSquareOff, Search } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { AdminVideoResponse } from "@/lib/api/types";
import { formatCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Which video's thread to read. There is no platform-wide comment list to page through —
 * comments_by_video is partitioned by video — so choosing a video is the first step, not a filter
 * applied to something broader.
 */
export function VideoPicker({
  videos,
  query,
  selectedId,
}: {
  videos: AdminVideoResponse[];
  query: string;
  selectedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(query);
  const [navigating, startNavigation] = useTransition();

  // Debounced, same as the other directories: every keystroke would otherwise be a round trip
  // through the gateway to video-service.
  useEffect(() => {
    if (term === query) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (term.trim()) next.set("q", term.trim());
      else next.delete("q");
      // The selected video is dropped: it is almost certainly not in the new result set, and
      // leaving a thread on screen that the list beside it no longer contains reads as a bug.
      next.delete("videoId");
      startNavigation(() => router.replace(`${pathname}?${next}` as never));
    }, 350);
    return () => clearTimeout(timer);
  }, [term, query, pathname, params, router]);

  function select(videoId: string) {
    const next = new URLSearchParams(params);
    next.set("videoId", videoId);
    startNavigation(() => router.replace(`${pathname}?${next}` as never));
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Pick a video"
        hint="Threads are read per video — Cassandra partitions comments by video id"
      />

      <div className="border-b border-line px-4 py-3">
        <label className="flex items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search title..."
            className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
          />
        </label>
      </div>

      <div
        className={cn(
          // Stacked above the thread below lg, so a tall list would bury the comments.
          "max-h-[320px] flex-1 overflow-y-auto transition-opacity lg:max-h-[560px]",
          navigating && "opacity-50",
        )}
      >
        {videos.map((video) => (
          <button
            key={video.id}
            type="button"
            onClick={() => select(video.id)}
            className={cn(
              "flex w-full items-start gap-2 border-b border-line px-4 py-2.5 text-left text-[11px] transition-colors last:border-b-0",
              video.id === selectedId ? "bg-surface-muted" : "hover:bg-surface-muted",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{video.title}</span>
              <span className="text-ink-faint">
                {video.commentsDisabled ? (
                  <span className="inline-flex items-center gap-1 text-pending">
                    <MessageSquareOff className="h-3 w-3" />
                    comments off
                  </span>
                ) : (
                  // Null only happens with comments off, which the branch above covers.
                  `${formatCompact(video.commentCount ?? 0)} comments`
                )}
              </span>
            </span>
          </button>
        ))}

        {videos.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-ink-faint">
            No uploads match that search.
          </p>
        ) : null}
      </div>
    </Card>
  );
}
