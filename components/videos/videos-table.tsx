"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EyeOff, Play, RotateCcw, Search, X } from "lucide-react";
import {
  moderateVideoAction,
  videoModerationDetailAction,
  type ModerationDetail,
} from "@/app/(admin)/videos/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import { Tooltip } from "@/components/ui/tooltip";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import type {
  AdminVideoResponse,
  UserProfileResponse,
  VideoStatus,
} from "@/lib/api/types";
import { formatCompact, formatCount, formatDate, relativeTime, shortId } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatusFilter = VideoStatus | "ALL";

const STATUS_FILTERS = [
  { value: "ALL" as const, label: "All" },
  // First after All: this is the one filter that is a worklist rather than a
  // report — every row in it is a video nobody can see until someone acts.
  { value: "PENDING_REVIEW" as const, label: "To review" },
  { value: "PUBLISHED" as const, label: "Live" },
  { value: "PROCESSING" as const, label: "Processing" },
  { value: "FAILED" as const, label: "Failed" },
  { value: "REJECTED" as const, label: "Auto-removed" },
  { value: "TAKEN_DOWN" as const, label: "Down" },
];

const STATUS_STYLES: Record<VideoStatus, string> = {
  PUBLISHED: "border-success/25 bg-success-bg text-success",
  PROCESSING: "border-pending/25 bg-pending-bg text-pending",
  PENDING_MODERATION: "border-pending/25 bg-pending-bg text-pending",
  PENDING_REVIEW: "border-pending/25 bg-pending-bg text-pending",
  FAILED: "border-danger/25 bg-danger-bg text-danger",
  REJECTED: "border-danger/25 bg-danger-bg text-danger",
  TAKEN_DOWN: "border-danger/25 bg-danger-bg text-danger",
};

/**
 * Preset reasons, per action. They are written to read on their own months later, because what
 * ends up in the audit row is this exact string and nothing else — "spam" alone tells a reviewer
 * nothing about what was actually removed.
 *
 * Shortcuts, not a closed list: a preset fills the box and the box stays editable, so an admin can
 * pick the closest one and add the specifics. That is also the "other" case — there is no separate
 * mode to switch into, just an empty box.
 */
const PRESET_REASONS: Record<"takedown" | "restore", readonly string[]> = {
  takedown: [
    "Sexual or nude content",
    "Graphic violence",
    "Hate speech or harassment",
    "Dangerous act likely to be imitated",
    "Spam or scam",
    "Copyright infringement",
    "Harmful misinformation",
    "Involves a minor",
  ],
  restore: [
    "Reviewed — automatic flag was wrong",
    "Appeal upheld — no violation",
    "Taken down in error",
    "Reviewed again, within policy",
    "Rights holder withdrew the claim",
  ],
};

/**
 * A video nobody can watch has no meaningful view or like total to show. The
 * moderation states qualify: the file is transcoded and playable, it is only
 * held back — and a reviewer needs to open it to decide.
 */
function playable(status: VideoStatus) {
  return (
    status === "PUBLISHED" ||
    status === "TAKEN_DOWN" ||
    status === "REJECTED" ||
    status === "PENDING_REVIEW" ||
    status === "PENDING_MODERATION"
  );
}

/**
 * What the classifier said, phrased for the reason column.
 *
 * <p>A video the classifier removed or held carries no takedownReason — that field is only written
 * by an admin acting by hand — so without this the machine's calls are exactly the rows that show
 * no explanation.
 *
 * <p>An APPROVED verdict returns null: it is the outcome of every video on the platform and saying
 * so in a column meant for problems buries the rows that are one.
 *
 * <p>The score is printed raw rather than as a percentage because the thresholds it gets compared
 * against are configured on the same 0–1 scale, and a reviewer deciding whether to move one should
 * not have to convert.
 */
