import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { EnforcePanel } from "@/components/moderation/enforce-panel";
import { ModerationHistory } from "@/components/moderation/moderation-history";
import { Card, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/row-detail";
import {
  getReportCount,
  getUserProfiles,
  getVideo,
  listTargetActions,
} from "@/lib/api/admin";
import { playable } from "@/lib/moderation";
import { daysUntilPurge, formatCompact, formatCount, formatDateTime, formatDuration } from "@/lib/format";
import type {
  AdminVideoResponse,
  ModerationActionResponse,
  UserProfileResponse,
} from "@/lib/api/types";

/**
 * One video, everything the console knows about it, and the decision to be made.
 *
 * The only route that reaches a video the listing cannot: that listing matches titles only and
 * drops videos their owner deleted, so a report — which carries an id and nothing else — had
 * nowhere to land. `GET /api/v1/videos/admin/{id}` applies no visibility rule at all, which is
 * the point: taken down, still processing, private and owner-deleted are exactly the states a
 * moderator has to be able to read back.
 */
export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let video: AdminVideoResponse | null;
  let reportCount: number;
  let actions: ModerationActionResponse[];
  try {
    video = await getVideo(id);
    // Sequential on purpose: the count and the history are about this video, and asking for
    // them before knowing there is one would be two calls thrown away on every bad id.
    [reportCount, actions] = video
      ? await Promise.all([getReportCount("VIDEO", id), listTargetActions("VIDEO", id)])
      : [0, []];
  } catch (error) {
    return (
      <>
        <DetailHeader title="Video" />
        <ErrorState error={error} />
      </>
    );
  }

  if (!video) {
    return (
      <>
        <DetailHeader title="Video" />
        <Card className="px-5 py-10 text-center text-[12px] text-ink-faint">
          Nothing at id <span className="figure">{id}</span>. Whatever pointed here was filed
          against a video video-service has no record of.
        </Card>
      </>
    );
  }

  // Non-fatal: the page falls back to the raw id if user-service cannot be reached.
  const owners = await getUserProfiles([video.userId]).catch(
    () => ({}) as Record<string, UserProfileResponse>,
  );
  const owner = owners[video.userId];
  const watchable = playable(video.status);

  // Approving what automatic moderation held back is the same write as undoing an admin's
  // takedown — both put the video back through VideoRestoredEvent — so it is the same action.
  const action =
    video.status === "TAKEN_DOWN"
    || video.status === "REJECTED"
    || video.status === "PENDING_REVIEW"
      ? "restore"
      : "takedown";

  return (
    <>
      <DetailHeader
        title={video.title || "(untitled upload)"}
        subtitle={
          video.deletedAt
            ? video.deleteEventPublishedAt
              ? `Deleted by its owner on ${formatDateTime(video.deletedAt)} — media permanently purged.`
              : `Deleted by its owner on ${formatDateTime(video.deletedAt)} — in trash, ${daysUntilPurge(video.deletedAt)} left before permanent deletion.`
            : `${video.status} · ${video.visibility} · uploaded ${formatDateTime(video.createdAt)}`
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Preview"
            hint="GET /api/v1/videos/admin/{id} — no visibility rule applied, so a taken-down or trashed video still plays here"
          />
          <div className="px-5 py-4">
            {/* A deleted video keeps its media for a 30-day trash window before permanent
                purge — deleteEventPublishedAt (not deletedAt) is the signal that media-worker
                has actually erased it from MinIO, which is when hlsUrl stops resolving. */}
            {watchable && video.hlsUrl && !video.deleteEventPublishedAt ? (
              // A faststart mp4 rather than an HLS playlist, so a bare <video> plays it in
              // every browser with no player library.
              <video
                src={video.hlsUrl}
                poster={video.thumbnailUrl ?? undefined}
                controls
                className="max-h-[60vh] w-full rounded-lg bg-black"
              />
            ) : (
              <p className="text-[12px] text-ink-faint">
                {video.deleteEventPublishedAt
                  ? "Media permanently removed from storage — nothing left to play."
                  : watchable
                    ? "No playable file on the record — the transcode produced no output."
                    : `Nothing to play: the video is ${video.status}, so no transcoded file exists yet.`}
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upload" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 px-5 py-4 text-[12px] xl:grid-cols-4">
            <Field label="Owner">
              <Link
                href={`/users/${video.userId}` as never}
                className="underline-offset-4 hover:underline"
              >
                {owner?.username ? `@${owner.username}` : `#${video.userId.slice(-8)}`}
              </Link>
              {owner ? (
                <span className="text-ink-faint">
                  {" "}
                  · {formatCompact(owner.followerCount)} followers
                </span>
              ) : null}
            </Field>
            <Field label="Status">{video.status}</Field>
            <Field label="Visibility">{video.visibility}</Field>
            <Field label="Duration">
              {video.durationSeconds != null ? formatDuration(video.durationSeconds) : "—"}
            </Field>
            {/* An em dash rather than 0: a video still transcoding has no view count, and
                printing zero would read as one nobody watched. */}
            <Field label="Views">{watchable ? formatCount(video.viewCount) : "—"}</Field>
            <Field label="Likes">{watchable ? formatCount(video.likeCount) : "—"}</Field>
            <Field label="Comments">
              {video.commentsDisabled
                ? "disabled"
                : video.commentCount != null
                  ? formatCount(video.commentCount)
                  : "—"}
            </Field>
            <Field label="Reports">{reportCount}</Field>
            <Field label="Uploaded">{formatDateTime(video.createdAt)}</Field>
            <Field label="Published">
              {video.publishedAt ? formatDateTime(video.publishedAt) : "—"}
            </Field>
            <Field label="Updated">{formatDateTime(video.updatedAt)}</Field>
            {video.deletedAt && !video.deleteEventPublishedAt ? (
              <Field label="Purges in">{daysUntilPurge(video.deletedAt)}</Field>
            ) : null}
            {video.deleteEventPublishedAt ? (
              <Field label="Media purged">{formatDateTime(video.deleteEventPublishedAt)}</Field>
            ) : null}
            <Field label="Video ID">
              <span className="figure break-all">{video.id}</span>
            </Field>
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
                <span className="text-danger">{video.takedownReason}</span>
              </Field>
            ) : null}
            {video.failureReason ? (
              <Field label="Transcode failure" wide>
                <span className="text-danger">{video.failureReason}</span>
              </Field>
            ) : null}
            {video.rawFileUrl ? (
              <Field label="Raw file" wide>
                <span className="break-all text-ink-faint">{video.rawFileUrl}</span>
              </Field>
            ) : null}
          </dl>
          <div className="border-t border-line px-5 py-3">
            <Link
              href={{ pathname: "/comments", query: { videoId: video.id } } as never}
              className="text-[11px] text-ink-soft underline-offset-4 hover:underline"
            >
              Open this video&apos;s comments →
            </Link>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Automatic moderation"
            hint="What the classifier scored. Admin reads only — the public API withholds it."
          />
          <div className="px-5 py-4">
            <ClassifierVerdict video={video} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Moderation history" />
          <div className="px-5 py-4">
            <ModerationHistory reportCount={reportCount} actions={actions} loading={false} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Decision"
            hint="Writes a moderation action and publishes it; video-service applies it from the topic"
          />
          <div className="px-5 py-4">
            <EnforcePanel
              kind="video"
              targetId={video.id}
              action={action}
              subject={`"${video.title || video.id}"`}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function DetailHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <Link
        href="/videos"
        className="mb-3 inline-flex items-center gap-1.5 text-[11px] text-ink-soft underline-offset-4 hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All videos
      </Link>
      <PageHeader title={title} subtitle={subtitle} />
    </>
  );
}

/**
 * Every field of the classifier's account, not the one-line summary the table shows.
 *
 * An auto-removed video carries no takedownReason — that field is only ever written by an admin
 * — so this is the whole explanation for why it is off the platform. The page where that call
 * gets overturned is where all of it belongs: the score, how many frames agreed, and which
 * model version decided.
 */
function ClassifierVerdict({ video }: { video: AdminVideoResponse }) {
  const moderation = video.moderation;

  if (!moderation) {
    return (
      <p className="text-[12px] text-ink-faint">
        No check recorded — either the upload predates automatic moderation, or it never reached
        the classifier.
      </p>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[12px] xl:grid-cols-4">
      <Field label="Verdict">
        <span className={moderation.verdict === "REJECTED" ? "text-danger" : undefined}>
          {moderation.verdict}
        </span>
      </Field>
      <Field label="Label">{moderation.label ?? "—"}</Field>
      {/* Raw rather than a percentage: the thresholds it is compared against are configured on
          this same 0–1 scale, and whoever is deciding whether to move one should not convert. */}
      <Field label="Highest frame score">{moderation.maxScore.toFixed(3)}</Field>
      <Field label="Frames over threshold">
        {moderation.suspiciousFrames}/{moderation.totalFrames}
      </Field>
      <Field label="Model">{moderation.model ?? "unknown"}</Field>
      <Field label="Model version">{moderation.modelVersion ?? "unversioned"}</Field>
      <Field label="Checked">{formatDateTime(moderation.checkedAt)}</Field>
      {moderation.reason ? (
        <Field label="Check did not complete" wide>
          <span className="text-pending">{moderation.reason}</span>
        </Field>
      ) : null}
    </dl>
  );
}
