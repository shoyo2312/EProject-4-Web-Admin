"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  AuthorName,
  CommentAvatar,
} from "@/components/comments/comments-table/comment-row";
import { CommentModeration } from "@/components/comments/comments-table/comment-moderation";
import { ReportDecision, useDecisionNotice } from "@/components/comments/report-decision";
import { Card, CardHeader } from "@/components/ui/card";
import { VideoThumb } from "@/components/videos/video-thumb";
import type { ReportedCommentDetails } from "@/lib/comments";
import { formatDateTime, relativeTime } from "@/lib/format";
import { targetHref, type ReportedComment } from "@/lib/moderation";

/**
 * Where the page opens: what is actually waiting on a moderator. There is no platform-wide feed of
 * comments, since comments_by_video is partitioned by video, but the report queue is platform-wide
 * and names the video of every comment in it. So this panel is the part of the page that does not
 * need a video picked first, and it shows the comment itself, which the queue's row does not.
 */
export function ReportedComments({
  reported,
  shown,
  details,
  partial,
  failed,
}: {
  /** Every comment found in the part of the queue that was read, heaviest first. */
  reported: readonly ReportedComment[];
  /** How many of them have their comment read back; one request per video keeps this short. */
  shown: number;
  details: ReportedCommentDetails | null;
  /** The queue holds more targets than were read, so there may be more comments than these. */
  partial: boolean;
  /** The queue could not be read at all, which is not the same as nothing waiting. */
  failed: boolean;
}) {
  const { notice, decided } = useDecisionNotice();

  return (
    <Card>
      <CardHeader
        title="Reported comments"
        hint="The comments in the Reports Queue, in its order: report count × severity. Deciding one here is the same decision, and closes every report against it."
        actions={
          <Link
            href="/moderation/reports"
            className="inline-flex items-center gap-1 text-[12px] text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Reports Queue
            <ArrowRight className="h-3 w-3" />
          </Link>
        }
      />

      {notice ? (
        <p role="status" className="animate-reveal border-b border-line bg-surface-muted px-5 py-2 text-[12px] text-ink-soft">
          {notice}
        </p>
      ) : null}

      {failed ? (
        <p className="px-5 py-10 text-center text-[13px] text-ink-faint">
          Couldn&apos;t read the report queue. Threads still open from the list of videos.
        </p>
      ) : reported.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <p className="text-[13px] text-ink-soft">No reported comment is waiting for a decision.</p>
          <p className="max-w-sm text-[12px] text-ink-faint">
            Pick a video to read any other thread: comments are read one video at a time, so there
            is no feed of every comment on the platform.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {reported.slice(0, shown).map((item) => {
            const comment = details?.comments[item.commentId];
            const author = comment ? details?.authors[comment.userId] : undefined;
            const video = details?.videos[item.videoId];
            return (
              <ReportDecision key={item.targetId} reported={item} onDecided={decided}>
                <div className="flex items-start gap-3 px-5 pt-2.5 pb-3">
                  {comment ? <CommentAvatar profile={author} userId={comment.userId} /> : null}
                  <div className="min-w-0 flex-1">
                    {comment ? (
                      <>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <AuthorName profile={author} userId={comment.userId} />
                          <time
                            dateTime={comment.createdAt}
                            title={formatDateTime(comment.createdAt)}
                            className="ml-auto shrink-0 text-[12px] text-ink-faint"
                          >
                            {relativeTime(comment.createdAt)}
                          </time>
                        </div>
                        <p className="mt-1 break-words text-[13px]">{comment.content}</p>
                        <CommentModeration comment={comment} />
                        {comment.deletedAt ? (
                          <p className="mt-1 text-[12px] text-ink-faint">
                            Already removed. Deciding only closes the reports.
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[13px] text-ink-faint">
                        Couldn&apos;t read this comment back. Its thread may still have it, and the
                        report can be decided either way.
                      </p>
                    )}
                    <Link
                      href={(targetHref("COMMENT", item.targetId) ?? "/comments") as never}
                      className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md border border-line py-1 pr-2 pl-1 text-[12px] text-ink-soft transition-colors hover:bg-surface-muted"
                    >
                      <VideoThumb src={video?.thumbnailUrl ?? null} className="h-7 w-5" />
                      <span className="min-w-0 truncate">{video?.title ?? "Its video"}</span>
                      <span className="shrink-0 text-ink-faint">· Open thread</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-ink-faint" />
                    </Link>
                  </div>
                </div>
              </ReportDecision>
            );
          })}
        </div>
      )}

      {failed ? null : (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[12px] text-ink-faint">
          <span>
            {reported.length > shown
              ? `The ${shown} heaviest of ${reported.length} waiting`
              : `${reported.length} waiting`}
            {partial ? ", among the top of the queue. The Reports Queue has the rest." : ""}
          </span>
          <Link
            href="/moderation/actions?type=REMOVE_COMMENT"
            className="inline-flex items-center gap-1 text-ink-soft underline-offset-4 hover:text-ink hover:underline"
          >
            Recent removals in the Audit Log
            <ArrowRight className="h-3 w-3" />
          </Link>
        </footer>
      )}
    </Card>
  );
}