function describeModeration(
  video: AdminVideoResponse,
): { label: string; detail: string } | null {
  const moderation = video.moderation;
  if (!moderation || moderation.verdict === "APPROVED") return null;

  // The check itself did not complete, so there are no scores to show — only why not.
  if (moderation.reason) {
    return { label: "Check did not complete", detail: moderation.reason };
  }

  const score = moderation.maxScore.toFixed(3);
  const frames = `${moderation.suspiciousFrames}/${moderation.totalFrames}`;
  const verb = moderation.verdict === "REJECTED" ? "Auto-removed" : "Flagged";
  return {
    label: `${verb}: ${moderation.label ?? "unknown"} ${score} · ${frames} frames`,
    detail: [
      `${verb} by the classifier, not by an admin.`,
      `Highest frame score: ${score} (${moderation.label ?? "unknown"})`,
      `Frames over the review threshold: ${frames}`,
      `Model: ${moderation.model ?? "unknown"} (${moderation.modelVersion ?? "unversioned"})`,
      `Checked: ${moderation.checkedAt}`,
    ].join("\n"),
  };
}

export function VideosTable({
  videos,
  owners,
  query,
  status,
}: {
  videos: AdminVideoResponse[];
  /** userId → profile, for showing the owner as @handle. May be missing an id. */
  owners: Record<string, UserProfileResponse>;
  query: string;
  status: StatusFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(query);
  const [navigating, startNavigation] = useTransition();

  // Filtering happens on the server, so the box drives the URL. Debounced because every
  // keystroke would otherwise be a round trip through the gateway to video-service.
  useEffect(() => {
    if (term === query) return;
    const timer = setTimeout(() => {
      startNavigation(() => router.replace(buildHref(pathname, params, term, status)));
    }, 350);
    return () => clearTimeout(timer);
  }, [term, query, status, pathname, params, router]);

  function changeStatus(next: StatusFilter) {
    startNavigation(() => router.replace(buildHref(pathname, params, term, next)));
  }

  return (
    <Card>
      <CardHeader
        title="Uploads"
        hint="GET /api/v1/videos/admin — served by video-service, which owns status and visibility"
        actions={
          <>
            <label className="flex w-[180px] items-center gap-2 rounded-lg border border-line bg-surface-muted px-2.5 py-1.5 lg:w-[240px]">
              <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search title..."
                className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-ink-faint"
              />
            </label>
            <Segmented options={STATUS_FILTERS} value={status} onChange={changeStatus} />
          </>
        }
      />

      <div className={cn("overflow-x-auto transition-opacity", navigating && "opacity-50")}>
        <table className="w-full border-collapse text-[12px] xl:min-w-[960px]">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="label-caps px-5 py-3 text-ink-soft">Title</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Owner</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Status</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Visibility</th>
              <th className="label-caps px-3 py-3 text-ink-soft">Reason</th>
              <th className="label-caps hidden px-3 py-3 text-right text-ink-soft xl:table-cell">Views</th>
              <th className="label-caps hidden px-3 py-3 text-right text-ink-soft xl:table-cell">Likes</th>
              <th className="label-caps hidden px-3 py-3 text-ink-soft xl:table-cell">Uploaded</th>
              <th className="label-caps px-5 py-3 text-right text-ink-soft">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((video) => (
              <VideoRow key={video.id} video={video} owner={owners[video.userId]} />
            ))}

            {videos.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink-faint">
                  No uploads match this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/**
 * When to re-read after a successful action, in milliseconds from the submit.
 *
 * The write is not the state change: admin-service records the action and publishes it, and
 * video-service applies it only when it consumes the event — so a refetch fired the instant the
 * POST returns reliably reads the old status back. Bounded rather than a live poll: if it has not
 * landed inside this window something is wrong with the pipeline, and retrying forever would hide
 * that rather than show it.
 */
const REFRESH_AT = [900, 2500, 6000];
const GIVE_UP_AT = 9000;

function VideoRow({
  video,
  owner,
}: {
  video: AdminVideoResponse;
  owner?: UserProfileResponse;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [detail, setDetail] = useState(false);
  const [modHistory, setModHistory] = useState<ModerationDetail | null>(null);
  const [modLoading, setModLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const [submitting, startSubmit] = useTransition();

  // Opening the row is what triggers the fetch — once, lazily. See videoModerationDetailAction.
  function toggleDetail() {
    const opening = !detail;
    setDetail(opening);
    if (opening && !modHistory && !modLoading) {
      setModLoading(true);
      videoModerationDetailAction(video.id)
        .then(setModHistory)
        .finally(() => setModLoading(false));
    }
  }
  /**
   * The status this row had when its action was submitted, or null when nothing is in flight.
   *
   * Held as what the video is moving *away from*, not what it is moving *to*: a restore has no
   * single destination — video-service puts the video back to whatever it was before the takedown,
   * which may be PUBLISHED, PROCESSING or FAILED. Any value other than this one means it landed.
   */
  const [awaiting, setAwaiting] = useState<VideoStatus | null>(null);

  /** Still moving: the row is showing the status it had when the action went in. */
  const pending = awaiting !== null && video.status === awaiting;
  const machineReason = describeModeration(video);

  useEffect(() => {
    if (awaiting === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (pending) {
      REFRESH_AT.forEach((ms) => timers.push(setTimeout(() => router.refresh(), ms)));
      timers.push(
        setTimeout(() => {
          setAwaiting(null);
          setResult(
            "Still the old status — video-service has not consumed the event yet. The action is recorded; reload in a moment.",
          );
        }, GIVE_UP_AT),
      );
    } else {
      // Landed. The marker is dropped on the next tick rather than inside the effect body,
      // so a later return to this same status is not read as a fresh action in flight.
      timers.push(setTimeout(() => setAwaiting(null), 0));
    }

    return () => timers.forEach(clearTimeout);
  }, [awaiting, pending, router]);

  const inputRef = useRef<HTMLInputElement>(null);

  // Approving what automatic moderation held back is the same write as undoing
  // an admin's takedown — both put the video back to PUBLISHED through
  // VideoRestoredEvent — so it is the same action rather than a second one.
  const action =
    video.status === "TAKEN_DOWN" ||
    video.status === "REJECTED" ||
    video.status === "PENDING_REVIEW"
      ? "restore"
      : "takedown";
  const watchable = playable(video.status);
  const presets = PRESET_REASONS[action];

  function choosePreset(preset: string) {
    // Toggling off leaves an empty box rather than the previous text: clicking the highlighted
    // chip is how an admin says "not that one", and re-showing what they just rejected is wrong.
    setReason((current) => (current === preset ? "" : preset));
    inputRef.current?.focus();
  }

  function submit() {
    startSubmit(async () => {
      const outcome = await moderateVideoAction(video.id, action, reason ?? "");
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        setAwaiting(video.status);
      }
    });
  }

  return (
    <>
      <tr
        {...expandableRowProps(toggleDetail, detail)}
        className={cn(
          "border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted",
          "cursor-pointer",
        )}
      >
        <td className="max-w-[280px] px-5 py-3">
          <span className="block truncate font-medium" title={video.title}>
            {video.title}
          </span>
          {video.failureReason ? (
            <span className="block truncate text-[10px] text-danger" title={video.failureReason}>
              {video.failureReason}
            </span>
          ) : null}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap xl:table-cell">
          {owner?.username ? (
            <span className="text-ink-soft">@{owner.username}</span>
          ) : (
            <span className="figure text-ink-faint">#{shortId(video.userId.slice(-8), 8)}</span>
          )}
        </td>
        <td className="px-3 py-3">
          <span
            className={cn(
              "inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-medium",
              STATUS_STYLES[video.status],
              // Dimmed while the event is in flight: the badge is still showing the old
              // status truthfully, and pretending it already flipped would be a lie the
              // next reload contradicts.
              pending && "opacity-50",
            )}
          >
            {video.status}
          </span>
          {pending ? (
            <span className="ml-2 text-[10px] text-ink-faint">applying…</span>
          ) : null}
        </td>
        <td className="hidden px-3 py-3 xl:table-cell">
          <span className="rounded border border-line bg-surface-muted px-1.5 py-0.5 text-[10px] tracking-wider text-ink-soft">
            {video.visibility}
          </span>
        </td>
        {/* The moderation reason, not the transcode one — that already sits under the title.
            Showing them in one column would make a FAILED row read as something a moderator
            decided. Cleared by a restore, so a row that is back up shows nothing here.
            A video the classifier removed sets no takedownReason at all, so its scores stand in
            — otherwise the rows that most need explaining are the ones showing nothing. */}
        <td className="max-w-[200px] px-3 py-3">
          {video.takedownReason ? (
            <span className="block truncate text-danger" title={video.takedownReason}>
              {video.takedownReason}
            </span>
          ) : machineReason ? (
            <span
              className={cn(
                "block truncate",
                video.status === "REJECTED" ? "text-danger" : "text-ink-soft",
              )}
              title={machineReason.detail}
            >
              {machineReason.label}
            </span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </td>
        {/* An em dash rather than 0: a video still transcoding has no view count, and
            printing zero would read as one nobody watched. */}
        <td className="figure hidden px-3 py-3 text-right xl:table-cell">
          {watchable ? formatCount(video.viewCount) : <span className="text-ink-faint">—</span>}
        </td>
        <td className="figure hidden px-3 py-3 text-right text-ink-soft xl:table-cell">
          {watchable ? formatCount(video.likeCount) : <span className="text-ink-faint">—</span>}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap text-ink-faint xl:table-cell">
          {relativeTime(video.createdAt)}
        </td>
        <td className="px-3 py-3 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="inline-flex items-center gap-1.5">
            {/* The file at hlsUrl is a faststart mp4, not an HLS playlist — a bare
                <video> plays it in every browser, no player library. Shown only when
                the video is transcoded and holdable: the states playable() covers. */}
            {watchable && video.hlsUrl ? (
              <Tooltip label="Watch">
                <button
                  type="button"
                  onClick={() => setWatching(true)}
                  aria-label="Watch"
                  className="inline-flex items-center rounded-md border border-line p-1.5 transition-colors hover:bg-surface"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            ) : null}
            <button
              type="button"
              // Disabled until the change lands, so a second click cannot queue the same
              // action twice against a status that has not moved yet.
              disabled={pending}
              onClick={() => setReason(reason === null ? "" : null)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] transition-colors",
                pending ? "cursor-not-allowed text-ink-faint" : "hover:bg-surface",
                action === "takedown" && !pending && "text-danger",
              )}
            >
              {action === "takedown" ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {action === "takedown" ? "Take down" : "Restore"}
            </button>
          </div>
        </td>
      </tr>

      {detail ? (
        <RowDetail colSpan={9}>
          <Field label="Owner">
            {owner?.username ? `@${owner.username}` : `#${shortId(video.userId.slice(-8), 8)}`}
            {owner ? (
              <span className="text-ink-faint">
                {" "}
                · {formatCompact(owner.followerCount)} followers
              </span>
            ) : null}
          </Field>
          <Field label="Visibility">{video.visibility}</Field>
          <Field label="Views">{watchable ? formatCount(video.viewCount) : "—"}</Field>
          <Field label="Likes">{watchable ? formatCount(video.likeCount) : "—"}</Field>
          <Field label="Comments">
            {video.commentsDisabled
              ? "disabled"
              : video.commentCount != null
                ? formatCount(video.commentCount)
                : "—"}
          </Field>
          <Field label="Duration">
            {video.durationSeconds != null ? `${video.durationSeconds}s` : "—"}
          </Field>
          <Field label="Uploaded">{formatDate(video.createdAt)}</Field>
          <Field label="Published">
            {video.publishedAt ? formatDate(video.publishedAt) : "—"}
          </Field>
          <Field label="Updated">{formatDate(video.updatedAt)}</Field>
          {video.rawFileUrl ? (
            <Field label="Raw file" wide>
              <span className="break-all">{video.rawFileUrl}</span>
            </Field>
          ) : null}
          {video.tags.length > 0 ? (
            <Field label="Tags" wide>
              {video.tags.join(", ")}
            </Field>
          ) : null}
          {video.description ? (
            <Field label="Description" wide>
              {video.description}
            </Field>
          ) : null}
          {video.takedownReason ? (
            <Field label="Takedown reason" wide>
              {video.takedownReason}
            </Field>
          ) : machineReason ? (
            <Field label="Moderation" wide>
              {machineReason.label}
            </Field>
          ) : null}
          <Field label="Moderation history" wide>
            <ModerationHistory
              reportCount={modHistory?.reportCount ?? null}
              actions={modHistory?.actions ?? null}
              loading={modLoading}
            />
          </Field>
        </RowDetail>
      ) : null}

      {reason !== null ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={9} className="px-5 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {presets.map((preset) => (
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
                placeholder={`Reason for ${action === "takedown" ? "taking down" : "restoring"} "${video.title}" — pick one above or write your own`}
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[11px] outline-none placeholder:text-ink-faint"
              />
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !reason.trim()}
                className="rounded-md bg-ink px-3 py-2 text-[11px] text-surface transition-opacity hover:opacity-85 disabled:opacity-40"
              >
                {submitting ? "Submitting..." : `Confirm ${action}`}
              </button>
              <button
                type="button"
                onClick={() => setReason(null)}
                className="rounded-md border border-line bg-surface px-3 py-2 text-[11px] transition-colors hover:bg-canvas"
              >
                Cancel
              </button>
            </div>
          </td>
        </tr>
      ) : null}

      {result ? (
        <tr className="border-b border-line">
          <td colSpan={9} className="px-5 py-2 text-[11px] text-ink-soft">
            {result}
          </td>
        </tr>
      ) : null}

      {watching && video.hlsUrl ? (
        <WatchOverlay video={video} onClose={() => setWatching(false)} />
      ) : null}
    </>
  );
}

/**
 * Fills the viewport with the video. Rendered through a portal because a table row is
 * not a place to put a fixed overlay, and closed on Escape or a backdrop click so a
 * reviewer never has to reach for the mouse to get back to the worklist.
 */
function WatchOverlay({
  video,
  onClose,
}: {
  video: AdminVideoResponse;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${video.title}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-9 right-0 inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-black/40 px-2 py-1 text-[11px] text-white transition-colors hover:bg-black/60"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
        <video
          key={video.id}
          src={video.hlsUrl ?? undefined}
          poster={video.thumbnailUrl ?? undefined}
          controls
          autoPlay
          className="max-h-[80vh] w-full rounded-lg bg-black"
        />
        <p className="mt-2 truncate text-[11px] text-white/70" title={video.title}>
          {video.title}
        </p>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Built from the current params rather than from scratch, so changing the status filter does not
 * silently drop the header's date filter — the page would then show rows the picker excludes.
 */
function buildHref(
  pathname: string,
  params: URLSearchParams,
  term: string,
  status: StatusFilter,
) {
  const next = new URLSearchParams(params);
  // Back to page one: page 3 of the previous result set is not page 3 of this one, and is
  // usually past its end.
  next.delete("page");
  if (term.trim()) next.set("q", term.trim());
  else next.delete("q");
  if (status !== "ALL") next.set("status", status);
  else next.delete("status");
  const query = next.toString();
  return (query ? `${pathname}?${query}` : pathname) as never;
}
