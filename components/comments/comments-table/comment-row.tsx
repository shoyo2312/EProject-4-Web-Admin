"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CornerDownRight, Heart, MessageSquare, Trash2 } from "lucide-react";
import {
  commentHistoryAction,
  commentRemovedAction,
  loadRepliesAction,
  removeCommentAction,
} from "@/app/(admin)/comments/actions";
import { CommentModeration } from "@/components/comments/comments-table/comment-moderation";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { ReasonForm } from "@/components/moderation/reason-form";
import { Avatar } from "@/components/ui/avatar";
import type { AdminCommentResponse, UserProfileResponse } from "@/lib/api/types";
import { appendPage, type CommentPageView } from "@/lib/comments";
import { formatCompact, formatDateTime, relativeTime, shortId } from "@/lib/format";
import { PRESET_REASONS } from "@/lib/moderation";
import { usePropagation } from "@/lib/use-propagation";
import { useRowDetail } from "@/lib/use-row-detail";
import { cn } from "@/lib/utils";

export function displayName(profile: UserProfileResponse | undefined, userId: string) {
  return profile?.displayName ?? profile?.username ?? `#${shortId(userId.slice(-8), 8)}`;
}

/** The face beside a comment: an author with no profile falls back to the digits of their id. */
export function CommentAvatar({
  profile,
  userId,
}: {
  profile: UserProfileResponse | undefined;
  userId: string;
}) {
  return (
    <Avatar
      src={profile?.avatarUrl}
      initials={displayName(profile, userId).replace(/^[#@]/, "").slice(0, 2)}
    />
  );
}

/**
 * Who wrote it, linked to their account: a removal is a strike against them, and whether this is
 * their first comment like it or their tenth is on that page.
 */
export function AuthorName({
  profile,
  userId,
}: {
  profile: UserProfileResponse | undefined;
  userId: string;
}) {
  return (
    <>
      <Link
        href={`/users/${userId}` as never}
        className="truncate text-[13px] font-semibold underline-offset-4 hover:underline"
      >
        {displayName(profile, userId)}
      </Link>
      {profile?.username ? (
        <span className="truncate text-[12px] text-ink-soft">@{profile.username}</span>
      ) : null}
    </>
  );
}

/**
 * The comment being answered, quoted small. Admins judge a reply against what it replies to —
 * "delete this" is abuse or a fair complaint depending entirely on the comment above it.
 */
function ParentPreview({
  parent,
  parentId,
  authors,
}: {
  parent: AdminCommentResponse | undefined;
  parentId: string;
  authors: Record<string, UserProfileResponse | undefined>;
}) {
  const profile = parent ? authors[parent.userId] : undefined;

  return (
    <div className="mb-2 flex max-w-xl items-start gap-1.5 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5">
      <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
      <div className="min-w-0">
        {parent ? (
          <>
            <p className="text-[11px] text-ink-faint">
              {displayName(profile, parent.userId)}
              {profile?.username ? ` · @${profile.username}` : null}
              {parent.deletedAt ? " · removed" : null}
            </p>
            {/* Clamped, not truncated to one line: enough of the parent to judge the reply, without
                the parent taking over the row. */}
            <p className="line-clamp-2 break-words text-[12px] text-ink-soft">{parent.content}</p>
          </>
        ) : (
          <p className="text-[12px] text-ink-faint">
            Answers <span className="figure">#{shortId(parentId.slice(-8), 8)}</span>, which
            interaction-service no longer has a row for.
          </p>
        )}
      </div>
    </div>
  );
}

export function CommentRow({
  comment,
  videoId,
  authors,
  parents,
  nested = false,
  reported = false,
  hideRemove = false,
  threadHref,
}: {
  comment: AdminCommentResponse;
  videoId: string;
  authors: Record<string, UserProfileResponse | undefined>;
  parents: Record<string, AdminCommentResponse | undefined>;
  /** A reply drawn inside its parent's expanded thread, rather than as a row of the listing. */
  nested?: boolean;
  /** Reports stand against this comment, and it is pinned at the top of the thread for them. */
  reported?: boolean;
  /** The row sits under a decision on a report, which is where its removal is offered instead. */
  hideRemove?: boolean;
  /** Where a row of a flat view opens in its thread. */
  threadHref?: string;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  /** The thread under this comment, once it has been asked for. */
  const [replies, setReplies] = useState<CommentPageView | null>(null);
  const [loadingReplies, startLoadingReplies] = useTransition();
  const history = useRowDetail(() => commentHistoryAction(comment.videoId, comment.commentId));

  // Set when a lookup by id finds the comment removed. A reply in an opened thread, or a comment
  // paged in with Load more, is client state that re-rendering the page never updates.
  const [removedSince, setRemovedSince] = useState(false);
  const removed = comment.deletedAt !== null || removedSince;
  const { pending, stalled, watch } = usePropagation(
    removed,
    "Still listed — interaction-service has not consumed the event yet. The removal is recorded; reload in a moment.",
    () => {
      commentRemovedAction(comment.videoId, comment.commentId)
        .then((gone) => {
          if (gone) setRemovedSince(true);
        })
        // The next look, or the stalled message after the last, covers a lookup that failed.
        .catch(() => {});
    },
  );

  const author = authors[comment.userId];
  const parent = comment.parentId ? parents[comment.parentId] : undefined;
  // Who the reply is aimed at: another replier when the service recorded one, otherwise the
  // top-level author it hangs under.
  const answeredUserId = comment.replyToUserId ?? parent?.userId ?? null;
  const answered = answeredUserId ? authors[answeredUserId] : undefined;
  // In a flat view the quote already names the parent's author, so this line is only worth its
  // space when the reply is aimed at someone else. Inside a thread there is no quote to name them.
  const namesAnswered =
    comment.parentId !== null
    && (nested || (comment.replyToUserId !== null && comment.replyToUserId !== parent?.userId));

  function submit() {
    startSubmit(async () => {
      const outcome = await removeCommentAction(
        comment.videoId,
        comment.commentId,
        reason ?? "",
        comment.status === "HELD",
      );
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        watch();
      }
    });
  }

  /** Opens the thread, or closes it — the replies already fetched are kept for the next open. */
  function toggleReplies() {
    if (replies) {
      setReplies(null);
      return;
    }
    startLoadingReplies(async () => {
      setReplies(await loadRepliesAction(videoId, comment.commentId, null));
    });
  }

  function loadMoreReplies() {
    const cursor = replies?.nextCursor;
    if (!cursor) return;
    startLoadingReplies(async () => {
      const next = await loadRepliesAction(videoId, comment.commentId, cursor);
      setReplies((current) => (current ? appendPage(current, next) : next));
    });
  }

  return (
    <div className={cn(removed && "bg-surface-muted")}>
      <div
        className={cn(
          "px-5 py-3",
          // Indented once and only once: replies are one level deep, so a rail is enough to place
          // them without pushing the text into a column too narrow to read.
          nested && "border-l-2 border-line pl-6 md:pl-10",
        )}
      >
        {namesAnswered ? (
          <p className="mb-2 flex items-center gap-1.5 text-[12px] text-ink-faint">
            <CornerDownRight className="h-3 w-3 shrink-0" />
            <span className="min-w-0 truncate">
              Reply to {displayName(answered, answeredUserId ?? comment.parentId ?? "")}
              {answered?.username ? ` · @${answered.username}` : null}
            </span>
          </p>
        ) : null}
        {/* Inside an expanded thread the parent is the row directly above, so quoting it again
            would say the same thing twice. */}
        {comment.parentId && !nested ? (
          <ParentPreview parent={parent} parentId={comment.parentId} authors={authors} />
        ) : null}

        <div className="flex items-start gap-3">
          <CommentAvatar profile={author} userId={comment.userId} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <AuthorName profile={author} userId={comment.userId} />
              {reported ? (
                <span
                  title="Reports stand against this comment. It is pinned at the top of the thread."
                  className="rounded border border-danger/25 bg-danger-bg px-1.5 py-0.5 text-[11px] font-medium text-danger"
                >
                  Reported
                </span>
              ) : null}
              <span className="ml-auto flex shrink-0 items-baseline gap-2 text-[12px] text-ink-faint">
                <button
                  type="button"
                  onClick={history.toggle}
                  aria-expanded={history.open}
                  className="underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  {history.open ? "Hide history" : "History"}
                </button>
                {/* Kept, quiet: nobody reads the id, but an audit row or a support ticket names it. */}
                <span className="figure">#{shortId(comment.commentId.slice(-8), 8)}</span>
                <time dateTime={comment.createdAt} title={formatDateTime(comment.createdAt)}>
                  {relativeTime(comment.createdAt)}
                </time>
              </span>
            </div>

            {/* The text itself is never truncated: a moderation call cannot be made on a preview,
                and the thing being judged is exactly this string. */}
            <p
              className={cn(
                "mt-1 break-words text-[13px]",
                removed && "text-ink-soft line-through decoration-ink-faint",
                pending && "opacity-50",
              )}
            >
              {comment.content}
            </p>
            <CommentModeration comment={comment} />

            {/* Drawn only with something in it: most comments have no replies and no likes, and an
                empty line under each of them is a list that shows fewer comments. */}
            {comment.hasReplies || comment.likeCount > 0 || comment.deletedAt || threadHref ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-faint">
                {/* hasReplies, not replyCount: the tally counts live replies only, so a thread whose
                    replies were all removed reads 0 and would otherwise have no way to be opened. */}
                {comment.hasReplies ? (
                  <button
                    type="button"
                    onClick={toggleReplies}
                    disabled={loadingReplies}
                    aria-expanded={replies !== null}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-40"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {comment.replyCount > 0
                      ? `${comment.replyCount} ${comment.replyCount === 1 ? "reply" : "replies"}`
                      : "Replies, all removed"}
                    <span className="text-ink-faint">
                      {loadingReplies && !replies ? "· Loading…" : replies ? "· Hide" : "· View"}
                    </span>
                  </button>
                ) : null}
                {comment.likeCount > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {formatCompact(comment.likeCount)}
                  </span>
                ) : null}
                {comment.deletedAt ? (
                  <time dateTime={comment.deletedAt} title={formatDateTime(comment.deletedAt)}>
                    Removed {relativeTime(comment.deletedAt)}
                  </time>
                ) : null}
                {threadHref ? (
                  <Link
                    href={threadHref as never}
                    className="underline-offset-4 transition-colors hover:text-ink hover:underline"
                  >
                    Open in thread
                  </Link>
                ) : null}
              </div>
            ) : null}

            {history.open ? (
              <div className="animate-reveal mt-2 rounded-lg border border-line bg-surface-muted p-3">
                <ModerationHistory
                  reportCount={history.data?.reportCount ?? null}
                  actions={history.data?.actions ?? null}
                  handles={history.data?.handles}
                  loading={history.loading}
                  onRetry={history.retry}
                />
                {/* deletedAt does not say who: only an admin's removal leaves an audit row. */}
                {removed
                && history.data
                && !history.data.actions.some((a) => a.actionType === "REMOVE_COMMENT") ? (
                  <p className="mt-2 text-[12px] text-ink-soft">
                    No admin removed this one, so it was its author or the video&apos;s owner.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="shrink-0">
            {removed ? (
              <span className="inline-flex items-center rounded-md border border-line bg-surface px-2 py-1 text-[11px] tracking-wider text-ink-faint">
                REMOVED
              </span>
            ) : hideRemove ? null : (
              <button
                type="button"
                // Disabled until the removal lands, so the same action cannot be queued twice
                // against a row that has not moved yet.
                disabled={pending}
                aria-expanded={reason !== null}
                onClick={() => setReason(reason === null ? "" : null)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12px] transition-colors",
                  // Quiet until reached for: on twenty rows, twenty red buttons were the loudest
                  // thing on the page, louder than any comment that needed a look.
                  pending
                    ? "cursor-not-allowed text-ink-faint"
                    : "text-ink-soft hover:border-danger/30 hover:bg-danger-bg hover:text-danger",
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {pending ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        </div>

        {reason !== null ? (
          <div className="animate-reveal mt-3 rounded-lg border border-line bg-surface-muted p-3">
            <ReasonForm
              presets={PRESET_REASONS.removeComment}
              reason={reason}
              onReason={setReason}
              onSubmit={submit}
              onCancel={() => setReason(null)}
              submitting={submitting}
              placeholder="Reason for removing this comment — pick one above or write your own"
              confirmLabel="Confirm removal"
            />
            <p className="mt-2 text-[12px] text-ink-faint">
              A removal is a strike against its author: enough strikes in a day and they cannot
              comment for a while.
            </p>
          </div>
        ) : null}

        {(stalled ?? result) ? (
          <p className="mt-2 text-[12px] text-ink-soft">{stalled ?? result}</p>
        ) : null}
      </div>

      {replies ? (
        <div className="border-t border-line">
          {replies.items.map((reply) => (
            <CommentRow
              key={reply.commentId}
              comment={reply}
              videoId={videoId}
              authors={replies.authors}
              parents={replies.parents}
              nested
            />
          ))}

          {replies.items.length === 0 ? (
            <p className="px-5 py-4 text-[12px] text-ink-faint">
              The replies under this comment are gone from interaction-service.
            </p>
          ) : null}

          {replies.hasMore ? (
            <button
              type="button"
              onClick={loadMoreReplies}
              disabled={loadingReplies}
              className="w-full border-t border-line px-5 py-2 text-left text-[12px] text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-40"
            >
              {loadingReplies ? "Loading…" : "More replies"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
