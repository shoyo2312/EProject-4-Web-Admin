import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { VideosTable } from "@/components/videos/videos-table";
import { Card } from "@/components/ui/card";
import { listVideos, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf } from "@/lib/api/window";
import { formatCompact, formatNumber } from "@/lib/format";
import type { VideoStatus } from "@/lib/api/types";

const STATUSES: VideoStatus[] = [
  "PROCESSING",
  "PENDING_MODERATION",
  "PENDING_REVIEW",
  "PUBLISHED",
  "FAILED",
  "REJECTED",
  "TAKEN_DOWN",
];

function parseStatus(value: string | undefined): VideoStatus | undefined {
  return STATUSES.includes(value as VideoStatus) ? (value as VideoStatus) : undefined;
}

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; asOf?: string }>;
}) {
  const { q, status, asOf: asOfParam } = await searchParams;
  const filter = parseStatus(status);
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf(asOfParam, latest);

  let videos;
  try {
    // Filtering server-side rather than over the fetched page: "show me everything taken down"
    // must not depend on how many rows happened to come back.
    videos = (await listVideos({ q, status: filter, size: 100 })).filter(
      (v) => v.createdAt.slice(0, 10) <= asOf,
    );
  } catch (error) {
    return (
      <>
        <PageHeader title="Videos" />
        <ErrorState error={error} />
      </>
    );
  }

  const takenDown = videos.filter(
    (v) => v.status === "TAKEN_DOWN" || v.status === "REJECTED",
  ).length;
  const awaitingReview = videos.filter((v) => v.status === "PENDING_REVIEW").length;
  const stuck = videos.filter(
    (v) => v.status === "PROCESSING" || v.status === "FAILED",
  ).length;
  const views = videos.reduce((sum, v) => sum + v.viewCount, 0);

  return (
    <>
      <PageHeader
        title="Videos"
        subtitle="Every upload on the platform. Taking one down writes a moderation action and removes it from the feed."
        filters={{ asOf, latest }}
        csv={{ name: "videos", rows: videos }}
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Card className="px-5 py-4">
            <p className="label-caps text-ink-soft">Listed</p>
            <p className="figure mt-2 text-[24px] font-bold">
              {formatNumber(videos.length)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            {/* The worklist. Everything else on this row is a report; this one is
                a number that is supposed to go down, and a video sitting in it is
                one nobody can watch until an admin looks. */}
            <p className="label-caps text-ink-soft">To Review</p>
            <p className="figure mt-2 text-[24px] font-bold text-pending">
              {formatNumber(awaitingReview)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            {/* An admin's takedown and the classifier's own removal, together:
                for this count what matters is that the video is off the platform. */}
            <p className="label-caps text-ink-soft">Taken Down</p>
            <p className="figure mt-2 text-[24px] font-bold text-danger">
              {formatNumber(takenDown)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            {/* Processing and failed together: both mean nobody can watch it, and a
                queue that stops draining shows up here before anywhere else. */}
            <p className="label-caps text-ink-soft">Not Playable</p>
            <p className="figure mt-2 text-[24px] font-bold text-pending">
              {formatNumber(stuck)}
              <span className="ml-2 text-[11px] font-normal text-ink-faint">
                {formatCompact(views)} views listed
              </span>
            </p>
          </Card>
        </div>

        <VideosTable videos={videos} query={q ?? ""} status={filter ?? "ALL"} />
      </div>
    </>
  );
}
