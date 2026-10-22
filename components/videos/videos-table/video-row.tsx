"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, EyeOff, Play, RotateCcw, type LucideIcon } from "lucide-react";
import {
  moderateVideoAction,
  videoModerationDetailAction,
} from "@/app/(admin)/videos/actions";
import { SelectCell } from "@/components/moderation/bulk-bar";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { ReasonForm } from "@/components/moderation/reason-form";
import { VideoStatusBadge } from "@/components/ui/status-badge";
import { Field, RowDetail, expandableRowProps } from "@/components/ui/row-detail";
import { Tooltip } from "@/components/ui/tooltip";
import { VideoThumb } from "@/components/videos/video-thumb";
import { WatchOverlay } from "@/components/videos/videos-table/watch-overlay";
import type { AdminVideoResponse, UserProfileResponse } from "@/lib/api/types";
import {
  daysUntilPurge,
  formatCompact,
  formatCount,
  formatDateTime,
  formatDuration,
  plural,
  relativeTime,
  shortId,
} from "@/lib/format";
import { PRESET_REASONS, playable, videoDecision, type VideoDecision } from "@/lib/moderation";
import { TRASH_RETENTION_DAYS } from "@/lib/notifications";
import { describeModeration } from "@/lib/review";
import { usePropagation } from "@/lib/use-propagation";
import { useRowDetail } from "@/lib/use-row-detail";
import type { Selection } from "@/lib/use-selection";
import { cn } from "@/lib/utils";

export const DECISIONS: Record<
  VideoDecision | "reject",
  { label: string; verb: string; confirm: string; Icon: LucideIcon }
> = {
  takedown: { label: "Take down", verb: "taking down", confirm: "Confirm takedown", Icon: EyeOff },
  restore: { label: "Restore", verb: "restoring", confirm: "Confirm restore", Icon: RotateCcw },
  approve: { label: "Approve", verb: "approving", confirm: "Confirm approval", Icon: CheckCircle2 },
  reject: { label: "Reject", verb: "rejecting", confirm: "Confirm rejection", Icon: EyeOff },
};

