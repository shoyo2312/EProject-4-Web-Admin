"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flag, MessageSquareOff } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchBox } from "@/components/ui/search-box";
import { VideoThumb } from "@/components/videos/video-thumb";
import type { AdminVideoResponse } from "@/lib/api/types";
import { formatCompact, formatNumber, plural } from "@/lib/format";
import { VIDEO_STATUS_LABELS } from "@/lib/labels";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";

/**
 * Where the page's two ways in sit side by side: what is waiting on a decision, and any video's
 * thread. There is no platform-wide comment list to page through — comments_by_video is partitioned
 * by video — so a thread that nobody reported has to be reached through its video.
 *
 * Stuck beside the thread on a wide screen, because a thread is long and the way to the next video
 * should not be back at the top of it. Folded away on a narrow one, where it would bury the thread.
 */
export function VideoPicker({
  videos,
  total,
  query,
  selectedId,
  handles,
  reportedPerVideo,
  waiting,
}: {
  videos: AdminVideoResponse[];
  /** How many videos match, of which `videos` is the top of the list. */
  total: number;
  query: string;
  selectedId: string | null;
  /** Owners' @handles by user id. A title alone cannot tell nine videos called "TikTok video" apart. */
  handles: Record<string, string>;
  reportedPerVideo: Record<string, number>;
  /** Reported comments waiting across the platform, already worded; null if the queue is unread. */
  waiting: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [navigating, startNavigation] = useTransition();
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // A video opened from a report or a reload can be anywhere in the list, and a selection scrolled
  // out of sight looks like no selection. Moves the list only: scrollIntoView would move the page.
  useEffect(() => {
    const list = listRef.current;
    const row = selectedRef.current;
    if (!list || !row) return;
    const listBox = list.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();
    if (rowBox.top < listBox.top || rowBox.bottom > listBox.bottom) {
      list.scrollTop += rowBox.top - listBox.top;
    }
  }, [selectedId]);

  function navigate(patch: Record<string, string | null>) {
    const href = hrefWith(pathname, params, patch);
    startNavigation(() => router.replace(href as never));
  }

  function search(term: string) {
    // The selected video is dropped: it is almost certainly not in the new result set, and
    // leaving a thread on screen that the list beside it no longer contains reads as a bug.
    navigate({ q: term || null, videoId: null, comment: null });
  }

  function select(videoId: string) {
    // The pinned comment goes with the video it belongs to: carried over, it reads as a broken link
    // on a video that never had that comment.
    navigate({ videoId, comment: null });
    setOpen(false);
  }

  return (
    <Card className="flex flex-col lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
      <button
        type="button"
        onClick={() => navigate({ videoId: null, comment: null, filter: null })}
        aria-current={selectedId === null ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-t-2xl border-b border-l-2 border-b-line px-4 py-3 text-left transition-colors",
          selectedId === null
            ? "border-l-accent bg-surface-muted"
            : "border-l-transparent hover:bg-surface-muted",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger-bg text-danger">
          <Flag className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Reported comments</span>
          <span className="block truncate text-[12px] text-ink-faint">
            {waiting ?? "Couldn't read the queue"}
          </span>
        </span>
      </button>

      <CardHeader
        title="Videos"
        hint="Comments are read one video at a time. Search a title or a creator, or open one from a report."
        actions={
          <button
            type="button"
            onClick={() => setOpen((shown) => !shown)}
            aria-expanded={open}
            className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-soft transition-colors hover:bg-surface-muted lg:hidden"
          >
            {open ? "Hide" : "Show"}
          </button>
        }
      />

      <div className={cn("min-h-0 flex-1 flex-col", open ? "flex" : "hidden lg:flex")}>
        <div className="border-b border-line px-4 py-3">
          <SearchBox query={query} onCommit={search} placeholder="Search title or creator..." full />
        </div>

        <div
          ref={listRef}
          className={cn(
            // On a narrow screen the list stands above the thread, so it is capped by itself.
            "max-h-[320px] min-h-0 flex-1 overflow-y-auto transition-opacity lg:max-h-none",
            navigating && "opacity-50",
          )}
        >
          {videos.map((video) => {
            const selected = video.id === selectedId;
            const reported = reportedPerVideo[video.id] ?? 0;
            const count = video.commentCount ?? 0;
            return (
              <button
                key={video.id}
                ref={selected ? selectedRef : undefined}
                type="button"
                onClick={() => select(video.id)}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex w-full items-start gap-2.5 border-b border-l-2 border-b-line px-4 py-2.5 text-left text-[12px] transition-colors last:border-b-0",
                  selected
                    ? "border-l-accent bg-surface-muted"
                    : "border-l-transparent hover:bg-surface-muted",
                )}
              >
                <VideoThumb src={video.thumbnailUrl} className="h-11 w-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium" title={video.title}>
                    {video.title}
                  </span>
                  <span className="mt-0.5 block truncate text-ink-faint">
                    {handles[video.userId] ?? "Unknown creator"}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-faint">
                    {video.commentsDisabled ? (
                      <span className="inline-flex items-center gap-1 text-pending">
                        <MessageSquareOff className="h-3 w-3" />
                        comments off
                      </span>
                    ) : (
                      // Null only happens with comments off, which the branch above covers.
                      `${formatCompact(count)} ${plural(count, "comment")}`
                    )}
                    {reported > 0 ? (
                      <span className="rounded border border-danger/25 bg-danger-bg px-1.5 py-0.5 text-[11px] font-medium text-danger">
                        {reported} reported
                      </span>
                    ) : null}
                    {/* Deleted first: a deleted video keeps whatever status it had, so showing that
                        alone would read as a video still up. Only one linked to directly gets here. */}
                    {video.deletedAt || video.status !== "PUBLISHED" ? (
                      <span className="rounded border border-line px-1.5 py-0.5 text-[11px]">
                        {video.deletedAt ? "Deleted" : VIDEO_STATUS_LABELS[video.status]}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}

          {videos.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12px] text-ink-faint">
              No video has that title or creator.
            </p>
          ) : null}
        </div>

        {/* Said out loud: the list is the top of a longer one, and the counts it is ranked by leave
            out comments that are held, so a video reading 0 can still have one waiting. */}
        <p className="border-t border-line px-4 py-2.5 text-[11px] leading-relaxed text-ink-faint">
          {total > videos.length
            ? `Top ${videos.length} of ${formatNumber(total)} by comments; search for the rest.`
            : "Most comments first."}{" "}
          Counts are public comments, not held ones.
        </p>
      </div>
    </Card>
  );
}
