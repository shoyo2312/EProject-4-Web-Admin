"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CornerDownRight, Heart, MessageSquare, Trash2 } from "lucide-react";
import {
  loadCommentsAction,
  loadRepliesAction,
  removeCommentAction,
  type CommentPageView,
} from "@/app/(admin)/comments/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import type {
  AdminCommentFilter,
  AdminCommentResponse,
  UserProfileResponse,
} from "@/lib/api/types";
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

const FILTER_OPTIONS: readonly { value: AdminCommentFilter; label: string }[] = [
  { value: "THREAD", label: "Thread" },
  { value: "REPLIES", label: "Replies" },
  { value: "REMOVED", label: "Removed" },
];

const FILTER_HINTS: Record<AdminCommentFilter, string> = {
  THREAD: "Top-level comments, newest first — replies open per comment",
  REPLIES: "Every reply on this video, whichever comment it hangs under",
  REMOVED: "Everything already taken down, top-level and replies alike",
};

const EMPTY_MESSAGE: Record<AdminCommentFilter, string> = {
  THREAD: "No comments on this video.",
  REPLIES: "Nobody has replied to a comment on this video.",
  REMOVED: "Nothing has been removed from this video.",
};

/** Appends a freshly-loaded page to what is already on screen. */
function merge(current: CommentPageView, next: CommentPageView): CommentPageView {
  return {
    items: [...current.items, ...next.items],
    authors: { ...current.authors, ...next.authors },
    parents: { ...current.parents, ...next.parents },
    nextCursor: next.nextCursor,
    hasMore: next.hasMore,
  };
}

function displayName(profile: UserProfileResponse | undefined, userId: string) {
  return profile?.displayName ?? profile?.username ?? `#${shortId(userId.slice(-8), 8)}`;
}

