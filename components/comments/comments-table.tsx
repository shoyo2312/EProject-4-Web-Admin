"use client";

import { useState, useTransition } from "react";
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
import { ReasonForm } from "@/components/moderation/reason-form";
import { PRESET_REASONS } from "@/lib/moderation";
import type {
  AdminCommentFilter,
  AdminCommentResponse,
  UserProfileResponse,
} from "@/lib/api/types";
import { formatCompact, relativeTime, shortId } from "@/lib/format";
import { hrefWith } from "@/lib/url";
import { usePropagation } from "@/lib/use-propagation";
import { cn } from "@/lib/utils";

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
    // THREAD is the default; a parameter sitting at its default is noise in the address bar.
    const href = hrefWith(pathname, params, { filter: next === "THREAD" ? null : next });
    router.replace(href as never);
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
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  /** The thread under this comment, once it has been asked for. */
  const [replies, setReplies] = useState<CommentPageView | null>(null);
  const [loadingReplies, startLoadingReplies] = useTransition();

  const removed = comment.deletedAt !== null;
  const { pending, stalled, watch } = usePropagation(
    removed,
    "Still listed — interaction-service has not consumed the event yet. The removal is recorded; reload in a moment.",
  );

  const isReply = comment.parentId !== null;
  const author = authors[comment.userId];
  const parent = comment.parentId ? parents[comment.parentId] : undefined;
  // Who the reply is aimed at: another replier when the service recorded one, otherwise the
  // top-level author it hangs under.
  const answeredUserId = comment.replyToUserId ?? parent?.userId ?? null;
  const answered = answeredUserId ? authors[answeredUserId] : undefined;

  function submit() {
    startSubmit(async () => {
      const outcome = await removeCommentAction(comment.videoId, comment.commentId, reason ?? "");
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
          </div>
        ) : null}

        {(stalled ?? result) ? (
          <p className="mt-2 text-[11px] text-ink-soft">{stalled ?? result}</p>
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
