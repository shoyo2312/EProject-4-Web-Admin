import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { ReviewQueue } from "@/components/moderation/review-queue";
import { getModerationSettings } from "@/lib/api/moderation";
import { getHandles } from "@/lib/api/names";
import { listVideos } from "@/lib/api/videos";
import { formatNumber, plural } from "@/lib/format";
import { reviewLines } from "@/lib/review";

/** Held videos per visit. Deciding the last of them offers the next oldest. */
const BATCH = 50;

/**
 * The videos automatic moderation held for a person, one at a time, oldest first: the player, why
 * the classifier held it, who uploaded it and what their record is, and the two answers. A held
 * video is invisible to everyone until someone decides, so the order is how long each has waited.
 */
export default async function VideoReviewPage({
  searchParams,
}: {
  /** `video` opens the screen on that video — what a notification about it links to. */
  searchParams: Promise<{ video?: string }>;
}) {
  const { video: startAt } = await searchParams;
  let queue;
  let settings;
  try {
    [queue, settings] = await Promise.all([
      // Live rows only: a video its owner deleted while it waited has nothing left to decide.
      listVideos({ status: "PENDING_REVIEW", deleted: false, sort: "createdAt,asc", size: BATCH }),
      // Non-fatal: without the thresholds the score still shows, only not against its lines.
      getModerationSettings().catch(() => null),
    ]);
  } catch (error) {
    return (
      <>
        <PageHeader title="Video Review" />
        <ErrorState error={error} />
      </>
    );
  }

  const handles = await getHandles(queue.content.map((video) => video.userId));
  const waiting = queue.totalElements;

  return (
    <>
      <PageHeader
        title="Video Review"
        subtitle={
          waiting === 0
            ? "Nothing is waiting for review."
            : `${formatNumber(waiting)} ${plural(waiting, "video")} held by automatic moderation, longest waiting first.`
        }
      />
      <ReviewQueue
        // Keyed, so following another notification while already here opens its video.
        key={startAt ?? ""}
        startAt={startAt ?? null}
        videos={queue.content}
        total={waiting}
        handles={handles}
        lines={reviewLines(settings)}
      />
    </>
  );
}