export function CommentsTable({
  page,
  videoId,
  filter,
  videoTitle,
}: {
  /** The first page, rendered on the server. Later pages are appended client-side. */
  page: CommentPageView;
  videoId: string;
  filter: AdminCommentFilter;
  videoTitle: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [view, setView] = useState(page);
  const [rendered, setRendered] = useState(page);
  const [loading, startLoading] = useTransition();

  // The server sends a fresh first page after a removal lands. Anything paged in beyond it is
  // dropped on that refresh rather than stitched back on: the list is ordered by id, so a rebuilt
  // first page and a held-over tail would show the same comment twice.
  //
  // Adjusted during render rather than in an effect — React's own way of resetting state when a
  // prop changes, and it repaints once instead of twice.
  if (rendered !== page) {
    setRendered(page);
    setView(page);
  }

  function selectFilter(next: AdminCommentFilter) {
    const params_ = new URLSearchParams(params);
    if (next === "THREAD") params_.delete("filter");
    else params_.set("filter", next);
    router.replace(`${pathname}?${params_}` as never);
  }

  function loadMore() {
    if (!view.nextCursor) return;
    const cursor = view.nextCursor;
    startLoading(async () => {
      const next = await loadCommentsAction(videoId, filter, cursor);
      setView((current) => merge(current, next));
    });
  }

  return (
    <Card>
      <CardHeader
        title={videoTitle}
        hint={FILTER_HINTS[filter]}
        actions={<Segmented options={FILTER_OPTIONS} value={filter} onChange={selectFilter} />}
      />

      <div className="divide-y divide-line">
        {view.items.map((comment) => (
          <CommentRow
            key={comment.commentId}
            comment={comment}
            videoId={videoId}
            authors={view.authors}
            parents={view.parents}
          />
        ))}

        {view.items.length === 0 ? (
          <p className="px-5 py-10 text-center text-[12px] text-ink-faint">
            {EMPTY_MESSAGE[filter]}
          </p>
        ) : null}
      </div>

      {/* The count is what is loaded, never a total: comments_by_video has no count to read, and
          a number that looked like one would be wrong on every long thread. */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[11px] text-ink-faint">
        <span>
          {view.items.length} loaded
          {view.hasMore ? ", more behind" : ""}
        </span>
        {view.hasMore ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="rounded-md border border-line px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-40"
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </footer>
    </Card>
  );
}

/** Handle, avatar and name for one user, or the id when user-service had nothing for it. */
function Avatar({
  profile,
  userId,
}: {
  profile: UserProfileResponse | undefined;
  userId: string;
}) {
  const name = displayName(profile, userId);
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-muted text-[10px] font-semibold text-ink-soft uppercase"
      aria-hidden
    >
      {profile?.avatarUrl ? (
        // A plain img: avatars come from arbitrary CDN hosts that next/image would have to be
        // configured for one by one, and a broken avatar must not fail a moderation row.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.replace(/^[#@]/, "").slice(0, 2)
      )}
    </span>
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
    <div className="mt-1 max-w-xl rounded-lg border border-line bg-surface-muted px-2.5 py-1.5">
      {parent ? (
        <>
          <p className="text-[10px] text-ink-faint">
            {displayName(profile, parent.userId)}
            {profile?.username ? ` · @${profile.username}` : null}
            {parent.deletedAt ? " · removed" : null}
          </p>
          {/* Clamped, not truncated to one line: enough of the parent to judge the reply, without
              the parent taking over the row. */}
          <p className="line-clamp-2 break-words text-[11px] text-ink-soft">{parent.content}</p>
        </>
      ) : (
        <p className="text-[11px] text-ink-faint">
          Answers <span className="figure">#{shortId(parentId.slice(-8), 8)}</span>, which
          interaction-service no longer has a row for.
        </p>
      )}
    </div>
  );
}

function CommentRow({
  comment,
  videoId,
  authors,
  parents,
  /** A reply drawn inside its parent's expanded thread, rather than as a row of the listing. */
  nested = false,
}: {
  comment: AdminCommentResponse;
  videoId: string;
  authors: Record<string, UserProfileResponse | undefined>;
  parents: Record<string, AdminCommentResponse | undefined>;
  nested?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  /** True from the moment a removal is submitted until the row comes back removed. */
  const [awaitingRemoval, setAwaitingRemoval] = useState(false);
  /** The thread under this comment, once it has been asked for. */
  const [replies, setReplies] = useState<CommentPageView | null>(null);
  const [loadingReplies, startLoadingReplies] = useTransition();

  const removed = comment.deletedAt !== null;
  /** Still moving: the row is showing the comment as live after a removal went in. */
  const pending = awaitingRemoval && !removed;

  const isReply = comment.parentId !== null;
  const author = authors[comment.userId];
  const parent = comment.parentId ? parents[comment.parentId] : undefined;
  // Who the reply is aimed at: another replier when the service recorded one, otherwise the
  // top-level author it hangs under.
  const answeredUserId = comment.replyToUserId ?? parent?.userId ?? null;
  const answered = answeredUserId ? authors[answeredUserId] : undefined;

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
      setReplies((current) => (current ? merge(current, next) : next));
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
        {isReply && comment.parentId ? (
          <div className="mb-2 min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <CornerDownRight className="h-3 w-3 shrink-0" />
              <span className="min-w-0 truncate">
                Reply to {displayName(answered, answeredUserId ?? comment.parentId)}
                {answered?.username ? ` · @${answered.username}` : null}
              </span>
            </p>
            {/* Inside an expanded thread the parent is the row directly above, so quoting it again
                would say the same thing twice. */}
            {nested ? null : (
              <ParentPreview parent={parent} parentId={comment.parentId} authors={authors} />
            )}
          </div>
        ) : null}

        <div className="flex items-start gap-3">
          <Avatar profile={author} userId={comment.userId} />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="truncate text-[12px] font-semibold">
                {displayName(author, comment.userId)}
              </span>
              {author?.username ? (
                <span className="truncate text-[11px] text-ink-soft">@{author.username}</span>
              ) : null}
              <span className="ml-auto shrink-0 text-[11px] text-ink-faint">
                {relativeTime(comment.createdAt)}
              </span>
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

            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
              {/* Kept, quiet: nobody reads the id, but an audit row or a support ticket names it. */}
              <span className="figure">#{shortId(comment.commentId.slice(-8), 8)}</span>
              {comment.likeCount > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {formatCompact(comment.likeCount)}
                </span>
              ) : null}
            </div>
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

        {/* hasReplies, not replyCount: the tally counts live replies only, so a thread whose
            replies were all removed reads 0 and would otherwise have no way to be opened. */}
        {comment.hasReplies ? (
          <button
            type="button"
            onClick={toggleReplies}
            disabled={loadingReplies}
            aria-expanded={replies !== null}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-40"
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

            <div className="flex flex-wrap items-center gap-2">
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
            <p className="px-5 py-4 text-[11px] text-ink-faint">
              The replies under this comment are gone from interaction-service.
            </p>
          ) : null}

          {replies.hasMore ? (
            <button
              type="button"
              onClick={loadMoreReplies}
              disabled={loadingReplies}
              className="w-full border-t border-line px-5 py-2 text-left text-[11px] text-ink-soft transition-colors hover:bg-surface-muted disabled:opacity-40"
            >
              {loadingReplies ? "Loading…" : "More replies"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
