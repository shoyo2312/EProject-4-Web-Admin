import { ErrorState } from "@/components/layout/error-state";
import { PageHeader } from "@/components/layout/page-header";
import { VideosTable } from "@/components/videos/videos-table";
import { Card } from "@/components/ui/card";
import { Pager } from "@/components/ui/pager";
import { LIST_PAGE_SIZE, getUserProfiles, listVideos, referenceNow } from "@/lib/api/admin";
import { isoDay, parseAsOf, parsePage } from "@/lib/api/window";
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
  searchParams: Promise<{ q?: string; status?: string; asOf?: string; page?: string }>;
}) {
  const { q, status, asOf: asOfParam, page: pageParam } = await searchParams;
  const filter = parseStatus(status);
  const latest = isoDay(referenceNow());
  const asOf = parseAsOf(asOfParam, latest);
  const pageIndex = parsePage(pageParam);

  /**
   * A status total across the whole library, not the page: a one-row request exists only for
   * its `totalElements`. Counting the rows on screen would report "2 to review" when the
   * queue holds four hundred.
   */
  const countByStatus = (s: VideoStatus) =>
    listVideos({ q, status: s, size: 1 }).then((p) => p.totalElements);

  let page;
  let counts;
  try {
    // Filtering and paging server-side rather than over the fetched rows: "show me everything
    // taken down" must not depend on how many rows happened to come back.
    const [listed, ...totals] = await Promise.all([
      listVideos({ q, status: filter, page: pageIndex }),
      countByStatus("PENDING_REVIEW"),
      countByStatus("TAKEN_DOWN"),
      countByStatus("REJECTED"),
      countByStatus("PROCESSING"),
      countByStatus("FAILED"),
    ]);
    page = listed;
    const [review, down, rejected, processing, failed] = totals;
    counts = {
      awaitingReview: review,
      takenDown: down + rejected,
      stuck: processing + failed,
    };
  } catch (error) {
    return (
      <>
        <PageHeader title="Videos" />
        <ErrorState error={error} />
      </>
    );
  }

  // ponytail: the date cut runs over the page rather than the query, because video-service
  // takes no date parameter — a page of uploads newer than the picked date comes back short
  // instead of being skipped. Push a `createdBefore` param into AdminVideoController if that
  // starts to bite. The status totals above ignore it for the same reason.
  const videos = page.content.filter((v) => v.createdAt.slice(0, 10) <= asOf);
  const views = videos.reduce((sum, v) => sum + v.viewCount, 0);

  // Owner handles for the rows on screen. user-service owns them; video-service only has the id.
  // Non-fatal — a row just falls back to showing the raw id if this lookup is unavailable.
  const owners = await getUserProfiles(videos.map((v) => v.userId)).catch(() => ({}));

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
            <p className="label-caps text-ink-soft">Matching</p>
            <p className="figure mt-2 text-[24px] font-bold">
              {formatNumber(page.totalElements)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            {/* The worklist. Everything else on this row is a report; this one is
                a number that is supposed to go down, and a video sitting in it is
                one nobody can watch until an admin looks. */}
            <p className="label-caps text-ink-soft">To Review</p>
            <p className="figure mt-2 text-[24px] font-bold text-pending">
              {formatNumber(counts.awaitingReview)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            {/* An admin's takedown and the classifier's own removal, together:
                for this count what matters is that the video is off the platform. */}
            <p className="label-caps text-ink-soft">Taken Down</p>
            <p className="figure mt-2 text-[24px] font-bold text-danger">
              {formatNumber(counts.takenDown)}
            </p>
          </Card>
          <Card className="px-5 py-4">
            {/* Processing and failed together: both mean nobody can watch it, and a
                queue that stops draining shows up here before anywhere else. */}
            <p className="label-caps text-ink-soft">Not Playable</p>
            <p className="figure mt-2 text-[24px] font-bold text-pending">
              {formatNumber(counts.stuck)}
              <span className="ml-2 text-[11px] font-normal text-ink-faint">
                {formatCompact(views)} views on this page
              </span>
            </p>
          </Card>
        </div>

        <VideosTable
          videos={videos}
          owners={owners}
          query={q ?? ""}
          status={filter ?? "ALL"}
        />

        <Pager
          page={page.number}
          totalPages={page.totalPages}
          total={page.totalElements}
          size={LIST_PAGE_SIZE}
          label="videos"
        />
      </div>
    </>
  );
}
