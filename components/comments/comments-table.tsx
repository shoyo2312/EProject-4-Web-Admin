"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownRight, Heart, Trash2 } from "lucide-react";
import { removeCommentAction } from "@/app/(admin)/comments/actions";
import { Card, CardHeader } from "@/components/ui/card";
import type { AdminCommentResponse } from "@/lib/api/types";
import { formatCompact, relativeTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Preset reasons. They are written to read on their own months later, because what ends up in the
 * audit row is this exact string and nothing else — "spam" alone tells a reviewer nothing about
 * what was actually removed.
 *
 * Shortcuts, not a closed list: a preset fills the box and the box stays editable, so an admin can
 * pick the closest one and add the specifics. That is also the "other" case — there is no separate
 * mode to switch into, just an empty box.
 */
const PRESET_REASONS = [
  "Harassment or targeted abuse",
  "Hate speech",
  "Spam or scam link",
  "Sexual content",
  "Threat of violence",
  "Doxxing — shares private information",
  "Impersonation",
  "Off-platform solicitation",
] as const;

/**
 * When to re-read after a successful removal, in milliseconds from the submit.
 *
 * The write is not the state change: admin-service records the action and publishes it, and
 * interaction-service applies the soft delete only when it consumes the event — so a refetch fired
 * the instant the POST returns reliably reads the comment back still live. Bounded rather than a
 * live poll: if it has not landed inside this window something is wrong with the pipeline, and
 * retrying forever would hide that rather than show it.
 */
const REFRESH_AT = [900, 2500, 6000];
const GIVE_UP_AT = 9000;

export function CommentsTable({
  comments,
  videoTitle,
}: {
  comments: AdminCommentResponse[];
  videoTitle: string;
}) {
  const live = comments.filter((c) => c.deletedAt === null).length;

  return (
    <Card>
      <CardHeader
        title={videoTitle}
        hint={`${live} live, ${comments.length - live} removed — GET /api/v1/interactions/admin/videos/{id}/comments`}
      />

      <div className="divide-y divide-line">
        {comments.map((comment) => (
          <CommentRow key={comment.commentId} comment={comment} />
        ))}

        {comments.length === 0 ? (
          <p className="px-5 py-10 text-center text-ink-faint">
            No comments on this video.
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function CommentRow({ comment }: { comment: AdminCommentResponse }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  /** True from the moment a removal is submitted until the row comes back removed. */
  const [awaitingRemoval, setAwaitingRemoval] = useState(false);

  const removed = comment.deletedAt !== null;
  /** Still moving: the row is showing the comment as live after a removal went in. */
  const pending = awaitingRemoval && !removed;

  useEffect(() => {
    if (!awaitingRemoval) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (pending) {
      REFRESH_AT.forEach((ms) => timers.push(setTimeout(() => router.refresh(), ms)));
      timers.push(
        setTimeout(() => {
          setAwaitingRemoval(false);
          setResult(
            "Still listed — interaction-service has not consumed the event yet. The removal is recorded; reload in a moment.",
          );
        }, GIVE_UP_AT),
      );
    } else {
      // Landed. Cleared on the next tick rather than inside the effect body, which the
      // set-state-in-effect rule forbids.
      timers.push(setTimeout(() => setAwaitingRemoval(false), 0));
    }

    return () => timers.forEach(clearTimeout);
  }, [awaitingRemoval, pending, router]);

  function choosePreset(preset: string) {
    // Toggling off leaves an empty box rather than the previous text: clicking the highlighted
    // chip is how an admin says "not that one", and re-showing what they just rejected is wrong.
    setReason((current) => (current === preset ? "" : preset));
    inputRef.current?.focus();
  }

  function submit() {
    startSubmit(async () => {
      const outcome = await removeCommentAction(comment.videoId, comment.commentId, reason ?? "");
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        setAwaitingRemoval(true);
      }
    });
  }

  return (
    <div className={cn("px-5 py-3", removed && "bg-surface-muted")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-ink-faint">
            <span className="figure">#{shortId(comment.userId.slice(-8), 8)}</span>
            <span>{relativeTime(comment.createdAt)}</span>
            {comment.parentId ? (
              <span className="inline-flex items-center gap-1">
                <CornerDownRight className="h-3 w-3" />
                reply
                {comment.replyToUserId
                  ? ` to #${shortId(comment.replyToUserId.slice(-8), 8)}`
                  : ""}
              </span>
            ) : null}
            {comment.likeCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {formatCompact(comment.likeCount)}
              </span>
            ) : null}
          </div>

          {/* The text itself is never truncated: a moderation call cannot be made on a preview,
              and the thing being judged is exactly this string. */}
          <p
            className={cn(
              "mt-1 break-words text-[12px]",
              removed && "text-ink-faint line-through",
              pending && "opacity-50",
            )}
          >
            {comment.content}
          </p>
        </div>

        <div className="shrink-0">
          {removed ? (
            <span className="inline-flex items-center rounded-md border border-line bg-surface px-2 py-1 text-[10px] tracking-wider text-ink-faint">
              REMOVED
            </span>
          ) : (
            <button
              type="button"
              // Disabled until the removal lands, so the same action cannot be queued twice
              // against a row that has not moved yet.
              disabled={pending}
              onClick={() => setReason(reason === null ? "" : null)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors",
                pending ? "cursor-not-allowed text-ink-faint" : "text-danger hover:bg-surface",
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {pending ? "Removing…" : "Remove"}
            </button>
          )}
        </div>
      </div>

      {reason !== null ? (
        <div className="mt-3 rounded-lg border border-line bg-surface-muted p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {PRESET_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={reason === preset}
                onClick={() => choosePreset(preset)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  reason === preset
                    ? "border-ink bg-ink text-surface"
                    : "border-line bg-surface text-ink-soft hover:bg-canvas",
                )}
              >
                {preset}
              </button>
            ))}
            <button
              type="button"
              onClick={() => choosePreset("")}
              className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11px] text-ink-faint transition-colors hover:bg-canvas"
            >
              Other…
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for removing this comment — pick one above or write your own"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] outline-none placeholder:text-ink-faint"
            />
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !reason.trim()}
              className="rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
            >
              {submitting ? "Submitting..." : "Confirm removal"}
            </button>
            <button
              type="button"
              onClick={() => setReason(null)}
              className="rounded-md border border-line bg-surface px-3 py-2 text-[11px] transition-colors hover:bg-canvas"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {result ? <p className="mt-2 text-[11px] text-ink-soft">{result}</p> : null}
    </div>
  );
}
