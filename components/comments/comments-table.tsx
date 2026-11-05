"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { loadCommentsAction } from "@/app/(admin)/comments/actions";
import { CommentRow } from "@/components/comments/comments-table/comment-row";
import { PinnedComments } from "@/components/comments/comments-table/pinned-comments";
import { useDecisionNotice } from "@/components/comments/report-decision";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { VideoStatusBadge } from "@/components/ui/status-badge";
import { VideoThumb } from "@/components/videos/video-thumb";
import type { AdminCommentFilter, AdminVideoResponse } from "@/lib/api/types";
import { appendPage, refreshFirstPage, type CommentPageView } from "@/lib/comments";
import { formatNumber, plural } from "@/lib/format";
import { targetHref, type ReportedComment } from "@/lib/moderation";
import { hrefWith } from "@/lib/url";

const FILTER_OPTIONS: readonly { value: AdminCommentFilter; label: string }[] = [
  { value: "THREAD", label: "Thread" },
  { value: "REPLIES", label: "Replies" },
  { value: "REMOVED", label: "Removed" },
  { value: "HELD", label: "Held" },
];

const FILTER_HINTS: Record<AdminCommentFilter, string> = {
  THREAD: "Top-level comments, newest first, removed ones included. Replies open per comment.",
  REPLIES: "Every reply on this video, whichever comment it hangs under.",
  REMOVED: "Everything already taken down, top-level and replies alike. History says who by.",
  HELD: "Waiting for the creator's approval and never public yet. Only the creator can approve one.",
};

const EMPTY_MESSAGE: Record<AdminCommentFilter, string> = {
  THREAD: "No comments on this video.",
  REPLIES: "Nobody has replied to a comment on this video.",
  REMOVED: "Nothing has been removed from this video.",
  HELD: "Nothing on this video is waiting for approval.",
};

export function CommentsTable({
  page,
  video,
  creator,
  filter,
  pinned,
  reports,
  linkedId,
}: {
  /** The first page, rendered on the server. Later pages are appended client-side. */
  page: CommentPageView;
  video: AdminVideoResponse;
  /** The owner's @handle, when the page could resolve it. */
  creator: string | undefined;
  filter: AdminCommentFilter;
  /** The comments below read back by id: undefined when there are none, null when that failed. */
  pinned: CommentPageView | null | undefined;
  /** The comments on this video waiting for a decision, heaviest first. */
  reports: readonly ReportedComment[];
  /** The comment the link named, if it named one. */
  linkedId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useState(page);
  const [rendered, setRendered] = useState(page);
  const [loading, startLoading] = useTransition();
  const { notice, decided } = useDecisionNotice();

  // The server sends a fresh first page on every refresh: after a removal, and on any admin event
  // the live stream relays. It is laid over what is on screen, so the pages loaded below it stay.
  //
  // Adjusted during render rather than in an effect — React's own way of updating state when a
  // prop changes, and it repaints once instead of twice.
  if (rendered !== page) {
    setRendered(page);
    setView((current) => refreshFirstPage(current, page));
  }

  function selectFilter(next: AdminCommentFilter) {
    // THREAD is the default; a parameter sitting at its default is noise in the address bar.
    const href = hrefWith(pathname, params, { filter: next === "THREAD" ? null : next });
    router.replace(href as never);
  }

  function loadMore() {
    if (!view.nextCursor) return;
    const cursor = view.nextCursor;
    startLoading(async () => {
      const next = await loadCommentsAction(video.id, filter, cursor);
      setView((current) => appendPage(current, next));
    });
  }

  const reportedIds = new Set(reports.map((r) => r.commentId));
  const found = view.items.length;
  // Scanning stops short on a long thread, so "none" can only be said once there is nothing left to
  // read. Before that it is "none so far", or the screen says something about the video it does not
  // know.
  const stillLooking = found === 0 && view.hasMore;

  return (
    <Card>
      <header className="z-[5] flex flex-wrap items-center gap-x-4 gap-y-3 rounded-t-2xl border-b border-line bg-surface px-5 py-3.5 lg:sticky lg:top-16">
        <VideoThumb src={video.thumbnailUrl} className="h-12 w-9" />
        <div className="min-w-0 flex-1 basis-40">
          <h2 className="truncate text-[14px] font-semibold tracking-tight" title={video.title}>
            {video.title}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-faint">
            {creator ? (
              <Link
                href={targetHref("USER", video.userId) as never}
                className="text-ink-soft underline-offset-4 hover:underline"
              >
                {creator}
              </Link>
            ) : null}
            {/* video-service's running total: public comments, replies included. Held and removed
                ones are not in it, and the Thread tab lists top-level ones only, so it is said
                here as what it is rather than as the length of the list below. */}
            <span>
              {video.commentsDisabled || video.commentCount === null
                ? "Comments off for viewers"
                : `${formatNumber(video.commentCount)} public ${plural(video.commentCount, "comment")}, replies included`}
            </span>
            {video.status === "PUBLISHED" ? null : <VideoStatusBadge status={video.status} dense />}
            {video.deletedAt ? <span>Deleted by its owner</span> : null}
            <Link
              href={targetHref("VIDEO", video.id) as never}
              className="text-ink-soft underline-offset-4 hover:underline"
            >
              Open video →
            </Link>
          </p>
        </div>
        <Segmented options={FILTER_OPTIONS} value={filter} onChange={selectFilter} />
      </header>

      {notice ? (
        <p role="status" className="animate-reveal border-b border-line bg-surface-muted px-5 py-2 text-[12px] text-ink-soft">
          {notice}
        </p>
      ) : null}

      <PinnedComments
        pinned={pinned}
        reports={reports}
        linkedId={linkedId}
        videoId={video.id}
        unpinHref={hrefWith(pathname, params, { comment: null })}
        onDecided={decided}
      />

      <p className="border-b border-line px-5 py-2 text-[12px] text-ink-faint">{FILTER_HINTS[filter]}</p>

      <div className="divide-y divide-line">
        {view.items.map((comment) => (
          <CommentRow
            key={comment.commentId}
            comment={comment}
            videoId={video.id}
            authors={view.authors}
            parents={view.parents}
            reported={reportedIds.has(comment.commentId)}
            // The thread itself has nowhere further to send a row; the flat views do.
            threadHref={
              filter === "THREAD"
                ? undefined
                : hrefWith(pathname, params, {
                    filter: null,
                    comment: comment.parentId ?? comment.commentId,
                  })
            }
          />
        ))}

        {found === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-faint">
            {stillLooking
              ? "Nothing so far. This thread is long, so only its newest comments have been checked."
              : EMPTY_MESSAGE[filter]}
          </p>
        ) : null}
      </div>

      {/* The count is what is loaded, never a total: comments_by_video has no count to read, and
          a number that looked like one would be wrong on every long thread. */}
      {found > 0 || view.hasMore ? (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12px] text-ink-faint">
          <span>
            {found > 0
              ? `${found} ${plural(found, "comment")} shown${view.hasMore ? ", more to load" : ""}`
              : null}
          </span>
          {view.hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="rounded-md border border-line px-2.5 py-1.5 text-[12px] text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-40"
            >
              {loading ? "Loading…" : stillLooking ? "Keep looking" : "Load more"}
            </button>
          ) : null}
        </footer>
      ) : null}
    </Card>
  );
}
