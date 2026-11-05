"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { CommentRow } from "@/components/comments/comments-table/comment-row";
import { ReportDecision } from "@/components/comments/report-decision";
import type { CommentPageView } from "@/lib/comments";
import type { ReportedComment } from "@/lib/moderation";

/**
 * What the thread is opened for, above the thread rather than somewhere in it: the reported comments
 * on this video, each with its reason and the decision on it, and the comment a link named, if that
 * is not one of them. Paged newest first, a comment reported last month would otherwise be any
 * number of Load more clicks down. A pinned comment can also be on the page below; this copy is the
 * one being decided on.
 */
export function PinnedComments({
  pinned,
  reports,
  linkedId,
  videoId,
  unpinHref,
  onDecided,
}: {
  /** Those comments read back by id: null when the lookup failed. */
  pinned: CommentPageView | null | undefined;
  reports: readonly ReportedComment[];
  /** The comment the link named, if it named one. */
  linkedId: string | null;
  videoId: string;
  unpinHref: string;
  onDecided: (message: string, targetId: string) => void;
}) {
  const find = (commentId: string) => pinned?.items.find((c) => c.commentId === commentId);
  const linkedAlone = linkedId !== null && !reports.some((r) => r.commentId === linkedId);
  if (reports.length === 0 && !linkedAlone) return null;

  const linked = linkedId ? find(linkedId) : undefined;

  return (
    <div className="divide-y divide-line border-b border-line bg-pending-bg/40">
      {reports.map((reported) => {
        const comment = find(reported.commentId);
        return (
          <ReportDecision key={reported.targetId} reported={reported} onDecided={onDecided}>
            {comment && pinned ? (
              <CommentRow
                comment={comment}
                videoId={videoId}
                authors={pinned.authors}
                parents={pinned.parents}
                hideRemove
              />
            ) : (
              <p className="px-5 pt-2 pb-3 text-[13px] text-ink-faint">
                {pinned
                  ? "This video has no comment with that id any more. The report can still be decided."
                  : "Couldn't load this comment. The report can still be decided, and the thread below is current."}
              </p>
            )}
          </ReportDecision>
        );
      })}

      {linkedAlone ? (
        <section>
          <div className="flex items-center justify-between gap-2 px-5 pt-3">
            <span className="label text-ink-soft">Linked comment</span>
            {/* Not "Dismiss": on a page about reports, that word closes a report. */}
            <Link
              href={unpinHref as never}
              title="Show the thread only"
              className="inline-flex items-center gap-1 text-[12px] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Unpin
              <X className="h-3 w-3" />
            </Link>
          </div>
          {linked && pinned ? (
            <CommentRow
              comment={linked}
              videoId={videoId}
              authors={pinned.authors}
              parents={pinned.parents}
            />
          ) : (
            <p className="px-5 pt-1 pb-3 text-[13px] text-ink-faint">
              {pinned
                ? "This video has no comment with that id. The link may name a comment on another video."
                : "Couldn't load the linked comment. The thread below is still current."}
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