export function VideoRow({
  video,
  owner,
  now,
  selection,
  bulkPending,
}: {
  video: AdminVideoResponse;
  owner?: UserProfileResponse;
  now: number;
  selection: Selection;
  /** A bulk action went out for this row and its status has not moved yet. */
  bulkPending: boolean;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [submitting, startSubmit] = useTransition();
  // Opening the row is what triggers the fetch — once, lazily. See getModerationDetail.
  const detail = useRowDetail(() => videoModerationDetailAction(video.id));
  const { pending: propagating, stalled, watch } = usePropagation(
    video.status,
    "Still the old status — video-service has not consumed the event yet. The action is recorded; reload in a moment.",
  );
  const machineReason = describeModeration(video.moderation, video.textModeration);

  const pending = propagating || bulkPending;

  const action = videoDecision(video.status);
  const decision = DECISIONS[action];
  const watchable = playable(video.status);
  const presets = PRESET_REASONS[action];

  function submit() {
    startSubmit(async () => {
      const outcome = await moderateVideoAction(video.id, action, reason ?? "");
      setResult(outcome.message);
      if (outcome.ok) {
        setReason(null);
        watch();
      }
    });
  }

  return (
    <>
      <tr
        {...expandableRowProps(detail.toggle, detail.open)}
        className={cn(
          "border-b border-line transition-colors last:border-b-0 hover:bg-surface-muted",
          "cursor-pointer",
        )}
      >
        <SelectCell
          id={video.id}
          label={`Select ${video.title || "untitled upload"}`}
          selection={selection}
          disabledReason={
            video.deletedAt
              ? "Deleted by its owner — it cannot be moderated"
              : bulkPending
                ? "Waiting for the last action to land"
                : null
          }
        />
        <td className="max-w-[260px] px-3 py-3 @4xl:max-w-[320px]">
          <div className="flex items-center gap-3">
            {/* Purged media leaves the thumbnail url pointing at nothing. */}
            <VideoThumb
              src={video.purgeEventPublishedAt ? null : video.thumbnailUrl}
              className="h-10 w-7"
            />
            <div className="min-w-0">
              <span className="block truncate font-medium" title={video.title}>
                {video.title || "(untitled upload)"}
              </span>
              {video.failureReason ? (
                <span className="block truncate text-[10px] text-danger" title={video.failureReason}>
                  {video.failureReason}
                </span>
              ) : null}
            </div>
          </div>
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap @4xl:table-cell">
          {owner?.username ? (
            <span className="text-ink-soft">@{owner.username}</span>
          ) : (
            <span className="figure text-ink-faint">#{shortId(video.userId.slice(-8), 8)}</span>
          )}
        </td>
        <td className="px-3 py-3">
          {/* A deleted video's pipeline status (PUBLISHED, TAKEN_DOWN, ...) stopped mattering
              the moment its owner removed it — showing both reads as "which one is it". */}
          {video.deletedAt ? (
            <span className="inline-flex items-center rounded-md border border-danger/25 bg-danger-bg px-2 py-1 text-[11px] font-medium text-danger">
              Deleted
            </span>
          ) : (
            <VideoStatusBadge status={video.status} dimmed={pending} />
          )}
          {pending ? (
            <span className="ml-2 text-[10px] text-ink-faint">applying…</span>
          ) : null}
        </td>
        <td className="hidden px-3 py-3 @6xl:table-cell">
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
        <td className="figure hidden px-3 py-3 text-right @4xl:table-cell">
          {watchable ? formatCount(video.viewCount) : <span className="text-ink-faint">—</span>}
        </td>
        <td className="figure hidden px-3 py-3 text-right text-ink-soft @6xl:table-cell">
          {watchable ? formatCount(video.likeCount) : <span className="text-ink-faint">—</span>}
        </td>
        <td className="hidden px-3 py-3 whitespace-nowrap text-ink-faint @5xl:table-cell">
          {relativeTime(video.createdAt)}
        </td>
        {/* Keys stop here too: Enter on a button would otherwise reach the row's handler, which
            cancels the click and opens the row instead. */}
        <td
          className="px-3 py-3 pr-5 text-right"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="inline-flex items-center gap-1.5">
            {/* The file at hlsUrl is a faststart mp4, not an HLS playlist — a bare
                <video> plays it in every browser, no player library. Shown only when
                the video is transcoded and holdable: the states playable() covers.
                A deleted video sits in a 30-day trash window with its media intact, so this
                stays available until purgeEventPublishedAt — media-worker has by then
                consumed the purge event and erased hlsUrl from MinIO for good. */}
            {watchable && video.hlsUrl && !video.purgeEventPublishedAt ? (
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
              // action twice against a status that has not moved yet. Also disabled once
              // deleted — the backend's own compareAndSet filters on deletedAt == null, so a
              // moderation write here would silently fail to land.
              disabled={pending || Boolean(video.deletedAt)}
              onClick={() => setReason(reason === null ? "" : null)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[11px] whitespace-nowrap transition-colors",
                pending || video.deletedAt ? "cursor-not-allowed text-ink-faint" : "hover:bg-surface",
                !pending && !video.deletedAt && action === "takedown" && "text-danger",
                !pending && !video.deletedAt && action === "approve" && "text-success",
              )}
            >
              <decision.Icon className="h-3.5 w-3.5" />
              {decision.label}
            </button>
          </div>
        </td>
      </tr>

      {detail.open ? (
        <RowDetail colSpan={10}>
          <Field label="Owner">
            {owner?.username ? `@${owner.username}` : `#${shortId(video.userId.slice(-8), 8)}`}
            {owner ? (
              <span className="text-ink-faint">
                {" "}
                · {formatCompact(owner.followerCount)} {plural(owner.followerCount, "follower")}
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
            {video.durationSeconds != null ? formatDuration(video.durationSeconds) : "—"}
          </Field>
          <Field label="Uploaded">{formatDateTime(video.createdAt)}</Field>
          <Field label="Published">
            {video.publishedAt ? formatDateTime(video.publishedAt) : "—"}
          </Field>
          <Field label="Updated">{formatDateTime(video.updatedAt)}</Field>
          {video.deletedAt ? (
            <>
              <Field label="Deleted at">{formatDateTime(video.deletedAt)}</Field>
              <Field label="Deleted by">
                {owner?.username ? `@${owner.username}` : `#${shortId(video.userId.slice(-8), 8)}`}
                <span className="text-ink-faint"> · owner (self-delete)</span>
              </Field>
              {video.purgeEventPublishedAt ? (
                <Field label="Media purged">{formatDateTime(video.purgeEventPublishedAt)}</Field>
              ) : (
                <Field label="Purges in">
                  {daysUntilPurge(video.deletedAt, TRASH_RETENTION_DAYS, now)}
                </Field>
              )}
              <Field label="Media" wide>
                <span className="text-ink-faint">
                  {video.purgeEventPublishedAt
                    ? "Permanently removed from storage — media-worker deleted the raw upload, thumbnail and HLS files once it consumed this video's purge event. The URLs below are what the record still points at; they no longer resolve."
                    : "Still in trash — the video's owner deleted it, but its media stays in storage and watchable here until the retention window above expires."}
                </span>
              </Field>
            </>
          ) : null}
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
              reportCount={detail.data?.reportCount ?? null}
              actions={detail.data?.actions ?? null}
              handles={detail.data?.handles}
              loading={detail.loading}
              onRetry={detail.retry}
            />
          </Field>
          <Field label="" wide>
            <Link
              href={`/videos/${video.id}` as never}
              className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
            >
              Open this video&apos;s page →
            </Link>
          </Field>
        </RowDetail>
      ) : null}

      {reason !== null ? (
        <tr className="border-b border-line bg-surface-muted">
          <td colSpan={10} className="px-5 py-3">
            <ReasonForm
              presets={presets}
              reason={reason}
              onReason={setReason}
              onSubmit={submit}
              onCancel={() => setReason(null)}
              submitting={submitting}
              placeholder={`Reason for ${decision.verb} "${video.title}" — pick one above or write your own`}
              confirmLabel={decision.confirm}
            />
          </td>
        </tr>
      ) : null}

      {(stalled ?? result) ? (
        <tr className="border-b border-line">
          <td colSpan={10} className="px-5 py-2 text-[11px] text-ink-soft">
            {stalled ?? result}
          </td>
        </tr>
      ) : null}

      {watching && video.hlsUrl ? (
        <WatchOverlay video={video} onClose={() => setWatching(false)} />
      ) : null}
    </>
  );
}
